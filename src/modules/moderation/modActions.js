const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

// ── Log helper ────────────────────────────────────────────────────────────────
async function modLog(app, guild, action, target, mod, reason, extra = {}) {
  const chId = app.db.prepare("SELECT value FROM config WHERE guild_id = ? AND key = 'mod_log'")
    .get(guild.id)?.value;
  if (!chId) return;
  const ch = await app.client.channels.fetch(chId).catch(() => null);
  if (!ch) return;

  const embed = new EmbedBuilder()
    .setColor(0xe74c3c)
    .setTitle(`🛡️ ${action}`)
    .addFields(
      { name: 'User',      value: `<@${target.id}> (${target.username})`, inline: true },
      { name: 'Moderator', value: `<@${mod.id}>`,                     inline: true },
      { name: 'Reason',    value: reason || 'None provided' },
    )
    .setTimestamp();

  for (const [k, v] of Object.entries(extra)) embed.addFields({ name: k, value: String(v) });
  await ch.send({ embeds: [embed] }).catch(() => {});
}

// ── /kick ─────────────────────────────────────────────────────────────────────
const kick = {
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(i, app) {
    const member = i.options.getMember('user');
    const reason = i.options.getString('reason') || 'No reason';
    if (!member?.kickable) return i.reply({ content: '❌ Cannot kick this member.', ephemeral: true });
    await member.kick(reason);
    await modLog(app, i.guild, 'Kick', member.user, i.user, reason);
    await i.reply(`✅ Kicked **${member.user.username}**.`);
  },
};

// ── /ban ──────────────────────────────────────────────────────────────────────
const ban = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('User to ban').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason'))
    .addIntegerOption(o => o.setName('delete_days').setDescription('Delete messages from past N days (0–7)').setMinValue(0).setMaxValue(7)),
  async execute(i, app) {
    const user   = i.options.getUser('user');
    const reason = i.options.getString('reason') || 'No reason';
    const days   = i.options.getInteger('delete_days') ?? 0;
    await i.guild.members.ban(user, { reason, deleteMessageSeconds: days * 86_400 }).catch(e => { throw e; });
    await modLog(app, i.guild, 'Ban', user, i.user, reason);
    await i.reply(`✅ Banned **${user.username}**.`);
  },
};

// ── /unban ────────────────────────────────────────────────────────────────────
const unban = {
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a user by ID')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName('user_id').setDescription('User ID').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(i, app) {
    const userId = i.options.getString('user_id');
    const reason = i.options.getString('reason') || 'No reason';
    const user   = await app.client.users.fetch(userId).catch(() => null);
    if (!user) return i.reply({ content: '❌ User not found.', ephemeral: true });
    await i.guild.members.unban(userId, reason);
    await modLog(app, i.guild, 'Unban', user, i.user, reason);
    await i.reply(`✅ Unbanned **${user.username}**.`);
  },
};

// ── /timeout ──────────────────────────────────────────────────────────────────
const timeout = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
    .addIntegerOption(o => o.setName('minutes').setDescription('Duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName('reason').setDescription('Reason')),
  async execute(i, app) {
    const member  = i.options.getMember('user');
    const mins    = i.options.getInteger('minutes');
    const reason  = i.options.getString('reason') || 'No reason';
    if (!member?.moderatable) return i.reply({ content: '❌ Cannot timeout this member.', ephemeral: true });
    await member.timeout(mins * 60_000, reason);
    await modLog(app, i.guild, 'Timeout', member.user, i.user, reason, { Duration: `${mins} minute(s)` });
    await i.reply(`✅ <@${member.id}> timed out for **${mins}** minute(s).`);
  },
};

// ── /warn ─────────────────────────────────────────────────────────────────────
const warn = {
  data: new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Warn management')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName('add')
      .setDescription('Warn a member')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))
      .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('View warns on a user')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true)))
    .addSubcommand(s => s.setName('clear')
      .setDescription('Clear all warns for a user')
      .addUserOption(o => o.setName('user').setDescription('Member').setRequired(true))),

  async execute(i, app) {
    const sub    = i.options.getSubcommand();
    const gid    = i.guild.id;

    if (sub === 'list') {
      const user = i.options.getUser('user');
      const rows = app.db.prepare('SELECT * FROM warns WHERE guild_id = ? AND user_id = ? ORDER BY ts DESC').all(gid, user.id);
      if (!rows.length) return i.reply({ content: `✅ **${user.username}** has no warns.`, ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0xe67e22)
        .setTitle(`⚠️ Warns — ${user.username}`)
        .setDescription(rows.map((r, idx) =>
          `**${idx + 1}.** <@${r.mod_id}> — ${r.reason} *(${new Date(r.ts).toLocaleDateString()})*`
        ).join('\n').slice(0, 4000))
        .setFooter({ text: `${rows.length} total warn(s)` });
      return i.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'clear') {
      const user = i.options.getUser('user');
      const { changes } = app.db.prepare('DELETE FROM warns WHERE guild_id = ? AND user_id = ?').run(gid, user.id);
      return i.reply({ content: `✅ Cleared **${changes}** warn(s) for **${user.username}**.`, ephemeral: true });
    }

    // sub === 'add'
    const member = i.options.getMember('user');
    if (!member) return i.reply({ content: '❌ Member not found in this server.', ephemeral: true });
    const reason = i.options.getString('reason');

    app.db.prepare('INSERT INTO warns (guild_id, user_id, mod_id, reason, ts) VALUES (?, ?, ?, ?, ?)')
      .run(gid, member.id, i.user.id, reason, Date.now());

    const warnCount = app.db.prepare('SELECT COUNT(*) AS n FROM warns WHERE guild_id = ? AND user_id = ?')
      .get(gid, member.id).n;

    await modLog(app, i.guild, `Warn #${warnCount}`, member.user, i.user, reason);
    await i.reply(`⚠️ Warned **${member.user.username}** — reason: ${reason} *(${warnCount} total)*`);

    // Auto-timeout threshold
    const threshold    = parseInt(app.db.prepare("SELECT value FROM config WHERE guild_id = ? AND key = 'warn_threshold'").get(gid)?.value || '0');
    const timeoutMins  = parseInt(app.db.prepare("SELECT value FROM config WHERE guild_id = ? AND key = 'warn_timeout'").get(gid)?.value || '60');

    if (threshold > 0 && warnCount >= threshold && member.moderatable) {
      await member.timeout(timeoutMins * 60_000, `Auto-timeout: ${warnCount} warns`);
      await i.followUp(`🔇 Auto-timed out **${member.user.username}** for ${timeoutMins} minute(s) (reached ${warnCount} warns).`);
    }
  },
};

// ── /purge ────────────────────────────────────────────────────────────────────
const purge = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Bulk-delete messages')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName('count').setDescription('Messages to delete (1–100)').setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName('user').setDescription('Filter by user')),
  async execute(i, app) {
    const count  = i.options.getInteger('count');
    const filter = i.options.getUser('user');
    const msgs   = await i.channel.messages.fetch({ limit: 100 });

    let toDelete = [...msgs.values()].filter(m => {
      if (Date.now() - m.createdTimestamp > 14 * 24 * 60 * 60 * 1000) return false;
      if (filter && m.author.id !== filter.id) return false;
      return true;
    }).slice(0, count);

    if (!toDelete.length) return i.reply({ content: '❌ No deletable messages found.', ephemeral: true });

    await i.channel.bulkDelete(toDelete, true).catch(() => {});
    await i.reply({ content: `🗑️ Deleted ${toDelete.length} message(s).`, ephemeral: true });
  },
};

// ── /lock ─────────────────────────────────────────────────────────────────────
const lock = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock or unlock a channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(o => o.setName('action').setDescription('lock or unlock').setRequired(true)
      .addChoices({ name: 'lock', value: 'lock' }, { name: 'unlock', value: 'unlock' })),
  async execute(i, app) {
    const action = i.options.getString('action');
    const deny   = action === 'lock';
    await i.channel.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: deny ? false : null });
    await i.reply(`${deny ? '🔒 Locked' : '🔓 Unlocked'} **#${i.channel.name}**.`);
  },
};

// ── /note ─────────────────────────────────────────────────────────────────────
const note = {
  data: new SlashCommandBuilder()
    .setName('note')
    .setDescription('Manage private mod notes on a user')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a note')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addStringOption(o => o.setName('text').setDescription('Note text').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('View notes on a user')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))),
  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const user = i.options.getUser('user');
    if (sub === 'add') {
      const text = i.options.getString('text');
      app.db.prepare('INSERT INTO notes (guild_id, user_id, mod_id, note, ts) VALUES (?, ?, ?, ?, ?)')
        .run(i.guild.id, user.id, i.user.id, text, Date.now());
      return i.reply({ content: `✅ Note saved for **${user.username}**.`, ephemeral: true });
    }
    const rows = app.db.prepare('SELECT * FROM notes WHERE guild_id = ? AND user_id = ? ORDER BY ts DESC').all(i.guild.id, user.id);
    if (!rows.length) return i.reply({ content: `No notes for **${user.username}**.`, ephemeral: true });
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`Notes for ${user.username}`)
      .setDescription(rows.map(r => `**[${new Date(r.ts).toLocaleDateString()}]** <@${r.mod_id}>: ${r.note}`).join('\n').slice(0, 4000));
    return i.reply({ embeds: [embed], ephemeral: true });
  },
};

// ── /filter ───────────────────────────────────────────────────────────────────
const filter = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Manage the word filter')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a word to the filter')
      .addStringOption(o => o.setName('word').setDescription('Word').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a word')
      .addStringOption(o => o.setName('word').setDescription('Word').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('List filtered words')),
  async execute(i, app) {
    const sub  = i.options.getSubcommand();
    const gid  = i.guild.id;
    if (sub === 'add') {
      const word = i.options.getString('word').toLowerCase();
      app.db.prepare('INSERT OR IGNORE INTO wordfilter (guild_id, word) VALUES (?, ?)').run(gid, word);
      return i.reply({ content: `✅ Added **${word}** to the filter.`, ephemeral: true });
    }
    if (sub === 'remove') {
      const word = i.options.getString('word').toLowerCase();
      app.db.prepare('DELETE FROM wordfilter WHERE guild_id = ? AND word = ?').run(gid, word);
      return i.reply({ content: `✅ Removed **${word}**.`, ephemeral: true });
    }
    const rows = app.db.prepare('SELECT word FROM wordfilter WHERE guild_id = ?').all(gid);
    return i.reply({ content: rows.length ? `🚫 Filtered words:\n${rows.map(r => `\`${r.word}\``).join(', ')}` : 'No words filtered.', ephemeral: true });
  },
};

module.exports = { kick, ban, unban, timeout, warn, purge, lock, note, filter };
