const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── /giveaway ─────────────────────────────────────────────────────────────────
const giveaway = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageEvents)
    .addSubcommand(s => s.setName('start')
      .setDescription('Start a giveaway')
      .addStringOption(o => o.setName('prize').setDescription('Prize').setRequired(true))
      .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1))
      .addIntegerOption(o => o.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
      .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)')))
    .addSubcommand(s => s.setName('end')
      .setDescription('End a giveaway early')
      .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true)))
    .addSubcommand(s => s.setName('reroll')
      .setDescription('Reroll a giveaway')
      .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))),

  async execute(i, app) {
    const sub = i.options.getSubcommand();

    if (sub === 'start') {
      const prize   = i.options.getString('prize');
      const mins    = i.options.getInteger('minutes');
      const winners = i.options.getInteger('winners') || 1;
      const ch      = i.options.getChannel('channel') || i.channel;
      const endsAt  = Date.now() + mins * 60_000;

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('🎉 GIVEAWAY!')
        .setDescription(`**Prize:** ${prize}\n\nReact with 🎉 to enter!\nEnds <t:${Math.floor(endsAt / 1000)}:R>`)
        .addFields({ name: 'Winners', value: String(winners), inline: true })
        .setFooter({ text: `Hosted by ${i.user.username}` });

      const msg = await ch.send({ embeds: [embed] });
      await msg.react('🎉');

      app.db.prepare('INSERT INTO giveaways (guild_id, channel_id, message_id, host_id, prize, winners, ends_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(i.guild.id, ch.id, msg.id, i.user.id, prize, winners, endsAt);

      return i.reply({ content: `✅ Giveaway started in <#${ch.id}>!`, ephemeral: true });
    }

    if (sub === 'end') {
      const id = i.options.getInteger('id');
      app.db.prepare('UPDATE giveaways SET ends_at = 0 WHERE id = ? AND guild_id = ?').run(id, i.guild.id);
      return i.reply({ content: `✅ Giveaway #${id} will end on next scheduler tick (within 15s).`, ephemeral: true });
    }

    if (sub === 'reroll') {
      const id = i.options.getInteger('id');
      const gw = app.db.prepare('SELECT * FROM giveaways WHERE id = ? AND guild_id = ?').get(id, i.guild.id);
      if (!gw) return i.reply({ content: '❌ Giveaway not found.', ephemeral: true });
      app.db.prepare('UPDATE giveaways SET ended = 0, ends_at = 0 WHERE id = ?').run(id);
      return i.reply({ content: `🔄 Giveaway #${id} will be rerolled on next scheduler tick.`, ephemeral: true });
    }
  },
};

// ── /poll ─────────────────────────────────────────────────────────────────────
const poll = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a yes/no or multi-option poll')
    .addStringOption(o => o.setName('question').setDescription('Poll question').setRequired(true))
    .addStringOption(o => o.setName('options').setDescription('Options separated by | (up to 9, optional)'))
    .addIntegerOption(o => o.setName('duration').setDescription('Auto-close after N minutes (optional)').setMinValue(1)),

  async execute(i, app) {
    if (!i.memberPermissions.has(PermissionFlagsBits.ManageMessages))
      return i.reply({ content: '❌ You need **Manage Messages** to create polls.', ephemeral: true });

    const question = i.options.getString('question');
    const duration = i.options.getInteger('duration');

    if (raw) {
      const opts  = raw.split('|').map(o => o.trim()).slice(0, 9);
      const emojis = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
      const embed  = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`📊 ${question}`)
        .setDescription(opts.map((o, idx) => `${emojis[idx]} ${o}`).join('\n'))
        .setFooter({ text: `Poll by ${i.user.username}` });

      const msg = await i.reply({ embeds: [embed], fetchReply: true });
      for (let idx = 0; idx < opts.length; idx++) await msg.react(emojis[idx]).catch(() => {});
    } else {
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`📊 ${question}`)
        .setFooter({ text: `Poll by ${i.user.username}` });
      const msg = await i.reply({ embeds: [embed], fetchReply: true });
      await msg.react('✅').catch(() => {});
      await msg.react('❌').catch(() => {});
    }
  },
};

// ── /remind ───────────────────────────────────────────────────────────────────
/**
 * Parse a human duration string into milliseconds.
 * Accepts formats like: 30, 90, 1h, 1h30m, 2d, 1d12h, 30s
 * Returns null if unparseable.
 */
function parseDuration(raw) {
  // Plain integer → treat as minutes
  if (/^\d+$/.test(raw)) {
    const mins = parseInt(raw, 10);
    return mins > 0 ? mins * 60_000 : null;
  }
  const units = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  const re    = /(\d+)\s*([smhd])/gi;
  let total   = 0;
  let matched = false;
  for (const [, num, unit] of raw.matchAll(re)) {
    total  += parseInt(num, 10) * units[unit.toLowerCase()];
    matched = true;
  }
  return matched && total > 0 ? total : null;
}

const remind = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set a reminder')
    .addStringOption(o => o.setName('message').setDescription('What to remind you about').setRequired(true))
    .addStringOption(o => o.setName('when').setDescription('When: e.g. 30, 1h, 1h30m, 2d').setRequired(true)),

  async execute(i, app) {
    const msg   = i.options.getString('message');
    const raw   = i.options.getString('when');
    const ms    = parseDuration(raw);
    if (!ms) return i.reply({ content: '❌ Invalid duration. Use formats like `30` (minutes), `1h`, `1h30m`, `2d`.', ephemeral: true });
    const fireAt = Date.now() + ms;
    app.db.prepare('INSERT INTO reminders (user_id, channel_id, message, fire_at) VALUES (?, ?, ?, ?)').run(i.user.id, i.channelId, msg, fireAt);
    // Human-friendly summary
    const parts = [];
    const d = Math.floor(ms / 86_400_000); if (d) parts.push(`${d}d`);
    const h = Math.floor((ms % 86_400_000) / 3_600_000); if (h) parts.push(`${h}h`);
    const m = Math.floor((ms % 3_600_000) / 60_000); if (m) parts.push(`${m}m`);
    const s = Math.floor((ms % 60_000) / 1_000); if (s && !d) parts.push(`${s}s`);
    await i.reply({ content: `⏰ Reminder set for **${parts.join(' ')}** from now.`, ephemeral: true });
  },
};

// ── /tag ──────────────────────────────────────────────────────────────────────
const tag = {
  data: new SlashCommandBuilder()
    .setName('tag')
    .setDescription('Server text snippet tags')
    .addSubcommand(s => s.setName('get').setDescription('Use a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)))
    .addSubcommand(s => s.setName('create').setDescription('Create a tag')
      .addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true))
      .addStringOption(o => o.setName('content').setDescription('Tag content').setRequired(true)))
    .addSubcommand(s => s.setName('delete').setDescription('Delete a tag').addStringOption(o => o.setName('name').setDescription('Tag name').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all tags')),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    if (sub === 'get') {
      const name = i.options.getString('name');
      const row  = app.db.prepare('SELECT content FROM tags WHERE guild_id = ? AND name = ?').get(gid, name);
      if (!row) return i.reply({ content: `❌ Tag **${name}** not found.`, ephemeral: true });
      app.db.prepare('UPDATE tags SET uses = uses + 1 WHERE guild_id = ? AND name = ?').run(gid, name);
      return i.reply(row.content);
    }
    if (sub === 'create') {
      if (!i.memberPermissions.has(PermissionFlagsBits.ManageMessages))
        return i.reply({ content: '❌ You need **Manage Messages** to create tags.', ephemeral: true });
      const name    = i.options.getString('name').toLowerCase().slice(0, 50);
      const content = i.options.getString('content').slice(0, 2000);
      app.db.prepare('INSERT OR REPLACE INTO tags (guild_id, name, content, author_id, uses) VALUES (?, ?, ?, ?, 0)').run(gid, name, content, i.user.id);
      return i.reply({ content: `✅ Tag **${name}** created.`, ephemeral: true });
    }
    if (sub === 'delete') {
      const name = i.options.getString('name');
      const row  = app.db.prepare('SELECT author_id FROM tags WHERE guild_id = ? AND name = ?').get(gid, name);
      if (!row) return i.reply({ content: `❌ Tag **${name}** not found.`, ephemeral: true });
      const isAuthor = row.author_id === i.user.id;
      const isAdmin  = i.memberPermissions.has(PermissionFlagsBits.ManageGuild);
      if (!isAuthor && !isAdmin)
        return i.reply({ content: '❌ You can only delete your own tags (or need **Manage Server**).', ephemeral: true });
      app.db.prepare('DELETE FROM tags WHERE guild_id = ? AND name = ?').run(gid, name);
      return i.reply({ content: `✅ Tag **${name}** deleted.`, ephemeral: true });
    }
    if (sub === 'list') {
      const rows = app.db.prepare('SELECT name, uses FROM tags WHERE guild_id = ? ORDER BY uses DESC').all(gid);
      if (!rows.length) return i.reply({ content: 'No tags yet.', ephemeral: true });
      return i.reply({ content: `📌 Tags: ${rows.map(r => `\`${r.name}\` (${r.uses})`).join(', ')}`, ephemeral: true });
    }
  },
};

// ── /announce ─────────────────────────────────────────────────────────────────
const announce = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Send an embed announcement')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName('message').setDescription('Announcement text').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel (defaults to current)'))
    .addStringOption(o => o.setName('title').setDescription('Embed title')),

  async execute(i, app) {
    const ch    = i.options.getChannel('channel') || i.channel;
    const text  = i.options.getString('message');
    const title = i.options.getString('title') || '📢 Announcement';

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(title)
      .setDescription(text)
      .setFooter({ text: `By ${i.user.username}` })
      .setTimestamp();

    await ch.send({ embeds: [embed] });
    await i.reply({ content: '✅ Announcement sent.', ephemeral: true });
  },
};

// ── /snipe ────────────────────────────────────────────────────────────────────
const snipe = {
  data: new SlashCommandBuilder().setName('snipe').setDescription('Show the last deleted message in this channel'),
  async execute(i, app) {
    if (!i.memberPermissions.has(PermissionFlagsBits.ManageMessages))
      return i.reply({ content: '❌ You need **Manage Messages** to use this command.', ephemeral: true });
    const row = app.db.prepare('SELECT * FROM snipe WHERE channel_id = ?').get(i.channelId);
    if (!row) return i.reply({ content: '❌ Nothing to snipe.', ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🎯 Sniped Message')
      .setDescription(row.content || '—')
      .setFooter({ text: `By ${row.author_tag} • ${new Date(row.ts).toLocaleTimeString()}` });
    await i.reply({ embeds: [embed] });
  },
};

// ── /birthday ─────────────────────────────────────────────────────────────────
const birthday = {
  data: new SlashCommandBuilder()
    .setName('birthday')
    .setDescription('Set your birthday')
    .addIntegerOption(o => o.setName('month').setDescription('Month (1–12)').setRequired(true).setMinValue(1).setMaxValue(12))
    .addIntegerOption(o => o.setName('day').setDescription('Day (1–31)').setRequired(true).setMinValue(1).setMaxValue(31))
    .addIntegerOption(o => o.setName('year').setDescription('Year (optional)')),

  async execute(i, app) {
    const month = i.options.getInteger('month');
    const day   = i.options.getInteger('day');
    const year  = i.options.getInteger('year');
    app.db.prepare('INSERT OR REPLACE INTO birthdays (guild_id, user_id, month, day, year) VALUES (?, ?, ?, ?, ?)').run(i.guild.id, i.user.id, month, day, year);
    await i.reply({ content: `🎂 Birthday set to **${month}/${day}${year ? `/${year}` : ''}**.`, ephemeral: true });
  },
};

// ── /serverinfo ───────────────────────────────────────────────────────────────
const serverinfo = {
  data: new SlashCommandBuilder().setName('serverinfo').setDescription('View server information'),
  async execute(i) {
    const g = i.guild;
    await g.fetch();
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(g.name)
      .setThumbnail(g.iconURL())
      .addFields(
        { name: 'Owner',    value: `<@${g.ownerId}>`,              inline: true },
        { name: 'Members',  value: String(g.memberCount),          inline: true },
        { name: 'Channels', value: String(g.channels.cache.size),  inline: true },
        { name: 'Roles',    value: String(g.roles.cache.size),     inline: true },
        { name: 'Boost Tier', value: String(g.premiumTier),        inline: true },
        { name: 'Created',  value: `<t:${Math.floor(g.createdTimestamp / 1000)}:R>`, inline: true },
      )
      .setTimestamp();
    await i.reply({ embeds: [embed] });
  },
};

// ── /userinfo ─────────────────────────────────────────────────────────────────
const userinfo = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('View user information')
    .addUserOption(o => o.setName('user').setDescription('User (defaults to you)')),
  async execute(i, app) {
    const user   = i.options.getUser('user') || i.user;
    const member = await i.guild.members.fetch(user.id).catch(() => null);
    const xpRow  = app.db.prepare('SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?').get(i.guild.id, user.id);
    const warns  = app.db.prepare('SELECT COUNT(*) AS n FROM warns WHERE guild_id = ? AND user_id = ?').get(i.guild.id, user.id).n;

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(user.username)
      .setThumbnail(user.displayAvatarURL())
      .addFields(
        { name: 'ID',       value: user.id,                                             inline: true },
        { name: 'Joined',   value: member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '—', inline: true },
        { name: 'Created',  value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Level',    value: xpRow ? `${xpRow.level} (${xpRow.xp} XP)` : '0',   inline: true },
        { name: 'Warns',    value: String(warns),                                       inline: true },
      )
      .setTimestamp();
    if (member) embed.addFields({ name: 'Roles', value: member.roles.cache.filter(r => r.id !== i.guild.id).map(r => `<@&${r.id}>`).join(' ').slice(0, 1024) || 'None' });
    await i.reply({ embeds: [embed] });
  },
};

// ── /avatar ───────────────────────────────────────────────────────────────────
const avatar = {
  data: new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Show a user\'s avatar')
    .addUserOption(o => o.setName('user').setDescription('User (defaults to you)')),
  async execute(i) {
    const user = i.options.getUser('user') || i.user;
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`${user.username}'s Avatar`)
      .setImage(user.displayAvatarURL({ size: 512 }));
    await i.reply({ embeds: [embed] });
  },
};

// ── /roles ────────────────────────────────────────────────────────────────────
const roles = {
  data: new SlashCommandBuilder().setName('roles').setDescription('List all roles in this server'),
  async execute(i) {
    const roleList = i.guild.roles.cache
      .filter(r => r.id !== i.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `<@&${r.id}>`)
      .slice(0, 50)
      .join(' ');
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`Roles — ${i.guild.name}`)
      .setDescription(roleList || 'No roles.');
    await i.reply({ embeds: [embed], ephemeral: true });
  },
};

// ── /botstats ─────────────────────────────────────────────────────────────────
const botstats = {
  data: new SlashCommandBuilder().setName('botstats').setDescription('Show bot statistics'),
  async execute(i, app) {
    const uptime = process.uptime();
    const hours  = Math.floor(uptime / 3600);
    const mins   = Math.floor((uptime % 3600) / 60);
    const embed  = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🤖 Bot Stats — Noctis Haven')
      .addFields(
        { name: 'Guilds',   value: String(app.client.guilds.cache.size),  inline: true },
        { name: 'Users',    value: String(app.client.users.cache.size),   inline: true },
        { name: 'Commands', value: String(app.commands.size),             inline: true },
        { name: 'Uptime',   value: `${hours}h ${mins}m`,                 inline: true },
        { name: 'Memory',   value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, inline: true },
        { name: 'Node.js',  value: process.version,                      inline: true },
      )
      .setTimestamp();
    await i.reply({ embeds: [embed] });
  },
};

// ── /slowmode ─────────────────────────────────────────────────────────────────
const slowmode = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set channel slow mode')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addIntegerOption(o => o.setName('seconds').setDescription('Seconds (0 to disable)').setRequired(true).setMinValue(0).setMaxValue(21600)),
  async execute(i) {
    await i.channel.setRateLimitPerUser(i.options.getInteger('seconds'));
    const s = i.options.getInteger('seconds');
    await i.reply(`✅ Slowmode set to **${s}** second(s)${s === 0 ? ' (disabled)' : ''}.`);
  },
};

module.exports = { giveaway, poll, remind, tag, announce, snipe, birthday, serverinfo, userinfo, avatar, roles, botstats, slowmode };
