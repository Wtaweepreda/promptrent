// src/flows/menuFlow.js
// Main menu navigation for landlords, tenants, and admins

const { sendText, sendQuickReply, sendButtons, sendFlex, buildPaymentHistoryFlex } = require('../utils/lineHelpers');
const leaseService = require('../services/leaseService');
const paymentService = require('../services/paymentService');
const db = require('../db');

// ── Main menu dispatcher ─────────────────────────────────────────
async function showMain(event, user) {
  if (user.role === 'landlord' || user.role === 'both') {
    return showLandlordMenu(event, user);
  }
  if (user.role === 'tenant') {
    return showTenantMenu(event, user);
  }
  if (user.role === 'admin') {
    return showAdminMenu(event, user);
  }

  return sendText(event.replyToken, `Hello ${user.fullName || 'there'}! 👋\n\nHow can I help you today?`);
}

// ── Landlord main menu ───────────────────────────────────────────
async function showLandlordMenu(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);
  const activeCount = leases.filter(l => l.status === 'active').length;

  return sendQuickReply(
    event.replyToken,
    `Welcome back, ${user.fullName || 'Landlord'}! 🏠\n\nActive leases: ${activeCount}`,
    [
      { label: '🏠 My Properties', data: 'action=menu_properties' },
      { label: '👥 My Tenants', data: 'action=menu_tenants' },
      { label: '📊 Payment History', data: 'action=menu_payment_history' },
      { label: '➕ Add Property', data: 'action=menu_add_property' },
    ]
  );
}

// ── Tenant main menu ─────────────────────────────────────────────
async function showTenantMenu(event, user) {
  return sendQuickReply(
    event.replyToken,
    `Hello, ${user.fullName || 'Tenant'}! 🙋\n\nWhat would you like to do?`,
    [
      { label: '📋 My Lease', data: 'action=menu_my_lease' },
      { label: '📊 Payment History', data: 'action=menu_my_payments' },
      { label: '⭐ My Renter Score', data: 'action=menu_my_score' },
      { label: '🔗 Share My Score', data: 'action=menu_share_score' },
      { label: '🚩 Dispute a Record', data: 'action=menu_dispute' },
    ]
  );
}

// ── Admin menu ───────────────────────────────────────────────────
async function showAdminMenu(event, user) {
  return sendText(
    event.replyToken,
    `Admin Panel 🔧\n\nCommands:\n` +
    `/admin stats — system overview\n` +
    `/admin disputes — open disputes\n` +
    `/admin resolve [id] [note] — resolve dispute`
  );
}

// ── Landlord: show properties list ──────────────────────────────
async function showProperties(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);

  if (!leases.length) {
    return sendQuickReply(
      event.replyToken,
      `You haven't added any properties yet.\nReady to add your first one?`,
      [{ label: '➕ Add Property', data: 'action=menu_add_property' }]
    );
  }

  const list = leases.map((l, i) =>
    `${i + 1}. ${l.property.nickname}\n   Tenant: ${l.tenant?.fullName || 'No tenant yet'}\n   Status: ${l.status}`
  ).join('\n\n');

  // Show quick actions for first property (LINE limits buttons)
  const firstLease = leases[0];

  return sendQuickReply(
    event.replyToken,
    `🏠 Your Properties:\n\n${list}`,
    [
      { label: `📊 ${firstLease.property.nickname} History`, data: `action=menu_payment_history&lease_id=${firstLease.id}` },
      { label: '➕ Add Another', data: 'action=menu_add_property' },
    ]
  );
}

// ── Landlord: show tenants ───────────────────────────────────────
async function showTenants(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);
  const activeLeases = leases.filter(l => l.status === 'active' && l.tenant);

  if (!activeLeases.length) {
    return sendText(event.replyToken, `No active tenants yet. Add a property and invite a tenant to get started!`);
  }

  const options = activeLeases.map(l => ({
    label: `👤 ${l.tenant.fullName}`,
    data: `action=menu_payment_history&lease_id=${l.id}`,
  }));

  return sendQuickReply(event.replyToken, `👥 Your Tenants:\nTap a name to see payment history.`, options);
}

// ── Landlord/Tenant: show payment history ────────────────────────
async function showPaymentHistory(event, user, leaseId) {
  // If no leaseId given, find the first relevant lease
  if (!leaseId) {
    const leases = user.role === 'tenant'
      ? await leaseService.getLeasesForTenant(user.id)
      : await leaseService.getLeasesForLandlord(user.id);

    if (!leases.length) {
      return sendText(event.replyToken, 'No lease found.');
    }
    leaseId = leases[0].id;
  }

  const lease = await db.lease.findUnique({
    where: { id: leaseId },
    include: { property: true },
  });

  const payments = await paymentService.getPaymentHistory(leaseId);

  if (!payments.length) {
    return sendText(event.replyToken, `No payment records yet for ${lease?.property?.nickname}.\n\nRecords will appear after the first payment cycle.`);
  }

  const card = buildPaymentHistoryFlex(payments, lease?.property?.nickname || 'Property');
  return sendFlex(event.replyToken, 'Payment History', card);
}

// ── Tenant: show lease details ───────────────────────────────────
async function showMyLease(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `No active lease found.\n\nIf your landlord sent you an invite, please tap the invite link or send the join code.`
    );
  }

  const lease = leases[0];
  const startDate = new Date(lease.startDate).toLocaleDateString('en-GB');
  const endDate = lease.endDate ? new Date(lease.endDate).toLocaleDateString('en-GB') : 'Open-ended';

  return sendText(
    event.replyToken,
    `📋 Your Lease\n\n` +
    `🏠 Property: ${lease.property.nickname}\n` +
    `🧑‍💼 Landlord: ${lease.landlord.fullName}\n` +
    `💰 Rent: ฿${Number(lease.monthlyRent).toLocaleString()}/month\n` +
    `📅 Due: ${lease.dueDay}${ordinal(lease.dueDay)} of each month\n` +
    `⏱ Grace period: ${lease.gracePeriodDays} days\n` +
    `🗓 Start: ${startDate}\n` +
    `🏁 End: ${endDate}\n` +
    `📌 Status: ${lease.status}`
  );
}

// ── Tenant: payment history ──────────────────────────────────────
async function showMyPayments(event, user) {
  return showPaymentHistory(event, user, null);
}

// ── Admin commands ───────────────────────────────────────────────
async function handleAdminCommand(event, user, text) {
  const parts = text.trim().split(' ');
  const cmd = parts[1];

  if (cmd === 'stats') {
    const [users, leases, pending, disputes] = await Promise.all([
      db.user.count({ where: { status: 'active' } }),
      db.lease.count({ where: { status: 'active' } }),
      db.paymentRecord.count({ where: { paymentStatus: 'pending' } }),
      db.dispute.count({ where: { status: 'open' } }),
    ]);
    return sendText(event.replyToken,
      `📊 PromptRent Stats\n\n` +
      `👥 Active users: ${users}\n` +
      `🏠 Active leases: ${leases}\n` +
      `⏳ Pending payments: ${pending}\n` +
      `🚩 Open disputes: ${disputes}`
    );
  }

  return sendText(event.replyToken, `Unknown admin command: ${cmd}`);
}

function ordinal(n) {
  const s = ['th','st','nd','rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

module.exports = {
  showMain,
  showProperties,
  showTenants,
  showPaymentHistory,
  showMyLease,
  showMyPayments,
  handleAdminCommand,
};
