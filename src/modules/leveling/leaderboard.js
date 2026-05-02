const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('Show the top 10 XP leaderboard'),

  async execute(i, app) {
    await i.deferReply();
    const rows = app.db.prepare(
      'SELECT user_id, xp, level FROM levels WHERE guild_id = ? ORDER BY xp DESC LIMIT 10'
    ).all(i.guild.id);

    if (!rows.length) return i.editReply('No XP data yet.');

    const lines = await Promise.all(rows.map(async (r, idx) => {
      const user = await app.client.users.fetch(r.user_id).catch(() => null);
      return `**${idx + 1}.** ${user?.username ?? r.user_id} — Level **${r.level}** (${r.xp.toLocaleString()} XP)`;
    }));

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(`🏆 ${i.guild.name} Leaderboard`)
      .setDescription(lines.join('\n'))
      .setTimestamp();

    await i.editReply({ embeds: [embed] });
  },
};
