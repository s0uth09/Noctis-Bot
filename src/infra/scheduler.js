'use strict';

const { EmbedBuilder } = require('discord.js');

let _ticking = false;

module.exports = function startScheduler(app) {
  setInterval(async () => {
    if (_ticking) return;
    _ticking = true;
    try { await tick(app); }
    catch (e) { app.logger.error(e); }
    finally { _ticking = false; }
  }, 15_000).unref();
};

async function tick(app) {
  const now = Date.now();
  await tickReminders(now, app);
  await tickGiveaways(now, app);
  await tickBirthdays(app);
}

// ── Reminders ─────────────────────────────────────────────────────────────────
async function tickReminders(now, app) {
  const rows = app.db.prepare(
    'SELECT * FROM reminders WHERE done = 0 AND fire_at <= ?'
  ).all(now);

  for (const r of rows) {
    // Mark done first — prevents double-fire if the channel send is slow
    app.db.prepare('UPDATE reminders SET done = 1 WHERE id = ?').run(r.id);
    try {
      const ch = await app.client.channels.fetch(r.channel_id).catch(() => null);
      if (r.message === "__REMOVE_BIRTHDAY_ROLE__") {
        // parse guild/role out of the synthetic user_id
        const parts = r.user_id.split("__");
        // format: __birthday__userId__guildId__roleId
        if (parts.length === 5) {
          const [, , uid, gid, roleId] = parts;
          const guild  = await app.client.guilds.fetch(gid).catch(() => null);
          const member = await guild?.members.fetch(uid).catch(() => null);
          if (member) await member.roles.remove(roleId).catch(() => {});
        }
      } else if (ch) {
        await ch.send(`<@${r.user_id}> ⏰ **Reminder:** ${r.message}`);
      }
    } catch {}
  }
}

// ── Giveaways ─────────────────────────────────────────────────────────────────
async function tickGiveaways(now, app) {
  const rows = app.db.prepare(
    'SELECT * FROM giveaways WHERE ended = 0 AND ends_at <= ?'
  ).all(now);

  for (const gw of rows) {
    // Mark ended immediately — prevents double-processing on slow ticks
    app.db.prepare('UPDATE giveaways SET ended = 1 WHERE id = ?').run(gw.id);
    try {
      await concludeGiveaway(gw, app);
    } catch (e) {
      app.logger.error(e);
    }
  }
}

async function concludeGiveaway(gw, app) {
  const ch = await app.client.channels.fetch(gw.channel_id).catch(() => null);
  if (!ch) return;

  const msg = gw.message_id
    ? await ch.messages.fetch(gw.message_id).catch(() => null)
    : null;

  let winners = [];
  if (msg) {
    // Always fetch fresh from API — cache is unreliable after restarts
    const reactions = await msg.reactions.fetch().catch(() => null);
    const reaction  = reactions?.get('🎉');
    if (reaction) {
      const users = await reaction.users.fetch().catch(() => null);
      if (users) {
        const pool = users.filter(u => !u.bot && u.id !== gw.host_id).map(u => u.id);
        winners = pickWinners(pool, gw.winners);
      }
    }
  }

  const winText = winners.length
    ? winners.map(id => `<@${id}>`).join(', ')
    : '*No valid entries*';

  await ch.send(`🎉 **Giveaway ended!** Prize: **${gw.prize}**\nWinner(s): ${winText}`).catch(() => {});

  if (msg) {
    const endEmbed = new EmbedBuilder()
      .setColor(0x95a5a6)
      .setTitle('🎉 GIVEAWAY ENDED')
      .setDescription(`**Prize:** ${gw.prize}\n\n**Winner(s):** ${winText}`)
      .setFooter({ text: `Hosted by a moderator • ID: ${gw.id}` })
      .setTimestamp();
    await msg.edit({ embeds: [endEmbed], components: [] }).catch(() => {});
  }
}

function pickWinners(pool, count) {
  const arr = [...pool];
  const out = [];
  for (let i = 0; i < count && arr.length; i++) {
    const idx = Math.floor(Math.random() * arr.length);
    out.push(...arr.splice(idx, 1));
  }
  return out;
}

// ── Birthdays ─────────────────────────────────────────────────────────────────
// Birthday role removal is tracked in DB to survive restarts
async function tickBirthdays(app) {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const day   = now.getDate();
  const dateKey = `${month}-${day}`;

  if (app._lastBirthdayDate === dateKey) return;
  app._lastBirthdayDate = dateKey;

  const rows = app.db.prepare(
    'SELECT * FROM birthdays WHERE month = ? AND day = ?'
  ).all(month, day);

  for (const b of rows) {
    try {
      const chId = app.cfg.get(b.guild_id, 'birthday_channel');
      if (!chId) continue;

      const ch = await app.client.channels.fetch(chId).catch(() => null);
      if (!ch) continue;

      await ch.send(`🎂 Happy Birthday <@${b.user_id}>! 🎉`).catch(() => {});

      const roleId = app.cfg.get(b.guild_id, 'birthday_role');
      if (roleId) {
        const guild  = await app.client.guilds.fetch(b.guild_id).catch(() => null);
        const member = await guild?.members.fetch(b.user_id).catch(() => null);
        if (member) {
          await member.roles.add(roleId).catch(() => {});
          // Schedule removal 24 h from now — stored in DB so it survives restarts
          const removeAt = Date.now() + 86_400_000;
          app.db.prepare(`
            INSERT OR REPLACE INTO reminders (user_id, channel_id, message, fire_at)
            VALUES (?, ?, ?, ?)
          `).run(`__birthday__${member.id}__${guild.id}__${roleId}`, chId, `__REMOVE_BIRTHDAY_ROLE__`, removeAt);
        }
      }
    } catch {}
  }
}
