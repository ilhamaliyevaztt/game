/* ============================================================
   entities.js — player, enemies, items, npcs, bullets
   world coords: x = centre, y = feet
   ============================================================ */
(function (global) {
  'use strict';

  var GRAV = 2250;
  var MAX_FALL = 1250;

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
  Body.prototype.centre = function () {
    return { x: this.x, y: this.y - this.h / 2 };
  };

  function moveAndCollide(ent, solids, dt) {
    dt = Math.min(dt, 0.05);

    // ---- X ----
    ent.x += ent.vx * dt;
    var box = ent.box();
    for (var i = 0; i < solids.length; i++) {
      var s = solids[i];
      if (s.oneway) continue;           // one-way ledges never block horizontally
      if (overlap(box, s)) {
        if (ent.vx > 0) { ent.x = s.x - ent.w / 2 - 0.01; ent.hitWall = 1; }
        else if (ent.vx < 0) { ent.x = s.x + s.w + ent.w / 2 + 0.01; ent.hitWall = -1; }
        ent.vx = 0;
        box = ent.box();
      }
    }

    // ---- Y ----
    var prevFeet = ent.y;
    ent.y += ent.vy * dt;
    ent.onGround = false;
    box = ent.box();
    for (var j = 0; j < solids.length; j++) {
      var t = solids[j];
      if (t.oneway) {
        if (ent.vy < 0) continue;
        if (prevFeet > t.y + 2) continue;
      }
      if (overlap(box, t)) {
        if (ent.vy > 0) {
          ent.y = t.y;
          ent.vy = 0;
          ent.onGround = true;
        } else if (ent.vy < 0 && !t.oneway) {
          ent.y = t.y + t.h + ent.h;
          ent.vy = 0;
        }
        box = ent.box();
      }
    }
    if (ent.y > 900) ent.dead = true;
  }

  /* ------------------------------------------------------------
     PLAYER
     ------------------------------------------------------------ */
  function Player(x, y, diff) {
    Body.call(this, x, y, 26, 64);
    this.diff = diff || { hearts: 4, dmgMul: 1, ammoMul: 1, coinMul: 1, scoreMul: 1 };
    this.maxHp = this.diff.hearts || 4;
    this.hp = this.maxHp;
    this.ammo = 0;
    this.hasShotgun = false;
    this.keys = 0;
    this.coins = 0;              // coins collected during this run
    this.invuln = 0;
    this.coyote = 0;
    this.jumpBuf = 0;
    this.anim = 0;
    this.state = 'idle';
    this.crouch = false;
    this.shootCd = 0;
    this.shootAnim = 0;
    this.stepTimer = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.shield = 0;
    this.lanternT = 0;
    this.coffeeT = 0;
    this.skin = 'bdu';           // bdu | rain
  }
  Player.prototype = Object.create(Body.prototype);

  Player.prototype.update = function (dt, game) {
    var inp = game.input;
    var solids = game.solids;

    if (!this.alive) {
      this.deathTimer += dt;
      this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
      moveAndCollide(this, solids, dt);
      return;
    }

    this.invuln = Math.max(0, this.invuln - dt);
    this.shootCd = Math.max(0, this.shootCd - dt);
    this.shootAnim = Math.max(0, this.shootAnim - dt);
    this.lanternT = Math.max(0, this.lanternT - dt);
    this.coffeeT = Math.max(0, this.coffeeT - dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // crouch
    this.crouch = !!inp.state.down && this.onGround;
    var hTarget = this.crouch ? 40 : 64;
    if (Math.abs(this.h - hTarget) > 0.5) {
      this.h += (hTarget - this.h) * Math.min(1, dt * 22);
    }

    // horizontal
    var speed = inp.state.run ? 268 : 168;
    if (this.coffeeT > 0) speed *= 1.22;
    if (this.crouch) speed = 92;
    var dir = 0;
    if (inp.state.left) dir -= 1;
    if (inp.state.right) dir += 1;

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

    // coyote + jump buffer
    if (this.onGround) this.coyote = 0.11; else this.coyote = Math.max(0, this.coyote - dt);
    if (inp.state.jumpPressed) this.jumpBuf = 0.13;
    else this.jumpBuf = Math.max(0, this.jumpBuf - dt);

    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = -790;
      this.coyote = 0;
      this.jumpBuf = 0;
      this.onGround = false;
      Audio2.play('jump');
      game.spawnDust(this.x, this.y, 6);
    }

    // variable jump height
    if (!inp.state.jump && this.vy < -220) this.vy += 2200 * dt;

    this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);

    var wasAir = !this.onGround;
    var prevVy = this.vy;
    moveAndCollide(this, solids, dt);

    if (this.onGround && wasAir && prevVy > 260) {
      Audio2.play('land');
      game.spawnDust(this.x, this.y, 8);
      game.shake(2.5);
    }

    // footsteps
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.stepTimer -= dt * (Math.abs(this.vx) / 160);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        Audio2.play(Math.abs(this.vx) > 200 ? 'step_wet' : 'step');
        if (Math.abs(this.vx) > 200) game.spawnDust(this.x, this.y, 2);
      }
    }

    // surface hazards
    for (var i = 0; i < game.spikeRects.length; i++) {
      var sr = game.spikeRects[i];
      if (overlap(this.box(), sr)) {
        this.hurt(this.diff.dmgMul >= 1.4 ? 2 : 1, game, this.x < sr.x + sr.w / 2 ? -1 : 1);
        break;
      }
    }

    // shoot
    if (inp.state.fire && this.shootCd <= 0) {
      if (this.ammo > 0) {
        this.shootCd = this.hasShotgun ? 0.52 : 0.26;
        this.ammo--;
        this.shootAnim = 0.18;
        if (this.hasShotgun) {
          game.fireBullet(this.x + this.facing * 30, this.y - this.h * 0.62, this.facing, 2);
          game.fireBullet(this.x + this.facing * 26, this.y - this.h * 0.55, this.facing, 1);
        } else {
          game.fireBullet(this.x + this.facing * 26, this.y - this.h * 0.62, this.facing, 1);
        }
        Audio2.play('shoot');
        game.shake(this.hasShotgun ? 5 : 3.2);
        this.vx -= this.facing * (this.hasShotgun ? 60 : 34);
      } else {
        this.shootCd = 0.34;
        Audio2.play('empty');
        game.toast('Güllə yoxdur — mağazadan al', 'bad');
      }
    }

    // animation state
    if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.crouch) this.state = 'crouch';
    else if (Math.abs(this.vx) > 200) this.state = 'run';
    else if (Math.abs(this.vx) > 24) this.state = 'walk';
    else this.state = 'idle';

    this.anim += dt * (this.state === 'run' ? 13 : this.state === 'walk' ? 9 : 4);

    if (this.y > 760) this.hurt(this.maxHp + 1, game, 0, true);
  };

  Player.prototype.hurt = function (amount, game, knockDir, forceFall) {
    if (this.invuln > 0 || !this.alive) return;

    // shield absorbs a single hit
    if (this.shield > 0 && !forceFall) {
      this.shield--;
      this.invuln = 0.8;
      Audio2.play('heal');
      game.spawnBurst(this.x, this.y - 34, '#8ad0ff', 16);
      game.toast('Qalxan zərbəni uddu', 'good');
      game.updateHud();
      return;
    }

    this.hp -= amount;
    this.invuln = 1.15;
    this.hitFlash = 0.35;
    Audio2.play('hurt');
    game.shake(9);
    game.flash(0.55);
    if (knockDir && !forceFall) {
      this.vx = knockDir * 260;
      this.vy = -330;
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

  Player.prototype.heal = function (n) {
    this.hp = Math.min(this.maxHp, this.hp + n);
  };

  Player.prototype.die = function (game) {
    this.alive = false;
    this.deathTimer = 0;
    this.vx = 0;
    Audio2.play('death');
    game.onPlayerDeath();
  };

  Player.prototype.frame = function () {
    if (!this.alive) return 'leo_a3';
    if (this.shootAnim > 0) return 'leo_shoot2';
    if (this.state === 'crouch') return 'leo_a0';
    if (this.state === 'jump') return 'leo_a2';
    if (this.state === 'fall') return 'leo_a3';
    if (this.state === 'run' || this.state === 'walk') {
      var f = Math.floor(this.anim) % 4;
      return 'leo_a' + f;
    }
    return (Math.floor(this.anim * 0.5) % 2) === 0 ? 'leo_a0' : 'leo_a1';
  };

  Player.prototype.drawH = function () {
    if (this.state === 'crouch') return 40;
    return 64;
  };

  Player.prototype.draw = function (ctx, game) {
    var key = this.frame();
    var h = this.drawH();
    var flick = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;
    ctx.save();
    if (flick) ctx.globalAlpha = 0.42;
    if (this.hitFlash > 0) {
      ctx.shadowColor = 'rgba(255,40,60,.95)';
      ctx.shadowBlur = 22;
    }
    if (this.coffeeT > 0) {
      ctx.shadowColor = 'rgba(255,210,120,.8)';
      ctx.shadowBlur = 14;
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

    // lantern glow
    var glowR = this.lanternT > 0 ? 260 : 168;
    if (game.darkness > 0.05 || this.lanternT > 0) {
      var g = ctx.createRadialGradient(this.x, this.y - 34, 8, this.x, this.y - 34, glowR);
      g.addColorStop(0, 'rgba(255,205,170,.22)');
      g.addColorStop(0.45, 'rgba(255,150,120,.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 34, glowR, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* ------------------------------------------------------------
     ENEMIES
     ------------------------------------------------------------ */
  var ENEMY_DEFS = {
    skull:   { spr: 'mon_skull',  w: 34, h: 76, hp: 3,  dmg: 1, speed: 56,  chase: 250, gravity: true,  drawH: 78,  score: 1 },
    skullB:  { spr: 'mon_skull2', w: 34, h: 76, hp: 4,  dmg: 1, speed: 62,  chase: 280, gravity: true,  drawH: 78,  score: 1 },
    crawler: { spr: 'mon_crawl',  w: 54, h: 46, hp: 2,  dmg: 1, speed: 104, chase: 340, gravity: true,  drawH: 46,  score: 2 },
    crouch:  { spr: 'mon_crouch', w: 52, h: 52, hp: 3,  dmg: 1, speed: 96,  chase: 360, gravity: true,  drawH: 54,  score: 2 },
    hound:   { spr: 'mon_hound',  w: 50, h: 62, hp: 3,  dmg: 1, speed: 138, chase: 420, gravity: true,  drawH: 62,  score: 3 },
    stalker: { spr: 'mon_stalker',w: 38, h: 88, hp: 5,  dmg: 1, speed: 62,  chase: 320, gravity: true,  drawH: 90,  score: 3 },
    horn:    { spr: 'mon_horn',   w: 44, h: 88, hp: 5,  dmg: 2, speed: 78,  chase: 400, gravity: true,  drawH: 92,  score: 4 },
    lurk:    { spr: 'mon_lurk',   w: 70, h: 54, hp: 4,  dmg: 2, speed: 88,  chase: 360, gravity: true,  drawH: 58,  score: 3 },
    shadow:  { spr: 'mon_shadow', w: 34, h: 74, hp: 3,  dmg: 1, speed: 62,  chase: 460, gravity: false, drawH: 74,  score: 3 },
    veil:    { spr: 'mon_veil',   w: 44, h: 80, hp: 5,  dmg: 2, speed: 78,  chase: 520, gravity: false, drawH: 82,  score: 5 },
    bride:   { spr: 'mon_bride',  w: 44, h: 88, hp: 12, dmg: 1, speed: 74,  chase: 900, gravity: true,  drawH: 90,  score: 10, boss: true },
    alicecorrupt: { spr: 'alice_corrupt', w: 46, h: 92, hp: 16, dmg: 2, speed: 82, chase: 900, gravity: true, drawH: 96, score: 14, boss: true },
    eye2:    { spr: 'mon_eye2',   w: 74, h: 84, hp: 22, dmg: 2, speed: 70,  chase: 1000, gravity: false, drawH: 88, score: 20, boss: true, shooter: true }
  };

  function Enemy(cfg, diff) {
    var d = ENEMY_DEFS[cfg.type] || ENEMY_DEFS.skull;
    Body.call(this, cfg.x, cfg.y, d.w, d.h);
    diff = diff || { hpMul: 1, spdMul: 1, aggroMul: 1, dmgMul: 1 };
    this.type = cfg.type;
    this.def = d;
    this.maxHp = Math.max(1, Math.round((cfg.hp || d.hp) * diff.hpMul));
    this.hp = this.maxHp;
    this.speed = (cfg.speed || d.speed) * diff.spdMul;
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
    this.shootT = 1.6 + Math.random() * 1.4;
    this.isBoss = !!d.boss;
    this.final = !!cfg.final;
    this.spawnX = cfg.x;
  }
  Enemy.prototype = Object.create(Body.prototype);

  Enemy.prototype.update = function (dt, game) {
    var p = game.player;
    var solids = game.solids;
    this.anim += dt * (this.aggro ? 8 : 4);
    this.bob += dt * 1.6;
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // cull far-away non-boss AI work (performance)
    var farAway = Math.abs(p.x - this.x) > 900;
    if (farAway && !this.isBoss) {
      if (this.def.gravity) { this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL); moveAndCollide(this, solids, dt); }
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
        var spd = this.speed * (this.isBoss ? 1.0 : 1.28) * (dist < 110 ? 1.2 : 1);
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
    } else {
      // floating enemies
      var sp = this.aggro ? this.speed * 1.35 : this.speed * 0.5;
      if (this.aggro) {
        var len = Math.max(1, dist);
        this.vx = (dx / len) * sp;
        this.vy = (dy / len) * sp * 0.8 + Math.sin(this.bob) * 18;
        this.facing = dx > 0 ? 1 : -1;
      } else {
        this.vx = Math.sin(this.bob * 0.6) * 22;
        this.vy = Math.sin(this.bob) * 16;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.y = clamp(this.y, 120, 560);
    }

    // boss teleport
    if (this.isBoss && !this.final) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && dist > 200 && dist < 760) {
        this.blinkT = 3.4 + Math.random() * 2.4;
        game.spawnBurst(this.x, this.y - this.h / 2, '#c4233a', 22);
        Audio2.play('portal');
        var tx = p.x - (dx > 0 ? 1 : -1) * 140;
        this.x = clamp(tx, 60, game.level.width - 60);
        this.y = p.y;
        game.spawnBurst(this.x, this.y - this.h / 2, '#e04158', 22);
      }
    }

    // boss projectiles
    if (this.def.shooter) {
      this.shootT -= dt;
      if (this.shootT <= 0 && dist < 720 && p.alive) {
        this.shootT = 1.9 + Math.random() * 1.1;
        var a = Math.atan2((p.y - p.h / 2) - (this.y - this.h / 2), p.x - this.x);
        game.enemyBullets.push(new EnemyBullet(this.x, this.y - this.h / 2, Math.cos(a) * 300, Math.sin(a) * 300));
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
    if (overlap(this.box(), p.box()) && this.attackCd <= 0 && p.alive) {
      p.hurt(this.dmg, game, dx > 0 ? -1 : 1);
      this.attackCd = 0.7;
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
    game.spawnBurst(this.x, this.y - this.h * 0.6, '#c4233a', 9);
    if (this.hp <= 0) {
      this.dead = true;
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#7a1020', 26);
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#e04158', 12);
      Audio2.play('death');
      game.shake(6);
      game.addScore(this.def.score * 10);
      var dm = game.diff;
      if (Math.random() < 0.6 * (dm.coinMul || 1)) game.dropCoin(this.x, this.y - 20);
      if (Math.random() < 0.10 * (dm.medDropMul || 1)) game.dropItemAt('medkit', this.x, this.y - 20);
      if (Math.random() < 0.13) game.dropItemAt('ammo', this.x + 14, this.y - 20);
      if (this.isBoss) game.onBossDown(this);
    }
  };

  Enemy.prototype.draw = function (ctx, game) {
    var d = this.def;
    var bobY = d.gravity ? 0 : Math.sin(this.bob) * 6;
    ctx.save();
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 20;
    }
    Assets.blitH(ctx, d.spr, this.x, this.y + 2 + bobY, d.drawH, this.facing < 0);
    ctx.restore();

    // eye glow
    var ex = this.x + this.facing * (d.gravity ? 5 : 0);
    var ey = this.y - this.h * (this.isBoss ? 0.78 : 0.72) + bobY;
    var rad = this.isBoss ? 30 : 14;
    var g = ctx.createRadialGradient(ex, ey, 1, ex, ey, rad);
    g.addColorStop(0, 'rgba(255,60,70,.55)');
    g.addColorStop(1, 'rgba(255,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, rad, 0, Math.PI * 2);
    ctx.fill();

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
    this.portrait = cfg.portrait || null;
    this.icon = cfg.icon || null;
    this.title = cfg.title || null;
    this.lines = cfg.lines || null;
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
    var col = this.type === 'coin' ? 'rgba(201,162,39,.30)'
      : this.type === 'medkit' ? 'rgba(220,70,70,.28)'
      : this.type === 'key' ? 'rgba(230,200,90,.34)'
      : this.type === 'ammo' ? 'rgba(230,170,90,.26)'
      : 'rgba(200,120,150,.24)';
    var g = ctx.createRadialGradient(this.x, y, 1, this.x, y, 26);
    g.addColorStop(0, col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(this.x, y, 26, 0, Math.PI * 2);
    ctx.fill();
    Assets.blit(ctx, sp, this.x, y + 12, s, false);
  };

  /* ------------------------------------------------------------
     NPC (Alice)
     ------------------------------------------------------------ */
  function Npc(cfg) {
    this.kind = cfg.kind || 'alice';
    this.sprite = cfg.sprite || 'alice_a0';
    this.x = cfg.x;
    this.y = cfg.y;
    this.scale = cfg.s || 1.0;
    this.talk = cfg.talk || [];
    this.after = cfg.after || null;
    this.final = !!cfg.final;
    this.gift = !!cfg.gift;
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
    return Math.abs(p.x - this.x) < 96 && Math.abs(p.y - this.y) < 130;
  };
  Npc.prototype.draw = function (ctx) {
    ctx.save();
    if (this.final) {
      ctx.globalAlpha = this.fade;
      ctx.shadowColor = 'rgba(255,20,50,.85)';
      ctx.shadowBlur = 34;
    }
    Assets.blitH(ctx, this.sprite, this.x, this.y + 2, 72 * this.scale, false);
    ctx.restore();
    if (this.final) {
      var g = ctx.createRadialGradient(this.x, this.y - 50, 4, this.x, this.y - 50, 110);
      g.addColorStop(0, 'rgba(220,20,50,.20)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 50, 110, 0, Math.PI * 2);
      ctx.fill();
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
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 6) this.trail.shift();
    this.x += this.dir * this.speed * dt;
    var box = { x: this.x - 4, y: this.y - 4, w: 8, h: 8 };
    for (var i = 0; i < game.solids.length; i++) {
      var s = game.solids[i];
      if (box.x < s.x + s.w && box.x + box.w > s.x && box.y < s.y + s.h && box.y + box.h > s.y) {
        this.dead = true;
        game.spawnBurst(this.x, this.y, '#ffb070', 7);
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
    for (var i = 0; i < this.trail.length; i++) {
      var t = this.trail[i];
      var a = (i + 1) / this.trail.length;
      ctx.fillStyle = 'rgba(255,190,120,' + (a * 0.35) + ')';
      ctx.fillRect(t.x - 2, t.y - 1.5, 4, 3);
    }
    ctx.save();
    ctx.shadowColor = '#ffcf8a';
    ctx.shadowBlur = 14;
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
        game.spawnBurst(this.x, this.y, '#e04158', 12);
        return;
      }
    }
    for (var i = 0; i < game.solids.length; i++) {
      var s = game.solids[i];
      if (s.oneway) continue;
      if (this.x > s.x && this.x < s.x + s.w && this.y > s.y && this.y < s.y + s.h) {
        this.dead = true;
        game.spawnBurst(this.x, this.y, '#a81b2e', 8);
        return;
      }
    }
    if (this.y > 780 || this.x < -60 || this.x > game.level.width + 60) this.dead = true;
  };
  EnemyBullet.prototype.draw = function (ctx, time) {
    var pulse = 0.8 + Math.sin((time || 0) * 9) * 0.2;
    ctx.save();
    ctx.shadowColor = '#ff2b46';
    ctx.shadowBlur = 18;
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
    overlap: overlap, Body: Body, moveAndCollide: moveAndCollide, ENEMY_DEFS: ENEMY_DEFS
  };
})(window);
