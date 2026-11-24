/* ============================================================
   game.js — engine: camera, lighting, dialog, particles, flow
   Performance notes:
   · cached gradients/patterns (no per-frame allocation)
   · cheap glitch (canvas slice blit, never getImageData)
   · fixed-step physics accumulator
   · off-screen culling + particle caps
   ============================================================ */
(function (global) {
  'use strict';

  var W = 1024, H = 576;
  var STEP = 1 / 60;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.input = global.InputState;
    this.levels = global.GameLevels;
    this.state = 'boot';       // boot|title|select|chapters|play|dialog|pause|dead|ending|shop
    this.levelIndex = 0;
    this.level = null;
    this.player = null;
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.floating = [];
    this.camX = 0;
    this.camTargetX = 0;
    this.shakeAmt = 0;
    this.flashAmt = 0;
    this.darkness = 0;
    this.time = 0;
    this.score = 0;
    this.dialog = null;
    this.dialogQueue = null;
    this.typeIdx = 0;
    this.typeAcc = 0;
    this.typing = false;
    this.solids = [];
    this.spikeRects = [];
    this.checkpointX = 0;
    this.levelKeys = 0;
    this.settings = { shake: true, crt: true, lowFx: false };
    this.rainLevel = 'light';
    this.rainDrops = [];
    this.glitchT = 0;
    this.lastLightning = 8;
    this.deaths = 0;
    this.acc = 0;
    this.bossDown = false;
    this.pendingDifficulty = 'normal';
    this.run = null;
    this._grads = {};
    this._initRain();
    this._bindUi();
    this._loadSettings();
  }

  /* ============================================================
     SETUP
     ============================================================ */
  Game.prototype._initRain = function () {
    this.rainDrops = [];
    var n = 150;
    for (var i = 0; i < n; i++) {
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

  Game.prototype._loadSettings = function () {
    var s = Store.loadSettings();
    this.settings = { shake: s.shake, crt: s.crt, lowFx: s.lowFx };
    var vm = document.getElementById('vol-master');
    var vc = document.getElementById('vol-music');
    if (vm) { vm.value = Math.round(s.master * 100); var l = document.getElementById('vol-master-val'); if (l) l.textContent = vm.value + '%'; }
    if (vc) { vc.value = Math.round(s.music * 100); var l2 = document.getElementById('vol-music-val'); if (l2) l2.textContent = vc.value + '%'; }
    var sh = document.getElementById('opt-shake');
    if (sh) sh.checked = s.shake;
    var crt = document.getElementById('opt-crt');
    if (crt) crt.checked = s.crt;
    var fx = document.getElementById('opt-fx');
    if (fx) fx.checked = !s.lowFx;
    Audio2.setMaster(s.master);
    Audio2.setMusicVolume(s.music);
    document.getElementById('stage').classList.toggle('crt-off', !s.crt);
    document.getElementById('stage').classList.toggle('low-fx', s.lowFx);
  };

  Game.prototype.saveSettings = function () {
    Store.saveSettings({
      master: (parseFloat((document.getElementById('vol-master') || {}).value) || 70) / 100,
      music: (parseFloat((document.getElementById('vol-music') || {}).value) || 55) / 100,
      shake: this.settings.shake,
      crt: this.settings.crt,
      lowFx: this.settings.lowFx
    });
  };

  Game.prototype._bindUi = function () {
    var self = this;

    function on(id, ev, fn) {
      var el = document.getElementById(id);
      if (el) el.addEventListener(ev, fn);
    }

    on('btn-new', 'click', function () { self.openDifficulty(); });
    on('btn-continue', 'click', function () { self.continueRun(); });
    on('btn-chapters', 'click', function () { self.openChapters(); });
    on('btn-shop-title', 'click', function () { self.openShop('title'); });
    on('btn-how', 'click', function () { self.show('howto'); });
    on('btn-settings-title', 'click', function () { self._from = 'title'; self.show('settings'); });
    on('btn-install', 'click', function () { self.installPrompt(); });

    // generic data-act buttons
    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        Audio2.play('ui');
        self.action(b.getAttribute('data-act'));
      });
    });

    // difficulty cards
    Array.prototype.forEach.call(document.querySelectorAll('[data-diff]'), function (b) {
      b.addEventListener('click', function () {
        Audio2.play('ui');
        self.pendingDifficulty = b.getAttribute('data-diff');
        Array.prototype.forEach.call(document.querySelectorAll('[data-diff]'), function (x) {
          x.classList.toggle('sel', x === b);
        });
      });
    });

    // settings
    var vm = document.getElementById('vol-master');
    if (vm) vm.addEventListener('input', function () {
      Audio2.setMaster(vm.value / 100);
      var l = document.getElementById('vol-master-val'); if (l) l.textContent = vm.value + '%';
      self.saveSettings();
    });
    var vc = document.getElementById('vol-music');
    if (vc) vc.addEventListener('input', function () {
      Audio2.setMusicVolume(vc.value / 100);
      var l = document.getElementById('vol-music-val'); if (l) l.textContent = vc.value + '%';
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
    var fx = document.getElementById('opt-fx');
    if (fx) fx.addEventListener('change', function () {
      self.settings.lowFx = !fx.checked;
      document.getElementById('stage').classList.toggle('low-fx', self.settings.lowFx);
      self.saveSettings();
    });
  };

  /* ============================================================
     SAVE / RUN STATE
     ============================================================ */
  Game.prototype.freshRun = function (level) {
    return {
      level: level || 0,
      x: 0,
      hp: 0,
      score: 0,
      levelCoins: 0,
      deaths: 0,
      taken: {},     // "lvl#idx" -> 1
      killed: {},    // "lvl#idx" -> 1
      bosses: {}     // "lvl" -> 1
    };
  };

  Game.prototype.persistRun = function () {
    if (!this.run) return;
    this.run.level = this.levelIndex;
    this.run.x = this.checkpointX;
    this.run.hp = this.player ? Math.max(1, this.player.hp) : 1;
    this.run.score = this.score;
    this.run.deaths = this.deaths;
    Store.saveRun(this.run);
  };

  Game.prototype.loadRunState = function () {
    var r = Store.loadRun();
    if (!r) return null;
    if (!r.taken || typeof r.taken !== 'object') r.taken = {};
    if (!r.killed || typeof r.killed !== 'object') r.killed = {};
    if (!r.bosses || typeof r.bosses !== 'object') r.bosses = {};
    r.level = clamp(r.level | 0, 0, this.levels.length - 1);
    return r;
  };

  /* ============================================================
     SCREENS
     ============================================================ */
  var OVERLAYS = ['title', 'howto', 'settings', 'pause', 'death', 'ending', 'credits',
    'levelcard', 'difficulty', 'chapters', 'shop'];

  Game.prototype.show = function (id) {
    OVERLAYS.forEach(function (k) {
      var el = document.getElementById(k);
      if (el) el.classList.add('hidden');
    });
    if (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    }
    var hud = document.getElementById('hud');
    if (hud) hud.classList.toggle('hidden', !(id === null && (this.state === 'play' || this.state === 'dialog')));
    var touch = document.getElementById('touch');
    if (touch) touch.classList.toggle('hidden', !(id === null && this.state === 'play'));
  };

  Game.prototype.openDifficulty = function () {
    this.state = 'select';
    this.show('difficulty');
    var prof = Store.profile || Store.load();
    this.pendingDifficulty = prof.difficulty;
    Array.prototype.forEach.call(document.querySelectorAll('[data-diff]'), function (x) {
      x.classList.toggle('sel', x.getAttribute('data-diff') === prof.difficulty);
    });
    var btn = document.getElementById('btn-start-run');
    if (btn) btn.textContent = prof.difficulty === 'easy' ? 'Başla · Asan' : prof.difficulty === 'hard' ? 'Başla · Çətin' : 'Başla · Orta';
  };

  Game.prototype.openChapters = function () {
    this.state = 'chapters';
    this.show('chapters');
    this.renderChapterList();
  };

  Game.prototype.renderChapterList = function () {
    var box = document.getElementById('chapter-list');
    if (!box) return;
    var prof = Store.profile || Store.load();
    var self = this;
    box.innerHTML = '';
    this.levels.forEach(function (L, i) {
      var locked = (i + 1) > prof.unlocked;
      var done = Store.chapterDone(L.id);
      var b = document.createElement('button');
      b.className = 'chapter-row' + (locked ? ' locked' : '') + (done ? ' done' : '');
      var best = prof.chapters[L.id] ? prof.chapters[L.id].best : 0;
      b.innerHTML =
        '<span class="ch-num">' + (i + 1) + '</span>' +
        '<span class="ch-txt"><b>' + L.name + '</b><i>' + L.sub + '</i></span>' +
        '<span class="ch-state">' + (locked ? '🔒' : (done ? '✓ ' + best : '▶')) + '</span>';
      if (!locked) {
        b.addEventListener('click', function () {
          Audio2.play('ui');
          self.startChapter(i);
        });
      }
      box.appendChild(b);
    });
  };

  Game.prototype.openShop = function (from) {
    this._shopFrom = from || 'title';
    this.state = 'shop';
    this.show('shop');
    this.renderShop();
  };

  Game.prototype.renderShop = function () {
    var box = document.getElementById('shop-list');
    var walletEl = document.getElementById('shop-wallet');
    if (!box) return;
    var prof = Store.profile || Store.load();
    if (walletEl) walletEl.textContent = prof.wallet;
    var self = this;
    box.innerHTML = '';
    Store.SHOP.forEach(function (item) {
      var owned = item.kind === 'shotgun' && prof.hasShotgun;
      var poor = prof.wallet < item.price;
      var b = document.createElement('button');
      b.className = 'shop-item' + (owned ? ' owned' : (poor ? ' poor' : ''));
      b.innerHTML =
        '<img class="shop-ico" src="assets/' + item.icon + '.png" alt="" />' +
        '<span class="shop-txt"><b>' + item.name + '</b><i>' + item.sub + '</i></span>' +
        '<span class="shop-price">' + (owned ? 'ALINIB' : item.price) + '</span>';
      if (!owned) {
        b.addEventListener('click', function () {
          var res = Store.buy(item.id);
          if (res.ok) {
            Audio2.play('pickup');
            self.toast(item.name + ' alındı', 'good');
            self.applyPurchases();
          } else if (res.reason === 'poor') {
            Audio2.play('locked');
            self.toast('Kifayət qədər pul yoxdur', 'bad');
          }
          self.renderShop();
        });
      }
      box.appendChild(b);
    });
  };

  /** drain purchased consumables from the profile into a live player */
  Game.prototype.applyPurchases = function () {
    var prof = Store.profile || Store.load();
    if (!this.player) return;
    var p = this.player;
    if (prof.hasShotgun) p.hasShotgun = true;
    if (prof.ammo > 0) { p.ammo += prof.ammo; prof.ammo = 0; }
    while (prof.medkits > 0 && p.hp < p.maxHp) { prof.medkits--; p.hp++; }
    if (prof.lanterns > 0) { p.lanternT = Math.max(p.lanternT, 60); prof.lanterns--; }
    if (prof.coffees > 0) { p.coffeeT = Math.max(p.coffeeT, 35); prof.coffees--; }
    if (prof.shields > 0) { p.shield = 1; prof.shields--; }
    p.maxHp = this.diff.hearts;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    Store.save();
    this.updateHud();
  };

  /* ============================================================
     FLOW
     ============================================================ */
  Game.prototype.diff = null;

  Game.prototype.startNewGame = function (diffKey) {
    Audio2.resume();
    Audio2.play('portal');
    var prof = Store.profile || Store.load();
    if (diffKey && Store.DIFFICULTIES[diffKey]) {
      prof.difficulty = diffKey;
      Store.setDifficulty(diffKey);
    }
    this.diff = Store.diff();
    Store.clearRun();
    this.run = this.freshRun(0);
    this.score = 0;
    this.deaths = 0;
    this.bossDown = false;
    this.player = new Ent.Player(0, 0, this.diff);
    this.player.maxHp = this.diff.hearts;
    this.player.hp = this.diff.hearts;
    this.player.ammo = prof.ammo || 0;
    this.player.hasShotgun = !!prof.hasShotgun;
    this.loadLevel(0, { x: 0 });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.startChapter = function (index) {
    Audio2.resume();
    Audio2.play('portal');
    var prof = Store.profile || Store.load();
    this.diff = Store.diff();
    Store.clearRun();
    this.run = this.freshRun(index);
    this.score = 0;
    this.deaths = 0;
    this.bossDown = false;
    this.player = new Ent.Player(0, 0, this.diff);
    this.player.maxHp = this.diff.hearts;
    this.player.hp = this.diff.hearts;
    this.player.ammo = prof.ammo || 0;
    this.player.hasShotgun = !!prof.hasShotgun;
    if (prof.medkits > 0) { prof.medkits--; Store.save(); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); }
    this.loadLevel(index, { x: 0 });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.continueRun = function () {
    var r = this.loadRunState();
    if (!r) { this.startNewGame(); return; }
    Audio2.resume();
    this.diff = Store.diff();
    this.run = r;
    this.score = r.score || 0;
    this.deaths = r.deaths || 0;
    this.bossDown = !!r.bosses[r.level];
    var prof = Store.profile || Store.load();
    this.player = new Ent.Player(0, 0, this.diff);
    this.player.maxHp = this.diff.hearts;
    this.player.hp = clamp(r.hp || this.diff.hearts, 1, this.diff.hearts);
    this.player.ammo = prof.ammo || 0;
    this.player.hasShotgun = !!prof.hasShotgun;
    this.loadLevel(r.level, { x: r.x || 0 });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.refreshContinue = function () {
    var btn = document.getElementById('btn-continue');
    if (!btn) return;
    var r = this.loadRunState();
    if (r) {
      btn.classList.remove('hidden');
      var L = this.levels[r.level];
      btn.textContent = 'Davam et · ' + (L ? L.name : '');
    } else {
      btn.classList.add('hidden');
    }
    var cbtn = document.getElementById('btn-chapters');
    if (cbtn) {
      var prof = Store.profile || Store.load();
      cbtn.classList.toggle('hidden', prof.unlocked <= 1 && !Store.hasRun());
    }
  };

  Game.prototype.loadLevel = function (index, opts) {
    opts = opts || {};
    index = clamp(index, 0, this.levels.length - 1);
    this.levelIndex = index;
    var L = this.levels[index];
    this.level = L;
    var prof = Store.profile || Store.load();
    var run = this.run || this.freshRun(index);
    this.run = run;

    // ---- solids ----
    this.solids = [];
    this.spikeRects = [];
    for (var i = 0; i < L.platforms.length; i++) {
      var p = L.platforms[i];
      this.solids.push({
        x: p.x, y: p.y, w: p.w, h: p.h, kind: p.kind,
        oneway: p.kind === 'ledge'
      });
    }
    for (var hz = 0; hz < L.hazards.length; hz++) {
      var hzz = L.hazards[hz];
      this.spikeRects.push({ x: hzz.x, y: 470 - 15, w: hzz.w, h: 15 });
    }

    // ---- entities (respecting this run's taken / killed) ----
    this.enemies = [];
    this.items = [];
    this.npcs = [];
    this.bullets = [];
    this.enemyBullets = [];
    this.particles = [];
    this.floating = [];
    this.levelKeys = 0;
    this.triggered = {};
    this.bossDown = !!run.bosses[L.id];

    for (var e = 0; e < L.enemies.length; e++) {
      var ek = L.id + '#' + e;
      if (run.killed[ek]) continue;
      var en = new Ent.Enemy(L.enemies[e], this.diff);
      en.uid = ek;
      this.enemies.push(en);
    }
    for (var it = 0; it < L.items.length; it++) {
      var ik = L.id + '#' + it;
      if (run.taken[ik]) {
        if (L.items[it].type === 'key') this.levelKeys++;
        continue;
      }
      var item = new Ent.Item(L.items[it]);
      item.uid = ik;
      item.idx = it;
      this.items.push(item);
    }
    for (var n = 0; n < L.npcs.length; n++) {
      var npc = new Ent.Npc(L.npcs[n]);
      npc.uid = L.id + '#npc' + n;
      this.npcs.push(npc);
    }

    // ---- player ----
    var px = (typeof opts.x === 'number' && opts.x > 0) ? opts.x : L.start.x;
    if (!this.player) this.player = new Ent.Player(px, L.start.y, this.diff);
    this.player.x = px;
    this.player.y = L.start.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.alive = true;
    this.player.invuln = 0.8;
    this.player.h = 64;
    this.player.crouch = false;
    this.player.maxHp = this.diff.hearts;
    if (this.player.hp <= 0) this.player.hp = this.diff.hearts;
    if (this.player.hp > this.player.maxHp) this.player.hp = this.player.maxHp;
    this.player.ammo = Math.max(this.player.ammo, 0);

    this.checkpointX = px;
    this.camX = clamp(px - W / 2, 0, Math.max(0, L.width - W));
    this.darkness = (L.dark || 0) * (this.diff.key === 'easy' ? 0.82 : this.diff.key === 'hard' ? 1.1 : 1);
    this.rainLevel = L.rain || 'light';

    // ---- audio ----
    Audio2.resume();
    Audio2.setRain(this.rainLevel === 'off' ? 'off' : this.rainLevel);
    Audio2.setMood(L.mood || 'calm');

    this.showLevelCard(L);

    document.getElementById('level-name').textContent = L.kicker + ' · ' + L.name;
    document.getElementById('objective').textContent = L.objective || '';
    this.updateHud();
    this.persistRun();
  };

  Game.prototype.showLevelCard = function (L) {
    var card = document.getElementById('levelcard');
    if (!card) return;
    document.getElementById('lc-kicker').textContent = L.kicker;
    document.getElementById('lc-title').textContent = L.name;
    document.getElementById('lc-sub').textContent = L.sub || '';
    card.classList.remove('hidden');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    this.state = 'play';
    var self = this;
    clearTimeout(this._cardTO);
    this._cardTO = setTimeout(function () { card.classList.add('hidden'); }, 3200);
  };

  Game.prototype.restartLevel = function (fresh) {
    if (!this.player) return;
    if (fresh && this.run) {
      // "start over" -> reset this chapter's loot and kills, refund its coins
      var L = this.level;
      for (var k in this.run.taken) if (k.indexOf(L.id + '#') === 0) delete this.run.taken[k];
      for (var k2 in this.run.killed) if (k2.indexOf(L.id + '#') === 0) delete this.run.killed[k2];
      if (this.run.levelCoins) {
        Store.addCoins(-this.run.levelCoins);
        this.run.levelCoins = 0;
      }
      delete this.run.bosses[L.id];
      this.levelKeys = 0;
    }
    this.player.hp = this.diff.hearts;
    this.player.alive = true;
    this.player.invuln = 1;
    this.player.vx = 0;
    this.player.vy = 0;
    this.loadLevel(this.levelIndex, { x: this.level.start.x });
    if (fresh) this.checkpointX = this.level.start.x;
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.restartFromCheckpoint = function () {
    if (!this.player) return;
    this.player.alive = true;
    this.player.invuln = 1.2;
    this.player.hp = Math.max(1, Math.min(this.diff.hearts, Math.ceil(this.diff.hearts * 0.6)));
    this.player.vx = 0;
    this.player.vy = 0;
    var x = Math.max(this.level.start.x, this.checkpointX);
    this.loadLevel(this.levelIndex, { x: x });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.goToMenu = function () {
    this.state = 'title';
    Audio2.setRain('light');
    Audio2.setMood('calm');
    this.persistRun();
    this.show('title');
    this.refreshContinue();
    this.drawTitleBackdrop();
  };

  Game.prototype.onPlayerDeath = function () {
    var self = this;
    this.deaths++;
    if (this.run) this.run.deaths = this.deaths;
    var prof = Store.profile || Store.load();
    prof.deaths++;
    Store.save();
    this.state = 'dead';
    document.getElementById('hud').classList.add('hidden');
    var touch = document.getElementById('touch');
    if (touch) touch.classList.add('hidden');
    var quotes = [
      'Qaranlıq səni uddu...',
      'Sən yenə də onu tapa bilmədin.',
      'Yağış sənin adını yudu.',
      'O, səni gözləyirdi.',
      'Bu dəfə qaça bilmədin.',
      'Bir addım daha... bir nəfəs daha.'
    ];
    document.getElementById('death-quote').textContent = quotes[Math.floor(Math.random() * quotes.length)];
    setTimeout(function () {
      if (self.state === 'dead') self.show('death');
    }, 850);
  };

  Game.prototype.onBossDown = function (boss) {
    this.bossDown = true;
    if (this.run) this.run.bosses[this.level.id] = 1;
    this.flash(0.8);
    this.glitchT = 0.7;
    this.toast('Kölgə dağıldı', 'good');
    this.persistRun();
  };

  /* ============================================================
     ACTIONS
     ============================================================ */
  Game.prototype.action = function (act) {
    switch (act) {
      case 'resume':
        this.state = 'play'; this.show(null); break;
      case 'start-run':
        this.startNewGame(this.pendingDifficulty); break;
      case 'difficulty-back':
        this.state = 'title'; this.show('title'); break;
      case 'chapters-back':
        this.state = 'title'; this.show('title'); break;
      case 'restart-fresh':
        this.restartLevel(true); break;
      case 'restart':
        this.restartLevel(false); break;
      case 'settings':
        this._from = (this.state === 'pause') ? 'pause' : 'title';
        this.show('settings'); break;
      case 'settings-back':
        if (this._from === 'pause') { this.show('pause'); this.state = 'pause'; }
        else { this.show('title'); this.state = 'title'; }
        break;
      case 'menu':
        this.goToMenu(); break;
      case 'retry':
        this.restartFromCheckpoint(); break;
      case 'to-checkpoint':
        this.restartFromCheckpoint(); break;
      case 'shop':
        this.openShop(this.state === 'pause' ? 'pause' : 'title'); break;
      case 'shop-back':
        if (this._shopFrom === 'pause') { this.show('pause'); this.state = 'pause'; }
        else { this.show('title'); this.state = 'title'; this.refreshContinue(); }
        break;
      case 'howto-back':
        this.show('title'); this.state = 'title'; break;
      case 'ending-menu':
        this.state = 'title'; this.show('title'); this.refreshContinue(); break;
      case 'ending-credits':
        this.show('credits'); break;
      case 'credits-back':
        this.show('ending'); break;
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
    var pSrc = line.portrait || (line.who === 'Alice' ? 'alice_a0' : line.who === 'Leo' ? 'leo_0' : null);
    if (pSrc) {
      portrait.src = 'assets/' + pSrc + '.png';
      portrait.classList.remove('hidden');
    } else {
      portrait.classList.add('hidden');
    }
    nm.textContent = line.who || '';
    nm.style.visibility = line.who ? 'visible' : 'hidden';
    el.classList.remove('hidden');
    if (this.player) this.player.vx = 0;
    Audio2.play('blip');
  };

  Game.prototype._closeDialog = function () {
    this.dialog = null;
    this.dialogQueue = null;
    document.getElementById('dialog').classList.add('hidden');
    this.state = 'play';
    document.getElementById('hud').classList.remove('hidden');
    var touch = document.getElementById('touch');
    if (touch) touch.classList.remove('hidden');
    var done = this._dialogDone;
    this._dialogDone = null;
    if (done) done();
  };

  Game.prototype.updateDialog = function (dt) {
    if (!this.dialog) return;
    var text = this.dialog.text || '';
    if (this.typing) {
      this.typeAcc += dt * 52;
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
     HELPERS
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

  Game.prototype.fireBullet = function (x, y, dir, power) {
    this.bullets.push(new Ent.Bullet(x, y, dir, power || 1));
    this.spawnBurst(x + dir * 14, y, '#ffd9a0', 5);
  };

  Game.prototype.spawnBurst = function (x, y, color, n) {
    if (this.settings.lowFx) n = Math.ceil(n * 0.5);
    if (this.particles.length > 240) return;
    n = Math.min(n, 240 - this.particles.length);
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 220;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.35 + Math.random() * 0.55,
        max: 1.5,
        r: 1.2 + Math.random() * 2.8,
        color: color,
        grav: 320
      });
    }
  };

  Game.prototype.spawnDust = function (x, y, n) {
    if (this.settings.lowFx) n = Math.ceil(n * 0.5);
    if (this.particles.length > 240) return;
    for (var i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 18,
        y: y - 2,
        vx: (Math.random() - 0.5) * 90,
        vy: -20 - Math.random() * 60,
        life: 0.3 + Math.random() * 0.35,
        max: 1.2,
        r: 1 + Math.random() * 2.4,
        color: 'rgba(170,140,150,0.5)',
        grav: 60
      });
    }
  };

  Game.prototype.dropCoin = function (x, y) {
    this.items.push(new Ent.Item({ type: 'coin', x: x, y: y }));
  };

  Game.prototype.dropItemAt = function (type, x, y) {
    this.items.push(new Ent.Item({ type: type, x: x, y: y }));
  };

  Game.prototype.addScore = function (n) {
    this.score += Math.round(n * (this.diff ? this.diff.scoreMul : 1));
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
      setTimeout(function () { if (el.parentNode) el.remove(); }, 420);
    }, 1500);
  };

  Game.prototype.floatText = function (x, y, txt, color) {
    if (this.floating.length > 26) return;
    this.floating.push({ x: x, y: y, txt: txt, life: 1.1, color: color || '#ffd9a0' });
  };

  Game.prototype.shake = function (amt) {
    if (!this.settings.shake) return;
    this.shakeAmt = Math.min(16, this.shakeAmt + amt);
  };

  Game.prototype.flash = function (amt) {
    if (this.settings.lowFx) amt *= 0.55;
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
    if (k) k.textContent = this.levelKeys;
    var c = document.getElementById('coin-count');
    if (c) c.textContent = (Store.profile ? Store.profile.wallet : 0);
    var fl = document.getElementById('flower-count');
    if (fl) fl.textContent = (Store.profile ? Store.profile.flowers : 0);
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

    // particles (always)
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

    if (this.input.state.pausePressed) {
      this.state = 'pause';
      this.persistRun();
      this.show('pause');
      return;
    }

    // ---- fixed-step physics ----
    this.acc += dt;
    var steps = 0;
    while (this.acc >= STEP && steps < 5) {
      this._step(STEP);
      this.acc -= STEP;
      steps++;
    }
    if (steps === 5) this.acc = 0;

    this._updateCamera(dt);
    this._updateAtmosphere(dt);
    Audio2.tickMusic(dt, this.enemies.length > 0);
    this.updateHud();
  };

  Game.prototype._step = function (dt) {
    var p = this.player;
    if (!p) return;
    p.update(dt, this);

    // checkpoint (only forward, on ground, past the last anchor)
    if (p.onGround && p.alive) {
      var best = this.checkpointX;
      for (var ci = 0; ci < this.level.checkpoints.length; ci++) {
        var cx = this.level.checkpoints[ci];
        if (p.x >= cx && cx > best) best = cx;
      }
      if (best > this.checkpointX) {
        this.checkpointX = best;
        this.persistRun();
      }
    }

    for (var e = this.enemies.length - 1; e >= 0; e--) {
      var en = this.enemies[e];
      if (!en.dead) en.update(dt, this);
      if (en.dead) {
        if (this.run && en.uid) this.run.killed[en.uid] = 1;
        this.enemies.splice(e, 1);
      }
    }

    for (var b = this.bullets.length - 1; b >= 0; b--) {
      var bu = this.bullets[b];
      bu.update(dt, this);
      if (bu.dead) this.bullets.splice(b, 1);
    }
    for (var eb = this.enemyBullets.length - 1; eb >= 0; eb--) {
      var ebu = this.enemyBullets[eb];
      ebu.update(dt, this);
      if (ebu.dead) this.enemyBullets.splice(eb, 1);
    }

    for (var it = this.items.length - 1; it >= 0; it--) {
      var item = this.items[it];
      item.update(dt);
      if (!p.alive) continue;
      if (Ent.overlap(item.box(), p.box())) this._collect(item, it);
    }

    for (var n = 0; n < this.npcs.length; n++) {
      var npc = this.npcs[n];
      npc.update(dt, this);
      if (npc.near(p) && this.input.state.interactPressed) {
        if (!npc.talked) {
          npc.talked = true;
          this._npcTalk(npc);
        } else if (npc.gift && !npc.gifted) {
          this._giveFlower(npc);
        }
      }
    }

    for (var t = 0; t < this.level.triggers.length; t++) {
      var tr = this.level.triggers[t];
      var key = 'tr' + t;
      if (!this.triggered[key] && Math.abs(p.x - tr.x) < (tr.w || 20) + 20) {
        this.triggered[key] = true;
        this.say(tr.lines);
        break;
      }
    }

    this._checkExit(dt);
  };

  Game.prototype._npcTalk = function (npc) {
    var self = this;
    this.say(npc.talk, function () {
      if (npc.final) self.finishGame();
      else if (npc.after) self.toast(npc.after, 'good');
      if (npc.gift) {
        var prof = Store.profile || Store.load();
        if (prof.flowers > 0) self.toast('E — ağ çiçəyi ona ver', 'good');
      }
    });
  };

  Game.prototype._giveFlower = function (npc) {
    var prof = Store.profile || Store.load();
    if (prof.flowers <= 0) {
      this.toast('Çiçəyin yoxdur — mağazadan al', 'bad');
      return;
    }
    npc.gifted = true;
    prof.flowers--;
    prof.gifts++;
    Store.save();
    Audio2.play('heal');
    this.spawnBurst(npc.x, npc.y - 50, '#ffe6f0', 26);
    this.flash(0.3);
    var self = this;
    this.say([
      { who: 'Leo', portrait: 'leo_0', text: 'Bu... sənin üçün. Çoxdan vermək istəyirdim.' },
      { who: 'Alice', portrait: npc.final ? 'alice_ghost' : 'alice_a1', text: 'Sən onu bu günə qədər saxladın?' },
      { who: 'Leo', portrait: 'leo_0', text: 'Bilmirdim nə vaxt düzgün an olacaq. Düzgün an heç vaxt gəlmir — qərar vermək lazımdır.' },
      { who: 'Alice', portrait: npc.final ? 'alice_ghost' : 'alice_a2', text: 'Bunu xatırla, Leo. Bəzən gecikmiş bir çiçək, ən doğru çiçəkdir.' }
    ], function () {
      self.addScore(60);
      self.toast('Hədiyyə qəbul edildi · +60', 'good');
      self.updateHud();
    });
  };

  Game.prototype._collect = function (item, idx) {
    var p = this.player;
    var self = this;
    var dm = this.diff || Store.diff();
    switch (item.type) {
      case 'coin': {
        var gain = Math.max(1, Math.round(1 * (dm.coinMul || 1)));
        p.coins += gain;
        if (this.run) this.run.levelCoins = (this.run.levelCoins || 0) + gain;
        Store.addCoins(gain);
        this.score += 5;
        Audio2.play('coin');
        this.floatText(item.x, item.y - 20, '+1', '#ffd98a');
        this.spawnBurst(item.x, item.y - 20, '#c9a227', 6);
        this.items.splice(idx, 1);
        break;
      }
      case 'ammo': {
        var amt = Math.max(4, Math.round(8 * (dm.ammoMul || 1)));
        p.ammo += amt;
        Audio2.play('pickup');
        this.toast('+' + amt + ' güllə', 'good');
        this.floatText(item.x, item.y - 20, '+' + amt, '#ffb070');
        this.items.splice(idx, 1);
        break;
      }
      case 'medkit':
        if (p.hp >= p.maxHp) return;
        p.heal(1);
        Audio2.play('heal');
        this.toast('+1 ürək', 'good');
        this.floatText(item.x, item.y - 20, '+1 ♥', '#ff7a8a');
        this.items.splice(idx, 1);
        break;
      case 'key':
        this.levelKeys++;
        this.score += 20;
        Audio2.play('pickup');
        this.toast('Açar tapıldı', 'good');
        this.flash(0.2);
        this.items.splice(idx, 1);
        break;
      case 'shotgun':
        p.hasShotgun = true;
        p.ammo += Math.round(16 * (dm.ammoMul || 1));
        Audio2.play('pickup');
        this.toast('Ov tüfəngi götürüldü', 'good');
        this.items.splice(idx, 1);
        break;
      case 'gem': {
        var prof = Store.profile || Store.load();
        prof.flowers++;
        Store.save();
        Audio2.play('heal');
        this.toast('Ağ çiçək tapıldı — Alice-ə ver', 'good');
        this.items.splice(idx, 1);
        break;
      }
      case 'photo':
      case 'note':
      case 'phone':
        this.items.splice(idx, 1);
        Audio2.play('portal');
        this.glitchT = 0.45;
        this.flash(0.22);
        this.say(item.lines, function () { self.persistRun(); });
        break;
      default:
        this.items.splice(idx, 1);
        break;
    }
    if (this.run && item.idx !== undefined) this.run.taken[item.uid] = 1;
    this.persistRun();
    this.updateHud();
  };

  Game.prototype._checkExit = function () {
    var L = this.level;
    if (!L.exit) return;
    var p = this.player;
    if (Math.abs(p.x - L.exit.x) > 76) return;

    if (L.exit.afterBoss && !this.bossDown) {
      if (!this._lockedMsg || this.time - this._lockedMsg > 2) {
        this._lockedMsg = this.time;
        Audio2.play('locked');
        this.toast('Kölgəni dayandırmalısan', 'bad');
      }
      return;
    }

    var needKeys = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    if (needKeys > 0 && this.levelKeys < needKeys) {
      if (!this._lockedMsg || this.time - this._lockedMsg > 2) {
        this._lockedMsg = this.time;
        Audio2.play('locked');
        this.toast(needKeys > 1 ? ('Qapı bağlıdır — ' + needKeys + ' açar lazımdır') : 'Qapı bağlıdır — açar lazımdır', 'bad');
      }
      return;
    }

    if (this.input.state.interactPressed) this.advanceLevel();
  };

  Game.prototype.advanceLevel = function () {
    var L = this.level;
    var next = L.exit.to;
    Audio2.play('portal');
    this.flash(0.7);
    this.glitchT = 0.6;
    Store.markChapter(L.id, this.score);
    Store.unlockThrough(Math.min(next, this.levels.length - 1));
    this.spawnBurst(this.player.x, this.player.y - 30, '#e04158', 34);
    this.persistRun();
    this.run.level = next;
    this.run.x = 0;
    this.run.levelCoins = 0;
    Store.saveRun(this.run);

    var self = this;
    var el = document.getElementById('levelcard');
    if (el) el.classList.add('hidden');
    this.state = 'transition';
    setTimeout(function () {
      if (next >= self.levels.length) { self.finishGame(); return; }
      self.loadLevel(next, { x: 0 });
      self.state = 'play';
    }, 520);
  };

  Game.prototype.finishGame = function () {
    this.state = 'ending';
    var prof = Store.profile || Store.load();
    prof.endings++;
    if (this.score > prof.bestScore) prof.bestScore = this.score;
    Store.save();
    Store.markChapter(this.level.id, this.score);
    Store.unlockThrough(this.levels.length - 1);
    Store.clearRun();
    this.run = null;
    document.getElementById('hud').classList.add('hidden');
    var touch = document.getElementById('touch');
    if (touch) touch.classList.add('hidden');

    var E = (prof.gifts > 0) ? global.GameEnding : global.GameEndingPlain;
    document.getElementById('ending-title').textContent = E.title;
    var extra = '<p class="ending-stat">Çətinlik: <b>' + this.diff.name +
      '</b> · Xal: <b>' + this.score + '</b> · Ölüm: <b>' + this.deaths +
      '</b> · Verilən çiçək: <b>' + prof.gifts + '</b></p>';
    document.getElementById('ending-body').innerHTML =
      E.body.map(function (p) { return '<p>' + p + '</p>'; }).join('') + extra;
    var self = this;
    setTimeout(function () { self.show('ending'); }, 420);
  };

  Game.prototype._updateCamera = function (dt) {
    var p = this.player;
    if (!p || !this.level) return;
    var target = p.x - W / 2 + p.facing * 60;
    target = clamp(target, 0, Math.max(0, this.level.width - W));
    this.camTargetX = target;
    var k = 1 - Math.pow(0.0015, dt);
    this.camX += (this.camTargetX - this.camX) * k;
    this.camX = clamp(this.camX, 0, Math.max(0, this.level.width - W));
  };

  Game.prototype._updateAtmosphere = function (dt) {
    var intensity = this.rainLevel === 'off' ? 0 : (this.rainLevel === 'heavy' ? 1 : 0.45);
    if (intensity > 0) {
      for (var i = 0; i < this.rainDrops.length; i++) {
        var d = this.rainDrops[i];
        d.y += d.sp * dt * (0.55 + intensity * 0.7);
        d.x -= 90 * dt * intensity;
        if (d.y > H + 30) { d.y = -40; d.x = Math.random() * (W + 260) - 130; }
        if (d.x < -140) d.x = W + 120;
      }
    }
    if (this.rainLevel !== 'off') {
      this.lastLightning -= dt;
      if (this.lastLightning <= 0) {
        this.lastLightning = 12 + Math.random() * 18;
        this.flash(0.13);
        Audio2.play('thunder');
      }
    }
  };

  /* ============================================================
     DRAW
     ============================================================ */
  Game.prototype.draw = function () {
    var ctx = this.ctx;
    if (this.state === 'title' || this.state === 'boot' || this.state === 'select' || this.state === 'chapters') {
      this.drawTitleBackdrop();
      return;
    }
    if (this.state === 'shop') {
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

    if (this.flashAmt > 0.01) {
      ctx.fillStyle = 'rgba(196,35,58,' + (this.flashAmt * 0.55) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (this.glitchT > 0 && !this.settings.lowFx) this._drawGlitch(ctx);
    this._drawVignette(ctx);
  };

  Game.prototype._bgPattern = function (key) {
    var g = this._grads['bg:' + key];
    if (g !== undefined) return g;
    var im = Assets.img(key);
    if (!im) { this._grads['bg:' + key] = null; return null; }
    var tileW = Math.max(560, Math.round(H * (im.naturalWidth / im.naturalHeight)));
    var c = document.createElement('canvas');
    c.width = tileW; c.height = H;
    var cc = c.getContext('2d');
    cc.imageSmoothingEnabled = true;
    cc.drawImage(im, 0, 0, tileW, H);
    this._grads['bg:' + key] = c;
    return c;
  };

  Game.prototype._drawBackground = function (ctx) {
    var L = this.level;
    var ctx2 = ctx;
    ctx2.fillStyle = '#05040a';
    ctx2.fillRect(0, 0, W, H);

    var tile = this._bgPattern(L.bg);
    if (!tile) return;
    var tw = tile.width;
    var off = -(this.camX * (L.bgParallax || 0.3)) % tw;
    if (off > 0) off -= tw;

    var bobY = Math.sin(this.time * 0.25) * 2;
    var x = off;
    ctx2.globalAlpha = 0.95;
    var guard = 0;
    while (x < W && guard++ < 8) {
      ctx2.drawImage(tile, x, bobY, tw, H);
      x += tw;
    }
    ctx2.globalAlpha = 1;

    // cached atmospheric gradient
    var g = this._grads.dim;
    if (!g) {
      g = ctx2.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(10,4,14,0.55)');
      g.addColorStop(0.55, 'rgba(8,3,12,0.25)');
      g.addColorStop(1, 'rgba(4,2,8,0.92)');
      this._grads.dim = g;
    }
    ctx2.fillStyle = g;
    ctx2.fillRect(0, 0, W, H);

    var mg = this._grads.moon;
    if (!mg) {
      mg = ctx2.createRadialGradient(W * 0.72, H * 0.16, 10, W * 0.72, H * 0.16, 300);
      mg.addColorStop(0, 'rgba(200,30,50,0.16)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      this._grads.moon = mg;
    }
    ctx2.fillStyle = mg;
    ctx2.fillRect(0, 0, W, H);
  };

  Game.prototype._drawWorld = function (ctx) {
    var cam = this.camX;
    ctx.save();
    ctx.translate(-cam, 0);

    var L = this.level;

    for (var i = 0; i < this.solids.length; i++) this._drawSolid(ctx, this.solids[i]);

    for (var s = 0; s < this.spikeRects.length; s++) {
      var sp = this.spikeRects[s];
      if (this._cull(sp.x, 120)) continue;
      var n = Math.ceil(sp.w / 40);
      for (var k = 0; k < n; k++) {
        Assets.blitH(ctx, 'prop_spikes', sp.x + 20 + k * 40, sp.y + 18, 34, false);
      }
      var gg = ctx.createLinearGradient(0, sp.y - 14, 0, sp.y + 6);
      gg.addColorStop(0, 'rgba(220,30,50,0)');
      gg.addColorStop(1, 'rgba(220,30,50,0.18)');
      ctx.fillStyle = gg;
      ctx.fillRect(sp.x, sp.y - 14, sp.w, 20);
    }

    for (var p = 0; p < L.props.length; p++) {
      var pr = L.props[p];
      if (this._cull(pr.x, 260)) continue;
      var alpha = pr.dark ? 0.42 : 1;
      ctx.save();
      if (pr.dark) ctx.filter = 'brightness(0.45)';
      Assets.blit(ctx, pr.a, pr.x, pr.y + 2, pr.s || 1, !!pr.flip, alpha);
      ctx.restore();
    }

    this._drawExit(ctx);

    for (var it = 0; it < this.items.length; it++) {
      var itemx = this.items[it];
      if (this._cull(itemx.x, 90)) continue;
      itemx.draw(ctx);
    }

    for (var n2 = 0; n2 < this.npcs.length; n2++) {
      var npc = this.npcs[n2];
      if (this._cull(npc.x, 140)) continue;
      npc.draw(ctx);
      if (npc.near(this.player) && this.state === 'play') {
        var label = (!npc.talked || (npc.gift && !npc.gifted)) ? 'E' : null;
        if (label) this._drawPrompt(ctx, npc.x, npc.y - 118, label);
      }
    }

    for (var e = 0; e < this.enemies.length; e++) {
      var en = this.enemies[e];
      if (this._cull(en.x, 160)) continue;
      en.draw(ctx, this);
    }

    if (this.player) this.player.draw(ctx, this);

    for (var b = 0; b < this.bullets.length; b++) this.bullets[b].draw(ctx);
    for (var ebi = 0; ebi < this.enemyBullets.length; ebi++) {
      this.enemyBullets[ebi].draw(ctx, this.time);
    }

    for (var q = 0; q < this.particles.length; q++) {
      var pt = this.particles[q];
      var a = Math.max(0, pt.life / pt.max);
      if (a <= 0) continue;
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.r * (0.4 + a * 0.8), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (this.floating.length) {
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (var ft = 0; ft < this.floating.length; ft++) {
        var f2 = this.floating[ft];
        ctx.globalAlpha = Math.min(1, f2.life * 1.6);
        ctx.fillStyle = f2.color;
        ctx.shadowColor = 'rgba(0,0,0,.9)';
        ctx.shadowBlur = 6;
        ctx.fillText(f2.txt, f2.x, f2.y);
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  };

  Game.prototype._cull = function (x, pad) {
    return (x < this.camX - pad) || (x > this.camX + W + pad);
  };

  Game.prototype._drawPrompt = function (ctx, x, y, label) {
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
    ctx.fillText(label || 'E', x, y + bob + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  };

  Game.prototype._drawSolid = function (ctx, s) {
    var pat = this._brickPattern;
    var topY = s.y;

    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, topY, s.w, s.h);
    ctx.clip();

    if (!pat) pat = this._makePattern(ctx, 'tex_brick', 2.1);
    ctx.fillStyle = pat || '#191320';
    ctx.fillRect(s.x, topY, s.w, s.h);

    var g = this._grads.solidDown;
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, 160);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.72)');
      this._grads.solidDown = g;
    }
    ctx.save();
    ctx.translate(0, topY);
    ctx.fillStyle = g;
    ctx.fillRect(s.x, 0, s.w, s.h);
    ctx.restore();

    var rim = this._grads.solidRim;
    if (!rim) {
      rim = ctx.createLinearGradient(0, 0, 0, 14);
      rim.addColorStop(0, 'rgba(190,30,50,0.42)');
      rim.addColorStop(1, 'rgba(190,30,50,0)');
      this._grads.solidRim = rim;
    }
    ctx.save();
    ctx.translate(0, topY);
    ctx.fillStyle = rim;
    ctx.fillRect(s.x, 0, s.w, 14);
    ctx.restore();

    ctx.restore();

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
    if (this._cull(L.exit.x, 170)) return;
    var needKeys = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    var locked = (needKeys > 0 && this.levelKeys < needKeys) || (L.exit.afterBoss && !this.bossDown);
    var pulse = 0.72 + Math.sin(this.time * 2.6) * 0.28;
    var x = L.exit.x, y = L.exit.y;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = locked ? 0.42 : pulse;
    Assets.blitH(ctx, 'u_portal2', x, y - 6, 96, false, undefined, 70);
    ctx.globalAlpha = locked ? 0.14 : pulse * 0.35;
    Assets.blitH(ctx, 'u_beams', x, y - 4, 110, false, undefined, 120);
    ctx.restore();

    if (!locked && Math.abs(this.player.x - x) < 76) {
      this._drawPrompt(ctx, x, y - 104, 'E');
    }
    if (locked) Assets.blit(ctx, 'u_lock', x, y - 92, 0.85, false);
  };

  Game.prototype._drawLighting = function (ctx) {
    var d = this.darkness;
    var lanternB = this.player && this.player.lanternT > 0;
    if (d <= 0.01 && !lanternB) return;
    var p = this.player;
    var px = p.x - this.camX, py = p.y - 34;
    var radius = lanternB ? 420 : 340;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    var g = ctx.createRadialGradient(px, py, 30, px, py, radius);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.45, 'rgba(4,2,8,' + (d * (lanternB ? 0.22 : 0.42)) + ')');
    g.addColorStop(1, 'rgba(3,1,6,' + (lanternB ? Math.min(0.75, d) : d) + ')');
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
    var n = 3;
    for (var i = 0; i < n; i++) {
      var y = Math.random() * H;
      var h = 2 + Math.random() * 20;
      var off = (Math.random() - 0.5) * 40;
      try {
        ctx.drawImage(this.canvas, 0, y, W, h, off, y, W, h);
      } catch (e) { }
      ctx.fillStyle = 'rgba(230,30,60,' + (0.03 + Math.random() * 0.06) + ')';
      ctx.fillRect(0, y, W, h);
    }
  };

  Game.prototype._drawVignette = function (ctx) {
    var g = this._grads.vig;
    if (!g) {
      g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.92);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      this._grads.vig = g;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

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

    var tile = this._bgPattern('bg_bdu');
    if (tile) {
      var tw = tile.width;
      var off = -(this.time * 9) % tw;
      if (off > 0) off -= tw;
      var x = off;
      ctx.save();
      ctx.globalAlpha = 0.5;
      var guard = 0;
      while (x < W && guard++ < 8) { ctx.drawImage(tile, x, 0, tw, H); x += tw; }
      ctx.restore();
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    var dtA = this._lastDt || 0.016;
    for (var i = 0; i < this.rainDrops.length; i++) {
      var d = this.rainDrops[i];
      d.y += dtA * d.sp * 0.8;
      d.x -= 60 * dtA;
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

  /* ---------------- PWA install ---------------- */
  Game.prototype.installPrompt = function () {
    if (window.__deferredPrompt) {
      window.__deferredPrompt.prompt();
      var self = this;
      window.__deferredPrompt.userChoice.then(function (c) {
        if (c.outcome === 'accepted') self.toast('Tətbiq quraşdırılır', 'good');
        window.__deferredPrompt = null;
      });
      return;
    }
    var isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    this.toast(isIOS
      ? 'Safari: Paylaş → Ekrana əlavə et'
      : 'Brauzer menyusu → "Tətbiqi quraşdır"', 'good');
  };

  global.Game = Game;
})(window);
