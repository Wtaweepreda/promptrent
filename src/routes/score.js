// src/routes/score.js
// Public endpoint for score share links

const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /score/:token  — returns score data for share page
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const shareToken = await db.shareToken.findUnique({
      where: { token },
      include: {
        tenant: { select: { fullName: true } },
        lease: {
          include: {
            property: { select: { nickname: true, province: true } },
          },
        },
      },
    });

    if (!shareToken) {
      return res.status(404).json({ error: 'Score link not found' });
    }

    if (new Date() > shareToken.expiresAt) {
      return res.status(410).json({ error: 'This score link has expired' });
    }

    // Update access stats
    await db.shareToken.update({
      where: { token },
      data: {
        accessedAt: new Date(),
        accessCount: { increment: 1 },
      },
    });

    // Get the actual score
    const score = await db.renterScore.findUnique({
      where: {
        tenantId_leaseId: {
          tenantId: shareToken.tenantId,
          leaseId: shareToken.leaseId,
        },
      },
    });

    if (!score) {
      return res.status(404).json({ error: 'Score not yet available' });
    }

    // Return score card data
    res.json({
      tenantName: shareToken.tenant.fullName,
      property: shareToken.lease.property.nickname,
      score: score.score,
      grade: score.grade,
      gradeLabel: score.gradeLabel,
      totalMonths: score.totalMonths,
      onTimeMonths: score.onTimeMonths,
      lateMonths: score.lateMonths,
      missedMonths: score.missedMonths,
      computedAt: score.computedAt,
      expiresAt: shareToken.expiresAt,
    });
  } catch (err) {
    console.error('Score route error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /score/view/:token — HTML score card page
router.get('/view/:token', async (req, res) => {
  const { token } = req.params;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PromptRent Score</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, sans-serif; background: #f5f7ff; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .card { background: white; border-radius: 20px; padding: 32px; max-width: 380px; width: 100%; box-shadow: 0 8px 32px rgba(0,0,0,0.1); }
    .logo { font-size: 14px; color: #06c755; font-weight: 700; letter-spacing: 1px; margin-bottom: 24px; }
    .name { font-size: 22px; font-weight: 700; color: #1a1a2e; margin-bottom: 4px; }
    .property { font-size: 14px; color: #666; margin-bottom: 28px; }
    .score-circle { width: 120px; height: 120px; border-radius: 50%; background: linear-gradient(135deg, #06c755, #00a8e8); display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 0 auto 24px; }
    .score-num { font-size: 40px; font-weight: 800; color: white; line-height: 1; }
    .score-max { font-size: 14px; color: rgba(255,255,255,0.8); }
    .grade-label { text-align: center; font-size: 18px; font-weight: 600; color: #1a1a2e; margin-bottom: 24px; }
    .stats { background: #f8f9ff; border-radius: 12px; padding: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px; }
    .stat { text-align: center; }
    .stat-num { font-size: 24px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #666; margin-top: 2px; }
    .on-time { color: #06c755; }
    .late { color: #ff9500; }
    .missed { color: #ff3b30; }
    .footer { font-size: 12px; color: #999; text-align: center; }
    .loading { text-align: center; color: #666; padding: 40px 0; }
  </style>
</head>
<body>
  <div class="card" id="card">
    <div class="loading">Loading score...</div>
  </div>
  <script>
    fetch('/score/${token}')
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          document.getElementById('card').innerHTML = '<div class="loading">' + d.error + '</div>';
          return;
        }
        const gradeColors = { A: '#06c755', B: '#00a8e8', C: '#ff9500', D: '#ff6b35', E: '#ff3b30' };
        const color = gradeColors[d.grade] || '#06c755';
        document.getElementById('card').innerHTML = \`
          <div class="logo">✦ PROMPTRENT</div>
          <div class="name">\${d.tenantName}</div>
          <div class="property">🏠 \${d.property}</div>
          <div class="score-circle" style="background: linear-gradient(135deg, \${color}, \${color}99)">
            <div class="score-num">\${d.score}</div>
            <div class="score-max">/ 100</div>
          </div>
          <div class="grade-label">\${['A','B'].includes(d.grade) ? '⭐' : ''} \${d.gradeLabel}</div>
          <div class="stats">
            <div class="stat"><div class="stat-num on-time">\${d.onTimeMonths}</div><div class="stat-label">On Time</div></div>
            <div class="stat"><div class="stat-num late">\${d.lateMonths}</div><div class="stat-label">Late</div></div>
            <div class="stat"><div class="stat-num missed">\${d.missedMonths}</div><div class="stat-label">Missed</div></div>
          </div>
          <div class="stat-label" style="text-align:center; margin-bottom:12px">Based on \${d.totalMonths} months of verified data</div>
          <div class="footer">Verified by PromptRent · Expires \${new Date(d.expiresAt).toLocaleDateString()}</div>
        \`;
      })
      .catch(() => {
        document.getElementById('card').innerHTML = '<div class="loading">Unable to load score.</div>';
      });
  </script>
</body>
</html>`;

  res.send(html);
});

module.exports = router;
