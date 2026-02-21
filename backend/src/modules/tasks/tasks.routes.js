const express = require('express');
const db = require('../../config/db');
const { authenticate, authenticateOrApiKey } = require('../../middleware/auth');

const router = express.Router();

/**
 * GET /api/tasks
 * Query: ?employee_id=&status=open|done&lead_id=&page=&limit=
 */
router.get('/', authenticateOrApiKey, async (req, res) => {
  try {
    const { employee_id, status, lead_id, page = 1, limit = 50 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (employee_id) {
      conditions.push(`t.employee_id = $${idx++}`);
      params.push(employee_id);
    }
    if (status) {
      conditions.push(`t.status = $${idx++}`);
      params.push(status);
    }
    if (lead_id) {
      conditions.push(`t.lead_id = $${idx++}`);
      params.push(lead_id);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const countResult = await db.query(
      `SELECT COUNT(*) FROM tasks t ${where}`,
      params
    );

    const { rows } = await db.query(
      `SELECT t.*, l.name AS lead_name, l.linkedin_url, l.company AS lead_company,
              l.stage AS lead_stage, e.name AS employee_name
       FROM tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
       LEFT JOIN employees e ON e.id = t.employee_id
       ${where}
       ORDER BY
         CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
         t.due_at ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      tasks: rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (err) {
    console.error('Get tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/my
 * Returns tasks for the current authenticated employee, grouped by urgency.
 */
router.get('/my', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, l.name AS lead_name, l.linkedin_url, l.company AS lead_company,
              l.stage AS lead_stage
       FROM tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
       WHERE t.employee_id = $1
       ORDER BY
         CASE WHEN t.status = 'open' THEN 0 ELSE 1 END,
         t.due_at ASC
       LIMIT 100`,
      [req.employee.id]
    );

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);

    const overdue = rows.filter(t => t.status === 'open' && new Date(t.due_at) < startOfToday);
    const today = rows.filter(t => t.status === 'open' && new Date(t.due_at) >= startOfToday && new Date(t.due_at) < startOfTomorrow);
    const upcoming = rows.filter(t => t.status === 'open' && new Date(t.due_at) >= startOfTomorrow);
    const done = rows.filter(t => t.status === 'done');

    res.json({
      overdue,
      today,
      upcoming,
      done: done.slice(0, 10),
      counts: {
        overdue: overdue.length,
        today: today.length,
        upcoming: upcoming.length,
        done: done.length,
        total: rows.length,
      },
    });
  } catch (err) {
    console.error('Get my tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tasks/overdue
 * MUST be defined BEFORE /:id to avoid Express matching "overdue" as an id.
 */
router.get('/overdue', authenticateOrApiKey, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*, l.name AS lead_name, l.linkedin_url, e.name AS employee_name
       FROM tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
       LEFT JOIN employees e ON e.id = t.employee_id
       WHERE t.status = 'open' AND t.due_at < NOW()
       ORDER BY t.due_at ASC`
    );

    res.json({ tasks: rows });
  } catch (err) {
    console.error('Get overdue tasks error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/tasks
 * Body: { lead_id, type, due_at? }
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { lead_id, type, due_at } = req.body;

    if (!lead_id || !type) {
      return res.status(400).json({ error: 'lead_id and type required' });
    }

    const dueDate = due_at ? new Date(due_at) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const { rows } = await db.query(
      `INSERT INTO tasks (lead_id, employee_id, type, due_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [lead_id, req.employee.id, type, dueDate]
    );

    res.status(201).json({ task: rows[0] });
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PATCH /api/tasks/:id
 * Body: { status: 'done' | 'open' }
 */
router.patch('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['open', 'done'].includes(status)) {
      return res.status(400).json({ error: 'status must be open or done' });
    }

    const { rows } = await db.query(
      'UPDATE tasks SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: rows[0] });
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/tasks/:id
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Task not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
