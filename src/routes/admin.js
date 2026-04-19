// src/routes/admin.js
// Simple admin API — protected by ADMIN_SECRET env var

const express = require('express');
const router = express.Router();
const db = require('../db');
const scoreService = require('../services/scoreService');

// Simple auth middleware
router.use((req, res, next) => {
  const secret = req.headers['x-admin-secret'];
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// GET /admin/stats
router.get('/stats', async (req, res) => {
  try {
    const [users, leases, payments, disputes] = await Promise.all([
      db.user.count({ where: { status: 'active' } }),
      db.lease.count({ where: { status: 'active' } }),
      db.paymentRecord.count({ where: { paymentStatus: 'pending' } }),
      db.dispute.count({ where: { status: 'open' } }),
    ]);
    res.json({ activeUsers: users, activeLeases: leases, pendingPayments: payments, openDisputes: disputes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /admin/disputes
router.get('/disputes', async (req, res) => {
  try {
    const disputes = await db.dispute.findMany({
      where: { status: 'open' },
      include: {
        raisedByUser: { select: { fullName: true, lineUserId: true } },
        paymentRecord: { select: { periodYear: true, periodMonth: true, paymentStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /admin/disputes/:id
router.patch('/disputes/:id', async (req, res) => {
  const { id } = req.params;
  const { status, resolutionNote, resolvedBy } = req.body;
  try {
    const dispute = await db.dispute.update({
      where: { id },
      data: { status, resolutionNote, resolvedBy, resolvedAt: new Date() },
    });
    // Un-flag disputed payment record
    await db.paymentRecord.update({
      where: { id: dispute.paymentRecordId },
      data: { isDisputed: false },
    });
    res.json(dispute);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /admin/scores/recalculate
router.post('/scores/recalculate', async (req, res) => {
  const { tenantId, leaseId } = req.body;
  try {
    const score = await scoreService.computeAndSave(tenantId, leaseId, 'manual_recalc');
    res.json(score);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
