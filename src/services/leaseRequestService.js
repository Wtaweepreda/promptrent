// src/services/leaseRequestService.js
// Handles tenant-initiated lease requests (lreq_ flow)

const db = require('../db');
const { v4: uuidv4 } = require('uuid');

const INVITE_EXPIRY_DAYS = 7;

// ── Create a new lease request from a tenant ────────────────────────────────
async function createLeaseRequest({
  tenantId,
  propertyNickname,
  propertyAddress,
  monthlyRent,
  dueDay,
  gracePeriodDays = 0,
  startDate,
}) {
  const inviteToken     = uuidv4().replace(/-/g, '').substring(0, 12);
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  return db.leaseRequest.create({
    data: {
      tenantId,
      propertyNickname,
      propertyAddress,
      monthlyRent,
      dueDay,
      gracePeriodDays,
      startDate: new Date(startDate),
      inviteToken,
      inviteExpiresAt,
    },
    include: { tenant: true },
  });
}

// ── Find by invite token (landlord receives lreq_TOKEN) ──────────────────────
async function findByToken(token) {
  return db.leaseRequest.findUnique({
    where: { inviteToken: token },
    include: { tenant: true, lease: true },
  });
}

// ── Find by ID ────────────────────────────────────────────────────────────────
async function findById(requestId) {
  return db.leaseRequest.findUnique({
    where: { id: requestId },
    include: { tenant: true, lease: true },
  });
}

// ── Landlord accepts: auto-creates property + lease, links back ──────────────
async function acceptRequest(requestId, landlordId) {
  const request = await findById(requestId);
  if (!request) throw new Error('Lease request not found');
  if (request.status !== 'pending') throw new Error('This request is no longer pending');

  // Use a transaction to keep property + lease creation atomic
  const [, lease] = await db.$transaction(async (tx) => {
    // Create a new property for the landlord based on tenant's info
    const property = await tx.property.create({
      data: {
        landlordId,
        nickname:     request.propertyNickname,
        address:      request.propertyAddress,
        propertyType: 'other',
        status:       'active',
      },
    });

    // Create an active lease (tenant already known)
    const newLease = await tx.lease.create({
      data: {
        propertyId:     property.id,
        landlordId,
        tenantId:       request.tenantId,
        monthlyRent:    request.monthlyRent,
        dueDay:         request.dueDay,
        gracePeriodDays: request.gracePeriodDays,
        startDate:      request.startDate,
        status:         'active',
      },
    });

    // Mark request as accepted and link lease
    await tx.leaseRequest.update({
      where: { id: requestId },
      data:  { status: 'accepted', leaseId: newLease.id },
    });

    return [property, newLease];
  });

  return lease;
}

// ── Landlord rejects ─────────────────────────────────────────────────────────
async function rejectRequest(requestId) {
  return db.leaseRequest.update({
    where: { id: requestId },
    data:  { status: 'rejected' },
  });
}

// ── Expire stale requests ────────────────────────────────────────────────────
async function expireStaleRequests() {
  return db.leaseRequest.updateMany({
    where: {
      status:         'pending',
      inviteExpiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });
}

module.exports = {
  createLeaseRequest,
  findByToken,
  findById,
  acceptRequest,
  rejectRequest,
  expireStaleRequests,
};
