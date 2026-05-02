const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status')
    .addSubcommand(s => s.setName('set')
      .setDescription('Go AFK')
      .addStringOption(o => o.setName('reason').setDescription('Reason')))
    .addSubcommand(s => s.setName('clear')
      .setDescription('Clear your AFK status')),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const gid = i.guild.id;
    const uid = i.user.id;

    if (sub === 'set') {
      const reason = i.options.getString('reason') || 'AFK';
      app.db.prepare('INSERT OR REPLACE INTO afk (guild_id, user_id, reason, ts) VALUES (?, ?, ?, ?)').run(gid, uid, reason, Date.now());
      // Add [AFK] prefix to nickname
      if (i.member?.manageable && !i.member.nickname?.startsWith('[AFK]')) {
        const nick = (i.member.nickname || i.user.username).slice(0, 27);
        await i.member.setNickname(`[AFK] ${nick}`).catch(() => {});
      }
      return i.reply({ content: `💤 AFK set: **${reason}**`, ephemeral: false });
    }

    if (sub === 'clear') {
      app.db.prepare('DELETE FROM afk WHERE guild_id = ? AND user_id = ?').run(gid, uid);
      if (i.member?.nickname?.startsWith('[AFK]')) {
        await i.member.setNickname(i.member.nickname.replace('[AFK] ', '').replace('[AFK]', '').trim()).catch(() => {});
      }
      return i.reply({ content: '✅ AFK cleared.', ephemeral: true });
    }
  },
};
