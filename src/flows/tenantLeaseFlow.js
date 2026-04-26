// src/flows/tenantLeaseFlow.js
// Tenant-initiated lease request flow.
// Tenant fills in property details → gets lreq_TOKEN → shares with landlord.
// Landlord pastes token → accepts/rejects.

const {
  sendText,
  sendQuickReply,
  sendFlex,
  sendMultiple,
  textMsg,
  flexMsg,
  buildLeaseRequestReviewCard,
} = require('../utils/lineHelpers');
const { setState, advanceStep, clearState, getState } = require('../utils/stateManager');
const leaseRequestService = require('../services/leaseRequestService');
const notificationService = require('../services/notificationService');
const menuFlow = require('./menuFlow');

// ── Step 1: Tenant taps "Create Lease" in rich menu ─────────────────────────
async function start(event, user) {
  await setState(user.lineUserId, {
    flow: 'tenant_lease_creation',
    step: 'awaiting_nickname',
    context: {},
  });

  return sendText(
    event.replyToken,
    `📝 Create a Lease Request\n\nI'll help you set up a lease and generate an invite code for your landlord.\n\nFirst — what's a short nickname for this property?\nExample: "Room 203 Sukhumvit" or "Bangkok Condo"`
  );
}

// ── Multi-step text handler ──────────────────────────────────────────────────
async function handleStep(event, user, state, text) {
  const { currentStep, context } = state;

  switch (currentStep) {
    case 'awaiting_nickname':
      return handleNickname(event, user, context, text);
    case 'awaiting_address':
      return handleAddress(event, user, context, text);
    case 'awaiting_rent':
      return handleRent(event, user, context, text);
    case 'awaiting_start_date':
      return handleStartDate(event, user, context, text);
    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleNickname(event, user, context, text) {
  const nickname = text.trim();
  if (nickname.length < 2) {
    return sendText(event.replyToken, 'Please enter at least 2 characters for the property name.');
  }

  await advanceStep(user.lineUserId, 'awaiting_address', { propertyNickname: nickname });
  return sendText(
    event.replyToken,
    `📍 What is the full address?\nExample: 123 Sukhumvit Rd, Bangkok 10110`
  );
}

async function handleAddress(event, user, context, text) {
  const address = text.trim();
  if (address.length < 5) {
    return sendText(event.replyToken, 'Please enter a more complete address.');
  }

  await advanceStep(user.lineUserId, 'awaiting_rent', { propertyAddress: address });
  return sendText(
    event.replyToken,
    `💰 What is the agreed monthly rent? (THB, numbers only)\nExample: 8500`
  );
}

async function handleRent(event, user, context, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return sendText(event.replyToken, 'Please enter a valid number. Example: 8500');
  }

  await advanceStep(user.lineUserId, 'awaiting_due_day', { monthlyRent: amount });

  return sendQuickReply(event.replyToken, '📅 Which day of the month is rent due?', [
    { label: '1st',  data: 'action=tl_due_day&value=1' },
    { label: '5th',  data: 'action=tl_due_day&value=5' },
    { label: '10th', data: 'action=tl_due_day&value=10' },
    { label: '15th', data: 'action=tl_due_day&value=15' },
    { label: '28th', data: 'action=tl_due_day&value=28' },
  ]);
}

// Called from postback (tl_due_day action)
async function handleDueDay(event, user, value) {
  const dueDay = parseInt(value, 10);
  if (!dueDay || dueDay < 1 || dueDay > 28) {
    return sendText(event.replyToken, 'Invalid due day. Please try again.');
  }

  await advanceStep(user.lineUserId, 'awaiting_start_date', { dueDay });
  return sendText(
    event.replyToken,
    `📅 What is the lease start date?\n(Format: DD/MM/YYYY)\nExample: 01/07/2025`
  );
}

async function handleStartDate(event, user, context, text) {
  const date = parseDateDMY(text);
  if (!date) {
    return sendText(event.replyToken, 'Invalid date. Please use DD/MM/YYYY\nExample: 01/07/2025');
  }

  await advanceStep(user.lineUserId, 'awaiting_tl_confirm', { startDate: date.toISOString() });

  // Show summary and ask to confirm
  const { context: ctx } = await getState(user.lineUserId);
  return sendQuickReply(
    event.replyToken,
    `📋 Lease Request Summary\n\n` +
    `🏠 ${ctx.propertyNickname}\n` +
    `📍 ${ctx.propertyAddress}\n` +
    `💰 ฿${Number(ctx.monthlyRent).toLocaleString()}/month\n` +
    `📅 Due: ${ctx.dueDay}${ordinal(ctx.dueDay)} of each month\n` +
    `🗓 Start: ${formatDate(date)}\n\n` +
    `Create this lease request?`,
    [
      { label: '✅ Confirm', data: 'action=tl_confirm' },
      { label: '❌ Cancel',  data: 'action=tl_cancel'  },
    ]
  );
}

// ── Postback: tenant confirms ────────────────────────────────────────────────
async function confirm(event, user) {
  const { context } = await getState(user.lineUserId);
  if (!context?.propertyNickname) {
    return sendText(event.replyToken, 'Session expired. Please start again.');
  }

  const request = await leaseRequestService.createLeaseRequest({
    tenantId:        user.id,
    propertyNickname: context.propertyNickname,
    propertyAddress:  context.propertyAddress,
    monthlyRent:      context.monthlyRent,
    dueDay:           context.dueDay,
    gracePeriodDays:  0,
    startDate:        context.startDate,
  });

  await clearState(user.lineUserId);

  const code = `lreq_${request.inviteToken}`;

  return sendText(
    event.replyToken,
    `✅ Lease request created!\n\n` +
    `📨 Share this invite code with your landlord:\n\n` +
    `👉 ${code}\n\n` +
    `Ask them to add this LINE OA and send that code.\n` +
    `Once they accept, your lease will become active automatically.\n\n` +
    `⏰ The invite expires in 7 days.`
  );
}

// ── Postback: tenant cancels ─────────────────────────────────────────────────
async function cancel(event, user) {
  await clearState(user.lineUserId);
  return menuFlow.showMain(event, user);
}

// ── Landlord receives lreq_TOKEN ─────────────────────────────────────────────
async function handleLeaseRequestToken(event, user, token) {
  const request = await leaseRequestService.findByToken(token);

  if (!request) {
    return sendText(event.replyToken, '❌ Invalid lease request code. Please ask the tenant for a new one.');
  }

  if (new Date() > request.inviteExpiresAt) {
    return sendText(event.replyToken, '⏰ This lease request has expired. The tenant needs to create a new one.');
  }

  if (request.status !== 'pending') {
    return sendText(event.replyToken, `This request has already been ${request.status}.`);
  }

  // Show the review card with Accept / Reject buttons
  return sendFlex(
    event.replyToken,
    `Lease Request from ${request.tenant?.fullName || 'a tenant'}`,
    buildLeaseRequestReviewCard(request),
  );
}

// ── Landlord accepts ─────────────────────────────────────────────────────────
async function landlordAccept(event, user, requestId) {
  let lease;
  try {
    lease = await leaseRequestService.acceptRequest(requestId, user.id);
  } catch (err) {
    return sendText(event.replyToken, `❌ ${err.message}`);
  }

  // Notify tenant
  const request = await leaseRequestService.findById(requestId);
  if (request?.tenant?.lineUserId) {
    await notificationService.notifyLandlordTenantAccepted(
      request.tenant.lineUserId,
      user.fullName,
      request.propertyNickname,
    ).catch(() => {}); // non-fatal
  }

  await sendText(
    event.replyToken,
    `✅ Lease request accepted!\n\n` +
    `🏠 ${request.propertyNickname}\n` +
    `Tenant: ${request.tenant?.fullName || 'Unknown'}\n` +
    `💰 ฿${Number(request.monthlyRent).toLocaleString()}/month\n\n` +
    `The lease is now active. The tenant has been notified. 🎉`
  );

  return menuFlow.showMain(event, user);
}

// ── Landlord rejects ─────────────────────────────────────────────────────────
async function landlordReject(event, user, requestId) {
  await leaseRequestService.rejectRequest(requestId);

  // Notify tenant
  const request = await leaseRequestService.findById(requestId);
  if (request?.tenant?.lineUserId) {
    try {
      const { sendPush } = require('../utils/lineHelpers');
      // Push notification — landlord declined
      const client = require('../lineClient');
      await client.pushMessage(request.tenant.lineUserId, {
        type: 'text',
        text: `❌ Your lease request for "${request.propertyNickname}" was declined by the landlord.\n\nYou can create a new request if needed.`,
      });
    } catch (_) {}
  }

  await sendText(event.replyToken, '✅ Lease request declined. The tenant has been notified.');
  return menuFlow.showMain(event, user);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function parseDateDMY(str) {
  const [d, m, y] = str.trim().split(/[\/\-\.]/);
  if (!d || !m || !y) return null;
  const date = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
  return isNaN(date) ? null : date;
}

function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = {
  start,
  handleStep,
  handleDueDay,
  confirm,
  cancel,
  handleLeaseRequestToken,
  landlordAccept,
  landlordReject,
};
