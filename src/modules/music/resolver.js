'use strict';

const playdl = require('play-dl');

const BATCH_SIZE   = 5;   // max concurrent YouTube searches for Spotify playlists
const SEARCH_LIMIT = 1;

/**
 * Resolves a query to an array of track objects.
 * Supports: YouTube URL, YouTube playlist, Spotify track/album/playlist, text search.
 */
async function resolve(query, requester) {
  if (playdl.is_expired?.()) await playdl.refreshToken().catch(() => {});

  if (/^https?:\/\/(open\.)?spotify\.com\//.test(query)) {
    return resolveSpotify(query, requester);
  }

  if (/[&?]list=/.test(query) && /youtu/.test(query)) {
    return resolveYoutubePlaylist(query, requester);
  }

  if (/youtu\.?be/.test(query)) {
    const info = await playdl.video_info(query);
    return [makeTrack(info.video_details, requester)];
  }

  const results = await playdl.search(query, { limit: SEARCH_LIMIT, source: { youtube: 'video' } });
  if (!results.length) throw new Error('No results found for that query.');
  return [makeTrack(results[0], requester)];
}

async function resolveYoutubePlaylist(url, requester) {
  const pl     = await playdl.playlist_info(url, { incomplete: true });
  const videos = await pl.all_videos();
  return videos.map(v => makeTrack(v, requester));
}

async function resolveSpotify(url, requester) {
  const sp = await playdl.spotify(url).catch(() => null);
  if (!sp) throw new Error('Could not resolve Spotify URL. Check your SPOTIFY_* credentials.');

  if (url.includes('/track/')) {
    const artistName = sp.artists?.[0]?.name ?? '';
    const results    = await playdl.search(`${sp.name} ${artistName}`, { limit: SEARCH_LIMIT, source: { youtube: 'video' } });
    if (!results.length) throw new Error(`No YouTube match for: ${sp.name}`);
    return [makeTrack(results[0], requester, sp.name)];
  }

  if (url.includes('/playlist/') || url.includes('/album/')) {
    const tracks = await sp.all_tracks();
    // Batch to avoid hammering YouTube with 500 simultaneous requests
    const resolved = [];
    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const batch   = tracks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(t => playdl.search(
          `${t.name} ${t.artists?.[0]?.name ?? ''}`,
          { limit: SEARCH_LIMIT, source: { youtube: 'video' } }
        ))
      );
      for (let j = 0; j < batch.length; j++) {
        const r = results[j];
        if (r.status === 'fulfilled' && r.value.length) {
          resolved.push(makeTrack(r.value[0], requester, batch[j].name));
        }
      }
      // Small delay between batches to be polite to YouTube
      if (i + BATCH_SIZE < tracks.length) await sleep(200);
    }
    if (!resolved.length) throw new Error('No tracks could be resolved from that Spotify URL.');
    return resolved;
  }

  throw new Error('Unsupported Spotify URL type. Use a track, album, or playlist link.');
}

/** Returns up to `limit` raw search results for the interactive search picker. */
async function search(query, limit = 5) {
  return playdl.search(query, { limit, source: { youtube: 'video' } });
}

function makeTrack(v, requester, overrideTitle) {
  return {
    title:     overrideTitle ?? v.title ?? 'Unknown',
    url:       v.url,
    duration:  v.durationRaw ?? formatSeconds(v.durationInSec ?? 0),
    durationSec: v.durationInSec ?? 0,
    thumbnail: v.thumbnails?.[0]?.url ?? null,
    requester,
  };
}

function formatSeconds(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { resolve, search };
