'use strict';

const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// Per-guild spam tracking: key `guildId:userId` → [timestamps]
// Pruned periodically to prevent unbounded growth
const spamMap  = new Map();
const PRUNE_MS = 60_000;
let   _lastPrune = Date.now();

// Per-guild word-filter cache: guildId → { words: Set<string>, ts: number }
const filterCache  = new Map();
const FILTER_TTL   = 30_000;

module.exports = async function automod(msg, app) {
  if (!msg.guild || msg.author.bot || !msg.member) return;

  // Mods bypass automod entirely
  if (msg.member.permissions.has(PermissionFlagsBits.ManageMessages)) return;

  const gid      = msg.guild.id;
  const settings = app.db.prepare('SELECT * FROM automod WHERE guild_id = ?').get(gid)
    ?? { antispam: 1, antiinvite: 1, anticaps: 1, maxmentions: 5 };

  const reasons = [];

  // ── Prune stale spam entries every minute ────────────────────────────────
  if (Date.now() - _lastPrune > PRUNE_MS) {
    const cutoff = Date.now() - 6_000;
    for (const [k, arr] of spamMap) {
      const fresh = arr.filter(t => t > cutoff);
      if (fresh.length) spamMap.set(k, fresh); else spamMap.delete(k);
    }
    _lastPrune = Date.now();
  }

  // ── Anti-spam ────────────────────────────────────────────────────────────
  if (settings.antispam) {
    const key  = `${gid}:${msg.author.id}`;
    const now  = Date.now();
    const list = (spamMap.get(key) || []).filter(t => now - t < 5_000);
    list.push(now);
    spamMap.set(key, list);
    if (list.length >= 6) reasons.push('spam (6+ messages in 5 s)');
  }

  // ── Anti-invite ──────────────────────────────────────────────────────────
  if (settings.antiinvite && /discord\.gg\/|discord\.com\/invite\//i.test(msg.content)) {
    reasons.push('Discord invite link');
  }

  // ── Anti-caps (>75 % uppercase, message >10 chars stripped) ─────────────
  if (settings.anticaps) {
    const stripped = msg.content.replace(/\s/g, '');
    if (stripped.length > 10) {
      const uppers = (stripped.match(/[A-Z]/g) || []).length;
      if (uppers / stripped.length > 0.75) reasons.push('excessive caps');
    }
  }

  // ── Mention spam ─────────────────────────────────────────────────────────
  const mentionCount = msg.mentions.users.size + msg.mentions.roles.size;
  if (settings.maxmentions > 0 && mentionCount > settings.maxmentions) {
    reasons.push(`mention spam (${mentionCount})`);
  }

  // ── Word filter — cached per guild ───────────────────────────────────────
  const cached = filterCache.get(gid);
  let wordSet;
  if (cached && Date.now() - cached.ts < FILTER_TTL) {
    wordSet = cached.words;
  } else {
    const rows = app.db.prepare('SELECT word FROM wordfilter WHERE guild_id = ?').all(gid);
    wordSet = new Set(rows.map(r => r.word));
    filterCache.set(gid, { words: wordSet, ts: Date.now() });
  }

  if (wordSet.size > 0) {
    const normalised = leet(msg.content.toLowerCase());
    for (const w of wordSet) {
      if (normalised.includes(w)) { reasons.push('filtered word'); break; }
    }
  }

  if (!reasons.length) return;

  // ── Enforce ──────────────────────────────────────────────────────────────
  await msg.delete().catch(() => {});

  const logChId = app.cfg.get(gid, 'mod_log');
  if (logChId) {
    const ch = await app.client.channels.fetch(logChId).catch(() => null);
    if (ch) {
      const embed = new EmbedBuilder()
        .setColor(0xe74c3c)
        .setTitle('🤖 AutoMod')
        .addFields(
          { name: 'User',    value: `<@${msg.author.id}> (${msg.author.username})`, inline: true },
          { name: 'Channel', value: `<#${msg.channelId}>`,                          inline: true },
          { name: 'Rule',    value: reasons.join(', ') },
          { name: 'Content', value: msg.content.slice(0, 500) || '*(empty)*' },
        )
        .setTimestamp();
      await ch.send({ embeds: [embed] }).catch(() => {});
    }
  }
};

/** Expose cache invalidation so /filter add/remove can bust it */
module.exports.invalidateFilterCache = (guildId) => filterCache.delete(guildId);

// Leet-speak normalisation
function leet(s) {
  return s
    .replace(/4|@/g, 'a')
    .replace(/3/g,   'e')
    .replace(/1|!/g, 'i')
    .replace(/0/g,   'o')
    .replace(/5|\$/g,'s')
    .replace(/7/g,   't')
    .replace(/8/g,   'b');
}
