'use strict';

const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { totalXpForLevel, xpForLevel } = require('./xpEngine');

let generateRankCard = null;
try { ({ generateRankCard } = require('./rankCard')); } catch {}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('View your XP rank card')
    .addUserOption(o => o.setName('user').setDescription('User to check (defaults to you)')),

  async execute(i, app) {
    await i.deferReply();

    const target = i.options.getUser('user') ?? i.user;
    const gid    = i.guild.id;

    const row = app.db.prepare('SELECT xp, level FROM levels WHERE guild_id = ? AND user_id = ?')
      .get(gid, target.id) ?? { xp: 0, level: 0 };

    // Rank = number of users with more XP than target + 1
    const { pos } = app.db.prepare(
      'SELECT COUNT(*) + 1 AS pos FROM levels WHERE guild_id = ? AND xp > ?'
    ).get(gid, row.xp);

    // XP within the current level (for the progress bar)
    const xpAtCurrentLevel  = totalXpForLevel(row.level);
    const xpForCurrentLevel = xpForLevel(row.level);   // XP needed to complete this level
    const xpIntoLevel       = row.xp - xpAtCurrentLevel;

    if (generateRankCard) {
      try {
        const buf  = await generateRankCard({
          username:  target.username,
          avatarURL: target.displayAvatarURL({ extension: 'png' }),
          level:     row.level,
          xp:        xpIntoLevel,
          xpNeeded:  xpForCurrentLevel,
          rank:      pos,
          totalXp:   row.xp,
        });
        return i.editReply({ files: [new AttachmentBuilder(buf, { name: 'rank.png' })] });
      } catch {}
    }

    // Text fallback
    const pct = Math.round((xpIntoLevel / xpForCurrentLevel) * 100);
    await i.editReply(
      `**${target.username}** — Rank **#${pos}** · Level **${row.level}** · `
      + `${xpIntoLevel.toLocaleString()} / ${xpForCurrentLevel.toLocaleString()} XP (${pct}%)`
    );
  },
};
