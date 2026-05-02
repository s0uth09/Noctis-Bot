'use strict';

const { createCanvas, loadImage } = require('canvas');

/**
 * @param {object} opts
 * @param {string} opts.username
 * @param {string} opts.avatarURL
 * @param {number} opts.level
 * @param {number} opts.xp          — XP within the current level
 * @param {number} opts.xpNeeded    — total XP needed to complete this level
 * @param {number} opts.totalXp     — all-time XP (for display)
 * @param {number} opts.rank
 */
async function generateRankCard({ username, avatarURL, level, xp, xpNeeded, totalXp, rank }) {
  const W = 760, H = 210;
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext('2d');

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0f0f23');
  bg.addColorStop(1, '#1a1035');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  const accent = ctx.createLinearGradient(0, 0, 0, H);
  accent.addColorStop(0, '#7c3aed');
  accent.addColorStop(1, '#4f46e5');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 5, H);

  // Avatar
  try {
    const avatar = await loadImage(avatarURL + '?size=128');
    ctx.save();
    ctx.beginPath();
    ctx.arc(105, 105, 65, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(avatar, 40, 40, 130, 130);
    ctx.restore();

    // Avatar ring
    ctx.strokeStyle = '#7c3aed';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(105, 105, 66, 0, Math.PI * 2);
    ctx.stroke();
  } catch {}

  // Username
  ctx.fillStyle = '#f3f4f6';
  ctx.font      = 'bold 28px sans-serif';
  ctx.fillText(username.slice(0, 20), 200, 72);

  // Rank & Level badges
  ctx.fillStyle = 'rgba(124,58,237,0.25)';
  roundRect(ctx, 200, 85, 100, 28, 6); ctx.fill();
  ctx.fillStyle = 'rgba(79,70,229,0.25)';
  roundRect(ctx, 312, 85, 110, 28, 6); ctx.fill();

  ctx.fillStyle = '#a78bfa';
  ctx.font      = '14px sans-serif';
  ctx.fillText(`RANK  #${rank}`, 215, 104);
  ctx.fillText(`LEVEL  ${level}`, 327, 104);

  // XP numbers
  ctx.fillStyle = '#9ca3af';
  ctx.font      = '13px sans-serif';
  ctx.fillText(`${xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP  •  ${totalXp.toLocaleString()} total`, 200, 132);

  // Progress bar track
  const barX = 200, barY = 150, barW = 530, barH = 20, barR = 10;
  ctx.fillStyle = '#1f2937';
  roundRect(ctx, barX, barY, barW, barH, barR); ctx.fill();

  // Progress bar fill
  const pct  = Math.max(0.015, Math.min(1, xp / xpNeeded));
  const fill = ctx.createLinearGradient(barX, 0, barX + barW, 0);
  fill.addColorStop(0, '#7c3aed');
  fill.addColorStop(1, '#818cf8');
  ctx.fillStyle = fill;
  roundRect(ctx, barX, barY, barW * pct, barH, barR); ctx.fill();

  // Glow dot at tip
  if (pct > 0.02) {
    const tipX = barX + barW * pct;
    ctx.fillStyle = '#c4b5fd';
    ctx.beginPath();
    ctx.arc(tipX, barY + barH / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Percentage label
  ctx.fillStyle = '#6b7280';
  ctx.font      = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${Math.round(pct * 100)}%`, barX + barW, barY + barH + 14);
  ctx.textAlign = 'left';

  return canvas.toBuffer('image/png');
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

module.exports = { generateRankCard };
