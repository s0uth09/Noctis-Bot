'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MusicQueue } = require('./musicQueue');
const { resolve }    = require('./resolver');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song, YouTube URL, playlist, or Spotify link')
    .addStringOption(o =>
      o.setName('query').setDescription('URL or search term').setRequired(true)
    ),

  async execute(i, app) {
    const vc = i.member.voice.channel;
    if (!vc) return i.reply({ content: '❌ Join a voice channel first.', ephemeral: true });

    // If bot is already in a different VC, refuse rather than silently doing nothing
    const existing = app.queues.get(i.guild.id);
    if (existing && existing.voiceChannel.id !== vc.id) {
      return i.reply({
        content: `❌ I'm already playing in <#${existing.voiceChannel.id}>. Join that channel or use \`/stop\` first.`,
        ephemeral: true,
      });
    }

    await i.deferReply();

    let tracks;
    try {
      tracks = await resolve(i.options.getString('query'), i.user.username);
    } catch (e) {
      return i.editReply(`❌ ${e.message}`);
    }
    if (!tracks.length) return i.editReply('❌ No playable tracks found.');

    let q = existing;
    if (!q) {
      q = new MusicQueue(app, i.guild, vc, i.channel);
      app.queues.set(i.guild.id, q);
      try {
        await q.connect();
      } catch {
        app.queues.delete(i.guild.id);
        return i.editReply('❌ Could not connect to voice channel.');
      }
    }

    for (const t of tracks) await q.addTrack(t);

    const single = tracks.length === 1;
    const embed  = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle(single ? '🎵 Added to Queue' : `🎵 Added ${tracks.length} tracks`)
      .setDescription(
        single
          ? `[${tracks[0].title}](${tracks[0].url}) \`${tracks[0].duration}\``
          : tracks.slice(0, 5).map(t => `• ${t.title}`).join('\n') +
            (tracks.length > 5 ? `\n…and **${tracks.length - 5}** more` : '')
      )
      .setFooter({ text: `Requested by ${i.user.username}` });

    if (single && tracks[0].thumbnail) embed.setThumbnail(tracks[0].thumbnail);
    await i.editReply({ embeds: [embed] });
  },
};
