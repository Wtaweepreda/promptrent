// src/handlers/eventDispatcher.js
// Routes every LINE event to the correct handler

const db = require('../db');
const conversationRouter = require('./conversationRouter');
const client = require('../lineClient');

async function handleEvent(event) {
  const lineUserId = event.source?.userId;
  if (!lineUserId) return;

  // Handle follow event (user adds LINE OA)
  if (event.type === 'follow') {
    return handleFollow(event, lineUserId);
  }

  // Handle message events
  if (event.type === 'message' && event.message.type === 'text') {
    return handleMessage(event, lineUserId);
  }

  // Handle button postback events
  if (event.type === 'postback') {
    return handlePostback(event, lineUserId);
  }
}

async function handleFollow(event, lineUserId) {
  // User just added the LINE OA — start onboarding
  return conversationRouter.startOnboarding(event, lineUserId);
}

async function handleMessage(event, lineUserId) {
  const text = event.message.text.trim();

  // Check for invite token (tenant joining via link)
  if (text.startsWith('join_')) {
    const token = text.replace('join_', '');
    return conversationRouter.handleInviteToken(event, lineUserId, token);
  }

  // Menu shortcuts
  if (text === 'เมนู' || text === 'menu' || text === 'Menu') {
    return conversationRouter.showMainMenu(event, lineUserId);
  }

  // Admin commands
  if (text.startsWith('/admin')) {
    return conversationRouter.handleAdminCommand(event, lineUserId, text);
  }

  // Route to active conversation flow
  return conversationRouter.handleMessage(event, lineUserId, text);
}

async function handlePostback(event, lineUserId) {
  return conversationRouter.handlePostback(event, lineUserId, event.postback.data);
}

module.exports = { handleEvent };
