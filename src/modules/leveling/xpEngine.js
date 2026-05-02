'use strict';

// In-process cooldown: `guildId:userId` → expiresAt timestamp
const cooldowns = new Map();

// Per-guild XP config cache (avoids 2 DB reads per message)
const xpConfigCache = new Map();
const XP_CFG_TTL = 120_000; // 2 minutes

function getXpConfig(guildId, app) {
  const cached = xpConfigCache.get(guildId);
  if (cached && Date.now() - cached.ts < XP_CFG_TTL) return cached;

  const cooldownMs = parseInt(app.cfg.get(guildId, 'xp_cooldown') || '60000');
  const xpGain     = parseInt(app.cfg.get(guildId, 'xp_rate')     || '15');
  const entry      = { cooldownMs, xpGain, ts: Date.now() };
  xpConfigCache.set(guildId, entry);
  return entry;
}

// XP formula: Mee6-compatible — xpForLevel(n) = 5*(n^2) + 50*n + 100
// so total XP to reach level n = sum_{k=0}^{n-1} xpForLevel(k)
function xpForLevel(n) { return 5 * n * n + 50 * n + 100; }

// Total XP required to reach level n from level 0
function totalXpForLevel(n) {
  let total = 0;
  for (let k = 0; k < n; k++) total += xpForLevel(k);
  return total;
}

function levelFromXp(xp) {
  let level = 0;
  while (totalXpForLevel(level + 1) <= xp) level++;
  return level;
}

module.exports = async function xpEngine(msg, app) {
  if (!msg.guild || msg.author.bot) return;
  if (!msg.content || msg.content.length < 5) return;

  const gid = msg.guild.id;
  const uid = msg.author.id;
  const key = `${gid}:${uid}`;

  const { cooldownMs, xpGain } = getXpConfig(gid, app);

  const now  = Date.now();
  const last = cooldowns.get(key) ?? 0;
  if (now - last < cooldownMs) return;
  cooldowns.set(key, now);

  const row    = app.db.prepare('SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?')
    .get(gid, uid) ?? { xp: 0, level: 0 };

  const newXp    = row.xp + xpGain;
  const newLevel = levelFromXp(newXp);

  app.db.prepare(`
    INSERT INTO levels (guild_id, user_id, xp, level) VALUES (?, ?, ?, ?)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = excluded.xp, level = excluded.level
  `).run(gid, uid, newXp, newLevel);

  if (newLevel > row.level) {
    await handleLevelUp(msg, gid, uid, newLevel, app);
  }
};

module.exports.xpForLevel     = xpForLevel;
module.exports.totalXpForLevel = totalXpForLevel;
module.exports.levelFromXp    = levelFromXp;
// Allow config commands to bust the XP config cache
module.exports.invalidateXpConfig = (guildId) => xpConfigCache.delete(guildId);

async function handleLevelUp(msg, gid, uid, level, app) {
  const chId = app.cfg.get(gid, 'levelup_channel');
  const ch   = chId
    ? await app.client.channels.fetch(chId).catch(() => null)
    : msg.channel;

  if (ch) await ch.send(`🎉 <@${uid}> levelled up to **Level ${level}**!`).catch(() => {});

  const reward = app.db.prepare('SELECT role_id FROM level_roles WHERE guild_id = ? AND level = ?')
    .get(gid, level);
  if (reward) {
    const member = msg.member ?? await msg.guild.members.fetch(uid).catch(() => null);
    if (member) {
      await member.roles.add(reward.role_id).catch(() => {});
      if (ch) {
        await ch.send(`🏆 <@${uid}> earned the <@&${reward.role_id}> role for reaching Level ${level}!`).catch(() => {});
      }
    }
  }
}
