const {
  createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus,
  entersState, joinVoiceChannel,
  NoSubscriberBehavior,
} = require('@discordjs/voice');
const playdl = require('play-dl');

class MusicQueue {
  constructor(app, guild, voiceChannel, textChannel) {
    this.app          = app;
    this.guild        = guild;
    this.voiceChannel = voiceChannel;
    this.textChannel  = textChannel;
    this.tracks       = [];   // { title, url, duration, thumbnail, requester }
    this.current      = null;
    this.loopMode     = 'none'; // 'none' | 'track' | 'queue'
    this.volume       = 80;
    this.playing      = false;
    this._247         = false;
    this.player       = null;
    this.connection   = null;
    this._idleTimer   = null;
  }

  async connect() {
    this.connection = joinVoiceChannel({
      channelId:      this.voiceChannel.id,
      guildId:        this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
    });

    await entersState(this.connection, VoiceConnectionStatus.Ready, 20_000);

    this.player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => this._onIdle());
    this.player.on('error', (e) => {
      this.app.logger.error(e);
      this._onIdle();
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
        // reconnected
      } catch {
        this.destroy();
      }
    });
  }

  async addTrack(track) {
    this.tracks.push(track);
    if (!this.playing) await this._playNext();
  }

  async _playNext() {
    clearTimeout(this._idleTimer);

    if (!this.tracks.length) {
      this.current = null;
      this.playing = false;
      if (!this._247) {
        this._idleTimer = setTimeout(() => this.destroy(), 300_000); // 5 min auto-leave
      }
      return;
    }

    const track = this.tracks.shift();
    this.current    = track;
    this.playing    = true;
    this._startedAt = Date.now(); // used by /nowplaying progress bar

    try {
      const stream   = await playdl.stream(track.url, { quality: 2 });
      const resource = createAudioResource(stream.stream, {
        inputType:    stream.type,
        inlineVolume: true,
      });
      resource.volume?.setVolumeLogarithmic(this.volume / 100);
      this.player.play(resource);
    } catch (e) {
      this.app.logger.error(e);
      await this.textChannel
        .send(`⚠️ Failed to play **${track.title}**, skipping…`)
        .catch(() => {});
      await this._playNext();
    }
  }

  _onIdle() {
    if (this.loopMode === 'track' && this.current) {
      this.tracks.unshift({ ...this.current });
    } else if (this.loopMode === 'queue' && this.current) {
      this.tracks.push({ ...this.current });
    }
    this._playNext();
  }

  skip(count = 1) {
    // Remove extra tracks before the next one if skipping multiple
    if (count > 1) this.tracks.splice(0, count - 1);
    // Suppress loop for one cycle so the current track isn't re-queued on skip
    const saved    = this.loopMode;
    this.loopMode  = 'none';
    this.player?.stop();
    // Restore after a tick so _onIdle runs first
    setImmediate(() => { this.loopMode = saved; });
  }

  pause()  { this.player?.pause(); }
  resume() { this.player?.unpause(); }

  stop() {
    this.tracks  = [];
    this.current = null;
    this.player?.stop();
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(200, vol));
    const resource = this.player?.state?.resource;
    if (resource?.volume) {
      resource.volume.setVolumeLogarithmic(this.volume / 100);
    }
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  setLoop(mode) { this.loopMode = mode; }

  destroy() {
    clearTimeout(this._idleTimer);
    this.player?.stop(true);
    try { this.connection?.destroy(); } catch {}
    this.app.queues.delete(this.guild.id);
  }
}

module.exports = { MusicQueue };
