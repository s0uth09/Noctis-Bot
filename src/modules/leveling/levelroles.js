const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('levelroles')
    .setDescription('Manage level role rewards')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(s => s.setName('set')
      .setDescription('Assign a role reward at a level')
      .addIntegerOption(o => o.setName('level').setDescription('Level required').setRequired(true).setMinValue(1))
      .addRoleOption(o => o.setName('role').setDescription('Role to grant').setRequired(true)))
    .addSubcommand(s => s.setName('remove')
      .setDescription('Remove a role reward')
      .addIntegerOption(o => o.setName('level').setDescription('Level to clear').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('List all level role rewards')),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    if (sub === 'set') {
      const level = i.options.getInteger('level');
      const role  = i.options.getRole('role');
      app.db.prepare('INSERT OR REPLACE INTO level_roles (guild_id, level, role_id) VALUES (?, ?, ?)').run(gid, level, role.id);
      return i.reply({ content: `✅ Level **${level}** → <@&${role.id}>`, ephemeral: true });
    }
    if (sub === 'remove') {
      const level = i.options.getInteger('level');
      app.db.prepare('DELETE FROM level_roles WHERE guild_id = ? AND level = ?').run(gid, level);
      return i.reply({ content: `✅ Removed reward for level **${level}**.`, ephemeral: true });
    }
    if (sub === 'list') {
      const rows = app.db.prepare('SELECT level, role_id FROM level_roles WHERE guild_id = ? ORDER BY level').all(gid);
      if (!rows.length) return i.reply({ content: 'No level role rewards set.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('Level Role Rewards')
        .setDescription(rows.map(r => `Level **${r.level}** → <@&${r.role_id}>`).join('\n'));
      return i.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
