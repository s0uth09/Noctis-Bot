const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Get lyrics for a song')
    .addStringOption(o => o.setName('query').setDescription('Song name (defaults to currently playing)')),

  async execute(i, app) {
    await i.deferReply();

    let query = i.options.getString('query');

    if (!query) {
      const q = app.queues.get(i.guild.id);
      if (!q?.current) return i.editReply('❌ No query provided and nothing is playing.');
      query = q.current.title;
    }

    if (!process.env.GENIUS_TOKEN) {
      return i.editReply('❌ GENIUS_TOKEN not configured in .env.');
    }

    try {
      const Genius = require('genius-lyrics');
      const client = new Genius.Client(process.env.GENIUS_TOKEN);
      const songs  = await client.songs.search(query);
      if (!songs.length) return i.editReply('❌ No lyrics found.');

      const song   = songs[0];
      const lyrics = await song.lyrics();
      const trimmed = lyrics.length > 4000 ? lyrics.slice(0, 4000) + '\n…' : lyrics;

      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle(`🎤 ${song.title}`)
        .setURL(song.url)
        .setDescription(trimmed)
        .setFooter({ text: 'Powered by Genius' });

      await i.editReply({ embeds: [embed] });
    } catch (e) {
      app.logger.error(e);
      await i.editReply('❌ Failed to fetch lyrics.');
    }
  },
};
