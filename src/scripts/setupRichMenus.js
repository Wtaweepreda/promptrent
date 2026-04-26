#!/usr/bin/env node
// src/scripts/setupRichMenus.js
// One-time setup: creates PromptRent role-based rich menus on LINE and saves IDs.
// Run: npm run setup:richmenu

require('dotenv').config();

const https = require('https');
const fs    = require('fs');
const path  = require('path');

let createCanvas;
try {
  ({ createCanvas } = require('@napi-rs/canvas'));
} catch {
  console.error('\n  ❌  @napi-rs/canvas not installed. Run: npm install @napi-rs/canvas\n');
  process.exit(1);
}

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('\n  ❌  LINE_CHANNEL_ACCESS_TOKEN not found in environment.');
  process.exit(1);
}

const IDS_PATH = path.join(__dirname, '../../.richMenuIds.json');

// ── Canvas dimensions ──────────────────────────────────────────────
const W = 2500, H = 843;
const COLS = 3, ROWS = 2;
const CW = Math.floor(W / COLS);   // 833 per cell
const CH = Math.floor(H / ROWS);   // 421 per cell

// ── Design tokens ──────────────────────────────────────────────────
const BG_COLOR      = '#0A150A';
const CELL_BG       = '#0E1A0E';
const BORDER_COLOR  = '#1A3A1A';
const LABEL_COLOR   = '#FFFFFF';
const LABEL_STRIP   = '#091509';

// ── Cell definitions ──────────────────────────────────────────────
const LANDLORD_CELLS = [
  { type: 'barchart',   accent: '#1565C0', glow: '#4FC3F7', label: 'DASHBOARD'  },
  { type: 'house',      accent: '#1B5E20', glow: '#69F0AE', label: 'PROPERTIES' },
  { type: 'coins',      accent: '#E65100', glow: '#FFD54F', label: 'COLLECTION' },
  { type: 'twopersons', accent: '#4A148C', glow: '#CE93D8', label: 'TENANTS'    },
  { type: 'personplus', accent: '#004D40', glow: '#64FFDA', label: 'ADD TENANT' },
  { type: 'person',     accent: '#263238', glow: '#90A4AE', label: 'PROFILE'    },
];

const TENANT_CELLS = [
  { type: 'key',      accent: '#BF360C', glow: '#FF8A65', label: 'MY LEASE'    },
  { type: 'star',     accent: '#33691E', glow: '#CCFF90', label: 'MY SCORE'    },
  { type: 'card',     accent: '#1B5E20', glow: '#69F0AE', label: 'PAY RENT'    },
  { type: 'clock',    accent: '#1A237E', glow: '#82B1FF', label: 'HISTORY'     },
  { type: 'pencil',   accent: '#4A148C', glow: '#EA80FC', label: 'CREATE LEASE'},
  { type: 'person',   accent: '#263238', glow: '#90A4AE', label: 'PROFILE'     },
];

// ── Build the full 2500×843 PNG ────────────────────────────────────
function buildRichMenuPNG(cells) {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, W, H);

  cells.forEach((cell, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    drawCell(ctx, col * CW, row * CH, CW, CH, cell);
  });

  // Grid lines
  ctx.strokeStyle = BORDER_COLOR;
  ctx.lineWidth   = 4;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath(); ctx.moveTo(c * CW, 0); ctx.lineTo(c * CW, H); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(0, CH); ctx.lineTo(W, CH); ctx.stroke();

  return canvas.toBuffer('image/png');
}

function drawCell(ctx, x, y, w, h, { type, accent, glow, label }) {
  const cx = x + w / 2;

  // Cell background
  ctx.fillStyle = CELL_BG;
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4);

  // ── Accent circle ──────────────────────────────────────────────
  const circleR = Math.round(h * 0.315);   // 132 px at H=421
  const circleY = Math.round(y + h * 0.39); // slightly above centre

  // Outer soft glow ring
  const grd = ctx.createRadialGradient(cx, circleY, circleR * 0.7, cx, circleY, circleR * 1.35);
  grd.addColorStop(0, accent + 'AA');
  grd.addColorStop(1, accent + '00');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, circleY, circleR * 1.35, 0, Math.PI * 2);
  ctx.fill();

  // Solid circle
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.arc(cx, circleY, circleR, 0, Math.PI * 2);
  ctx.fill();

  // Crisp glow ring
  ctx.strokeStyle = glow;
  ctx.lineWidth   = 7;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(cx, circleY, circleR + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // ── Vector icon ────────────────────────────────────────────────
  const iconR = circleR * 0.58;   // icon fits inside circle
  ctx.save();
  drawIcon(ctx, type, cx, circleY, iconR, glow);
  ctx.restore();

  // ── Label strip ────────────────────────────────────────────────
  const stripH = Math.round(h * 0.215);
  const stripY = y + h - stripH;

  ctx.fillStyle = LABEL_STRIP;
  ctx.fillRect(x + 2, stripY, w - 4, stripH);

  // Glow accent line above strip
  ctx.strokeStyle = glow;
  ctx.lineWidth   = 4;
  ctx.globalAlpha = 0.75;
  ctx.beginPath();
  ctx.moveTo(x + 60, stripY);
  ctx.lineTo(x + w - 60, stripY);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Label text
  const fontSize = Math.round(h * 0.088);
  ctx.font        = `bold ${fontSize}px sans-serif`;
  ctx.textAlign   = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle    = LABEL_COLOR;
  ctx.shadowColor  = glow;
  ctx.shadowBlur   = 18;
  ctx.fillText(label, cx, stripY + stripH / 2 + 2);
  ctx.shadowBlur = 0;
}

// ── Vector icon library ────────────────────────────────────────────
// All icons drawn centered at (cx, cy) with half-radius r.
// Color = glow color (bright accent).

function drawIcon(ctx, type, cx, cy, r, color) {
  ctx.fillStyle   = color;
  ctx.strokeStyle = color;
  ctx.lineWidth   = Math.max(r * 0.13, 6);
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';

  switch (type) {
    case 'barchart':   iconBarChart(ctx, cx, cy, r, color);    break;
    case 'house':      iconHouse(ctx, cx, cy, r, color);       break;
    case 'coins':      iconCoins(ctx, cx, cy, r, color);       break;
    case 'twopersons': iconTwoPersons(ctx, cx, cy, r, color);  break;
    case 'personplus': iconPersonPlus(ctx, cx, cy, r, color);  break;
    case 'person':     iconPerson(ctx, cx, cy, r, color);      break;
    case 'key':        iconKey(ctx, cx, cy, r, color);         break;
    case 'star':       iconStar(ctx, cx, cy, r, color);        break;
    case 'card':       iconCard(ctx, cx, cy, r, color);        break;
    case 'clock':      iconClock(ctx, cx, cy, r, color);       break;
    case 'pencil':     iconPencil(ctx, cx, cy, r, color);      break;
    default: break;
  }
}

// ── Bar chart (Dashboard) ──────────────────────────────────────────
function iconBarChart(ctx, cx, cy, r, color) {
  const bw  = r * 0.28;
  const gap = r * 0.14;
  const baseY = cy + r * 0.62;
  const heights = [r * 0.75, r * 1.1, r * 0.55];
  const startX  = cx - bw * 1.5 - gap;

  heights.forEach((h, i) => {
    const bx = startX + i * (bw + gap);
    ctx.beginPath();
    // rounded top
    const rr = bw * 0.25;
    ctx.moveTo(bx + rr, baseY - h);
    ctx.lineTo(bx + bw - rr, baseY - h);
    ctx.arc(bx + bw - rr, baseY - h + rr, rr, -Math.PI / 2, 0);
    ctx.lineTo(bx + bw, baseY);
    ctx.lineTo(bx, baseY);
    ctx.arc(bx + rr, baseY - h + rr, rr, Math.PI, -Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();
  });

  // baseline
  ctx.fillRect(cx - r * 0.88, baseY + 2, r * 1.76, Math.max(r * 0.09, 5));
}

// ── House (Properties) ────────────────────────────────────────────
function iconHouse(ctx, cx, cy, r, color) {
  // Roof
  ctx.beginPath();
  ctx.moveTo(cx, cy - r * 1.0);
  ctx.lineTo(cx + r * 0.95, cy - r * 0.15);
  ctx.lineTo(cx - r * 0.95, cy - r * 0.15);
  ctx.closePath();
  ctx.fill();

  // Walls
  ctx.fillRect(cx - r * 0.72, cy - r * 0.18, r * 1.44, r * 1.12);

  // Door (dark cutout)
  const dw = r * 0.38, dh = r * 0.58;
  ctx.fillStyle = '#0A150A';
  ctx.fillRect(cx - dw / 2, cy + r * 0.94 - dh, dw, dh);
}

// ── Coins stack (Collection) ───────────────────────────────────────
function iconCoins(ctx, cx, cy, r, color) {
  const coinR = r * 0.46;
  const overlap = coinR * 0.52;

  // Stack of 3 coins (back to front)
  [[cx, cy - overlap * 1.9], [cx, cy - overlap * 0.95], [cx, cy]].forEach(([x, y], i) => {
    // Coin body (ellipse)
    ctx.beginPath();
    ctx.ellipse(x, y, coinR, coinR * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    // Coin edge (3D effect)
    if (i < 2) {
      ctx.beginPath();
      ctx.ellipse(x, y + coinR * 0.28, coinR, coinR * 0.28, 0, 0, Math.PI);
      ctx.fill();
    }
  });

  // Dollar sign on top coin
  ctx.fillStyle = '#0A150A';
  ctx.font = `bold ${Math.round(r * 0.52)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy - coinR * 0.06);
}

// ── Two persons (Tenants) ─────────────────────────────────────────
function iconTwoPersons(ctx, cx, cy, r, color) {
  // Back person
  ctx.globalAlpha = 0.7;
  const bx = cx - r * 0.28;
  ctx.beginPath();
  ctx.arc(bx, cy - r * 0.42, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(bx, cy + r * 0.72, r * 0.58, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Front person
  const fx = cx + r * 0.22;
  ctx.beginPath();
  ctx.arc(fx, cy - r * 0.42, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(fx, cy + r * 0.72, r * 0.66, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

// ── Person + plus (Add Tenant) ────────────────────────────────────
function iconPersonPlus(ctx, cx, cy, r, color) {
  // Person (shifted left)
  const px = cx - r * 0.18;
  ctx.beginPath();
  ctx.arc(px, cy - r * 0.42, r * 0.30, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(px, cy + r * 0.72, r * 0.60, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Plus sign (top right)
  const ox = cx + r * 0.52, oy = cy - r * 0.38;
  const pl = r * 0.52, pw = r * 0.15;
  ctx.fillRect(ox - pl / 2, oy - pw / 2, pl, pw);
  ctx.fillRect(ox - pw / 2, oy - pl / 2, pw, pl);
}

// ── Single person (Profile) ───────────────────────────────────────
function iconPerson(ctx, cx, cy, r, color) {
  ctx.beginPath();
  ctx.arc(cx, cy - r * 0.38, r * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.72, r * 0.72, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}

// ── Key (My Lease) ────────────────────────────────────────────────
function iconKey(ctx, cx, cy, r, color) {
  // Bow (ring)
  const bowR  = r * 0.42;
  const bowCx = cx - r * 0.28;
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.arc(bowCx, cy, bowR, 0, Math.PI * 2);
  ctx.stroke();

  // Stem
  const stemStart = bowCx + bowR * 0.72;
  const stemEnd   = cx + r * 0.95;
  const stemW     = r * 0.19;
  ctx.fillRect(stemStart, cy - stemW / 2, stemEnd - stemStart, stemW);

  // Teeth
  ctx.fillRect(stemEnd - r * 0.28, cy + stemW / 2, r * 0.16, r * 0.28);
  ctx.fillRect(stemEnd - r * 0.52, cy + stemW / 2, r * 0.16, r * 0.22);
}

// ── Star (My Score) ───────────────────────────────────────────────
function iconStar(ctx, cx, cy, r, color) {
  const outerR = r * 0.95;
  const innerR = r * 0.40;
  const pts    = 5;

  ctx.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const angle  = (i * Math.PI) / pts - Math.PI / 2;
    const radius = i % 2 === 0 ? outerR : innerR;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

// ── Credit card (Pay Rent) ────────────────────────────────────────
function iconCard(ctx, cx, cy, r, color) {
  const cw = r * 1.7, ch = r * 1.1;
  const rx = cx - cw / 2, ry = cy - ch / 2;
  const rad = r * 0.12;

  // Card outline
  ctx.lineWidth = r * 0.12;
  ctx.beginPath();
  roundRectPath(ctx, rx, ry, cw, ch, rad);
  ctx.stroke();

  // Magnetic stripe
  ctx.fillRect(rx, ry + ch * 0.22, cw, ch * 0.24);

  // Chip (rounded rect)
  const chipW = cw * 0.26, chipH = ch * 0.38;
  const chipX = rx + cw * 0.1, chipY = ry + ch * 0.56;
  ctx.lineWidth = r * 0.09;
  ctx.beginPath();
  roundRectPath(ctx, chipX, chipY, chipW, chipH, rad * 0.5);
  ctx.stroke();
}

// ── Clock (History) ───────────────────────────────────────────────
function iconClock(ctx, cx, cy, r, color) {
  ctx.lineWidth = r * 0.16;

  // Face
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.stroke();

  // Hour markers (4 dots at 12/3/6/9)
  [0, Math.PI / 2, Math.PI, Math.PI * 1.5].forEach(a => {
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a - Math.PI / 2) * r * 0.68, cy + Math.sin(a - Math.PI / 2) * r * 0.68, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  });

  // Hour hand
  ctx.lineWidth = r * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(-Math.PI * 0.5 + Math.PI * 0.5) * r * 0.48,
             cy + Math.sin(-Math.PI * 0.5 + Math.PI * 0.5) * r * 0.48);
  ctx.stroke();

  // Minute hand (pointing ~10 o'clock)
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(-Math.PI * 0.75) * r * 0.72,
             cy + Math.sin(-Math.PI * 0.75) * r * 0.72);
  ctx.stroke();

  // Center
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
}

// ── Pencil (Create Lease) ─────────────────────────────────────────
function iconPencil(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI * 0.22);

  const bw = r * 0.34;  // body width
  const bh = r * 1.4;   // body height

  // Body
  ctx.fillRect(-bw / 2, -bh * 0.5, bw, bh * 0.72);

  // Tip triangle
  ctx.beginPath();
  ctx.moveTo(-bw / 2, bh * 0.22);
  ctx.lineTo(bw / 2, bh * 0.22);
  ctx.lineTo(0, bh * 0.52);
  ctx.closePath();
  ctx.fill();

  // Lead tip (dark point)
  ctx.fillStyle = '#0A150A';
  ctx.beginPath();
  ctx.moveTo(-bw * 0.18, bh * 0.40);
  ctx.lineTo(bw * 0.18, bh * 0.40);
  ctx.lineTo(0, bh * 0.52);
  ctx.closePath();
  ctx.fill();

  // Eraser cap
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(-bw / 2, -bh * 0.5, bw, bh * 0.11);
  ctx.globalAlpha = 1.0;

  // Eraser band (darker line)
  ctx.fillStyle = '#0A150A';
  ctx.globalAlpha = 0.5;
  ctx.fillRect(-bw / 2, -bh * 0.5 + bh * 0.11, bw, bh * 0.04);
  ctx.globalAlpha = 1.0;

  ctx.restore();
}

// ── Path helper ────────────────────────────────────────────────────
function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + w, y + h - r);
  ctx.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2);
  ctx.closePath();
}

// ── LINE API helpers ───────────────────────────────────────────────
function lineRequest(hostname, urlPath, method, body) {
  return new Promise((resolve, reject) => {
    const isBuffer = Buffer.isBuffer(body);
    const payload  = isBuffer ? body : Buffer.from(JSON.stringify(body));
    const opts = {
      hostname,
      path:    urlPath,
      method,
      headers: {
        Authorization:    `Bearer ${TOKEN}`,
        'Content-Type':   isBuffer ? 'image/png' : 'application/json',
        'Content-Length': payload.length,
      },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(text)); } catch { resolve({}); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${text}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function createRichMenu(menu) {
  const res = await lineRequest('api.line.me', '/v2/bot/richmenu', 'POST', menu);
  return res.richMenuId;
}

async function uploadImage(richMenuId, pngBuffer) {
  return lineRequest('api-data.line.me', `/v2/bot/richmenu/${richMenuId}/content`, 'POST', pngBuffer);
}

async function deleteRichMenu(id) {
  try { await lineRequest('api.line.me', `/v2/bot/richmenu/${id}`, 'DELETE', Buffer.alloc(0)); }
  catch (_) { /* ignore */ }
}

// ── Rich menu definitions ──────────────────────────────────────────
function areas(buttons) {
  return buttons.map((action, i) => ({
    bounds: { x: (i % 3) * CW, y: Math.floor(i / 3) * CH, width: CW, height: CH },
    action,
  }));
}

const pb = (label, data, displayText) =>
  ({ type: 'postback', label, data, displayText: displayText || label });

const LANDLORD_MENU = {
  size: { width: W, height: H }, selected: true,
  name: 'PromptRent — Landlord', chatBarText: '🏠 Menu',
  areas: areas([
    pb('Dashboard',  'action=menu_dashboard',  'Dashboard'),
    pb('Properties', 'action=menu_properties', 'My Properties'),
    pb('Collection', 'action=menu_collection', 'Collection'),
    pb('Tenants',    'action=menu_tenants',    'My Tenants'),
    pb('Add Tenant', 'action=menu_add_tenant', 'Add Tenant'),
    pb('Profile',    'action=menu_profile',    'My Profile'),
  ]),
};

const TENANT_MENU = {
  size: { width: W, height: H }, selected: true,
  name: 'PromptRent — Tenant', chatBarText: '🔑 Menu',
  areas: areas([
    pb('My Lease',     'action=menu_my_lease',     'My Lease'),
    pb('My Score',     'action=menu_my_score',     'My Score'),
    pb('Pay Rent',     'action=menu_pay_rent',     'Pay Rent'),
    pb('History',      'action=menu_my_payments',  'Payment History'),
    pb('Create Lease', 'action=menu_create_lease', 'Create Lease'),
    pb('Profile',      'action=menu_profile',      'My Profile'),
  ]),
};

// ── Main ───────────────────────────────────────────────────────────
(async () => {
  console.log('\n  🏠  PromptRent — Rich Menu Setup  (vector icons)\n');

  try {
    // Remove old menus
    if (fs.existsSync(IDS_PATH)) {
      const old = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
      if (old.landlord || old.tenant) {
        process.stdout.write('  Removing old menus… ');
        if (old.landlord) await deleteRichMenu(old.landlord);
        if (old.tenant)   await deleteRichMenu(old.tenant);
        console.log('✅');
      }
    }

    process.stdout.write('  Rendering landlord image… ');
    const landlordPng = buildRichMenuPNG(LANDLORD_CELLS);
    console.log(`✅  (${Math.round(landlordPng.length / 1024)} KB)`);

    process.stdout.write('  Rendering tenant image…   ');
    const tenantPng = buildRichMenuPNG(TENANT_CELLS);
    console.log(`✅  (${Math.round(tenantPng.length / 1024)} KB)`);

    // Save local previews
    fs.writeFileSync(path.join(__dirname, '../../.landlordMenu.png'), landlordPng);
    fs.writeFileSync(path.join(__dirname, '../../.tenantMenu.png'),   tenantPng);
    console.log('  💾  Preview saved → .landlordMenu.png  /  .tenantMenu.png');

    process.stdout.write('\n  Creating landlord menu… ');
    const landlordId = await createRichMenu(LANDLORD_MENU);
    console.log(`✅  ${landlordId}`);

    process.stdout.write('  Uploading landlord image… ');
    await uploadImage(landlordId, landlordPng);
    console.log('✅');

    process.stdout.write('  Creating tenant menu…   ');
    const tenantId = await createRichMenu(TENANT_MENU);
    console.log(`✅  ${tenantId}`);

    process.stdout.write('  Uploading tenant image…  ');
    await uploadImage(tenantId, tenantPng);
    console.log('✅');

    process.stdout.write('  Setting default rich menu… ');
    await lineRequest('api.line.me', `/v2/bot/user/all/richmenu/${tenantId}`, 'POST', Buffer.alloc(0));
    console.log('✅');

    const ids = { landlord: landlordId, tenant: tenantId, createdAt: new Date().toISOString() };
    fs.writeFileSync(IDS_PATH, JSON.stringify(ids, null, 2));

    console.log('\n  ✅  Done!\n');
    console.log('  📌  Add to Railway → Variables:');
    console.log(`       RICH_MENU_LANDLORD_ID=${landlordId}`);
    console.log(`       RICH_MENU_TENANT_ID=${tenantId}\n`);

  } catch (err) {
    console.error('\n  ❌  Setup failed:', err.message, '\n');
    process.exit(1);
  }
})();
