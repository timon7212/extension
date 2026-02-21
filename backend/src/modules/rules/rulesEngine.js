const db = require('../../config/db');

/**
 * Rules Engine
 * Processes events and:
 *   1. Updates lead stage (ONLY FORWARD, never backwards)
 *   2. Creates follow-up tasks
 */

const STAGE_ORDER = ['New', 'Invited', 'Connected', 'Messaged', 'Replied', 'Meeting'];

const RULES = {
  invite_sent: {
    newStage: 'Invited',
    task: {
      type: 'Follow up on invite',
      dueInHours: 72,
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
      dueInHours: 48,
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
 * @returns {object} - { stage, task, stageChanged }
 */
async function processEvent(event) {
  const rule = RULES[event.type];
  if (!rule) {
    throw new Error(`No rule defined for event type: ${event.type}`);
  }

  // 1. Get current stage
  const { rows: leadRows } = await db.query(
    'SELECT stage FROM leads WHERE id = $1',
    [event.lead_id]
  );

  if (leadRows.length === 0) {
    throw new Error('Lead not found');
  }

  const currentStage = leadRows[0].stage;
  const currentIdx = STAGE_ORDER.indexOf(currentStage);
  const newIdx = STAGE_ORDER.indexOf(rule.newStage);

  let stageChanged = false;

  // Only advance stage, NEVER go backwards
  if (newIdx > currentIdx) {
    await db.query(
      'UPDATE leads SET stage = $1 WHERE id = $2',
      [rule.newStage, event.lead_id]
    );
    stageChanged = true;
  }

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
    stage: stageChanged ? rule.newStage : currentStage,
    stageChanged,
    task: createdTask,
  };
}

module.exports = { processEvent, RULES, STAGE_ORDER };
