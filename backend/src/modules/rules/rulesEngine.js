const db = require('../../config/db');

/**
 * Rules Engine
 * Processes events and:
 *   1. Updates lead stage
 *   2. Creates follow-up tasks
 */

const RULES = {
  invite_sent: {
    newStage: 'Invited',
    task: {
      type: 'Follow up on invite',
      dueInHours: 72, // 3 days
    },
  },
  connected: {
    newStage: 'Connected',
    task: {
      type: 'Send first message',
      dueInHours: 24,
    },
  },
  message_sent: {
    newStage: 'Messaged',
    task: {
      type: 'Check for reply',
      dueInHours: 48, // 2 days
    },
  },
  reply_received: {
    newStage: 'Replied',
    task: null,
  },
  meeting_booked: {
    newStage: 'Meeting',
    task: null,
  },
};

/**
 * Process an event through the rules engine.
 * @param {object} event - { id, lead_id, employee_id, type }
 * @returns {object} - { stage, task }
 */
async function processEvent(event) {
  const rule = RULES[event.type];
  if (!rule) {
    throw new Error(`No rule defined for event type: ${event.type}`);
  }

  // 1. Update lead stage
  await db.query(
    'UPDATE leads SET stage = $1 WHERE id = $2',
    [rule.newStage, event.lead_id]
  );

  let createdTask = null;

  // 2. Create follow-up task if defined
  if (rule.task) {
    const dueAt = new Date(Date.now() + rule.task.dueInHours * 60 * 60 * 1000);

    const { rows } = await db.query(
      `INSERT INTO tasks (lead_id, employee_id, type, due_at)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [event.lead_id, event.employee_id, rule.task.type, dueAt]
    );

    createdTask = rows[0];
  }

  return {
    stage: rule.newStage,
    task: createdTask,
  };
}

module.exports = { processEvent, RULES };
