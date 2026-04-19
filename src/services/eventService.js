// src/services/eventService.js
// Append-only audit log

const db = require('../db');

async function log(actorId, eventType, entityType, entityId, payload = {}) {
  try {
    return db.event.create({
      data: { actorId, eventType, entityType, entityId, payload },
    });
  } catch (err) {
    // Never let event logging break the main flow
    console.error('Event log failed:', err.message);
  }
}

module.exports = { log };
