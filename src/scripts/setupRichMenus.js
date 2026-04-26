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

/**
 * Generates a 2500×843 placeholder PNG.
 * Dark green cells separated by mint (#00C853) grid lines.
 * Replace with a proper design later via LINE OA Manager.
 */
function buildPlaceholderPNG() {
  const colW = Math.floor(W / 3);
  const rowH = Math.floor(H / 2);
  const rowBytes = 1 + W * 3;
  const raw = Buffer.alloc(H * rowBytes);

  for (let y = 0; y < H; y++) {
    raw[y * rowBytes] = 0; // filter = None
    for (let x = 0; x < W; x++) {
      const p = y * rowBytes + 1 + x * 3;
      const col = Math.floor(x / colW);
      const row = Math.floor(y / rowH);

      const onVGrid  = x === colW - 1 || x === colW || x === colW * 2 - 1 || x === colW * 2;
      const onHGrid  = y === rowH - 1 || y === rowH;
      const onBorder = x === 0 || x === W - 1 || y === 0 || y === H - 1;

      if (onBorder || onVGrid || onHGrid) {
        // Mint grid line: #00C853
        raw[p] = 0; raw[p + 1] = 200; raw[p + 2] = 83;
      } else {
        // Alternating dark green cells
        const bg = (col + row) % 2 === 0 ? [13, 27, 13] : [18, 36, 18];
        raw[p] = bg[0]; raw[p + 1] = bg[1]; raw[p + 2] = bg[2];
      }
    }
  }

  const sig  = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB, no alpha

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 1 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
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
    pb('History',     'action=menu_my_payments', 'Payment History'),
    pb('My Lease',    'action=menu_my_lease',    'My Lease'),
    pb('Share Score', 'action=menu_share_score', 'Share My Score'),
    pb('Dispute',     'action=menu_dispute',     'Dispute a Record'),
    pb('Help',        'action=menu_help',        'Help'),
  ]),
};

// ── Main ──────────────────────────────────────────────────────────
(async () => {
  console.log('\n  🏠  PromptRent — Rich Menu Setup\n');

  try {
    const png = buildPlaceholderPNG();

    process.stdout.write('  Creating landlord menu… ');
    const landlordId = await createRichMenu(LANDLORD_MENU);
    console.log(`✅  ${landlordId}`);

    process.stdout.write('  Uploading landlord image… ');
    await uploadImage(landlordId, png);
    console.log('✅');

    process.stdout.write('  Creating tenant menu…   ');
    const tenantId = await createRichMenu(TENANT_MENU);
    console.log(`✅  ${tenantId}`);

    process.stdout.write('  Uploading tenant image…  ');
    await uploadImage(tenantId, png);
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
