/* ============================================================
   entities.js — player, enemies, items, npcs
   world coords: x = centre, y = feet
   ============================================================ */
(function (global) {
  'use strict';

  var GRAV = 2250;
  var MAX_FALL = 1250;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

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
        // only land on it when falling onto its top from above
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
  function Player(x, y) {
    Body.call(this, x, y, 26, 64);
    this.scale = 1.18;
    this.hp = 3; this.maxHp = 3;
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
    this.stepTimer = 0;
    this.landVy = 0;
    this.alive = true;
    this.deathTimer = 0;
    this.rollLock = 0;
  }
  Player.prototype = Object.create(Body.prototype);

  Player.prototype.update = function (dt, game) {
    var inp = game.input;
    var level = game.level;
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
    if (this.hitFlash > 0) this.hitFlash -= dt;

    // crouch
    this.crouch = !!inp.state.down && this.onGround;
    var hTarget = this.crouch ? 40 : 64;
    if (Math.abs(this.h - hTarget) > 0.5) {
      this.h += (hTarget - this.h) * Math.min(1, dt * 22);
    }

    // horizontal
    var speed = inp.state.run ? 268 : 168;
    if (this.crouch) speed = 92;
    var dir = 0;
    if (inp.state.left) dir -= 1;
    if (inp.state.right) dir += 1;

    var accel = this.onGround ? 2100 : 1350;
    if (dir !== 0) {
      this.vx += dir * accel * dt;
      if (Math.abs(this.vx) > speed) this.vx = speed * Math.sign(this.vx);
      this.facing = dir;
    } else {
      var fr = (this.onGround ? 2400 : 700) * dt;
      if (Math.abs(this.vx) <= fr) this.vx = 0;
      else this.vx -= Math.sign(this.vx) * fr;
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

    // gravity
    this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);

    var wasAir = !this.onGround;
    var prevVy = this.vy;
    moveAndCollide(this, solids, dt);

    if (this.onGround && wasAir && prevVy > 260) {
      Audio2.play('land');
      game.spawnDust(this.x, this.y, 8);
      if (game.settings.shake) game.shake(2.5);
    }

    // walking dust / steps
    if (this.onGround && Math.abs(this.vx) > 40) {
      this.stepTimer -= dt * (Math.abs(this.vx) / 160);
      if (this.stepTimer <= 0) {
        this.stepTimer = 0.34;
        Audio2.play(Math.abs(this.vx) > 200 ? 'step_wet' : 'step');
        if (Math.abs(this.vx) > 200) game.spawnDust(this.x, this.y, 2);
      }
    }

    // spikes (surface hazard)
    for (var i = 0; i < game.spikeRects.length; i++) {
      var sr = game.spikeRects[i];
      if (overlap(this.box(), sr)) {
        this.hurt(1, game, this.x < sr.x + sr.w / 2 ? -1 : 1);
        break;
      }
    }

    // shoot
    if (inp.state.fire && this.shootCd <= 0) {
      if (this.ammo > 0) {
        this.shootCd = this.hasShotgun ? 0.55 : 0.26;
        this.ammo--;
        this.shootAnim = 0.18;
        game.fireBullet(this.x + this.facing * 26, this.y - this.h * 0.62, this.facing);
        Audio2.play('shoot');
        if (game.settings.shake) game.shake(3.2);
        this.vx -= this.facing * 34;
      } else {
        this.shootCd = 0.34;
        Audio2.play('empty');
        game.toast('Güllə yoxdur', 'bad');
      }
    }

    // animation state
    if (!this.onGround) this.state = this.vy < 0 ? 'jump' : 'fall';
    else if (this.crouch) this.state = 'crouch';
    else if (Math.abs(this.vx) > 200) this.state = 'run';
    else if (Math.abs(this.vx) > 24) this.state = 'walk';
    else this.state = 'idle';

    this.anim += dt * (this.state === 'run' ? 13 : this.state === 'walk' ? 9 : 4);

    // fell off world
    if (this.y > 760) this.hurt(3, game, 0, true);
  };

  Player.prototype.hurt = function (amount, game, knockDir, forceFall) {
    if (this.invuln > 0 || !this.alive) return;
    this.hp -= amount;
    this.invuln = 1.15;
    this.hitFlash = 0.35;
    Audio2.play('hurt');
    if (game.settings.shake) game.shake(9);
    game.flash(0.55);
    if (knockDir && !forceFall) {
      this.vx = knockDir * 260;
      this.vy = -330;
    }
    if (forceFall) {
      this.hp = 0;
    }
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
    if (!this.alive) return 'leo_2';
    if (this.shootAnim > 0) return 'leo_5';
    if (this.state === 'crouch') return 'leo_small';
    if (this.state === 'jump') return 'leo_2';
    if (this.state === 'fall') return 'leo_3';
    if (this.state === 'run') {
      var f = Math.floor(this.anim) % 5;
      return 'leo_' + f;
    }
    if (this.state === 'walk') {
      var g2 = Math.floor(this.anim) % 5;
      return 'leo_' + g2;
    }
    return ((Math.floor(this.anim * 0.5) % 2) === 0) ? 'leo_0' : 'leo_1';
  };

  Player.prototype.draw = function (ctx, game) {
    var key = this.frame();
    var s = this.scale;
    var flick = this.invuln > 0 && Math.floor(this.invuln * 22) % 2 === 0;
    ctx.save();
    if (flick) ctx.globalAlpha = 0.4;
    if (this.hitFlash > 0) {
      ctx.shadowColor = 'rgba(255,40,60,.95)';
      ctx.shadowBlur = 22;
    }
    Assets.blit(ctx, key, this.x, this.y + 2, s, this.facing < 0);
    ctx.restore();

    // lantern glow around player
    if (game.darkness > 0.05) {
      var g = ctx.createRadialGradient(this.x, this.y - 34, 8, this.x, this.y - 34, 168);
      g.addColorStop(0, 'rgba(255,205,170,.20)');
      g.addColorStop(0.45, 'rgba(255,150,120,.07)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 34, 168, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  /* ------------------------------------------------------------
     ENEMIES
     ------------------------------------------------------------ */
  var ENEMY_DEFS = {
    skull: { w: 34, h: 76, hp: 3, dmg: 1, speed: 56, chase: 250, gravity: true, spriteScale: 1.12, frames: ['mon_skull', 'mon_skull2'], score: 1 },
    crawler: { w: 54, h: 46, hp: 2, dmg: 1, speed: 104, chase: 340, gravity: true, spriteScale: 1.4, frames: ['mon_crawl'], score: 2 },
    shadow: { w: 34, h: 74, hp: 3, dmg: 1, speed: 62, chase: 460, gravity: false, spriteScale: 1.2, frames: ['mon_shadow'], score: 3 },
    bride: { w: 44, h: 88, hp: 12, dmg: 1, speed: 74, chase: 900, gravity: true, spriteScale: 1.3, frames: ['mon_bride'], score: 10, boss: true }
  };

  function Enemy(cfg) {
    var d = ENEMY_DEFS[cfg.type] || ENEMY_DEFS.skull;
    Body.call(this, cfg.x, cfg.y, d.w, d.h);
    this.type = cfg.type;
    this.def = d;
    this.maxHp = cfg.hp || d.hp;
    this.hp = this.maxHp;
    this.speed = cfg.speed || d.speed;
    this.dmg = d.dmg;
    this.patrolMin = cfg.patrol ? cfg.patrol[0] : cfg.x - 90;
    this.patrolMax = cfg.patrol ? cfg.patrol[1] : cfg.x + 90;
    this.dir = -1;
    this.anim = Math.random() * 4;
    this.aggro = false;
    this.alertT = 0;
    this.attackCd = 0;
    this.blinkT = 2 + Math.random() * 3;
    this.bob = Math.random() * 6.28;
    this.homeY = cfg.y;
    this.growlT = 1 + Math.random() * 4;
    this.hoverPhase = 0;
  }
  Enemy.prototype = Object.create(Body.prototype);

  Enemy.prototype.update = function (dt, game) {
    var p = game.player;
    var solids = game.solids;
    this.anim += dt * (this.aggro ? 8 : 4);
    this.bob += dt * 1.6;
    this.attackCd = Math.max(0, this.attackCd - dt);
    if (this.hitFlash > 0) this.hitFlash -= dt;

    var dx = p.x - this.x;
    var dy = (p.y - p.h / 2) - (this.y - this.h / 2);
    var dist = Math.hypot(dx, dy);
    var sees = dist < this.def.chase && p.alive;

    if (sees && !this.aggro) {
      this.aggro = true;
      this.alertT = 0.6;
      if (!this.def.boss) Audio2.play('growl');
    }
    if (!sees && this.aggro && dist > this.def.chase * 1.7) {
      this.aggro = false;
    }

    if (this.def.gravity) {
      if (this.aggro) {
        // chase
        var wantDir = dx > 0 ? 1 : -1;
        var spd = this.speed * (this.def.boss ? 1.0 : 1.35) * (dist < 90 ? 1.25 : 1);
        this.vx = wantDir * spd;
        this.facing = wantDir;
        if (this.onGround && Math.abs(dy) > 90 && dist < 220 && this.def.boss === undefined) {
          // small hop toward player
          var solidAhead = game.solidAt(this.x + wantDir * 30, this.y - 6);
          if (solidAhead) this.vy = -560;
        }
      } else {
        // patrol
        if (this.x <= this.patrolMin) this.dir = 1;
        if (this.x >= this.patrolMax) this.dir = -1;
        // do not walk off a ledge
        var aheadX = this.x + this.dir * (this.w / 2 + 10);
        if (this.onGround && !game.solidBelow(aheadX, this.y + 6, 26)) this.dir *= -1;
        this.vx = this.dir * this.speed * 0.55;
        this.facing = this.dir;
      }
      this.vy = Math.min(this.vy + GRAV * dt, MAX_FALL);
      moveAndCollide(this, solids, dt);
    } else {
      // floating shadow
      var sp = this.aggro ? this.speed * 1.45 : this.speed * 0.5;
      if (this.aggro) {
        var len = Math.max(1, dist);
        this.vx = (dx / len) * sp;
        this.vy = (dy / len) * sp * 0.7 + Math.sin(this.bob) * 18;
        this.facing = dx > 0 ? 1 : -1;
      } else {
        this.vx = Math.sin(this.bob * 0.6) * 22;
        this.vy = Math.sin(this.bob) * 16;
      }
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.y = Math.max(120, Math.min(560, this.y));
    }

    // boss blink
    if (this.def.boss) {
      this.blinkT -= dt;
      if (this.blinkT <= 0 && dist > 180 && dist < 700) {
        this.blinkT = 3.2 + Math.random() * 2.4;
        game.spawnBurst(this.x, this.y - this.h / 2, '#c4233a', 22);
        Audio2.play('portal');
        var targetX = p.x - Math.sign(dx || 1) * 130;
        this.x = Math.max(60, Math.min(game.level.width - 60, targetX));
        this.y = p.y;
        game.spawnBurst(this.x, this.y - this.h / 2, '#e04158', 22);
      }
    }

    // growl ambience
    this.growlT -= dt;
    if (this.growlT <= 0 && dist < 420 && p.alive) {
      this.growlT = 4 + Math.random() * 6;
      Audio2.play('growl');
    }

    // touch damage
    if (overlap(this.box(), p.box()) && this.attackCd <= 0 && p.alive) {
      p.hurt(this.dmg, game, dx > 0 ? -1 : 1);
      this.attackCd = 0.7;
    }

    if (this.y > 830) this.dead = true;
  };

  Enemy.prototype.damage = function (n, game, fromX) {
    this.hp -= n;
    this.hitFlash = 0.18;
    this.aggro = true;
    var push = this.x < fromX ? -1 : 1;
    this.x += push * 5;
    Audio2.play('hit');
    game.spawnBurst(this.x, this.y - this.h * 0.6, '#c4233a', 9);
    if (this.hp <= 0) {
      this.dead = true;
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#7a1020', 26);
      game.spawnBurst(this.x, this.y - this.h * 0.55, '#e04158', 12);
      Audio2.play('death');
      if (game.settings.shake) game.shake(6);
      game.addScore(this.def.score * 10);
      if (Math.random() < 0.55) game.dropCoin(this.x, this.y - 20);
    }
  };

  Enemy.prototype.draw = function (ctx, game) {
    var d = this.def;
    var f = d.frames[Math.floor(this.anim) % d.frames.length];
    if (d.frames.length === 1) f = d.frames[0];
    var s = d.spriteScale;
    ctx.save();
    if (this.hitFlash > 0) {
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = '#ff3355';
      ctx.shadowBlur = 20;
    }
    var bobY = d.gravity ? 0 : Math.sin(this.bob) * 6;
    Assets.blit(ctx, f, this.x, this.y + 2 + bobY, s, this.facing < 0);
    ctx.restore();

    // eye glow
    var ex = this.x + this.facing * (d.gravity ? 5 : 0);
    var ey = this.y - this.h * (d.boss ? 0.78 : 0.72) + bobY;
    var rad = d.boss ? 26 : 14;
    var g = ctx.createRadialGradient(ex, ey, 1, ex, ey, rad);
    g.addColorStop(0, 'rgba(255,60,70,.55)');
    g.addColorStop(1, 'rgba(255,0,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(ex, ey, rad, 0, Math.PI * 2);
    ctx.fill();

    // health bar for tough / boss enemies
    if (this.hp < this.maxHp || d.boss) {
      var bw = d.boss ? 92 : 40;
      var bx = this.x - bw / 2;
      var by = this.y - this.h - 14;
      ctx.fillStyle = 'rgba(0,0,0,.65)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, 6);
      ctx.fillStyle = d.boss ? '#e04158' : '#a81b2e';
      ctx.fillRect(bx, by, bw * Math.max(0, this.hp / this.maxHp), 4);
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
    this.taken = false;
    this.portrait = cfg.portrait || null;
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
      case 'photo': return 's_portrait';
      case 'note': return 'i_scroll';
      default: return 'i_coin';
    }
  };

  Item.prototype.draw = function (ctx) {
    var sp = this.sprite();
    var y = this.y - 20 + Math.sin(this.bob) * 4;
    var s = this.type === 'coin' ? 0.85 : (this.type === 'photo' ? 0.62 : 0.95);
    // glow
    var col = this.type === 'coin' ? 'rgba(201,162,39,.30)' :
      this.type === 'medkit' ? 'rgba(220,70,70,.28)' :
        this.type === 'key' ? 'rgba(230,200,90,.34)' :
          this.type === 'ammo' ? 'rgba(230,170,90,.26)' : 'rgba(200,120,150,.24)';
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
    this.x = cfg.x;
    this.y = cfg.y;
    this.scale = cfg.s || 1.15;
    this.talk = cfg.talk || [];
    this.after = cfg.after || null;
    this.final = !!cfg.final;
    this.done = false;
    this.anim = Math.random() * 3;
    this.fade = this.final ? 1 : 0;
    this.ghostT = 0;
  }
  Npc.prototype.update = function (dt, game) {
    this.anim += dt;
    if (this.final) {
      this.ghostT += dt;
      this.fade = 0.82 + Math.sin(this.ghostT * 1.6) * 0.12;
    }
  };
  Npc.prototype.near = function (p) {
    return Math.abs(p.x - this.x) < 92 && Math.abs(p.y - this.y) < 120;
  };
  Npc.prototype.draw = function (ctx) {
    var frames = this.kind === 'alice' ? ['alice_0', 'alice_1', 'alice_2'] : ['alice_ghost'];
    var f = frames[Math.floor(this.anim * 0.9) % frames.length];
    ctx.save();
    if (this.final) {
      ctx.globalAlpha = this.fade;
      ctx.shadowColor = 'rgba(255,20,50,.85)';
      ctx.shadowBlur = 34;
    }
    Assets.blit(ctx, f, this.x, this.y + 2, this.scale, false);
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
     BULLET
     ------------------------------------------------------------ */
  function Bullet(x, y, dir) {
    this.x = x; this.y = y;
    this.dir = dir;
    this.speed = 980;
    this.life = 1.15;
    this.dead = false;
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
        e.damage(1, game, this.x - this.dir * 10);
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

  global.Ent = {
    Player: Player, Enemy: Enemy, Item: Item, Npc: Npc, Bullet: Bullet,
    overlap: overlap, Body: Body, moveAndCollide: moveAndCollide,
    ENEMY_DEFS: ENEMY_DEFS
  };
})(window);
