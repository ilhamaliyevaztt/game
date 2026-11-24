/* ============================================================
   entities.js — Nuran (player), enemies, items, Sanu (npc), bullets
   world coords: x = centre, y = feet
   ------------------------------------------------------------
   Performance contract:
   · glow FX are cached canvases (Assets.blitGlow) — no gradient
     allocation inside the render loop
   · no ctx.filter anywhere (it forces a software pass per draw)
   ------------------------------------------------------------
   Combat contract:
   · the player can always fight: 0 ammo = weak melee (no softlock)
   · hazard damage comes from the difficulty profile
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
  }
  Player.prototype = Object.create(Body.prototype);

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
    }

    /* ---- footsteps ---- */
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.stepTimer -= dt * (Math.abs(this.vx) / 160);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        Audio2.play(Math.abs(this.vx) > 200 ? 'step_wet' : 'step');
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

    /* ---- attack: gun, or melee when the magazine is empty ---- */
    if (st.fire && this.shootCd <= 0) {
      if (this.ammo > 0) {
        this.shootCd = this.hasShotgun ? 0.5 : 0.25;
        this.ammo--;
        this.shootAnim = 0.18;
        if (this.hasShotgun) {
          game.fireBullet(this.x + this.facing * 30, this.y - this.h * 0.62, this.facing, 2);
          game.fireBullet(this.x + this.facing * 26, this.y - this.h * 0.55, this.facing, 1);
        } else {
          game.fireBullet(this.x + this.facing * 26, this.y - this.h * 0.62, this.facing, 1);
        }
        Audio2.play('shoot');
        game.shake(this.hasShotgun ? 4.2 : 2.6);
        this.vx -= this.facing * (this.hasShotgun ? 55 : 30);
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
    this.meleeCd = 0.45;
    this.meleeAnim = 0.22;
    this.shootAnim = 0.12;
    Audio2.play('hit');
    game.shake(2.4);
    var reach = 62;
    var cx = this.x + this.facing * reach * 0.55;
    var cy = this.y - this.h * 0.55;
    var hitAny = false;
    for (var i = 0; i < game.enemies.length; i++) {
      var e = game.enemies[i];
      if (e.dead) continue;
      var eb = e.box();
      var dx = (eb.x + eb.w / 2) - cx;
      var dy = (eb.y + eb.h / 2) - cy;
      if (Math.abs(dx) < reach * 0.75 + eb.w / 2 && Math.abs(dy) < 52 + eb.h / 2) {
        e.damage(1, game, this.x);
        hitAny = true;
      }
    }
    game.spawnBurst(cx, cy, hitAny ? '#ffd0a0' : '#8a7a86', hitAny ? 8 : 4);
    if (!hitAny) game.floatText(cx, cy - 10, 'zəif zərbə', '#9a8b95');
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
    if (this.hitFlash > 0) {
      ctx.shadowColor = 'rgba(255,40,60,.95)';
      ctx.shadowBlur = 20;
    } else if (this.coffeeT > 0) {
      ctx.shadowColor = 'rgba(255,210,120,.8)';
      ctx.shadowBlur = 12;
    }
    Assets.blitH(ctx, key, this.x, this.y + 2, h, this.facing < 0);
    ctx.restore();

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
    sanu_corrupt: { spr: 'sanu_corrupt',w: 46, h: 92, hp: 18, dmg: 2, speed: 80,  chase: 900, gravity: true,  drawH: 96, score: 14, boss: true },
    eye2:         { spr: 'mon_eye2',    w: 74, h: 84, hp: 24, dmg: 2, speed: 70,  chase: 1000, gravity: false, drawH: 88, score: 20, boss: true, shooter: true }
  };

  function Enemy(cfg, diff) {
    var d = ENEMY_DEFS[cfg.type] || ENEMY_DEFS.skull;
    Body.call(this, cfg.x, cfg.y, d.w, d.h);
    diff = diff || { hpMul: 1, spdMul: 1, aggroMul: 1, dmgMul: 1 };
    this.type = cfg.type;
    this.def = d;
    this.maxHp = Math.max(1, Math.round((cfg.hp || d.hp) * (diff.hpMul || 1)));
    this.hp = this.maxHp;
    this.speed = (cfg.speed || d.speed) * (diff.spdMul || 1);
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
    this.isBoss = !!d.boss;
    this.final = !!cfg.final;
    this.spawnX = cfg.x;
    this.touchCd = 0;
  }
  Enemy.prototype = Object.create(Body.prototype);

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

    var dx = p.x - this.x;
    var dy = (p.y - p.h / 2) - (this.y - this.h / 2);
    var dist = Math.sqrt(dx * dx + dy * dy);
    var sees = dist < this.chaseRange && p.alive;

    if (sees && !this.aggro) {
      this.aggro = true;
      if (!this.isBoss) Audio2.play('growl');
    }
    if (!sees && this.aggro && dist > this.chaseRange * 1.7) this.aggro = false;

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
        this.facing = dx > 0 ? 1 : -1;
      } else {
        this.vx = Math.sin(this.bob * 0.6) * 20;
        this.vy = Math.sin(this.bob) * 14;
      }
      this.x = clamp(this.x + this.vx * dt, this.w / 2, lvlW - this.w / 2);
      this.y = clamp(this.y + this.vy * dt, 150, 560);
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
    this.hp -= n;
    this.hitFlash = 0.18;
    this.aggro = true;
    var push = this.x < fromX ? -1 : 1;
    if (!this.isBoss) this.x += push * 5;
    Audio2.play('hit');
    game.spawnBurst(this.x, this.y - this.h * 0.6, '#c4233a', 7);
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
      if (this.isBoss) {
        // a dead boss always leaves resupply so the next fight is winnable
        game.dropItemAt('ammo', this.x - 26, this.y - 20);
        game.dropItemAt('ammo', this.x + 26, this.y - 20);
        game.dropItemAt('medkit', this.x, this.y - 20);
        game.onBossDown(this);
      }
    }
  };

  Enemy.prototype.draw = function (ctx, game) {
    var d = this.def;
    var bobY = d.gravity ? 0 : Math.sin(this.bob) * 6;

    ctx.save();
    if (this.hitFlash > 0) {
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 18;
    }
    Assets.blitH(ctx, d.spr, this.x, this.y + 2 + bobY, d.drawH, this.facing < 0);
    ctx.restore();

    // eye glow (cached sprite — no per-frame gradient)
    var ex = this.x + this.facing * (d.gravity ? 5 : 0);
    var ey = this.y - this.h * (this.isBoss ? 0.78 : 0.72) + bobY;
    var rad = this.isBoss ? 30 : 13;
    Assets.blitGlow(ctx, 'rgba(255,60,70,0.55)', ex, ey, rad, 1);

    // hp bar
    if (this.hp < this.maxHp || this.isBoss) {
      var bw = this.isBoss ? 110 : 44;
      var bx = this.x - bw / 2;
      var by = this.y - this.h - 16;
      ctx.fillStyle = 'rgba(0,0,0,.7)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 7);
      ctx.fillStyle = this.isBoss ? '#e04158' : '#a81b2e';
      ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 5);
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
      default: return 'i_coin';
    }
  };

  Item.prototype.draw = function (ctx) {
    var sp = this.sprite();
    var y = this.y - 20 + Math.sin(this.bob) * 4;
    var big = (this.type === 'photo' || this.type === 'note' || this.type === 'phone');
    var s = this.type === 'coin' ? 0.85 : (big ? 0.62 : 0.95);
    var col = this.type === 'coin' ? 'rgba(201,162,39,0.32)'
      : this.type === 'medkit' ? 'rgba(220,70,70,0.30)'
      : this.type === 'key' ? 'rgba(230,200,90,0.36)'
      : this.type === 'ammo' ? 'rgba(230,170,90,0.28)'
      : 'rgba(200,120,150,0.26)';
    Assets.blitGlow(ctx, col, this.x, y, 26, 1);
    Assets.blit(ctx, sp, this.x, y + 12, s, false);
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
    return true;
  };
  Npc.prototype.draw = function (ctx, game) {
    var ghost = this.final;
    ctx.save();
    if (ghost) {
      ctx.globalAlpha = this.fade;
      ctx.shadowColor = 'rgba(255,20,50,.85)';
      ctx.shadowBlur = 30;
    }
    Assets.blitH(ctx, this.sprite, this.x, this.y + 2, 72 * this.scale, false);
    ctx.restore();
    if (ghost) {
      Assets.blitGlow(ctx, 'rgba(220,20,50,0.22)', this.x, this.y - 50, 110, 1);
    } else {
      Assets.blitGlow(ctx, 'rgba(255,210,220,0.10)', this.x, this.y - 40, 90, 1);
    }
  };

  /* ------------------------------------------------------------
     BULLETS
     ------------------------------------------------------------ */
  function Bullet(x, y, dir, power) {
    this.x = x; this.y = y;
    this.dir = dir;
    this.speed = 980;
    this.life = 1.15;
    this.dead = false;
    this.power = power || 1;
    this.trail = [];
  }
  Bullet.prototype.update = function (dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.trail.push(this.x, this.y);
    if (this.trail.length > 12) { this.trail.shift(); this.trail.shift(); }
    this.x += this.dir * this.speed * dt;
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
        e.damage(this.power, game, this.x - this.dir * 10);
        this.dead = true;
        return;
      }
    }
  };
  Bullet.prototype.draw = function (ctx) {
    for (var i = 0; i < this.trail.length; i += 2) {
      var a = (i / 2 + 1) / (this.trail.length / 2);
      ctx.fillStyle = 'rgba(255,190,120,' + (a * 0.32) + ')';
      ctx.fillRect(this.trail[i] - 2, this.trail[i + 1] - 1.5, 4, 3);
    }
    ctx.save();
    ctx.shadowColor = '#ffcf8a';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffe6b8';
    ctx.fillRect(this.x - 7, this.y - 2, 14, 4);
    ctx.restore();
  };

  /* enemy projectile */
  function EnemyBullet(x, y, vx, vy) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.life = 3.2; this.dead = false; this.r = 7;
  }
  EnemyBullet.prototype.update = function (dt, game) {
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    var p = game.player;
    if (p.alive) {
      var b = p.box();
      if (this.x + this.r > b.x && this.x - this.r < b.x + b.w &&
          this.y + this.r > b.y && this.y - this.r < b.y + b.h) {
        p.hurt(1, game, this.vx > 0 ? 1 : -1);
        this.dead = true;
        game.spawnBurst(this.x, this.y, '#e04158', 10);
        return;
      }
    }
    for (var i = 0; i < game.solids.length; i++) {
      var s = game.solids[i];
      if (s.oneway) continue;
      if (this.x > s.x && this.x < s.x + s.w && this.y > s.y && this.y < s.y + s.h) {
        this.dead = true;
        game.spawnBurst(this.x, this.y, '#a81b2e', 6);
        return;
      }
    }
    if (this.y > 780 || this.x < -60 || this.x > game.level.width + 60) this.dead = true;
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
