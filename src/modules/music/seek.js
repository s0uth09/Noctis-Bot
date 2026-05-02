const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('seek')
    .setDescription('Seek to a position in the current track')
    .addStringOption(o => o
      .setName('time')
      .setDescription('Timestamp in mm:ss or seconds (e.g. 1:30 or 90)')
      .setRequired(true)),

  async execute(i, app) {
    const q = app.queues.get(i.guild.id);
    if (!q?.current) return i.reply({ content: '❌ Nothing is playing.', ephemeral: true });

    const raw = i.options.getString('time');
    let seconds;

    if (raw.includes(':')) {
      const parts = raw.split(':').map(Number);
      seconds = parts.length === 2
        ? parts[0] * 60 + parts[1]
        : parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else {
      seconds = parseInt(raw);
    }

    if (isNaN(seconds) || seconds < 0) {
      return i.reply({ content: '❌ Invalid time format. Use `1:30` or `90`.', ephemeral: true });
    }

    // play-dl seek: re-stream with seek option
    // We restart the current track from the given position
    const playdl = require('play-dl');

    try {
      const stream = await playdl.stream(q.current.url, { quality: 2, seek: seconds });
      const { createAudioResource } = require('@discordjs/voice');
      const resource = createAudioResource(stream.stream, {
        inputType:    stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolumeLogarithmic(q.volume / 100);
      q.player.play(resource);

      const mm = Math.floor(seconds / 60);
      const ss = String(seconds % 60).padStart(2, '0');
      await i.reply(`⏩ Seeked to **${mm}:${ss}**.`);
    } catch {
      // Seek not supported for this stream type (e.g. live streams, non-webm)
      await i.reply({ content: '❌ Seek is not supported for this track type.', ephemeral: true });
    }
  },
};
