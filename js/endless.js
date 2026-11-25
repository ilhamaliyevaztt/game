/* ============================================================
   endless.js — "SONSUZ" platform mode
   ------------------------------------------------------------
   · every wave is generated procedurally: continuous floor,
     reachable ledges (dy<=100, dx<=80), spikes with clearance,
     ammo / medkit drops, coins
   · difficulty ramps with the wave number
   · every 20th wave is a BOSS wave and its exit stays locked
     until the boss is dead
   · the wave counter is persisted, so the run resumes where it
     stopped
   ============================================================ */
(function (global) {
  'use strict';

  var G = (global.GameCfg && global.GameCfg.G) || 470;
  var FLOOR_H = 340;
  var STEP_Y = 100;
  var STEP_X = 80;

  /* deterministic per-wave RNG so a wave always looks the same */
  function rng(seed) {
    var s = (seed * 2654435761) % 4294967296;
    return function () {
      s = (s * 1664525 + 1013904223) % 4294967296;
      return s / 4294967296;
    };
  }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length) % arr.length]; }

  var BGS = ['bg_void', 'bg_mirrorhall', 'bg_cathedral', 'bg_archive', 'bg_pier', 'bg_cloister'];
  var PROPS = ['prop_lamppost', 'prop_barrel', 'prop_barrel2', 'prop_fence', 'prop_tree',
    'prop_sign', 'prop_plant', 'prop_crate', 'prop_spikes', 'prop_bench'];
  var POOL_EARLY = ['skull', 'crawler', 'crouch', 'hound', 'sleeper', 'swarm'];
  var POOL_MID = ['skullB', 'stalker', 'horn', 'lurk', 'spitter', 'shade', 'bell'];
  var POOL_LATE = ['brute', 'veil', 'choir', 'warden', 'drowned', 'shade', 'swarm'];
  var BOSSES = ['heart', 'bellboss', 'sanu_corrupt'];

  function floor(x, w) { return { x: x, y: G, w: w, h: FLOOR_H, kind: 'ground' }; }
  function ledge(x, y, w) { return { x: x, y: y, w: w || 130, h: 20, kind: 'ledge' }; }

  function levelWidth(wave) {
    return Math.min(5200, 2800 + Math.floor(wave / 3) * 200);
  }

  /**
   * build one wave
   * @param {number} wave 1-based wave number
   */
  function build(wave) {
    var r = rng(wave * 7919 + 13);
    var W = levelWidth(wave);
    var isBoss = wave % 20 === 0;
    var bossName = BOSSES[Math.floor(wave / 20 - 1) % BOSSES.length];

    var platforms = [floor(0, W)];
    var hazards = [];
    var items = [];
    var props = [];
    var enemies = [];

    /* ---------------- ledges: always climbable ---------------- */
    var x = 320;
    while (x < W - 400) {
      var tier = 1 + Math.floor(r() * 3);          // 1..3 steps up
      for (var t = 0; t < tier; t++) {
        platforms.push(ledge(x + t * STEP_X, G - STEP_Y * (t + 1)));
        if (r() < 0.55) {
          items.push({ type: 'coin', x: x + t * STEP_X + 62, y: G - STEP_Y * (t + 1) - 30 });
        }
      }
      if (r() < 0.30) {
        items.push({ type: 'ammo', x: x + tier * STEP_X + 40, y: G - STEP_Y * 3 - 26 });
      }
      if (r() < 0.16) {
        items.push({ type: 'medkit', x: x + 40, y: G - STEP_Y - 26 });
      }
      x += 260 + Math.floor(r() * 320);
    }

    /* ---------------- spikes with guaranteed clearance ---------------- */
    for (var sx = 700; sx < W - 300; sx += 420 + Math.floor(r() * 260)) {
      var sw = 50 + Math.floor(r() * 40);
      hazards.push({ x: sx, y: G - 16, w: sw, h: 16 });
      /* coins arcing over the hazard so the jump is worth it */
      for (var c = 0; c < 3; c++) {
        items.push({ type: 'coin', x: sx - 20 + c * (sw + 20) / 2, y: G - 72 - Math.abs(c - 1) * 26 });
      }
    }

    /* ---------------- floor pickups ---------------- */
    for (var fx = 240; fx < W - 200; fx += 300 + Math.floor(r() * 260)) {
      var roll = r();
      if (roll < 0.48) items.push({ type: 'coin', x: fx, y: G - 34 });
      else if (roll < 0.70) items.push({ type: 'ammo', x: fx, y: G - 30 });
      else if (roll < 0.80) items.push({ type: 'medkit', x: fx, y: G - 30 });
    }

    /* ---------------- props ---------------- */
    for (var px = 160; px < W - 200; px += 210 + Math.floor(r() * 220)) {
      props.push({ a: pick(r, PROPS), x: px, y: G, s: 0.8 + r() * 0.35, dark: r() < 0.5 });
    }

    /* ---------------- enemies ---------------- */
    var tiers = Math.min(4, 1 + Math.floor(wave / 5));       // 1..4
    var count = Math.min(16, 3 + Math.floor(wave / 2));
    var pool = wave < 8 ? POOL_EARLY : (wave < 22 ? POOL_EARLY.concat(POOL_MID) : POOL_MID.concat(POOL_LATE));
    for (var e = 0; e < count; e++) {
      var ex = 520 + Math.floor((W - 900) * ((e + 0.5) / count));
      var type = pick(r, pool);
      var def = (global.Ent && global.Ent.ENEMY_DEFS[type]) || {};
      var flying = !def.gravity;
      enemies.push({
        type: type,
        x: ex,
        y: flying ? G - 120 - r() * 90 : G,
        patrol: [ex - 90, ex + 90],
        speed: (def.speed || 70) * (1 + wave * 0.012)
      });
    }

    /* ---------------- boss wave ---------------- */
    var exit = { x: W - 90, y: G, to: wave };   // `to` is patched by the game
    if (isBoss) {
      enemies.push({ type: bossName, x: W - 520, y: G, boss: true, hp: bossName === 'sanu_corrupt' ? 22 + wave : undefined });
      exit.afterBoss = true;
      platforms.push(ledge(W - 700, G - 100));
      platforms.push(ledge(W - 420, G - 200));
      platforms.push(ledge(W - 700, G - 200));
    }

    var kicker = 'DALĞA ' + wave;
    return {
      id: 'endless' + wave,
      kicker: kicker,
      name: isBoss ? 'BOSS · ' + (bossName === 'heart' ? 'Ürək' : bossName === 'bellboss' ? 'Zəng' : 'Kölgə')
        : 'Sonsuz keçid',
      sub: isBoss ? 'Bu dalğada çıxış bağlıdır — əvvəl onu dayandır.' : 'Dalğa ' + wave + ' · çıxışa çat',
      bg: BGS[wave % BGS.length], bgParallax: 0.22 + (wave % 3) * 0.06,
      rain: wave % 4 === 0 ? 'heavy' : (wave % 3 === 0 ? 'off' : 'light'),
      mood: isBoss ? 'boss' : 'tense',
      dark: Math.min(0.66, 0.10 + wave * 0.012),
      mode: isBoss ? 'boss' : 'calm',
      width: W,
      objective: isBoss ? 'Boss-u məğlub et, sonra çıxışa get.' : 'Sağa get, çıxışa çat.',
      start: { x: 120, y: G },
      checkpoints: [520, Math.round(W * 0.35), Math.round(W * 0.6), Math.round(W * 0.85)],
      platforms: platforms,
      hazards: hazards,
      props: props,
      items: items,
      enemies: enemies,
      npcs: [],
      triggers: [{
        x: 200, once: true, lines: [
          { who: '', text: isBoss ? 'Hava ağırlaşdı. Qarşıda nəfəs alan bir şey var.' : 'Dalğa ' + wave + '. Divarlar yenidən quruldu.' },
          { who: 'Nuran', portrait: 'nuran_0', text: isBoss ? 'Bu dəfə qaçmıram.' : 'Nə qədər davam edəcək, bilmirəm. Sadəcə irəli.' }
        ]
      }],
      exit: exit,
      endlessWave: wave,
      isBossWave: isBoss,
      tier: tiers
    };
  }

  /** build waves 1..n and make them reachable from each other */
  function chain(from, to) {
    var out = [];
    for (var w = from; w <= to; w++) {
      var L = build(w);
      L.exit.to = w;                    // level index == wave number
      L.index = w;
      L.spawn = L.start;
      out.push(L);
    }
    return out;
  }

  /** level index for wave w (the game uses 0-based indices) */
  function indexOf(wave) { return wave; }

  global.Endless = {
    build: build,
    chain: chain,
    indexOf: indexOf,
    levelWidth: levelWidth,
    BOSS_EVERY: 20,
    maxIndex: 999
  };
})(window);
