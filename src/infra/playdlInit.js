'use strict';

const playdl = require('play-dl');
const logger = require('./logger');

module.exports = async function initPlaydlTokens() {
  const {
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET,
    SPOTIFY_REFRESH_TOKEN,
    SPOTIFY_MARKET = 'US',
    YOUTUBE_COOKIE,
    SOUNDCLOUD_CLIENT_ID,
  } = process.env;

  const tokenConfig = {};

  if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REFRESH_TOKEN) {
    tokenConfig.spotify = {
      client_id:     SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
      refresh_token: SPOTIFY_REFRESH_TOKEN,
      market:        SPOTIFY_MARKET,
    };
    logger.info('play-dl: Spotify credentials loaded');
  } else {
    logger.warn('play-dl: Spotify credentials missing — Spotify URLs disabled');
  }

  if (YOUTUBE_COOKIE) {
    tokenConfig.youtube = { cookie: YOUTUBE_COOKIE };
    logger.info('play-dl: YouTube cookie loaded');
  }

  if (SOUNDCLOUD_CLIENT_ID) {
    tokenConfig.soundcloud = { client_id: SOUNDCLOUD_CLIENT_ID };
    logger.info('play-dl: SoundCloud client_id loaded');
  }

  if (Object.keys(tokenConfig).length) {
    await playdl.setToken(tokenConfig);
  }

  if (tokenConfig.spotify) {
    try {
      await playdl.refreshToken();
      logger.info('play-dl: Spotify token refreshed successfully');
    } catch (e) {
      logger.warn(`play-dl: Spotify token refresh failed — ${e.message}`);
    }
  }
};
