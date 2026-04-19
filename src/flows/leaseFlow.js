// src/flows/leaseFlow.js

const { sendText, sendQuickReply, sendButtons, sendConfirm } = require('../utils/lineHelpers');
const { setState, advanceStep, clearState, getState } = require('../utils/stateManager');
const leaseService = require('../services/leaseService');
const notificationService = require('../services/notificationService');
const userService = require('../services/userService');
const menuFlow = require('./menuFlow');

// ── Start adding tenant to an existing property ──────────────────
async function startAddTenant(event, user, propertyId) {
  const property = await require('../db').property.findUnique({
    where: { id: propertyId },
  });

  if (!property) return sendText(event.replyToken, 'Property not found.');

  await setState(user.lineUserId, {
    flow: 'lease_creation',
    step: 'awaiting_start_date',
    context: {
      propertyId: property.id,
      propertyNickname: property.nickname,
    },
  });

  return sendText(
    event.replyToken,
    `Adding a tenant to "${property.nickname}" 🏠\n\nWhat is the lease start date?\n(Format: DD/MM/YYYY)`
  );
}

// ── Multi-step text handler ──────────────────────────────────────
async function handleStep(event, user, state, text) {
  const { currentStep, context } = state;

  switch (currentStep) {
    case 'awaiting_start_date':
      return handleStartDate(event, user, context, text);
    case 'awaiting_monthly_rent':
      return handleMonthlyRent(event, user, context, text);
    case 'awaiting_due_day_text':
      return handleDueDayText(event, user, context, text);
    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleStartDate(event, user, context, text) {
  const date = parseDateDMY(text);
  if (!date) {
    return sendText(event.replyToken, 'Invalid date format. Please use DD/MM/YYYY\nExample: 01/06/2025');
  }

  // If rent details not yet in context (from property creation flow), ask for them
  if (!context.monthlyRent) {
    await advanceStep(user.lineUserId, 'awaiting_monthly_rent', { startDate: date.toISOString() });
    return sendText(event.replyToken, `Monthly rent amount? (THB, numbers only)\nExample: 8000`);
  }

  await advanceStep(user.lineUserId, 'awaiting_invite_method', { startDate: date.toISOString() });
  return showInviteOptions(event, user, context);
}

async function handleMonthlyRent(event, user, context, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return sendText(event.replyToken, 'Please enter a valid number. Example: 8000');
  }

  await advanceStep(user.lineUserId, 'awaiting_due_day_text', { monthlyRent: amount });

  return sendQuickReply(event.replyToken, 'Which day of the month is rent due?', [
    { label: '1st', data: 'action=due_day&value=1&step=due_day' },
    { label: '5th', data: 'action=due_day&value=5&step=due_day' },
    { label: '10th', data: 'action=due_day&value=10&step=due_day' },
    { label: '15th', data: 'action=due_day&value=15&step=due_day' },
    { label: '28th', data: 'action=due_day&value=28&step=due_day' },
  ]);
}

async function showInviteOptions(event, user, context) {
  const { context: freshCtx } = await getState(user.lineUserId);

  // Create the lease now (pending tenant)
  const lease = await leaseService.createLease({
    propertyId: freshCtx.propertyId,
    landlordId: user.id,
    monthlyRent: freshCtx.monthlyRent,
    dueDay: freshCtx.dueDay || 1,
    gracePeriodDays: freshCtx.gracePeriodDays || 0,
    startDate: freshCtx.startDate,
  });

  await clearState(user.lineUserId);

  const inviteText = `join_${lease.inviteToken}`;
  const appUrl = process.env.APP_BASE_URL || 'https://your-app.up.railway.app';

  return sendText(
    event.replyToken,
    `✅ Lease created for "${freshCtx.propertyNickname}"!\n\n` +
    `💰 Rent: ฿${Number(freshCtx.monthlyRent).toLocaleString()}/month\n\n` +
    `📨 To invite your tenant:\n` +
    `Ask them to add this LINE OA and send this message:\n\n` +
    `👉 ${inviteText}\n\n` +
    `Or share the score page link:\n${appUrl}/score/view/${lease.inviteToken}\n\n` +
    `The invite expires in 7 days.`
  );
}

// ── Tenant accepts lease via invite token ────────────────────────
async function handleInviteToken(event, lineUserId, token) {
  const lease = await leaseService.findByInviteToken(token);

  if (!lease) {
    return sendText(event.replyToken, '❌ Invalid invite link. Please ask your landlord for a new one.');
  }

  if (new Date() > lease.inviteExpiresAt) {
    return sendText(event.replyToken, '⏰ This invite link has expired. Please ask your landlord for a new one.');
  }

  if (lease.status !== 'pending') {
    return sendText(event.replyToken, 'This lease is already active or has ended.');
  }

  // Check if this user is already registered
  let tenant = await userService.findByLineId(lineUserId);

  if (!tenant) {
    // Store token so we can activate after onboarding
    await setState(lineUserId, {
      flow: 'tenant_onboarding',
      step: 'awaiting_role_from_invite',
      context: { inviteToken: token, leaseId: lease.id },
    });

    // Show invite info before onboarding
    return sendText(
      event.replyToken,
      `🏠 Lease Invitation\n\n` +
      `Your landlord ${lease.landlord.fullName} has invited you to PromptRent for:\n\n` +
      `Property: ${lease.property.nickname}\n` +
      `Rent: ฿${Number(lease.monthlyRent).toLocaleString()}/month\n` +
      `Due: ${lease.dueDay}th of each month\n\n` +
      `PromptRent tracks your payment history and builds your Renter Score. 🌟\n\n` +
      `What's your full name?`
    );
  }

  // Already registered — show lease details and confirm
  return sendQuickReply(
    event.replyToken,
    `🏠 Lease Invitation from ${lease.landlord.fullName}\n\n` +
    `Property: ${lease.property.nickname}\n` +
    `Rent: ฿${Number(lease.monthlyRent).toLocaleString()}/month\n` +
    `Due: ${lease.dueDay}th of each month\n` +
    `Start: ${new Date(lease.startDate).toLocaleDateString('en-GB')}\n\n` +
    `Do you accept this lease?`,
    [
      { label: '✅ Accept Lease', data: `action=tenant_accept_lease&lease_id=${lease.id}` },
      { label: '❌ Decline', data: `action=tenant_reject_lease&lease_id=${lease.id}` },
    ]
  );
}

// ── Tenant confirms lease ────────────────────────────────────────
async function tenantAccept(event, user, leaseId) {
  const lease = await leaseService.activateLease(leaseId, user.id);

  // Notify landlord
  const fullLease = await require('../db').lease.findUnique({
    where: { id: leaseId },
    include: { landlord: true, property: true },
  });

  await notificationService.notifyLandlordTenantAccepted(
    fullLease.landlord.lineUserId,
    user.fullName,
    fullLease.property.nickname
  );

  await sendText(
    event.replyToken,
    `✅ You've accepted the lease!\n\n` +
    `🏠 ${fullLease.property.nickname}\n` +
    `💰 ฿${Number(fullLease.monthlyRent).toLocaleString()}/month\n\n` +
    `You'll receive automatic payment reminders each month. 🔔\n` +
    `Your Renter Score will start building after 3 months of data. ⭐`
  );

  return menuFlow.showMain(event, user);
}

async function tenantReject(event, user, leaseId) {
  await sendText(event.replyToken, 'You have declined the lease invitation. The landlord will be notified.');
  return menuFlow.showMain(event, user);
}

// ── End lease ────────────────────────────────────────────────────
async function endLease(event, user, leaseId) {
  await leaseService.endLease(leaseId, user.id);
  await clearState(user.lineUserId);
  await sendText(event.replyToken, '✅ Lease has been ended. All historical data is preserved.');
  return menuFlow.showMain(event, user);
}

// Confirm lease from postback
async function confirm(event, user, leaseId) {
  return tenantAccept(event, user, leaseId);
}

// ── Helpers ──────────────────────────────────────────────────────
function parseDateDMY(str) {
  const [d, m, y] = str.trim().split(/[\/\-\.]/);
  if (!d || !m || !y) return null;
  const date = new Date(`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`);
  return isNaN(date) ? null : date;
}

module.exports = { startAddTenant, handleStep, handleInviteToken, tenantAccept, tenantReject, endLease, confirm };
