/* ============================================================
   weapons.js — weapon table (shared by story + endless modes)
   ------------------------------------------------------------
   A weapon is pure data so the shop, the HUD and the player all
   read the same numbers.  Ammo is one shared pool (as before):
   every trigger pull spends `cost` rounds.
   ============================================================ */
(function (global) {
  'use strict';

  var WEAPONS = {
    pistol: {
      id: 'pistol', name: 'Tapança', short: 'TAP',
      icon: 'i_pistol', dmg: 1, cd: 0.25, pellets: 1, spread: 0,
      speed: 1060, range: 470, pierce: 0, cost: 1,
      knock: 30, noise: 0.40, shake: 2.6, color: '#ffe6b8',
      bullet: 'small', sfx: 'shoot', free: true,
      desc: 'Etibarlı, dəqiq, hər zaman səninlə.'
    },
    shotgun: {
      id: 'shotgun', name: 'Ov tüfəngi', short: 'TÜF',
      icon: 'i_shotgun', dmg: 1, cd: 0.52, pellets: 3, spread: 0.055,
      speed: 980, range: 300, pierce: 0, cost: 1,
      knock: 60, noise: 0.55, shake: 4.2, color: '#ffd6a0',
      bullet: 'pellet', sfx: 'shoot', price: 150,
      desc: 'Yaxın məsafədə üç güllə birdən. Sürətli deyil.'
    },
    smg: {
      id: 'smg', name: 'Avtomat', short: 'AVT',
      icon: 'i_smg', dmg: 1, cd: 0.085, pellets: 1, spread: 0.035,
      speed: 1020, range: 560, pierce: 0, cost: 1,
      knock: 12, noise: 0.42, shake: 1.5, color: '#ffe0a8',
      bullet: 'small', sfx: 'shoot_fast', price: 190,
      desc: 'Saniyədə on iki güllə. Dəqiqliyi bir az itirir.'
    },
    rifle: {
      id: 'rifle', name: 'Keskin nişan', short: 'NİŞ',
      icon: 'i_rifle', dmg: 2, cd: 0.34, pellets: 1, spread: 0,
      speed: 1500, range: 980, pierce: 1, cost: 1,
      knock: 45, noise: 0.62, shake: 3.4, color: '#d8f0ff',
      bullet: 'rifle', sfx: 'shoot', price: 260,
      desc: 'Uzaq məsafə, iki zərbə, bir düşməni deşib keçir.'
    },
    voidcannon: {
      id: 'voidcannon', name: 'Boşluq topu', short: 'BOŞ',
      icon: 'i_void', dmg: 4, cd: 0.72, pellets: 1, spread: 0,
      speed: 780, range: 820, pierce: 2, cost: 2,
      knock: 90, noise: 0.72, shake: 6.4, color: '#b98cff',
      bullet: 'void', sfx: 'shoot_void', price: 420,
      desc: 'Kölgəni dağıdan ağır enerji. İki güllə həsr edir.'
    }
  };

  var ORDER = ['pistol', 'shotgun', 'smg', 'rifle', 'voidcannon'];

  function get(id) { return WEAPONS[id] || WEAPONS.pistol; }
  function list() { return ORDER.map(function (id) { return WEAPONS[id]; }); }

  /** weapons the profile actually owns (pistol is always there) */
  function owned(prof) {
    var out = [];
    for (var i = 0; i < ORDER.length; i++) {
      var w = WEAPONS[ORDER[i]];
      if (w.free) out.push(w);
      else if (prof && prof.weapons && prof.weapons[w.id]) out.push(w);
      else if (w.id === 'shotgun' && prof && prof.hasShotgun) out.push(w);
    }
    return out;
  }

  /** cycle through owned weapons: dir = 1 next, -1 previous */
  function cycle(currentId, prof, dir) {
    var have = owned(prof);
    if (!have.length) return WEAPONS.pistol;
    var idx = 0;
    for (var i = 0; i < have.length; i++) if (have[i].id === currentId) idx = i;
    idx = (idx + (dir || 1) + have.length) % have.length;
    return have[idx];
  }

  global.Weapons = {
    WEAPONS: WEAPONS, ORDER: ORDER, get: get, list: list,
    owned: owned, cycle: cycle
  };
})(window);
