// src/handlers/conversationRouter.js
// Central conversation state machine — routes users through flows

const db = require('../db');
const client = require('../lineClient');
const userService = require('../services/userService');
const { sendText, sendButtons, sendQuickReply } = require('../utils/lineHelpers');

// Flow handlers
const onboardingFlow = require('../flows/onboardingFlow');
const propertyFlow = require('../flows/propertyFlow');
const leaseFlow = require('../flows/leaseFlow');
const paymentFlow = require('../flows/paymentFlow');
const scoreFlow = require('../flows/scoreFlow');
const disputeFlow = require('../flows/disputeFlow');
const menuFlow = require('../flows/menuFlow');

// ── Entry point for all text messages ───────────────────────────
async function handleMessage(event, lineUserId, text) {
  // Load or create user + conversation state
  let user = await userService.findByLineId(lineUserId);
  let state = await getState(lineUserId);

  // New user — start onboarding
  if (!user) {
    return onboardingFlow.start(event, lineUserId);
  }

  // User is mid-flow — continue that flow
  if (state?.currentFlow) {
    return routeToFlow(event, user, state, text);
  }

  // No active flow — show main menu
  return menuFlow.showMain(event, user);
}

// ── Postback handler (button taps) ──────────────────────────────
async function handlePostback(event, lineUserId, data) {
  const user = await userService.findByLineId(lineUserId);
  if (!user) return onboardingFlow.start(event, lineUserId);

  // Parse postback data: "action=confirm_payment&payment_id=xxx&status=paid_on_time"
  const params = Object.fromEntries(new URLSearchParams(data));
  const { action } = params;

  switch (action) {
    // ── Onboarding ──
    case 'role_landlord':
      return onboardingFlow.setRole(event, lineUserId, 'landlord');
    case 'role_tenant':
      return onboardingFlow.setRole(event, lineUserId, 'tenant');

    // ── Main menu ──
    case 'menu_properties':
      return menuFlow.showProperties(event, user);
    case 'menu_tenants':
      return menuFlow.showTenants(event, user);
    case 'menu_payment_history':
      return menuFlow.showPaymentHistory(event, user, params.lease_id);
    case 'menu_add_property':
      return propertyFlow.start(event, user);
    case 'menu_my_lease':
      return menuFlow.showMyLease(event, user);
    case 'menu_my_payments':
      return menuFlow.showMyPayments(event, user);
    case 'menu_my_score':
      return scoreFlow.showScore(event, user);
    case 'menu_share_score':
      return scoreFlow.shareScore(event, user);
    case 'menu_dispute':
      return disputeFlow.start(event, user);

    // ── Property ──
    case 'property_type':
      return propertyFlow.handleStep(event, user, { ...params, text: params.value });
    case 'due_day':
      return propertyFlow.handleStep(event, user, { ...params, text: params.value });
    case 'grace_period':
      return propertyFlow.handleStep(event, user, { ...params, text: params.value });
    case 'property_confirm':
      return propertyFlow.confirm(event, user);
    case 'property_cancel':
      return propertyFlow.cancel(event, user);

    // ── Lease ──
    case 'add_tenant':
      return leaseFlow.startAddTenant(event, user, params.property_id);
    case 'lease_confirm':
      return leaseFlow.confirm(event, user, params.lease_id);
    case 'tenant_accept_lease':
      return leaseFlow.tenantAccept(event, user, params.lease_id);
    case 'tenant_reject_lease':
      return leaseFlow.tenantReject(event, user, params.lease_id);
    case 'end_lease':
      return leaseFlow.endLease(event, user, params.lease_id);

    // ── Payment confirmation ──
    case 'confirm_payment':
      return paymentFlow.handleConfirmation(event, user, params);
    case 'payment_days_late':
      return paymentFlow.recordDaysLate(event, user, params);

    // ── Dispute ──
    case 'dispute_reason':
      return disputeFlow.submitReason(event, user, params);
    case 'dispute_submit':
      return disputeFlow.submitDispute(event, user, params.payment_id, params.reason);

    default:
      return sendText(event.replyToken, "Sorry, I didn't understand that. Please use the menu below.");
  }
}

// ── Invite token (tenant joining via link) ──────────────────────
async function handleInviteToken(event, lineUserId, token) {
  return leaseFlow.handleInviteToken(event, lineUserId, token);
}

// ── Start onboarding ─────────────────────────────────────────────
async function startOnboarding(event, lineUserId) {
  return onboardingFlow.start(event, lineUserId);
}

// ── Show main menu ───────────────────────────────────────────────
async function showMainMenu(event, lineUserId) {
  const user = await userService.findByLineId(lineUserId);
  if (!user) return onboardingFlow.start(event, lineUserId);
  return menuFlow.showMain(event, user);
}

// ── Admin commands ───────────────────────────────────────────────
async function handleAdminCommand(event, lineUserId, text) {
  const user = await userService.findByLineId(lineUserId);
  if (!user || user.role !== 'admin') {
    return sendText(event.replyToken, "⛔ Admin access required.");
  }
  // Admin commands handled in menuFlow
  return menuFlow.handleAdminCommand(event, user, text);
}

// ── Internal helpers ─────────────────────────────────────────────
async function getState(lineUserId) {
  return db.conversationState.findUnique({ where: { lineUserId } });
}

async function routeToFlow(event, user, state, text) {
  switch (state.currentFlow) {
    case 'landlord_onboarding':
    case 'tenant_onboarding':
      return onboardingFlow.handleStep(event, user, state, text);
    case 'property_creation':
      return propertyFlow.handleStep(event, user, state, text);
    case 'lease_creation':
      return leaseFlow.handleStep(event, user, state, text);
    case 'dispute_creation':
      return disputeFlow.handleStep(event, user, state, text);
    default:
      // Unknown flow — clear state and show menu
      await db.conversationState.updateMany({
        where: { lineUserId: user.lineUserId },
        data: { currentFlow: null, currentStep: null, context: {} },
      });
      return menuFlow.showMain(event, user);
  }
}

module.exports = {
  handleMessage,
  handlePostback,
  handleInviteToken,
  startOnboarding,
  showMainMenu,
  handleAdminCommand,
};
