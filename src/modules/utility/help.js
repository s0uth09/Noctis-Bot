const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('List all commands or get info on a specific one')
    .addStringOption(o => o.setName('command').setDescription('Command name for detailed help')),

  async execute(i, app) {
    const query = i.options.getString('command');

    if (query) {
      const cmd = app.commands.get(query);
      if (!cmd) return i.reply({ content: `❌ Command \`${query}\` not found.`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`/${cmd.data.name}`)
        .setDescription(cmd.data.description);

      return i.reply({ embeds: [embed], ephemeral: true });
    }

    const categories = {
      '🎵 Music':      ['play','search','queue','nowplaying','skip','pause','resume','stop','volume','loop','shuffle','remove','move','clear','247','playlist','lyrics'],
      '🛡️ Moderation': ['kick','ban','unban','timeout','warn','purge','lock','filter','note'],
      '🤖 AutoMod':    ['automod','slowmode'],
      '📊 Leveling':   ['rank','leaderboard','levelroles'],
      '🎭 Utility':    ['help','setup','ticket','reactionrole','remind','giveaway','poll','tag','announce','snipe','avatar','roles','botstats','serverinfo','userinfo','welcome','afk','birthday','config'],
      '🎵 Last.fm':    ['fm'],
      '🎲 Fun':        ['fun'],
    };

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📚 Noctis Haven — Command List')
      .setDescription('Use `/help <command>` for detailed info on any command.')
      .setFooter({ text: `${app.commands.size} commands loaded` });

    for (const [cat, cmds] of Object.entries(categories)) {
      const available = cmds.filter(c => app.commands.has(c));
      if (available.length) {
        embed.addFields({ name: cat, value: available.map(c => `\`/${c}\``).join(' ') });
      }
    }

    await i.reply({ embeds: [embed], ephemeral: true });
  },
};
