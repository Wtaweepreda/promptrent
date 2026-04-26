// src/flows/scoreFlow.js

const { sendText, sendFlex, buildScoreCard, buildShareScoreCard } = require('../utils/lineHelpers');
const scoreService  = require('../services/scoreService');
const leaseService  = require('../services/leaseService');
const db            = require('../db');
const { v4: uuidv4 } = require('uuid');

// ── Tenant views their score ─────────────────────────────────────
async function showScore(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `No active lease found.\n\nYour Renter Score will appear here once you have an active lease with payment data.`,
    );
  }

  const lease = leases[0];
  const score = await scoreService.getScore(user.id, lease.id);

  if (!score) {
    const records = await db.paymentRecord.findMany({
      where: { leaseId: lease.id, paymentStatus: { not: 'pending' } },
    });

    const have = records.length;
    const need = scoreService.MIN_MONTHS_REQUIRED;

    return sendText(
      event.replyToken,
      `⭐ Building Your Renter Score…\n\n` +
      `🏠 ${lease.property?.nickname}\n` +
      `Progress: ${have}/${need} months recorded\n\n` +
      `${need - have} more month${need - have !== 1 ? 's' : ''} to go.\n\n` +
      `Pay on time and your score will appear automatically! 💪`,
    );
  }

  return sendFlex(event.replyToken, `Renter Score: ${score.score}/100`, buildScoreCard(score));
}

// ── Tenant shares their score ─────────────────────────────────────
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
      `Your score isn't ready yet — you need at least ${scoreService.MIN_MONTHS_REQUIRED} months of payment data.`,
    );
  }

  // Reuse an active token, or create a fresh one
  const existing = await db.shareToken.findFirst({
    where: { tenantId: user.id, leaseId: lease.id, expiresAt: { gt: new Date() } },
  });

  let token;
  if (existing) {
    token = existing.token;
  } else {
    const created = await db.shareToken.create({
      data: {
        tenantId:  user.id,
        leaseId:   lease.id,
        token:     uuidv4(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    token = created.token;
  }

  const appUrl   = process.env.APP_BASE_URL || 'https://your-app.up.railway.app';
  const shareUrl = `${appUrl}/score/view/${token}`;

  return sendFlex(
    event.replyToken,
    `My Renter Score: ${score.score}/100`,
    buildShareScoreCard(score, shareUrl),
  );
}

module.exports = { showScore, shareScore };
