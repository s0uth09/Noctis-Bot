module.exports = async function buttonHandler(i, app) {
  const id = i.customId;

  // ── Ticket ──────────────────────────────────────────────────────────────
  if (id === 'ticket:open') {
    const { openTicket } = require('./ticket');
    return openTicket(i, app);
  }
  if (id === 'ticket:close') {
    const { closeTicket } = require('./ticket');
    return closeTicket(i.channel, i.guild, app, i);
  }

  // ── Last.fm: Play in Discord ────────────────────────────────────────────
  if (id.startsWith('fm:play:')) {
    const query = decodeURIComponent(id.replace('fm:play:', ''));
    const vc    = i.member?.voice?.channel;
    if (!vc) return i.reply({ content: '❌ Join a voice channel first.', ephemeral: true });

    await i.deferReply({ ephemeral: true });
    const { resolve }    = require('../music/resolver');
    const { MusicQueue } = require('../music/musicQueue');

    try {
      const tracks = await resolve(query, i.user.username);
      let q = app.queues.get(i.guild.id);
      if (!q) {
        q = new MusicQueue(app, i.guild, vc, i.channel);
        app.queues.set(i.guild.id, q);
        await q.connect();
      }
      for (const t of tracks) await q.addTrack(t);
      await i.editReply(`✅ Added **${tracks[0].title}** to the queue.`);
    } catch (e) {
      await i.editReply(`❌ ${e.message}`);
    }
    return;
  }
};
