const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Configure AutoMod rules')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(s => s.setName('antispam')
      .setDescription('Toggle anti-spam')
      .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand(s => s.setName('antiinvite')
      .setDescription('Toggle invite-link blocking')
      .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand(s => s.setName('anticaps')
      .setDescription('Toggle anti-caps')
      .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true)))
    .addSubcommand(s => s.setName('maxmentions')
      .setDescription('Set max mentions per message')
      .addIntegerOption(o => o.setName('count').setDescription('Max mentions (0 = off)').setRequired(true).setMinValue(0).setMaxValue(50))),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;

    // upsert row
    app.db.prepare(`INSERT OR IGNORE INTO automod (guild_id) VALUES (?)`).run(gid);

    if (sub === 'maxmentions') {
      const count = i.options.getInteger('count');
      app.db.prepare(`UPDATE automod SET maxmentions = ? WHERE guild_id = ?`).run(count, gid);
      return i.reply({ content: `✅ Max mentions set to **${count}**.`, ephemeral: true });
    }

    const enabled = i.options.getBoolean('enabled') ? 1 : 0;
    app.db.prepare(`UPDATE automod SET ${sub} = ? WHERE guild_id = ?`).run(enabled, gid);
    return i.reply({ content: `✅ **${sub}** is now **${enabled ? 'enabled' : 'disabled'}**.`, ephemeral: true });
  },
};
