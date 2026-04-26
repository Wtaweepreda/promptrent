// src/services/richMenuService.js
// Manages per-user rich menu assignment based on role.

const client = require('../lineClient');
const fs     = require('fs');
const path   = require('path');

const IDS_PATH = path.join(__dirname, '../../.richMenuIds.json');

function loadIds() {
  // Production: env vars (Railway)
  if (process.env.RICH_MENU_LANDLORD_ID && process.env.RICH_MENU_TENANT_ID) {
    return {
      landlord: process.env.RICH_MENU_LANDLORD_ID,
      tenant:   process.env.RICH_MENU_TENANT_ID,
    };
  }
  // Dev: local JSON written by setupRichMenus.js
  try {
    return JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Assign the correct role-based rich menu to a LINE user.
 * Silently no-ops if menus haven't been set up yet.
 */
async function assignRichMenu(lineUserId, role) {
  const ids = loadIds();
  if (!ids) {
    console.log('[richMenu] Not configured — run: npm run setup:richmenu');
    return;
  }

  const menuId = (role === 'landlord' || role === 'both') ? ids.landlord : ids.tenant;
  if (!menuId) return;

  try {
    await client.linkRichMenuToUser(lineUserId, menuId);
    console.log(`[richMenu] Assigned ${role} menu → ${lineUserId.substring(0, 12)}…`);
  } catch (err) {
    // Non-fatal — bot still works without the rich menu
    console.error('[richMenu] Assignment failed:', err.message);
  }
}

module.exports = { assignRichMenu };
