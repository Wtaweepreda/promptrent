// src/flows/profileFlow.js
// View and edit user profile (both landlord and tenant).

const {
  sendText,
  sendFlex,
  buildProfileCard,
} = require('../utils/lineHelpers');
const { setState, advanceStep, clearState } = require('../utils/stateManager');
const userService = require('../services/userService');
const menuFlow    = require('./menuFlow');

// ── Show profile card ────────────────────────────────────────────────────────
async function showProfile(event, user) {
  const card = buildProfileCard(user);
  return sendFlex(event.replyToken, 'My Profile', card);
}

// ── Start editing name ───────────────────────────────────────────────────────
async function startEditName(event, user) {
  await setState(user.lineUserId, {
    flow: 'profile_edit',
    step: 'awaiting_new_name',
    context: {},
  });
  return sendText(event.replyToken, `✏️ What's your new full name?`);
}

// ── Start editing phone ──────────────────────────────────────────────────────
async function startEditPhone(event, user) {
  await setState(user.lineUserId, {
    flow: 'profile_edit',
    step: 'awaiting_new_phone',
    context: {},
  });
  return sendText(event.replyToken, `📱 What's your new phone number?\nExample: 0812345678`);
}

// ── Multi-step text handler ──────────────────────────────────────────────────
async function handleStep(event, user, state, text) {
  const { currentStep } = state;

  switch (currentStep) {
    case 'awaiting_new_name':
      return handleNewName(event, user, text);
    case 'awaiting_new_phone':
      return handleNewPhone(event, user, text);
    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleNewName(event, user, text) {
  const name = text.trim();
  if (name.length < 2) {
    return sendText(event.replyToken, 'Name must be at least 2 characters. Please try again.');
  }

  await userService.updateUser(user.id, { fullName: name });
  await clearState(user.lineUserId);

  // Reload updated user
  const updated = await userService.findByLineId(user.lineUserId);
  const card    = buildProfileCard(updated);

  await sendText(event.replyToken, `✅ Name updated to "${name}"`);
  return sendFlex(event.replyToken, 'My Profile', card);
}

async function handleNewPhone(event, user, text) {
  const phone = text.trim().replace(/\s+/g, '');

  // Basic Thai phone validation (allows +66 or 0X formats)
  if (!/^(\+66|0)\d{8,9}$/.test(phone)) {
    return sendText(event.replyToken, 'Please enter a valid Thai phone number.\nExample: 0812345678 or +66812345678');
  }

  await userService.updateUser(user.id, { phone });
  await clearState(user.lineUserId);

  const updated = await userService.findByLineId(user.lineUserId);
  const card    = buildProfileCard(updated);

  await sendText(event.replyToken, `✅ Phone updated to ${phone}`);
  return sendFlex(event.replyToken, 'My Profile', card);
}

module.exports = { showProfile, startEditName, startEditPhone, handleStep };
