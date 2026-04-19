// src/index.js
// PromptRent — Main server entry point

require('dotenv').config();
const express = require('express');
const { middleware } = require('@line/bot-sdk');
const webhookRouter = require('./routes/webhook');
const scoreRouter = require('./routes/score');
const adminRouter = require('./routes/admin');
const scheduler = require('./scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// LINE middleware config
const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// ── Routes ──────────────────────────────────────────────────────
// LINE webhook: must use raw body (LINE signature verification)
app.use('/webhook', middleware(lineConfig), webhookRouter);

// Public score page (for share token links)
app.use('/score', express.json(), scoreRouter);

// Admin API (protected by simple token in V1)
app.use('/admin', express.json(), adminRouter);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'PromptRent', ts: new Date().toISOString() });
});

// ── Start server ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏠 PromptRent server running on port ${PORT}`);
  console.log(`   Webhook: POST /webhook`);
  console.log(`   Score:   GET  /score/:token`);
  console.log(`   Health:  GET  /health\n`);
});

// ── Start scheduler ─────────────────────────────────────────────
scheduler.start();

module.exports = app;
