'use strict';

const {
  SlashCommandBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ChannelType, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder,
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system')
    .addSubcommand(s => s.setName('setup')
      .setDescription('Post the ticket open-panel in a channel')
      .addChannelOption(o => o.setName('channel').setDescription('Channel for the panel').setRequired(true))
      .addRoleOption(o => o.setName('support_role').setDescription('Support role to ping').setRequired(true))
      .addStringOption(o => o.setName('category_id').setDescription('Category ID for ticket channels')))
    .addSubcommand(s => s.setName('close').setDescription('Close this ticket'))
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a user to this ticket')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a user from this ticket')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    if (sub === 'setup') {
      const ch    = i.options.getChannel('channel');
      const role  = i.options.getRole('support_role');
      const catId = i.options.getString('category_id') ?? '';

      app.cfg.set(gid, 'ticket_role', role.id);
      if (catId) setConfig(app.db, gid, 'ticket_category', catId);

      const row   = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('ticket:open').setLabel('📩 Open Ticket').setStyle(ButtonStyle.Primary)
      );
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('📩 Support Tickets')
        .setDescription('Click the button below to open a support ticket.\nYou may only have one open ticket at a time.');

      await ch.send({ embeds: [embed], components: [row] });
      return i.reply({ content: '✅ Ticket panel posted.', ephemeral: true });
    }

    // Remaining subcommands require the channel to actually be a ticket
    const isTicket = app.db.prepare(
      "SELECT id FROM tickets WHERE channel_id = ? AND status = 'open'"
    ).get(i.channelId);

    if (sub === 'add') {
      if (!isTicket) return i.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });
      const user = i.options.getUser('user');
      await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: true, SendMessages: true });
      return i.reply({ content: `✅ Added <@${user.id}> to the ticket.` });
    }

    if (sub === 'remove') {
      if (!isTicket) return i.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });
      const user = i.options.getUser('user');
      await i.channel.permissionOverwrites.edit(user.id, { ViewChannel: false });
      return i.reply({ content: `✅ Removed <@${user.id}> from the ticket.` });
    }

    if (sub === 'close') {
      return closeTicket(i.channel, i.guild, app, i);
    }
  },
};

async function openTicket(i, app) {
  const gid    = i.guild.id;
  const uid    = i.user.id;
  const roleId = app.cfg.get(gid, 'ticket_role');
  const catId  = app.cfg.get(gid, 'ticket_category');

  // One open ticket per user
  const existing = app.db.prepare(
    "SELECT channel_id FROM tickets WHERE guild_id = ? AND user_id = ? AND status = 'open'"
  ).get(gid, uid);
  if (existing) {
    return i.reply({
      content: `❌ You already have an open ticket: <#${existing.channel_id}>`,
      ephemeral: true,
    });
  }

  const overwrites = [
    { id: i.guild.roles.everyone, deny: [PermissionFlagsBits.ViewChannel] },
    { id: uid, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (roleId) {
    overwrites.push({ id: roleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] });
  }

  const ch = await i.guild.channels.create({
    name:                 `ticket-${i.user.username.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20)}`,
    type:                 ChannelType.GuildText,
    parent:               catId ?? undefined,
    permissionOverwrites: overwrites,
  });

  app.db.prepare(
    'INSERT INTO tickets (guild_id, user_id, channel_id, ts) VALUES (?, ?, ?, ?)'
  ).run(gid, uid, ch.id, Date.now());

  const closeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket:close').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
  );
  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('📩 Support Ticket')
    .setDescription(
      `Hello <@${uid}>! Describe your issue and support will be with you shortly.` +
      (roleId ? `\n\n<@&${roleId}>` : '')
    );

  await ch.send({ embeds: [embed], components: [closeRow] });
  await i.reply({ content: `✅ Ticket opened: <#${ch.id}>`, ephemeral: true });
}

async function closeTicket(ch, guild, app, interaction) {
  const gid = guild.id;
  const row = app.db.prepare(
    "SELECT * FROM tickets WHERE channel_id = ? AND status = 'open'"
  ).get(ch.id);

  if (!row) {
    if (interaction) {
      return interaction.reply({ content: '❌ This is not an open ticket channel.', ephemeral: true });
    }
    return;
  }

  app.db.prepare("UPDATE tickets SET status = 'closed' WHERE id = ?").run(row.id);

  // Fetch full transcript — paginate past the 100-message limit
  const allMessages = [];
  let before = undefined;
  while (true) {
    const batch = await ch.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    if (!batch.size) break;
    allMessages.push(...batch.values());
    before = batch.last().id;
    if (batch.size < 100) break;
  }
  allMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

  const lines = allMessages.map(m => {
    const ts  = new Date(m.createdTimestamp).toISOString();
    const att = m.attachments.size ? ` [${m.attachments.size} attachment(s)]` : '';
    return `[${ts}] ${m.author.username}: ${m.content}${att}`;
  });
  const transcript = `Ticket: ${ch.name}\nOpened by: ${row.user_id}\nMessages: ${lines.length}\n\n${lines.join('\n')}`;

  // Post transcript to mod log
  const logChId = app.cfg.get(gid, 'mod_log');
  if (logChId) {
    const logCh = await app.client.channels.fetch(logChId).catch(() => null);
    if (logCh) {
      const buf = Buffer.from(transcript, 'utf-8');
      const att = new AttachmentBuilder(buf, { name: `transcript-${ch.name}.txt` });
      await logCh.send({
        content: `📋 Ticket closed: **${ch.name}** | Opened by <@${row.user_id}> | ${lines.length} messages`,
        files:   [att],
      }).catch(() => {});
    }
  }

  if (interaction) await interaction.reply('🔒 Closing ticket in 5 seconds…').catch(() => {});
  setTimeout(() => ch.delete().catch(() => {}), 5_000);
}

module.exports.openTicket  = openTicket;
module.exports.closeTicket = closeTicket;
