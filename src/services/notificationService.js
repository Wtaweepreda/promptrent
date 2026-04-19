// src/services/notificationService.js
// All outbound push messages to LINE users

const { pushText, pushQuickReply, pushFlex, buildScoreCard } = require('../utils/lineHelpers');
const db = require('../db');

// ── Tenant: rent due in 3 days ───────────────────────────────────
async function sendTenantDueSoonReminder(lease) {
  const { tenant, property } = lease;
  const amount = Number(lease.monthlyRent).toLocaleString();
  const dueDate = formatDueDate(lease.dueDay);

  const text = `🔔 Rent Reminder\n\n` +
    `Property: ${property.nickname}\n` +
    `Amount: ฿${amount}\n` +
    `Due date: ${dueDate}\n` +
    `(in 3 days)\n\n` +
    `Please pay your landlord directly. ` +
    `They will confirm your payment in PromptRent. ✅`;

  await pushText(tenant.lineUserId, text);
  await logReminder(lease.id, null, tenant.lineUserId, 'due_soon');
}

// ── Landlord: please confirm if tenant paid ──────────────────────
async function sendLandlordConfirmationRequest(lease, paymentRecord) {
  const { landlord, property, tenant } = lease;
  const amount = Number(lease.monthlyRent).toLocaleString();
  const monthLabel = getMonthLabel(paymentRecord.periodMonth, paymentRecord.periodYear);

  await pushQuickReply(
    landlord.lineUserId,
    `📋 Payment Confirmation Needed\n\n` +
    `🏠 ${property.nickname}\n` +
    `👤 Tenant: ${tenant?.fullName || 'Unknown'}\n` +
    `💰 ฿${amount} | ${monthLabel}\n\n` +
    `Has the tenant paid rent this month?`,
    [
      { label: '✅ Paid — On Time', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=paid_on_time` },
      { label: '⚠️ Paid — But Late', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=paid_late` },
      { label: '❌ Not Yet Paid', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=not_paid` },
      { label: '💰 Partial Payment', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=partial` },
    ]
  );

  await logReminder(lease.id, paymentRecord.id, landlord.lineUserId, 'landlord_check');
}

// ── Landlord: follow up 7 days later ────────────────────────────
async function sendLandlordFollowUp(lease, paymentRecord) {
  const { landlord, property, tenant } = lease;
  const monthLabel = getMonthLabel(paymentRecord.periodMonth, paymentRecord.periodYear);

  await pushQuickReply(
    landlord.lineUserId,
    `⚠️ Follow-up: ${monthLabel} payment not yet confirmed.\n\n` +
    `🏠 ${property.nickname} — ${tenant?.fullName || 'Tenant'}\n\n` +
    `Has the tenant paid?`,
    [
      { label: '✅ Yes, Paid Now', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=paid_late` },
      { label: '❌ Still Unpaid', data: `action=confirm_payment&payment_id=${paymentRecord.id}&status=not_paid` },
    ]
  );

  await logReminder(lease.id, paymentRecord.id, landlord.lineUserId, 'landlord_followup');
}

// ── Tenant: payment confirmed notification ───────────────────────
async function notifyTenantPaymentConfirmed(lease, paymentRecord) {
  const { tenant, property } = lease;
  const monthLabel = getMonthLabel(paymentRecord.periodMonth, paymentRecord.periodYear);

  const statusMessages = {
    paid_on_time: `✅ Payment confirmed!\n\n${monthLabel}: Paid on time\nYour Renter Score has been updated. 🌟`,
    paid_late: `📝 Payment recorded.\n\n${monthLabel}: Paid late (${paymentRecord.daysLate} days)\nTip: Paying on time improves your score!`,
    missed: `❌ Payment marked as missed for ${monthLabel}.\n\nIf you believe this is incorrect, tap "Menu" → "Dispute Record".`,
    partial: `🟡 Partial payment recorded for ${monthLabel}.\n\nAmount received: ฿${Number(paymentRecord.paidAmount).toLocaleString()} of ฿${Number(paymentRecord.expectedAmount).toLocaleString()}`,
  };

  const msg = statusMessages[paymentRecord.paymentStatus];
  if (msg && tenant?.lineUserId) {
    await pushText(tenant.lineUserId, msg);
  }
}

// ── Landlord: tenant accepted lease ─────────────────────────────
async function notifyLandlordTenantAccepted(landlordLineUserId, tenantName, propertyNickname) {
  await pushText(
    landlordLineUserId,
    `🎉 ${tenantName} has accepted the lease for ${propertyNickname}!\n\nThe lease is now active. Monthly reminders will start automatically. ✅`
  );
}

// ── Tenant: score update notification ───────────────────────────
async function notifyTenantScoreUpdate(tenantLineUserId, scoreData) {
  await pushFlex(tenantLineUserId, 'Your Renter Score Updated', buildScoreCard(scoreData));
}

// ── Internal helpers ─────────────────────────────────────────────
async function logReminder(leaseId, paymentRecordId, recipientLineUserId, reminderType) {
  try {
    const user = await db.user.findUnique({ where: { lineUserId: recipientLineUserId } });
    if (!user) return;

    await db.reminder.create({
      data: {
        leaseId,
        paymentRecordId,
        recipientId: user.id,
        recipientType: ['due_soon'].includes(reminderType) ? 'tenant' : 'landlord',
        reminderType,
        scheduledFor: new Date(),
        sentAt: new Date(),
        status: 'sent',
      },
    });
  } catch (err) {
    console.error('Failed to log reminder:', err.message);
  }
}

function formatDueDate(dueDay) {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), dueDay);
  return thisMonth.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getMonthLabel(month, year) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[month - 1]} ${year}`;
}

module.exports = {
  sendTenantDueSoonReminder,
  sendLandlordConfirmationRequest,
  sendLandlordFollowUp,
  notifyTenantPaymentConfirmed,
  notifyLandlordTenantAccepted,
  notifyTenantScoreUpdate,
};
