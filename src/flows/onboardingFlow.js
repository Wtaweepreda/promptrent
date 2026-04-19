// src/flows/onboardingFlow.js
// Handles first-time landlord and tenant registration

const { sendText, sendQuickReply, sendButtons } = require('../utils/lineHelpers');
const { setState, advanceStep, clearState } = require('../utils/stateManager');
const userService = require('../services/userService');
const menuFlow = require('./menuFlow');

// ── Entry point — brand new user ─────────────────────────────────
async function start(event, lineUserId) {
  // User must exist before conversation state (FK constraint)
  let user = await userService.findByLineId(lineUserId);
  if (!user) {
    user = await userService.createUser({ lineUserId, role: 'tenant' });
  }
  await setState(lineUserId, { flow: 'onboarding', step: 'awaiting_role' });

  return sendButtons(event.replyToken, {
    title: 'Welcome to PromptRent 🏠',
    text: 'Build rental trust — track payments, earn reputation.\n\nAre you a landlord or tenant?',
    buttons: [
      { label: '🏠 I\'m a Landlord', data: 'action=role_landlord' },
      { label: '🙋 I\'m a Tenant', data: 'action=role_tenant' },
    ],
  });
}

// ── Role selected via postback ───────────────────────────────────
async function setRole(event, lineUserId, role) {
  // Create or update user with selected role
  let user = await userService.findByLineId(lineUserId);
  if (!user) {
    user = await userService.createUser({ lineUserId, role });
  } else {
    user = await userService.updateUser(user.id, { role });
  }

  await setState(lineUserId, { flow: `${role}_onboarding`, step: 'awaiting_name', context: { role } });

  return sendText(
    event.replyToken,
    `Great! Let's get you set up as a ${role}.\n\nFirst, what's your full name?`
  );
}

// ── Handle each step of the onboarding flow ──────────────────────
async function handleStep(event, user, state, text) {
  const { currentStep, context } = state;

  switch (currentStep) {
    case 'awaiting_name':
      return handleName(event, user, context, text);

    case 'awaiting_phone':
      return handlePhone(event, user, context, text);

    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleName(event, user, context, text) {
  if (text.length < 2) {
    return sendText(event.replyToken, 'Please enter your full name (at least 2 characters).');
  }

  await advanceStep(user.lineUserId, 'awaiting_phone', { fullName: text });
  await userService.updateUser(user.id, { fullName: text });

  return sendText(event.replyToken, `Nice to meet you, ${text}! 😊\n\nWhat's your phone number?`);
}

async function handlePhone(event, user, context, text) {
  const phone = text.replace(/[-\s]/g, '');
  if (!/^\d{9,10}$/.test(phone)) {
    return sendText(
      event.replyToken,
      'Please enter a valid Thai phone number (9-10 digits).\nExample: 0812345678'
    );
  }

  await userService.updateUser(user.id, { phone });
  await clearState(user.lineUserId);

  // Reload user with updated data
  const updatedUser = await userService.findByLineId(user.lineUserId);

  await sendText(
    event.replyToken,
    `✅ You're registered!\n\n` +
    `Name: ${updatedUser.fullName}\n` +
    `Role: ${updatedUser.role}\n` +
    `Phone: ${phone}\n\n` +
    (updatedUser.role === 'landlord'
      ? `Now let's add your first property. Tap "Add Property" from the menu below. 🏠`
      : `You're all set! Your landlord will send you a lease invitation. 🎉`)
  );

  return menuFlow.showMain(event, updatedUser);
}

module.exports = { start, setRole, handleStep };
