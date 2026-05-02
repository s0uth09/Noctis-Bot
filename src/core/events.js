const execute    = require('./execute');
const automod    = require('../modules/automod/engine');
const xpSystem   = require('../modules/leveling/xpEngine');
const afkSystem  = require('../modules/utility/afkEngine');

module.exports = function events(app) {
  const { client } = app;

  // ── Message ────────────────────────────────────────────────────────────
  client.on('messageCreate', async (msg) => {
    if (!msg.guild || msg.author.bot) return;
    try {
      await automod(msg, app);
      await xpSystem(msg, app);
      await afkSystem(msg, app);
    } catch (e) { app.logger.error(e); }
  });

  // ── Interactions ───────────────────────────────────────────────────────
  client.on('interactionCreate', async (i) => {
    // slash commands
    if (i.isChatInputCommand()) {
      const cmd = app.commands.get(i.commandName);
      if (!cmd) return;
      await execute(i, cmd, app);
      return;
    }

    // button interactions (tickets, music controls, giveaway, etc.)
    if (i.isButton()) {
      const handler = require('../modules/utility/buttonHandler');
      await handler(i, app).catch((e) => app.logger.error(e));
    }

    // select menu
    if (i.isStringSelectMenu()) {
      const handler = require('../modules/music/selectHandler');
      await handler(i, app).catch((e) => app.logger.error(e));
    }
  });

  // ── Reaction add/remove (reaction roles, starboard, giveaway) ─────────
  client.on('messageReactionAdd',    (r, u) => require('../modules/utility/reactionHandler')(r, u, 'add',    app).catch(e => app.logger.error(e)));
  client.on('messageReactionRemove', (r, u) => require('../modules/utility/reactionHandler')(r, u, 'remove', app).catch(e => app.logger.error(e)));

  // ── Guild member events (welcome, audit, xp reset guard) ──────────────
  client.on('guildMemberAdd',    (member) => require('../modules/utility/welcomeEngine')(member, app).catch(e => app.logger.error(e)));
  client.on('guildMemberRemove', (member) => require('../modules/utility/leaveEngine')(member, app).catch(e => app.logger.error(e)));
  client.on('guildMemberUpdate', (o, n)   => require('../infra/auditLog').memberUpdate(o, n, app).catch(e => app.logger.error(e)));

  // ── Message audit ──────────────────────────────────────────────────────
  client.on('messageUpdate', (o, n) => require('../infra/auditLog').messageEdit(o, n, app).catch(e => app.logger.error(e)));
  client.on('messageDelete', (m)    => require('../infra/auditLog').messageDelete(m, app).catch(e => app.logger.error(e)));

  // ── Voice audit ────────────────────────────────────────────────────────
  client.on('voiceStateUpdate', (o, n) => require('../infra/auditLog').voiceState(o, n, app).catch(e => app.logger.error(e)));
};
