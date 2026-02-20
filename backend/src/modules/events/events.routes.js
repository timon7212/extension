const express = require('express');
const db = require('../../config/db');
const { authenticate } = require('../../middleware/auth');
const { processEvent } = require('../rules/rulesEngine');

const router = express.Router();

const VALID_TYPES = ['invite_sent', 'connected', 'message_sent', 'reply_received', 'meeting_booked'];

/**
 * POST /api/events
 * Body: { lead_id, type, metadata? }
 *
 * Creates event, then runs rules engine.
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { lead_id, type, metadata } = req.body;

    if (!lead_id || !type) {
      return res.status(400).json({ error: 'lead_id and type required' });
    }

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid event type. Valid: ${VALID_TYPES.join(', ')}` });
    }

    // Verify lead exists
    const leadCheck = await db.query('SELECT id FROM leads WHERE id = $1', [lead_id]);
    if (leadCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Create event
    const { rows } = await db.query(
      `INSERT INTO events (lead_id, employee_id, type, metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [lead_id, req.employee.id, type, metadata ? JSON.stringify(metadata) : '{}']
    );

    const event = rows[0];

    // Run rules engine
    const ruleResult = await processEvent(event);

    res.status(201).json({
      event,
      ruleResult,
    });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/events?lead_id=&employee_id=&type=&page=&limit=
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { lead_id, employee_id, type, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (lead_id) {
      conditions.push(`e.lead_id = $${idx++}`);
      params.push(lead_id);
    }
    if (employee_id) {
      conditions.push(`e.employee_id = $${idx++}`);
      params.push(employee_id);
    }
    if (type) {
      conditions.push(`e.type = $${idx++}`);
      params.push(type);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const { rows } = await db.query(
      `SELECT e.*, l.name AS lead_name, emp.name AS employee_name
       FROM events e
       LEFT JOIN leads l ON l.id = e.lead_id
       LEFT JOIN employees emp ON emp.id = e.employee_id
       ${where}
       ORDER BY e.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ events: rows });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
