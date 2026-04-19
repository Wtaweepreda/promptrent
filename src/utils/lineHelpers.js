// src/utils/lineHelpers.js
// Reusable LINE message builders

const client = require('../lineClient');

// ── Basic text reply ─────────────────────────────────────────────
async function sendText(replyToken, text) {
  return client.replyMessage(replyToken, {
    type: 'text',
    text,
  });
}

// ── Text with quick reply buttons ───────────────────────────────
// options: [{ label: 'Yes', data: 'action=yes' }]
async function sendQuickReply(replyToken, text, options) {
  return client.replyMessage(replyToken, {
    type: 'text',
    text,
    quickReply: {
      items: options.map(opt => ({
        type: 'action',
        action: {
          type: 'postback',
          label: opt.label,
          data: opt.data,
          displayText: opt.label,
        },
      })),
    },
  });
}

// ── Buttons template (up to 4 buttons) ──────────────────────────
async function sendButtons(replyToken, { title, text, buttons }) {
  // LINE buttons template requires thumbnailImageUrl or just text
  return client.replyMessage(replyToken, {
    type: 'template',
    altText: text,
    template: {
      type: 'buttons',
      title: title || 'PromptRent',
      text: text.substring(0, title ? 60 : 160), // LINE limit: 60 with title, 160 without
      actions: buttons.map(btn => ({
        type: 'postback',
        label: btn.label.substring(0, 20), // LINE label limit
        data: btn.data,
        displayText: btn.label,
      })),
    },
  });
}

// ── Confirm template (Yes/No) ────────────────────────────────────
async function sendConfirm(replyToken, { text, yesData, noData, yesLabel = 'Yes ✅', noLabel = 'No ❌' }) {
  return client.replyMessage(replyToken, {
    type: 'template',
    altText: text,
    template: {
      type: 'confirm',
      text: text.substring(0, 240),
      actions: [
        { type: 'postback', label: yesLabel, data: yesData, displayText: yesLabel },
        { type: 'postback', label: noLabel, data: noData, displayText: noLabel },
      ],
    },
  });
}

// ── Flex message (rich card) ─────────────────────────────────────
async function sendFlex(replyToken, altText, contents) {
  return client.replyMessage(replyToken, {
    type: 'flex',
    altText,
    contents,
  });
}

// ── Push message (system-triggered, no replyToken) ───────────────
async function pushText(lineUserId, text) {
  return client.pushMessage(lineUserId, {
    type: 'text',
    text,
  });
}

async function pushQuickReply(lineUserId, text, options) {
  return client.pushMessage(lineUserId, {
    type: 'text',
    text,
    quickReply: {
      items: options.map(opt => ({
        type: 'action',
        action: {
          type: 'postback',
          label: opt.label,
          data: opt.data,
          displayText: opt.label,
        },
      })),
    },
  });
}

async function pushFlex(lineUserId, altText, contents) {
  return client.pushMessage(lineUserId, {
    type: 'flex',
    altText,
    contents,
  });
}

// ── Score card flex message ──────────────────────────────────────
function buildScoreCard(scoreData) {
  const gradeColors = {
    A: '#06C755',
    B: '#00A8E8',
    C: '#FF9500',
    D: '#FF6B35',
    E: '#FF3B30',
  };
  const color = gradeColors[scoreData.grade] || '#06C755';

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: color,
      paddingAll: '20px',
      contents: [
        { type: 'text', text: '✦ PROMPTRENT', size: 'xs', color: '#ffffff99', weight: 'bold' },
        { type: 'text', text: 'Renter Score', size: 'xl', color: '#ffffff', weight: 'bold' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                { type: 'text', text: String(scoreData.score), size: '4xl', weight: 'bold', color: color },
                { type: 'text', text: '/ 100', size: 'sm', color: '#999999' },
              ],
            },
            {
              type: 'box',
              layout: 'vertical',
              justifyContent: 'center',
              contents: [
                { type: 'text', text: scoreData.gradeLabel, size: 'lg', weight: 'bold', align: 'end' },
                { type: 'text', text: `Grade ${scoreData.grade}`, size: 'sm', color: '#999999', align: 'end' },
              ],
            },
          ],
        },
        { type: 'separator', margin: '16px' },
        {
          type: 'box',
          layout: 'horizontal',
          margin: '16px',
          contents: [
            {
              type: 'box', layout: 'vertical', alignItems: 'center', flex: 1,
              contents: [
                { type: 'text', text: String(scoreData.onTimeMonths), size: 'xl', weight: 'bold', color: '#06C755' },
                { type: 'text', text: 'On Time', size: 'xs', color: '#666666' },
              ],
            },
            {
              type: 'box', layout: 'vertical', alignItems: 'center', flex: 1,
              contents: [
                { type: 'text', text: String(scoreData.lateMonths), size: 'xl', weight: 'bold', color: '#FF9500' },
                { type: 'text', text: 'Late', size: 'xs', color: '#666666' },
              ],
            },
            {
              type: 'box', layout: 'vertical', alignItems: 'center', flex: 1,
              contents: [
                { type: 'text', text: String(scoreData.missedMonths), size: 'xl', weight: 'bold', color: '#FF3B30' },
                { type: 'text', text: 'Missed', size: 'xs', color: '#666666' },
              ],
            },
          ],
        },
        {
          type: 'text',
          text: `Based on ${scoreData.totalMonths} months of verified data`,
          size: 'xs',
          color: '#999999',
          align: 'center',
          margin: '8px',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          action: { type: 'postback', label: '🔗 Share This Score', data: 'action=menu_share_score' },
          style: 'primary',
          color: color,
        },
      ],
    },
  };
}

// ── Payment history list ─────────────────────────────────────────
function buildPaymentHistoryFlex(payments, propertyNickname) {
  const statusIcon = {
    paid_on_time: '✅',
    paid_late: '⚠️',
    missed: '❌',
    partial: '🟡',
    pending: '⏳',
  };

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return {
    type: 'bubble',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#1a1a2e',
      paddingAll: '16px',
      contents: [
        { type: 'text', text: '📊 Payment History', size: 'md', weight: 'bold', color: '#ffffff' },
        { type: 'text', text: propertyNickname, size: 'sm', color: '#ffffff99' },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: payments.slice(0, 10).map(p => ({
        type: 'box',
        layout: 'horizontal',
        paddingAll: '8px',
        contents: [
          {
            type: 'text',
            text: `${monthNames[p.periodMonth - 1]} ${p.periodYear}`,
            size: 'sm',
            flex: 2,
          },
          {
            type: 'text',
            text: `${statusIcon[p.paymentStatus] || '❓'} ${p.paymentStatus.replace(/_/g, ' ')}`,
            size: 'sm',
            flex: 3,
            color: p.paymentStatus === 'paid_on_time' ? '#06C755' :
                   p.paymentStatus === 'missed' ? '#FF3B30' :
                   p.paymentStatus === 'paid_late' ? '#FF9500' : '#666666',
          },
          {
            type: 'text',
            text: `฿${Number(p.expectedAmount).toLocaleString()}`,
            size: 'sm',
            flex: 2,
            align: 'end',
          },
        ],
      })),
    },
  };
}

module.exports = {
  sendText,
  sendQuickReply,
  sendButtons,
  sendConfirm,
  sendFlex,
  pushText,
  pushQuickReply,
  pushFlex,
  buildScoreCard,
  buildPaymentHistoryFlex,
};
