'use strict';

const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { search } = require('./resolver');

// TTL for search cache: 2 minutes
const CACHE_TTL = 120_000;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search YouTube and pick a track from the results')
    .addStringOption(o =>
      o.setName('query').setDescription('Search terms').setRequired(true)
    ),

  async execute(i, app) {
    const vc = i.member.voice.channel;
    if (!vc) return i.reply({ content: '❌ Join a voice channel first.', ephemeral: true });

    await i.deferReply({ ephemeral: true });

    let results;
    try {
      results = await search(i.options.getString('query'), 5);
    } catch {
      return i.editReply('❌ Search failed. Try again.');
    }
    if (!results.length) return i.editReply('❌ No results found.');

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`search:${i.user.id}`)
      .setPlaceholder('Pick a track…')
      .addOptions(
        results.map((v, idx) => ({
          label:       v.title.slice(0, 100),
          description: `${v.durationRaw || '?'} — ${v.channel?.name || '?'}`.slice(0, 100),
          value:       String(idx),
        }))
      );

    // Cache with TTL — auto-cleanup via setTimeout
    if (!app._searchCache) app._searchCache = new Map();
    app._searchCache.set(i.user.id, { results, vcId: vc.id, channelId: i.channelId });
    setTimeout(() => app._searchCache?.delete(i.user.id), CACHE_TTL);

    await i.editReply({
      content:    '🔍 Pick a track:',
      components: [new ActionRowBuilder().addComponents(menu)],
    });
  },
};
