'use strict';

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MusicQueue } = require('./musicQueue');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage personal saved playlists')
    .addSubcommand(s => s.setName('save')
      .setDescription('Save the current queue as a playlist')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(s => s.setName('load')
      .setDescription('Load a saved playlist into the queue')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(s => s.setName('delete')
      .setDescription('Delete a saved playlist')
      .addStringOption(o => o.setName('name').setDescription('Playlist name').setRequired(true)))
    .addSubcommand(s => s.setName('list')
      .setDescription('List your saved playlists')),

  async execute(i, app) {
    const sub = i.options.getSubcommand();
    const uid = i.user.id;

    // ── save ──────────────────────────────────────────────────────────────
    if (sub === 'save') {
      const q = app.queues.get(i.guild.id);
      if (!q?.current && !q?.tracks.length) {
        return i.reply({ content: '❌ Nothing in the queue.', ephemeral: true });
      }
      const name   = i.options.getString('name').slice(0, 50).trim();
      const tracks = [q.current, ...(q.tracks ?? [])].filter(Boolean);

      app.db.prepare('INSERT OR REPLACE INTO playlists (user_id, name) VALUES (?, ?)').run(uid, name);
      const pl = app.db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(uid, name);

      // Transactional batch insert
      const ins = app.db.prepare(
        'INSERT INTO playlist_tracks (playlist_id, url, title, position) VALUES (?, ?, ?, ?)'
      );
      app.db.transaction(() => {
        app.db.prepare('DELETE FROM playlist_tracks WHERE playlist_id = ?').run(pl.id);
        tracks.forEach((t, idx) => ins.run(pl.id, t.url, t.title, idx));
      })();

      return i.reply({ content: `✅ Saved **${name}** (${tracks.length} tracks).`, ephemeral: true });
    }

    // ── load ──────────────────────────────────────────────────────────────
    if (sub === 'load') {
      const vc = i.member.voice.channel;
      if (!vc) return i.reply({ content: '❌ Join a voice channel first.', ephemeral: true });

      const name = i.options.getString('name');
      const pl   = app.db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(uid, name);
      if (!pl) return i.reply({ content: `❌ Playlist **${name}** not found.`, ephemeral: true });

      const dbTracks = app.db.prepare(
        'SELECT url, title FROM playlist_tracks WHERE playlist_id = ? ORDER BY position'
      ).all(pl.id);
      if (!dbTracks.length) return i.reply({ content: '❌ That playlist is empty.', ephemeral: true });

      await i.deferReply();

      let q = app.queues.get(i.guild.id);
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

      // Build track objects, then bulk-add AFTER connect is confirmed
      const tracks = dbTracks.map(t => ({
        title: t.title, url: t.url, duration: '?', requester: i.user.username,
      }));
      for (const t of tracks) await q.addTrack(t);

      return i.editReply(`✅ Loaded **${name}** — ${tracks.length} tracks added to the queue.`);
    }

    // ── delete ────────────────────────────────────────────────────────────
    if (sub === 'delete') {
      const name = i.options.getString('name');
      const pl   = app.db.prepare('SELECT id FROM playlists WHERE user_id = ? AND name = ?').get(uid, name);
      if (!pl) return i.reply({ content: `❌ Playlist **${name}** not found.`, ephemeral: true });
      app.db.prepare('DELETE FROM playlists WHERE id = ?').run(pl.id);
      return i.reply({ content: `✅ Deleted **${name}**.`, ephemeral: true });
    }

    // ── list ──────────────────────────────────────────────────────────────
    if (sub === 'list') {
      const rows = app.db.prepare(`
        SELECT p.name, COUNT(pt.id) AS cnt
        FROM playlists p
        LEFT JOIN playlist_tracks pt ON pt.playlist_id = p.id
        WHERE p.user_id = ?
        GROUP BY p.id
        ORDER BY p.name
      `).all(uid);
      if (!rows.length) return i.reply({ content: 'You have no saved playlists.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setColor(0x7c3aed)
        .setTitle('🎵 Your Playlists')
        .setDescription(rows.map(p => `**${p.name}** — ${p.cnt} track(s)`).join('\n'));
      return i.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
