// src/services/paymentService.js

const db = require('../db');
const eventService = require('./eventService');
const scoreService = require('./scoreService');

// Create a pending payment record for a given month
async function createPaymentRecord(leaseId, periodYear, periodMonth, dueDate, expectedAmount) {
  // Avoid duplicates
  const existing = await db.paymentRecord.findUnique({
    where: { leaseId_periodYear_periodMonth: { leaseId, periodYear, periodMonth } },
  });
  if (existing) return existing;

  return db.paymentRecord.create({
    data: {
      leaseId,
      periodYear,
      periodMonth,
      dueDate: new Date(dueDate),
      expectedAmount,
      paymentStatus: 'pending',
    },
  });
}

// Landlord confirms payment
async function confirmPayment(paymentRecordId, landlordId, { status, paidAmount, daysLate, paymentMethod, notes }) {
  const record = await db.paymentRecord.update({
    where: { id: paymentRecordId },
    data: {
      paymentStatus: status,
      paidAmount,
      daysLate,
      paymentMethod,
      notes,
      confirmedBy: landlordId,
      confirmedAt: new Date(),
    },
    include: { lease: { include: { tenant: true } } },
  });

  await eventService.log(landlordId, 'payment.confirmed', 'payment_record', paymentRecordId, { status, daysLate });

  // Trigger score recalculation
  if (record.lease.tenantId) {
    await scoreService.computeAndSave(record.lease.tenantId, record.leaseId, 'payment_confirmed');
  }

  return record;
}

// Auto-mark records as missed if 30 days past due with no confirmation
async function autoMarkMissed() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const overdue = await db.paymentRecord.findMany({
    where: {
      paymentStatus: 'pending',
      dueDate: { lt: thirtyDaysAgo },
    },
    include: { lease: { include: { tenant: true, landlord: true } } },
  });

  for (const record of overdue) {
    await db.paymentRecord.update({
      where: { id: record.id },
      data: { paymentStatus: 'missed', confirmedAt: new Date() },
    });

    if (record.lease.tenantId) {
      await scoreService.computeAndSave(record.lease.tenantId, record.leaseId, 'auto_marked_missed');
    }

    await eventService.log(null, 'payment.auto_missed', 'payment_record', record.id, {});
  }

  return overdue.length;
}

async function getPaymentHistory(leaseId) {
  return db.paymentRecord.findMany({
    where: { leaseId },
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
  });
}

async function getPendingForLandlord(landlordId) {
  return db.paymentRecord.findMany({
    where: {
      lease: { landlordId },
      paymentStatus: 'pending',
    },
    include: {
      lease: {
        include: {
          property: true,
          tenant: { select: { fullName: true } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
  });
}

async function findById(id) {
  return db.paymentRecord.findUnique({
    where: { id },
    include: {
      lease: {
        include: {
          property: true,
          tenant: { select: { lineUserId: true, fullName: true } },
          landlord: { select: { lineUserId: true, fullName: true } },
        },
      },
    },
  });
}

module.exports = {
  createPaymentRecord,
  confirmPayment,
  autoMarkMissed,
  getPaymentHistory,
  getPendingForLandlord,
  findById,
};
