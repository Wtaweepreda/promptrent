// src/flows/menuFlow.js
// Main navigation: dashboard views, collection status, property/tenant lists, help.

const {
  sendText,
  sendQuickReply,
  sendFlex,
  buildTenantDashboard,
  buildLandlordDashboard,
  buildLeaseCard,
  buildCollectionStatusCard,
  buildPaymentHistoryFlex,
  buildHelpCard,
  ordinal,
} = require('../utils/lineHelpers');

const leaseService   = require('../services/leaseService');
const paymentService = require('../services/paymentService');
const scoreService   = require('../services/scoreService');
const db             = require('../db');

// ─────────────────────────────────────────────────────────────────
//  PUBLIC: show role-appropriate dashboard
// ─────────────────────────────────────────────────────────────────

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

/**
 * Build and return the dashboard Flex card JSON for a user (no send).
 * Used by onboardingFlow to embed the card in a multi-message reply.
 */
async function buildDashboardCard(user) {
  try {
    if (user.role === 'landlord' || user.role === 'both') {
      const leases          = await leaseService.getLeasesForLandlord(user.id);
      const pendingPayments = await paymentService.getPendingForLandlord(user.id);
      return buildLandlordDashboard(user, leases, pendingPayments);
    }
    if (user.role === 'tenant') {
      const leases = await leaseService.getLeasesForTenant(user.id);
      const lease  = leases[0] || null;
      const score  = lease ? await scoreService.getScore(user.id, lease.id) : null;
      const payments = lease ? await paymentService.getPaymentHistory(lease.id) : [];
      return buildTenantDashboard(user, score, lease, payments);
    }
  } catch (err) {
    console.error('[menuFlow.buildDashboardCard]', err.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
//  LANDLORD VIEWS
// ─────────────────────────────────────────────────────────────────

async function showLandlordMenu(event, user) {
  const [leases, pendingPayments] = await Promise.all([
    leaseService.getLeasesForLandlord(user.id),
    paymentService.getPendingForLandlord(user.id),
  ]);

  const card = buildLandlordDashboard(user, leases, pendingPayments);
  return sendFlex(event.replyToken, 'Your Dashboard', card);
}

// Collection status — all pending confirmations with inline action buttons
async function showCollection(event, user) {
  const pending = await paymentService.getPendingForLandlord(user.id);
  const card    = buildCollectionStatusCard(pending);
  return sendFlex(event.replyToken, 'Collection Status', card);
}

// Add Tenant — smart: if 1 available property go straight there, else pick
async function showAddTenant(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `You don't have any properties yet.\n\nAdd a property first — tap Properties in the menu.`,
    );
  }

  // Properties that could accept a new tenant (pending or no tenant)
  const available = leases.filter(l => l.status === 'pending' && !l.tenantId);

  if (!available.length) {
    // All properties have active tenants — offer to add a new property
    return sendQuickReply(
      event.replyToken,
      `All your properties already have active tenants.\n\nWould you like to add a new property?`,
      [
        { label: '➕ Add Property', data: 'action=menu_add_property' },
        { label: '📊 Dashboard',    data: 'action=menu_dashboard' },
      ],
    );
  }

  if (available.length === 1) {
    // Only one option — go directly to tenant invitation
    const leaseFlow = require('./leaseFlow');
    return leaseFlow.startAddTenant(event, user, available[0].propertyId);
  }

  // Multiple options — let landlord pick
  const options = available.map(l => ({
    label: (l.property?.nickname || 'Property').substring(0, 20),
    data:  `action=add_tenant&property_id=${l.propertyId}`,
  }));

  return sendQuickReply(event.replyToken, `Which property?\nSelect one to add a tenant:`, options);
}

// Properties list — text summary (flex carousel would need an image per property)
async function showProperties(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);

  if (!leases.length) {
    return sendQuickReply(
      event.replyToken,
      `No properties added yet.\nReady to add your first one?`,
      [{ label: '➕ Add Property', data: 'action=menu_add_property' }],
    );
  }

  const list = leases.map((l, i) =>
    `${i + 1}. ${l.property?.nickname || '—'}\n` +
    `   Tenant: ${l.tenant?.fullName || 'No tenant yet'}\n` +
    `   Rent: ฿${Number(l.monthlyRent).toLocaleString()} · Status: ${l.status}`,
  ).join('\n\n');

  const options = [];
  if (leases.length > 0) {
    options.push({
      label: `📊 ${(leases[0].property?.nickname || 'Property').substring(0, 12)} History`,
      data:  `action=menu_payment_history&lease_id=${leases[0].id}`,
    });
  }
  options.push({ label: '➕ Add Property', data: 'action=menu_add_property' });

  return sendQuickReply(event.replyToken, `🏠 Your Properties:\n\n${list}`, options);
}

// Tenants list — tap to see payment history
async function showTenants(event, user) {
  const leases = await leaseService.getLeasesForLandlord(user.id);
  const active = leases.filter(l => l.status === 'active' && l.tenant);

  if (!active.length) {
    return sendText(
      event.replyToken,
      `No active tenants yet.\n\nAdd a property and invite a tenant to get started.`,
    );
  }

  const options = active.map(l => ({
    label: `👤 ${(l.tenant.fullName || 'Tenant').substring(0, 15)}`,
    data:  `action=menu_payment_history&lease_id=${l.id}`,
  }));

  return sendQuickReply(event.replyToken, `👥 Your Tenants\nTap a name to view payment history:`, options);
}

// Payment history — flex card
async function showPaymentHistory(event, user, leaseId) {
  if (!leaseId) {
    const leases = user.role === 'tenant'
      ? await leaseService.getLeasesForTenant(user.id)
      : await leaseService.getLeasesForLandlord(user.id);

    if (!leases.length) return sendText(event.replyToken, 'No lease found.');
    leaseId = leases[0].id;
  }

  const [lease, payments] = await Promise.all([
    db.lease.findUnique({ where: { id: leaseId }, include: { property: true } }),
    paymentService.getPaymentHistory(leaseId),
  ]);

  if (!payments.length) {
    return sendText(
      event.replyToken,
      `No payment records yet for ${lease?.property?.nickname || 'this property'}.\n\nRecords will appear after the first payment cycle.`,
    );
  }

  const card = buildPaymentHistoryFlex(payments, lease?.property?.nickname || 'Property');
  return sendFlex(event.replyToken, 'Payment History', card);
}

// ─────────────────────────────────────────────────────────────────
//  PROFILE
// ─────────────────────────────────────────────────────────────────

async function showProfile(event, user) {
  const profileFlow = require('./profileFlow');
  return profileFlow.showProfile(event, user);
}

// ─────────────────────────────────────────────────────────────────
//  TENANT VIEWS
// ─────────────────────────────────────────────────────────────────

async function showTenantMenu(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);
  const lease  = leases[0] || null;
  const score  = lease ? await scoreService.getScore(user.id, lease.id) : null;
  const payments = lease ? await paymentService.getPaymentHistory(lease.id) : [];

  const card = buildTenantDashboard(user, score, lease, payments);
  return sendFlex(event.replyToken, 'Your Dashboard', card);
}

// Lease details — premium card
async function showMyLease(event, user) {
  const leases = await leaseService.getLeasesForTenant(user.id);

  if (!leases.length) {
    return sendText(
      event.replyToken,
      `No active lease found.\n\nIf your landlord sent you an invite, send the join code (it starts with "join_").`,
    );
  }

  const card = buildLeaseCard(leases[0]);
  return sendFlex(event.replyToken, 'My Lease', card);
}

// Tenant payment history
async function showMyPayments(event, user) {
  return showPaymentHistory(event, user, null);
}

// Pay Rent — tenant reports payment for this month
async function showPayRent(event, user) {
  const tenantPaymentFlow = require('./tenantPaymentFlow');
  return tenantPaymentFlow.start(event, user);
}

// Create Lease — tenant-initiated lease request
async function showCreateLease(event, user) {
  const tenantLeaseFlow = require('./tenantLeaseFlow');
  return tenantLeaseFlow.start(event, user);
}

// ─────────────────────────────────────────────────────────────────
//  SHARED VIEWS
// ─────────────────────────────────────────────────────────────────

// Help / how it works card (role-aware)
async function showHelp(event, user) {
  const card = buildHelpCard(user.role);
  return sendFlex(event.replyToken, 'How it works', card);
}

// ─────────────────────────────────────────────────────────────────
//  ADMIN
// ─────────────────────────────────────────────────────────────────

async function showAdminMenu(event, user) {
  return sendText(
    event.replyToken,
    `Admin Panel 🔧\n\nCommands:\n` +
    `/admin stats     — system overview\n` +
    `/admin disputes  — open disputes`,
  );
}

async function handleAdminCommand(event, user, text) {
  const parts = text.trim().split(' ');
  const cmd   = parts[1];

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
      `🚩 Open disputes: ${disputes}`,
    );
  }

  return sendText(event.replyToken, `Unknown admin command: ${cmd}`);
}

module.exports = {
  showMain,
  buildDashboardCard,
  // Landlord
  showLandlordMenu,
  showCollection,
  showAddTenant,
  showProperties,
  showTenants,
  showPaymentHistory,
  // Tenant
  showTenantMenu,
  showMyLease,
  showMyPayments,
  showPayRent,
  showCreateLease,
  // Shared
  showHelp,
  showProfile,
  // Admin
  showAdminMenu,
  handleAdminCommand,
};
