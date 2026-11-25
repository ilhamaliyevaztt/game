/* ============================================================
   entities.js — Nuran (player), enemies, items, Sanu (npc), bullets
   world coords: x = centre, y = feet
   ------------------------------------------------------------
   Performance contract:
   · glow FX are cached canvases (Assets.blitGlow) — no gradient
     allocation inside the render loop
   · NO ctx.shadowBlur in the hot path: it forces a blurred
     off-screen pass per sprite (replaced by cached glows)
   · no ctx.filter anywhere
   ------------------------------------------------------------
   Combat contract:
   · the player can always fight: 0 ammo = weak melee (no softlock)
   · hazard damage comes from the difficulty profile
   Stealth contract:
   · every loud action raises player.noise; sleepers wake up
     when noise reaches them
   ============================================================ */
(function (global) {
  'use strict';

  var GRAV = 2250;
  var MAX_FALL = 1250;
  var JUMP_V = 790;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ------------------------------------------------------------
     base body
     ------------------------------------------------------------ */
  function Body(x, y, w, h) {
    this.x = x; this.y = y;
    this.w = w; this.h = h;
    this.vx = 0; this.vy = 0;
    this.onGround = false;
    this.facing = 1;
    this.dead = false;
    this.hitFlash = 0;
  }
  Body.prototype.box = function () {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  };

  function moveAndCollide(ent, solids, dt) {
    dt = Math.min(dt, 0.05);
    var i, s, box;

    // ---- X ----
    ent.x += ent.vx * dt;
    box = ent.box();
    for (i = 0; i < solids.length; i++) {
      s = solids[i];
      if (s.oneway) continue;                 // one-way ledges never block horizontally
      if (overlap(box, s)) {
        if (ent.vx > 0) ent.x = s.x - ent.w / 2 - 0.01;
        else if (ent.vx < 0) ent.x = s.x + s.w + ent.w / 2 + 0.01;
        ent.vx = 0;
        box = ent.box();
      }
    }

    // ---- Y ----
    var prevFeet = ent.y;
    ent.y += ent.vy * dt;
    ent.onGround = false;
    box = ent.box();
    for (i = 0; i < solids.length; i++) {
      s = solids[i];
      if (s.oneway) {
        if (ent.vy < 0) continue;             // jumping up: pass through
        if (prevFeet > s.y + 2) continue;     // already below it
      }
      if (overlap(box, s)) {
        if (ent.vy > 0) {
          ent.y = s.y;
          ent.vy = 0;
          ent.onGround = true;
        } else if (ent.vy < 0 && !s.oneway) {
          ent.y = s.y + s.h + ent.h;
          ent.vy = 0;
        }
        box = ent.box();
      }
    }
    if (ent.y > 900) ent.dead = true;
  }

  /* ------------------------------------------------------------
     PLAYER — Nuran
     ------------------------------------------------------------ */
  var HEIGHT = 64;
  var CROUCH_H = 40;

  function Player(x, y, diff) {
    Body.call(this, x, y, 26, HEIGHT);
    this.diff = diff || { hearts: 5, dmgMul: 1, ammoMul: 1, coinMul: 1, scoreMul: 1 };
    this.maxHp = this.diff.hearts || 5;
    this.hp = this.maxHp;
    this.ammo = 0;
    this.weaponId = 'pistol';
    this.hasShotgun = false;
    this.keys = 0;
    this.coins = 0;
    this.invuln = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.anim = 0;
    this.state = 'idle';
    this.crouch = false;
    this.shootCd = 0;
    this.shootAnim = 0;
    this.meleeCd = 0;
    this.meleeAnim = 0;
    this.stepTimer = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.shield = 0;
    this.lanternT = 0;
    this.coffeeT = 0;
    this.noise = 0;
    this.flareT = 0;
    this.mirrorDelay = [];
    this.dashCd = 0;
    this.dashT = 0;
    this.airJumps = 0;
  }
  Player.prototype = Object.create(Body.prototype);

  /** the weapon currently in the player's hands (never null) */
  Player.prototype.weapon = function () {
    var W = global.Weapons;
    return W ? W.get(this.weaponId) : { id: 'pistol', dmg: 1, cd: 0.25, pellets: 1, spread: 0, speed: 1060, range: 470, cost: 1, knock: 30, noise: 0.4, shake: 2.6, color: '#ffe6b8', bullet: 'small', sfx: 'shoot' };
  };


  /** loud actions feed the stealth meter and wake sleepers nearby */
  Player.prototype.makeNoise = function (amount, game) {
    if (amount <= 0) return;
    this.noise = Math.min(1, this.noise + amount * (this.diff.noiseMul || 1));
    if (game && game.alertNearby) game.alertNearby(this.x, this.noise);
  };

  Player.prototype.update = function (dt, game) {
    var inp = game.input;
    var solids = game.solids;
    var st = inp.state;

    if (!this.alive) {
      this.deathTimer += dt;
      this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
      moveAndCollide(this, solids, dt);
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.shootAnim = Math.max(0, this.shootAnim - dt);
    this.meleeCd = Math.max(0, this.meleeCd - dt);
    this.meleeAnim = Math.max(0, this.meleeAnim - dt);
    this.lanternT = Math.max(0, this.lanternT - dt);
    this.coffeeT = Math.max(0, this.coffeeT - dt);
    this.flareT = Math.max(0, this.flareT - dt);
    this.noise = Math.max(0, this.noise - dt * 0.34);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    /* ---- crouch (never stand up into a ceiling) ---- */
    var wantsCrouch = !!st.down && this.onGround;
    if (wantsCrouch) {
      this.crouch = true;
    } else if (this.crouch) {
      var headY = this.y - HEIGHT;
      var blocked = game.solidAt(this.x - this.w / 2, headY) || game.solidAt(this.x + this.w / 2, headY);
      if (!blocked) this.crouch = false;
    }
    var hTarget = this.crouch ? CROUCH_H : HEIGHT;
    if (Math.abs(this.h - hTarget) > 0.5) {
      this.h += (hTarget - this.h) * Math.min(1, dt * 22);
    }

    /* ---- horizontal ---- */
    var speed = st.run ? 272 : 172;
    if (this.coffeeT > 0) speed *= 1.22;
    if (this.crouch) speed = 96;
    var dir = 0;
    if (st.left) dir -= 1;
    if (st.right) dir += 1;

    var accel = this.onGround ? 2100 : 1350;
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      if (Math.abs(this.vx) > speed) this.vx = speed * (this.vx > 0 ? 1 : -1);
      this.facing = dir;
    } else {
      var fr = (this.onGround ? 2400 : 700) * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= (this.vx > 0 ? 1 : -1) * fr;
    }

    /* ---- coyote time + jump buffer ---- */
    if (this.onGround) this.coyote = 0.11;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (st.jumpPressed) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if (this.jumpBuf > 0 && this.coyote > 0 && !this.crouch) {
      this.vy = -JUMP_V;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.onGround = false;
      Audio2.play('jump');
      game.spawnDust(this.x, this.y, 5);
    }
    // variable jump height
    if (!st.jump && this.vy < -220) this.vy += 2200 * dt;

    this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);

    var wasAir = !this.onGround;
    var prevVy = this.vy;
    moveAndCollide(this, solids, dt);

    if (this.onGround && wasAir && prevVy > 260) {
      Audio2.play('land');
      game.spawnDust(this.x, this.y, 6);
      game.shake(2.2);
      this.makeNoise(prevVy > 700 ? 0.30 : 0.15, game);
    }

    /* ---- footsteps ---- */
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.stepTimer -= dt * (Math.abs(this.vx) / 160);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        Audio2.play(Math.abs(this.vx) > 200 ? 'step_wet' : 'step');
        // running (not walking) is what wakes the room up
        if (Math.abs(this.vx) > 210) this.makeNoise(0.14, game);
      }
    }

    /* ---- surface hazards ---- */
    for (var i = 0; i < game.spikeRects.length; i++) {
      var sr = game.spikeRects[i];
      if (overlap(this.box(), sr)) {
        this.hurt((this.diff.hazardDmg || 1), game, this.x < sr.x + sr.w / 2 ? -1 : 1);
        break;
      }
    }

    /* ---- attack: the equipped weapon, or melee when the pool is dry ---- */
    if (st.fire && this.shootCd <= 0) {
      var wp = this.weapon();
      if (this.ammo >= wp.cost) {
        this.shootCd = wp.cd * (this.diff.fireRateMul || 1);
        this.ammo -= wp.cost;
        this.shootAnim = 0.18;
        var bx = this.x + this.facing * 26;
        var by = this.y - this.h * 0.62;
        var n = wp.pellets || 1;
        for (var k = 0; k < n; k++) {
          var off = n === 1 ? 0 : (k - (n - 1) / 2) * (wp.spread || 0) * 26;
          var vy = n === 1 ? 0 : (k - (n - 1) / 2) * (wp.spread || 0) * 620;
          if (n > 1) vy += (Math.random() - 0.5) * 40;
          game.fireBullet(bx, by + off * 0.16, this.facing, wp.dmg, wp, vy);
        }
        Audio2.play(wp.sfx || 'shoot');
        game.shake(wp.shake || 2.6);
        this.vx -= this.facing * (wp.knock || 20);
        this.makeNoise(wp.noise || 0.4, game);
        game.onShoot && game.onShoot(wp);
      } else {
        this.shootCd = 0.22;
        this._melee(game);
      }
    }

    /* ---- animation state ---- */
    if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.crouch) this.state = 'crouch';
    else if (Math.abs(this.vx) > 200) this.state = 'run';
    else if (Math.abs(this.vx) > 24) this.state = 'walk';
    else this.state = 'idle';

    this.anim += dt * (this.state === 'run' ? 13 : this.state === 'walk' ? 9 : 4);

    if (this.y > 760) this.hurt(this.maxHp + 1, game, 0, true);
  };

  /** short-range strike used when out of ammo — the run can never softlock */
  Player.prototype._melee = function (game) {
    if (this.meleeCd > 0) return;
    this.meleeCd = 0.40;
    this.meleeAnim = 0.22;
    this.shootAnim = 0.12;
    Audio2.play('hit');
    game.shake(2.4);
    var reach = 74;
    var cx = this.x + this.facing * reach * 0.55;
    var cy = this.y - this.h * 0.55;
    var hitAny = false;
    var pb = this.box();
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.dead) continue;
      var eb = e.box();
      var dx = (eb.x + eb.w / 2) - cx;
      var dy = (eb.y + eb.h / 2) - cy;
      /* in front of me OR literally standing inside me — both count */
      var inFront = Math.abs(dx) < reach * 0.9 + eb.w / 2 && Math.abs(dy) < 54 + eb.h / 2;
      var inside = overlap(eb, pb);
      if (inFront || inside) {
        e.damage(2, game, this.x);
        hitAny = true;
      }
    }
    game.spawnBurst(cx, cy, hitAny ? '#ffd0a0' : '#8a7a86', hitAny ? 8 : 4);
    if (!hitAny) game.floatText(cx, cy - 10, 'zəif zərbə', '#9a8b95');
    else this.makeNoise(0.16, game);
  };

  Player.prototype.hurt = function (amount, game, knockDir, forceFall) {
    if (this.invuln > 0 || !this.alive) return;

    if (this.shield > 0 && !forceFall) {
      this.shield--;
      this.invuln = 0.85;
      Audio2.play('heal');
      game.spawnBurst(this.x, this.y - 34, '#8ad0ff', 14);
      game.toast('Qalxan zərbəni uddu' + (this.shield > 0 ? ' · ' + this.shield + ' qaldı' : ''), 'good');
      game.updateHud();
      return;
    }

    this.hp -= amount;
    this.invuln = 1.15 + (this.diff.invulnBonus || 0);
    this.hitFlash = 0.35;
    Audio2.play('hurt');
    game.shake(8);
    game.flash(0.5);
    if (knockDir && !forceFall) {
      this.vx = knockDir * 250;
      this.vy = -320;
    }
    if (forceFall) this.hp = 0;
    if (this.hp <= 0) {
      this.hp = 0;
      this.die(game);
    } else {
      game.toast('-' + amount + ' ürək', 'bad');
    }
    game.updateHud();
  };

  Player.prototype.heal = function (n) { this.hp = Math.min(this.maxHp, this.hp + n); };

  Player.prototype.die = function (game) {
    this.alive = false;
    this.deathTimer = 0;
    this.vx = 0;
    Audio2.play('death');
    game.onPlayerDeath();
  };

  Player.prototype.frame = function () {
    if (!this.alive) return 'nuran_a3';
    if (this.meleeAnim > 0) return 'nuran_shoot2';
    if (this.shootAnim > 0) return 'nuran_shoot2';
    if (this.state === 'crouch') return 'nuran_a0';
    if (this.state === 'jump') return 'nuran_a2';
    if (this.state === 'fall') return 'nuran_a3';
    if (this.state === 'run' || this.state === 'walk') return 'nuran_a' + (Math.floor(this.anim) % 4);
    return (Math.floor(this.anim * 0.5) % 2) === 0 ? 'nuran_a0' : 'nuran_a1';
  };

  Player.prototype.draw = function (ctx, game) {
    var key = this.frame();
    var h = this.crouch ? CROUCH_H : HEIGHT;
    var flick = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;

    ctx.save();
    if (flick) ctx.globalAlpha = 0.42;
    Assets.blitH(ctx, key, this.x, this.y + 2, h, this.facing < 0);
    ctx.restore();

    // hurt / speed aura — cached glow sprites, never shadowBlur
    if (this.hitFlash > 0) {
      Assets.blitGlow(ctx, 'rgba(255,40,60,0.55)', this.x, this.y - 32, 46, 1);
    } else if (this.coffeeT > 0) {
      Assets.blitGlow(ctx, 'rgba(255,210,120,0.30)', this.x, this.y - 30, 36, 1);
    }

    // shield bubble
    if (this.shield > 0) {
      var pulse = 0.35 + Math.sin(game.time * 4) * 0.12;
      ctx.save();
      ctx.strokeStyle = 'rgba(140,210,255,' + pulse + ')';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 32, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // lantern / ambient glow (cached sprite, no gradient alloc)
    var glowR = this.lanternT > 0 ? 250 : 160;
    if (game.darkness > 0.05 || this.lanternT > 0) {
      Assets.blitGlow(ctx, 'rgba(255,196,158,0.30)', this.x, this.y - 34, glowR, 1);
    }
  };

  /* ------------------------------------------------------------
     ENEMIES
     ------------------------------------------------------------ */
  var ENEMY_DEFS = {
    skull:        { spr: 'mon_skull',   w: 34, h: 76, hp: 3,  dmg: 1, speed: 56,  chase: 250, gravity: true,  drawH: 78, score: 1 },
    skullB:       { spr: 'mon_skull2',  w: 34, h: 76, hp: 4,  dmg: 1, speed: 62,  chase: 280, gravity: true,  drawH: 78, score: 1 },
    crawler:      { spr: 'mon_crawl',   w: 54, h: 46, hp: 2,  dmg: 1, speed: 100, chase: 330, gravity: true,  drawH: 46, score: 2 },
    crouch:       { spr: 'mon_crouch',  w: 52, h: 52, hp: 3,  dmg: 1, speed: 92,  chase: 350, gravity: true,  drawH: 54, score: 2 },
    hound:        { spr: 'mon_hound',   w: 50, h: 62, hp: 3,  dmg: 1, speed: 132, chase: 400, gravity: true,  drawH: 62, score: 3 },
    stalker:      { spr: 'mon_stalker', w: 38, h: 88, hp: 5,  dmg: 1, speed: 60,  chase: 310, gravity: true,  drawH: 90, score: 3 },
    horn:         { spr: 'mon_horn',    w: 44, h: 88, hp: 5,  dmg: 2, speed: 74,  chase: 380, gravity: true,  drawH: 92, score: 4 },
    lurk:         { spr: 'mon_lurk',    w: 70, h: 54, hp: 4,  dmg: 2, speed: 84,  chase: 340, gravity: true,  drawH: 58, score: 3 },
    shadow:       { spr: 'mon_shadow',  w: 34, h: 74, hp: 3,  dmg: 1, speed: 60,  chase: 440, gravity: false, drawH: 74, score: 3 },
    veil:         { spr: 'mon_veil',    w: 44, h: 80, hp: 5,  dmg: 2, speed: 74,  chase: 480, gravity: false, drawH: 82, score: 5 },
    sanu_corrupt: { spr: 'sanu_corrupt',w: 46, h: 92, hp: 22, dmg: 2, speed: 84,  chase: 900, gravity: true,  drawH: 96, score: 14, boss: true },
    eye2:         { spr: 'mon_eye2',    w: 74, h: 84, hp: 30, dmg: 2, speed: 72,  chase: 1000, gravity: false, drawH: 88, score: 20, boss: true, shooter: true },
    /* --- v5 additions --- */
    twin:         { spr: 'nuran_back',  w: 30, h: 64, hp: 6,  dmg: 1, speed: 0,   chase: 1400, gravity: false, drawH: 68, score: 6, mirror: true },
    sleeper:      { spr: 'mon_crouch',  w: 52, h: 52, hp: 3,  dmg: 1, speed: 96,  chase: 360, gravity: true,  drawH: 54, score: 2, dormant: true },

    /* --- v6 bestiary --- */
    warden:       { spr: 'mon_warden',  w: 40, h: 100, hp: 6, dmg: 2, speed: 66, chase: 420, gravity: true,  drawH: 104, score: 5, armored: 0.6 },
    drowned:      { spr: 'mon_drowned', w: 64, h: 82,  hp: 5, dmg: 2, speed: 84, chase: 380, gravity: true,  drawH: 84,  score: 4, slowOnHit: true },
    bell:         { spr: 'mon_bell',    w: 44, h: 100, hp: 5, dmg: 2, speed: 72, chase: 520, gravity: true,  drawH: 102, score: 5, shout: true },
    choir:        { spr: 'mon_choir',   w: 46, h: 92,  hp: 4, dmg: 2, speed: 78, chase: 560, gravity: false, drawH: 94,  score: 6, singer: true },
    brute:        { spr: 'mon_brute',   w: 78, h: 110, hp: 14, dmg: 3, speed: 56, chase: 460, gravity: true,  drawH: 112, score: 9, armored: 0.35 },
    spitter:      { spr: 'mon_spitter', w: 56, h: 70,  hp: 4, dmg: 2, speed: 62, chase: 640, gravity: true,  drawH: 72,  score: 5, spits: true },
    swarm:        { spr: 'mon_swarm',   w: 36, h: 34,  hp: 2, dmg: 1, speed: 150, chase: 620, gravity: false, drawH: 36, score: 2, erratic: true },
    shade:        { spr: 'mon_shade',   w: 40, h: 88,  hp: 5, dmg: 2, speed: 128, chase: 700, gravity: false, drawH: 90, score: 4, phasing: true },
    heart:        { spr: 'mon_heart',   w: 96, h: 118, hp: 52, dmg: 3, speed: 62, chase: 1200, gravity: false, drawH: 120, score: 40, boss: true, shooter: true, bossKind: 'heart' },
    bellboss:     { spr: 'mon_bellboss', w: 96, h: 146, hp: 44, dmg: 3, speed: 74, chase: 1150, gravity: true, drawH: 148, score: 36, boss: true, bossKind: 'bell', shout: true },
    bellkeeper:   { spr: 'mon_bellboss', w: 80, h: 120, hp: 22, dmg: 2, speed: 70, chase: 1000, gravity: true, drawH: 122, score: 18, miniBoss: true, bossKind: 'bell' }
  };

  function Enemy(cfg, diff) {
    var d = ENEMY_DEFS[cfg.type] || ENEMY_DEFS.skull;
    Body.call(this, cfg.x, cfg.y, d.w, d.h);
    diff = diff || { hpMul: 1, spdMul: 1, aggroMul: 1, dmgMul: 1 };
    this.type = cfg.type;
    this.def = d;
    this.baseSpeed = cfg.speed || d.speed;
    this.maxHp = Math.max(1, Math.round((cfg.hp || d.hp) * (diff.hpMul || 1)));
    this.hp = this.maxHp;
    this.speed = this.baseSpeed * (diff.spdMul || 1);
    this.dmg = Math.max(1, Math.round(d.dmg * (diff.dmgMul || 1)));
    this.chaseRange = d.chase * (diff.aggroMul || 1);
    this.patrolMin = cfg.patrol ? cfg.patrol[0] : cfg.x - 90;
    this.patrolMax = cfg.patrol ? cfg.patrol[1] : cfg.x + 90;
    this.dir = -1;
    this.anim = Math.random() * 4;
    this.aggro = false;
    this.attackCd = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.bob = Math.random() * 6.28;
    this.growlT = 1 + Math.random() * 4;
    this.shootT = 1.8 + Math.random() * 1.4;
    this.shoutT = 2.5 + Math.random() * 2;
    this.singT = 1.5 + Math.random() * 2;
    this.isBoss = !!(d.boss || cfg.boss);
    this.isMiniBoss = !!d.miniBoss;
    this.final = !!cfg.final;
    this.spawnX = cfg.x;
    this.touchCd = 0;
    this.phase = 1;
    /* mirror twin: replays the player's own path one second late */
    this.mirror = !!d.mirror;
    this.hist = null;
    this.histT = 0;
    /* sleeper: stays down until the room gets loud */
    this.dormant = !!cfg.dormant || !!d.dormant;
    this.awake = !this.dormant;
    this.sleepPulse = Math.random() * 6.28;
  }
  Enemy.prototype = Object.create(Body.prototype);

  /** called by the player's loud actions — proximity + volume matter */
  Enemy.prototype.wake = function (dist, noise) {
    if (!this.dormant || this.awake) return false;
    var reach = 120 + noise * 460;
    if (dist <= reach) {
      this.awake = true;
      this.dormant = false;
      this.aggro = true;
      this.hitFlash = 0.25;
      Audio2.play('growl');
      return true;
    }
    return false;
  };

  Enemy.prototype.update = function (dt, game) {
    var p = game.player;
    var solids = game.solids;
    var lvlW = game.level.width;

    this.anim += dt * (this.aggro ? 8 : 4);
    this.bob += dt * 1.6;
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // cull far-away non-boss AI work (performance)
    if (!this.isBoss && Math.abs(p.x - this.x) > 980) {
      if (this.def.gravity) {
        this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
        moveAndCollide(this, solids, dt);
      }
      return;
    }

    /* ---- mirror twin: replays the player's own trail, 0.9s late ---- */
    if (this.mirror) {
      this.histT += dt;
      if (this.histT > 0.05) {
        this.histT = 0;
        var trail = game.playerTrail;
        if (trail && trail.length) {
          var back = Math.min(trail.length - 1, Math.round(0.9 / 0.05));
          var pt = trail[trail.length - 1 - back];
          if (pt && isFinite(pt.x) && isFinite(pt.y)) {
            this.facing = pt.facing || this.facing;
            this.y = pt.y;
            this.x = pt.x - 34 * this.facing;
            this.anim = pt.anim || this.anim;
          }
        }
      }
      this.bob += dt;
      if (p.alive && this.attackCd <= 0 && overlap(this.box(), p.box())) {
        p.hurt(this.dmg, game, p.x > this.x ? 1 : -1);
        this.attackCd = 1.1;
      }
      return;
    }

    /* ---- sleeper: lies still until the room is loud enough ---- */
    if (this.dormant && !this.awake) {
      this.sleepPulse += dt * 1.4;
      if (this.def.gravity) {
        this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
        moveAndCollide(this, solids, dt);
      }
      return;
    }

    var dx = p.x - this.x;
    var dy = (p.y - p.h / 2) - (this.y - this.h / 2);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var sees = dist < this.chaseRange && p.alive;

    if (sees && !this.aggro) {
      this.aggro = true;
      if (!this.isBoss) Audio2.play('growl');
    }
    if (!sees && this.aggro && dist > this.chaseRange * 1.7) this.aggro = false;

    /* ---- boss phases: enrage under 50% / 25% hp ---- */
    if (this.isBoss) {
      var ratio = this.hp / this.maxHp;
      var wantPhase = ratio <= 0.25 ? 3 : ratio <= 0.5 ? 2 : 1;
      if (wantPhase !== this.phase) {
        this.phase = wantPhase;
        game.spawnBurst(this.x, this.y - this.h * 0.6, '#ff3355', 26);
        game.shake(7);
        game.flash(0.32);
        Audio2.play('dread');
        if (game.toast) {
          game.toast(wantPhase === 3 ? 'Kölgə son gücünü yığır' : 'Kölgə qəzəbləndi', 'bad');
        }
        this.speed = this.baseSpeed * (1 + (wantPhase - 1) * 0.22);
        this.shootT = Math.min(this.shootT, 1.0);
      }
    }

    if (this.def.gravity) {
      if (this.aggro) {
        var wantDir = dx > 0 ? 1 : -1;
        var spd = this.speed * (this.isBoss ? 1.0 : 1.25) * (dist < 110 ? 1.15 : 1);
        this.vx = wantDir * spd;
        this.facing = wantDir;
        // hop onto ledges when the player is above
        if (this.onGround && dy < -60 && dist < 300) {
          var ahead = game.solidAt(this.x + wantDir * 26, this.y - 8);
          if (ahead || dy < -110) this.vy = -700;
        }
      } else {
        if (this.x <= this.patrolMin) this.dir = 1;
        if (this.x >= this.patrolMax) this.dir = -1;
        var aheadX = this.x + this.dir * (this.w / 2 + 10);
        if (this.onGround && !game.solidBelow(aheadX, this.y + 6, 26)) this.dir *= -1;
        this.vx = this.dir * this.speed * 0.55;
        this.facing = this.dir;
      }
      // spitters keep their distance instead of diving in
      if (this.def.spits && this.aggro && Math.abs(dx) < 220) {
        this.vx = (dx > 0 ? -1 : 1) * this.speed * 0.8;
        this.facing = dx > 0 ? 1 : -1;
      }
      this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
      moveAndCollide(this, solids, dt);
      this.x = clamp(this.x, this.w / 2, lvlW - this.w / 2);
    } else {
      // floating enemies
      var sp = this.aggro ? this.speed * 1.3 : this.speed * 0.5;
      if (this.aggro) {
        var len = Math.max(1, dist);
        this.vx = (dx / len) * sp;
        this.vy = (dy / len) * sp * 0.8 + Math.sin(this.bob) * 16;
        if (this.def.erratic) {
          this.vx += Math.sin(this.bob * 3.1) * 90;
          this.vy += Math.cos(this.bob * 2.7) * 80;
        }
        this.facing = dx > 0 ? 1 : -1;
      } else {
        this.vx = Math.sin(this.bob * 0.6) * 20;
        this.vy = Math.sin(this.bob) * 14;
      }
      this.x = clamp(this.x + this.vx * dt, this.w / 2, lvlW - this.w / 2);
      this.y = clamp(this.y + this.vy * dt, 150, 560);
    }

    /* ---- spitter acid glob ---- */
    if (this.def.spits) {
      this.shootT -= dt;
      if (this.shootT <= 0 && dist < 620 && p.alive && this.aggro) {
        this.shootT = 2.0 + Math.random() * 1.2;
        var sang = Math.atan2((p.y - p.h * 0.5) - (this.y - this.h * 0.6), p.x - this.x);
        game.enemyBullets.push(new EnemyBullet(
          this.x + Math.cos(sang) * 20, this.y - this.h * 0.6,
          Math.cos(sang) * 360, Math.sin(sang) * 360, 'acid'
        ));
        Audio2.play('spit');
      }
    }

    /* ---- bell shout: stuns the player for a heartbeat ---- */
    if (this.def.shout) {
      this.shoutT = (this.shoutT || 3.5) - dt;
      if (this.shoutT <= 0 && dist < 380 && p.alive) {
        this.shoutT = 5.5 + Math.random() * 2.5;
        Audio2.play('bell');
        game.shake(6);
        game.flash(0.18);
        game.ringShock && game.ringShock(this.x, this.y - this.h * 0.6, 300);
        if (Math.abs(p.x - this.x) < 260) {
          p.vx = (p.x > this.x ? 1 : -1) * 380;
          p.vy = -280;
          p.hurt(1, game, (p.x > this.x ? 1 : -1));
        }
      }
    }

    /* ---- choir singer: buffs nearby enemies ---- */
    if (this.def.singer) {
      this.singT = (this.singT || 2) - dt;
      if (this.singT <= 0) {
        this.singT = 3.0;
        game.spawnBurst(this.x, this.y - this.h * 0.7, '#d8b8ff', 6);
        for (var q = 0; q < game.enemies.length; q++) {
          var mate = game.enemies[q];
          if (mate === this || mate.dead) continue;
          if (Math.abs(mate.x - this.x) < 340 && Math.abs(mate.y - this.y) < 220) {
            mate.speed = mate.baseSpeed * 1.22;
            mate.aggro = true;
          }
        }
      }
    }

    // boss teleport (never into a wall, never off the map)
    if (this.isBoss && !this.final) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && dist > 200 && dist < 780) {
        this.blinkT = 3.6 + Math.random() * 2.4;
        game.spawnBurst(this.x, this.y - this.h / 2, '#c4233a', 18);
        Audio2.play('portal');
        var side = dx > 0 ? -1 : 1;
        var tx = clamp(p.x + side * 150, 70, lvlW - 70);
        // find a floor to land on near the target x
        var ground = null;
        for (var si = 0; si < solids.length; si++) {
          var s = solids[si];
          if (tx >= s.x && tx <= s.x + s.w) { ground = s; break; }
        }
        if (ground) {
          this.x = tx;
          this.y = ground.y;
          this.vy = 0;
          game.spawnBurst(this.x, this.y - this.h / 2, '#e04158', 18);
        }
      }
    }

    // boss projectiles
    if (this.def.shooter) {
      this.shootT -= dt;
      if (this.shootT <= 0 && dist < 760 && p.alive) {
        this.shootT = 2.2 + Math.random() * 1.3;
        var ang = Math.atan2((p.y - p.h / 2) - (this.y - this.h / 2), p.x - this.x);
        game.enemyBullets.push(new EnemyBullet(
          this.x, this.y - this.h / 2,
          Math.cos(ang) * 285, Math.sin(ang) * 285
        ));
        Audio2.play('shoot');
      }
    }

    // ambient growl
    this.growlT -= dt;
    if (this.growlT <= 0 && dist < 420 && p.alive) {
      this.growlT = 4 + Math.random() * 6;
      Audio2.play('growl');
    }

    // contact damage
    if (p.alive && this.attackCd <= 0 && overlap(this.box(), p.box())) {
      p.hurt(this.dmg, game, dx > 0 ? -1 : 1);
      this.attackCd = 0.75;
    }

    if (this.y > 830) this.dead = true;
  };

  Enemy.prototype.damage = function (n, game, fromX) {
    if (this.dead) return;
    /* heavy bodies soak part of the damage instead of ignoring it */
    if (this.def.armored) n = Math.max(1, n * (1 - this.def.armored));
    this.hp -= n;
    this.hitFlash = 0.18;
    this.aggro = true;
    var push = this.x < fromX ? -1 : 1;
    if (!this.isBoss) this.x += push * 5;
    Audio2.play('hit');
    game.spawnBurst(this.x, this.y - this.h * 0.6, '#c4233a', 7);
    if (this.def.slowOnHit) {
      this.speed = Math.max(20, this.speed * 0.86);
      this.slowT = 1.4;
    }
    if (this.hp <= 0) {
      this.dead = true;
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#7a1020', 22);
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#e04158', 10);
      Audio2.play('death');
      game.shake(5);
      game.addScore(this.def.score * 10);
      var dm = game.diff || {};
      if (Math.random() < 0.62 * (dm.coinMul || 1)) game.dropCoin(this.x, this.y - 20);
      if (Math.random() < 0.12 * (dm.medDropMul || 1)) game.dropItemAt('medkit', this.x, this.y - 20);
      if (Math.random() < 0.2) game.dropItemAt('ammo', this.x + 14, this.y - 20);
      if (this.isBoss || this.def.miniBoss) {
        // a dead boss always leaves resupply so the next fight is winnable
        game.dropItemAt('ammo', this.x - 26, this.y - 20);
        game.dropItemAt('ammo', this.x + 26, this.y - 20);
        game.dropItemAt('medkit', this.x, this.y - 20);
        if (this.isBoss) game.onBossDown(this);
      }
      if (game.onEnemyKilled) game.onEnemyKilled(this);
    }
  };

  Enemy.prototype.draw = function (ctx, game) {
    var d = this.def;
    var bobY = d.gravity ? 0 : Math.sin(this.bob) * 6;

    /* sleeping enemies are drawn dimmer and further back */
    var dormantAlpha = 1;
    if (this.dormant && !this.awake) dormantAlpha = 0.34 + Math.sin(this.sleepPulse) * 0.07;

    ctx.save();
    ctx.globalAlpha = dormantAlpha;
    Assets.blitH(ctx, d.spr, this.x, this.y + 2 + bobY, d.drawH, this.facing < 0);
    ctx.restore();

    // eye glow (cached sprite — no per-frame gradient)
    var ex = this.x + this.facing * (d.gravity ? 5 : 0);
    var ey = this.y - this.h * (this.isBoss ? 0.78 : 0.72) + bobY;
    var rad = this.isBoss ? 30 : 13;
    var glowCol = this.mirror ? 'rgba(120,190,255,0.42)'
      : (this.dormant && !this.awake) ? 'rgba(120,80,90,0.22)'
      : this.def.phasing ? 'rgba(90,170,255,0.5)'
      : this.def.singer ? 'rgba(200,150,255,0.45)'
      : 'rgba(255,60,70,0.55)';
    Assets.blitGlow(ctx, glowCol, ex, ey, rad, 1);

    /* mirror twin: a thin blue echo outline */
    if (this.mirror) {
      Assets.blitGlow(ctx, 'rgba(90,150,255,0.16)', this.x, this.y - this.h * 0.5, 62, 1);
    }

    // hp bar
    if (this.hp < this.maxHp || this.isBoss) {
      var bw = this.isBoss ? 110 : 44;
      var bx = this.x - bw / 2;
      var by = this.y - this.h - 16;
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = this.isBoss ? '#e04158' : '#a81b2e';
      ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 5);
      /* boss phase ticks so the player can read the enrage */
      if (this.isBoss) {
        ctx.fillStyle = 'rgba(255,255,255,.45)';
        ctx.fillRect(bx + bw * 0.5, by - 3, 1, 11);
        ctx.fillRect(bx + bw * 0.25, by - 3, 1, 11);
      }
    }
  };

  /* ------------------------------------------------------------
     ITEMS
     ------------------------------------------------------------ */
  function Item(cfg) {
    this.type = cfg.type;
    this.x = cfg.x;
    this.y = cfg.y;
    this.w = 24; this.h = 24;
    this.bob = Math.random() * 6.28;
    this.icon = cfg.icon || null;
    this.title = cfg.title || null;
    this.lines = cfg.lines || null;
    this.jid = cfg.jid || null;
    this.id = cfg.id || null;
    this.cid = cfg.cid || null;
    this.prompt = cfg.prompt || null;
    this.options = cfg.options || null;
    this.used = false;
  }
  Item.prototype.box = function () {
    return { x: this.x - 18, y: this.y - 36, w: 36, h: 40 };
  };
  Item.prototype.update = function (dt) { this.bob += dt * 2.4; };

  Item.prototype.sprite = function () {
    switch (this.type) {
      case 'coin': return 'i_coin';
      case 'ammo': return 'i_bullets';
      case 'medkit': return 'i_medkit';
      case 'key': return 'i_key';
      case 'gem': return 'i_gem';
      case 'potion': return 'i_potion';
      case 'grenade': return 'i_grenade';
      case 'shotgun': return 'i_shotgun';
      case 'photo': return this.icon || 'i_photo';
      case 'note': return this.icon || 'i_scroll';
      case 'phone': return this.icon || 'u_phone';
      case 'flower': return 'i_gem';
      case 'choice': return this.icon || 'u_question';
      case 'lever': return 'u_lock';
      case 'memory': return this.icon || 'i_letter';
      default: return 'i_coin';
    }
  };

  Item.prototype.big = function () {
    return this.type === 'photo' || this.type === 'note' ||
      this.type === 'phone' || this.type === 'choice' || this.type === 'lever';
  };

  Item.prototype.draw = function (ctx, game) {
    var sp = this.sprite();
    var y = this.y - 20 + Math.sin(this.bob) * 4;
    var big = this.big();
    var s = this.type === 'coin' ? 0.85 : (big ? 0.62 : 0.95);
    var col = this.type === 'coin' ? 'rgba(201,162,39,0.32)'
      : this.type === 'medkit' ? 'rgba(220,70,70,0.30)'
      : this.type === 'key' ? 'rgba(230,200,90,0.36)'
      : this.type === 'ammo' ? 'rgba(230,170,90,0.28)'
      : this.type === 'choice' ? 'rgba(120,190,255,0.34)'
      : this.type === 'lever' ? 'rgba(255,190,90,0.40)'
      : 'rgba(200,120,150,0.26)';
    var pulse = (this.type === 'choice' || this.type === 'lever')
      ? 0.75 + Math.sin(this.bob * 1.6) * 0.25 : 1;
    Assets.blitGlow(ctx, col, this.x, y, this.type === 'choice' ? 40 : 26, pulse);
    Assets.blit(ctx, sp, this.x, y + 12, s, false);
    /* a decision point gets a slow ring so the eye finds it */
    if (this.type === 'choice' && game && !game.settings.lowFx) {
      ctx.save();
      ctx.globalAlpha = 0.30 + Math.sin(this.bob * 1.4) * 0.12;
      ctx.strokeStyle = 'rgba(150,205,255,0.9)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(this.x, y + 4, 22 + Math.sin(this.bob * 1.4) * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  };

  /* ------------------------------------------------------------
     NPC — Sanu
     ------------------------------------------------------------ */
  function Npc(cfg) {
    this.kind = cfg.kind || 'sanu';
    this.sprite = cfg.sprite || 'sanu_a0';
    this.x = cfg.x;
    this.y = cfg.y;
    this.scale = cfg.s || 1.0;
    this.talk = cfg.talk || [];
    this.after = cfg.after || null;
    this.final = !!cfg.final;
    this.gift = !!cfg.gift;
    this.needsBoss = !!cfg.needsBoss;
    this.choiceAfter = cfg.choiceAfter || null;
    this.gifted = false;
    this.talked = false;
    this.anim = Math.random() * 3;
    this.fade = 1;
    this.ghostT = 0;
  }
  Npc.prototype.update = function (dt) {
    this.anim += dt;
    if (this.final) {
      this.ghostT += dt;
      this.fade = 0.82 + Math.sin(this.ghostT * 1.6) * 0.12;
    }
  };
  Npc.prototype.near = function (p) {
    return Math.abs(p.x - this.x) < 96 && Math.abs(p.y - this.y) < 140;
  };
  /** true while this npc may be interacted with */
  Npc.prototype.available = function (game) {
    if (this.needsBoss && !game.bossDown) return false;
    if (this.choiceAfter && game && game.hasAnswered && game.hasAnswered(this.choiceAfter.cid)) {
      return this.gift ? true : !this.talked;
    }
    return true;
  };
  Npc.prototype.draw = function (ctx, game) {
    var ghost = this.final;
    ctx.save();
    if (ghost) ctx.globalAlpha = this.fade;
    Assets.blitH(ctx, this.sprite, this.x, this.y + 2, 72 * this.scale, false);
    ctx.restore();
    if (ghost) {
      Assets.blitGlow(ctx, 'rgba(220,20,50,0.24)', this.x, this.y - 50, 110, 1);
    } else {
      Assets.blitGlow(ctx, 'rgba(255,210,220,0.10)', this.x, this.y - 40, 90, 1);
    }
  };

  /* ------------------------------------------------------------
     BULLETS
     ------------------------------------------------------------ */
  function Bullet(x, y, dir, power, wp, vy) {
    this.x = x; this.y = y;
    this.dir = dir;
    this.vy = vy || 0;
    wp = wp || {};
    this.speed = wp.speed || 980;
    this.range = wp.range || 470;          /* hard distance limit — never infinite */
    this.travelled = 0;
    this.power = power || 1;
    this.pierce = wp.pierce || 0;
    this.hitSet = null;
    this.color = wp.color || '#ffe6b8';
    this.kind = wp.bullet || 'small';
    this.dead = false;
    this.trail = [];
    this.life = 4;
  }
  Bullet.prototype.update = function (dt, game) {
    if (this.dead) return;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }

    var stepX = this.dir * this.speed * dt;
    var stepY = this.vy * dt;
    this.trail.push(this.x, this.y);
    if (this.trail.length > 14) { this.trail.shift(); this.trail.shift(); }
    this.x += stepX;
    this.y += stepY;
    this.travelled += Math.abs(stepX);

    /* ---- the shot dies at its maximum range ---- */
    if (this.travelled >= this.range) {
      this.dead = true;
      game.spawnBurst(this.x, this.y, this.color, 4);
      return;
    }

    var box = { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };

    for (var i = 0; i < game.solids.length; i++) {
      var s = game.solids[i];
      if (s.oneway) continue;                 // bullets pass through ledges
      if (box.x < s.x + s.w && box.x + box.w > s.x && box.y < s.y + s.h && box.y + box.h > s.y) {
        this.dead = true;
        game.spawnBurst(this.x, this.y, '#ffb070', 6);
        return;
      }
    }
    for (var j = 0; j < game.enemies.length; j++) {
      var e = game.enemies[j];
      if (e.dead) continue;
      var eb = e.box();
      if (box.x < eb.x + eb.w && box.x + box.w > eb.x && box.y < eb.y + eb.h && box.y + box.h > eb.y) {
        if (this.hitSet && this.hitSet[j]) continue;
        e.damage(this.power, game, this.x - this.dir * 10);
        if (this.pierce > 0) {
          this.hitSet = this.hitSet || {};
          this.hitSet[j] = 1;
          this.pierce--;
        } else {
          this.dead = true;
          return;
        }
      }
    }
  };
  Bullet.prototype.draw = function (ctx) {
    var len = this.kind === 'rifle' ? 22 : this.kind === 'void' ? 15 : 12;
    for (var i = 0; i < this.trail.length; i += 2) {
      var a = (i / 2 + 1) / (this.trail.length / 2);
      ctx.fillStyle = 'rgba(255,190,120,' + (a * 0.30) + ')';
      ctx.fillRect(this.trail[i] - 2, this.trail[i + 1] - 1.5, 4, 3);
    }
    if (this.kind === 'void') {
      Assets.blitGlow(ctx, 'rgba(160,110,255,0.55)', this.x, this.y, 26, 1);
      ctx.fillStyle = 'rgba(198,172,255,0.95)';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(this.x, this.y, 2.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.kind === 'rifle' ? 16 : 10;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - len / 2, this.y - 1.6, len, 3.2);
    ctx.restore();
  };

  /* enemy projectile */
  function EnemyBullet(x, y, vx, vy, kind) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.kind = kind || 'orb';
    this.life = 3.2; this.dead = false; this.r = this.kind === 'acid' ? 8 : 7;
    this.dmg = this.kind === 'acid' ? 2 : 1;
  }
  EnemyBullet.prototype.update = function (dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.kind === 'acid') this.vy += 520 * dt;
    var p = game.player;
    if (p.alive) {
      var b = p.box();
      if (this.x + this.r > b.x && this.x - this.r < b.x + b.w &&
          this.y + this.r > b.y && this.y - this.r < b.y + b.h) {
        p.hurt(this.dmg, game, this.vx > 0 ? 1 : -1);
        this.dead = true;
        game.spawnBurst(this.x, this.y, this.kind === 'acid' ? '#a8e260' : '#e04158', 10);
        game.splash && game.splash(this.x, this.y, this.kind === 'acid' ? '#a8e260' : '#e04158', 8);
        return;
      }
    }
    for (var i = 0; i < game.solids.length; i++) {
      var s = game.solids[i];
      if (s.oneway) continue;
      if (this.x > s.x && this.x < s.x + s.w && this.y > s.y && this.y < s.y + s.h) {
        this.dead = true;
        game.spawnBurst(this.x, this.y, this.kind === 'acid' ? '#7ea848' : '#a81b2e', 6);
        return;
      }
    }
    if (this.y > 800 || this.x < -60 || this.x > game.level.width + 60) this.dead = true;
  };
  EnemyBullet.prototype.draw = function (ctx, time) {
    var pulse = 0.8 + Math.sin((time || 0) * 9) * 0.2;
    Assets.blitGlow(ctx, 'rgba(255,45,70,0.45)', this.x, this.y, 18, pulse);
    ctx.save();
    ctx.fillStyle = 'rgba(226,54,80,' + pulse + ')';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,220,.9)';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r * 0.42, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  global.Ent = {
    Player: Player, Enemy: Enemy, Item: Item, Npc: Npc, Bullet: Bullet, EnemyBullet: EnemyBullet,
    overlap: overlap, Body: Body, moveAndCollide: moveAndCollide, ENEMY_DEFS: ENEMY_DEFS,
    PLAYER_H: HEIGHT, CROUCH_H: CROUCH_H
  };
})(window);
