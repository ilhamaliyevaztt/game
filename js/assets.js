/* ============================================================
   assets.js — sprite manifest + loader with progress
   · only assets the game really uses are listed (fast boot)
   · blitH() scales any sprite to a target height
   · glow() returns a cached radial-gradient sprite so the
     renderer never builds a gradient per frame
   ============================================================ */
(function (global) {
  'use strict';

  var MANIFEST = {
    // --- backgrounds ---
    bg_baku:      'assets/bg_baku.png',
    bg_bdu:       'assets/bg_bdu.png',
    bg_campus:    'assets/bg_campus.png',
    bg_class:     'assets/bg_class.png',
    bg_room:      'assets/bg_room.png',
    bg_street:    'assets/bg_street.png',

    // --- terrain ---
    tex_brick:    'assets/tex_brick.png',
    tex_ground:   'assets/tex_ground.png',

    // --- Nuran (protagonist) ---
    nuran_0:      'assets/nuran_0.png',
    nuran_a0:     'assets/nuran_a0.png',
    nuran_a1:     'assets/nuran_a1.png',
    nuran_a2:     'assets/nuran_a2.png',
    nuran_a3:     'assets/nuran_a3.png',
    nuran_shoot2: 'assets/nuran_shoot2.png',

    // --- Sanu ---
    sanu_a0:      'assets/sanu_a0.png',
    sanu_a1:      'assets/sanu_a1.png',
    sanu_a2:      'assets/sanu_a2.png',
    sanu_ghost:   'assets/sanu_ghost.png',
    sanu_corrupt: 'assets/sanu_corrupt.png',

    // --- monsters ---
    mon_skull:    'assets/mon_skull.png',
    mon_skull2:   'assets/mon_skull2.png',
    mon_crawl:    'assets/mon_crawl.png',
    mon_shadow:   'assets/mon_shadow.png',
    mon_stalker:  'assets/mon_stalker.png',
    mon_hound:    'assets/mon_hound.png',
    mon_crouch:   'assets/mon_crouch.png',
    mon_lurk:     'assets/mon_lurk.png',
    mon_horn:     'assets/mon_horn.png',
    mon_veil:     'assets/mon_veil.png',
    mon_eye2:     'assets/mon_eye2.png',

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
    i_potion:     'assets/i_potion.png',
    i_scroll:     'assets/i_scroll.png',
    i_shotgun:    'assets/i_shotgun.png',

    // --- props ---
    prop_barrel:  'assets/prop_barrel.png',
    prop_barrel2: 'assets/prop_barrel2.png',
    prop_bed:     'assets/prop_bed.png',
    prop_ladder:  'assets/prop_ladder.png',
    prop_window1: 'assets/prop_window1.png',
    prop_window2: 'assets/prop_window2.png',
    prop_bench:   'assets/prop_bench.png',
    prop_bookshelf:'assets/prop_bookshelf.png',
    prop_chair:   'assets/prop_chair.png',
    prop_door:    'assets/prop_door.png',
    prop_fence:   'assets/prop_fence.png',
    prop_flowerpot:'assets/prop_flowerpot.png',
    prop_lamppost:'assets/prop_lamppost.png',
    prop_plant:   'assets/prop_plant.png',
    prop_sign:    'assets/prop_sign.png',
    prop_spikes:  'assets/prop_spikes.png',
    prop_table:   'assets/prop_table.png',
    prop_tree:    'assets/prop_tree.png',

    // --- story ---
    s_blood:      'assets/s_blood.png',
    s_hand:       'assets/s_hand.png',
    s_letter_blood:'assets/s_letter_blood.png',
    s_portrait:   'assets/s_portrait.png',

    // --- ui ---
    u_beams:      'assets/u_beams.png',
    u_lock:       'assets/u_lock.png',
    u_msgbox:     'assets/u_msgbox.png',
    u_phone:      'assets/u_phone.png',
    u_phone_sanu: 'assets/u_phone_sanu.png',
    u_portal2:    'assets/u_portal2.png',
    p_nuran_face: 'assets/p_nuran_face.png',
    p_sanu_face:  'assets/p_sanu_face.png'
  };

  var IMG = Object.create(null);
  var loaded = 0;
  var total = 0;

  /* ---------------- cached glow sprites ---------------- */
  var glowCache = Object.create(null);
  function glow(color, size) {
    var key = color + '|' + size;
    var c = glowCache[key];
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = size * 2;
    var cc = c.getContext('2d');
    var g = cc.createRadialGradient(size, size, 1, size, size, size);
    g.addColorStop(0, color);
    g.addColorStop(0.55, color.replace(/[\d.]+\)$/, '0.28)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cc.fillStyle = g;
    cc.beginPath();
    cc.arc(size, size, size, 0, Math.PI * 2);
    cc.fill();
    glowCache[key] = c;
    return c;
  }

  /** draw a cached glow sprite centred at (x,y) with radius r */
  function blitGlow(ctx, color, x, y, r, alpha) {
    var c = glow(color, 64);
    var a = alpha === undefined ? 1 : alpha;
    if (a <= 0) return;
    var prev = ctx.globalAlpha;
    ctx.globalAlpha = prev * a;
    ctx.drawImage(c, x - r, y - r, r * 2, r * 2);
    ctx.globalAlpha = prev;
  }

  /* ---------------- loading ---------------- */
  function loadOne(key, onProgress) {
    return new Promise(function (resolve) {
      var img = new Image();
      var done = false;
      function finish(ok) {
        if (done) return;
        done = true;
        IMG[key] = ok ? img : null;
        loaded++;
        if (onProgress) onProgress(loaded / total, key);
        resolve();
      }
      img.decoding = 'async';
      img.onload = function () { finish(true); };
      img.onerror = function () {
        console.warn('[assets] failed:', key, MANIFEST[key]);
        finish(false);
      };
      // never let one slow file block the boot forever
      setTimeout(function () { if (!done) { console.warn('[assets] timeout:', key); finish(false); } }, 12000);
      img.src = MANIFEST[key];
    });
  }

  function load(onProgress) {
    var names = Object.keys(MANIFEST);
    total = names.length;
    loaded = 0;
    return Promise.all(names.map(function (key) { return loadOne(key, onProgress); }));
  }

  function img(key) { return IMG[key] || null; }
  function has(key) { return !!IMG[key]; }

  function size(key) {
    var i = IMG[key];
    return i ? { w: i.naturalWidth || i.width, h: i.naturalHeight || i.height } : { w: 32, h: 32 };
  }

  /** draw an image anchored at bottom-centre, scaled by s */
  function blit(ctx, key, cx, bottomY, s, flip, alpha) {
    var i = IMG[key];
    if (!i) return;
    s = s || 1;
    var w = (i.naturalWidth || i.width) * s;
    var h = (i.naturalHeight || i.height) * s;
    var prev = ctx.globalAlpha;
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = prev * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, bottomY);
      ctx.scale(-1, 1);
      ctx.drawImage(i, -w / 2, -h, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(i, cx - w / 2, bottomY - h, w, h);
    }
    ctx.globalAlpha = prev;
  }

  /** draw anchored at bottom-centre, scaled so the sprite is `targetH` px tall */
  function blitH(ctx, key, cx, bottomY, targetH, flip, alpha, maxW) {
    var i = IMG[key];
    if (!i) return;
    var nw = i.naturalWidth || i.width;
    var nh = i.naturalHeight || i.height;
    if (!nw || !nh) return;
    var s = targetH / nh;
    if (maxW && nw * s > maxW) s = maxW / nw;
    var w = nw * s, h = nh * s;
    var prev = ctx.globalAlpha;
    if (alpha !== undefined && alpha !== 1) ctx.globalAlpha = prev * alpha;
    if (flip) {
      ctx.save();
      ctx.translate(cx, bottomY);
      ctx.scale(-1, 1);
      ctx.drawImage(i, -w / 2, -h, w, h);
      ctx.restore();
    } else {
      ctx.drawImage(i, cx - w / 2, bottomY - h, w, h);
    }
    ctx.globalAlpha = prev;
  }

  function aspect(key) {
    var i = IMG[key];
    if (!i) return 0.5;
    var nh = i.naturalHeight || i.height;
    return nh ? (i.naturalWidth || i.width) / nh : 0.5;
  }

  global.Assets = {
    MANIFEST: MANIFEST,
    load: load, img: img, has: has, size: size,
    blit: blit, blitH: blitH, aspect: aspect,
    glow: glow, blitGlow: blitGlow,
    get total() { return total; }
  };
})(window);
