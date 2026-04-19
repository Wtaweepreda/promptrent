// src/flows/paymentFlow.js

const { sendText, sendQuickReply } = require('../utils/lineHelpers');
const paymentService = require('../services/paymentService');
const notificationService = require('../services/notificationService');

// ── Landlord taps a payment status button ────────────────────────
async function handleConfirmation(event, user, params) {
  const { payment_id, status } = params;

  if (!payment_id) {
    return sendText(event.replyToken, 'Payment record not found. Please try again from the menu.');
  }

  // "Not paid" — just acknowledge, schedule follow-up
  if (status === 'not_paid') {
    return sendText(
      event.replyToken,
      `Noted. I'll follow up again in 3 days.\n\nWhen the tenant pays, tap "Menu" → "Payment History" to update.`
    );
  }

  // "Paid late" — ask how many days late
  if (status === 'paid_late') {
    return sendQuickReply(
      event.replyToken,
      'How many days late was the payment?',
      [
        { label: '1–3 days', data: `action=payment_days_late&payment_id=${payment_id}&days=2` },
        { label: '4–7 days', data: `action=payment_days_late&payment_id=${payment_id}&days=5` },
        { label: '8–14 days', data: `action=payment_days_late&payment_id=${payment_id}&days=10` },
        { label: '15–30 days', data: `action=payment_days_late&payment_id=${payment_id}&days=20` },
        { label: '30+ days', data: `action=payment_days_late&payment_id=${payment_id}&days=35` },
      ]
    );
  }

  // "Paid on time" — record immediately
  if (status === 'paid_on_time') {
    return recordPayment(event, user, payment_id, {
      status: 'paid_on_time',
      daysLate: 0,
    });
  }

  // "Partial" — ask how much was paid
  if (status === 'partial') {
    const record = await paymentService.findById(payment_id);
    return sendText(
      event.replyToken,
      `How much did the tenant pay? (out of ฿${Number(record?.expectedAmount || 0).toLocaleString()})\n\nEnter the amount in numbers only.`
    );
    // Note: partial amount collection would be handled as next text step
    // For simplicity, recording as partial with full expected amount
  }

  return sendText(event.replyToken, 'Unknown payment status. Please try again.');
}

// ── Days late selected ───────────────────────────────────────────
async function recordDaysLate(event, user, params) {
  const { payment_id, days } = params;
  return recordPayment(event, user, payment_id, {
    status: 'paid_late',
    daysLate: parseInt(days),
  });
}

// ── Core: write payment record + notify tenant ───────────────────
async function recordPayment(event, user, paymentRecordId, { status, daysLate, paidAmount }) {
  try {
    const record = await paymentService.confirmPayment(paymentRecordId, user.id, {
      status,
      paidAmount,
      daysLate,
      paymentMethod: 'cash', // Default for V1 — no payment rails yet
    });

    // Notify tenant
    await notificationService.notifyTenantPaymentConfirmed(record.lease, record);

    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const month = `${monthNames[record.periodMonth - 1]} ${record.periodYear}`;
    const tenant = record.lease.tenant;

    const statusText = {
      paid_on_time: '✅ Paid on time',
      paid_late: `⚠️ Paid late (${daysLate} days)`,
      missed: '❌ Missed',
      partial: '🟡 Partial payment',
    }[status] || status;

    return sendText(
      event.replyToken,
      `✅ Payment recorded!\n\n` +
      `👤 ${tenant?.fullName || 'Tenant'}\n` +
      `📅 ${month}: ${statusText}\n\n` +
      `Renter Score has been updated automatically. ⭐`
    );
  } catch (err) {
    console.error('Payment confirmation error:', err);
    return sendText(event.replyToken, '❌ Error recording payment. Please try again.');
  }
}

module.exports = { handleConfirmation, recordDaysLate };
