const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

/** Build a visual progress bar. e.g. ▬▬▬🔘▬▬▬▬▬▬ */
function buildProgressBar(elapsedSec, totalSec, width = 14) {
  if (!totalSec) return '';
  const ratio    = Math.min(elapsedSec / totalSec, 1);
  const filled   = Math.round(ratio * width);
  const bar      = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, width - filled));
  return `${bar}  \`${fmtTime(elapsedSec)} / ${fmtTime(totalSec)}\``;
}

/** Seconds → mm:ss or h:mm:ss */
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

/** Sum durationSec for all tracks in the queue array */
function totalDuration(tracks) {
  const total = tracks.reduce((acc, t) => acc + (t.durationSec ?? 0), 0);
  return total ? fmtTime(total) : null;
}

// Helper: get queue or reply with error
function getQ(i, app) {
  const q = app.queues.get(i.guild.id);
  if (!q) { i.reply({ content: '❌ Nothing playing.', ephemeral: true }); return null; }
  return q;
}

// ── /nowplaying ──────────────────────────────────────────────────────────────
const nowplaying = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show currently playing track'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const t = q.current;
    if (!t) return i.reply({ content: '❌ Nothing playing.', ephemeral: true });
    const elapsedSec = q._startedAt ? Math.floor((Date.now() - q._startedAt) / 1000) : 0;
    const progressBar = buildProgressBar(elapsedSec, t.durationSec ?? 0);

    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('🎵 Now Playing')
      .setDescription(`[${t.title}](${t.url})\n\n${progressBar}`)
      .addFields(
        { name: 'Requested by', value: t.requester, inline: true },
        { name: 'Volume',       value: `${q.volume}%`, inline: true },
        { name: 'Loop',         value: q.loopMode, inline: true },
      );
    if (t.thumbnail) embed.setThumbnail(t.thumbnail);
    await i.reply({ embeds: [embed] });
  },
};

// ── /skip ────────────────────────────────────────────────────────────────────
const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('Skip the current track')
    .addIntegerOption(o => o.setName('count').setDescription('Number of tracks to skip').setMinValue(1)),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const n = i.options.getInteger('count') || 1;
    q.skip(n);
    await i.reply(`⏭️ Skipped **${n}** track(s).`);
  },
};

// ── /pause ───────────────────────────────────────────────────────────────────
const pause = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause playback'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    q.pause();
    await i.reply('⏸️ Paused.');
  },
};

// ── /resume ──────────────────────────────────────────────────────────────────
const resume = {
  data: new SlashCommandBuilder().setName('resume').setDescription('Resume playback'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    q.resume();
    await i.reply('▶️ Resumed.');
  },
};

// ── /stop ────────────────────────────────────────────────────────────────────
const stop = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop music and clear the queue'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    q.destroy();
    await i.reply('⏹️ Stopped and left the channel.');
  },
};

// ── /volume ──────────────────────────────────────────────────────────────────
const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Set the playback volume')
    .addIntegerOption(o => o.setName('level').setDescription('0–200').setRequired(true).setMinValue(0).setMaxValue(200)),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const vol = i.options.getInteger('level');
    q.setVolume(vol);
    await i.reply(`🔊 Volume set to **${vol}%**.`);
  },
};

// ── /loop ────────────────────────────────────────────────────────────────────
const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Set loop mode')
    .addStringOption(o => o.setName('mode').setDescription('Loop mode').setRequired(true)
      .addChoices(
        { name: 'Off',   value: 'none' },
        { name: 'Track', value: 'track' },
        { name: 'Queue', value: 'queue' },
      )),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const mode = i.options.getString('mode');
    q.setLoop(mode);
    await i.reply(`🔁 Loop mode: **${mode}**.`);
  },
};

// ── /shuffle ─────────────────────────────────────────────────────────────────
const shuffle = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    if (!q.tracks.length) return i.reply({ content: '❌ Queue is empty.', ephemeral: true });
    q.shuffle();
    await i.reply('🔀 Queue shuffled.');
  },
};

// ── /clear ───────────────────────────────────────────────────────────────────
const clear = {
  data: new SlashCommandBuilder().setName('clear').setDescription('Clear the upcoming queue'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    q.tracks = [];
    await i.reply('🗑️ Queue cleared.');
  },
};

// ── /remove ──────────────────────────────────────────────────────────────────
const remove = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a track from the queue by position')
    .addIntegerOption(o => o.setName('position').setDescription('Queue position (1 = next)').setRequired(true).setMinValue(1)),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const pos = i.options.getInteger('position') - 1;
    if (pos >= q.tracks.length) return i.reply({ content: '❌ Invalid position.', ephemeral: true });
    const [removed] = q.tracks.splice(pos, 1);
    await i.reply(`✅ Removed **${removed.title}** from the queue.`);
  },
};

// ── /move ────────────────────────────────────────────────────────────────────
const move = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('Move a track to a new queue position')
    .addIntegerOption(o => o.setName('from').setDescription('Current position').setRequired(true).setMinValue(1))
    .addIntegerOption(o => o.setName('to').setDescription('New position').setRequired(true).setMinValue(1)),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    const from = i.options.getInteger('from') - 1;
    const to   = i.options.getInteger('to')   - 1;
    if (from >= q.tracks.length || to >= q.tracks.length)
      return i.reply({ content: '❌ Invalid position.', ephemeral: true });
    const [track] = q.tracks.splice(from, 1);
    q.tracks.splice(to, 0, track);
    await i.reply(`✅ Moved **${track.title}** to position **${to + 1}**.`);
  },
};

// ── /247 ─────────────────────────────────────────────────────────────────────
const always = {
  data: new SlashCommandBuilder().setName('247').setDescription('Toggle 24/7 mode (stay in VC even when idle)'),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;
    q._247 = !q._247;
    if (q._247) clearTimeout(q._idleTimer);
    await i.reply(`🔧 24/7 mode: **${q._247 ? 'ON' : 'OFF'}**.`);
  },
};

// ── /queue ───────────────────────────────────────────────────────────────────
const queue = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('View the current queue')
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setMinValue(1)),
  async execute(i, app) {
    const q = getQ(i, app); if (!q) return;

    const page     = (i.options.getInteger('page') || 1) - 1;
    const pageSize = 10;
    const start    = page * pageSize;
    const slice    = q.tracks.slice(start, start + pageSize);
    const total    = q.tracks.length;
    const pages    = Math.ceil(total / pageSize) || 1;

    const durStr  = totalDuration(q.tracks);
    const embed = new EmbedBuilder()
      .setColor(0x7c3aed)
      .setTitle('📋 Queue')
      .setDescription(
        (q.current ? `**Now:** ${q.current.title} \`${q.current.duration}\`\n\n` : '') +
        (slice.length
          ? slice.map((t, idx) => `**${start + idx + 1}.** ${t.title} \`${t.duration}\``).join('\n')
          : '*Queue is empty.*')
      )
      .setFooter({ text: `Page ${page + 1}/${pages} • ${total} track(s)${durStr ? ` — ${durStr} total` : ''} • Loop: ${q.loopMode}` });

    await i.reply({ embeds: [embed] });
  },
};

module.exports = { nowplaying, skip, pause, resume, stop, volume, loop, shuffle, clear, remove, move, always, queue };
