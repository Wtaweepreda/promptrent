#!/usr/bin/env node
// src/scripts/setupRichMenus.js
// One-time setup: creates PromptRent role-based rich menus on LINE and saves IDs.
// Run: npm run setup:richmenu

require('dotenv').config();

const https = require('https');
const zlib  = require('zlib');
const fs    = require('fs');
const path  = require('path');

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('\n  ❌  LINE_CHANNEL_ACCESS_TOKEN not found in environment.');
  console.error('       Run: cp .env.example .env  and fill in your token.\n');
  process.exit(1);
}

const IDS_PATH = path.join(__dirname, '../../.richMenuIds.json');
const W = 2500, H = 843;

// ── PNG generator (pure Node, no external deps) ──────────────────
function crc32(buf) {
  if (!crc32.t) {
    crc32.t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      crc32.t[i] = c;
    }
  }
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = crc32.t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const t   = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

// ── Icon PNG builder ─────────────────────────────────────────────
// Draws a 2500×843 PNG with 6 icon cells (3 cols × 2 rows).
// Colors: bg #0D1B0D, cell #111811, elevated #1A2E1A, mint #00C853, border #1E331E

const C = { bg:[13,27,13], cell:[17,24,17], elev:[26,46,26], mint:[0,200,83], border:[30,51,30], white:[255,255,255], dim:[100,100,100] };

function buildRichMenuPNG(labels) {
  const colW = Math.floor(W / 3);
  const rowH = Math.floor(H / 2);
  const rowBytes = 1 + W * 3;
  const raw = Buffer.alloc(H * rowBytes);

  // Fill background
  for (let y = 0; y < H; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < W; x++) {
      const p = y * rowBytes + 1 + x * 3;
      setPixel(raw, rowBytes, x, y, C.bg);
    }
  }

  // Draw each of the 6 cells
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const cx = col * colW, cy = row * rowH;
      drawCell(raw, rowBytes, cx, cy, colW, rowH, labels[idx], idx);
    }
  }

  // Draw grid lines (mint, 3px)
  for (let i = 1; i < 3; i++) {
    fillRect(raw, rowBytes, i * colW - 1, 0, 3, H, C.border);
  }
  fillRect(raw, rowBytes, 0, rowH - 1, W, 3, C.border);

  const sig  = Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4);
  ihdr[8]=8; ihdr[9]=2;
  return Buffer.concat([sig, pngChunk('IHDR',ihdr), pngChunk('IDAT',zlib.deflateSync(raw,{level:1})), pngChunk('IEND',Buffer.alloc(0))]);
}

function setPixel(raw, rowBytes, x, y, rgb) {
  const p = y * rowBytes + 1 + x * 3;
  raw[p]=rgb[0]; raw[p+1]=rgb[1]; raw[p+2]=rgb[2];
}

function fillRect(raw, rowBytes, x, y, w, h, rgb) {
  for (let dy=0; dy<h; dy++) for (let dx=0; dx<w; dx++) {
    const px=x+dx, py=y+dy;
    if (px>=0&&px<W&&py>=0&&py<H) setPixel(raw,rowBytes,px,py,rgb);
  }
}

function fillCircle(raw, rowBytes, cx, cy, r, rgb) {
  for (let dy=-r; dy<=r; dy++) for (let dx=-r; dx<=r; dx++) {
    if (dx*dx+dy*dy<=r*r) setPixel(raw,rowBytes,cx+dx,cy+dy,rgb);
  }
}

function strokeCircle(raw, rowBytes, cx, cy, r, thickness, rgb) {
  for (let dy=-(r+thickness); dy<=(r+thickness); dy++) for (let dx=-(r+thickness); dx<=(r+thickness); dx++) {
    const d=Math.sqrt(dx*dx+dy*dy);
    if (d>=r&&d<=r+thickness) setPixel(raw,rowBytes,cx+dx,cy+dy,rgb);
  }
}

function drawCell(raw, rowBytes, x, y, w, h, label, idx) {
  // Cell background
  fillRect(raw, rowBytes, x+4, y+4, w-8, h-8, C.cell);

  // Icon circle backdrop
  const icx = x + w/2, icy = y + h/2 - 40;
  fillCircle(raw, rowBytes, icx, icy, 90, C.elev);

  // Draw icon based on index
  drawIcon(raw, rowBytes, icx, icy, idx);

  // Label strip at bottom of cell
  fillRect(raw, rowBytes, x+4, y+h-110, w-8, 100, C.elev);
  // Mint accent line above label
  fillRect(raw, rowBytes, x+60, y+h-115, w-120, 4, C.mint);

  // Draw label text using bitmap font
  drawLabel(raw, rowBytes, x + w/2, y + h - 65, label);
}

function drawIcon(raw, rowBytes, cx, cy, idx) {
  const M = C.mint, W2 = C.white, E = C.elev;
  switch(idx) {
    case 0: // Dashboard — 2×2 grid of squares
      fillRect(raw,rowBytes,cx-55,cy-55,48,48,M);
      fillRect(raw,rowBytes,cx+7,cy-55,48,48,M);
      fillRect(raw,rowBytes,cx-55,cy+7,48,48,[0,150,60]);
      fillRect(raw,rowBytes,cx+7,cy+7,48,48,[0,150,60]);
      break;
    case 1: // Add Tenant / Join Lease — person + key/plus
      fillCircle(raw,rowBytes,cx,cy-30,28,M);
      fillRect(raw,rowBytes,cx-40,cy+10,80,45,M);
      fillRect(raw,rowBytes,cx+30,cy-10,8,50,W2);
      fillRect(raw,rowBytes,cx+10,cy+10,50,8,W2);
      break;
    case 2: // My Lease / Collection — document with lines
      fillRect(raw,rowBytes,cx-40,cy-55,80,110,[30,60,30]);
      fillRect(raw,rowBytes,cx-28,cy-40,55,8,M);
      fillRect(raw,rowBytes,cx-28,cy-20,55,8,M);
      fillRect(raw,rowBytes,cx-28,cy,40,8,M);
      fillRect(raw,rowBytes,cx-28,cy+20,30,8,[0,150,60]);
      break;
    case 3: // History / Properties — clock / house
      strokeCircle(raw,rowBytes,cx,cy,52,8,M);
      fillRect(raw,rowBytes,cx-4,cy-36,8,40,M);
      fillRect(raw,rowBytes,cx,cy-4,30,8,M);
      break;
    case 4: // Share Score / Tenants — star
      drawStar(raw,rowBytes,cx,cy,50,22,M);
      break;
    case 5: // Help — question mark circle
      strokeCircle(raw,rowBytes,cx,cy,52,8,M);
      fillRect(raw,rowBytes,cx-4,cy-20,8,35,M);
      fillCircle(raw,rowBytes,cx,cy+30,7,M);
      break;
  }
}

function drawStar(raw, rowBytes, cx, cy, outerR, innerR, rgb) {
  const points = 5;
  for (let angle = -Math.PI/2; angle < 2*Math.PI-Math.PI/2; angle += Math.PI*2/points) {
    const ox = cx + Math.cos(angle) * outerR, oy = cy + Math.sin(angle) * outerR;
    const ix = cx + Math.cos(angle+Math.PI/points)*innerR, iy = cy + Math.sin(angle+Math.PI/points)*innerR;
    drawThickLine(raw, rowBytes, cx, cy, ox, oy, 6, rgb);
    drawThickLine(raw, rowBytes, ox, oy, ix, iy, 6, rgb);
  }
}

function drawThickLine(raw, rowBytes, x1, y1, x2, y2, thickness, rgb) {
  const dx=x2-x1, dy=y2-y1, steps=Math.max(Math.abs(dx),Math.abs(dy));
  for (let i=0; i<=steps; i++) {
    const x=Math.round(x1+dx*i/steps), y=Math.round(y1+dy*i/steps);
    fillCircle(raw,rowBytes,x,y,thickness/2,rgb);
  }
}

// ── Bitmap font (5×7 per glyph) ─────────────────────────────────
const GLYPHS = {
  ' ':[[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
  'A':[[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'B':[[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  'C':[[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,1]],
  'D':[[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0]],
  'E':[[1,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  'G':[[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[1,0,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,1]],
  'H':[[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'I':[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[1,1,1,1,1]],
  'J':[[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[0,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'K':[[1,0,0,0,1],[1,0,0,1,0],[1,0,1,0,0],[1,1,0,0,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  'L':[[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  'M':[[1,0,0,0,1],[1,1,0,1,1],[1,0,1,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'N':[[1,0,0,0,1],[1,1,0,0,1],[1,0,1,0,1],[1,0,0,1,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1]],
  'O':[[0,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'P':[[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0]],
  'R':[[1,1,1,1,0],[1,0,0,0,1],[1,0,0,0,1],[1,1,1,1,0],[1,0,1,0,0],[1,0,0,1,0],[1,0,0,0,1]],
  'S':[[0,1,1,1,1],[1,0,0,0,0],[1,0,0,0,0],[0,1,1,1,0],[0,0,0,0,1],[0,0,0,0,1],[1,1,1,1,0]],
  'T':[[1,1,1,1,1],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'U':[[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,1,1,0]],
  'V':[[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,1,0,1,0],[0,0,1,0,0]],
  'W':[[1,0,0,0,1],[1,0,0,0,1],[1,0,0,0,1],[1,0,1,0,1],[1,0,1,0,1],[1,1,0,1,1],[1,0,0,0,1]],
  'Y':[[1,0,0,0,1],[1,0,0,0,1],[0,1,0,1,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0],[0,0,1,0,0]],
  'Z':[[1,1,1,1,1],[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[1,1,1,1,1]],
  '/':[[0,0,0,0,1],[0,0,0,1,0],[0,0,1,0,0],[0,1,0,0,0],[1,0,0,0,0],[0,0,0,0,0],[0,0,0,0,0]],
};

function drawLabel(raw, rowBytes, centerX, baseY, text) {
  const scale = 5, gap = 2;
  const chars = text.toUpperCase().split('');
  const totalW = chars.reduce((s,c) => s + (GLYPHS[c] ? 5*scale+gap : 0), 0);
  let sx = Math.round(centerX - totalW/2);
  for (const ch of chars) {
    const g = GLYPHS[ch]; if (!g) { sx += 3*scale; continue; }
    for (let row=0; row<7; row++) for (let col=0; col<5; col++) {
      if (g[row][col]) {
        fillRect(raw,rowBytes,sx+col*scale,baseY+row*scale,scale,scale,C.mint);
      }
    }
    sx += 5*scale + gap;
  }
}

// ── LINE API helpers (native https, no axios needed) ─────────────
function lineRequest(hostname, urlPath, method, body) {
  return new Promise((resolve, reject) => {
    const isBuffer  = Buffer.isBuffer(body);
    const payload   = isBuffer ? body : JSON.stringify(body);
    const opts = {
      hostname, path: urlPath, method,
      headers: {
        Authorization:   `Bearer ${TOKEN}`,
        'Content-Type':  isBuffer ? 'image/png' : 'application/json',
        'Content-Length': isBuffer ? body.length : Buffer.byteLength(payload),
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

// ── Rich menu definitions ─────────────────────────────────────────
const COL = Math.floor(W / 3);
const ROW = Math.floor(H / 2);

function areas(buttons) {
  return buttons.map((action, i) => ({
    bounds: { x: (i % 3) * COL, y: Math.floor(i / 3) * ROW, width: COL, height: ROW },
    action,
  }));
}

const pb = (label, data, displayText) =>
  ({ type: 'postback', label, data, displayText: displayText || label });

const LANDLORD_MENU = {
  size: { width: W, height: H },
  selected: true,
  name: 'PromptRent — Landlord',
  chatBarText: '🏠 Menu',
  areas: areas([
    pb('Dashboard',  'action=menu_dashboard',  'Dashboard'),
    pb('Add Tenant', 'action=menu_add_tenant', 'Add Tenant'),
    pb('Collection', 'action=menu_collection', 'Collection Status'),
    pb('Properties', 'action=menu_properties', 'My Properties'),
    pb('Tenants',    'action=menu_tenants',    'My Tenants'),
    pb('Help',       'action=menu_help',       'Help'),
  ]),
};

const TENANT_MENU = {
  size: { width: W, height: H },
  selected: true,
  name: 'PromptRent — Tenant',
  chatBarText: '⭐ Menu',
  areas: areas([
    pb('My Score',    'action=menu_my_score',    'My Score'),
    pb('Join Lease',  'action=menu_join_lease',  'Join a Lease'),
    pb('My Lease',    'action=menu_my_lease',    'My Lease'),
    pb('History',     'action=menu_my_payments', 'Payment History'),
    pb('Share Score', 'action=menu_share_score', 'Share My Score'),
    pb('Help',        'action=menu_help',        'Help'),
  ]),
};

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n  🏠  PromptRent — Rich Menu Setup\n');

  try {
    const landlordPng = buildRichMenuPNG(['DASHBOARD','ADD TENANT','COLLECTION','PROPERTIES','TENANTS','HELP']);
    const tenantPng   = buildRichMenuPNG(['MY SCORE','JOIN LEASE','MY LEASE','HISTORY','SHARE','HELP']);

    process.stdout.write('  Creating landlord menu… ');
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

    // Set tenant menu as default so all new users see a menu immediately
    process.stdout.write('  Setting default rich menu… ');
    await lineRequest('api.line.me', `/v2/bot/user/all/richmenu/${tenantId}`, 'POST', {});
    console.log('✅');

    const ids = { landlord: landlordId, tenant: tenantId, createdAt: new Date().toISOString() };
    fs.writeFileSync(IDS_PATH, JSON.stringify(ids, null, 2));

    console.log('\n  ✅  IDs saved to .richMenuIds.json');
    console.log('\n  📌  Add to Railway → Variables:');
    console.log(`       RICH_MENU_LANDLORD_ID=${landlordId}`);
    console.log(`       RICH_MENU_TENANT_ID=${tenantId}`);
    console.log('\n  💡  Replace placeholder images: LINE OA Manager → Rich Menus → Edit\n');

  } catch (err) {
    console.error('\n  ❌  Setup failed:', err.message, '\n');
    process.exit(1);
  }
})();
