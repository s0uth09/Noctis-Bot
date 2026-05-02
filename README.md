# Noctis 

A private, self-hosted Discord bot replacing Startit, Welcomer, Carl-bot, DJ Bot, and Last.fm bot in a single codebase.

---

## Stack

- **Node.js 18+** — discord.js 14, @discordjs/voice, play-dl, canvas, genius-lyrics
- **SQLite** (better-sqlite3, WAL mode) — 18 tables, persists across restarts
- **pm2 ready** — `ecosystem.config.js` included
- **Railway ready** — works out of the box

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

> `canvas` requires native build tools. On Ubuntu/Debian:
> ```bash
> sudo apt install build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
> ```

### 3. Register slash commands

```bash
npm run deploy
```

This registers all commands globally (may take up to 1 hour to propagate).

### 4. Start the bot

```bash
npm start
# or with pm2:
pm2 start ecosystem.config.js
```

---

## Command Reference

| Category   | Commands |
|---|---|
| 🎵 Music   | `/play` `/search` `/queue` `/nowplaying` `/skip` `/pause` `/resume` `/stop` `/volume` `/seek` `/loop` `/shuffle` `/remove` `/move` `/clear` `/247` `/playlist` `/lyrics` |
| 🛡️ Moderation | `/kick` `/ban` `/unban` `/timeout` `/warn` `/purge` `/lock` `/filter` `/note` |
| 🤖 AutoMod | `/automod` `/slowmode` |
| 📊 Leveling | `/rank` `/leaderboard` `/levelroles` `/config` |
| 🎭 Utility  | `/help` `/setup` `/ticket` `/reactionrole` `/remind` `/giveaway` `/poll` `/tag` `/announce` `/snipe` `/avatar` `/roles` `/botstats` `/serverinfo` `/userinfo` `/welcome` `/afk` `/birthday` |
| 🎵 Last.fm  | `/fm set` `/fm now` `/fm recent` `/fm topartists` `/fm toptracks` `/fm topalbums` `/fm profile` `/fm compare` |
| 🎲 Fun      | `/fun coinflip` `/fun 8ball` `/fun choose` `/fun roll` `/fun reverse` |

---

## Initial Server Config

After starting, run these in your server:

```
/config mod_log          → #mod-log channel
/config audit_channel    → #audit-log channel
/welcome setchannel      → #welcome channel
/welcome setmessage      → Welcome {user} to {server}! You are member #{count}.
/ticket setup            → #support channel, @Support role
/config birthday_channel → #birthdays channel
```

---

## Last.fm Setup

1. Get an API key from https://www.last.fm/api/account/create
2. Add it to `.env` as `LASTFM_API_KEY`
3. Users link accounts with `/fm set <username>`
4. `/fm now` includes a **▶ Play in Discord** button that queues the scrobbled track

---

## Lyrics Setup

1. Get a token from https://genius.com/api-clients
2. Add it to `.env` as `GENIUS_TOKEN`

---

## Server Templates

```
/setup load community   → Creates roles, categories, channels for a community server
/setup load gaming      → Gaming server layout
/setup validate gaming  → Dry-run without making changes
/setup export           → Snapshot current server structure as JSON
```

---

## Database

SQLite at `./data/noctis.db` — 18 tables:

`config`, `levels`, `level_roles`, `warns`, `notes`, `automod`, `wordfilter`,
`tickets`, `reaction_roles`, `afk`, `birthdays`, `reminders`, `giveaways`,
`tags`, `lastfm`, `snipe`, `playlists`, `playlist_tracks`, `starboard`

---

## pm2 Deployment

```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## Starboard Setup

```
/config starboard_channel → #starboard channel
/config starboard_threshold → minimum ⭐ count (default: 3)
```

---

## Notes

- Music requires `@discordjs/opus` for audio encoding. If you get opus errors: `npm install @discordjs/opus`
- Spotify support requires `play-dl` to be configured with your Spotify credentials — run `node -e "const p = require('play-dl'); p.setToken({ spotify: { client_id: 'X', client_secret: 'Y', refresh_token: 'Z', market: 'PL' } })"` once to save tokens.
- The rank card image generation requires `canvas`. If canvas fails to build, `/rank` will fall back to a text response automatically.
