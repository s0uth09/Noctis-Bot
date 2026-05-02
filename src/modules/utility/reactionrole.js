const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('add')
      .setDescription('Add a reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
      .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
      .addBooleanOption(o => o.setName('exclusive').setDescription('Exclusive (radio button) mode')))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a reaction role')
      .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
      .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true))),

  async execute(i, app) {
    const sub   = i.options.getSubcommand();
    const gid   = i.guild.id;
    const msgId = i.options.getString('message_id');
    const emoji = i.options.getString('emoji');

    if (sub === 'add') {
      const role      = i.options.getRole('role');
      const exclusive = i.options.getBoolean('exclusive') ? 1 : 0;

      app.db.prepare('INSERT OR REPLACE INTO reaction_roles (guild_id, message_id, emoji, role_id, exclusive) VALUES (?, ?, ?, ?, ?)')
        .run(gid, msgId, emoji, role.id, exclusive);

      // Bot adds the reaction automatically
      try {
        const msg = await i.channel.messages.fetch(msgId);
        await msg.react(emoji);
      } catch {}

      return i.reply({ content: `✅ Reaction role set: ${emoji} → <@&${role.id}>${exclusive ? ' (exclusive)' : ''}.`, ephemeral: true });
    }

    if (sub === 'remove') {
      app.db.prepare('DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?').run(gid, msgId, emoji);
      return i.reply({ content: `✅ Reaction role removed.`, ephemeral: true });
    }
  },
};
