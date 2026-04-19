// src/services/scoreService.js
// V1 Scoring Engine — pure formula, no ML

const db = require('../db');

const SCORE_VERSION = 'v1.0';
const MIN_MONTHS_REQUIRED = 3;

const DEDUCTIONS = {
  late_1_7:   5,   // paid late, 1–7 days
  late_8_30:  10,  // paid late, 8–30 days
  late_31_plus: 20, // paid late, 31+ days
  missed:     25,  // not paid at all
};

const GRADE_THRESHOLDS = [
  { min: 90, grade: 'A', label: 'Excellent' },
  { min: 75, grade: 'B', label: 'Good' },
  { min: 60, grade: 'C', label: 'Fair' },
  { min: 40, grade: 'D', label: 'Needs Improvement' },
  { min: 0,  grade: 'E', label: 'Poor' },
];

// ── Core calculation ─────────────────────────────────────────────
function calculateScore(paymentRecords) {
  // Filter: only confirmed, non-disputed records
  const confirmed = paymentRecords.filter(
    r => r.paymentStatus !== 'pending' && !r.isDisputed
  );

  if (confirmed.length < MIN_MONTHS_REQUIRED) {
    return null; // Not enough data yet
  }

  let score = 100;
  let onTimeMonths = 0;
  let lateMonths = 0;
  let missedMonths = 0;
  let totalDaysLate = 0;
  let lateCount = 0;

  for (const record of confirmed) {
    if (record.paymentStatus === 'paid_on_time') {
      onTimeMonths++;
    } else if (record.paymentStatus === 'paid_late') {
      lateMonths++;
      const days = record.daysLate || 0;
      totalDaysLate += days;
      lateCount++;

      if (days <= 7)       score -= DEDUCTIONS.late_1_7;
      else if (days <= 30) score -= DEDUCTIONS.late_8_30;
      else                 score -= DEDUCTIONS.late_31_plus;
    } else if (record.paymentStatus === 'missed') {
      missedMonths++;
      score -= DEDUCTIONS.missed;
    } else if (record.paymentStatus === 'partial') {
      // Partial = treat as late (14 days equivalent for scoring)
      lateMonths++;
      score -= DEDUCTIONS.late_8_30;
    }
  }

  // Floor at 0
  score = Math.max(0, score);

  // Determine grade
  const { grade, label } = GRADE_THRESHOLDS.find(t => score >= t.min);

  return {
    score,
    grade,
    gradeLabel: label,
    totalMonths: confirmed.length,
    onTimeMonths,
    lateMonths,
    missedMonths,
    avgDaysLate: lateCount > 0 ? Math.round((totalDaysLate / lateCount) * 10) / 10 : null,
    scoreVersion: SCORE_VERSION,
  };
}

// ── Compute and persist to DB ────────────────────────────────────
async function computeAndSave(tenantId, leaseId, triggerEvent) {
  const records = await db.paymentRecord.findMany({
    where: { leaseId },
    orderBy: [{ periodYear: 'asc' }, { periodMonth: 'asc' }],
  });

  const result = calculateScore(records);

  if (!result) {
    // Not enough data — return null, no DB write
    return null;
  }

  // Upsert current score
  const score = await db.renterScore.upsert({
    where: { tenantId_leaseId: { tenantId, leaseId } },
    update: { ...result, computedAt: new Date() },
    create: { tenantId, leaseId, ...result },
  });

  // Append to history
  await db.scoreHistory.create({
    data: {
      tenantId,
      leaseId,
      score: result.score,
      grade: result.grade,
      triggerEvent,
      scoreVersion: SCORE_VERSION,
    },
  });

  return score;
}

// ── Get current score ────────────────────────────────────────────
async function getScore(tenantId, leaseId) {
  return db.renterScore.findUnique({
    where: { tenantId_leaseId: { tenantId, leaseId } },
  });
}

// ── Grade explanation text ───────────────────────────────────────
function getGradeExplanation(grade) {
  const explanations = {
    A: 'Outstanding payment record — highly reliable tenant.',
    B: 'Good payment history — generally reliable.',
    C: 'Some late payments on record — room for improvement.',
    D: 'Frequent late or missed payments — requires attention.',
    E: 'Poor payment history — significant reliability concerns.',
  };
  return explanations[grade] || '';
}

module.exports = { calculateScore, computeAndSave, getScore, getGradeExplanation, MIN_MONTHS_REQUIRED };
