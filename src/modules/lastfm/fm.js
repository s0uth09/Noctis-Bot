const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const BASE = 'https://ws.audioscrobbler.com/2.0/';

async function lfm(params, app) {
  if (!process.env.LASTFM_API_KEY) throw new Error('LASTFM_API_KEY not set in .env');
  const url = new URL(BASE);
  url.search = new URLSearchParams({ ...params, api_key: process.env.LASTFM_API_KEY, format: 'json' }).toString();
  const res  = await fetch(url.toString());
  const data = await res.json();
  if (data.error) throw new Error(data.message || 'Last.fm API error');
  return data;
}

function getUser(db, userId) {
  return db.prepare('SELECT username FROM lastfm WHERE user_id = ?').get(userId)?.username;
}

// ── /fm ───────────────────────────────────────────────────────────────────────
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fm')
    .setDescription('Last.fm integration')
    .addSubcommand(s => s.setName('set')
      .setDescription('Link your Last.fm username')
      .addStringOption(o => o.setName('username').setDescription('Last.fm username').setRequired(true)))
    .addSubcommand(s => s.setName('now').setDescription('Show what you are listening to'))
    .addSubcommand(s => s.setName('recent')
      .setDescription('Show recent scrobbles')
      .addUserOption(o => o.setName('user').setDescription('Discord user')))
    .addSubcommand(s => s.setName('topartists')
      .setDescription('Top artists')
      .addStringOption(o => o.setName('period').setDescription('Period').addChoices(
        { name: 'Overall', value: 'overall' }, { name: '7 days', value: '7day' },
        { name: '1 month', value: '1month' }, { name: '3 months', value: '3month' },
        { name: '6 months', value: '6month' }, { name: '1 year', value: '12month' },
      )))
    .addSubcommand(s => s.setName('toptracks')
      .setDescription('Top tracks')
      .addStringOption(o => o.setName('period').setDescription('Period').addChoices(
        { name: 'Overall', value: 'overall' }, { name: '7 days', value: '7day' },
        { name: '1 month', value: '1month' }, { name: '3 months', value: '3month' },
        { name: '6 months', value: '6month' }, { name: '1 year', value: '12month' },
      )))
    .addSubcommand(s => s.setName('topalbums')
      .setDescription('Top albums')
      .addStringOption(o => o.setName('period').setDescription('Period').addChoices(
        { name: 'Overall', value: 'overall' }, { name: '7 days', value: '7day' },
        { name: '1 month', value: '1month' }, { name: '3 months', value: '3month' },
        { name: '6 months', value: '6month' }, { name: '1 year', value: '12month' },
      )))
    .addSubcommand(s => s.setName('profile')
      .setDescription('View Last.fm profile')
      .addUserOption(o => o.setName('user').setDescription('Discord user')))
    .addSubcommand(s => s.setName('compare')
      .setDescription('Compare taste with another user')
      .addUserOption(o => o.setName('user').setDescription('Discord user').setRequired(true))),

  async execute(i, app) {
    const sub = i.options.getSubcommand();

    // ── set ──────────────────────────────────────────────────────────────
    if (sub === 'set') {
      const username = i.options.getString('username');
      // Verify the user exists on Last.fm
      try { await lfm({ method: 'user.getInfo', user: username }, app); } catch {
        return i.reply({ content: '❌ Last.fm user not found.', ephemeral: true });
      }
      app.db.prepare('INSERT OR REPLACE INTO lastfm (user_id, username) VALUES (?, ?)').run(i.user.id, username);
      return i.reply({ content: `✅ Linked to Last.fm as **${username}**.`, ephemeral: true });
    }

    // ── now ──────────────────────────────────────────────────────────────
    if (sub === 'now') {
      await i.deferReply();
      const lfmUser = getUser(app.db, i.user.id);
      if (!lfmUser) return i.editReply('❌ Link your Last.fm first with `/fm set`.');
      try {
        const data  = await lfm({ method: 'user.getRecentTracks', user: lfmUser, limit: 1, extended: 1 }, app);
        const track = data.recenttracks?.track?.[0];
        if (!track) return i.editReply('❌ No recent scrobbles found.');

        const isNow = track['@attr']?.nowplaying === 'true';
        const art   = track.image?.find(im => im.size === 'large')?.['#text'] || null;

        const embed = new EmbedBuilder()
          .setColor(0xd51007)
          .setTitle(isNow ? '▶ Now Playing' : '⏸ Last Played')
          .setDescription(`**[${track.name}](${track.url})**\nby **${track.artist?.['#text'] || track.artist?.name}**\non *${track.album?.['#text']}*`)
          .setFooter({ text: `Last.fm: ${lfmUser}` })
          .setTimestamp();
        if (art) embed.setThumbnail(art);

        // ▶ Play in Discord button
        const components = [];
        if (isNow) {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`fm:play:${encodeURIComponent(track.name + ' ' + (track.artist?.['#text'] || ''))}`)
              .setLabel('▶ Play in Discord')
              .setStyle(ButtonStyle.Success)
          );
          components.push(row);
        }

        await i.editReply({ embeds: [embed], components });
      } catch (e) {
        await i.editReply(`❌ ${e.message}`);
      }
      return;
    }

    // ── recent ───────────────────────────────────────────────────────────
    if (sub === 'recent') {
      await i.deferReply();
      const target  = i.options.getUser('user') || i.user;
      const lfmUser = getUser(app.db, target.id);
      if (!lfmUser) return i.editReply(`❌ ${target.username} hasn't linked their Last.fm.`);
      try {
        const data   = await lfm({ method: 'user.getRecentTracks', user: lfmUser, limit: 10 }, app);
        const tracks = data.recenttracks?.track || [];
        const lines  = tracks.slice(0, 10).map((t, idx) => {
          const now = t['@attr']?.nowplaying === 'true' ? ' ▶' : '';
          return `**${idx + 1}.** ${t.name} — ${t.artist?.['#text']}${now}`;
        });
        const embed = new EmbedBuilder()
          .setColor(0xd51007)
          .setTitle(`🎵 Recent tracks — ${lfmUser}`)
          .setDescription(lines.join('\n'));
        await i.editReply({ embeds: [embed] });
      } catch (e) {
        await i.editReply(`❌ ${e.message}`);
      }
      return;
    }

    // ── topartists / toptracks / topalbums ───────────────────────────────
    if (['topartists', 'toptracks', 'topalbums'].includes(sub)) {
      await i.deferReply();
      const lfmUser = getUser(app.db, i.user.id);
      if (!lfmUser) return i.editReply('❌ Link your Last.fm first.');
      const period = i.options.getString('period') || 'overall';
      const methodMap = { topartists: 'user.getTopArtists', toptracks: 'user.getTopTracks', topalbums: 'user.getTopAlbums' };
      const keyMap    = { topartists: 'topartists', toptracks: 'toptracks', topalbums: 'topalbums' };
      const arrKey    = { topartists: 'artist', toptracks: 'track', topalbums: 'album' };
      try {
        const data  = await lfm({ method: methodMap[sub], user: lfmUser, period, limit: 10 }, app);
        const items = data[keyMap[sub]]?.[arrKey[sub]] || [];
        const lines = items.map((t, idx) => {
          const name  = t.name;
          const plays = t.playcount;
          return `**${idx + 1}.** ${name} — ${plays} plays`;
        });
        const embed = new EmbedBuilder()
          .setColor(0xd51007)
          .setTitle(`🎵 Top ${sub.replace('top', '')} — ${lfmUser} (${period})`)
          .setDescription(lines.join('\n') || 'No data.');
        await i.editReply({ embeds: [embed] });
      } catch (e) {
        await i.editReply(`❌ ${e.message}`);
      }
      return;
    }

    // ── profile ──────────────────────────────────────────────────────────
    if (sub === 'profile') {
      await i.deferReply();
      const target  = i.options.getUser('user') || i.user;
      const lfmUser = getUser(app.db, target.id);
      if (!lfmUser) return i.editReply(`❌ ${target.username} hasn't linked their Last.fm.`);
      try {
        const data = await lfm({ method: 'user.getInfo', user: lfmUser }, app);
        const u    = data.user;
        const embed = new EmbedBuilder()
          .setColor(0xd51007)
          .setTitle(`Last.fm: ${u.name}`)
          .setURL(u.url)
          .addFields(
            { name: 'Scrobbles', value: u.playcount,                                   inline: true },
            { name: 'Artists',   value: u.artist_count || '—',                         inline: true },
            { name: 'Country',   value: u.country || '—',                              inline: true },
            { name: 'Registered', value: `<t:${u.registered?.unixtime}:R>`,            inline: true },
          );
        if (u.image?.[2]?.['#text']) embed.setThumbnail(u.image[2]['#text']);
        await i.editReply({ embeds: [embed] });
      } catch (e) {
        await i.editReply(`❌ ${e.message}`);
      }
      return;
    }

    // ── compare ──────────────────────────────────────────────────────────
    if (sub === 'compare') {
      await i.deferReply();
      const target   = i.options.getUser('user');
      const lfmSelf  = getUser(app.db, i.user.id);
      const lfmOther = getUser(app.db, target.id);
      if (!lfmSelf)  return i.editReply('❌ Link your own Last.fm first.');
      if (!lfmOther) return i.editReply(`❌ ${target.username} hasn't linked their Last.fm.`);

      try {
        // Fetch top artists for both users and compute overlap
        const [d1, d2] = await Promise.all([
          lfm({ method: 'user.getTopArtists', user: lfmSelf,  period: 'overall', limit: 50 }, app),
          lfm({ method: 'user.getTopArtists', user: lfmOther, period: 'overall', limit: 50 }, app),
        ]);
        const artists1 = new Set((d1.topartists?.artist || []).map(a => a.name.toLowerCase()));
        const shared   = (d2.topartists?.artist || []).filter(a => artists1.has(a.name.toLowerCase()));
        const score    = Math.round((shared.length / 50) * 100);
        const sharedList = shared.slice(0, 10).map(a => a.name).join(', ') || 'None';

        const embed = new EmbedBuilder()
          .setColor(0xd51007)
          .setTitle(`🎵 Taste Comparison`)
          .setDescription(`**${lfmSelf}** vs **${lfmOther}**`)
          .addFields(
            { name: 'Compatibility', value: `**${score}%**`, inline: true },
            { name: 'Shared Artists (top 10)', value: sharedList },
          );
        await i.editReply({ embeds: [embed] });
      } catch (e) {
        await i.editReply(`❌ ${e.message}`);
      }
    }
  },
};
