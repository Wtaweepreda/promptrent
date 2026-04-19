// src/utils/stateManager.js
// Helpers for reading and writing conversation state

const db = require('../db');

// Get current state for a LINE user
async function getState(lineUserId) {
  return db.conversationState.findUnique({ where: { lineUserId } });
}

// Set a new flow + step + context (replaces existing)
async function setState(lineUserId, { flow, step, context = {} }) {
  return db.conversationState.upsert({
    where: { lineUserId },
    update: { currentFlow: flow, currentStep: step, context },
    create: { lineUserId, currentFlow: flow, currentStep: step, context },
  });
}

// Update only the step and merge context data
async function advanceStep(lineUserId, step, additionalContext = {}) {
  const current = await getState(lineUserId);
  const merged = { ...(current?.context || {}), ...additionalContext };
  return db.conversationState.upsert({
    where: { lineUserId },
    update: { currentStep: step, context: merged },
    create: { lineUserId, currentStep: step, context: merged },
  });
}

// Clear state (end of flow)
async function clearState(lineUserId) {
  return db.conversationState.upsert({
    where: { lineUserId },
    update: { currentFlow: null, currentStep: null, context: {} },
    create: { lineUserId, currentFlow: null, currentStep: null, context: {} },
  });
}

module.exports = { getState, setState, advanceStep, clearState };
