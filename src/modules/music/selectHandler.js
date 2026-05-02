'use strict';

const { EmbedBuilder } = require('discord.js');
const { MusicQueue }   = require('./musicQueue');

module.exports = async function selectHandler(i, app) {
  if (!i.customId.startsWith('search:')) return;

  const userId = i.customId.split(':')[1];
  if (i.user.id !== userId) {
    return i.reply({ content: '❌ This search belongs to someone else.', ephemeral: true });
  }

  const cache = app._searchCache?.get(userId);
  if (!cache) {
    return i.reply({ content: '❌ Search expired. Run `/search` again.', ephemeral: true });
  }
  app._searchCache.delete(userId);

  const video = cache.results[parseInt(i.values[0], 10)];
  if (!video) return i.reply({ content: '❌ Invalid selection.', ephemeral: true });

  const track = {
    title:      video.title.slice(0, 100),
    url:        video.url,
    duration:   video.durationRaw || '?',
    durationSec: video.durationInSec || 0,
    thumbnail:  video.thumbnails?.[0]?.url || null,
    requester:  i.user.username,
  };

  // Re-resolve the VC in case user moved
  const vc = i.member.voice.channel;
  if (!vc) {
    return i.update({ content: '❌ You left the voice channel.', components: [] });
  }

  let q = app.queues.get(i.guild.id);
  if (!q) {
    q = new MusicQueue(app, i.guild, vc, i.channel);
    app.queues.set(i.guild.id, q);
    try {
      await q.connect();
    } catch {
      app.queues.delete(i.guild.id);
      return i.update({ content: '❌ Could not connect to voice channel.', components: [] });
    }
  }

  await q.addTrack(track);

  const embed = new EmbedBuilder()
    .setColor(0x7c3aed)
    .setTitle('🎵 Added to Queue')
    .setDescription(`[${track.title}](${track.url}) \`${track.duration}\``)
    .setFooter({ text: `Requested by ${i.user.username}` });

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  await i.update({ embeds: [embed], components: [] });
};
