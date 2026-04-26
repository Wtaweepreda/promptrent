// src/flows/tenantPaymentFlow.js
// Tenant self-reports that they have paid rent.
// Shows current month status → tenant taps "I've Paid" → pushes confirmation request to landlord.

const {
  sendText,
  sendQuickReply,
  sendFlex,
  buildPaymentHistoryFlex,
} = require('../utils/lineHelpers');
const leaseService   = require('../services/leaseService');
const paymentService = require('../services/paymentService');
const db             = require('../db');
const client         = require('../lineClient');

// ── Tenant taps "Pay Rent" in rich menu ──────────────────────────────────────
async function start(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `No active lease found.\n\nIf you have an invite code from your landlord, send it now (starts with "join_").\nOr create a lease request — tap Create Lease in the menu.`
    );
  }

  const lease = leases[0];
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Calculate this month's due date
  const dueDate = new Date(year, month - 1, lease.dueDay);

  // Find or create the current period's payment record
  let record = await db.paymentRecord.findUnique({
    where: { leaseId_periodYear_periodMonth: { leaseId: lease.id, periodYear: year, periodMonth: month } },
  });

  if (!record) {
    record = await paymentService.createPaymentRecord(
      lease.id,
      year,
      month,
      dueDate,
      lease.monthlyRent,
    );
  }

  const statusLabel = {
    pending:      '⏳ Pending confirmation',
    paid_on_time: '✅ Paid on time',
    paid_late:    '⚠️ Paid late',
    partial:      '🔶 Partial payment',
    missed:       '❌ Missed',
  }[record.paymentStatus] || record.paymentStatus;

  const monthName = dueDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  if (record.paymentStatus !== 'pending') {
    return sendText(
      event.replyToken,
      `🏠 ${lease.property?.nickname || 'Your Property'}\n\n` +
      `📅 ${monthName}\n` +
      `Status: ${statusLabel}\n\n` +
      `Your landlord has already recorded this month's payment.`
    );
  }

  return sendQuickReply(
    event.replyToken,
    `🏠 ${lease.property?.nickname || 'Your Property'}\n\n` +
    `📅 Rent for ${monthName}\n` +
    `💰 ฿${Number(lease.monthlyRent).toLocaleString()}\n` +
    `📆 Due: ${dueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}\n` +
    `Status: ${statusLabel}\n\n` +
    `Have you paid this month's rent?`,
    [
      { label: '✅ I\'ve Paid!', data: `action=tenant_paid&lease_id=${lease.id}&record_id=${record.id}` },
      { label: '📋 View History', data: 'action=menu_my_payments' },
    ]
  );
}

// ── Tenant confirms they paid → notify landlord ──────────────────────────────
async function tenantConfirmedPayment(event, user, leaseId, recordId) {
  const record = await paymentService.findById(recordId);

  if (!record) {
    return sendText(event.replyToken, '❌ Payment record not found. Please try again.');
  }

  if (record.paymentStatus !== 'pending') {
    return sendText(event.replyToken, 'This payment has already been recorded.');
  }

  // Push a confirmation request to the landlord
  const landlordLineId = record.lease.landlord?.lineUserId;
  if (landlordLineId) {
    const now   = new Date();
    const month = now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

    try {
      await client.pushMessage(landlordLineId, {
        type: 'template',
        altText: `${user.fullName} says they paid rent`,
        template: {
          type: 'confirm',
          text: `💰 ${user.fullName} says they've paid rent for ${month}.\n\n🏠 ${record.lease.property?.nickname || 'Property'}\n฿${Number(record.lease.monthlyRent).toLocaleString()}`,
          actions: [
            {
              type: 'postback',
              label: '✅ Confirm Paid',
              data:  `action=confirm_payment&payment_id=${record.id}&status=paid_on_time`,
              displayText: 'Confirm Paid',
            },
            {
              type: 'postback',
              label: '⏰ Mark Late',
              data:  `action=confirm_payment&payment_id=${record.id}&status=paid_late`,
              displayText: 'Mark Late',
            },
          ],
        },
      });
    } catch (err) {
      console.error('[tenantPaymentFlow] Failed to notify landlord:', err.message);
    }
  }

  return sendText(
    event.replyToken,
    `✅ Got it! Your landlord has been notified.\n\n` +
    `They'll confirm the payment status shortly.\n` +
    `You'll see it updated in your payment history. 📋`
  );
}

module.exports = { start, tenantConfirmedPayment };
