// src/scheduler.js
// Daily automated tasks: reminders, confirmations, missed payment detection

const cron = require('node-cron');
const db = require('./db');
const leaseService = require('./services/leaseService');
const paymentService = require('./services/paymentService');
const notificationService = require('./services/notificationService');

function start() {
  // ── Run every day at 8:00 AM Bangkok time (UTC+7 = 01:00 UTC) ──
  cron.schedule('0 1 * * *', async () => {
    console.log(`[Scheduler] Running daily tasks at ${new Date().toISOString()}`);
    try {
      await runDailyTasks();
    } catch (err) {
      console.error('[Scheduler] Daily task error:', err);
    }
  });

  // ── Auto-mark missed payments — runs daily at 9:00 AM Bangkok ──
  cron.schedule('0 2 * * *', async () => {
    console.log('[Scheduler] Running missed payment check...');
    try {
      const count = await paymentService.autoMarkMissed();
      console.log(`[Scheduler] Auto-marked ${count} payments as missed.`);
    } catch (err) {
      console.error('[Scheduler] Missed payment error:', err);
    }
  });

  console.log('⏰ Scheduler started (daily at 08:00 Bangkok time)');
}

async function runDailyTasks() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeLeases = await leaseService.getActiveLeases();
  let remindersSent = 0;
  let confirmationsSent = 0;
  let followUpsSent = 0;

  for (const lease of activeLeases) {
    if (!lease.tenant) continue; // Skip leases without confirmed tenants

    const dueDate = getDueDateForCurrentMonth(lease.dueDay);
    const threeDaysBefore = new Date(dueDate);
    threeDaysBefore.setDate(threeDaysBefore.getDate() - 3);

    // 1. Tenant reminder — 3 days before due
    if (isSameDay(today, threeDaysBefore)) {
      await notificationService.sendTenantDueSoonReminder(lease);
      remindersSent++;
    }

    // 2. Landlord confirmation — on due date
    if (isSameDay(today, dueDate)) {
      // Create payment record for this month if it doesn't exist
      const paymentRecord = await paymentService.createPaymentRecord(
        lease.id,
        today.getFullYear(),
        today.getMonth() + 1,
        dueDate,
        lease.monthlyRent
      );

      // Only send if still pending
      if (paymentRecord.paymentStatus === 'pending') {
        await notificationService.sendLandlordConfirmationRequest(lease, paymentRecord);
        confirmationsSent++;
      }
    }

    // 3. Follow-up to landlord — 7 days after due with no confirmation
    const sevenDaysAfterDue = new Date(dueDate);
    sevenDaysAfterDue.setDate(sevenDaysAfterDue.getDate() + 7);

    if (isSameDay(today, sevenDaysAfterDue)) {
      const lastMonth = getPreviousMonthRecord(lease.id, today);
      const pendingRecord = await db.paymentRecord.findFirst({
        where: {
          leaseId: lease.id,
          paymentStatus: 'pending',
          dueDate: { lte: sevenDaysAfterDue },
        },
      });

      if (pendingRecord) {
        await notificationService.sendLandlordFollowUp(lease, pendingRecord);
        followUpsSent++;
      }
    }
  }

  console.log(
    `[Scheduler] Done. ` +
    `Reminders: ${remindersSent}, ` +
    `Confirmations: ${confirmationsSent}, ` +
    `Follow-ups: ${followUpsSent}`
  );
}

// ── Helpers ──────────────────────────────────────────────────────
function getDueDateForCurrentMonth(dueDay) {
  const now = new Date();
  // Cap at 28 to be safe with all months
  const day = Math.min(dueDay, 28);
  return new Date(now.getFullYear(), now.getMonth(), day);
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function getPreviousMonthRecord(leaseId, today) {
  const prevMonth = today.getMonth() === 0 ? 12 : today.getMonth();
  const prevYear = today.getMonth() === 0 ? today.getFullYear() - 1 : today.getFullYear();

  return db.paymentRecord.findUnique({
    where: {
      leaseId_periodYear_periodMonth: { leaseId, periodYear: prevYear, periodMonth: prevMonth },
    },
  });
}

module.exports = { start };
