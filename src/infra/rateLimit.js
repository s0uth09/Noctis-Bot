'use strict';

/**
 * Simple in-process rate limiter for slash commands.
 * Buckets: per user×command.
 * Defaults: most commands = 3 s, music = 2 s, moderation = 0 s (no limit).
 */

// command name → cooldown ms (0 = no limit)
const COOLDOWNS = {
  play:     2_000,
  search:   3_000,
  skip:     1_500,
  volume:   1_500,
  seek:     2_000,
  queue:    2_000,
  rank:     5_000,
  leaderboard: 8_000,
  fm:       4_000,
  poll:     10_000,
  giveaway: 5_000,
  remind:   3_000,
  snipe:    3_000,
  tag:      2_000,
  userinfo: 3_000,
  serverinfo: 5_000,
  avatar:   3_000,
  botstats: 10_000,
};

const DEFAULT_COOLDOWN = 2_000;
const MOD_COMMANDS = new Set(['kick','ban','unban','timeout','warn','purge','lock','filter','note','automod','slowmode','config','setup','welcome','ticket','levelroles','reactionrole']);

// Map<`userId:command`, expiresAt>
const _buckets = new Map();

// Prune expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, exp] of _buckets) {
    if (now > exp) _buckets.delete(k);
  }
}, 300_000).unref(); // .unref() so it doesn't keep the process alive

/**
 * @returns {number} remaining cooldown ms, or 0 if allowed
 */
function check(userId, commandName) {
  if (MOD_COMMANDS.has(commandName)) return 0;

  const cd  = COOLDOWNS[commandName] ?? DEFAULT_COOLDOWN;
  if (cd === 0) return 0;

  const key = `${userId}:${commandName}`;
  const exp = _buckets.get(key) ?? 0;
  const now = Date.now();

  if (now < exp) return exp - now;

  _buckets.set(key, now + cd);
  return 0;
}

module.exports = { check };
