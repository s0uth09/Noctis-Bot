// afkEngine.js — runs on every messageCreate
// Per-channel throttle: don't flood replies when multiple AFK users are mentioned
// Map<channelId, expiresAt>
const _afkThrottle = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of _afkThrottle) if (now > exp) _afkThrottle.delete(k);
}, 60_000).unref();

module.exports = async function afkEngine(msg, app) {
  const gid = msg.guild.id;
  const uid = msg.author.id;

  // Clear AFK if the user themselves sends a message
  const ownAfk = app.db.prepare('SELECT reason FROM afk WHERE guild_id = ? AND user_id = ?').get(gid, uid);
  if (ownAfk) {
    app.db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(gid, uid);
    // Try to remove [AFK] prefix from nickname
    if (msg.member?.nickname?.startsWith('[AFK]')) {
      await msg.member.setNickname(msg.member.nickname.replace('[AFK] ', '').replace('[AFK]', '').trim()).catch(() => {});
    }
    await msg.reply('✅ Welcome back! Your AFK status has been removed.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000)).catch(() => {});
    return;
  }

  // Notify if a mentioned user is AFK (throttled to 1 reply per channel per 5s)
  const throttleKey = msg.channelId;
  const throttled   = (_afkThrottle.get(throttleKey) ?? 0) > Date.now();

  for (const [, user] of msg.mentions.users) {
    const afkRow = app.db.prepare('SELECT reason, ts FROM afk WHERE guild_id = ? AND user_id = ?').get(gid, user.id);
    if (afkRow && !throttled) {
      const since = Math.floor((Date.now() - afkRow.ts) / 60000);
      await msg.reply(`💤 **${user.username}** is AFK: ${afkRow.reason || 'No reason'} (${since}m ago)`).catch(() => {});
      _afkThrottle.set(throttleKey, Date.now() + 5_000);
    }
  }
};
