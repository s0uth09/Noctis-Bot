'use strict';

const { EmbedBuilder } = require('discord.js');

async function sendToAudit(app, guildId, embed) {
  const chId = app.cfg.get(guildId, 'audit_channel');
  if (!chId) return;
  const ch = await app.client.channels.fetch(chId).catch(() => null);
  if (ch) await ch.send({ embeds: [embed] }).catch(() => {});
}

module.exports = {
  async messageEdit(old, msg, app) {
    if (!msg.guild || msg.author?.bot) return;
    if (!msg.content || old.content === msg.content) return;
    const e = new EmbedBuilder()
      .setColor(0xf0a500)
      .setTitle('✏️ Message Edited')
      .addFields(
        { name: 'Author',  value: `<@${msg.author.id}>`, inline: true },
        { name: 'Channel', value: `<#${msg.channelId}>`,  inline: true },
        { name: 'Before',  value: (old.content || '—').slice(0, 1024) },
        { name: 'After',   value: (msg.content  || '—').slice(0, 1024) },
      )
      .setTimestamp();
    await sendToAudit(app, msg.guild.id, e);
  },

  async messageDelete(msg, app) {
    if (!msg.guild || msg.author?.bot) return;
    // Persist for /snipe — upsert so only last deleted per channel is kept
    app.db.prepare(`
      INSERT OR REPLACE INTO snipe (channel_id, content, author_id, author_tag, ts)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      msg.channelId,
      msg.content?.slice(0, 2000) || '',
      msg.author?.id  || '',
      msg.author?.username || '',
      Date.now(),
    );

    const e = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('🗑️ Message Deleted')
      .addFields(
        { name: 'Author',  value: msg.author ? `<@${msg.author.id}>` : 'Unknown', inline: true },
        { name: 'Channel', value: `<#${msg.channelId}>`, inline: true },
        { name: 'Content', value: (msg.content || '*(no text content)*').slice(0, 1024) },
      )
      .setTimestamp();
    await sendToAudit(app, msg.guild.id, e);
  },

  async memberUpdate(old, member, app) {
    const added   = member.roles.cache.filter(r => !old.roles.cache.has(r.id));
    const removed = old.roles.cache.filter(r => !member.roles.cache.has(r.id));
    if (!added.size && !removed.size) return;

    const e = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle('👤 Member Roles Updated')
      .addFields({ name: 'Member', value: `<@${member.id}>`, inline: true })
      .setTimestamp();

    if (added.size)   e.addFields({ name: 'Added',   value: added.map(r   => `<@&${r.id}>`).join(' ') });
    if (removed.size) e.addFields({ name: 'Removed', value: removed.map(r => `<@&${r.id}>`).join(' ') });

    await sendToAudit(app, member.guild.id, e);
  },

  async voiceState(old, state, app) {
    if (!state.guild) return;
    const user = state.member?.user;
    if (!user || user.bot) return;

    let title, color;
    if (!old.channelId && state.channelId) {
      title = `🔊 Joined **${state.channel?.name}**`;   color = 0x2ecc71;
    } else if (old.channelId && !state.channelId) {
      title = `🔇 Left **${old.channel?.name}**`;       color = 0xe74c3c;
    } else if (old.channelId !== state.channelId) {
      title = `↔️ Moved: **${old.channel?.name}** → **${state.channel?.name}**`; color = 0xf0a500;
    } else return;

    const e = new EmbedBuilder()
      .setColor(color)
      .setDescription(title)
      .addFields({ name: 'User', value: `<@${user.id}>`, inline: true })
      .setTimestamp();
    await sendToAudit(app, state.guild.id, e);
  },
};
