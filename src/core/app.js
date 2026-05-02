'use strict';

const { Client, GatewayIntentBits, Partials, Collection } = require('discord.js');
const db                  = require('../infra/db');
const logger              = require('../infra/logger');
const { makeConfigStore } = require('../infra/cache');
const loader              = require('./loader');
const events              = require('./events');

async function buildApp() {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.MessageContent,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
      Partials.User,
      Partials.GuildMember,
    ],
    // Reduce cache bloat — only cache what we actively need
    makeCache: require('@discordjs/voice') && undefined, // default cache
  });

  const app = {
    client,
    db,
    logger,
    cfg:      makeConfigStore(db),   // cached config layer — use app.cfg.get/set everywhere
    commands: new Collection(),
    queues:   new Map(),             // guildId → MusicQueue
  };

  loader(app);
  events(app);

  client.once('ready', () => {
    logger.info(`✅ Logged in as ${client.user.tag} (${client.user.id})`);
    logger.info(`   Serving ${client.guilds.cache.size} guild(s)`);
    require('../infra/scheduler')(app);
    require('../infra/health')(app);
  });

  await require('../infra/playdlInit')();

  return app;
}

module.exports = { buildApp };
