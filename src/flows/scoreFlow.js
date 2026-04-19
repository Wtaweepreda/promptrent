// src/flows/scoreFlow.js

const { sendText, sendFlex, buildScoreCard } = require('../utils/lineHelpers');
const scoreService = require('../services/scoreService');
const leaseService = require('../services/leaseService');
const db = require('../db');
const { v4: uuidv4 } = require('uuid');

// ── Tenant views their score ─────────────────────────────────────
async function showScore(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `📊 No active lease found.\n\nYour Renter Score will appear here once you have an active lease with data.`
    );
  }

  // Show score for the first active lease (V1: one lease per tenant)
  const lease = leases[0];
  const score = await scoreService.getScore(user.id, lease.id);

  if (!score) {
    // Check how many months we have
    const records = await db.paymentRecord.findMany({
      where: { leaseId: lease.id, paymentStatus: { not: 'pending' } },
    });

    const have = records.length;
    const need = scoreService.MIN_MONTHS_REQUIRED;

    return sendText(
      event.replyToken,
      `⭐ Building Your Renter Score...\n\n` +
      `🏠 ${lease.property.nickname}\n` +
      `Progress: ${have}/${need} months recorded\n\n` +
      `${need - have} more month${need - have !== 1 ? 's' : ''} needed to generate your score.\n\n` +
      `Pay on time each month and your score will appear automatically! 💪`
    );
  }

  // Show score as flex card
  return sendFlex(event.replyToken, `Renter Score: ${score.score}/100`, buildScoreCard(score));
}

// ── Tenant shares score ──────────────────────────────────────────
async function shareScore(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(event.replyToken, 'No active lease found.');
  }

  const lease = leases[0];
  const score = await scoreService.getScore(user.id, lease.id);

  if (!score) {
    return sendText(
      event.replyToken,
      `Your score isn't ready yet. You need at least ${scoreService.MIN_MONTHS_REQUIRED} months of payment data.`
    );
  }

  // Generate or reuse share token
  const existing = await db.shareToken.findFirst({
    where: {
      tenantId: user.id,
      leaseId: lease.id,
      expiresAt: { gt: new Date() },
    },
  });

  let token;
  if (existing) {
    token = existing.token;
  } else {
    const newToken = await db.shareToken.create({
      data: {
        tenantId: user.id,
        leaseId: lease.id,
        token: uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });
    token = newToken.token;
  }

  const appUrl = process.env.APP_BASE_URL || 'https://your-app.up.railway.app';
  const shareUrl = `${appUrl}/score/view/${token}`;

  return sendText(
    event.replyToken,
    `🔗 Your Renter Score Share Link\n\n` +
    `Score: ${score.score}/100 (${score.gradeLabel})\n\n` +
    `Share this link with prospective landlords:\n${shareUrl}\n\n` +
    `⏰ Link expires in 7 days\n` +
    `🔐 Only people with this link can view it`
  );
}

module.exports = { showScore, shareScore };
