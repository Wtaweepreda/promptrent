// src/db.js
// Prisma client singleton — import this everywhere you need DB access

const { PrismaClient } = require('@prisma/client');

const db = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

module.exports = db;
