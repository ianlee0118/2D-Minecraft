export class SoundManager {
  constructor() {
    this.ctx = null;
    this.volume = 1.0;
    this.muted = false;
    this.loadSettings();
  }

  loadSettings() {
    try {
      const raw = localStorage.getItem('game_settings');
      if (raw) {
        const settings = JSON.parse(raw);
        if (typeof settings.volume === 'number') this.volume = Math.max(0, Math.min(1, settings.volume));
        if (typeof settings.muted === 'boolean') this.muted = settings.muted;
      }
    } catch (_) { /* ignore corrupt data */ }
  }

  saveSettings() {
    try {
      let settings = {};
      try {
        const raw = localStorage.getItem('game_settings');
        if (raw) settings = JSON.parse(raw);
      } catch (_) { /* start fresh */ }
      settings.volume = this.volume;
      settings.muted = this.muted;
      localStorage.setItem('game_settings', JSON.stringify(settings));
    } catch (_) { /* storage unavailable */ }
  }

  ensureContext() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  play(name) {
    if (this.muted) return;
    const generator = this._sounds[name];
    if (!generator) return;
    try {
      const ctx = this.ensureContext();
      if (!ctx) return;
      generator.call(this, ctx);
    } catch (_) { /* gracefully ignore audio errors */ }
  }

  _makeGain(ctx, vol = 1.0) {
    const gain = ctx.createGain();
    gain.gain.value = vol * this.volume;
    gain.connect(ctx.destination);
    return gain;
  }

  _noise(ctx, duration, gain) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(gain);
    return src;
  }

  get _sounds() {
    return {
      mine_hit: this._mineHit,
      block_break: this._blockBreak,
      item_pickup: this._itemPickup,
      jump: this._jump,
      sword_hit: this._swordHit,
      bow_shot: this._bowShot,
      enemy_hurt: this._enemyHurt,
      enemy_death: this._enemyDeath,
      pistol_shot: this._pistolShot,
      player_hurt: this._playerHurt,
      player_death: this._playerDeath,
      click: this._click,
      warden_spawn: this._wardenSpawn,
      warden_hit: this._wardenHit,
      warden_death: this._wardenDeath,
      bus_horn: this._busHorn,
      poop_throw: this._poopThrow,
      poop_splat: this._poopSplat,
    };
  }

  _mineHit(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.4);
    g.gain.setValueAtTime(0.4 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  _blockBreak(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.5);
    g.gain.setValueAtTime(0.5 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const noise = this._noise(ctx, 0.15, g);
    noise.start(t);
    noise.stop(t + 0.15);

    const g2 = this._makeGain(ctx, 0.3);
    g2.gain.setValueAtTime(0.3 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  _itemPickup(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.3);
    g.gain.setValueAtTime(0.3 * this.volume, t);
    g.gain.setValueAtTime(0.3 * this.volume, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(1200, t + 0.07);
    osc.frequency.setValueAtTime(1400, t + 0.08);
    osc.frequency.exponentialRampToValueAtTime(1800, t + 0.14);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  _jump(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.2);
    g.gain.setValueAtTime(0.2 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    const noise = this._noise(ctx, 0.18, g);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1000, t);
    filter.frequency.exponentialRampToValueAtTime(3000, t + 0.18);
    filter.Q.value = 0.5;
    noise.disconnect();
    noise.connect(filter);
    filter.connect(g);

    noise.start(t);
    noise.stop(t + 0.18);
  }

  _swordHit(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.35);
    g.gain.setValueAtTime(0.35 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const noise = this._noise(ctx, 0.1, g);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4000;
    noise.disconnect();
    noise.connect(filter);
    filter.connect(g);
    noise.start(t);
    noise.stop(t + 0.1);

    const g2 = this._makeGain(ctx, 0.25);
    g2.gain.setValueAtTime(0.25 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2000, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.08);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  _bowShot(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.3);
    g.gain.setValueAtTime(0.3 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.2);

    const g2 = this._makeGain(ctx, 0.15);
    g2.gain.setValueAtTime(0.15 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(400, t);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.15);
    osc2.connect(g2);
    osc2.start(t);
    osc2.stop(t + 0.2);
  }

  _enemyHurt(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.5);
    g.gain.setValueAtTime(0.5 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const noise = this._noise(ctx, 0.12, g);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    noise.disconnect();
    noise.connect(filter);
    filter.connect(g);
    noise.start(t);
    noise.stop(t + 0.12);

    const g2 = this._makeGain(ctx, 0.3);
    g2.gain.setValueAtTime(0.3 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.1);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  _enemyDeath(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.4);
    g.gain.setValueAtTime(0.4 * this.volume, t);
    g.gain.linearRampToValueAtTime(0.3 * this.volume, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(500, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.4);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  _pistolShot(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.6);
    g.gain.setValueAtTime(0.6 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const noise = this._noise(ctx, 0.08, g);
    noise.start(t);
    noise.stop(t + 0.08);

    const g2 = this._makeGain(ctx, 0.5);
    g2.gain.setValueAtTime(0.5 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1500, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
    osc.connect(g2);
    osc.start(t);
    osc.stop(t + 0.08);

    const g3 = this._makeGain(ctx, 0.3);
    g3.gain.setValueAtTime(0.001, t);
    g3.gain.linearRampToValueAtTime(0.3 * this.volume, t + 0.005);
    g3.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const noise2 = this._noise(ctx, 0.15, g3);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    noise2.disconnect();
    noise2.connect(lp);
    lp.connect(g3);
    noise2.start(t);
    noise2.stop(t + 0.15);
  }

  _playerHurt(ctx) {
    const t = ctx.currentTime;

    const g = this._makeGain(ctx, 0.4);
    g.gain.setValueAtTime(0.4 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    osc.frequency.exponentialRampToValueAtTime(150, t + 0.15);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.15);

    const g2 = this._makeGain(ctx, 0.25);
    g2.gain.setValueAtTime(0.25 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const noise = this._noise(ctx, 0.1, g2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1000;
    noise.disconnect();
    noise.connect(lp);
    lp.connect(g2);
    noise.start(t);
    noise.stop(t + 0.15);
  }

  _playerDeath(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.5);
    g.gain.setValueAtTime(0.5 * this.volume, t);
    g.gain.linearRampToValueAtTime(0.4 * this.volume, t + 0.25);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.5);

    const g2 = this._makeGain(ctx, 0.2);
    g2.gain.setValueAtTime(0.001, t + 0.05);
    g2.gain.linearRampToValueAtTime(0.2 * this.volume, t + 0.1);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(300, t + 0.05);
    osc2.frequency.exponentialRampToValueAtTime(30, t + 0.45);
    osc2.connect(g2);
    osc2.start(t + 0.05);
    osc2.stop(t + 0.5);
  }

  _click(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.25);
    g.gain.setValueAtTime(0.25 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.04);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.04);
  }

  _wardenSpawn(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.7);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.7 * this.volume, t + 0.15);
    g.gain.setValueAtTime(0.6 * this.volume, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(60, t);
    osc.frequency.linearRampToValueAtTime(40, t + 0.5);
    osc.frequency.linearRampToValueAtTime(80, t + 0.8);
    osc.frequency.exponentialRampToValueAtTime(30, t + 1.0);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 1.0);

    const g2 = this._makeGain(ctx, 0.4);
    g2.gain.setValueAtTime(0.001, t + 0.1);
    g2.gain.linearRampToValueAtTime(0.4 * this.volume, t + 0.3);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    const noise = this._noise(ctx, 0.8, g2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 200;
    noise.disconnect(); noise.connect(lp); lp.connect(g2);
    noise.start(t + 0.1);
    noise.stop(t + 0.9);
  }

  _wardenHit(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.5);
    g.gain.setValueAtTime(0.5 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.15);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + 0.15);

    const g2 = this._makeGain(ctx, 0.3);
    g2.gain.setValueAtTime(0.3 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const noise = this._noise(ctx, 0.1, g2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 400;
    noise.disconnect(); noise.connect(lp); lp.connect(g2);
    noise.start(t); noise.stop(t + 0.1);
  }

  _wardenDeath(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.7);
    g.gain.setValueAtTime(0.7 * this.volume, t);
    g.gain.linearRampToValueAtTime(0.5 * this.volume, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(20, t + 0.8);
    osc.connect(g);
    osc.start(t); osc.stop(t + 0.8);

    const g2 = this._makeGain(ctx, 0.4);
    g2.gain.setValueAtTime(0.001, t + 0.2);
    g2.gain.linearRampToValueAtTime(0.4 * this.volume, t + 0.3);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(800, t + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(200, t + 0.7);
    osc2.connect(g2);
    osc2.start(t + 0.2); osc2.stop(t + 0.8);
  }

  _busHorn(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.5);
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.5 * this.volume, t + 0.05);
    g.gain.setValueAtTime(0.4 * this.volume, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.setValueAtTime(160, t + 0.25);
    osc.connect(g);
    osc.start(t); osc.stop(t + 0.5);
  }

  _poopThrow(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.35);
    g.gain.setValueAtTime(0.35 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(250, t);
    osc.frequency.exponentialRampToValueAtTime(100, t + 0.12);
    osc.connect(g);
    osc.start(t); osc.stop(t + 0.12);
    const g2 = this._makeGain(ctx, 0.2);
    g2.gain.setValueAtTime(0.2 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    const noise = this._noise(ctx, 0.08, g2);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 600;
    noise.disconnect(); noise.connect(lp); lp.connect(g2);
    noise.start(t); noise.stop(t + 0.08);
  }

  _poopSplat(ctx) {
    const t = ctx.currentTime;
    const g = this._makeGain(ctx, 0.45);
    g.gain.setValueAtTime(0.45 * this.volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    const noise = this._noise(ctx, 0.15, g);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 500;
    noise.disconnect(); noise.connect(lp); lp.connect(g);
    noise.start(t); noise.stop(t + 0.15);
    const g2 = this._makeGain(ctx, 0.3);
    g2.gain.setValueAtTime(0.3 * this.volume, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
    osc.connect(g2);
    osc.start(t); osc.stop(t + 0.1);
  }
}

export const soundManager = new SoundManager();
