/* ============================================================
   store.js — profile, difficulty, wallet, chapters, shop, journal
   Persists in localStorage and is fully defensive: a corrupt
   entry can never break the game.
   ============================================================ */
(function (global) {
  'use strict';

  var PROFILE_KEY  = 'sanu_profile_v4';
  var RUN_KEY      = 'sanu_run_v4';
  var SETTINGS_KEY = 'sanu_settings_v4';
  var LEGACY = {
    profile: ['alice_profile_v3', 'alice_profile_v2'],
    run: ['alice_run_v3'],
    settings: ['alice_settings_v3']
  };

  /* ---------------- difficulty ----------------
     Tuned so the story is finishable on every mode:
     you always keep enough ammo to clear a boss and the
     heart pool grows generously as difficulty drops.      */
  var DIFFICULTIES = {
    easy: {
      key: 'easy', name: 'Asan', tag: 'Hekayə üçün',
      desc: '6 ürək, zəif və yavaş düşmənlər, bol güllə. Hekayəni rahat yaşa.',
      hearts: 6, dmgMul: 0.5, hpMul: 0.62, spdMul: 0.8, aggroMul: 0.72,
      ammoMul: 2.1, coinMul: 1.35, scoreMul: 0.8, medDropMul: 2.2,
      hazardDmg: 1, ammoStart: 30, medStart: 2, invulnBonus: 0.5
    },
    normal: {
      key: 'normal', name: 'Orta', tag: 'Tövsiyə olunur',
      desc: '5 ürək, balanslı düşmənlər, kifayət qədər güllə. Əsl atmosfer buradadır.',
      hearts: 5, dmgMul: 0.85, hpMul: 0.88, spdMul: 0.94, aggroMul: 0.9,
      ammoMul: 1.45, coinMul: 1, scoreMul: 1, medDropMul: 1.4,
      hazardDmg: 1, ammoStart: 24, medStart: 1, invulnBonus: 0.25
    },
    hard: {
      key: 'hard', name: 'Çətin', tag: 'Cəsarətli üçün',
      desc: '4 ürək, davamlı və sürətli düşmənlər, tikanlar 2 zərbə vurur.',
      hearts: 4, dmgMul: 1, hpMul: 1.15, spdMul: 1.08, aggroMul: 1.12,
      ammoMul: 1.05, coinMul: 0.95, scoreMul: 1.5, medDropMul: 0.9,
      hazardDmg: 2, ammoStart: 20, medStart: 0, invulnBonus: 0
    }
  };

  /* ---------------- difficulty switching ladder ----------------
     `next` is the gentler mode offered when a chapter keeps
     killing the player. `easy` has no further step.             */
  var SOFTER = { hard: 'normal', normal: 'easy', easy: null };

  /* ---------------- shop ---------------- */
  var SHOP = [
    { id: 'ammo10',  name: 'Güllə qutusu',  sub: '+14 güllə',           icon: 'i_bullets', price: 22, kind: 'ammo',   amount: 14 },
    { id: 'ammo30',  name: 'Patron yeşiyi', sub: '+40 güllə',           icon: 'i_bullets', price: 55, kind: 'ammo',   amount: 40 },
    { id: 'medkit',  name: 'Tibb dəsti',    sub: 'Dərhal +1 ürək',       icon: 'i_medkit',  price: 40, kind: 'medkit' },
    { id: 'flower',  name: 'Ağ çiçək',      sub: 'Sanu-ya hədiyyə',      icon: 'i_gem',     price: 50, kind: 'flower' },
    { id: 'lantern', name: 'Neft lampası',  sub: '75 saniyə geniş işıq', icon: 'i_potion',  price: 36, kind: 'lantern' },
    { id: 'coffee',  name: 'Səhər qəhvəsi', sub: '40 saniyə sürət',      icon: 'i_grenade', price: 30, kind: 'coffee' },
    { id: 'shield',  name: 'Kölgə qalxanı', sub: '2 zərbəni udur',       icon: 'i_scroll',  price: 75, kind: 'shield' },
    { id: 'shotgun', name: 'Ov tüfəngi',    sub: 'Daimi güclü silah',    icon: 'i_shotgun', price: 150, kind: 'shotgun' }
  ];

  /* ---------------- journal ----------------
     Story fragments the player can re-read from the pause
     menu. Unlocking is permanent across runs.                  */
  var JOURNAL = [
    { id: 'j_letter',    ch: 1, icon: 'i_letter',      title: 'Islanmış vərəq',      text: 'Bulvar skamyasının üstündə bir vərəq. Yağış mürəkkəbi axıdıb, amma bir cümlə hələ oxunur: “Bəzən insan sevdiyi şeyləri itirməkdən qorxur.” Bu əl yazısı mənimkidir. Nə vaxt yazmışam?' },
    { id: 'j_phone1',    ch: 1, icon: 'u_phone',       title: 'Naməlum nömrə · 03:14', text: 'Telefonda bir mesaj: “Sən hələ də məni axtarırsan?” Nömrə mövcud deyil. Mesajın vaxtı bu gecədir — 03:14.' },
    { id: 'j_notice',    ch: 2, icon: 'i_scroll',      title: 'Divardakı elan',      text: '“314-cü auditoriya təmirə görə bağlıdır. Heç kim girməsin.” Altında kiminsə əli ilə yazılıb: “O, hələ də orada gözləyir.” 314 rəqəmi yuxularımda da var.' },
    { id: 'j_photo1',    ch: 3, icon: 's_portrait',    title: 'Cızılmış şəkil',      text: '314-cü auditoriya. Cərgədə oturanlar arasında mən də varam. Yanımdakı qızın üzü qələmlə cızılıb — sanki kimsə onu silmək istəyib. Arxasında: “Məni xatırla. Məni bağışla.”' },
    { id: 'j_phone2',    ch: 3, icon: 'u_phone',       title: 'İki mesaj',           text: '“314-cü auditoriyaya gəl.” / “Qorxma. Mən səni gözləyirəm.” Eyni nömrə. Eyni saat. Hər dəfə bir addım daha yaxın.' },
    { id: 'j_blood',     ch: 3, icon: 's_letter_blood',title: 'Divar yazısı',        text: 'Divarda qanla: “SƏN HEÇ VAXT MƏNİ HƏQİQƏTƏN TANIMAMIŞSAN.” Dəhlizin sonunda bir qapı çırpıldı.' },
    { id: 'j_board',     ch: 4, icon: 'u_msgbox',      title: 'Lövhədəki təbaşir',   text: '“Sanu hələ də məni axtarırsan?” Bu yazı bugünkü deyil — tozun altından çıxır, illərlə buradadır. Və altında, daha kiçik hərflərlə: “Mən də səni.”' },
    { id: 'j_photo2',    ch: 4, icon: 's_portrait',    title: 'Parta üstündəki şəkil',text: 'İki əl: biri dəftər tutur, digəri çiçək. Mən bu çiçəyi ona vermək istəmişdim. Amma heç vaxt vermədim. Həmişə “bir gün daha” gözlədim. Sonra heç bir gün qalmadı.' },
    { id: 'j_hand',      ch: 5, icon: 's_hand',        title: 'Divardakı əl izi',    text: 'Qanlı əl izi, barmaqlar aşağıya uzanır. Əl çox kiçikdir. Altında rəqəmlər: 03 · 14.' },
    { id: 'j_folder',    ch: 5, icon: 'i_letter',      title: 'Arxiv qovluğu',       text: '“Tələbə Sanu M. — 314-cü qrup. Status: akademik məzuniyyət.” Tarix: bu gündən dörd il əvvəl. Heç kim mənə demədi. Mən niyə xatırlamıram?' },
    { id: 'j_truth',     ch: 5, icon: 's_blood',       title: 'Qovluğun arxası',     text: 'İkinci səhifə, daha köhnə mürəkkəb: “Nuran Ə. — müraciət: psixoloji dəstək. Səbəb: travmatik itki, yaddaşın qoruyucu silinməsi.” Deməli... xatırlamamaq mənim qərarım deyildi. Bu, müdafiə idi.' },
    { id: 'j_last',      ch: 7, icon: 'i_gem',         title: 'Son söz',             text: '“Sən məni xatırlamaq istəmədin, mən də səni unutdum. Amma unutmaq — bağışlamaq deyil. Sən hələ də nəfəs alırsan. Bu kifayətdir.”' }
  ];

  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function int(v, d) { return Math.max(0, Math.floor(num(v, d))); }

  function readKey(list) {
    for (var i = 0; i < list.length; i++) {
      try {
        var raw = localStorage.getItem(list[i]);
        if (raw) return raw;
      } catch (e) { }
    }
    return null;
  }

  var Store = {
    DIFFICULTIES: DIFFICULTIES,
    SOFTER: SOFTER,
    SHOP: SHOP,
    JOURNAL: JOURNAL,
    TOTAL_CHAPTERS: 7,
    profile: null,

    /* ---------- profile ---------- */
    load: function () {
      var p = null;
      try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { p = null; }
      if (!p || typeof p !== 'object') {
        // migrate an older v3 profile so nobody loses progress
        var legacy = readKey(LEGACY.profile);
        if (legacy) { try { p = JSON.parse(legacy); } catch (e) { p = null; } }
      }
      if (!p || typeof p !== 'object') p = {};

      var journal = {};
      if (p.journal && typeof p.journal === 'object') {
        for (var k in p.journal) if (p.journal[k]) journal[k] = 1;
      }

      var prof = {
        difficulty: DIFFICULTIES[p.difficulty] ? p.difficulty : 'normal',
        wallet: int(p.wallet, 0),
        unlocked: Math.max(1, Math.min(this.TOTAL_CHAPTERS, Math.floor(num(p.unlocked, 1)))),
        chapters: (p.chapters && typeof p.chapters === 'object') ? p.chapters : {},
        flowers: int(p.flowers, 0),
        gifts: int(p.gifts, 0),
        ammo: int(p.ammo, 0),
        medkits: int(p.medkits, 0),
        lanterns: int(p.lanterns, 0),
        coffees: int(p.coffees, 0),
        shields: int(p.shields, 0),
        hasShotgun: !!p.hasShotgun,
        bestScore: int(p.bestScore, 0),
        deaths: int(p.deaths, 0),
        endings: int(p.endings, 0),
        seenIntro: !!p.seenIntro,
        beaten: !!p.beaten,
        journal: journal
      };
      // repair a broken chapters map
      for (var id in prof.chapters) {
        var c = prof.chapters[id];
        if (!c || typeof c !== 'object') { delete prof.chapters[id]; continue; }
        c.done = !!c.done;
        c.best = int(c.best, 0);
        c.runs = int(c.runs, 0);
      }
      this.profile = prof;
      return prof;
    },

    save: function () {
      if (!this.profile) return;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) { }
    },

    reset: function () {
      try {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(RUN_KEY);
        LEGACY.profile.concat(LEGACY.run).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { }
      this.profile = null;
      return this.load();
    },

    /* ---------- difficulty ---------- */
    diff: function () {
      var p = this.profile || this.load();
      return DIFFICULTIES[p.difficulty] || DIFFICULTIES.normal;
    },

    setDifficulty: function (key) {
      var p = this.profile || this.load();
      if (DIFFICULTIES[key]) p.difficulty = key;
      this.save();
      return DIFFICULTIES[p.difficulty];
    },

    softerThan: function (key) { return SOFTER[key] || null; },

    /* ---------- wallet ---------- */
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

    /* ---------- chapters ---------- */
    isUnlocked: function (index) {
      var p = this.profile || this.load();
      return (index + 1) <= p.unlocked;
    },

    unlockThrough: function (index) {
      var p = this.profile || this.load();
      var target = Math.min(this.TOTAL_CHAPTERS, index + 1);
      if (target > p.unlocked) { p.unlocked = target; this.save(); }
      return p.unlocked;
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
      return c;
    },

    chapterDone: function (id) {
      var p = this.profile || this.load();
      return !!(p.chapters[id] && p.chapters[id].done);
    },

    chapterBest: function (id) {
      var p = this.profile || this.load();
      return p.chapters[id] ? p.chapters[id].best : 0;
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
        case 'ammo':   p.ammo += item.amount; break;
        case 'medkit': p.medkits += 1; break;
        case 'flower': p.flowers += 1; break;
        case 'lantern':p.lanterns += 1; break;
        case 'coffee': p.coffees += 1; break;
        case 'shield': p.shields += 1; break;
        case 'shotgun':p.hasShotgun = true; p.ammo += 24; break;
        default: break;
      }
      this.save();
      return { ok: true, item: item, wallet: p.wallet };
    },

    /**
     * Moves every owned consumable out of the profile and returns it,
     * so a purchase is granted exactly once (no infinite-ammo exploit).
     */
    takeConsumables: function () {
      var p = this.profile || this.load();
      var out = {
        ammo: p.ammo, medkits: p.medkits, lanterns: p.lanterns,
        coffees: p.coffees, shields: p.shields, hasShotgun: p.hasShotgun
      };
      p.ammo = 0; p.medkits = 0; p.lanterns = 0; p.coffees = 0; p.shields = 0;
      this.save();
      return out;
    },

    /* ---------- journal ---------- */
    addJournal: function (id) {
      var p = this.profile || this.load();
      if (!id || p.journal[id]) return false;
      p.journal[id] = 1;
      this.save();
      return true;
    },

    journal: function () {
      var p = this.profile || this.load();
      var found = [];
      for (var i = 0; i < JOURNAL.length; i++) {
        if (p.journal[JOURNAL[i].id]) found.push(JOURNAL[i]);
      }
      return found;
    },

    journalCount: function () {
      var p = this.profile || this.load();
      var n = 0;
      for (var k in p.journal) if (p.journal[k]) n++;
      return n;
    },

    /* ---------- run snapshot ---------- */
    saveRun: function (run) {
      try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { }
    },

    loadRun: function () {
      var r = null;
      try { r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { r = null; }
      if (!r || typeof r !== 'object') {
        var legacy = readKey(LEGACY.run);
        if (legacy) { try { r = JSON.parse(legacy); } catch (e) { r = null; } }
      }
      if (!r || typeof r !== 'object' || typeof r.level !== 'number') return null;
      if (r.level < 0 || r.level >= this.TOTAL_CHAPTERS) return null;
      return r;
    },

    clearRun: function () {
      try {
        localStorage.removeItem(RUN_KEY);
        LEGACY.run.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { }
    },

    hasRun: function () { return !!this.loadRun(); },

    /* ---------- settings ---------- */
    loadSettings: function () {
      var s = null;
      try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { }
      if (!s || typeof s !== 'object') {
        var legacy = readKey(LEGACY.settings);
        if (legacy) { try { s = JSON.parse(legacy); } catch (e) { s = {}; } }
      }
      if (!s || typeof s !== 'object') s = {};
      return {
        master: Math.max(0, Math.min(1, num(s.master, 0.7))),
        music: Math.max(0, Math.min(1, num(s.music, 0.55))),
        shake: s.shake !== false,
        crt: s.crt !== false,
        lowFx: !!s.lowFx,
        autoFx: s.autoFx !== false
      };
    },

    saveSettings: function (s) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { }
    }
  };

  global.Store = Store;
})(window);
