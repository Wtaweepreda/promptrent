// src/routes/webhook.js
// Receives all LINE webhook events and dispatches to handlers

const express = require('express');
const router = express.Router();
const { handleEvent } = require('../handlers/eventDispatcher');

router.post('/', async (req, res) => {
  // LINE sends an array of events in each webhook call
  const events = req.body.events;

  try {
    await Promise.all(events.map(handleEvent));
    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook error:', err);
    // Always return 200 to LINE — otherwise LINE retries
    res.status(200).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
