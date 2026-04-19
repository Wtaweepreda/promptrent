// src/flows/disputeFlow.js

const { sendText, sendQuickReply } = require('../utils/lineHelpers');
const { setState, clearState } = require('../utils/stateManager');
const leaseService = require('../services/leaseService');
const db = require('../db');
const eventService = require('../services/eventService');
const menuFlow = require('./menuFlow');

async function start(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);
  if (!leases.length) {
    return sendText(event.replyToken, 'No active lease found to dispute.');
  }

  const lease = leases[0];
  const records = await db.paymentRecord.findMany({
    where: { leaseId: lease.id, paymentStatus: { not: 'pending' } },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    take: 6,
  });

  if (!records.length) {
    return sendText(event.replyToken, 'No confirmed payment records found to dispute.');
  }

  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return sendQuickReply(
    event.replyToken,
    `Which payment record do you want to dispute?`,
    records.map(r => ({
      label: `${months[r.periodMonth - 1]} ${r.periodYear} — ${r.paymentStatus.replace(/_/g, ' ')}`,
      data: `action=dispute_reason&payment_id=${r.id}`,
    }))
  );
}

async function submitReason(event, user, params) {
  const { payment_id } = params;

  return sendQuickReply(
    event.replyToken,
    `Why are you disputing this record?`,
    [
      { label: 'I paid but it\'s not recorded', data: `action=dispute_submit&payment_id=${payment_id}&reason=paid_not_recorded` },
      { label: 'Timing is wrong', data: `action=dispute_submit&payment_id=${payment_id}&reason=wrong_timing` },
      { label: 'Amount is wrong', data: `action=dispute_submit&payment_id=${payment_id}&reason=wrong_amount` },
      { label: 'Other reason', data: `action=dispute_submit&payment_id=${payment_id}&reason=other` },
    ]
  );
}

async function handleStep(event, user, state, text) {
  // For future: free text dispute details
  await clearState(user.lineUserId);
  return menuFlow.showMain(event, user);
}

async function submitDispute(event, user, paymentId, reasonCode) {
  // Flag the payment record
  await db.paymentRecord.update({
    where: { id: paymentId },
    data: { isDisputed: true },
  });

  // Create dispute record
  const dispute = await db.dispute.create({
    data: {
      paymentRecordId: paymentId,
      raisedBy: user.id,
      reasonCode,
      status: 'open',
    },
  });

  await eventService.log(user.id, 'dispute.created', 'dispute', dispute.id, { reasonCode });

  return sendText(
    event.replyToken,
    `✅ Dispute submitted.\n\n` +
    `Our team will review this within 3 business days.\n\n` +
    `While under review, this record is excluded from your Renter Score calculation. 🔒`
  );
}

module.exports = { start, submitReason, handleStep, submitDispute };
