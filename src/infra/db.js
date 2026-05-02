const Database = require('better-sqlite3');
const path = require('path');
const fs   = require('fs');

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'noctis.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
-- Guild configuration
CREATE TABLE IF NOT EXISTS config (
  guild_id          TEXT NOT NULL,
  key               TEXT NOT NULL,
  value             TEXT,
  PRIMARY KEY (guild_id, key)
);

-- XP / leveling
CREATE TABLE IF NOT EXISTS levels (
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  xp        INTEGER NOT NULL DEFAULT 0,
  level     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- Level role rewards
CREATE TABLE IF NOT EXISTS level_roles (
  guild_id  TEXT NOT NULL,
  level     INTEGER NOT NULL,
  role_id   TEXT NOT NULL,
  PRIMARY KEY (guild_id, level)
);

-- Moderation: warns
CREATE TABLE IF NOT EXISTS warns (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  mod_id    TEXT NOT NULL,
  reason    TEXT,
  ts        INTEGER NOT NULL
);

-- Moderation: mod notes (private)
CREATE TABLE IF NOT EXISTS notes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  mod_id    TEXT NOT NULL,
  note      TEXT NOT NULL,
  ts        INTEGER NOT NULL
);

-- AutoMod per-guild rules
CREATE TABLE IF NOT EXISTS automod (
  guild_id        TEXT PRIMARY KEY,
  antispam        INTEGER DEFAULT 1,
  antiinvite      INTEGER DEFAULT 1,
  anticaps        INTEGER DEFAULT 1,
  maxmentions     INTEGER DEFAULT 5
);

-- Word filter
CREATE TABLE IF NOT EXISTS wordfilter (
  guild_id  TEXT NOT NULL,
  word      TEXT NOT NULL,
  PRIMARY KEY (guild_id, word)
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'open',
  ts          INTEGER NOT NULL
);

-- Reaction roles
CREATE TABLE IF NOT EXISTS reaction_roles (
  guild_id    TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  emoji       TEXT NOT NULL,
  role_id     TEXT NOT NULL,
  exclusive   INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, message_id, emoji)
);

-- AFK
CREATE TABLE IF NOT EXISTS afk (
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  reason    TEXT,
  ts        INTEGER NOT NULL,
  PRIMARY KEY (guild_id, user_id)
);

-- Birthdays
CREATE TABLE IF NOT EXISTS birthdays (
  guild_id  TEXT NOT NULL,
  user_id   TEXT NOT NULL,
  month     INTEGER NOT NULL,
  day       INTEGER NOT NULL,
  year      INTEGER,
  PRIMARY KEY (guild_id, user_id)
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  message   TEXT NOT NULL,
  fire_at   INTEGER NOT NULL,
  done      INTEGER DEFAULT 0
);

-- Giveaways
CREATE TABLE IF NOT EXISTS giveaways (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id    TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  message_id  TEXT,
  host_id     TEXT NOT NULL,
  prize       TEXT NOT NULL,
  winners     INTEGER NOT NULL DEFAULT 1,
  ends_at     INTEGER NOT NULL,
  ended       INTEGER DEFAULT 0
);

-- Tags (server text snippets)
CREATE TABLE IF NOT EXISTS tags (
  guild_id  TEXT NOT NULL,
  name      TEXT NOT NULL,
  content   TEXT NOT NULL,
  author_id TEXT NOT NULL,
  uses      INTEGER DEFAULT 0,
  PRIMARY KEY (guild_id, name)
);

-- Last.fm accounts
CREATE TABLE IF NOT EXISTS lastfm (
  user_id   TEXT PRIMARY KEY,
  username  TEXT NOT NULL
);

-- Snipe (last deleted message per channel)
CREATE TABLE IF NOT EXISTS snipe (
  channel_id  TEXT PRIMARY KEY,
  content     TEXT,
  author_id   TEXT,
  author_tag  TEXT,
  ts          INTEGER
);

-- Saved playlists
CREATE TABLE IF NOT EXISTS playlists (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   TEXT NOT NULL,
  name      TEXT NOT NULL,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  title       TEXT NOT NULL,
  position    INTEGER NOT NULL
);

-- Starboard
CREATE TABLE IF NOT EXISTS starboard (
  guild_id        TEXT NOT NULL,
  source_msg_id   TEXT NOT NULL,
  star_msg_id     TEXT NOT NULL,
  stars           INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (guild_id, source_msg_id)
);
`);

module.exports = db;
