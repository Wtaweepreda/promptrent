// src/services/leaseService.js

const db = require('../db');
const { v4: uuidv4 } = require('uuid');
const eventService = require('./eventService');

async function createLease({ propertyId, landlordId, monthlyRent, currency = 'THB', dueDay, gracePeriodDays = 0, startDate, endDate }) {
  const inviteToken = uuidv4();
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const lease = await db.lease.create({
    data: {
      propertyId,
      landlordId,
      monthlyRent,
      currency,
      dueDay,
      gracePeriodDays,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      status: 'pending',
      inviteToken,
      inviteExpiresAt,
    },
  });

  await eventService.log(landlordId, 'lease.created', 'lease', lease.id, { propertyId });
  return lease;
}

async function activateLease(leaseId, tenantId) {
  const lease = await db.lease.update({
    where: { id: leaseId },
    data: { tenantId, status: 'active', inviteToken: null },
  });
  await eventService.log(tenantId, 'lease.activated', 'lease', leaseId, { tenantId });
  return lease;
}

async function endLease(leaseId, actorId) {
  const lease = await db.lease.update({
    where: { id: leaseId },
    data: { status: 'ended', endDate: new Date() },
  });
  await eventService.log(actorId, 'lease.ended', 'lease', leaseId, {});
  return lease;
}

async function findByInviteToken(token) {
  return db.lease.findUnique({
    where: { inviteToken: token },
    include: {
      property: true,
      landlord: { select: { fullName: true, lineUserId: true } },
    },
  });
}

async function getLeasesForLandlord(landlordId) {
  return db.lease.findMany({
    where: { landlordId, status: { in: ['active', 'pending'] } },
    include: {
      property: true,
      tenant: { select: { fullName: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

async function getLeasesForTenant(tenantId) {
  return db.lease.findMany({
    where: { tenantId, status: 'active' },
    include: {
      property: true,
      landlord: { select: { fullName: true } },
    },
  });
}

async function getActiveLeases() {
  return db.lease.findMany({
    where: { status: 'active' },
    include: {
      property: true,
      tenant: { select: { lineUserId: true, fullName: true } },
      landlord: { select: { lineUserId: true, fullName: true } },
    },
  });
}

module.exports = { createLease, activateLease, endLease, findByInviteToken, getLeasesForLandlord, getLeasesForTenant, getActiveLeases };
