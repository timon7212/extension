const express = require('express');
const db = require('../../config/db');
const { authenticate, authenticateOrApiKey } = require('../../middleware/auth');

const router = express.Router();

/**
 * GET /api/leads
 * Query: ?stage=&owner=&campaign=&search=&quality=&page=1&limit=50
 */
router.get('/', authenticateOrApiKey, async (req, res) => {
  try {
    const { stage, owner, campaign, search, quality, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (stage) {
      conditions.push(`l.stage = $${idx++}`);
      params.push(stage);
    }
    if (owner) {
      conditions.push(`l.owner_employee_id = $${idx++}`);
      params.push(owner);
    }
    if (campaign) {
      conditions.push(`l.campaign_tag = $${idx++}`);
      params.push(campaign);
    }
    if (quality) {
      conditions.push(`l.data_quality = $${idx++}`);
      params.push(quality);
    }
    if (search) {
      conditions.push(`(l.name ILIKE $${idx} OR l.company ILIKE $${idx} OR l.title ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM leads l ${where}`,
      params
    );

    const { rows } = await db.query(
      `SELECT l.*, e.name AS owner_name
       FROM leads l
       LEFT JOIN employees e ON e.id = l.owner_employee_id
       ${where}
       ORDER BY l.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      leads: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Get leads error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/leads/by-url?url=...
 */
router.get('/by-url', authenticate, async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url required' });

    const { rows } = await db.query(
      `SELECT l.*, e.name AS owner_name
       FROM leads l
       LEFT JOIN employees e ON e.id = l.owner_employee_id
       WHERE l.linkedin_url = $1`,
      [url]
    );

    if (rows.length === 0) {
      return res.json({ lead: null });
    }

    // Fetch tasks
    const tasks = await db.query(
      `SELECT * FROM tasks WHERE lead_id = $1 ORDER BY due_at ASC`,
      [rows[0].id]
    );

    // Fetch events (activity history)
    const events = await db.query(
      `SELECT ev.*, e.name AS employee_name
       FROM events ev
       LEFT JOIN employees e ON e.id = ev.employee_id
       WHERE ev.lead_id = $1
       ORDER BY ev.created_at DESC`,
      [rows[0].id]
    );

    res.json({ lead: rows[0], tasks: tasks.rows, events: events.rows });
  } catch (err) {
    console.error('Get lead by url error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/leads
 * Body: { linkedin_url, name, title, company, location, campaign_tag, tenure_months, data_quality }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { linkedin_url, name, title, company, location, campaign_tag, tenure_months, data_quality } = req.body;
    if (!linkedin_url || !name) {
      return res.status(400).json({ error: 'linkedin_url and name required' });
    }

    // Determine data quality automatically if not provided
    const quality = data_quality || (title && company ? 'complete' : 'partial');

    const { rows } = await db.query(
      `INSERT INTO leads (linkedin_url, name, title, company, location, campaign_tag, tenure_months, data_quality, owner_employee_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [linkedin_url, name, title || null, company || null, location || null, campaign_tag || null, tenure_months || null, quality, req.employee.id]
    );

    res.status(201).json({ lead: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Lead with this LinkedIn URL already exists' });
    }
    console.error('Create lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/leads/bulk
 * Body: { leads: [{ linkedin_url, name, title?, company?, location?, tenure_months?, data_quality? }] }
 * Bulk import leads (UPSERT — updates on re-scan).
 */
router.post('/bulk', authenticate, async (req, res) => {
  try {
    const { leads } = req.body;
    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'leads array required' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const lead of leads) {
      if (!lead.linkedin_url || !lead.name) {
        skipped++;
        continue;
      }

      // Auto-determine quality
      const quality = lead.data_quality || (lead.title && lead.company ? 'complete' : 'partial');

      try {
        const { rows } = await db.query(
          `INSERT INTO leads (linkedin_url, name, title, company, location, tenure_months, data_quality, stage, owner_employee_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'Connected', $8)
           ON CONFLICT (linkedin_url) DO UPDATE SET
             name = COALESCE(NULLIF(EXCLUDED.name, ''), leads.name),
             title = COALESCE(NULLIF(EXCLUDED.title, ''), leads.title),
             company = COALESCE(NULLIF(EXCLUDED.company, ''), leads.company),
             location = COALESCE(NULLIF(EXCLUDED.location, ''), leads.location),
             tenure_months = COALESCE(EXCLUDED.tenure_months, leads.tenure_months),
             data_quality = CASE
               WHEN EXCLUDED.title IS NOT NULL AND EXCLUDED.company IS NOT NULL THEN 'complete'
               WHEN leads.title IS NOT NULL AND leads.company IS NOT NULL THEN leads.data_quality
               ELSE 'partial'
             END,
             updated_at = NOW()
           RETURNING (xmax = 0) AS is_new`,
          [lead.linkedin_url, lead.name, lead.title || null, lead.company || null, lead.location || null, lead.tenure_months || null, quality, req.employee.id]
        );
        if (rows[0]?.is_new) created++;
        else updated++;
      } catch {
        skipped++;
      }
    }

    res.status(201).json({ created, updated, skipped, total: leads.length });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/leads/:id
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['name', 'title', 'company', 'location', 'campaign_tag', 'stage', 'tenure_months', 'data_quality'];
    const updates = [];
    const params = [];
    let idx = 1;

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = $${idx++}`);
        params.push(req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    // Auto-upgrade data_quality to 'complete' if title+company now present
    // (unless explicitly being set)
    if (!req.body.data_quality && (req.body.title || req.body.company)) {
      updates.push(`data_quality = CASE WHEN COALESCE($${idx}, title) IS NOT NULL AND COALESCE($${idx + 1}, company) IS NOT NULL THEN 'complete' ELSE data_quality END`);
      params.push(req.body.title || null, req.body.company || null);
      idx += 2;
    }

    params.push(id);
    const { rows } = await db.query(
      `UPDATE leads SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    res.json({ lead: rows[0] });
  } catch (err) {
    console.error('Update lead error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
