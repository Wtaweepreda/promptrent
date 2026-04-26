// src/utils/lineHelpers.js
// LINE message builders — basic senders + premium flex card templates.
//
// Design system
//   Background  #0D1B0D  (deep dark green)
//   Surface     #111811  (dark green surface)
//   Cell        #1A2E1A  (elevated surface)
//   Border      #1E331E
//   Primary     #00C853  (mint green — CTAs, scores)
//   Accent      #69F0AE  (light mint — highlights)
//   Warning     #FFB300  (amber — pending / late)
//   Error       #EF5350  (red — missed / rejected)
//   Text 1      #FFFFFF
//   Text 2      #AAAAAA
//   Text 3      #666666

const client = require('../lineClient');

// ─────────────────────────────────────────────────────────────────
//  BASIC SENDERS
// ─────────────────────────────────────────────────────────────────

async function sendText(replyToken, text) {
  return client.replyMessage(replyToken, { type: 'text', text });
}

// Quick-reply chips below a text message
// options: [{ label, data }]
async function sendQuickReply(replyToken, text, options) {
  return client.replyMessage(replyToken, {
    type: 'text',
    text,
    quickReply: {
      items: options.map(opt => ({
        type: 'action',
        action: { type: 'postback', label: opt.label, data: opt.data, displayText: opt.label },
      })),
    },
  });
}

// Buttons template (up to 4 buttons)
async function sendButtons(replyToken, { title, text, buttons }) {
  return client.replyMessage(replyToken, {
    type: 'template',
    altText: text,
    template: {
      type: 'buttons',
      title: title || 'PromptRent',
      text: text.substring(0, title ? 60 : 160),
      actions: buttons.map(btn => ({
        type: 'postback',
        label: btn.label.substring(0, 20),
        data: btn.data,
        displayText: btn.label,
      })),
    },
  });
}

// Confirm template (two buttons)
async function sendConfirm(replyToken, { text, yesData, noData, yesLabel = 'Yes ✅', noLabel = 'No ❌' }) {
  return client.replyMessage(replyToken, {
    type: 'template',
    altText: text,
    template: {
      type: 'confirm',
      text: text.substring(0, 240),
      actions: [
        { type: 'postback', label: yesLabel, data: yesData, displayText: yesLabel },
        { type: 'postback', label: noLabel,  data: noData,  displayText: noLabel  },
      ],
    },
  });
}

// Single flex message
async function sendFlex(replyToken, altText, contents) {
  return client.replyMessage(replyToken, { type: 'flex', altText, contents });
}

// Reply with up to 5 messages in one call (avoids double-reply errors)
// messages: array of LINE message objects
async function sendMultiple(replyToken, messages) {
  return client.replyMessage(replyToken, messages);
}

// ─────────────────────────────────────────────────────────────────
//  PUSH VARIANTS (scheduler / system-initiated)
// ─────────────────────────────────────────────────────────────────

async function pushText(lineUserId, text) {
  return client.pushMessage(lineUserId, { type: 'text', text });
}

async function pushQuickReply(lineUserId, text, options) {
  return client.pushMessage(lineUserId, {
    type: 'text',
    text,
    quickReply: {
      items: options.map(opt => ({
        type: 'action',
        action: { type: 'postback', label: opt.label, data: opt.data, displayText: opt.label },
      })),
    },
  });
}

async function pushFlex(lineUserId, altText, contents) {
  return client.pushMessage(lineUserId, { type: 'flex', altText, contents });
}

// ─────────────────────────────────────────────────────────────────
//  MESSAGE OBJECT HELPERS  (for sendMultiple)
// ─────────────────────────────────────────────────────────────────

const textMsg  = (text)              => ({ type: 'text',  text });
const flexMsg  = (altText, contents) => ({ type: 'flex',  altText, contents });

// ─────────────────────────────────────────────────────────────────
//  SHARED UTILS
// ─────────────────────────────────────────────────────────────────

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

const MONTH = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const GRADE_COLOR = { A: '#00C853', B: '#00B0FF', C: '#FFB300', D: '#FF7043', E: '#EF5350' };
const GRADE_LABEL = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs Work', E: 'Poor' };

const PAY_ICON = {
  paid_on_time: '✅',
  paid_late:    '⚠️',
  missed:       '❌',
  partial:      '🟡',
  pending:      '⏳',
};

const PAY_COLOR = {
  paid_on_time: '#00C853',
  paid_late:    '#FFB300',
  missed:       '#EF5350',
  partial:      '#FFB300',
  pending:      '#666666',
};

// ─────────────────────────────────────────────────────────────────
//  CARD: WELCOME  (onboarding role picker)
// ─────────────────────────────────────────────────────────────────

function buildWelcomeCard() {
  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '28px',
      paddingBottom: '24px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '✦', size: 'sm', color: '#00C853', flex: 0 },
            { type: 'text', text: ' PROMPTRENT', size: 'sm', color: '#00C853', weight: 'bold', flex: 0 },
          ],
        },
        {
          type: 'text',
          text: 'Your Rental',
          size: 'xxl',
          weight: 'bold',
          color: '#FFFFFF',
          margin: '16px',
        },
        {
          type: 'text',
          text: 'Reputation, Built Here.',
          size: 'xxl',
          weight: 'bold',
          color: '#69F0AE',
        },
        {
          type: 'text',
          text: 'Track payments · Build trust · Open doors.',
          size: 'sm',
          color: '#888888',
          margin: '12px',
          wrap: true,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '24px',
      spacing: '16px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          alignItems: 'center',
          contents: [
            { type: 'text', text: 'Who are you?', size: 'lg', weight: 'bold', color: '#FFFFFF', align: 'center' },
            { type: 'text', text: 'Choose your role to get started', size: 'sm', color: '#888888', align: 'center', margin: '4px' },
          ],
        },
        { type: 'separator', color: '#1E331E' },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '🏠  I\'m a Landlord',
            data: 'action=role_landlord',
            displayText: "I'm a Landlord",
          },
          style: 'primary',
          color: '#00C853',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '🙋  I\'m a Tenant',
            data: 'action=role_tenant',
            displayText: "I'm a Tenant",
          },
          style: 'primary',
          color: '#1E331E',
          height: 'sm',
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: TENANT DASHBOARD
// ─────────────────────────────────────────────────────────────────

/**
 * @param {object} user
 * @param {object|null} score   - RenterScore record (or null)
 * @param {object|null} lease   - Active Lease record with .property, .landlord
 * @param {Array}  recentPayments - Last few PaymentRecord rows
 */
function buildTenantDashboard(user, score, lease, recentPayments = []) {
  const firstName = (user.fullName || 'Renter').split(' ')[0];
  const bodyContents = [];

  // ── Score or "building" pill ──────────────────────────────────
  if (score) {
    const color = GRADE_COLOR[score.grade] || '#00C853';
    bodyContents.push({
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#1A2E1A',
      cornerRadius: '12px',
      paddingAll: '16px',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 3,
          contents: [
            { type: 'text', text: 'RENTER SCORE', size: 'xxs', color: '#888888', weight: 'bold' },
            {
              type: 'box',
              layout: 'baseline',
              margin: '4px',
              contents: [
                { type: 'text', text: String(score.score), size: '3xl', weight: 'bold', color, flex: 0 },
                { type: 'text', text: ' /100', size: 'sm', color: '#666666', flex: 0 },
              ],
            },
            { type: 'text', text: GRADE_LABEL[score.grade] || '', size: 'xs', color, margin: '2px' },
          ],
        },
        {
          type: 'box',
          layout: 'vertical',
          flex: 1,
          justifyContent: 'center',
          alignItems: 'flex-end',
          contents: [
            { type: 'text', text: score.grade, size: '4xl', weight: 'bold', color, align: 'end' },
          ],
        },
      ],
    });
  } else if (lease) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1A2E1A',
      cornerRadius: '12px',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '⭐  Building Your Score', size: 'sm', weight: 'bold', color: '#00C853' },
        {
          type: 'text',
          text: 'Pay on time each month to build your rental reputation.',
          size: 'xs',
          color: '#888888',
          wrap: true,
          margin: '6px',
        },
      ],
    });
  } else {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1A2E1A',
      cornerRadius: '12px',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '🔗  No active lease yet', size: 'sm', weight: 'bold', color: '#AAAAAA' },
        {
          type: 'text',
          text: 'Ask your landlord to send you an invite.',
          size: 'xs',
          color: '#666666',
          wrap: true,
          margin: '6px',
        },
      ],
    });
  }

  // ── Lease info ────────────────────────────────────────────────
  if (lease) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: '12px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: '12px',
          contents: [
            { type: 'text', text: '🏠', flex: 0, size: 'sm' },
            {
              type: 'text',
              text: lease.property?.nickname || 'My Property',
              size: 'sm',
              color: '#FFFFFF',
              flex: 2,
              margin: '6px',
              weight: 'bold',
            },
            {
              type: 'text',
              text: `Due ${lease.dueDay}${ordinal(lease.dueDay)}`,
              size: 'xs',
              color: '#888888',
              align: 'end',
            },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          marginTop: '4px',
          contents: [
            { type: 'text', text: '💰', flex: 0, size: 'sm' },
            {
              type: 'text',
              text: `฿${Number(lease.monthlyRent).toLocaleString()}/mo`,
              size: 'sm',
              color: '#AAAAAA',
              margin: '6px',
            },
          ],
        },
      ],
    });
  }

  // ── Recent payments (last 3) ──────────────────────────────────
  if (recentPayments.length > 0) {
    const rows = recentPayments.slice(0, 3).map(p => ({
      type: 'box',
      layout: 'horizontal',
      paddingTop: '8px',
      contents: [
        {
          type: 'text',
          text: `${MONTH[p.periodMonth - 1]} ${p.periodYear}`,
          size: 'xs',
          flex: 2,
          color: '#AAAAAA',
        },
        {
          type: 'text',
          text: `${PAY_ICON[p.paymentStatus] || '❓'} ${p.paymentStatus.replace(/_/g, ' ')}`,
          size: 'xs',
          flex: 3,
          color: PAY_COLOR[p.paymentStatus] || '#666666',
        },
      ],
    }));

    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: '12px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        { type: 'text', text: 'Recent Payments', size: 'xxs', color: '#666666', margin: '12px', weight: 'bold' },
        ...rows,
      ],
    });
  }

  // ── Footer button ─────────────────────────────────────────────
  const footerContents = [];
  if (score) {
    footerContents.push({
      type: 'button',
      action: { type: 'postback', label: 'View Full Score', data: 'action=menu_my_score', displayText: 'My Score' },
      style: 'primary',
      color: '#00C853',
      height: 'sm',
    });
  } else if (lease) {
    footerContents.push({
      type: 'button',
      action: { type: 'postback', label: 'Payment History', data: 'action=menu_my_payments', displayText: 'Payment History' },
      style: 'primary',
      color: '#1E331E',
      height: 'sm',
    });
  }

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: `Hi, ${firstName} 👋`, size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: 'Your renter dashboard', size: 'sm', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '16px',
      contents: bodyContents,
    },
    ...(footerContents.length ? {
      footer: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0D1B0D',
        paddingAll: '16px',
        contents: footerContents,
      },
    } : {}),
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: LANDLORD DASHBOARD
// ─────────────────────────────────────────────────────────────────

/**
 * @param {object} user
 * @param {Array}  leases          - All leases for this landlord
 * @param {Array}  pendingPayments - PaymentRecords needing confirmation
 */
function buildLandlordDashboard(user, leases, pendingPayments = []) {
  const firstName     = (user.fullName || 'Landlord').split(' ')[0];
  const activeLeases  = leases.filter(l => l.status === 'active');
  const pendingLeases = leases.filter(l => l.status === 'pending');

  // ── Stats row ─────────────────────────────────────────────────
  const bodyContents = [
    {
      type: 'box',
      layout: 'horizontal',
      spacing: '8px',
      contents: [
        statBox(String(activeLeases.length), 'Active', '#00C853'),
        statBox(
          String(pendingPayments.length),
          'Pending',
          pendingPayments.length > 0 ? '#FFB300' : '#555555',
          pendingPayments.length > 0,
        ),
        statBox(String(leases.length), 'Total', '#555555'),
      ],
    },
  ];

  // ── Pending confirmations ─────────────────────────────────────
  if (pendingPayments.length > 0) {
    const items = pendingPayments.slice(0, 3).map(p => ({
      type: 'box',
      layout: 'horizontal',
      paddingTop: '10px',
      contents: [
        { type: 'text', text: '⏳', flex: 0, size: 'sm' },
        {
          type: 'text',
          text: p.lease?.tenant?.fullName || 'Tenant',
          size: 'sm',
          color: '#FFFFFF',
          flex: 2,
          margin: '6px',
        },
        {
          type: 'text',
          text: `฿${Number(p.expectedAmount).toLocaleString()}`,
          size: 'sm',
          color: '#FFB300',
          align: 'end',
          weight: 'bold',
        },
      ],
    }));

    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: '16px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        { type: 'text', text: '⚠️  Needs Confirmation', size: 'xs', color: '#FFB300', margin: '12px', weight: 'bold' },
        ...items,
      ],
    });
  }

  // ── Active lease list (up to 3) ───────────────────────────────
  if (activeLeases.length > 0) {
    const rows = activeLeases.slice(0, 3).map(l => ({
      type: 'box',
      layout: 'horizontal',
      paddingTop: '8px',
      contents: [
        { type: 'text', text: '🏠', flex: 0, size: 'sm' },
        {
          type: 'text',
          text: l.property?.nickname || 'Property',
          size: 'sm',
          color: '#FFFFFF',
          flex: 2,
          margin: '6px',
        },
        {
          type: 'text',
          text: l.tenant?.fullName || '—',
          size: 'xs',
          color: '#888888',
          align: 'end',
        },
      ],
    }));

    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      margin: '12px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        { type: 'text', text: 'Active Leases', size: 'xxs', color: '#666666', margin: '12px', weight: 'bold' },
        ...rows,
      ],
    });
  }

  // ── Footer buttons ────────────────────────────────────────────
  const footerContents = [];
  if (pendingPayments.length > 0) {
    footerContents.push({
      type: 'button',
      action: {
        type: 'postback',
        label: `Confirm ${pendingPayments.length} Payment${pendingPayments.length > 1 ? 's' : ''}`,
        data: 'action=menu_collection',
        displayText: 'Collection Status',
      },
      style: 'primary',
      color: '#FFB300',
      height: 'sm',
    });
  }
  footerContents.push({
    type: 'button',
    action: { type: 'postback', label: '+ Add Tenant', data: 'action=menu_add_tenant', displayText: 'Add Tenant' },
    style: 'primary',
    color: pendingPayments.length > 0 ? '#1E331E' : '#00C853',
    height: 'sm',
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: `Hey, ${firstName} 👋`, size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: 'Your rental dashboard', size: 'sm', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '16px',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '16px',
      spacing: '8px',
      contents: footerContents,
    },
  };
}

// Small stat box used inside landlord dashboard
function statBox(value, label, color, highlight = false) {
  return {
    type: 'box',
    layout: 'vertical',
    alignItems: 'center',
    flex: 1,
    backgroundColor: highlight ? '#2E1A0D' : '#1A2E1A',
    cornerRadius: '10px',
    paddingAll: '12px',
    contents: [
      { type: 'text', text: value, size: 'xxl', weight: 'bold', color, align: 'center' },
      { type: 'text', text: label, size: 'xxs', color: '#888888', align: 'center' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: RENTER SCORE  (full view)
// ─────────────────────────────────────────────────────────────────

function buildScoreCard(scoreData) {
  const color = GRADE_COLOR[scoreData.grade] || '#00C853';

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'Renter Score', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        {
          type: 'text',
          text: `Verified · ${scoreData.totalMonths} month${scoreData.totalMonths !== 1 ? 's' : ''} of data`,
          size: 'xs',
          color: '#666666',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '20px',
      contents: [
        // Score + grade row
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#1A2E1A',
          cornerRadius: '14px',
          paddingAll: '20px',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 3,
              contents: [
                { type: 'text', text: 'SCORE', size: 'xxs', color: '#666666', weight: 'bold' },
                {
                  type: 'box',
                  layout: 'baseline',
                  margin: '4px',
                  contents: [
                    { type: 'text', text: String(scoreData.score), size: '3xl', weight: 'bold', color, flex: 0 },
                    { type: 'text', text: ' /100', size: 'sm', color: '#555555', flex: 0 },
                  ],
                },
                { type: 'text', text: GRADE_LABEL[scoreData.grade] || '', size: 'sm', color, weight: 'bold', margin: '4px' },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              justifyContent: 'center',
              alignItems: 'flex-end',
              contents: [
                { type: 'text', text: scoreData.grade, size: '4xl', weight: 'bold', color, align: 'end' },
              ],
            },
          ],
        },
        // Stats row
        {
          type: 'box',
          layout: 'horizontal',
          margin: '16px',
          spacing: '8px',
          contents: [
            miniStat(String(scoreData.onTimeMonths), 'On Time', '#00C853'),
            miniStat(String(scoreData.lateMonths),   'Late',    '#FFB300'),
            miniStat(String(scoreData.missedMonths), 'Missed',  '#EF5350'),
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'postback', label: '🔗 Share This Score', data: 'action=menu_share_score', displayText: 'Share My Score' },
          style: 'primary',
          color,
          height: 'sm',
        },
      ],
    },
  };
}

function miniStat(value, label, color) {
  return {
    type: 'box',
    layout: 'vertical',
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1A2E1A',
    cornerRadius: '10px',
    paddingAll: '12px',
    contents: [
      { type: 'text', text: value, size: 'xl', weight: 'bold', color, align: 'center' },
      { type: 'text', text: label, size: 'xxs', color: '#666666', align: 'center' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: SHARE SCORE  (with CTA link)
// ─────────────────────────────────────────────────────────────────

function buildShareScoreCard(score, shareUrl) {
  const color = GRADE_COLOR[score.grade] || '#00C853';
  const lineShareUrl = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}`;

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'Share Your Score', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: 'Send this link to your prospective landlord', size: 'xs', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '20px',
      contents: [
        // Score preview
        {
          type: 'box',
          layout: 'horizontal',
          backgroundColor: '#1A2E1A',
          cornerRadius: '14px',
          paddingAll: '20px',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 3,
              contents: [
                { type: 'text', text: String(score.score), size: '3xl', weight: 'bold', color },
                { type: 'text', text: '/ 100', size: 'xs', color: '#666666', margin: '2px' },
                { type: 'text', text: score.gradeLabel, size: 'sm', color, weight: 'bold', margin: '8px' },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              flex: 1,
              justifyContent: 'center',
              alignItems: 'flex-end',
              contents: [
                { type: 'text', text: score.grade, size: '4xl', weight: 'bold', color, align: 'end' },
              ],
            },
          ],
        },
        // Summary stats
        {
          type: 'box',
          layout: 'horizontal',
          margin: '16px',
          spacing: '8px',
          contents: [
            miniStat(String(score.onTimeMonths), 'On Time', '#00C853'),
            miniStat(String(score.lateMonths),   'Late',    '#FFB300'),
            miniStat(String(score.missedMonths), 'Missed',  '#EF5350'),
          ],
        },
        {
          type: 'text',
          text: `Verified · ${score.totalMonths} months · Link expires in 7 days`,
          size: 'xxs',
          color: '#555555',
          align: 'center',
          margin: '12px',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '16px',
      spacing: '8px',
      contents: [
        {
          type: 'button',
          action: { type: 'uri', label: '🔗 Open Score Page', uri: shareUrl },
          style: 'primary',
          color,
          height: 'sm',
        },
        {
          type: 'button',
          action: { type: 'uri', label: '📤 Share via LINE', uri: lineShareUrl },
          style: 'primary',
          color: '#1E331E',
          height: 'sm',
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: LEASE DETAILS
// ─────────────────────────────────────────────────────────────────

function buildLeaseCard(lease) {
  const startDate = new Date(lease.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const endDate   = lease.endDate
    ? new Date(lease.endDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : 'Open-ended';
  const statusColor = lease.status === 'active' ? '#00C853' : lease.status === 'pending' ? '#FFB300' : '#666666';
  const statusLabel = lease.status === 'active' ? '🟢 Active' : lease.status === 'pending' ? '🟡 Pending' : '⚫ Ended';

  const row = (label, value, valueColor = '#FFFFFF') => ({
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        paddingTop: '12px',
        paddingBottom: '12px',
        contents: [
          { type: 'text', text: label, size: 'sm', color: '#888888', flex: 1 },
          { type: 'text', text: value, size: 'sm', color: valueColor, align: 'end', weight: 'bold', wrap: true, flex: 2 },
        ],
      },
      { type: 'separator', color: '#1E331E' },
    ],
  });

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: lease.property?.nickname || 'My Lease', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: `Leased from ${lease.landlord?.fullName || 'Landlord'}`, size: 'xs', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '20px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        row('Monthly Rent',   `฿${Number(lease.monthlyRent).toLocaleString()}`),
        row('Due Date',       `${lease.dueDay}${ordinal(lease.dueDay)} of the month`),
        row('Grace Period',   `${lease.gracePeriodDays} day${lease.gracePeriodDays !== 1 ? 's' : ''}`),
        row('Start Date',     startDate),
        row('End Date',       endDate),
        row('Status',         statusLabel, statusColor),
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: COLLECTION STATUS  (landlord)
// ─────────────────────────────────────────────────────────────────

function buildCollectionStatusCard(pendingPayments) {
  if (pendingPayments.length === 0) {
    return {
      type: 'bubble',
      size: 'giga',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0D1B0D',
        paddingAll: '20px',
        contents: [
          { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
          { type: 'text', text: 'Collection Status', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#111811',
        paddingAll: '32px',
        alignItems: 'center',
        contents: [
          { type: 'text', text: '✅', size: '3xl', align: 'center' },
          { type: 'text', text: 'All payments confirmed!', size: 'md', weight: 'bold', color: '#00C853', align: 'center', margin: '12px' },
          { type: 'text', text: 'Nothing pending right now.', size: 'sm', color: '#666666', align: 'center' },
        ],
      },
    };
  }

  const items = pendingPayments.map(p => ({
    type: 'box',
    layout: 'vertical',
    backgroundColor: '#1A2E1A',
    cornerRadius: '10px',
    paddingAll: '14px',
    margin: '8px',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: p.lease?.tenant?.fullName || 'Tenant', size: 'sm', weight: 'bold', color: '#FFFFFF', flex: 2 },
          {
            type: 'text',
            text: `฿${Number(p.expectedAmount).toLocaleString()}`,
            size: 'sm',
            weight: 'bold',
            color: '#FFB300',
            align: 'end',
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: '4px',
        contents: [
          { type: 'text', text: p.lease?.property?.nickname || 'Property', size: 'xs', color: '#666666', flex: 2 },
          {
            type: 'text',
            text: `${MONTH[(p.periodMonth || 1) - 1]} ${p.periodYear}`,
            size: 'xs',
            color: '#666666',
            align: 'end',
          },
        ],
      },
      {
        type: 'box',
        layout: 'horizontal',
        margin: '10px',
        spacing: '8px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '✅ Paid',
              data: `action=confirm_payment&payment_id=${p.id}&status=paid_on_time`,
              displayText: 'Paid on time',
            },
            style: 'primary',
            color: '#00C853',
            height: 'sm',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '⚠️ Late',
              data: `action=confirm_payment&payment_id=${p.id}&status=paid_late`,
              displayText: 'Paid late',
            },
            style: 'primary',
            color: '#1E331E',
            height: 'sm',
            flex: 1,
          },
          {
            type: 'button',
            action: {
              type: 'postback',
              label: '❌ Unpaid',
              data: `action=confirm_payment&payment_id=${p.id}&status=not_paid`,
              displayText: 'Not paid',
            },
            style: 'primary',
            color: '#2E1A0D',
            height: 'sm',
            flex: 1,
          },
        ],
      },
    ],
  }));

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'Pending Confirmations', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        {
          type: 'text',
          text: `${pendingPayments.length} payment${pendingPayments.length > 1 ? 's' : ''} need your response`,
          size: 'xs',
          color: '#FFB300',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '12px',
      contents: items,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: PAYMENT HISTORY LIST
// ─────────────────────────────────────────────────────────────────

function buildPaymentHistoryFlex(payments, propertyNickname) {
  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'Payment History', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: propertyNickname, size: 'xs', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '16px',
      contents: payments.slice(0, 10).map((p, i) => ({
        type: 'box',
        layout: 'horizontal',
        paddingTop: i === 0 ? '0' : '10px',
        paddingBottom: '10px',
        contents: [
          {
            type: 'text',
            text: `${MONTH[p.periodMonth - 1]} ${p.periodYear}`,
            size: 'sm',
            flex: 2,
            color: '#AAAAAA',
          },
          {
            type: 'text',
            text: `${PAY_ICON[p.paymentStatus] || '❓'} ${p.paymentStatus.replace(/_/g, ' ')}`,
            size: 'sm',
            flex: 3,
            color: PAY_COLOR[p.paymentStatus] || '#666666',
          },
          {
            type: 'text',
            text: `฿${Number(p.expectedAmount).toLocaleString()}`,
            size: 'sm',
            flex: 2,
            align: 'end',
            color: '#AAAAAA',
          },
        ],
      })),
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: HELP / HOW IT WORKS
// ─────────────────────────────────────────────────────────────────

function buildHelpCard(role) {
  const isLandlord = role === 'landlord' || role === 'both';

  const steps = isLandlord
    ? [
        { icon: '1️⃣', text: 'Add a property — tap Properties → Add' },
        { icon: '2️⃣', text: 'Add a tenant — share the invite code with them' },
        { icon: '3️⃣', text: 'Confirm rent each month when it arrives' },
        { icon: '4️⃣', text: 'View collection status on your Dashboard' },
      ]
    : [
        { icon: '1️⃣', text: 'Accept your landlord\'s invite to activate the lease' },
        { icon: '2️⃣', text: 'Pay rent on time each month' },
        { icon: '3️⃣', text: 'Your landlord confirms in PromptRent' },
        { icon: '4️⃣', text: 'After 3 months, your Renter Score appears' },
      ];

  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'How it works', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        { type: 'text', text: isLandlord ? 'For Landlords' : 'For Tenants', size: 'xs', color: '#666666' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '20px',
      spacing: '16px',
      contents: steps.map(step => ({
        type: 'box',
        layout: 'horizontal',
        contents: [
          { type: 'text', text: step.icon, flex: 0, size: 'lg' },
          { type: 'text', text: step.text, size: 'sm', color: '#DDDDDD', flex: 1, margin: '10px', wrap: true },
        ],
      })),
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: 'Type "menu" anytime to go back to your dashboard.',
          size: 'xs',
          color: '#555555',
          align: 'center',
          wrap: true,
        },
      ],
    },
  };
}

// ─────────────────────────────────────────────────────────────────
//  CARD: LEASE INVITATION  (tenant receiving invite)
// ─────────────────────────────────────────────────────────────────

function buildInviteCard(lease) {
  return {
    type: 'bubble',
    size: 'giga',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xxs', color: '#00C853', weight: 'bold' },
        { type: 'text', text: 'Lease Invitation', size: 'xl', weight: 'bold', color: '#FFFFFF', margin: '8px' },
        {
          type: 'text',
          text: `From ${lease.landlord?.fullName || 'your landlord'}`,
          size: 'xs',
          color: '#666666',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#111811',
      paddingAll: '20px',
      spacing: '0px',
      contents: [
        { type: 'separator', color: '#1E331E' },
        leaseRow('Property',      lease.property?.nickname || '—'),
        leaseRow('Monthly Rent',  `฿${Number(lease.monthlyRent).toLocaleString()}`),
        leaseRow('Due Date',      `${lease.dueDay}${ordinal(lease.dueDay)} of each month`),
        leaseRow('Start Date',    new Date(lease.startDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })),
        {
          type: 'box',
          layout: 'vertical',
          margin: '16px',
          contents: [
            {
              type: 'text',
              text: '📊 PromptRent tracks your payments and builds your Renter Score after 3 months.',
              size: 'xs',
              color: '#888888',
              wrap: true,
            },
          ],
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#0D1B0D',
      paddingAll: '16px',
      spacing: '8px',
      contents: [
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '✅  Accept Lease',
            data: `action=tenant_accept_lease&lease_id=${lease.id}`,
            displayText: 'Accept Lease',
          },
          style: 'primary',
          color: '#00C853',
          height: 'sm',
        },
        {
          type: 'button',
          action: {
            type: 'postback',
            label: '❌  Decline',
            data: `action=tenant_reject_lease&lease_id=${lease.id}`,
            displayText: 'Decline',
          },
          style: 'primary',
          color: '#1E1E1E',
          height: 'sm',
        },
      ],
    },
  };
}

function leaseRow(label, value) {
  return {
    type: 'box',
    layout: 'vertical',
    contents: [
      {
        type: 'box',
        layout: 'horizontal',
        paddingTop: '12px',
        paddingBottom: '12px',
        contents: [
          { type: 'text', text: label, size: 'sm', color: '#888888', flex: 1 },
          { type: 'text', text: value, size: 'sm', color: '#FFFFFF', align: 'end', weight: 'bold', flex: 2 },
        ],
      },
      { type: 'separator', color: '#1E331E' },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────

module.exports = {
  // Senders
  sendText,
  sendQuickReply,
  sendButtons,
  sendConfirm,
  sendFlex,
  sendMultiple,
  pushText,
  pushQuickReply,
  pushFlex,
  // Message object builders (for sendMultiple)
  textMsg,
  flexMsg,
  // Card builders
  buildWelcomeCard,
  buildTenantDashboard,
  buildLandlordDashboard,
  buildScoreCard,
  buildShareScoreCard,
  buildLeaseCard,
  buildCollectionStatusCard,
  buildPaymentHistoryFlex,
  buildHelpCard,
  buildInviteCard,
  // Utils
  ordinal,
};
