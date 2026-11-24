/* ============================================================
   audio.js — everything is synthesised at runtime (no audio files)
   ============================================================ */
(function (global) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuf = null;
    this.masterVol = 0.7;
    this.musicVol = 0.55;
    this.rain = null;
    this.musicNodes = null;
    this.heartbeatTimer = 0;
    this.ready = false;
    this.lastPlay = {};
  }

  AudioEngine.prototype.init = function () {
    if (this.ctx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) { return false; }

    var ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.masterVol;
    this.master.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVol;
    this.musicBus.connect(this.master);

    // brown-ish noise buffer for rain / wind / impacts
    var len = Math.floor(ctx.sampleRate * 2);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    var last = 0;
    for (var i = 0; i < len; i++) {
      var w = Math.random() * 2 - 1;
      last = (last + 0.022 * w) / 1.022;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;
    this.ready = true;
    return true;
  };

  AudioEngine.prototype.resume = function () {
    if (!this.ctx) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  };

  AudioEngine.prototype.setMaster = function (v) {
    this.masterVol = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.setTargetAtTime(this.masterVol, this.ctx.currentTime, 0.05);
  };

  AudioEngine.prototype.setMusicVolume = function (v) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.musicBus) this.musicBus.gain.setTargetAtTime(this.musicVol, this.ctx.currentTime, 0.08);
  };

  AudioEngine.prototype.now = function () { return this.ctx ? this.ctx.currentTime : 0; };

  /* ---------------- low level helpers ---------------- */

  AudioEngine.prototype._noise = function (opt) {
    if (!this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = opt.rate || 1;

    var filt = ctx.createBiquadFilter();
    filt.type = opt.type || 'lowpass';
    filt.frequency.setValueAtTime(opt.freq || 900, t);
    if (opt.freqTo) filt.frequency.exponentialRampToValueAtTime(Math.max(40, opt.freqTo), t + (opt.dur || 0.2));
    filt.Q.value = opt.q === undefined ? 0.8 : opt.q;

    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opt.gain || 0.2), t + (opt.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));

    src.connect(filt); filt.connect(g); g.connect(opt.bus || this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + (opt.dur || 0.2) + 0.05);
  };

  AudioEngine.prototype._tone = function (opt) {
    if (!this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime + (opt.delay || 0);
    var o = ctx.createOscillator();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(opt.freq || 220, t);
    if (opt.freqTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.freqTo), t + (opt.dur || 0.2));

    var g = ctx.createGain();
    var peak = Math.max(0.0002, opt.gain || 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opt.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + (opt.dur || 0.2));

    var node = o;
    if (opt.filter) {
      var f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = opt.filter;
      o.connect(f); node = f;
    }
    node.connect(g); g.connect(opt.bus || this.sfxBus);
    o.start(t); o.stop(t + (opt.dur || 0.2) + 0.05);
  };

  /* ---------------- sfx ---------------- */

  AudioEngine.prototype.play = function (name, opts) {
    if (!this.ready) return;
    var t = this.now();
    // throttle identical spammy sounds
    if (this.lastPlay[name] && t - this.lastPlay[name] < (opts && opts.minGap || 0.04)) return;
    this.lastPlay[name] = t;

    switch (name) {
      case 'jump':
        this._tone({ type: 'triangle', freq: 320, freqTo: 620, dur: 0.16, gain: 0.10 });
        break;
      case 'land':
        this._noise({ freq: 500, freqTo: 180, dur: 0.12, gain: 0.14, type: 'lowpass' });
        break;
      case 'step':
        this._noise({ freq: 1100, freqTo: 400, dur: 0.075, gain: 0.055, type: 'bandpass', q: 1.2 });
        break;
      case 'coin':
        this._tone({ type: 'sine', freq: 1180, dur: 0.08, gain: 0.075 });
        this._tone({ type: 'sine', freq: 1760, dur: 0.10, gain: 0.06, delay: 0.06 });
        break;
      case 'pickup':
        this._tone({ type: 'sine', freq: 520, freqTo: 900, dur: 0.18, gain: 0.10 });
        this._tone({ type: 'sine', freq: 780, dur: 0.22, gain: 0.06, delay: 0.05 });
        break;
      case 'heal':
        this._tone({ type: 'sine', freq: 440, freqTo: 660, dur: 0.32, gain: 0.10 });
        this._tone({ type: 'sine', freq: 660, freqTo: 990, dur: 0.34, gain: 0.075, delay: 0.08 });
        break;
      case 'shoot':
        this._noise({ freq: 3200, freqTo: 220, dur: 0.20, gain: 0.30, type: 'lowpass' });
        this._tone({ type: 'square', freq: 180, freqTo: 60, dur: 0.13, gain: 0.13 });
        break;
      case 'empty':
        this._tone({ type: 'square', freq: 140, dur: 0.05, gain: 0.06 });
        break;
      case 'hit':
        this._noise({ freq: 900, freqTo: 200, dur: 0.16, gain: 0.20, type: 'lowpass' });
        this._tone({ type: 'sawtooth', freq: 110, freqTo: 55, dur: 0.2, gain: 0.10 });
        break;
      case 'hurt':
        this._noise({ freq: 1600, freqTo: 180, dur: 0.34, gain: 0.28, type: 'lowpass' });
        this._tone({ type: 'sawtooth', freq: 200, freqTo: 70, dur: 0.34, gain: 0.14 });
        break;
      case 'growl':
        this._tone({ type: 'sawtooth', freq: 78, freqTo: 46, dur: 0.7, gain: 0.11, filter: 420 });
        this._noise({ freq: 380, freqTo: 120, dur: 0.7, gain: 0.09, type: 'lowpass' });
        break;
      case 'death':
        this._tone({ type: 'sawtooth', freq: 160, freqTo: 32, dur: 1.5, gain: 0.17, filter: 600 });
        this._noise({ freq: 700, freqTo: 90, dur: 1.6, gain: 0.12, type: 'lowpass' });
        break;
      case 'door':
        this._noise({ freq: 420, freqTo: 160, dur: 0.5, gain: 0.16, type: 'lowpass' });
        this._tone({ type: 'triangle', freq: 92, freqTo: 60, dur: 0.5, gain: 0.09 });
        break;
      case 'locked':
        this._tone({ type: 'square', freq: 220, dur: 0.09, gain: 0.09 });
        this._tone({ type: 'square', freq: 165, dur: 0.13, gain: 0.09, delay: 0.09 });
        break;
      case 'blip':
        this._tone({ type: 'square', freq: 660, dur: 0.035, gain: 0.035 });
        break;
      case 'ui':
        this._tone({ type: 'sine', freq: 420, freqTo: 560, dur: 0.09, gain: 0.06 });
        break;
      case 'dread':
        this._tone({ type: 'sine', freq: 48, freqTo: 34, dur: 2.4, gain: 0.16 });
        this._noise({ freq: 260, freqTo: 90, dur: 2.2, gain: 0.09, type: 'lowpass' });
        break;
      case 'thunder':
        this._noise({ freq: 280, freqTo: 48, dur: 2.2, gain: 0.22, type: 'lowpass' });
        break;
      case 'heart':
        this._tone({ type: 'sine', freq: 62, freqTo: 40, dur: 0.14, gain: 0.20 });
        this._tone({ type: 'sine', freq: 54, freqTo: 36, dur: 0.16, gain: 0.13, delay: 0.19 });
        break;
      case 'portal':
        this._tone({ type: 'sine', freq: 120, freqTo: 720, dur: 1.1, gain: 0.13 });
        this._noise({ freq: 500, freqTo: 4000, dur: 1.1, gain: 0.10, type: 'bandpass', q: 2 });
        break;
      case 'step_wet':
        this._noise({ freq: 1500, freqTo: 500, dur: 0.11, gain: 0.06, type: 'bandpass', q: 1.6 });
        break;
      default:
        break;
    }
  };

  /* ---------------- ambience ---------------- */

  AudioEngine.prototype.startRain = function (level) {
    if (!this.ready || this.rain) return;
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;

    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 700;

    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 5200;

    var g = ctx.createGain();
    g.gain.value = 0.0001;
    var target = level === 'heavy' ? 0.14 : 0.075;
    g.gain.setTargetAtTime(target, ctx.currentTime, 1.2);

    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.musicBus);
    src.start();
    this.rain = { src: src, gain: g, target: target };
  };

  AudioEngine.prototype.setRain = function (level) {
    if (!this.ready) return;
    if (!this.rain) { this.startRain(level); return; }
    var target = level === 'off' ? 0.0001 : (level === 'heavy' ? 0.15 : 0.075);
    this.rain.target = target;
    this.rain.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.9);
  };

  AudioEngine.prototype.startMusic = function (mood) {
    if (!this.ready || this.musicNodes) return;
    var ctx = this.ctx, t = ctx.currentTime;
    var out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.musicBus);
    out.gain.setTargetAtTime(mood === 'tense' ? 0.20 : 0.14, ctx.currentTime, 2.0);

    // low drone: two detuned saws through a lowpass
    var droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = mood === 'tense' ? 320 : 220;
    lp.Q.value = 3;
    droneGain.connect(lp); lp.connect(out);

    var base = mood === 'tense' ? 55 : 49;
    var oscs = [];
    [1, 1.5, 2.005].forEach(function (mult, i) {
      var o = ctx.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sawtooth';
      o.frequency.value = base * mult;
      o.detune.value = (i - 1) * 7;
      var og = ctx.createGain();
      og.gain.value = i === 0 ? 1 : (i === 1 ? 0.45 : 0.25);
      o.connect(og); og.connect(droneGain);
      o.start(t);
      oscs.push(o);
    });

    // slow filter LFO breathing
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 0.055;
    var lfoGain = ctx.createGain();
    lfoGain.gain.value = mood === 'tense' ? 130 : 70;
    lfo.connect(lfoGain); lfoGain.connect(lp.frequency);
    lfo.start(t);

    this.musicNodes = { out: out, oscs: oscs, lfo: lfo, lp: lp, mood: mood || 'calm', noteTimer: 0, scale: [0, 3, 5, 7, 10, 12, 15] };
  };

  AudioEngine.prototype.setMood = function (mood) {
    if (!this.musicNodes) { this.startMusic(mood); return; }
    if (this.musicNodes.mood === mood) return;
    this.musicNodes.mood = mood;
    var t = this.ctx.currentTime;
    this.musicNodes.lp.frequency.setTargetAtTime(mood === 'tense' ? 340 : 210, t, 1.2);
    this.musicNodes.out.gain.setTargetAtTime(mood === 'tense' ? 0.22 : 0.14, t, 1.5);
  };

  /** sparse piano-ish notes over the drone */
  AudioEngine.prototype.tickMusic = function (dt, danger) {
    var m = this.musicNodes;
    if (!this.ready || !m) return;
    m.noteTimer -= dt;
    if (m.noteTimer <= 0) {
      m.noteTimer = danger ? (1.6 + Math.random() * 2.2) : (3.2 + Math.random() * 4.5);
      var root = m.mood === 'tense' ? 110 : 98;
      var step = m.scale[Math.floor(Math.random() * m.scale.length)];
      var freq = root * Math.pow(2, step / 12) * (Math.random() < 0.25 ? 2 : 1);
      this._tone({
        type: 'sine', freq: freq, dur: 2.6, gain: danger ? 0.045 : 0.032,
        attack: 0.02, bus: this.musicBus
      });
      this._tone({ type: 'sine', freq: freq * 2.005, dur: 1.5, gain: 0.012, attack: 0.02, bus: this.musicBus });
    }
  };

  AudioEngine.prototype.stopMusic = function () {
    if (!this.musicNodes) return;
    var m = this.musicNodes;
    try {
      m.out.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.4);
      m.oscs.forEach(function (o) { o.stop(this.ctx.currentTime + 2); }, this);
      m.lfo.stop(this.ctx.currentTime + 2);
    } catch (e) { }
    this.musicNodes = null;
  };

  global.Audio2 = new AudioEngine();
})(window);
