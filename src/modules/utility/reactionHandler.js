module.exports = async function reactionHandler(reaction, user, type, app) {
  if (user.bot) return;

  // Fetch partials
  if (reaction.partial) await reaction.fetch().catch(() => {});
  if (reaction.message.partial) await reaction.message.fetch().catch(() => {});

  const guild = reaction.message.guild;
  if (!guild) return;

  const gid     = guild.id;
  const msgId   = reaction.message.id;
  const emoji   = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

  // ── Starboard ──────────────────────────────────────────────────────────
  if (emoji === '⭐') {
    await handleStarboard(reaction, type, guild, gid, app);
  }

  // ── Reaction roles ─────────────────────────────────────────────────────
  const rr = app.db.prepare('SELECT role_id, exclusive FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?')
    .get(gid, msgId, emoji);

  if (!rr) return;

  const member = await guild.members.fetch(user.id).catch(() => null);
  if (!member) return;

  if (type === 'add') {
    // Exclusive mode: remove other roles from the same message first
    if (rr.exclusive) {
      const siblings = app.db.prepare('SELECT role_id FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND exclusive = 1').all(gid, msgId);
      for (const s of siblings) {
        if (s.role_id !== rr.role_id) await member.roles.remove(s.role_id).catch(() => {});
      }
    }
    await member.roles.add(rr.role_id).catch(() => {});
  } else {
    await member.roles.remove(rr.role_id).catch(() => {});
  }
};

async function handleStarboard(reaction, type, guild, gid, app) {
  const starCfgChId = app.cfg.get(gid, 'starboard_channel');
  if (!starCfgChId) return;

  const threshold = parseInt(
    app.db.prepare("SELECT value FROM config WHERE guild_id = ? AND key = 'starboard_threshold'").get(gid)?.value || '3'
  );

  const sourceMsg = reaction.message;
  if (sourceMsg.channelId === starCfgChId) return; // don't star the starboard itself

  const starCount = reaction.count || 0;
  const existing  = app.db.prepare('SELECT star_msg_id, stars FROM starboard WHERE guild_id = ? AND source_msg_id = ?').get(gid, sourceMsg.id);

  const starCh = await reaction.message.client.channels.fetch(starCfgChId).catch(() => null);
  if (!starCh) return;

  if (starCount < threshold) {
    // Remove from starboard if it falls below threshold
    if (existing) {
      await starCh.messages.delete(existing.star_msg_id).catch(() => {});
      app.db.prepare('DELETE FROM starboard WHERE guild_id = ? AND source_msg_id = ?').run(gid, sourceMsg.id);
    }
    return;
  }

  const content = `⭐ **${starCount}** | <#${sourceMsg.channelId}>\n${sourceMsg.content?.slice(0, 1500) || ''}`;

  if (existing) {
    // Update count
    const starMsg = await starCh.messages.fetch(existing.star_msg_id).catch(() => null);
    if (starMsg) await starMsg.edit(content).catch(() => {});
    app.db.prepare('UPDATE starboard SET stars = ? WHERE guild_id = ? AND source_msg_id = ?').run(starCount, gid, sourceMsg.id);
  } else {
    const starMsg = await starCh.send(content);
    app.db.prepare('INSERT INTO starboard (guild_id, source_msg_id, star_msg_id, stars) VALUES (?, ?, ?, ?)').run(gid, sourceMsg.id, starMsg.id, starCount);
  }
}
