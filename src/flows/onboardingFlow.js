// src/flows/onboardingFlow.js
// First-time user registration — premium welcome, role selection, profile setup.

const {
  sendText,
  sendFlex,
  sendMultiple,
  textMsg,
  flexMsg,
  buildWelcomeCard,
} = require('../utils/lineHelpers');
const { setState, advanceStep, clearState } = require('../utils/stateManager');
const userService    = require('../services/userService');
const richMenuService = require('../services/richMenuService');
const menuFlow       = require('./menuFlow');

// ── Entry point: brand new user or existing user without a flow ──
async function start(event, lineUserId) {
  let user = await userService.findByLineId(lineUserId);
  if (!user) {
    user = await userService.createUser({ lineUserId, role: 'tenant' });
  }
  await setState(lineUserId, { flow: 'onboarding', step: 'awaiting_role' });

  // Premium welcome card with two role buttons
  return sendFlex(event.replyToken, 'Welcome to PromptRent', buildWelcomeCard());
}

// ── Role selected (postback) ─────────────────────────────────────
async function setRole(event, lineUserId, role) {
  let user = await userService.findByLineId(lineUserId);
  if (!user) {
    user = await userService.createUser({ lineUserId, role });
  } else {
    user = await userService.updateUser(user.id, { role });
  }

  await setState(lineUserId, {
    flow: `${role}_onboarding`,
    step: 'awaiting_name',
    context: { role },
  });

  // Assign role-based rich menu immediately so it appears right away
  await richMenuService.assignRichMenu(lineUserId, role);

  return sendText(
    event.replyToken,
    role === 'landlord'
      ? `Perfect! Let's get you set up as a landlord.\n\nWhat's your full name?`
      : `Great! Let's get your profile ready.\n\nWhat's your full name?`,
  );
}

// ── Step router ──────────────────────────────────────────────────
async function handleStep(event, user, state, text) {
  switch (state.currentStep) {
    case 'awaiting_name':  return handleName(event, user, state.context, text);
    case 'awaiting_phone': return handlePhone(event, user, state.context, text);
    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleName(event, user, context, text) {
  if (text.trim().length < 2) {
    return sendText(event.replyToken, 'Please enter your full name (at least 2 characters).');
  }

  await advanceStep(user.lineUserId, 'awaiting_phone', { fullName: text.trim() });
  await userService.updateUser(user.id, { fullName: text.trim() });

  return sendText(
    event.replyToken,
    `Nice to meet you, ${text.trim().split(' ')[0]}! 😊\n\nWhat's your phone number?\n(Example: 0812345678)`,
  );
}

async function handlePhone(event, user, context, text) {
  const phone = text.replace(/[-\s]/g, '');
  if (!/^\d{9,10}$/.test(phone)) {
    return sendText(
      event.replyToken,
      'Please enter a valid Thai phone number (9–10 digits).\nExample: 0812345678',
    );
  }

  await userService.updateUser(user.id, { phone });
  await clearState(user.lineUserId);

  const updatedUser = await userService.findByLineId(user.lineUserId);

  // Assign role-based rich menu now that we know the role
  await richMenuService.assignRichMenu(user.lineUserId, updatedUser.role);

  const firstName = (updatedUser.fullName || '').split(' ')[0];
  const confirmMsg = updatedUser.role === 'landlord'
    ? `✅ You're all set, ${firstName}!\n\nNext step: add your first property so you can invite a tenant.`
    : `✅ You're in, ${firstName}!\n\nYour landlord will send you a lease invite. Keep an eye out! 🎉`;

  // Reply with confirmation text + dashboard card in one call
  const dashboard = await menuFlow.buildDashboardCard(updatedUser);
  return sendMultiple(event.replyToken, [
    textMsg(confirmMsg),
    ...(dashboard ? [flexMsg('Your Dashboard', dashboard)] : []),
  ]);
}

module.exports = { start, setRole, handleStep };
