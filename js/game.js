/* ============================================================
   game.js — engine: camera, lighting, dialog, particles, flow
   ============================================================ */
(function (global) {
  'use strict';

  var W = 1024, H = 576;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.input = global.InputState;
    this.levels = global.GameLevels;
    this.state = 'boot';       // boot | title | play | dialog | pause | dead | ending
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.bullets = [];
    this.particles = [];
    this.floating = [];
    this.camX = 0;
    this.camTargetX = 0;
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.flashColor = '#c4233a';
    this.darkness = 0;
    this.time = 0;
    this.score = 0;
    this.dialog = null;
    this.dialogQueue = null;
    this.dialogTimer = 0;
    this.typeIdx = 0;
    this.typeAcc = 0;
    this.typing = false;
    this.solids = [];
    this.spikeRects = [];
    this.hudDirty = true;
    this.checkpointX = 0;
    this.levelCardTimer = 0;
    this.settings = { shake: true, crt: true };
    this.rainLevel = 'light';
    this.rainDrops = [];
    this.fogBlobs = [];
    this.glitchT = 0;
    this.lastLightning = 6;
    this.paused = false;
    this.score = 0;
    this.deaths = 0;
    this._initRain();
    this._bindUi();
  }

  /* ============================================================
     SETUP
     ============================================================ */
  Game.prototype._initRain = function () {
    this.rainDrops = [];
    for (var i = 0; i < 220; i++) {
      this.rainDrops.push({
        x: Math.random() * (W + 200) - 100,
        y: Math.random() * H,
        len: 8 + Math.random() * 26,
        sp: 520 + Math.random() * 700,
        a: 0.05 + Math.random() * 0.22,
        lw: Math.random() < 0.8 ? 1 : 1.6
      });
    }
  };

  Game.prototype._bindUi = function () {
    var self = this;

    function on(id, ev, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    }

    // title
    on('btn-new', 'click', function () { self.startNewGame(); });
    on('btn-continue', 'click', function () { self.continueGame(); });
    on('btn-how', 'click', function () { self.show('howto'); });
    on('btn-settings-title', 'click', function () { self.show('settings'); self._fromTitleSettings = true; });

    // generic data-act buttons
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        Audio2.play('ui');
        self.action(b.getAttribute('data-act'));
      });
    });

    // settings inputs
    var vm = document.getElementById('vol-master');
    if (vm) vm.addEventListener('input', function () {
      Audio2.setMaster(vm.value / 100);
      document.getElementById('vol-master-val').textContent = vm.value + '%';
      self.saveSettings();
    });
    var vc = document.getElementById('vol-music');
    if (vc) vc.addEventListener('input', function () {
      Audio2.setMusicVolume(vc.value / 100);
      document.getElementById('vol-music-val').textContent = vc.value + '%';
      self.saveSettings();
    });
    var sh = document.getElementById('opt-shake');
    if (sh) sh.addEventListener('change', function () { self.settings.shake = sh.checked; self.saveSettings(); });
    var crt = document.getElementById('opt-crt');
    if (crt) crt.addEventListener('change', function () {
      self.settings.crt = crt.checked;
      document.getElementById('stage').classList.toggle('crt-off', !crt.checked);
      self.saveSettings();
    });

    // restore settings
    try {
      var s = JSON.parse(localStorage.getItem('alice_settings') || '{}');
      if (typeof s.master === 'number') { Audio2.setMaster(s.master); if (vm) { vm.value = Math.round(s.master * 100); document.getElementById('vol-master-val').textContent = vm.value + '%'; } }
      if (typeof s.music === 'number') { Audio2.setMusicVolume(s.music); if (vc) { vc.value = Math.round(s.music * 100); document.getElementById('vol-music-val').textContent = vc.value + '%'; } }
      if (typeof s.shake === 'boolean') { this.settings.shake = s.shake; if (sh) sh.checked = s.shake; }
      if (typeof s.crt === 'boolean') {
        this.settings.crt = s.crt;
        if (crt) crt.checked = s.crt;
        document.getElementById('stage').classList.toggle('crt-off', !s.crt);
      }
    } catch (e) { }
  };

  Game.prototype.saveSettings = function () {
    try {
      var vm = document.getElementById('vol-master');
      var vc = document.getElementById('vol-music');
      localStorage.setItem('alice_settings', JSON.stringify({
        master: vm ? vm.value / 100 : 0.7,
        music: vc ? vc.value / 100 : 0.55,
        shake: this.settings.shake,
        crt: this.settings.crt
      }));
    } catch (e) { }
  };

  /* ============================================================
     SAVE / LOAD
     ============================================================ */
  Game.prototype.saveProgress = function () {
    if (!this.level || !this.player) return;
    try {
      localStorage.setItem('alice_save', JSON.stringify({
        level: this.levelIndex,
        hp: this.player.hp,
        ammo: this.player.ammo,
        shotgun: this.player.hasShotgun,
        keys: this.player.keys,
        coins: this.player.coins,
        score: this.score,
        deaths: this.deaths,
        checkpointX: this.checkpointX,
        t: Date.now()
      }));
    } catch (e) { }
    this.refreshContinue();
  };

  Game.prototype.loadSave = function () {
    try { return JSON.parse(localStorage.getItem('alice_save') || 'null'); } catch (e) { return null; }
  };

  Game.prototype.refreshContinue = function () {
    var btn = document.getElementById('btn-continue');
    if (!btn) return;
    var s = this.loadSave();
    if (s && typeof s.level === 'number') {
      btn.classList.remove('hidden');
      btn.textContent = 'Davam et · ' + (this.levels[s.level] ? this.levels[s.level].name : '');
    } else {
      btn.classList.add('hidden');
    }
  };

  /* ============================================================
     FLOW
     ============================================================ */
  Game.prototype.show = function (id) {
    ['title', 'howto', 'settings', 'pause', 'death', 'ending', 'credits', 'levelcard'].forEach(function (k) {
      var el = document.getElementById(k);
      if (el) el.classList.add('hidden');
    });
    if (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }
    var hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('hidden', !(id === null && this.state === 'play'));
  };

  Game.prototype.startNewGame = function () {
    Audio2.resume();
    Audio2.play('portal');
    this.score = 0; this.deaths = 0;
    this.player = new Ent.Player(0, 0);
    this.loadLevel(0, { x: 0, carry: null });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.continueGame = function () {
    var s = this.loadSave();
    if (!s) { this.startNewGame(); return; }
    Audio2.resume();
    this.score = s.score || 0;
    this.deaths = s.deaths || 0;
    this.player = new Ent.Player(0, 0);
    this.player.hp = s.hp || 3;
    this.player.ammo = s.ammo || 0;
    this.player.hasShotgun = !!s.shotgun;
    this.player.keys = s.keys || 0;
    this.player.coins = s.coins || 0;
    this.loadLevel(clamp(s.level || 0, 0, this.levels.length - 1), { x: s.checkpointX || 0, first: true });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.loadLevel = function (index, opts) {
    opts = opts || {};
    this.levelIndex = index;
    var L = this.levels[index];
    this.level = L;

    // ---- build solids ----
    this.solids = [];
    this.spikeRects = [];
    for (var i = 0; i < L.platforms.length; i++) {
      var p = L.platforms[i];
      if (p.kind === 'spike') {
        // legacy spike platform: hazard + floor underneath
        this.spikeRects.push({ x: p.x, y: p.y, w: p.w, h: 15 });
        this.solids.push({ x: p.x, y: p.y + 15, w: p.w, h: 300, kind: 'spikefloor' });
      } else {
        this.solids.push({
          x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind,
          oneway: p.kind === 'ledge'      // jump up through ledges, land on top
        });
      }
    }
    // surface hazards sit on top of existing floors (no extra solid)
    for (var hz = 0; hz < (L.hazards || []).length; hz++) {
      var hzz = L.hazards[hz];
      this.spikeRects.push({ x: hzz.x, y: 470 - 15, w: hzz.w, h: 15 });
    }

    // ---- entities ----
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.bullets = [];
    this.particles = [];
    this.floating = [];
    this.localKeys = 0;
    this.triggered = {};

    for (var e = 0; e < L.enemies.length; e++) this.enemies.push(new Ent.Enemy(L.enemies[e]));
    for (var it = 0; it < L.items.length; it++) this.items.push(new Ent.Item(L.items[it]));
    for (var n = 0; n < L.npcs.length; n++) this.npcs.push(new Ent.Npc(L.npcs[n]));

    // ---- player ----
    var px = opts.x || L.start.x;
    if (!this.player) this.player = new Ent.Player(px, L.start.y);
    this.player.x = px;
    this.player.y = L.start.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.alive = true;
    this.player.invuln = 0.6;
    this.player.h = 64;
    if (this.player.hp <= 0) this.player.hp = 3;

    this.checkpointX = px;
    this.camX = clamp(px - W / 2, 0, Math.max(0, L.width - W));
    this.darkness = L.dark || 0;
    this.rainLevel = L.rain || 'light';

    // ---- audio ----
    Audio2.resume();
    Audio2.setRain(this.rainLevel === 'off' ? 'off' : this.rainLevel);
    Audio2.setMood(L.mood || 'calm');

    // ---- level card ----
    this.showLevelCard(L);

    // ---- hud ----
    document.getElementById('level-name').textContent = L.kicker + ' · ' + L.name;
    document.getElementById('objective').textContent = L.objective || '';
    this.updateHud();
    this.saveProgress();
  };

  Game.prototype.showLevelCard = function (L) {
    var card = document.getElementById('levelcard');
    document.getElementById('lc-kicker').textContent = L.kicker;
    document.getElementById('lc-title').textContent = L.name;
    document.getElementById('lc-sub').textContent = L.sub || '';
    card.classList.remove('hidden');
    // restart CSS animation
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    var inner = card.querySelector('.levelcard-inner');
    if (inner) { inner.style.animation = 'none'; void inner.offsetWidth; inner.style.animation = ''; }
    this.state = 'play';
    var self = this;
    clearTimeout(this._cardTO);
    this._cardTO = setTimeout(function () { card.classList.add('hidden'); }, 3400);
  };

  Game.prototype.restartLevel = function () {
    var L = this.level;
    var keep = this.player;
    keep.hp = 3;
    keep.alive = true;
    keep.invuln = 1;
    keep.vx = 0; keep.vy = 0;
    this.loadLevel(this.levelIndex, { x: L.start.x });
    this.state = 'play';
    this.show(null);
    document.getElementById('hud').classList.remove('hidden');
  };

  Game.prototype.restartFromCheckpoint = function () {
    var L = this.level;
    var keep = this.player;
    keep.hp = 3;
    keep.alive = true;
    keep.invuln = 1;
    this.loadLevel(this.levelIndex, { x: Math.max(L.start.x, this.checkpointX) });
    this.state = 'play';
    this.show(null);
    document.getElementById('hud').classList.remove('hidden');
  };

  Game.prototype.goToMenu = function () {
    this.state = 'title';
    Audio2.setRain('light');
    Audio2.setMood('calm');
    this.show('title');
    this.refreshContinue();
    document.getElementById('hud').classList.add('hidden');
    this.drawTitleBackdrop();
  };

  Game.prototype.onPlayerDeath = function () {
    var self = this;
    this.deaths++;
    this.state = 'dead';
    document.getElementById('hud').classList.add('hidden');
    var quotes = [
      'Qaranlıq səni uddu...',
      'Sən yenə də onu tapa bilmədin.',
      'Yağış sənin adını yudu.',
      'O, səni gözləyirdi.',
      'Bu dəfə qaça bilmədin.'
    ];
    document.getElementById('death-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
    setTimeout(function () {
      if (self.state === 'dead') self.show('death');
    }, 900);
  };

  /* ============================================================
     ACTIONS
     ============================================================ */
  Game.prototype.action = function (act) {
    switch (act) {
      case 'resume': this.state = 'play'; this.show(null); document.getElementById('hud').classList.remove('hidden'); break;
      case 'restart': this.restartLevel(); break;
      case 'settings': this._prevState = this.state; this.state = 'pause'; this.show('settings'); break;
      case 'settings-back':
        if (this._fromTitleSettings) { this._fromTitleSettings = false; this.show('title'); }
        else { this.show('pause'); this.state = 'pause'; }
        break;
      case 'menu': this.goToMenu(); break;
      case 'retry': this.restartLevel(); break;
      case 'to-checkpoint': this.restartFromCheckpoint(); break;
      case 'howto-back': this.show('title'); break;
      case 'ending-menu': this.goToMenu(); break;
      case 'ending-credits': this.show('credits'); break;
      case 'credits-back': this.show('ending'); break;
      default: break;
    }
  };

  /* ============================================================
     DIALOG
     ============================================================ */
  Game.prototype.say = function (lines, onDone) {
    if (!lines || !lines.length) { if (onDone) onDone(); return; }
    this.dialogQueue = lines.slice();
    this._dialogDone = onDone || null;
    this.state = 'dialog';
    document.getElementById('hud').classList.add('hidden');
    this._nextLine();
  };

  Game.prototype._nextLine = function () {
    if (!this.dialogQueue || !this.dialogQueue.length) {
      this._closeDialog();
      return;
    }
    var line = this.dialogQueue.shift();
    this.dialog = line;
    this.typeIdx = 0;
    this.typeAcc = 0;
    this.typing = true;

    var el = document.getElementById('dialog');
    var nm = document.getElementById('dialog-name');
    document.getElementById('dialog-text').textContent = '';
    var portrait = document.getElementById('dialog-portrait');
    var pSrc = line.portrait || (line.who === 'Alice' ? 'alice_0' : line.who === 'Leo' ? 'leo_0' : null);
    if (pSrc) {
      portrait.src = 'assets/' + pSrc + '.png';
      portrait.classList.remove('hidden');
    } else {
      portrait.classList.add('hidden');
    }
    nm.textContent = line.who || '';
    nm.style.visibility = line.who ? 'visible' : 'hidden';
    el.classList.remove('hidden');
    this._dialogPauseWorld();
    Audio2.play('blip');
  };

  Game.prototype._dialogPauseWorld = function () {
    if (this.player) { this.player.vx = 0; }
  };

  Game.prototype._closeDialog = function () {
    this.dialog = null;
    this.dialogQueue = null;
    document.getElementById('dialog').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.state = 'play';
    var done = this._dialogDone;
    this._dialogDone = null;
    if (done) done();
  };

  Game.prototype.updateDialog = function (dt) {
    if (!this.dialog) return;
    var text = this.dialog.text || '';
    if (this.typing) {
      this.typeAcc += dt * 46;
      while (this.typeAcc >= 1 && this.typeIdx < text.length) {
        this.typeIdx++;
        this.typeAcc -= 1;
        if (this.typeIdx % 3 === 0) Audio2.play('blip');
      }
      document.getElementById('dialog-text').textContent = text.slice(0, this.typeIdx);
      if (this.typeIdx >= text.length) this.typing = false;
    }
    if (this.input.state.interactPressed || this.input.state.jumpPressed) {
      if (this.typing) {
        this.typing = false;
        this.typeIdx = text.length;
        document.getElementById('dialog-text').textContent = text;
      } else {
        this._nextLine();
      }
    }
  };

  /* ============================================================
     HELPERS USED BY ENTITIES
     ============================================================ */
  Game.prototype.solidAt = function (x, y) {
    for (var i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return s;
    }
    return null;
  };

  Game.prototype.solidBelow = function (x, y, dist) {
    for (var i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      if (x >= s.x && x <= s.x + s.w && s.y >= y - 4 && s.y <= y + (dist || 20)) return s;
    }
    return null;
  };

  Game.prototype.fireBullet = function (x, y, dir) {
    this.bullets.push(new Ent.Bullet(x, y, dir));
    this.spawnBurst(x + dir * 14, y, '#ffd9a0', 6);
  };

  Game.prototype.spawnBurst = function (x, y, color, n) {
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 220;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.35 + Math.random() * 0.55,
        max: 0.9,
        r: 1.2 + Math.random() * 2.8,
        color: color,
        grav: 320
      });
    }
  };

  Game.prototype.spawnDust = function (x, y, n) {
    for (var i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y - 2,
        vx: (Math.random() - 0.5) * 90,
        vy: -20 - Math.random() * 60,
        life: 0.3 + Math.random() * 0.35,
        max: 0.65,
        r: 1 + Math.random() * 2.4,
        color: 'rgba(170,140,150,0.5)',
        grav: 60
      });
    }
  };

  Game.prototype.dropCoin = function (x, y) {
    this.items.push(new Ent.Item({ type: 'coin', x: x, y: y }));
  };

  Game.prototype.addScore = function (n) {
    this.score += n;
    this.updateHud();
  };

  Game.prototype.toast = function (msg, kind) {
    var box = document.getElementById('toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(function () { el.remove(); }, 420);
    }, 1500);
  };

  Game.prototype.floatText = function (x, y, txt, color) {
    this.floating.push({ x: x, y: y, txt: txt, life: 1.1, color: color || '#ffd9a0' });
  };

  Game.prototype.shake = function (amt) {
    if (!this.settings.shake) return;
    this.shakeAmt = Math.min(18, this.shakeAmt + amt);
  };

  Game.prototype.flash = function (amt) {
    this.flashAmt = Math.min(1, this.flashAmt + amt);
  };

  Game.prototype.updateHud = function () {
    var p = this.player;
    if (!p) return;
    var hearts = document.getElementById('hearts');
    if (hearts && hearts.childElementCount !== p.maxHp) {
      hearts.innerHTML = '';
      for (var i = 0; i < p.maxHp; i++) {
        var im = document.createElement('img');
        im.src = 'assets/i_heart_full.png';
        im.alt = '';
        hearts.appendChild(im);
      }
    }
    if (hearts) {
      for (var j = 0; j < hearts.children.length; j++) {
        var full = j < p.hp;
        hearts.children[j].src = 'assets/' + (full ? 'i_heart_full' : 'i_heart_empty') + '.png';
        hearts.children[j].className = (full && p.hp <= 1) ? 'beat' : (full ? '' : 'empty');
      }
    }
    var a = document.getElementById('ammo-count');
    if (a) a.textContent = p.ammo;
    var k = document.getElementById('key-count');
    if (k) k.textContent = p.keys;
    var c = document.getElementById('coin-count');
    if (c) c.textContent = p.coins;
  };

  /* ============================================================
     UPDATE
     ============================================================ */
  Game.prototype.update = function (dt) {
    this.time += dt;
    this.shakeAmt *= Math.pow(0.0025, dt);
    if (this.shakeAmt < 0.05) this.shakeAmt = 0;
    this.flashAmt = Math.max(0, this.flashAmt - dt * 2.4);
    this.glitchT = Math.max(0, this.glitchT - dt);

    // particles always run
    for (var i = this.particles.length - 1; i >= 0; i--) {
      var pt = this.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += pt.grav * dt;
      pt.vx *= Math.pow(0.35, dt);
      if (pt.life <= 0) this.particles.splice(i, 1);
    }
    for (var f = this.floating.length - 1; f >= 0; f--) {
      var ft = this.floating[f];
      ft.life -= dt;
      ft.y -= 34 * dt;
      if (ft.life <= 0) this.floating.splice(f, 1);
    }

    if (this.state === 'dialog') {
      this.updateDialog(dt);
      this._updateCamera(dt);
      return;
    }
    if (this.state !== 'play') return;

    // pause
    if (this.input.state.pausePressed) {
      this.state = 'pause';
      this.show('pause');
      document.getElementById('hud').classList.add('hidden');
      return;
    }

    var p = this.player;
    p.update(dt, this);

    // checkpoint
    if (p.x > this.checkpointX + 420 && p.onGround) {
      this.checkpointX = p.x;
      this.saveProgress();
    }

    // enemies
    for (var e = this.enemies.length - 1; e >= 0; e--) {
      var en = this.enemies[e];
      if (!en.dead) en.update(dt, this);
      if (en.dead) this.enemies.splice(e, 1);
    }

    // bullets
    for (var b = this.bullets.length - 1; b >= 0; b--) {
      var bu = this.bullets[b];
      bu.update(dt, this);
      if (bu.dead) this.bullets.splice(b, 1);
    }

    // items
    for (var it = this.items.length - 1; it >= 0; it--) {
      var item = this.items[it];
      item.update(dt);
      if (!p.alive) continue;
      if (Ent.overlap(item.box(), p.box())) {
        this._collect(item, it);
      }
    }

    // npcs
    for (var n = 0; n < this.npcs.length; n++) {
      this.npcs[n].update(dt, this);
      var npc = this.npcs[n];
      if (!npc.talked && npc.near(p) && this.input.state.interactPressed) {
        npc.talked = true;
        var self = this;
        var lines = npc.talk;
        this.say(lines, function () {
          if (npc.final) { self.finishGame(); }
          else if (npc.after) self.toast(npc.after, 'good');
        });
      }
    }

    // triggers
    for (var t = 0; t < this.level.triggers.length; t++) {
      var tr = this.level.triggers[t];
      var key = 'tr' + t;
      if (!this.triggered[key] && Math.abs(p.x - tr.x) < (tr.w || 20) + 20) {
        this.triggered[key] = true;
        this.say(tr.lines);
        break;
      }
    }

    // exit
    this._checkExit(dt);

    this._updateCamera(dt);
    this._updateAtmosphere(dt);
    Audio2.tickMusic(dt, this.enemies.length > 0);
    this.updateHud();
  };

  Game.prototype._collect = function (item, idx) {
    var p = this.player;
    var self = this;
    switch (item.type) {
      case 'coin':
        p.coins++;
        this.score += 5;
        Audio2.play('coin');
        this.floatText(item.x, item.y - 20, '+1', '#ffd98a');
        this.spawnBurst(item.x, item.y - 20, '#c9a227', 7);
        this.items.splice(idx, 1);
        break;
      case 'ammo':
        p.ammo += 8;
        Audio2.play('pickup');
        this.toast('+8 güllə', 'good');
        this.floatText(item.x, item.y - 20, '+8', '#ffb070');
        this.items.splice(idx, 1);
        break;
      case 'medkit':
        if (p.hp >= p.maxHp) return;
        p.heal(1);
        Audio2.play('heal');
        this.toast('+1 ürək', 'good');
        this.floatText(item.x, item.y - 20, '+1 ♥', '#ff7a8a');
        this.items.splice(idx, 1);
        break;
      case 'key':
        p.keys++;
        this.localKeys++;
        this.score += 20;
        Audio2.play('pickup');
        this.toast('Açar tapıldı', 'good');
        this.flash(0.2);
        this.items.splice(idx, 1);
        break;
      case 'shotgun':
        p.hasShotgun = true;
        p.ammo += 12;
        Audio2.play('pickup');
        this.toast('Ov tüfəngi götürüldü', 'good');
        this.items.splice(idx, 1);
        break;
      case 'photo':
      case 'note':
        this.items.splice(idx, 1);
        Audio2.play('portal');
        this.glitchT = 0.5;
        this.flash(0.25);
        this.say(item.lines, function () { self.saveProgress(); });
        break;
      default:
        this.items.splice(idx, 1);
        break;
    }
    this.updateHud();
  };

  Game.prototype._checkExit = function (dt) {
    var L = this.level;
    if (!L.exit) return;
    var p = this.player;
    if (Math.abs(p.x - L.exit.x) > 70) return;

    var needKeys = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    if (needKeys > 0 && this.localKeys < needKeys) {
      if (!this._lockedMsg || this.time - this._lockedMsg > 2) {
        this._lockedMsg = this.time;
        Audio2.play('locked');
        this.toast(needKeys > 1 ? ('Qapı bağlıdır — ' + needKeys + ' açar lazımdır') : 'Qapı bağlıdır — açar lazımdır', 'bad');
      }
      return;
    }

    if (this.input.state.interactPressed) {
      this.advanceLevel();
    }
  };

  Game.prototype.advanceLevel = function () {
    var next = this.level.exit.to;
    Audio2.play('portal');
    this.flash(0.7);
    this.glitchT = 0.6;
    this.saveProgress();
    var self = this;
    var el = document.getElementById('levelcard');
    if (el) el.classList.add('hidden');
    this.state = 'transition';
    setTimeout(function () {
      self.loadLevel(next, { x: 0 });
      self.state = 'play';
    }, 520);
    this.spawnBurst(this.player.x, this.player.y - 30, '#e04158', 40);
  };

  Game.prototype.finishGame = function () {
    this.state = 'ending';
    this.saveProgress();
    try { localStorage.removeItem('alice_save'); } catch (e) { }
    document.getElementById('hud').classList.add('hidden');
    var E = global.GameEnding;
    document.getElementById('ending-title').textContent = E.title;
    document.getElementById('ending-body').innerHTML = E.body.map(function (p) {
      return '<p>' + p + '</p>';
    }).join('');
    var self = this;
    setTimeout(function () { self.show('ending'); }, 400);
  };

  Game.prototype._updateCamera = function (dt) {
    var p = this.player;
    if (!p) return;
    var target = p.x - W / 2 + p.facing * 60;
    target = clamp(target, 0, Math.max(0, this.level.width - W));
    this.camTargetX = target;
    var k = 1 - Math.pow(0.0015, dt);
    this.camX += (this.camTargetX - this.camX) * k;
    this.camX = clamp(this.camX, 0, Math.max(0, this.level.width - W));
  };

  Game.prototype._updateAtmosphere = function (dt) {
    // rain
    var intensity = this.rainLevel === 'off' ? 0 : (this.rainLevel === 'heavy' ? 1 : 0.45);
    for (var i = 0; i < this.rainDrops.length; i++) {
      var d = this.rainDrops[i];
      if (intensity === 0) continue;
      d.y += d.sp * dt * (0.55 + intensity * 0.7);
      d.x -= 90 * dt * intensity;
      if (d.y > H + 30) { d.y = -40; d.x = Math.random() * (W + 260) - 130; }
      if (d.x < -140) d.x = W + 120;
    }
    // lightning
    if (this.rainLevel !== 'off') {
      this.lastLightning -= dt;
      if (this.lastLightning <= 0) {
        this.lastLightning = 11 + Math.random() * 16;
        this.flash(0.14);
        Audio2.play('thunder');
      }
    }
  };

  /* ============================================================
     DRAW
     ============================================================ */
  Game.prototype.draw = function () {
    var ctx = this.ctx;
    if (this.state === 'title' || this.state === 'boot') {
      this.drawTitleBackdrop();
      return;
    }
    if (!this.level) { ctx.fillStyle = '#05040a'; ctx.fillRect(0, 0, W, H); return; }

    var sx = 0, sy = 0;
    if (this.shakeAmt > 0.1) {
      sx = (Math.random() - 0.5) * this.shakeAmt * 2;
      sy = (Math.random() - 0.5) * this.shakeAmt * 2;
    }

    ctx.save();
    ctx.translate(sx, sy);

    this._drawBackground(ctx);
    this._drawWorld(ctx);
    this._drawLighting(ctx);
    this._drawWeather(ctx);

    ctx.restore();

    // full-screen flash
    if (this.flashAmt > 0.01) {
      ctx.fillStyle = 'rgba(196,35,58,' + (this.flashAmt * 0.55) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    // glitch bars
    if (this.glitchT > 0) this._drawGlitch(ctx);
    // vignette
    this._drawVignette(ctx);
  };

  Game.prototype._drawBackground = function (ctx) {
    var L = this.level;
    var key = L.bg;
    var dimg = Assets.img(key);
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, W, H);
    if (!dimg) return;

    var scale = H / dimg.naturalHeight;
    var tw = dimg.naturalWidth * scale;
    var off = -(this.camX * (L.bgParallax || 0.3)) % tw;
    if (off > 0) off -= tw;

    var bobY = Math.sin(this.time * 0.25) * 2;
    var x = off;
    ctx.save();
    ctx.globalAlpha = 0.95;
    while (x < W) {
      ctx.drawImage(dimg, x, bobY, tw + 1, H + 1);
      x += tw;
    }
    ctx.restore();

    // atmospheric gradient
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(10,4,14,0.55)');
    g.addColorStop(0.55, 'rgba(8,3,12,0.25)');
    g.addColorStop(1, 'rgba(4,2,8,0.92)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // red moon glow
    var mg = ctx.createRadialGradient(W * 0.72, H * 0.16, 10, W * 0.72, H * 0.16, 300);
    mg.addColorStop(0, 'rgba(200,30,50,0.16)');
    mg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H);
  };

  Game.prototype._drawWorld = function (ctx) {
    var cam = this.camX;
    ctx.save();
    ctx.translate(-cam, 0);

    var L = this.level;

    // ---- solids ----
    for (var i = 0; i < this.solids.length; i++) {
      this._drawSolid(ctx, this.solids[i]);
    }

    // ---- spikes ----
    for (var s = 0; s < this.spikeRects.length; s++) {
      var sp = this.spikeRects[s];
      var n = Math.ceil(sp.w / 40);
      for (var k = 0; k < n; k++) {
        Assets.blit(ctx, 'prop_spikes', sp.x + 20 + k * 40, sp.y + 18, 0.52, false);
      }
      var gg = ctx.createLinearGradient(0, sp.y - 14, 0, sp.y + 6);
      gg.addColorStop(0, 'rgba(220,30,50,0)');
      gg.addColorStop(1, 'rgba(220,30,50,0.18)');
      ctx.fillStyle = gg;
      ctx.fillRect(sp.x, sp.y - 14, sp.w, 20);
    }

    // ---- props (behind entities) ----
    for (var p = 0; p < L.props.length; p++) {
      var pr = L.props[p];
      if (this._cull(pr.x, 200)) continue;
      var alpha = pr.dark ? 0.42 : 1;
      ctx.save();
      if (pr.dark) ctx.filter = 'brightness(0.45)';
      Assets.blit(ctx, pr.a, pr.x, pr.y + 2, pr.s || 1, !!pr.flip, alpha);
      ctx.restore();
    }

    // ---- exit portal ----
    this._drawExit(ctx);

    // ---- items ----
    for (var it = 0; it < this.items.length; it++) {
      var item = this.items[it];
      if (this._cull(item.x, 80)) continue;
      item.draw(ctx);
    }

    // ---- npcs ----
    for (var n = 0; n < this.npcs.length; n++) {
      var npc = this.npcs[n];
      if (this._cull(npc.x, 120)) continue;
      npc.draw(ctx);
      if (!npc.talked && npc.near(this.player) && this.state === 'play') this._drawPrompt(ctx, npc.x, npc.y - 118);
    }

    // ---- enemies ----
    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (this._cull(en.x, 140)) continue;
      en.draw(ctx, this);
    }

    // ---- player ----
    if (this.player) this.player.draw(ctx, this);

    // ---- bullets ----
    for (var b = 0; b < this.bullets.length; b++) this.bullets[b].draw(ctx);

    // ---- particles ----
    for (var q = 0; q < this.particles.length; q++) {
      var pt = this.particles[q];
      var a = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * (0.4 + a * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // ---- floating text ----
    for (var ft = 0; ft < this.floating.length; ft++) {
      var f2 = this.floating[ft];
      ctx.globalAlpha = Math.min(1, f2.life * 1.6);
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = f2.color;
      ctx.shadowColor = 'rgba(0,0,0,.9)';
      ctx.shadowBlur = 6;
      ctx.fillText(f2.txt, f2.x, f2.y);
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  };

  Game.prototype._cull = function (x, pad) {
    return (x < this.camX - pad) || (x > this.camX + W + pad);
  };

  Game.prototype._drawPrompt = function (ctx, x, y) {
    var bob = Math.sin(this.time * 4) * 3;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(x, y + bob, 13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,5,12,.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,65,88,.85)';
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.fillStyle = '#f2e6ea';
    ctx.font = '600 12px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', x, y + bob + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  };

  Game.prototype._drawSolid = function (ctx, s) {
    var pat = this._brickPattern;
    var topY = s.y;

    ctx.save();
    // body
    ctx.beginPath();
    ctx.rect(s.x, topY, s.w, s.h);
    ctx.clip();

    if (s.kind === 'spikefloor') {
      ctx.fillStyle = '#0a070d';
      ctx.fillRect(s.x, topY, s.w, s.h);
      ctx.globalAlpha = 0.5;
      if (!pat) pat = this._makePattern(ctx, 'tex_brick', 2.1);
      if (pat) { ctx.fillStyle = pat; ctx.fillRect(s.x, topY, s.w, s.h); }
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#000';
      ctx.fillRect(s.x, topY, s.w, s.h);
      ctx.restore();
      return;
    }

    if (!pat) pat = this._makePattern(ctx, 'tex_brick', 2.1);
    ctx.fillStyle = pat || '#191320';
    ctx.fillRect(s.x, topY, s.w, s.h);

    // darken deeper
    var g = ctx.createLinearGradient(0, topY, 0, topY + Math.min(s.h, 160));
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.72)');
    ctx.fillStyle = g;
    ctx.fillRect(s.x, topY, s.w, s.h);

    // red rim light
    var rim = ctx.createLinearGradient(0, topY, 0, topY + 14);
    rim.addColorStop(0, 'rgba(190,30,50,0.42)');
    rim.addColorStop(1, 'rgba(190,30,50,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(s.x, topY, s.w, 14);

    ctx.restore();

    // crisp top edge
    ctx.fillStyle = 'rgba(150,45,60,0.55)';
    ctx.fillRect(s.x, topY, s.w, 1.5);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(s.x, topY + 1.5, s.w, 1.5);
  };

  Game.prototype._makePattern = function (ctx, key, scale) {
    var im = Assets.img(key);
    if (!im) return null;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * scale));
    c.height = Math.max(1, Math.round(im.naturalHeight * scale));
    var cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    cc.drawImage(im, 0, 0, c.width, c.height);
    var pat = ctx.createPattern(c, 'repeat');
    if (key === 'tex_brick') this._brickPattern = pat;
    return pat;
  };

  Game.prototype._drawExit = function (ctx) {
    var L = this.level;
    if (!L.exit) return;
    if (this._cull(L.exit.x, 160)) return;
    var locked = (L.exit.needsKey && this.localKeys < 1) || (L.exit.needsKeys && this.localKeys < L.exit.needsKeys);
    var pulse = 0.72 + Math.sin(this.time * 2.6) * 0.28;
    var x = L.exit.x, y = L.exit.y;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = locked ? 0.45 : pulse;
    Assets.blit(ctx, 'u_portal', x, y - 8, 1.5, false);
    ctx.globalAlpha = locked ? 0.16 : pulse * 0.4;
    Assets.blit(ctx, 'u_beams', x, y - 4, 1.5, false);
    ctx.restore();

    if (!locked && !this._cull(L.exit.x, 300)) {
      var near = Math.abs(this.player.x - x) < 70;
      if (near) this._drawPrompt(ctx, x, y - 96);
    }
    if (locked) {
      Assets.blit(ctx, 'u_lock', x, y - 88, 0.9, false);
    }
  };

  Game.prototype._drawLighting = function (ctx) {
    var d = this.darkness;
    if (d <= 0.01) return;
    var p = this.player;
    var px = p.x - this.camX, py = p.y - 34;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    var g = ctx.createRadialGradient(px, py, 30, px, py, 340);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(4,2,8,' + (d * 0.42) + ')');
    g.addColorStop(1, 'rgba(3,1,6,' + d + ')');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  };

  Game.prototype._drawWeather = function (ctx) {
    var intensity = this.rainLevel === 'off' ? 0 : (this.rainLevel === 'heavy' ? 1 : 0.42);
    if (intensity > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < this.rainDrops.length; i++) {
        var d = this.rainDrops[i];
        if (d.a > intensity * 0.24) continue;
        ctx.strokeStyle = 'rgba(180,190,215,' + (d.a * intensity * 2.2) + ')';
        ctx.lineWidth = d.lw;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + 3, d.y + d.len);
        ctx.stroke();
      }
      ctx.restore();
    }

    // fog
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var fy = H * 0.72 + Math.sin(this.time * 0.3) * 8;
    var fg = ctx.createLinearGradient(0, fy - 120, 0, H);
    fg.addColorStop(0, 'rgba(60,20,40,0)');
    fg.addColorStop(0.6, 'rgba(70,22,45,0.10)');
    fg.addColorStop(1, 'rgba(90,25,50,0.16)');
    ctx.fillStyle = fg;
    ctx.fillRect(0, fy - 120, W, H - fy + 120);
    ctx.restore();
  };

  Game.prototype._drawGlitch = function (ctx) {
    var n = 3 + Math.floor(Math.random() * 4);
    for (var i = 0; i < n; i++) {
      var y = Math.random() * H;
      var h = 2 + Math.random() * 22;
      var off = (Math.random() - 0.5) * 44;
      try {
        var slice = ctx.getImageData(0, y, W, h);
        ctx.putImageData(slice, off, y);
      } catch (e) { }
      ctx.fillStyle = 'rgba(230,30,60,' + (0.03 + Math.random() * 0.07) + ')';
      ctx.fillRect(0, y, W, h);
    }
  };

  Game.prototype._drawVignette = function (ctx) {
    var g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.92);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.78)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // low-health red pulse
    if (this.player && this.player.hp === 1 && this.state === 'play') {
      var pulse = 0.10 + Math.sin(this.time * 3.4) * 0.06;
      var rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.95);
      rg.addColorStop(0, 'rgba(140,0,20,0)');
      rg.addColorStop(1, 'rgba(150,0,25,' + pulse + ')');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
    }
  };

  /* ---------------- title backdrop ---------------- */
  Game.prototype.drawTitleBackdrop = function () {
    var ctx = this.ctx;
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, W, H);

    var dimg = Assets.img('bg_street');
    if (dimg) {
      var scale = H / dimg.naturalHeight;
      var tw = dimg.naturalWidth * scale;
      var off = -(this.time * 9) % tw;
      if (off > 0) off -= tw;
      var x = off;
      ctx.save();
      ctx.globalAlpha = 0.55;
      ctx.filter = 'blur(1px) brightness(0.85)';
      while (x < W) { ctx.drawImage(dimg, x, 0, tw, H); x += tw; }
      ctx.restore();
    }

    // rain on title
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.rainDrops.length; i++) {
      var d = this.rainDrops[i];
      d.y += (this._lastDt || 0.016) * d.sp * 0.8;
      d.x -= 60 * (this._lastDt || 0.016);
      if (d.y > H + 20) { d.y = -30; d.x = Math.random() * (W + 200) - 100; }
      if (d.x < -100) d.x = W + 80;
      ctx.strokeStyle = 'rgba(190,200,225,' + (d.a * 1.1) + ')';
      ctx.lineWidth = d.lw;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 3, d.y + d.len);
      ctx.stroke();
    }
    ctx.restore();

    var g = ctx.createRadialGradient(W / 2, H * 0.8, 20, W / 2, H * 0.8, 420);
    g.addColorStop(0, 'rgba(160,20,45,0.20)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this._drawVignette(ctx);
  };

  global.Game = Game;
})(window);
