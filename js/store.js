/* ============================================================
   store.js — profile, difficulty, wallet, chapters, shop
   Everything persists in localStorage and is defensive:
   a corrupt entry can never break the game.
   ============================================================ */
(function (global) {
  'use strict';

  var PROFILE_KEY = 'alice_profile_v3';
  var RUN_KEY = 'alice_run_v3';
  var SETTINGS_KEY = 'alice_settings_v3';

  /* ---------------- difficulty ---------------- */
  var DIFFICULTIES = {
    easy: {
      key: 'easy', name: 'Asan', tag: 'Hekayə üçün',
      desc: '5 ürək, zəif düşmənlər, çox güllə. Hekayəni rahat yaşa.',
      hearts: 5, dmgMul: 0.5, hpMul: 0.7, spdMul: 0.86, aggroMul: 0.85,
      ammoMul: 1.6, coinMul: 1.15, scoreMul: 0.8, medDropMul: 1.5
    },
    normal: {
      key: 'normal', name: 'Orta', tag: 'Tövsiyə olunur',
      desc: '4 ürək, balanslı düşmənlər. Əsl atmosfer buradadır.',
      hearts: 4, dmgMul: 1, hpMul: 1, spdMul: 1, aggroMul: 1,
      ammoMul: 1, coinMul: 1, scoreMul: 1, medDropMul: 1
    },
    hard: {
      key: 'hard', name: 'Çətin', tag: 'Cəsarətli üçün',
      desc: '3 ürək, sürətli və davamlı düşmənlər. Hər güllə dəyərlidir.',
      hearts: 3, dmgMul: 1.5, hpMul: 1.45, spdMul: 1.16, aggroMul: 1.25,
      ammoMul: 0.62, coinMul: 0.95, scoreMul: 1.5, medDropMul: 0.65
    }
  };

  /* ---------------- shop ---------------- */
  var SHOP = [
    { id: 'ammo10', name: 'Güllə qutusu', sub: '+12 güllə', icon: 'i_bullets', price: 25, kind: 'ammo', amount: 12 },
    { id: 'medkit', name: 'Tibb dəsti', sub: 'Dərhal +1 ürək', icon: 'i_medkit', price: 45, kind: 'medkit', amount: 1 },
    { id: 'flower', name: 'Ağ çiçək', sub: 'Alice-ə hədiyyə', icon: 'i_gem', price: 55, kind: 'flower', amount: 1 },
    { id: 'lantern', name: 'Neft lampası', sub: '60 saniyə işıq', icon: 'i_potion', price: 40, kind: 'lantern', amount: 1 },
    { id: 'coffee', name: 'Səhər qəhvəsi', sub: '35 saniyə sürət', icon: 'i_grenade', price: 35, kind: 'coffee', amount: 1 },
    { id: 'shield', name: 'Kölgə qalxanı', sub: '1 zərbəni udur', icon: 'i_scroll', price: 85, kind: 'shield', amount: 1 },
    { id: 'shotgun', name: 'Ov tüfəngi', sub: 'Daimi güclü silah', icon: 'i_shotgun', price: 170, kind: 'shotgun', amount: 1 }
  ];

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }

  var Store = {
    DIFFICULTIES: DIFFICULTIES,
    SHOP: SHOP,
    TOTAL_CHAPTERS: 7,

    profile: null,

    /* ---------- profile ---------- */
    load: function () {
      var p = null;
      try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { p = null; }
      if (!p || typeof p !== 'object') p = {};
      var prof = {
        difficulty: DIFFICULTIES[p.difficulty] ? p.difficulty : 'normal',
        wallet: Math.max(0, Math.floor(num(p.wallet, 0))),
        unlocked: Math.max(1, Math.min(this.TOTAL_CHAPTERS, Math.floor(num(p.unlocked, 1)))),
        chapters: (p.chapters && typeof p.chapters === 'object') ? p.chapters : {},
        flowers: Math.max(0, Math.floor(num(p.flowers, 0))),
        gifts: Math.max(0, Math.floor(num(p.gifts, 0))),
        ammo: Math.max(0, Math.floor(num(p.ammo, 0))),
        medkits: Math.max(0, Math.floor(num(p.medkits, 0))),
        lanterns: Math.max(0, Math.floor(num(p.lanterns, 0))),
        coffees: Math.max(0, Math.floor(num(p.coffees, 0))),
        shields: Math.max(0, Math.floor(num(p.shields, 0))),
        hasShotgun: !!p.hasShotgun,
        bestScore: Math.max(0, Math.floor(num(p.bestScore, 0))),
        deaths: Math.max(0, Math.floor(num(p.deaths, 0))),
        endings: Math.max(0, Math.floor(num(p.endings, 0)))
      };
      this.profile = prof;
      return prof;
    },

    save: function () {
      if (!this.profile) return;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) { }
    },

    reset: function () {
      try { localStorage.removeItem(PROFILE_KEY); localStorage.removeItem(RUN_KEY); } catch (e) { }
      this.profile = null;
      return this.load();
    },

    /* ---------- convenience ---------- */
    diff: function () {
      var p = this.profile || this.load();
      return DIFFICULTIES[p.difficulty] || DIFFICULTIES.normal;
    },

    setDifficulty: function (key) {
      var p = this.profile || this.load();
      if (DIFFICULTIES[key]) p.difficulty = key;
      this.save();
    },

    wallet: function () { return (this.profile || this.load()).wallet; },

    addCoins: function (n) {
      var p = this.profile || this.load();
      p.wallet = Math.max(0, p.wallet + Math.round(n));
      this.save();
      return p.wallet;
    },

    spend: function (n) {
      var p = this.profile || this.load();
      if (p.wallet < n) return false;
      p.wallet -= n;
      this.save();
      return true;
    },

    isUnlocked: function (index) {
      var p = this.profile || this.load();
      return (index + 1) <= p.unlocked;
    },

    unlockThrough: function (index) {
      var p = this.profile || this.load();
      p.unlocked = Math.max(p.unlocked, Math.min(this.TOTAL_CHAPTERS, index + 1));
      this.save();
    },

    markChapter: function (id, score) {
      var p = this.profile || this.load();
      var c = p.chapters[id] || { done: false, best: 0, runs: 0 };
      c.done = true;
      c.runs = (c.runs || 0) + 1;
      c.best = Math.max(num(c.best, 0), Math.round(num(score, 0)));
      p.chapters[id] = c;
      if (score > p.bestScore) p.bestScore = Math.round(score);
      this.save();
    },

    chapterDone: function (id) {
      var p = this.profile || this.load();
      return !!(p.chapters[id] && p.chapters[id].done);
    },

    /* ---------- purchases ---------- */
    buy: function (itemId) {
      var item = null;
      for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === itemId) item = SHOP[i];
      if (!item) return { ok: false, reason: 'missing' };
      var p = this.profile || this.load();
      if (item.kind === 'shotgun' && p.hasShotgun) return { ok: false, reason: 'owned' };
      if (p.wallet < item.price) return { ok: false, reason: 'poor' };
      p.wallet -= item.price;
      switch (item.kind) {
        case 'ammo': p.ammo += item.amount; break;
        case 'medkit': p.medkits += 1; break;
        case 'flower': p.flowers += 1; break;
        case 'lantern': p.lanterns += 1; break;
        case 'coffee': p.coffees += 1; break;
        case 'shield': p.shields += 1; break;
        case 'shotgun': p.hasShotgun = true; p.ammo += 20; break;
        default: break;
      }
      this.save();
      return { ok: true, item: item, wallet: p.wallet };
    },

    /* ---------- run snapshot (checkpoint) ---------- */
    saveRun: function (run) {
      try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { }
    },

    loadRun: function () {
      var r = null;
      try { r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { r = null; }
      if (!r || typeof r !== 'object' || typeof r.level !== 'number') return null;
      if (r.level < 0 || r.level >= this.TOTAL_CHAPTERS) return null;
      return r;
    },

    clearRun: function () {
      try { localStorage.removeItem(RUN_KEY); } catch (e) { }
    },

    hasRun: function () { return !!this.loadRun(); },

    /* ---------- settings ---------- */
    loadSettings: function () {
      var s = null;
      try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { }
      if (!s || typeof s !== 'object') s = {};
      return {
        master: Math.max(0, Math.min(1, num(s.master, 0.7))),
        music: Math.max(0, Math.min(1, num(s.music, 0.55))),
        shake: s.shake !== false,
        crt: s.crt !== false,
        lowFx: !!s.lowFx,
        quality: s.quality === 'low' ? 'low' : 'auto'
      };
    },

    saveSettings: function (s) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { }
    }
  };

  global.Store = Store;
})(window);
