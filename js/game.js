/* ============================================================
   game.js — engine: camera, lighting, dialog, journal, particles
   ------------------------------------------------------------
   Performance
   · fixed-step physics accumulator (1/60), bails out the moment
     the game state changes mid-step
   · cached gradients / patterns / glow sprites — the render
     loop allocates nothing but particle objects
   · solids & props are clipped to the camera before filling
   · NO ctx.filter (it forces a software pass on every draw)
   · localStorage writes are debounced to ~1/2s

   Correctness
   · a step can never run twice for the same trigger (state guard)
   · chapter advance is guarded against double entry
   · consumables are granted exactly once (no ammo exploit)
   · the player keeps a melee fallback, so a boss can never softlock
   ============================================================ */
(function (global) {
  'use strict';

  var W = 1024, H = 576;
  var STEP = 1 / 60;

  /* weapons.js may be absent in headless tooling — never crash on it */
  var Weapons = global.Weapons || {
    get: function () { return { id: 'pistol', name: 'Tapança', icon: 'i_pistol', cost: 1, dmg: 1, cd: 0.25, pellets: 1, spread: 0, speed: 1060, range: 470 }; },
    owned: function () { return [{ id: 'pistol' }]; },
    cycle: function () { return { id: 'pistol', name: 'Tapança' }; }
  };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  var OVERLAYS = ['title', 'howto', 'settings', 'pause', 'death', 'ending',
    'credits', 'difficulty', 'chapters', 'shop', 'journal', 'prologue', 'finalchoice', 'choice', 'gallery'];
  var WORLD_STATES = { play: 1, dialog: 1, pause: 1, dead: 1, ending: 1, transition: 1, finalchoice: 1, choice: 1 };

  function Game(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.ctx.imageSmoothingEnabled = false;
    this.input = global.InputState;
    this.levels = global.GameLevels;

    this.state = 'boot';
    this.from = 'title';
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
    this._dialogDone = null;

    this.solids = [];
    this.spikeRects = [];
    this.checkpointX = 0;
    this.levelKeys = 0;
    this.triggered = {};

    this.settings = { shake: true, crt: true, lowFx: false };
    this.rainLevel = 'light';
    this.rainDrops = [];
    this.glitchT = 0;
    this.lightningT = 10;

    this.deaths = 0;
    this.deathsHere = 0;
    this.acc = 0;
    this.bossDown = false;
    this.pendingDifficulty = 'normal';
    this.run = null;
    this.diff = Store.DIFFICULTIES.normal;

    this._grads = {};
    this._dirty = 0;
    this._advancing = false;
    this._lockedMsg = -9;
    this._chrome = {};
    this._touches = false;

    /* ---- v5: choice / stealth / chase / inventory state ---- */
    this.playerTrail = [];
    this.trailT = 0;
    this.levers = 0;
    this.leversTotal = 0;
    this.choiceItem = null;
    this.noise = 0;
    this.chaseX = -9999;
    this.chaseSpeed = 96;
    this.mode = 'calm';
    this._hudCache = {};
    this.noiseSafe = 0;

    this.isEndless = false;
    this.endlessWave = 0;

    this._initRain();
    this._bindUi();
    this._loadSettings();
  }

  /* ============================================================
     SETUP
     ============================================================ */
  Game.prototype._initRain = function () {
    this.rainDrops = [];
    for (var i = 0; i < 130; i++) {
      this.rainDrops.push({
        x: Math.random() * (W + 200) - 100,
        y: Math.random() * H,
        len: 8 + Math.random() * 24,
        sp: 520 + Math.random() * 680,
        a: 0.06 + Math.random() * 0.20,
        lw: Math.random() < 0.8 ? 1 : 1.5
      });
    }
  };

  Game.prototype._loadSettings = function () {
    var s = Store.loadSettings();
    this.settings = { shake: s.shake, crt: s.crt, lowFx: s.lowFx };

    function setVal(id, v) {
      var el = document.getElementById(id);
      if (el) el.value = v;
    }
    function setText(id, v) {
      var el = document.getElementById(id);
      if (el) el.textContent = v + '%';
    }
    function setChk(id, v) {
      var el = document.getElementById(id);
      if (el) el.checked = v;
    }
    var mv = Math.round(s.master * 100), ms = Math.round(s.music * 100);
    setVal('vol-master', mv); setText('vol-master-val', mv);
    setVal('vol-music', ms); setText('vol-music-val', ms);
    setChk('opt-shake', s.shake);
    setChk('opt-crt', s.crt);
    setChk('opt-fx', !s.lowFx);

    Audio2.setMaster(s.master);
    Audio2.setMusicVolume(s.music);
    var stage = document.getElementById('stage');
    if (stage) {
      stage.classList.toggle('crt-off', !s.crt);
      stage.classList.toggle('low-fx', s.lowFx);
    }
  };

  Game.prototype.saveSettings = function () {
    var vm = document.getElementById('vol-master');
    var vc = document.getElementById('vol-music');
    Store.saveSettings({
      master: vm ? (parseFloat(vm.value) || 70) / 100 : 0.7,
      music: vc ? (parseFloat(vc.value) || 55) / 100 : 0.55,
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

    on('btn-endless', 'click', function () {
      Audio2.resume();
      self.openDifficulty();
      self._endlessPick = true;
      var b = document.getElementById('btn-start-run');
      if (b) b.textContent = 'SONSUZA BAŞLA · ' + Store.diff().name;
    });
    on('btn-new', 'click', function () {
      self._endlessPick = false;
      self.openDifficulty();
      var b2 = document.getElementById('btn-start-run');
      if (b2) b2.textContent = 'Başla · ' + (self.pendingDifficulty ? Store.DIFFICULTIES[self.pendingDifficulty].name : Store.diff().name);
    });
    on('btn-continue', 'click', function () { self.continueRun(); });
    on('btn-chapters', 'click', function () { self.openChapters(); });
    on('btn-shop-title', 'click', function () { self.openShop('title'); });
    on('btn-how', 'click', function () { self.from = 'title'; self.state = 'title'; self.show('howto'); });
    on('btn-settings-title', 'click', function () { self.from = 'title'; self.show('settings'); });
    on('btn-install', 'click', function () { self.installPrompt(); });
    on('btn-gallery', 'click', function () { self._galleryFrom = 'title'; self.openGallery(); });

    Array.prototype.forEach.call(document.querySelectorAll('[data-act]'), function (b) {
      b.addEventListener('click', function () {
        Audio2.play('ui');
        self.action(b.getAttribute('data-act'));
      });
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-diff]'), function (b) {
      b.addEventListener('click', function () {
        Audio2.play('ui');
        self.pickDifficulty(b.getAttribute('data-diff'));
      });
    });

    var vm = document.getElementById('vol-master');
    if (vm) vm.addEventListener('input', function () {
      Audio2.setMaster(vm.value / 100);
      var l = document.getElementById('vol-master-val');
      if (l) l.textContent = vm.value + '%';
      self.saveSettings();
    });
    var vc = document.getElementById('vol-music');
    if (vc) vc.addEventListener('input', function () {
      Audio2.setMusicVolume(vc.value / 100);
      var l = document.getElementById('vol-music-val');
      if (l) l.textContent = vc.value + '%';
      self.saveSettings();
    });
    var sh = document.getElementById('opt-shake');
    if (sh) sh.addEventListener('change', function () { self.settings.shake = sh.checked; self.saveSettings(); });
    var crt = document.getElementById('opt-crt');
    if (crt) crt.addEventListener('change', function () {
      self.settings.crt = crt.checked;
      var stage = document.getElementById('stage');
      if (stage) stage.classList.toggle('crt-off', !crt.checked);
      self.saveSettings();
    });
    var fx = document.getElementById('opt-fx');
    if (fx) fx.addEventListener('change', function () {
      self.settings.lowFx = !fx.checked;
      var stage = document.getElementById('stage');
      if (stage) stage.classList.toggle('low-fx', self.settings.lowFx);
      self.saveSettings();
    });

    /* ---- hotbar buttons mirror the 1..5 hotkeys ---- */
    Array.prototype.forEach.call(document.querySelectorAll('.slot[data-item]'), function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (self.state !== 'play' && self.state !== 'dialog') return;
        self.useItem(btn.getAttribute('data-item'));
      });
    });

    /* ---- inventory hotkeys 1..5 work everywhere in a run ---- */
    window.addEventListener('keydown', function (e) {
      if (self.state !== 'play' && self.state !== 'dialog') return;
      var map = { Digit1: 'medkit', Digit2: 'lantern', Digit3: 'coffee', Digit4: 'shield', Digit5: 'flare' };
      var key = map[e.code];
      if (key) { e.preventDefault(); self.useItem(key); return; }
      if (e.code === 'KeyQ') { e.preventDefault(); self.cycleWeapon(-1); return; }
      if (e.code === 'KeyF') { e.preventDefault(); self.cycleWeapon(1); return; }
    });

    /* ---- weapon picker buttons ---- */
    var wprev = document.getElementById('weapon-prev');
    var wnext = document.getElementById('weapon-next');
    if (wprev) wprev.addEventListener('click', function (e) { e.preventDefault(); self.cycleWeapon(-1); });
    if (wnext) wnext.addEventListener('click', function (e) { e.preventDefault(); self.cycleWeapon(1); });
  };

  /* ============================================================
     INVENTORY — purchases are real, persistent items
     ============================================================ */
  Game.prototype.useItem = function (key) {
    var p = this.player;
    if (!p) return;
    var name = { medkit: 'Tibb dəsti', lantern: 'Neft lampası', coffee: 'Səhvər qəhvəsi', shield: 'Kölgə qalxanı', flare: 'Alov fişəngi' }[key] || key;

    if (key === 'medkit' && p.hp >= p.maxHp) { this.toast('Ürəklərin tamdır', 'bad'); return; }
    if (key === 'shield' && p.shield >= 2) { this.toast('Qalxan artıq doludur', 'bad'); return; }
    if (key === 'lantern' && p.lanternT > 20) { this.toast('Lampa hələ də yanır', 'bad'); return; }
    if (key === 'coffee' && p.coffeeT > 12) { this.toast('Qəhvə hələ təsir edir', 'bad'); return; }

    if (!Store.useItem(key)) { this.toast(name + ' bitdi — mağazadan al', 'bad'); return; }

    switch (key) {
      case 'medkit': p.heal(1); Audio2.play('heal'); this.toast('+1 ürək', 'good'); break;
      case 'lantern': p.lanternT = 75; Audio2.play('pickup'); this.toast('Lampa yandı · 75s', 'good'); break;
      case 'coffee': p.coffeeT = 40; Audio2.play('pickup'); this.toast('Qəhvə · sürət', 'good'); break;
      case 'shield': p.shield = Math.min(2, p.shield + 1); Audio2.play('heal'); this.toast('Qalxan hazırdır', 'good'); break;
      case 'flare':
        p.flareT = 6;
        Audio2.play('portal');
        this.flash(0.3);
        this.toast('Fişəng — koridorda hər şey dondu', 'good');
        for (var i = 0; i < this.enemies.length; i++) {
          var e = this.enemies[i];
          if (e.dead || e.isBoss) continue;
          if (Math.abs(e.x - p.x) < 520) { e.attackCd = 3.2; e.aggro = false; e.vx = 0; }
        }
        break;
      default: break;
    }
    this.updateHud();
  };

  /** has the player already answered a given choice? */
  Game.prototype.hasAnswered = function (cid) {
    return Store.choice(cid) !== null;
  };

  Game.prototype.pickDifficulty = function (key) {
    if (!Store.DIFFICULTIES[key]) return;
    this.pendingDifficulty = key;
    Array.prototype.forEach.call(document.querySelectorAll('[data-diff]'), function (x) {
      x.classList.toggle('sel', x.getAttribute('data-diff') === key);
    });
    var btn = document.getElementById('btn-start-run');
    if (btn) btn.textContent = (this._endlessPick ? 'SONSUZA BAŞLA · ' : 'Başla · ') + Store.DIFFICULTIES[key].name;
  };

  /* ============================================================
     RUN STATE
     ============================================================ */
  var RUN_VERSION = 5;

  Game.prototype.freshRun = function (level) {
    return {
      v: RUN_VERSION,
      level: level || 0,
      x: 0,
      hp: 0,
      ammo: 0,
      score: 0,
      levelCoins: 0,
      deaths: 0,
      taken: {},
      killed: {},
      bosses: {},
      levers: {}
    };
  };

  Game.prototype._markDirty = function () { this._dirty = 0.6; };

  Game.prototype._flush = function () {
    this._dirty = 0;
    this.persistRun();
  };

  Game.prototype.persistRun = function () {
    if (!this.run) return;
    this.run.level = this.levelIndex;
    this.run.x = this.checkpointX;
    this.run.hp = this.player ? Math.max(1, this.player.hp) : 1;
    this.run.score = this.score;
    this.run.deaths = this.deaths;
    Store.saveRun(this.run);
    if (this.player) Store.inv().ammo = Math.max(0, this.player.ammo);
  };

  Game.prototype.loadRunState = function () {
    var r = Store.loadRun();
    if (!r) return null;
    if (!r.taken || typeof r.taken !== 'object') r.taken = {};
    if (!r.killed || typeof r.killed !== 'object') r.killed = {};
    if (!r.bosses || typeof r.bosses !== 'object') r.bosses = {};
    if (!r.levers || typeof r.levers !== 'object') r.levers = {};
    r.level = clamp(r.level | 0, 0, (this.levels.length || 1) - 1);
    r.levelCoins = Math.max(0, Number(r.levelCoins) || 0);
    return r;
  };

  /* ============================================================
     CHROME (HUD / touch visibility)
     ============================================================ */
  Game.prototype.show = function (id) {
    for (var i = 0; i < OVERLAYS.length; i++) {
      var el = document.getElementById(OVERLAYS[i]);
      if (el) el.classList.add('hidden');
    }
    if (id) {
      var t = document.getElementById(id);
      if (t) {
        t.classList.remove('hidden');
        // restart the entrance animation
        if (t.classList.contains('overlay')) {
          t.style.animation = 'none';
          void t.offsetWidth;
          t.style.animation = '';
        }
      }
    }
    this._updateChrome();
  };

  Game.prototype._updateChrome = function () {
    var playing = this.state === 'play';
    var hud = document.getElementById('hud');
    if (hud && this._chrome.hud !== playing) {
      this._chrome.hud = playing;
      hud.classList.toggle('hidden', !playing);
    }
    var bar = document.getElementById('hotbar');
    if (bar) {
      var wantBar = playing || this.state === 'dialog';
      if (this._chrome.bar !== wantBar) {
        this._chrome.bar = wantBar;
        bar.classList.toggle('hidden', !wantBar);
      }
    }
    var touch = document.getElementById('touch');
    if (touch) {
      var want = playing && this._touches;
      if (this._chrome.touch !== want) {
        this._chrome.touch = want;
        touch.classList.toggle('hidden', !want);
      }
    }
  };

  Game.prototype.enableTouch = function () {
    this._touches = true;
    this._updateChrome();
  };

  /* ============================================================
     MENUS
     ============================================================ */
  Game.prototype.openDifficulty = function () {
    this.state = 'select';
    var prof = Store.profile || Store.load();
    this.show('difficulty');
    this.pickDifficulty(prof.difficulty);
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
      var best = Store.chapterBest(L.id);
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chapter-row' + (locked ? ' locked' : '') + (done ? ' done' : '');
      if (locked) b.disabled = true;
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
      var owned = item.perm && prof[item.perm];
      var poor = prof.wallet < item.price;
      var have = item.inv ? (prof.inv[item.inv] || 0) : 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'shop-item' + (owned ? ' owned' : (poor ? ' poor' : ''));
      b.innerHTML =
        '<img class="shop-ico" src="assets/' + item.icon + '.png" alt="" />' +
        '<span class="shop-txt"><b>' + item.name + '</b><i>' + item.sub + '</i>' +
        (have ? '<em class="shop-have">çantanda: ' + have + '</em>' : '') + '</span>' +
        '<span class="shop-price">' + (owned ? 'ALINIB' : item.price) + '</span>';
      if (!owned) {
        b.addEventListener('click', function () {
          var res = Store.buy(item.id);
          if (res.ok) {
            Audio2.play('pickup');
            self.toast(item.name + ' alındı · çantana qoyuldu', 'good');
          } else if (res.reason === 'poor') {
            Audio2.play('locked');
            self.toast('Kifayət qədər pul yoxdur', 'bad');
          }
          self.renderShop();
          self.updateHud();
        });
      }
      box.appendChild(b);
    });
  };

  /**
   * v5 — purchases live in profile.inv and are consumed by the
   * player on demand (hotkeys 1..5). Nothing is drained at start,
   * so a bought medkit is still there three chapters later.
   */
  Game.prototype.applyPurchases = function () {
    var prof = Store.profile || Store.load();
    var p = this.player;
    if (!p) return;
    if (prof.hasShotgun) p.hasShotgun = true;
    this.syncWeapons(true);
    this.updateHud();
  };

  /* ============================================================
     JOURNAL
     ============================================================ */
  Game.prototype.openJournal = function () {
    this._journalFrom = this.state;
    this.state = 'journal';
    this.show('journal');
    this.renderJournal();
  };

  Game.prototype.renderJournal = function () {
    var box = document.getElementById('journal-list');
    var count = document.getElementById('journal-count');
    if (!box) return;
    var found = Store.journal();
    if (count) count.textContent = found.length + ' / ' + Store.JOURNAL.length;
    box.innerHTML = '';
    if (!found.length) {
      var empty = document.createElement('p');
      empty.className = 'journal-empty';
      empty.textContent = 'Hələ heç bir qeyd tapmamısan. Yolda qalan kağızları, telefonları və şəkilləri yığ.';
      box.appendChild(empty);
      return;
    }
    found.forEach(function (j) {
      var card = document.createElement('article');
      card.className = 'journal-card';
      card.innerHTML =
        '<header><img src="assets/' + j.icon + '.png" alt="" />' +
        '<div><b>' + j.title + '</b><span>Bölmə ' + j.ch + '</span></div></header>' +
        '<p>' + j.text + '</p>';
      box.appendChild(card);
    });
  };

  /* ============================================================
     FLOW
     ============================================================ */
  /**
   * The persistent inventory is the truth:
   * · ammo is a shared pool (what you shoot is gone for good)
   * · medkit / lampa / qəhvə / qalxan / fişəng / çiçək stay in the
   *   bag until the player presses 1..5 (or gives the flower)
   * Nothing is drained on chapter load, so a purchase made in
   * chapter II is still usable in chapter IX.
   */
  Game.prototype._giveConsumables = function () {
    var p = this.player;
    var inv = Store.inv();
    p.hasShotgun = !!Store.profile.hasShotgun;
    p.weaponId = p.weaponId || 'pistol';
    this.syncWeapons(true);
    p.ammo = Math.max(0, inv.ammo | 0);
    this._lastAmmo = p.ammo;
    this.updateHud();
  };

  /** first entry into a fresh run: starting ammo + starting medkits */
  Game.prototype.seedRunInventory = function () {
    var inv = Store.inv();
    var startAmmo = (this.diff.ammoStart || 0) + (inv.ammo || 0);
    inv.ammo = startAmmo;
    if (this.diff.medStart) inv.medkit = (inv.medkit || 0) + this.diff.medStart;
    if (this.player) this.player.ammo = startAmmo;
    if (this.player) this.player.shield = 0;
    Store.save(true);
    this._lastAmmo = startAmmo;
  };

  /** keep the shared ammo pool in sync with what the player carries */
  Game.prototype.syncInventory = function () {
    var inv = Store.inv();
    var ammo = Math.max(0, this.player ? this.player.ammo : 0);
    if (inv.ammo !== ammo) {
      inv.ammo = ammo;
      Store.save();
    }
    this.updateHud();
  };

  Game.prototype.newPlayer = function () {
    var p = new Ent.Player(0, 0, this.diff);
    p.maxHp = this.diff.hearts;
    p.hp = this.diff.hearts;
    this.player = p;
    return p;
  };

  Game.prototype.askPrologueIfNeeded = function (diffKey) {
    var prof = Store.profile || Store.load();
    var self = this;
    this._pendingStart = { diff: diffKey };
    if (prof.seenIntro) { this.startNewGame(diffKey); return; }
    this.state = 'prologue';
    this.show('prologue');
    this._prologueStep = 0;
    this._renderPrologue();
  };

  Game.prototype._prologueLines = [
    'Axşam idi. Yağış yavaş-yavaş yağırdı.',
    'Nuran adlı gənc oğlan evə qayıdarkən bulvarda tək dayanan bir qız gördü.',
    'Qızın adı Sanu idi. Amma Nuran onu ilk dəfə görürdü...',
    'Sanu dedi: “Sabah universitetə gəl. Səni orada gözləyəcəyəm.”',
    'Səhər açılanda Nuran BDU-nun həyətində idi. Qız yox idi.',
    'Yalnız qapının üstündə bir rəqəm: 314.'
  ];

  Game.prototype._renderPrologue = function () {
    var self = this;
    var box = document.getElementById('prologue-text');
    var btn = document.getElementById('prologue-next');
    var prog = document.getElementById('prologue-progress');
    if (!box) return;
    var i = this._prologueStep;
    var last = i >= this._prologueLines.length - 1;
    box.textContent = this._prologueLines[i];
    box.classList.remove('pro-in');
    void box.offsetWidth;
    box.classList.add('pro-in');
    if (prog) prog.textContent = (i + 1) + ' / ' + this._prologueLines.length;
    if (btn) btn.textContent = last ? 'Oyuna başla' : 'Davam et';
    if (!this._prologueBound && btn) {
      this._prologueBound = true;
      btn.addEventListener('click', function () {
        Audio2.play('ui');
        if (self.state !== 'prologue') return;
        if (self._prologueStep >= self._prologueLines.length - 1) {
          var prof = Store.profile || Store.load();
          prof.seenIntro = true;
          Store.save();
          self.startNewGame((self._pendingStart || {}).diff);
        } else {
          self._prologueStep++;
          self._renderPrologue();
        }
      });
    }
  };

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
    /* a brand-new run starts with a clean slate of story choices */
    prof.choices = {};
    Store.save(true);
    this.run = this.freshRun(0);
    this.score = 0;
    this.deaths = 0;
    this.deathsHere = 0;
    this.bossDown = false;
    this._advancing = false;
    this.newPlayer();
    this.player.hp = this.diff.hearts;
    this.seedRunInventory();
    this.loadLevel(0, { x: 0 });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.startChapter = function (index) {
    Audio2.resume();
    Audio2.play('portal');
    this.diff = Store.diff();
    Store.clearRun();
    this.run = this.freshRun(index);
    this.score = 0;
    this.deaths = 0;
    this.deathsHere = 0;
    this.bossDown = false;
    this._advancing = false;
    this.newPlayer();
    this.player.hp = this.diff.hearts;
    /* chapter select never resets the bag: ammo/items carry over */
    this._giveConsumables();
    this.loadLevel(index, { x: 0, keepInventory: true });
    this.state = 'play';
    this.show(null);
  };

  /* ============================================================
     ENDLESS — infinite procedurally generated platforming
     ============================================================ */
  Game.prototype.startEndless = function (diffKey) {
    if (!global.Endless) { this.toast('Sonsuz rejim yüklənmədi', 'bad'); return; }
    Audio2.resume();
    Audio2.play('portal');
    var prof = Store.profile || Store.load();
    if (diffKey && Store.DIFFICULTIES[diffKey]) {
      prof.difficulty = diffKey;
      Store.save(true);
    }
    this.diff = Store.diff();
    this.isEndless = true;
    this.endlessWave = 1;
    Store.clearRun();
    this.run = this.freshRun(0);
    this.score = 0;
    this.deaths = 0;
    this.deathsHere = 0;
    this.bossDown = false;
    this._advancing = false;
    this.newPlayer();
    this.player.hp = this.diff.hearts;
    this.seedRunInventory();
    /* endless is a combat mode: always start with a real gun */
    if (!Store.profile.hasShotgun && !(Store.profile.weapons && (Store.profile.weapons.smg || Store.profile.weapons.rifle))) {
      this.player.ammo = Math.max(this.player.ammo, 90);
    }
    this.loadLevel(0, { x: 0 });
    this.state = 'play';
    this.show(null);
    this.toast('SONSUZ REJİM · hər 20 dalğada boss', 'good');
  };

  Game.prototype.endlessBest = function () {
    var prof = Store.profile || Store.load();
    return prof.endlessBest || 0;
  };

  Game.prototype.continueRun = function () {
    var r = this.loadRunState();
    if (!r) { this.startNewGame(); return; }
    Audio2.resume();
    Audio2.play('portal');
    this.diff = Store.diff();
    this.run = r;
    this.score = r.score || 0;
    this.deaths = r.deaths || 0;
    this.deathsHere = 0;
    this.bossDown = !!(this.levels[r.level] && r.bosses[this.levels[r.level].id]);
    this._advancing = false;
    this.newPlayer();
    this.player.hp = clamp(r.hp || this.diff.hearts, 1, this.diff.hearts);
    this._giveConsumables();
    this.loadLevel(r.level, { x: r.x || 0, keepInventory: true });
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.refreshContinue = function () {
    var prof = Store.profile || Store.load();
    var r = this.loadRunState();
    var btn = document.getElementById('btn-continue');
    if (btn) {
      if (r) {
        btn.classList.remove('hidden');
        var L = this.levels[r.level];
        btn.textContent = 'Davam et · ' + (L ? L.name : '');
      } else {
        btn.classList.add('hidden');
      }
    }
    var cbtn = document.getElementById('btn-chapters');
    if (cbtn) {
      var anyDone = false;
      for (var k in prof.chapters) if (prof.chapters[k] && prof.chapters[k].done) anyDone = true;
      cbtn.classList.toggle('hidden', prof.unlocked <= 1 && !anyDone);
    }
  };

  /* ============================================================
     LEVEL LOADING
     ============================================================ */
  Game.prototype.levelCount = function () {
    return this.isEndless ? 999 : this.levels.length;
  };

  Game.prototype.loadLevel = function (index, opts) {
    opts = opts || {};
    index = clamp(index, 0, this.levelCount() - 1);
    this.levelIndex = index;
    var L;
    if (this.isEndless) {
      L = global.Endless.build(index + 1);
      L.index = index;
      L.spawn = L.start;
      L.exit = L.exit || null;
      if (L.exit) L.exit.to = index + 1;
      this.endlessWave = index + 1;
      this.level = L;
    } else {
      L = this.levels[index];
    }
    this.level = L;
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
      var s = L.hazards[hz];
      this.spikeRects.push({ x: s.x, y: s.y, w: s.w, h: s.h });
    }

    // ---- entities ----
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

    /* ---- v5: mode, levers, chase wall, trail ---- */
    this.mode = L.mode || 'calm';
    this.leversTotal = 0;
    this.levers = 0;
    this.playerTrail = [];
    this.trailT = 0;
    this.noise = 0;
    this.choiceItem = null;
    this.chaseX = -1400;
    this.chaseSpeed = 92 * (this.diff.chaseSpeed || 1);

    for (var lv = 0; lv < L.items.length; lv++) {
      if (L.items[lv].type !== 'lever') continue;
      this.leversTotal++;
      var lk = L.id + '#i' + lv;
      if (run.levers[lk]) this.levers++;
    }
    if (this.mode === 'chase') this.chaseX = (opts.x > 0 ? opts.x : L.start.x) - 620;

    for (var e = 0; e < L.enemies.length; e++) {
      var ek = L.id + '#e' + e;
      if (run.killed[ek]) continue;
      var en = new Ent.Enemy(L.enemies[e], this.diff);
      en.uid = ek;
      this.enemies.push(en);
    }
    for (var it = 0; it < L.items.length; it++) {
      var ik = L.id + '#i' + it;
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
      npc.uid = L.id + '#n' + n;
      this.npcs.push(npc);
    }

    // ---- player ----
    var p = this.player;
    if (!p) p = this.newPlayer();
    var px = (typeof opts.x === 'number' && opts.x > 0) ? opts.x : L.start.x;
    p.x = px;
    p.y = L.start.y;
    p.vx = 0;
    p.vy = 0;
    p.h = Ent.PLAYER_H;
    p.crouch = false;
    p.alive = true;
    p.invuln = 0.9;
    p.maxHp = this.diff.hearts;
    if (p.hp <= 0) p.hp = this.diff.hearts;
    if (p.hp > p.maxHp) p.hp = p.maxHp;
    p.ammo = Math.max(0, p.ammo);
    p.shield = Math.min(2, p.shield || 0);
    p.lanternT = 0;
    p.coffeeT = 0;
    p.flareT = 0;
    p.noise = 0;
    p.invuln = 0.9;

    /* persistent inventory tops the player up on every chapter load */
    if (!opts.keepInventory) this._giveConsumables();

    this.checkpointX = px;
    this.camX = clamp(px - W / 2, 0, Math.max(0, L.width - W));
    this.camTargetX = this.camX;
    this.darkness = (L.dark || 0) * (this.diff.key === 'easy' ? 0.8 : this.diff.key === 'hard' ? 1.12 : 1);
    this.rainLevel = L.rain || 'light';
    this.acc = 0;
    this.lightningT = 8 + Math.random() * 10;

    Audio2.resume();
    Audio2.setRain(this.rainLevel === 'off' ? 'off' : this.rainLevel);
    Audio2.setMood(L.mood || 'calm');

    this.showLevelCard(L);

    var ln = document.getElementById('level-name');
    if (ln) ln.textContent = L.kicker + ' · ' + L.name;
    var ob = document.getElementById('objective');
    if (ob) ob.textContent = L.objective || '';

    this.updateHud();
    this.persistRun();
  };

  /** loud actions wake every dormant enemy that can hear them */
  Game.prototype.alertNearby = function (x, noise) {
    var woke = 0;
    for (var i = 0; i < this.enemies.length; i++) {
      var e = this.enemies[i];
      if (!e.dormant || e.awake) continue;
      if (e.wake(Math.abs(e.x - x), noise)) woke++;
    }
    if (woke && this.toast) {
      this.toast(woke + ' nəfər oyandı', 'bad');
      Audio2.play('growl');
      this.shake(3);
    }
  };

  Game.prototype.showLevelCard = function (L) {
    var card = document.getElementById('levelcard');
    if (!card) return;
    var k = document.getElementById('lc-kicker');
    var t = document.getElementById('lc-title');
    var s = document.getElementById('lc-sub');
    if (k) k.textContent = L.kicker;
    if (t) t.textContent = L.name;
    if (s) s.textContent = L.sub || '';
    card.classList.remove('hidden');
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    clearTimeout(this._cardTO);
    this._cardTO = setTimeout(function () { card.classList.add('hidden'); }, 3000);
  };

  Game.prototype.restartLevel = function (fresh) {
    if (!this.player || !this.level) return;
    if (fresh && this.run) {
      var L = this.level;
      var key = L.id + '#';
      var kk;
      for (kk in this.run.taken) if (kk.indexOf(key) === 0) delete this.run.taken[kk];
      for (kk in this.run.killed) if (kk.indexOf(key) === 0) delete this.run.killed[kk];
      delete this.run.bosses[L.id];
      // give back the coins this chapter produced, capped by the wallet
      var wallet = Store.wallet();
      var refund = Math.min(this.run.levelCoins || 0, wallet);
      if (refund > 0) Store.addCoins(-refund);
      this.run.levelCoins = 0;
      this.levelKeys = 0;
      this.bossDown = false;
    }
    this.player.hp = this.diff.hearts;
    this.player.alive = true;
    this.player.invuln = 1.2;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.shield = 0;
    this.deathsHere = 0;
    this._advancing = false;
    this.loadLevel(this.levelIndex, { x: this.level.start.x });
    this.checkpointX = this.level.start.x;
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.restartFromCheckpoint = function () {
    if (!this.player || !this.level) return;
    this.player.alive = true;
    this.player.invuln = 1.4;
    this.player.hp = Math.max(1, Math.ceil(this.diff.hearts * 0.6));
    this.player.vx = 0;
    this.player.vy = 0;
    this._advancing = false;
    var x = Math.max(this.level.start.x, this.checkpointX);
    this.loadLevel(this.levelIndex, { x: x });
    this.player.alive = true;
    this.player.invuln = 1.4;
    this.state = 'play';
    this.show(null);
  };

  Game.prototype.goToMenu = function () {
    this.persistRun();
    this.isEndless = false;
    this.state = 'title';
    this.acc = 0;
    Audio2.setRain('light');
    Audio2.setMood('calm');
    this.show('title');
    this.refreshContinue();
  };

  Game.prototype.onPlayerDeath = function () {
    var self = this;
    this.deaths++;
    this.deathsHere++;
    if (this.run) this.run.deaths = this.deaths;
    var prof = Store.profile || Store.load();
    prof.deaths++;
    Store.save();
    this.persistRun();

    this.state = 'dead';
    this._updateChrome();

    var quotes = [
      'Qaranlıq səni uddu...',
      'Sən yenə də onu tapa bilmədin.',
      'Yağış sənin adını yudu.',
      'O, səni gözləyirdi.',
      'Bu dəfə qaça bilmədin.',
      'Bir addım daha... bir nəfəs daha.',
      'Unutmaq istədiyin şey səni tapdı.'
    ];
    var q = document.getElementById('death-quote');
    if (q) q.textContent = quotes[Math.floor(Math.random() * quotes.length)];

    // gentle help: after repeated deaths, offer the kinder mode
    var softer = this.isEndless ? null : Store.softerThan(this.diff.key);
    var easeBtn = document.getElementById('btn-ease');
    if (easeBtn) {
      if (softer && this.deathsHere >= 3) {
        easeBtn.classList.remove('hidden');
        easeBtn.textContent = 'Çətinliyi azalt · ' + Store.DIFFICULTIES[softer].name;
        easeBtn.setAttribute('data-diff-target', softer);
      } else {
        easeBtn.classList.add('hidden');
      }
    }

    setTimeout(function () {
      if (self.state === 'dead') self.show('death');
    }, 800);
  };

  Game.prototype.onBossDown = function (boss) {
    this.bossDown = true;
    if (this.run) this.run.bosses[this.level.id] = 1;
    this.flash(0.8);
    this.glitchT = 0.6;
    Audio2.play('dread');
    if (boss && boss.final) {
      this.toast('Göz yumuldu. Sanu səni gözləyir.', 'good');
    } else {
      this.toast('Kölgə dağıldı', 'good');
    }
    this.persistRun();
  };

  Game.prototype.lowerDifficultyAndRetry = function () {
    var softer = Store.softerThan(this.diff.key);
    if (!softer) { this.restartFromCheckpoint(); return; }
    Store.setDifficulty(softer);
    this.diff = Store.diff();
    if (this.player) {
      this.player.diff = this.diff;
      this.player.maxHp = this.diff.hearts;
    }
    this.toast('Çətinlik: ' + this.diff.name, 'good');
    this.deathsHere = 0;
    this.restartFromCheckpoint();
  };

  /* ============================================================
     ACTIONS
     ============================================================ */
  Game.prototype.action = function (act) {
    switch (act) {
      case 'resume':
        // the same Escape keydown that resumed us must not re-trigger pause
        this.input.state.pausePressed = false;
        this.input.prev.pause = true;
        this.acc = 0;
        this.state = 'play'; this.show(null); break;

      case 'start-run':
        if (this._endlessPick) { this._endlessPick = false; this.startEndless(this.pendingDifficulty); break; }
        this.askPrologueIfNeeded(this.pendingDifficulty); break;

      case 'difficulty-back':
        this.state = 'title'; this.show('title'); this.refreshContinue(); break;
      case 'chapters-back':
        this.state = 'title'; this.show('title'); this.refreshContinue(); break;

      case 'restart-fresh':
        this.restartLevel(true); break;
      case 'restart':
        this.restartLevel(false); break;
      case 'retry':
      case 'to-checkpoint':
        this.restartFromCheckpoint(); break;
      case 'ease': {
        var t = document.getElementById('btn-ease');
        var target = t && t.getAttribute('data-diff-target');
        if (target && Store.DIFFICULTIES[target]) {
          Store.setDifficulty(target);
          this.diff = Store.diff();
          if (this.player) { this.player.diff = this.diff; this.player.maxHp = this.diff.hearts; }
        }
        this.deathsHere = 0;
        this.restartFromCheckpoint();
        break;
      }

      case 'settings':
        this.from = (this.state === 'pause') ? 'pause' : 'title';
        this.show('settings'); break;
      case 'settings-back':
        if (this.from === 'pause') { this.state = 'pause'; this.show('pause'); }
        else { this.state = 'title'; this.show('title'); this.refreshContinue(); }
        break;

      case 'journal':
        this.openJournal(); break;
      case 'journal-back':
        if (this._journalFrom === 'pause') { this.state = 'pause'; this.show('pause'); }
        else { this.state = 'title'; this.show('title'); this.refreshContinue(); }
        break;

      case 'final-give':
        this.giveFinalFlower(); break;
      case 'final-leave':
        this.leaveWithoutFlower(); break;
      case 'final-stay':
        this.stayWithHer(); break;

      case 'gallery':
        this.openGallery(); break;
      case 'gallery-back':
        if (this._galleryFrom === 'ending') { this.state = 'ending'; this.show('ending'); }
        else { this.state = 'title'; this.show('title'); this.refreshContinue(); }
        break;

      case 'menu':
        this.goToMenu(); break;

      case 'shop':
        this.openShop(this.state === 'pause' ? 'pause' : 'title'); break;
      case 'shop-back':
        if (this._shopFrom === 'pause') { this.state = 'pause'; this.show('pause'); }
        else { this.state = 'title'; this.show('title'); this.refreshContinue(); }
        break;

      case 'howto-back':
        this.state = 'title'; this.show('title'); break;

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
    this._updateChrome();
    this._nextLine();
  };

  Game.prototype._nextLine = function () {
    if (!this.dialogQueue || !this.dialogQueue.length) { this._closeDialog(); return; }
    var line = this.dialogQueue.shift();
    this.dialog = line;
    this.typeIdx = 0;
    this.typeAcc = 0;
    this.typing = true;

    var el = document.getElementById('dialog');
    var nm = document.getElementById('dialog-name');
    var tx = document.getElementById('dialog-text');
    var portrait = document.getElementById('dialog-portrait');
    if (!el || !nm || !tx || !portrait) { this._closeDialog(); return; }

    tx.textContent = '';
    var pSrc = line.portrait ||
      (line.who === 'Sanu' ? 'sanu_a0' : line.who === 'Nuran' ? 'nuran_0' : null);
    if (pSrc && Assets.has(pSrc)) {
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
    this.typing = false;
    var el = document.getElementById('dialog');
    if (el) el.classList.add('hidden');
    this.state = 'play';
    this._updateChrome();
    var done = this._dialogDone;
    this._dialogDone = null;
    if (done) done();
  };

  Game.prototype.updateDialog = function (dt) {
    if (!this.dialog) return;
    var text = this.dialog.text || '';
    var tx = document.getElementById('dialog-text');
    if (this.typing) {
      this.typeAcc += dt * 54;
      while (this.typeAcc >= 1 && this.typeIdx < text.length) {
        this.typeIdx++;
        this.typeAcc -= 1;
        if (this.typeIdx % 3 === 0) Audio2.play('blip');
      }
      if (tx) tx.textContent = text.slice(0, this.typeIdx);
      if (this.typeIdx >= text.length) this.typing = false;
    }
    if (this.input.state.interactPressed || this.input.state.jumpPressed) {
      if (this.typing) {
        this.typing = false;
        this.typeIdx = text.length;
        if (tx) tx.textContent = text;
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

  /* ============================================================
     WEAPONS — owned list, switching, HUD chip
     ============================================================ */
  Game.prototype.syncWeapons = function (silent) {
    var prof = Store.profile || Store.load();
    if (!prof.weapons) prof.weapons = {};
    if (prof.hasShotgun) prof.weapons.shotgun = 1;
    var have = Weapons.owned(prof);
    var p = this.player;
    if (!p) return have;
    var found = false;
    for (var i = 0; i < have.length; i++) if (have[i].id === p.weaponId) found = true;
    if (!found) p.weaponId = have.length ? have[have.length - 1].id : 'pistol';
    this.updateWeaponHud();
    if (!silent && have.length > 1) this.toast('Silah: ' + Weapons.get(p.weaponId).name, 'good');
    return have;
  };

  Game.prototype.cycleWeapon = function (dir) {
    var p = this.player;
    if (!p) return;
    var prof = Store.profile || Store.load();
    var w = Weapons.cycle(p.weaponId, prof, dir || 1);
    p.weaponId = w.id;
    p.shootCd = Math.max(p.shootCd, 0.12);
    Audio2.play('ui');
    this.updateWeaponHud();
    this.toast(w.name, 'good');
  };

  Game.prototype.updateWeaponHud = function () {
    var p = this.player;
    var el = document.getElementById('weapon-name');
    if (!el || !p) return;
    var w = Weapons.get(p.weaponId);
    var prof = Store.profile || Store.load();
    var have = Weapons.owned(prof).length;
    el.textContent = w.name + (have > 1 ? '  (' + have + ')' : '');
    var ic = document.getElementById('weapon-icon');
    if (ic) ic.src = 'assets/' + w.icon + '.png';
  };

  Game.prototype.fireBullet = function (x, y, dir, power, wp, vy) {
    this.bullets.push(new Ent.Bullet(x, y, dir, power || 1, wp, vy || 0));
    this.spawnBurst(x + dir * 14, y, (wp && wp.color) || '#ffd9a0', 4);
  };

  /** small ground splash FX used by acid / heavy rounds */
  Game.prototype.splash = function (x, y, color, n) {
    this.spawnBurst(x, y, color, n);
  };

  /** expanding ring (bell shout / shockwaves) */
  Game.prototype.ringShock = function (x, y, r) {
    Audio2.play('drum');
    for (var i = 0; i < 22; i++) {
      var a = (i / 22) * Math.PI * 2;
      this.particles.push({
        x: x, y: y, vx: Math.cos(a) * 340, vy: Math.sin(a) * 340,
        life: 0.42, max: 1.2, r: 2.4, color: 'rgba(220,180,120,0.75)', grav: 0
      });
    }
  };

  Game.prototype.spawnBurst = function (x, y, color, n) {
    if (this.settings.lowFx) n = Math.ceil(n * 0.5);
    var room = 220 - this.particles.length;
    if (room <= 0) return;
    n = Math.min(n, room);
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var sp = 40 + Math.random() * 210;
      this.particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp - 40,
        life: 0.35 + Math.random() * 0.5,
        max: 1.5,
        r: 1.2 + Math.random() * 2.6,
        color: color,
        grav: 320
      });
    }
  };

  Game.prototype.spawnDust = function (x, y, n) {
    if (this.settings.lowFx) n = Math.ceil(n * 0.5);
    var room = 220 - this.particles.length;
    if (room <= 0) return;
    n = Math.min(n, room);
    for (var i = 0; i < n; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 16,
        y: y - 2,
        vx: (Math.random() - 0.5) * 80,
        vy: -20 - Math.random() * 55,
        life: 0.3 + Math.random() * 0.32,
        max: 1.2,
        r: 1 + Math.random() * 2.2,
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
    while (box.childElementCount > 3) box.removeChild(box.firstChild);
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .4s, transform .4s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(-6px)';
      setTimeout(function () { if (el.parentNode) el.remove(); }, 420);
    }, 1600);
  };

  Game.prototype.floatText = function (x, y, txt, color) {
    if (this.floating.length > 24) return;
    this.floating.push({ x: x, y: y, txt: txt, life: 1.1, color: color || '#ffd9a0' });
  };

  Game.prototype.shake = function (amt) {
    if (!this.settings.shake) return;
    this.shakeAmt = Math.min(15, this.shakeAmt + amt);
  };

  Game.prototype.flash = function (amt) {
    if (this.settings.lowFx) amt *= 0.55;
    this.flashAmt = Math.min(1, this.flashAmt + amt);
  };

  Game.prototype.updateHud = function () {
    var p = this.player;
    if (!p) return;
    var c = this._hudCache;
    var hearts = document.getElementById('hearts');
    if (hearts && hearts.childElementCount !== p.maxHp) {
      hearts.innerHTML = '';
      for (var i = 0; i < p.maxHp; i++) {
        var im = document.createElement('img');
        im.src = 'assets/i_heart_full.png';
        im.alt = '';
        hearts.appendChild(im);
      }
      c.hp = -1;
    }
    if (hearts && c.hp !== p.hp) {
      c.hp = p.hp;
      for (var j = 0; j < hearts.children.length; j++) {
        var full = j < p.hp;
        hearts.children[j].src = 'assets/' + (full ? 'i_heart_full' : 'i_heart_empty') + '.png';
        hearts.children[j].className = (full && p.hp <= 1) ? 'beat' : (full ? '' : 'empty');
      }
    }
    var a = document.getElementById('ammo-count');
    if (a && c.ammo !== p.ammo) {
      c.ammo = p.ammo;
      a.textContent = p.ammo;
      var chip = a.parentNode;
      var wcost = Weapons.get(p.weaponId).cost || 1;
      if (chip && chip.classList) chip.classList.toggle('warn', p.ammo < wcost);
    }
    this.updateWeaponHud();
    var k = document.getElementById('key-count');
    if (k && c.keys !== this.levelKeys) { c.keys = this.levelKeys; k.textContent = this.levelKeys; }
    var w = Store.profile ? Store.profile.wallet : 0;
    var cc = document.getElementById('coin-count');
    if (cc && c.coins !== w) { c.coins = w; cc.textContent = w; }

    /* ---- inventory hotbar (persistent items, used with 1..5) ---- */
    var inv = Store.inv();
    for (var s = 0; s < 5; s++) {
      var key = ['medkit', 'lantern', 'coffee', 'shield', 'flare'][s];
      var el = document.getElementById('slot-' + (s + 1));
      if (!el) continue;
      var val = inv[key] || 0;
      var badge = el.querySelector && el.querySelector('.slot-n');
      if (badge) badge.textContent = val;
      if (c['slot' + s] !== val) {
        c['slot' + s] = val;
        el.classList.toggle('empty', val <= 0);
      }
    }

    /* ---- mode badge: stealth / chase / puzzle ---- */
    var badgeEl = document.getElementById('mode-badge');
    if (badgeEl) {
      var label = '';
      if (this.isEndless) label = 'DALĞA ' + (this.levelIndex + 1) + (this.level && this.level.isBossWave ? ' · BOSS' : '');
      else if (this.mode === 'stealth') label = 'SƏSSİZ';
      else if (this.mode === 'chase') label = 'QAÇ';
      else if (this.mode === 'puzzle' && this.leversTotal) label = 'QOL ' + this.levers + '/' + this.leversTotal;
      else if (this.mode === 'mirror') label = 'ƏKS';
      else if (this.mode === 'dark') label = 'LAMPA [2]';
      if (c.modeLabel !== label) {
        c.modeLabel = label;
        badgeEl.textContent = label;
        badgeEl.classList.toggle('hidden', !label);
      }
    }

    /* ---- noise meter ---- */
    var nz = document.getElementById('noise-meter');
    if (nz) {
      var lvl = Math.min(1, p.noise || 0);
      var bucket = Math.round(lvl * 10) / 10;
      if (c.noise !== bucket) {
        c.noise = bucket;
        nz.style.setProperty('--n', (lvl * 100).toFixed(0) + '%');
        nz.classList.toggle('hot', lvl > 0.55);
      }
      if (this.mode !== 'stealth') nz.classList.add('hidden');
      else nz.classList.remove('hidden');
    }
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

    if (this._dirty > 0) {
      this._dirty -= dt;
      if (this._dirty <= 0) this.persistRun();
    }

    // particles + floating text always animate (they look alive on menus too)
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
      this._updateAtmosphere(dt);
      return;
    }
    if (this.state !== 'play') {
      this._updateChrome();
      return;
    }

    if (this.input.state.pausePressed) {
      this.state = 'pause';
      this.persistRun();
      this.show('pause');
      return;
    }

    // ---- fixed-step physics ----
    this.acc += dt;
    var steps = 0;
    while (this.acc >= STEP && steps < 4) {
      this._step(STEP);
      this.acc -= STEP;
      steps++;
      if (this.state !== 'play') break;     // dialog / death interrupted us
    }
    if (steps === 4) this.acc = 0;

    if (this.state === 'play') {
      this._updateCamera(dt);
      this._updateAtmosphere(dt);
      Audio2.tickMusic(dt, this.enemies.length > 0);
      this.updateHud();
      this._updateChrome();
    }
  };

  Game.prototype._step = function (dt) {
    var p = this.player;
    if (!p || this.state !== 'play') return;
    p.update(dt, this);
    if (this.state !== 'play') return;

    /* ---- v5: mirror mode needs a trail to replay ---- */
    if (this.mode === 'mirror') {
      this.trailT += dt;
      if (this.trailT >= 0.05) {
        this.trailT = 0;
        this.playerTrail.push({ x: p.x, y: p.y, facing: p.facing, anim: p.anim });
        if (this.playerTrail.length > 80) this.playerTrail.shift();
      }
    }

    /* ---- v5: chase mode — the dark wall catches up when you stop ---- */
    if (this.mode === 'chase') {
      var slow = Math.abs(p.vx) < 26 && p.onGround;
      this.chaseSpeed += (slow ? 96 : 26) * dt;
      this.chaseSpeed = Math.min(210, this.chaseSpeed);
      this.chaseX += this.chaseSpeed * dt;
      if (this.chaseX > p.x) {
        this.chaseX = p.x - 20;
        p.hurt(1, this, p.x > this.chaseX ? 1 : -1, false);
        this.chaseSpeed = 70;
        Audio2.play('dread');
      }
    }

    // checkpoint (forward only, on the ground)
    if (p.onGround && p.alive) {
      var best = this.checkpointX;
      for (var ci = 0; ci < this.level.checkpoints.length; ci++) {
        var cx = this.level.checkpoints[ci];
        if (p.x >= cx && cx > best) best = cx;
      }
      if (best > this.checkpointX) {
        this.checkpointX = best;
        this._markDirty();
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
      if (Ent.overlap(item.box(), p.box())) {
        this._collect(item, it);
        if (this.state !== 'play') return;   // an item opened a dialog
      }
    }

    for (var n = 0; n < this.npcs.length; n++) {
      var npc = this.npcs[n];
      npc.update(dt, this);
      if (!npc.available(this)) continue;
      if (npc.near(p) && this.input.state.interactPressed) {
        if (!npc.talked) {
          npc.talked = true;
          this._npcTalk(npc);
          return;
        } else if (npc.gift && !npc.gifted) {
          this._giveFlower(npc);
          return;
        }
      }
    }

    for (var t = 0; t < this.level.triggers.length; t++) {
      var tr = this.level.triggers[t];
      var key = 'tr' + t;
      if (!this.triggered[key] && Math.abs(p.x - tr.x) < (tr.w || 20) + 20) {
        this.triggered[key] = true;
        this.say(tr.lines);
        return;
      }
    }

    this._checkExit();
  };

  Game.prototype._npcTalk = function (npc) {
    var self = this;
    this.say(npc.talk, function () {
      /* a decision attached to the conversation comes before the gift */
      if (npc.choiceAfter && !self.hasAnswered(npc.choiceAfter.cid)) {
        self.openChoice({
          cid: npc.choiceAfter.cid,
          prompt: npc.choiceAfter.prompt,
          options: npc.choiceAfter.options,
          title: 'Qərar'
        }, function () {
          if (npc.final) { self.openFinalChoice(npc); return; }
          if (npc.after) self.toast(npc.after, 'good');
        });
        return;
      }
      if (npc.final) { self.openFinalChoice(npc); return; }
      if (npc.after) self.toast(npc.after, 'good');
      if (npc.gift) {
        var flowers = Store.countItem('flower');
        if (flowers > 0) self.toast('E — ağ çiçəyi ona ver', 'good');
        else self.toast('Mağazadan ağ çiçək al və qayıt', 'bad');
      }
    });
  };

  /* ============================================================
     CHOICES — a real decision overlay, stored in the profile
     ============================================================ */
  Game.prototype.openChoice = function (data, onDone) {
    if (!data || !data.options || !data.options.length) {
      if (onDone) onDone();
      return;
    }
    if (this.hasAnswered(data.cid)) { if (onDone) onDone(); return; }

    this._choiceData = data;
    this._choiceDone = onDone || null;
    this._choiceFrom = this.state;
    this._choiceIdx = 0;

    var prompt = document.getElementById('choice-prompt');
    var title = document.getElementById('choice-title');
    var list = document.getElementById('choice-list');
    if (prompt) prompt.textContent = data.prompt || '';
    if (title) title.textContent = data.title || 'Qərar';
    if (list) {
      list.innerHTML = '';
      var self = this;
      data.options.forEach(function (opt, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'choice-btn' + (i === 0 ? ' sel' : '');
        b.innerHTML = '<b>' + opt.label + '</b>' +
          (opt.hint ? '<i>' + opt.hint + '</i>' : '');
        b.addEventListener('click', function () {
          Audio2.play('ui');
          self.answerChoice(i);
        });
        list.appendChild(b);
      });
    }
    this.state = 'choice';
    this.show('choice');
    this._updateChrome();
    Audio2.play('portal');
  };

  /** keyboard navigation used by main.js while the choice overlay is open */
  Game.prototype.choiceNav = function (dir) {
    var list = document.getElementById('choice-list');
    if (!list || !list.children.length) return;
    this._choiceIdx = (this._choiceIdx + dir + list.children.length) % list.children.length;
    for (var i = 0; i < list.children.length; i++) {
      list.children[i].classList.toggle('sel', i === this._choiceIdx);
    }
    Audio2.play('ui');
  };

  Game.prototype.answerChoice = function (index) {
    var data = this._choiceData;
    if (!data) return;
    var opt = data.options[index];
    if (!opt) return;
    Store.choose(data.cid, opt.value);
    this._choiceData = null;

    var el = document.getElementById('choice');
    if (el) el.classList.add('hidden');

    this.toast('Qərarın yadda saxlanıldı', 'good');
    if (data.cid === 'apology' && opt.value === 'speak') this.addScore(25);

    this.state = 'play';
    this.show(null);
    this._updateChrome();

    var done = this._choiceDone;
    this._choiceDone = null;
    if (done) done(opt);
    this.updateHud();
  };

  /* ============================================================
     FINAL CHOICE — the ending is decided here, explicitly
     ============================================================ */
  Game.prototype.openFinalChoice = function (npc) {
    this._finalNpc = npc;
    var giveBtn = document.getElementById('btn-final-give');
    var stayBtn = document.getElementById('btn-final-stay');
    var noteEl = document.getElementById('final-note');
    var flowers = Store.countItem('flower');
    var hasFlower = flowers > 0;

    if (giveBtn) {
      giveBtn.classList.toggle('hidden', !hasFlower);
      giveBtn.disabled = !hasFlower;
    }
    if (stayBtn) {
      /* the hidden path only opens for someone who kept the truth */
      var canStay = Store.choice('folder') === 'read';
      stayBtn.classList.toggle('hidden', !canStay);
    }
    if (noteEl) {
      var readTruth = Store.choice('folder') === 'read';
      noteEl.textContent = hasFlower
        ? 'Cibində ağ çiçək var. Ona verə bilərsən — ya da susaraq get.'
        : (readTruth && Store.journalCount() >= 16)
          ? 'Çiçəyin yoxdur. Amma hər şeyi bilirsən. Bu dəfə başqa bir yol var.'
          : 'Çiçəyin yoxdur. Bu dəfə yalnız sözlərin qalır. (Mağazadan ağ çiçək alıb yenidən cəhd edə bilərsən.)';
    }
    this.state = 'finalchoice';
    this.show('finalchoice');
    this._updateChrome();
  };

  Game.prototype.giveFinalFlower = function () {
    var npc = this._finalNpc;
    if (!npc) return;
    if (!Store.useItem('flower')) return;
    Store.choose('final', 'flower');
    var prof = Store.profile || Store.load();
    prof.gifts++;
    Store.save();
    this.gaveFinalFlower = true;
    Audio2.play('heal');
    this.spawnBurst(npc.x, npc.y - 50, '#ffe6f0', 30);
    this.flash(0.35);
    var self = this;
    var ghostPortrait = npc.final ? 'sanu_ghost' : 'sanu_a1';
    this.show(null);
    this.say([
      { who: 'Nuran', portrait: 'nuran_0', text: 'Bu... sənin üçün. Çoxdan vermək istəyirdim.' },
      { who: 'Sanu', portrait: ghostPortrait, text: 'Sən onu bu günə qədər saxladın?' },
      { who: 'Nuran', portrait: 'nuran_0', text: 'Bilmirdim nə vaxt düzgün an olacaq. Düzgün an heç vaxt gəlmir — qərar vermək lazımdır.' },
      { who: 'Sanu', portrait: 'sanu_ghost', text: 'Bunu xatırla, Nuran. Bəzən gecikmiş bir çiçək, ən doğru çiçəkdir.' }
    ], function () {
      self.addScore(60);
      self.finishGame();
    });
  };

  Game.prototype.leaveWithoutFlower = function () {
    if (this.state !== 'finalchoice' && this.state !== 'play') return;
    Store.choose('final', 'leave');
    this.gaveFinalFlower = false;
    this.show(null);
    this.finishGame();
  };

  Game.prototype.stayWithHer = function () {
    Store.choose('final', 'stay');
    this.gaveFinalFlower = false;
    this._finalNpc = null;
    var self = this;
    this.show(null);
    Audio2.play('heal');
    this.say([
      { who: 'Nuran', portrait: 'nuran_0', text: 'Mən getmirəm. Bu dəfə getmirəm.' },
      { who: 'Sanu', portrait: 'sanu_ghost', text: 'Bilirsən ki, bu otaq sənin yaddaşındır. Burada qalsan — oyanmayacaqsan.' },
      { who: 'Nuran', portrait: 'nuran_0', text: 'Bilirəm.' }
    ], function () { self.finishGame(); });
  };

  Game.prototype._giveFlower = function (npc) {
    if (!Store.useItem('flower')) {
      this.toast('Çiçəyin yoxdur — mağazadan al', 'bad');
      return;
    }
    var prof = Store.profile || Store.load();
    npc.gifted = true;
    prof.gifts++;
    Store.save();
    Audio2.play('heal');
    this.spawnBurst(npc.x, npc.y - 50, '#ffe6f0', 24);
    this.flash(0.3);
    var self = this;
    var ghost = npc.final;
    this.say([
      { who: 'Nuran', portrait: 'nuran_0', text: 'Bu... sənin üçün. Çoxdan vermək istəyirdim.' },
      { who: 'Sanu', portrait: ghost ? 'sanu_ghost' : 'sanu_a1', text: 'Sən onu bu günə qədər saxladın?' },
      { who: 'Nuran', portrait: 'nuran_0', text: 'Bilmirdim nə vaxt düzgün an olacaq. Düzgün an heç vaxt gəlmir — qərar vermək lazımdır.' },
      { who: 'Sanu', portrait: ghost ? 'sanu_ghost' : 'sanu_a2', text: 'Bunu xatırla, Nuran. Bəzən gecikmiş bir çiçək, ən doğru çiçəkdir.' }
    ], function () {
      self.addScore(60);
      self.toast('Hədiyyə qəbul edildi · +60', 'good');
      self.updateHud();
      if (ghost) { self.openFinalChoice(npc); }
    });
  };

  Game.prototype._collect = function (item, idx) {
    var p = this.player;
    var self = this;
    var dm = this.diff || Store.diff();
    var took = true;

    switch (item.type) {
      case 'coin': {
        var gain = Math.max(1, Math.round(1 * (dm.coinMul || 1)));
        p.coins += gain;
        if (this.run) this.run.levelCoins = (this.run.levelCoins || 0) + gain;
        Store.addCoins(gain);
        this.score += 5;
        Audio2.play('coin');
        this.floatText(item.x, item.y - 20, '+' + gain, '#ffd98a');
        this.spawnBurst(item.x, item.y - 20, '#c9a227', 5);
        break;
      }
      case 'ammo': {
        var amt = Math.max(5, Math.round(9 * (dm.ammoMul || 1)));
        p.ammo += amt;
        Audio2.play('pickup');
        this.toast('+' + amt + ' güllə', 'good');
        this.floatText(item.x, item.y - 20, '+' + amt, '#ffb070');
        break;
      }
      case 'medkit':
        if (p.hp >= p.maxHp) { took = false; break; }
        p.heal(1);
        Audio2.play('heal');
        this.toast('+1 ürək', 'good');
        this.floatText(item.x, item.y - 20, '+1 ♥', '#ff7a8a');
        break;
      case 'key':
        this.levelKeys++;
        this.score += 20;
        Audio2.play('pickup');
        this.toast('Açar tapıldı', 'good');
        this.flash(0.18);
        break;
      case 'shotgun':
        p.hasShotgun = true;
        Store.profile.hasShotgun = true;
        p.ammo += Math.round(20 * (dm.ammoMul || 1));
        Store.save();
        Audio2.play('pickup');
        this.toast('Ov tüfəngi götürüldü', 'good');
        break;
      case 'gem': {
        Store.addItem('flower', 1);
        Audio2.play('heal');
        this.toast('Ağ çiçək tapıldı — Sanu-ya ver', 'good');
        break;
      }
      case 'lever': {
        if (this.run && item.uid) this.run.levers[item.uid] = 1;
        this.levers++;
        Audio2.play('door');
        this.flash(0.2);
        this.shake(4);
        this.spawnBurst(item.x, item.y - 10, '#ffc070', 16);
        this.toast('Qol işə düşdü · ' + this.levers + '/' + this.leversTotal, 'good');
        if (this.levers >= this.leversTotal) {
          this.toast('Bütün qollar açıqdır — qatar qapısı açıldı', 'good');
        }
        break;
      }
      case 'choice': {
        this.choiceItem = item;
        if (item.jid) Store.addJournal(item.jid);
        var self2 = this;
        var after = item.lines ? function () { self2.openChoiceItem(item); } : null;
        if (item.lines) {
          Audio2.play('portal');
          this.say(item.lines, after);
        } else {
          this.openChoiceItem(item);
        }
        break;
      }
      case 'photo':
      case 'note':
      case 'phone': {
        Audio2.play('portal');
        this.glitchT = 0.4;
        this.flash(0.2);
        if (item.jid) {
          var isNew = Store.addJournal(item.jid);
          if (isNew) this.toast('Jurnal yeniləndi', 'good');
        }
        this.say(item.lines, function () { self.persistRun(); });
        break;
      }
      default:
        break;
    }

    if (!took) return;
    this.items.splice(idx, 1);
    if (this.run && item.idx !== undefined) this.run.taken[item.uid] = 1;
    this._markDirty();
    this.updateHud();
  };

  /** a decision placed in the world (or after a note's dialog) */
  Game.prototype.openChoiceItem = function (item) {
    var self = this;
    var cid = item.cid;
    if (this.hasAnswered(cid)) {
      this.toast('Bu qərarı artıq vermisən', 'bad');
      return;
    }
    this.openChoice({
      cid: cid,
      title: item.title || 'Qərar',
      prompt: item.prompt || '',
      options: item.options || []
    }, function () {
      self.toast('Seçimin hekayəni dəyişdi', 'good');
    });
  };

  Game.prototype._checkExit = function () {
    var L = this.level;
    var p = this.player;
    if (!L.exit) return;
    if (Math.abs(p.x - L.exit.x) > 78) return;

    if (L.exit.afterBoss && !this.bossDown) {
      this._lockMsg('Kölgəni dayandırmalısan');
      return;
    }
    if (L.exit.needsLevers && this.levers < L.exit.needsLevers) {
      this._lockMsg('Qapı bağlıdır — ' + (L.exit.needsLevers - this.levers) + ' qol qalıb');
      return;
    }
    if (this.mode === 'chase' && p.x < L.exit.x - 40 && this.chaseX > p.x - 120) {
      /* you may only leave when the dark is behind you */
    }
    var needKeys = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    if (needKeys > 0 && this.levelKeys < needKeys) {
      this._lockMsg(needKeys > 1 ? ('Qapı bağlıdır — ' + needKeys + ' açar lazımdır') : 'Qapı bağlıdır — açar lazımdır');
      return;
    }
    if (this.input.state.interactPressed) this.advanceLevel();
  };

  Game.prototype._lockMsg = function (msg) {
    if (this._lockedMsg > -9 && this.time - this._lockedMsg < 2.2) return;
    this._lockedMsg = this.time;
    Audio2.play('locked');
    this.toast(msg, 'bad');
  };

  Game.prototype.advanceLevel = function () {
    if (this._advancing) return;
    var L = this.level;
    if (this.isEndless) {
      this._advancing = true;
      var prof = Store.profile || Store.load();
      var wave = this.levelIndex + 1;
      if (wave > (prof.endlessBest || 0)) { prof.endlessBest = wave; }
      Store.addCoins(6 + wave);
      Store.save(true);
      this.toast('Dalğa ' + wave + ' tamamlandı', 'good');
      Audio2.play('portal');
      this.flash(0.4);
      var selfE = this;
      this.state = 'transition';
      setTimeout(function () {
        selfE.deathsHere = 0;
        selfE.loadLevel(wave, { x: 0 });
        selfE.state = 'play';
        selfE._advancing = false;
        selfE.show(null);
      }, 420);
      return;
    }
    if (!L.exit) return;
    var next = L.exit.to;
    this._advancing = true;

    Audio2.play('portal');
    this.flash(0.65);
    this.glitchT = 0.55;
    this.spawnBurst(this.player.x, this.player.y - 30, '#e04158', 28);
    Store.markChapter(L.id, this.score);
    Store.unlockThrough(next);

    this.run.level = next;
    this.run.x = 0;
    this.run.levelCoins = 0;
    this.score = this.score;   // score carries over within the run
    this.persistRun();

    var el = document.getElementById('levelcard');
    if (el) el.classList.add('hidden');

    this.state = 'transition';
    var self = this;
    setTimeout(function () {
      if (next >= self.levels.length) { self.finishGame(); return; }
      self.deathsHere = 0;
      self.loadLevel(next, { x: 0 });
      self.state = 'play';
      self._advancing = false;
      self.show(null);
    }, 520);
  };

  Game.prototype.finishGame = function () {
    if (this.state === 'ending') return;
    this.state = 'ending';
    var prof = Store.profile || Store.load();
    if (this.score > prof.bestScore) prof.bestScore = this.score;
    if (this.level) Store.markChapter(this.level.id, this.score);
    Store.unlockThrough(this.levels.length - 1);
    Store.clearRun();
    this.run = null;
    this._updateChrome();

    /* ---- which of the six endings did these choices produce? ---- */
    var E = Store.endingFor();
    Store.recordEnding(E);

    var titleEl = document.getElementById('ending-title');
    if (titleEl) {
      titleEl.textContent = E.title;
      titleEl.className = 'panel-title ' + (E.tone === 'kind' ? '' : E.tone === 'bad' ? 'red' : 'red');
    }
    var extra = '<p class="ending-stat">Çətinlik: <b>' + (this.diff ? this.diff.name : '—') +
      '</b> · Xal: <b>' + this.score + '</b> · Ölüm: <b>' + this.deaths +
      '</b> · Jurnal: <b>' + Store.journalCount() + ' / ' + Store.JOURNAL.length +
      '</b> · Sonlar: <b>' + Store.endingsFound() + ' / ' + Object.keys(Store.ENDINGS).length + '</b></p>' +
      '<p class="ending-stat dim">Seçimlərin: firar=<b>' + (Store.choice('stranger') || '—') +
      '</b> · qovluq=<b>' + (Store.choice('folder') || '—') +
      '</b> · final=<b>' + (Store.choice('final') || '—') + '</b></p>';
    var body = document.getElementById('ending-body');
    if (body) {
      body.innerHTML = E.body.map(function (t) { return '<p>' + t + '</p>'; }).join('') + extra;
    }
    var self = this;
    setTimeout(function () { if (self.state === 'ending') self.show('ending'); }, 320);
  };

  /* ============================================================
     ENDING GALLERY — the six endings you have unlocked
     ============================================================ */
  Game.prototype.openGallery = function () {
    var box = document.getElementById('gallery-list');
    if (!box) return;
    var prof = Store.profile || Store.load();
    box.innerHTML = '';
    var ids = Object.keys(Store.ENDINGS);
    ids.forEach(function (id) {
      var e = Store.ENDINGS[id];
      var seen = !!prof.endingsSeen[id];
      var card = document.createElement('article');
      card.className = 'gallery-card' + (seen ? ' seen' : ' locked');
      card.innerHTML = '<h3>' + (seen ? e.title : (e.secret ? '??? — gizli son' : '??? — kilidli')) + '</h3>' +
        '<p>' + (seen ? e.body.slice(0, 3).join(' ') : (e.secret
          ? 'Bu sonu tapmaq üçün həqiqəti öyrənməli və başqa bir qərar verməlisən.'
          : 'Bu sonu hələ açmamısan. Fərqli seçimlər et.')) + '</p>';
      box.appendChild(card);
    });
    var cnt = document.getElementById('gallery-count');
    if (cnt) cnt.textContent = Store.endingsFound() + ' / ' + ids.length;
    this.state = 'gallery';
    this.show('gallery');
  };

  /* ============================================================
     CAMERA / ATMOSPHERE
     ============================================================ */
  Game.prototype._updateCamera = function (dt) {
    var p = this.player;
    if (!p || !this.level) return;
    var target = p.x - W / 2 + p.facing * 55;
    target = clamp(target, 0, Math.max(0, this.level.width - W));
    this.camTargetX = target;
    var k = 1 - Math.pow(0.0016, dt);
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
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 12 + Math.random() * 16;
        this.flash(0.11);
        Audio2.play('thunder');
      }
    }
  };

  /* ============================================================
     DRAW
     ============================================================ */
  Game.prototype.draw = function () {
    var ctx = this.ctx;
    if (!this.level || !WORLD_STATES[this.state]) {
      this.drawAmbientBackdrop();
      return;
    }

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
      ctx.fillStyle = 'rgba(196,35,58,' + (this.flashAmt * 0.5) + ')';
      ctx.fillRect(0, 0, W, H);
    }
    if (this.glitchT > 0 && !this.settings.lowFx) this._drawGlitch(ctx);
    this._drawVignette(ctx);
  };

  /* ---------- cached background tile ---------- */
  Game.prototype._bgTile = function (key) {
    var cacheKey = 'tile:' + key;
    if (cacheKey in this._grads) return this._grads[cacheKey];
    var im = Assets.img(key);
    if (!im) { this._grads[cacheKey] = null; return null; }
    var nw = im.naturalWidth || im.width;
    var nh = im.naturalHeight || im.height;
    if (!nw || !nh) { this._grads[cacheKey] = null; return null; }
    var tileW = Math.max(560, Math.round(H * (nw / nh)));
    var c = document.createElement('canvas');
    c.width = tileW; c.height = H;
    var cc = c.getContext('2d');
    cc.imageSmoothingEnabled = true;
    cc.drawImage(im, 0, 0, tileW, H);
    this._grads[cacheKey] = c;
    return c;
  };

  Game.prototype._drawBackground = function (ctx) {
    var L = this.level;
    ctx.fillStyle = '#05040a';
    ctx.fillRect(0, 0, W, H);

    var tile = this._bgTile(L.bg);
    if (tile) {
      var tw = tile.width;
      var off = -(this.camX * (L.bgParallax || 0.3)) % tw;
      if (off > 0) off -= tw;
      var bobY = Math.sin(this.time * 0.25) * 2;
      var x = off, guard = 0;
      ctx.globalAlpha = 0.95;
      while (x < W && guard++ < 8) {
        ctx.drawImage(tile, x, bobY, tw, H);
        x += tw;
      }
      ctx.globalAlpha = 1;
    }

    var g = this._grads.dim;
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, 'rgba(10,4,14,0.55)');
      g.addColorStop(0.55, 'rgba(8,3,12,0.25)');
      g.addColorStop(1, 'rgba(4,2,8,0.92)');
      this._grads.dim = g;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    var mg = this._grads.moon;
    if (!mg) {
      mg = ctx.createRadialGradient(W * 0.72, H * 0.16, 10, W * 0.72, H * 0.16, 300);
      mg.addColorStop(0, 'rgba(200,30,50,0.16)');
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      this._grads.moon = mg;
    }
    ctx.fillStyle = mg;
    ctx.fillRect(0, 0, W, H);
  };

  Game.prototype._cull = function (x, pad) {
    return (x < this.camX - pad) || (x > this.camX + W + pad);
  };

  Game.prototype._drawWorld = function (ctx) {
    var cam = this.camX;
    var L = this.level;
    var i;

    ctx.save();
    ctx.translate(-cam, 0);

    // solids
    for (i = 0; i < this.solids.length; i++) {
      var s = this.solids[i];
      if (s.x + s.w < cam - 20 || s.x > cam + W + 20) continue;
      this._drawSolid(ctx, s);
    }

    // spikes
    for (i = 0; i < this.spikeRects.length; i++) {
      var sp = this.spikeRects[i];
      if (this._cull(sp.x + sp.w / 2, 130)) continue;
      var n = Math.max(1, Math.ceil(sp.w / 40));
      for (var k = 0; k < n; k++) {
        Assets.blitH(ctx, 'prop_spikes', sp.x + (k + 0.5) * (sp.w / n), sp.y + sp.h, 26, false);
      }
      Assets.blitGlow(ctx, 'rgba(220,30,50,0.22)', sp.x + sp.w / 2, sp.y + sp.h - 8, sp.w / 2 + 18, 1);
    }

    // props
    for (i = 0; i < L.props.length; i++) {
      var pr = L.props[i];
      if (this._cull(pr.x, 280)) continue;
      Assets.blit(ctx, pr.a, pr.x, pr.y + 2, pr.s || 1, !!pr.flip, pr.dark ? 0.45 : 1);
    }

    this._drawExit(ctx);

    for (i = 0; i < this.items.length; i++) {
      var item = this.items[i];
      if (this._cull(item.x, 90)) continue;
      item.draw(ctx);
    }

    for (i = 0; i < this.npcs.length; i++) {
      var npc = this.npcs[i];
      if (this._cull(npc.x, 150)) continue;
      npc.draw(ctx, this);
      if (this.state === 'play' && npc.near(this.player) && npc.available(this)) {
        var label = (!npc.talked || (npc.gift && !npc.gifted)) ? 'E' : null;
        if (label) this._drawPrompt(ctx, npc.x, npc.y - 118, label);
      }
    }

    for (i = 0; i < this.enemies.length; i++) {
      var en = this.enemies[i];
      if (this._cull(en.x, 170)) continue;
      en.draw(ctx, this);
    }

    if (this.player) this.player.draw(ctx, this);

    for (i = 0; i < this.bullets.length; i++) this.bullets[i].draw(ctx);
    for (i = 0; i < this.enemyBullets.length; i++) this.enemyBullets[i].draw(ctx, this.time);

    if (this.particles.length) {
      for (i = 0; i < this.particles.length; i++) {
        var pt = this.particles[i];
        var a = Math.max(0, pt.life / pt.max);
        if (a <= 0) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r * (0.4 + a * 0.8), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    if (this.floating.length) {
      ctx.font = '600 15px ui-monospace, monospace';
      ctx.textAlign = 'center';
      for (i = 0; i < this.floating.length; i++) {
        var f2 = this.floating[i];
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

  Game.prototype._drawPrompt = function (ctx, x, y, label) {
    var bob = Math.sin(this.time * 4) * 3;
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.beginPath();
    ctx.arc(x, y + bob, 13, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,5,12,.84)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(224,65,88,.9)';
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
    var visibleL = Math.max(s.x, this.camX - 20);
    var visibleR = Math.min(s.x + s.w, this.camX + W + 20);
    if (visibleR <= visibleL) return;

    var pat = this._brickPattern;
    if (!pat) pat = this._makePattern(ctx, 'tex_brick', 2.1);

    ctx.save();
    ctx.beginPath();
    ctx.rect(visibleL, s.y, visibleR - visibleL, s.h);
    ctx.clip();
    ctx.fillStyle = pat || '#191320';
    ctx.fillRect(visibleL, s.y, visibleR - visibleL, s.h);

    var g = this._grads.solidDown;
    if (!g) {
      g = ctx.createLinearGradient(0, 0, 0, 160);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.72)');
      this._grads.solidDown = g;
    }
    ctx.save();
    ctx.translate(0, s.y);
    ctx.fillStyle = g;
    ctx.fillRect(visibleL, 0, visibleR - visibleL, s.h);
    ctx.restore();
    ctx.restore();

    // lit rim on the walkable surface
    ctx.fillStyle = 'rgba(150,45,60,0.6)';
    ctx.fillRect(visibleL, s.y, visibleR - visibleL, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(visibleL, s.y + 2, visibleR - visibleL, 1.5);
  };

  Game.prototype._makePattern = function (ctx, key, scale) {
    var im = Assets.img(key);
    if (!im) return null;
    var nw = im.naturalWidth || im.width;
    var nh = im.naturalHeight || im.height;
    if (!nw || !nh) return null;
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(nw * scale));
    c.height = Math.max(1, Math.round(nh * scale));
    var cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    cc.drawImage(im, 0, 0, c.width, c.height);
    var pat = null;
    try { pat = ctx.createPattern(c, 'repeat'); } catch (e) { pat = null; }
    if (key === 'tex_brick') this._brickPattern = pat;
    return pat;
  };

  Game.prototype._drawExit = function (ctx) {
    var L = this.level;
    if (!L.exit) return;
    if (this._cull(L.exit.x, 180)) return;
    var needKeys = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    var locked = (needKeys > 0 && this.levelKeys < needKeys) || (L.exit.afterBoss && !this.bossDown);
    var pulse = 0.72 + Math.sin(this.time * 2.6) * 0.26;
    var x = L.exit.x, y = L.exit.y;

    ctx.save();
    ctx.globalAlpha = locked ? 0.4 : pulse;
    Assets.blitH(ctx, 'u_portal2', x, y - 6, 96, false);
    ctx.globalAlpha = locked ? 0.13 : pulse * 0.35;
    Assets.blitH(ctx, 'u_beams', x, y - 4, 110, false, undefined, 130);
    ctx.restore();

    if (!locked && this.player && Math.abs(this.player.x - x) < 78) {
      this._drawPrompt(ctx, x, y - 104, 'E');
    }
    if (locked && Assets.has('u_lock')) {
      Assets.blit(ctx, 'u_lock', x, y - 92, 0.8, false);
    }
  };

  Game.prototype._drawLighting = function (ctx) {
    var d = this.darkness;
    var lantern = this.player && this.player.lanternT > 0;
    if (d <= 0.01 && !lantern) return;
    var p = this.player;
    if (!p) return;
    var px = p.x - this.camX, py = p.y - 34;
    var radius = lantern ? 420 : 340;
    ctx.save();
    var g = this._grads.light;
    if (!g) {
      g = ctx.createRadialGradient(0, 0, 30, 0, 0, radius);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.45, 'rgba(4,2,8,0.42)');
      g.addColorStop(1, 'rgba(3,1,6,1)');
      this._grads.light = g;
      this._grads.lightR = radius;
    }
    ctx.translate(px, py);
    var scale = radius / this._grads.lightR;
    ctx.scale(scale, scale);
    ctx.globalAlpha = lantern ? Math.min(1, d * 0.62) : d;
    ctx.fillStyle = g;
    ctx.fillRect(-px / scale, -py / scale, W / scale, H / scale);
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

    var fg = this._grads.fog;
    if (!fg) {
      fg = ctx.createLinearGradient(0, H * 0.6, 0, H);
      fg.addColorStop(0, 'rgba(60,20,40,0)');
      fg.addColorStop(0.6, 'rgba(70,22,45,0.09)');
      fg.addColorStop(1, 'rgba(90,25,50,0.15)');
      this._grads.fog = fg;
    }
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = fg;
    ctx.fillRect(0, H * 0.6, W, H * 0.4);
    ctx.restore();
  };

  Game.prototype._drawGlitch = function (ctx) {
    for (var i = 0; i < 3; i++) {
      var y = Math.random() * H;
      var h = 2 + Math.random() * 18;
      var off = (Math.random() - 0.5) * 38;
      try { ctx.drawImage(this.canvas, 0, y, W, h, off, y, W, h); } catch (e) { }
      ctx.fillStyle = 'rgba(230,30,60,' + (0.03 + Math.random() * 0.055) + ')';
      ctx.fillRect(0, y, W, h);
    }
  };

  Game.prototype._drawVignette = function (ctx) {
    var g = this._grads.vig;
    if (!g) {
      g = ctx.createRadialGradient(W / 2, H / 2, H * 0.34, W / 2, H / 2, H * 0.95);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      this._grads.vig = g;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    if (this.player && this.player.hp === 1 && this.state === 'play') {
      var pulse = 0.10 + Math.sin(this.time * 3.4) * 0.06;
      var rg = this._grads.danger;
      if (!rg) {
        rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.95);
        rg.addColorStop(0, 'rgba(140,0,20,0)');
        rg.addColorStop(1, 'rgba(150,0,25,1)');
        this._grads.danger = rg;
      }
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  };

  /* ---------- ambient backdrop for menus ---------- */
  Game.prototype.drawAmbientBackdrop = function () {
    var ctx = this.ctx;
    ctx.fillStyle = '#04030a';
    ctx.fillRect(0, 0, W, H);

    var tile = this._bgTile('bg_bdu');
    if (tile) {
      var tw = tile.width;
      var off = -(this.time * 9) % tw;
      if (off > 0) off -= tw;
      ctx.save();
      ctx.globalAlpha = 0.45;
      var x = off, guard = 0;
      while (x < W && guard++ < 8) { ctx.drawImage(tile, x, 0, tw, H); x += tw; }
      ctx.restore();
    }

    // rain streaks (shared drop pool, advanced here too)
    var dt = this._lastDt || 0.016;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < this.rainDrops.length; i++) {
      var d = this.rainDrops[i];
      d.y += dt * d.sp * 0.85;
      d.x -= 60 * dt;
      if (d.y > H + 20) { d.y = -30; d.x = Math.random() * (W + 200) - 100; }
      if (d.x < -100) d.x = W + 80;
      ctx.strokeStyle = 'rgba(190,200,225,' + (d.a * 1.05) + ')';
      ctx.lineWidth = d.lw;
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x + 3, d.y + d.len);
      ctx.stroke();
    }
    ctx.restore();

    var g = this._grads.titleGlow;
    if (!g) {
      g = ctx.createRadialGradient(W / 2, H * 0.82, 20, W / 2, H * 0.82, 430);
      g.addColorStop(0, 'rgba(160,20,45,0.20)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      this._grads.titleGlow = g;
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    this._drawVignette(ctx);
  };

  /* ---------------- PWA install ---------------- */
  Game.prototype.installPrompt = function () {
    var self = this;
    if (window.__deferredPrompt) {
      window.__deferredPrompt.prompt();
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
