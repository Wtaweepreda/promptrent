// src/flows/propertyFlow.js

const { sendText, sendQuickReply, sendButtons, sendConfirm } = require('../utils/lineHelpers');
const { setState, advanceStep, clearState } = require('../utils/stateManager');
const db = require('../db');
const eventService = require('../services/eventService');
const leaseFlow = require('./leaseFlow');
const menuFlow = require('./menuFlow');

async function start(event, user) {
  if (user.role !== 'landlord' && user.role !== 'both' && user.role !== 'admin') {
    return sendText(event.replyToken, '⛔ Only landlords can add properties.');
  }

  await setState(user.lineUserId, { flow: 'property_creation', step: 'awaiting_nickname' });

  return sendText(
    event.replyToken,
    `Let's add your property! 🏠\n\nGive it a nickname so you can recognise it easily.\n(e.g. "Room 3B Sukhumvit" or "House Rangsit")`
  );
}

async function handleStep(event, user, stateOrParams, text) {
  // stateOrParams can be DB state object (from text flow) or params object (from postback)
  const state = stateOrParams.currentStep ? stateOrParams : null;
  const step = state?.currentStep || stateOrParams.step;
  const context = state?.context || {};

  switch (step) {
    case 'awaiting_nickname':
      return handleNickname(event, user, text);
    case 'awaiting_address':
      return handleAddress(event, user, context, text);
    case 'awaiting_rent':
      return handleRent(event, user, context, text);
    // Postback-handled steps:
    case 'property_type':
      return handlePropertyType(event, user, stateOrParams.value);
    case 'due_day':
      return handleDueDay(event, user, stateOrParams.value);
    case 'grace_period':
      return handleGracePeriod(event, user, stateOrParams.value);
    default:
      await clearState(user.lineUserId);
      return menuFlow.showMain(event, user);
  }
}

async function handleNickname(event, user, text) {
  await advanceStep(user.lineUserId, 'awaiting_address', { nickname: text });
  return sendText(event.replyToken, `Great name! 📍\n\nWhat's the address or area of this property?\n(Short is fine, e.g. "Soi Sukhumvit 11, Khlong Toei")`);
}

async function handleAddress(event, user, context, text) {
  await advanceStep(user.lineUserId, 'awaiting_property_type', { address: text });

  return sendQuickReply(event.replyToken, 'What type of property is this?', [
    { label: 'Condo', data: 'action=property_type&value=condo&step=property_type' },
    { label: 'Apartment', data: 'action=property_type&value=apartment&step=property_type' },
    { label: 'House', data: 'action=property_type&value=house&step=property_type' },
    { label: 'Room', data: 'action=property_type&value=room&step=property_type' },
    { label: 'Other', data: 'action=property_type&value=other&step=property_type' },
  ]);
}

async function handlePropertyType(event, user, value) {
  await advanceStep(user.lineUserId, 'awaiting_rent', { propertyType: value });
  return sendText(event.replyToken, `Monthly rent amount? (THB)\n\nPlease enter numbers only, e.g. 8000`);
}

async function handleRent(event, user, context, text) {
  const amount = parseFloat(text.replace(/,/g, ''));
  if (isNaN(amount) || amount <= 0) {
    return sendText(event.replyToken, `Please enter a valid amount in numbers only.\nExample: 8000`);
  }

  await advanceStep(user.lineUserId, 'awaiting_due_day', { monthlyRent: amount });

  return sendQuickReply(event.replyToken, 'Which day of the month is rent due?', [
    { label: '1st', data: 'action=due_day&value=1&step=due_day' },
    { label: '5th', data: 'action=due_day&value=5&step=due_day' },
    { label: '10th', data: 'action=due_day&value=10&step=due_day' },
    { label: '15th', data: 'action=due_day&value=15&step=due_day' },
    { label: '28th', data: 'action=due_day&value=28&step=due_day' },
  ]);
}

async function handleDueDay(event, user, value) {
  await advanceStep(user.lineUserId, 'awaiting_grace_period', { dueDay: parseInt(value) });

  return sendQuickReply(event.replyToken,
    `Grace period for late payment?\n(e.g. 5 days means paying within 5 days of due date is still "on time")`,
    [
      { label: 'None (0 days)', data: 'action=grace_period&value=0&step=grace_period' },
      { label: '3 days', data: 'action=grace_period&value=3&step=grace_period' },
      { label: '5 days', data: 'action=grace_period&value=5&step=grace_period' },
      { label: '7 days', data: 'action=grace_period&value=7&step=grace_period' },
    ]
  );
}

async function handleGracePeriod(event, user, value) {
  await advanceStep(user.lineUserId, 'awaiting_confirmation', { gracePeriodDays: parseInt(value) });

  // Load full context to show summary
  const { context } = await require('../utils/stateManager').getState(user.lineUserId);

  const summary =
    `📋 Property Summary\n\n` +
    `🏠 Name: ${context.nickname}\n` +
    `📍 Address: ${context.address}\n` +
    `🏷 Type: ${context.propertyType}\n` +
    `💰 Rent: ฿${Number(context.monthlyRent).toLocaleString()}/month\n` +
    `📅 Due: ${context.dueDay}${ordinal(context.dueDay)} of each month\n` +
    `⏱ Grace period: ${context.gracePeriodDays} days\n\n` +
    `Confirm and save?`;

  return sendQuickReply(event.replyToken, summary, [
    { label: '✅ Confirm', data: 'action=property_confirm' },
    { label: '❌ Cancel', data: 'action=property_cancel' },
  ]);
}

async function confirm(event, user) {
  const stateData = await require('../utils/stateManager').getState(user.lineUserId);
  const ctx = stateData?.context;

  if (!ctx?.nickname) {
    return sendText(event.replyToken, 'Something went wrong. Please start again.');
  }

  // Save to DB
  const property = await db.property.create({
    data: {
      landlordId: user.id,
      nickname: ctx.nickname,
      address: ctx.address,
      propertyType: ctx.propertyType,
    },
  });

  await eventService.log(user.id, 'property.created', 'property', property.id, { nickname: ctx.nickname });
  await clearState(user.lineUserId);

  // Store rent details in state for lease creation
  await setState(user.lineUserId, {
    flow: 'lease_creation',
    step: 'awaiting_start_date',
    context: {
      propertyId: property.id,
      propertyNickname: ctx.nickname,
      monthlyRent: ctx.monthlyRent,
      dueDay: ctx.dueDay,
      gracePeriodDays: ctx.gracePeriodDays,
    },
  });

  return sendText(
    event.replyToken,
    `✅ Property "${ctx.nickname}" created!\n\nNow let's set up the lease.\n\nWhat is the lease start date?\n(Format: DD/MM/YYYY, e.g. 01/06/2025)`
  );
}

async function cancel(event, user) {
  await clearState(user.lineUserId);
  await sendText(event.replyToken, 'Property creation cancelled.');
  return menuFlow.showMain(event, user);
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = { start, handleStep, confirm, cancel };
