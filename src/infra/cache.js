'use strict';

/**
 * Thin config cache sitting in front of SQLite.
 * - Per-guild TTL of 60 s (config rarely changes; commands explicitly invalidate on write).
 * - Exposes getConfig / setConfig / delConfig so every module uses one path.
 * - All prepared statements are compiled once and reused.
 */

const CACHE_TTL_MS = 60_000;

// Map<guildId, { data: Map<key,value>, ts: number }>
const _cache = new Map();

/** @param {import('better-sqlite3').Database} db */
function makeConfigStore(db) {
  const stmtGet    = db.prepare('SELECT value FROM config WHERE guild_id = ? AND key = ?');
  const stmtGetAll = db.prepare('SELECT key, value FROM config WHERE guild_id = ?');
  const stmtSet    = db.prepare('INSERT OR REPLACE INTO config (guild_id, key, value) VALUES (?, ?, ?)');
  const stmtDel    = db.prepare('DELETE FROM config WHERE guild_id = ? AND key = ?');

  function _load(guildId) {
    const rows = stmtGetAll.all(guildId);
    const data = new Map(rows.map(r => [r.key, r.value]));
    _cache.set(guildId, { data, ts: Date.now() });
    return data;
  }

  function _getMap(guildId) {
    const entry = _cache.get(guildId);
    if (entry && Date.now() - entry.ts < CACHE_TTL_MS) return entry.data;
    return _load(guildId);
  }

  return {
    /** @returns {string|null} */
    get(guildId, key) {
      return _getMap(guildId).get(key) ?? null;
    },

    /** @returns {Record<string,string>} */
    getAll(guildId) {
      return Object.fromEntries(_getMap(guildId));
    },

    set(guildId, key, value) {
      stmtSet.run(guildId, key, String(value));
      // update cache in-place so the next read is instant
      const entry = _cache.get(guildId);
      if (entry) entry.data.set(key, String(value));
    },

    del(guildId, key) {
      stmtDel.run(guildId, key);
      const entry = _cache.get(guildId);
      if (entry) entry.data.delete(key);
    },

    /** Force-expire a guild's cache (e.g. after bulk changes). */
    invalidate(guildId) {
      _cache.delete(guildId);
    },
  };
}

module.exports = { makeConfigStore };
