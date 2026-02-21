const express = require('express');
const db = require('../../config/db');
const { authenticate, requireAdmin } = require('../../middleware/auth');

const router = express.Router();

/**
 * GET /api/analytics/overview
 * Returns high-level pipeline metrics.
 */
router.get('/overview', async (req, res) => {
  try {
    // Stage counts
    const stageResult = await db.query(
      `SELECT stage, COUNT(*)::int AS count FROM leads GROUP BY stage`
    );
    const stages = {};
    stageResult.rows.forEach((r) => (stages[r.stage] = r.count));

    // Event counts by type
    const eventResult = await db.query(
      `SELECT type, COUNT(*)::int AS count FROM events GROUP BY type`
    );
    const events = {};
    eventResult.rows.forEach((r) => (events[r.type] = r.count));

    // Acceptance rate = connected / invite_sent
    const invites = events['invite_sent'] || 0;
    const connected = events['connected'] || 0;
    const acceptanceRate = invites > 0 ? ((connected / invites) * 100).toFixed(1) : 0;

    // Reply rate = reply_received / message_sent
    const messages = events['message_sent'] || 0;
    const replies = events['reply_received'] || 0;
    const replyRate = messages > 0 ? ((replies / messages) * 100).toFixed(1) : 0;

    const meetings = events['meeting_booked'] || 0;

    // Total leads
    const totalResult = await db.query('SELECT COUNT(*)::int AS count FROM leads');

    // Overdue tasks
    const overdueResult = await db.query(
      `SELECT COUNT(*)::int AS count FROM tasks WHERE status = 'open' AND due_at < NOW()`
    );

    res.json({
      totalLeads: totalResult.rows[0].count,
      stages,
      events,
      acceptanceRate: parseFloat(acceptanceRate),
      replyRate: parseFloat(replyRate),
      meetings,
      overdueTasks: overdueResult.rows[0].count,
    });
  } catch (err) {
    console.error('Analytics overview error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/employees
 * Returns per-employee funnel and activity.
 */
router.get('/employees', async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT
        emp.id,
        emp.name,
        COUNT(DISTINCT l.id)::int AS total_leads,
        COUNT(DISTINCT CASE WHEN l.stage = 'Invited' THEN l.id END)::int AS invited,
        COUNT(DISTINCT CASE WHEN l.stage = 'Connected' THEN l.id END)::int AS connected,
        COUNT(DISTINCT CASE WHEN l.stage = 'Messaged' THEN l.id END)::int AS messaged,
        COUNT(DISTINCT CASE WHEN l.stage = 'Replied' THEN l.id END)::int AS replied,
        COUNT(DISTINCT CASE WHEN l.stage = 'Meeting' THEN l.id END)::int AS meeting,
        COUNT(DISTINCT ev.id)::int AS total_events,
        COUNT(DISTINCT CASE WHEN t.status = 'open' AND t.due_at < NOW() THEN t.id END)::int AS overdue_tasks
      FROM employees emp
      LEFT JOIN leads l ON l.owner_employee_id = emp.id
      LEFT JOIN events ev ON ev.employee_id = emp.id
      LEFT JOIN tasks t ON t.employee_id = emp.id
      WHERE emp.is_active = TRUE
      GROUP BY emp.id, emp.name
      ORDER BY emp.name
    `);

    res.json({ employees: rows });
  } catch (err) {
    console.error('Analytics employees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/analytics/employee/:id
 * Returns detailed metrics for one employee.
 */
router.get('/employee/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Funnel
    const funnelResult = await db.query(
      `SELECT stage, COUNT(*)::int AS count
       FROM leads WHERE owner_employee_id = $1
       GROUP BY stage`,
      [id]
    );

    // Events per day (last 30 days)
    const activityResult = await db.query(
      `SELECT DATE(created_at) AS date, COUNT(*)::int AS count
       FROM events
       WHERE employee_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
       GROUP BY DATE(created_at)
       ORDER BY date`,
      [id]
    );

    // Overdue tasks
    const overdueResult = await db.query(
      `SELECT t.*, l.name AS lead_name
       FROM tasks t
       LEFT JOIN leads l ON l.id = t.lead_id
       WHERE t.employee_id = $1 AND t.status = 'open' AND t.due_at < NOW()
       ORDER BY t.due_at ASC`,
      [id]
    );

    // Avg reply speed (time between message_sent and reply_received per lead)
    const replySpeedResult = await db.query(
      `SELECT AVG(reply_time) AS avg_reply_hours FROM (
         SELECT
           EXTRACT(EPOCH FROM (
             MIN(CASE WHEN e2.type = 'reply_received' THEN e2.created_at END) -
             MIN(CASE WHEN e2.type = 'message_sent' THEN e2.created_at END)
           )) / 3600 AS reply_time
         FROM events e2
         WHERE e2.employee_id = $1
           AND e2.type IN ('message_sent', 'reply_received')
         GROUP BY e2.lead_id
         HAVING MIN(CASE WHEN e2.type = 'reply_received' THEN e2.created_at END) IS NOT NULL
       ) sub`,
      [id]
    );

    res.json({
      funnel: funnelResult.rows,
      activityPerDay: activityResult.rows,
      overdueTasks: overdueResult.rows,
      avgReplyHours: replySpeedResult.rows[0]?.avg_reply_hours
        ? parseFloat(parseFloat(replySpeedResult.rows[0].avg_reply_hours).toFixed(1))
        : null,
    });
  } catch (err) {
    console.error('Analytics employee detail error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
