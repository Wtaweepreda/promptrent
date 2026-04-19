// src/services/userService.js

const db = require('../db');
const eventService = require('./eventService');

async function findByLineId(lineUserId) {
  return db.user.findUnique({ where: { lineUserId } });
}

async function findById(id) {
  return db.user.findUnique({ where: { id } });
}

async function createUser({ lineUserId, fullName, phone, role }) {
  const user = await db.user.create({
    data: { lineUserId, fullName, phone, role },
  });
  await eventService.log(user.id, 'user.registered', 'user', user.id, { role });
  return user;
}

async function updateUser(id, data) {
  return db.user.update({ where: { id }, data });
}

async function setRole(lineUserId, role) {
  return db.user.upsert({
    where: { lineUserId },
    update: { role },
    create: { lineUserId, role },
  });
}

module.exports = { findByLineId, findById, createUser, updateUser, setRole };
