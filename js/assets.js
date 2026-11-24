/* ============================================================
   assets.js — sprite manifest + loader with progress
   ============================================================ */
(function (global) {
  'use strict';

  const MANIFEST = {
    // --- backgrounds ---
    bg_pier:      'assets/bg_pier.png',
    bg_forest:    'assets/bg_forest.png',
    bg_house:     'assets/bg_house.png',
    bg_room:      'assets/bg_room.png',
    bg_street:    'assets/bg_street.png',

    // --- terrain ---
    tex_brick:    'assets/tex_brick.png',
    tex_ground:   'assets/tex_ground.png',
    tile_brick:   'assets/tile_brick.png',

    // --- Leo frames ---
    leo_0:        'assets/leo_0.png',
    leo_1:        'assets/leo_1.png',
    leo_2:        'assets/leo_2.png',
    leo_3:        'assets/leo_3.png',
    leo_4:        'assets/leo_4.png',
    leo_5:        'assets/leo_5.png',
    leo_small:    'assets/leo_small.png',
    leo_back:     'assets/leo_back.png',

    // --- Alice ---
    alice_0:      'assets/alice_0.png',
    alice_1:      'assets/alice_1.png',
    alice_2:      'assets/alice_2.png',
    alice_ghost:  'assets/alice_ghost.png',

    // --- monsters ---
    mon_skull:    'assets/mon_skull.png',
    mon_skull2:   'assets/mon_skull2.png',
    mon_crawl:    'assets/mon_crawl.png',
    mon_shadow:   'assets/mon_shadow.png',
    mon_bride:    'assets/mon_bride.png',
    mon_eye:      'assets/mon_eye.png',

    // --- items ---
    i_bullets:    'assets/i_bullets.png',
    i_coin:       'assets/i_coin.png',
    i_gem:        'assets/i_gem.png',
    i_grenade:    'assets/i_grenade.png',
    i_heart_empty:'assets/i_heart_empty.png',
    i_heart_full: 'assets/i_heart_full.png',
    i_key:        'assets/i_key.png',
    i_letter:     'assets/i_letter.png',
    i_medkit:     'assets/i_medkit.png',
    i_photo:      'assets/i_photo.png',
    i_pistol:     'assets/i_pistol.png',
    i_potion:     'assets/i_potion.png',
    i_scroll:     'assets/i_scroll.png',
    i_shotgun:    'assets/i_shotgun.png',

    // --- props ---
    prop_barrel:  'assets/prop_barrel.png',
    prop_barrel2: 'assets/prop_barrel2.png',
    prop_bed:     'assets/prop_bed.png',
    prop_bench:   'assets/prop_bench.png',
    prop_bookshelf:'assets/prop_bookshelf.png',
    prop_chair:   'assets/prop_chair.png',
    prop_crate:   'assets/prop_crate.png',
    prop_door:    'assets/prop_door.png',
    prop_fence:   'assets/prop_fence.png',
    prop_flowerpot:'assets/prop_flowerpot.png',
    prop_ladder:  'assets/prop_ladder.png',
    prop_lamppost:'assets/prop_lamppost.png',
    prop_plant:   'assets/prop_plant.png',
    prop_pole:    'assets/prop_pole.png',
    prop_sign:    'assets/prop_sign.png',
    prop_spikes:  'assets/prop_spikes.png',
    prop_table:   'assets/prop_table.png',
    prop_tree:    'assets/prop_tree.png',
    prop_window1: 'assets/prop_window1.png',
    prop_window2: 'assets/prop_window2.png',

    // --- story ---
    s_blood:      'assets/s_blood.png',
    s_hand:       'assets/s_hand.png',
    s_letter_blood:'assets/s_letter_blood.png',
    s_portrait:   'assets/s_portrait.png',

    // --- ui ---
    u_arrow_dn:   'assets/u_arrow_dn.png',
    u_arrow_l:    'assets/u_arrow_l.png',
    u_arrow_r:    'assets/u_arrow_r.png',
    u_arrow_u:    'assets/u_arrow_u.png',
    u_beams:      'assets/u_beams.png',
    u_bloodsplat: 'assets/u_bloodsplat.png',
    u_dialog:     'assets/u_dialog.png',
    u_door:       'assets/u_door.png',
    u_exclaim:    'assets/u_exclaim.png',
    u_glitch:     'assets/u_glitch.png',
    u_key_a:      'assets/u_key_a.png',
    u_key_d:      'assets/u_key_d.png',
    u_key_icon:   'assets/u_key_icon.png',
    u_key_shift:  'assets/u_key_shift.png',
    u_key_space:  'assets/u_key_space.png',
    u_lock:       'assets/u_lock.png',
    u_mouse:      'assets/u_mouse.png',
    u_portal:     'assets/u_portal.png',
    u_question:   'assets/u_question.png'
  };

  const IMG = Object.create(null);
  let loaded = 0;
  const total = Object.keys(MANIFEST).length;

  function load(onProgress) {
    const names = Object.keys(MANIFEST);
    return Promise.all(names.map(function (key) {
      return new Promise(function (resolve) {
        const img = new Image();
        img.decoding = 'async';
        img.onload = function () {
          IMG[key] = img;
          loaded++;
          if (onProgress) onProgress(loaded / total, key);
          resolve();
        };
        img.onerror = function () {
          // never reject: a missing sprite must not kill the game
          console.warn('[assets] failed:', key, MANIFEST[key]);
          IMG[key] = null;
          loaded++;
          if (onProgress) onProgress(loaded / total, key);
          resolve();
        };
        img.src = MANIFEST[key];
      });
    }));
  }

  /** returns a real HTMLImageElement or null */
  function img(key) {
    return IMG[key] || null;
  }
  function has(key) {
    return !!IMG[key];
  }
  /** natural size helper with fallback */
  function size(key) {
    const i = IMG[key];
    return i ? { w: i.naturalWidth || i.width, h: i.naturalHeight || i.height } : { w: 32, h: 32 };
  }

  /** draw an image anchored at bottom-centre, scaled by s */
  function blit(ctx, key, cx, bottomY, s, flip, alpha) {
    const i = IMG[key];
    if (!i) return;
    s = s || 1;
    const w = (i.naturalWidth || i.width) * s;
    const h = (i.naturalHeight || i.height) * s;
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, bottomY);
      ctx.scale(-1, 1);
      ctx.drawImage(i, -w / 2, -h, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(i, cx - w / 2, bottomY - h, w, h);
    }
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = 1;
  }

  global.Assets = { MANIFEST: MANIFEST, load: load, img: img, has: has, size: size, blit: blit };
})(window);
