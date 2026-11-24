/* ============================================================
   main.js — bootstrap, RAF loop, first-gesture audio unlock, PWA
   ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('game');
  var fill = document.getElementById('load-fill');
  var loadingEl = document.getElementById('loading');

  var game = null;
  var lastT = 0;
  var slowFrames = 0;
  var autoFxDone = false;

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.style.transition = 'opacity .55s';
    loadingEl.style.opacity = '0';
    setTimeout(function () { loadingEl.classList.add('hidden'); }, 580);
  }

  function unlockAudio() {
    Audio2.resume();
    if (Audio2.ready && !Audio2.rain) {
      Audio2.setRain('light');
      Audio2.startMusic('calm');
    }
  }

  ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
    window.addEventListener(ev, unlockAudio, { once: true, passive: true });
  });

  function loop(t) {
    var dt = lastT ? (t - lastT) / 1000 : 0.016;
    lastT = t;
    if (!isFinite(dt) || dt <= 0) dt = 0.016;
    if (dt > 0.06) dt = 0.06;

    if (game) {
      game._lastDt = dt;
      InputState.beginFrame();
      game.update(dt);
      game.draw();
      InputState.endFrame();

      // one automatic quality drop if the device clearly struggles
      if (!autoFxDone && dt > 0.034 && game.state === 'play') {
        slowFrames++;
        if (slowFrames > 90) {
          autoFxDone = true;
          var s = Store.loadSettings();
          if (!s.lowFx) {
            s.lowFx = true;
            Store.saveSettings(s);
            game.settings.lowFx = true;
            var stage = document.getElementById('stage');
            if (stage) stage.classList.add('low-fx');
            game.toast('Zəif cihaz: effektlər azaldıldı', 'good');
          }
        }
      }
    }

    requestAnimationFrame(loop);
  }

  /* ---------------- PWA ---------------- */
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    window.__deferredPrompt = e;
  });

  window.addEventListener('appinstalled', function () {
    window.__deferredPrompt = null;
    if (game) game.toast('Tətbiq quraşdırıldı', 'good');
  });

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (err) {
        console.warn('[sw] register failed', err && err.message);
      });
    });
  }

  /* ---------------- boot ---------------- */
  Assets.load(function (p) {
    if (fill) fill.style.width = Math.round(p * 100) + '%';
  }).then(function () {
    Store.load();
    game = new Game(canvas);
    window.__game = game;
    game.diff = Store.diff();

    try { game._makePattern(game.ctx, 'tex_brick', 2.1); } catch (e) { }

    // touch devices get the on-screen pad
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
      game.enableTouch();
    }

    game.state = 'title';
    game.show('title');
    game.refreshContinue();

    hideLoading();
    requestAnimationFrame(loop);

    /* ---- global hotkeys outside play ---- */
    window.addEventListener('keydown', function (e) {
      var s = game.state;
      if (e.code === 'Escape') {
        if (s === 'play') {
          game.state = 'pause';
          game.persistRun();
          game.show('pause');
        } else if (s === 'pause') {
          game.action('resume');
        } else if (s === 'select' || s === 'chapters' || s === 'shop') {
          game.action(s === 'select' ? 'difficulty-back' : s === 'chapters' ? 'chapters-back' : 'shop-back');
        } else if (s === 'journal') {
          game.action('journal-back');
        } else if (s === 'settings') {
          game.action('settings-back');
        } else if (s === 'howto') {
          game.action('howto-back');
        }
      }
      // quick journal from the pause screen
      if (e.code === 'KeyJ' && (s === 'pause' || s === 'journal')) {
        game.action(s === 'pause' ? 'journal' : 'journal-back');
      }
    });

    window.addEventListener('blur', function () { InputState.releaseAll(); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        InputState.releaseAll();
        if (game.state === 'play') {
          game.state = 'pause';
          game.persistRun();
          game.show('pause');
        }
      }
    });

    console.log('[Sanu] ready — assets:', Assets.total);

    /* debug/smoke-test hook: ?play=1[&diff=hard][&ch=2][&x=1500] */
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('play') === '1') {
        var d = qs.get('diff');
        var ch = parseInt(qs.get('ch') || '0', 10);
        var bx = parseInt(qs.get('x') || '0', 10);
        if (d && Store.DIFFICULTIES[d]) {
          var prof = Store.profile;
          prof.difficulty = d;
          prof.seenIntro = true;
          Store.save();
          game.diff = Store.diff();
        } else {
          Store.profile.seenIntro = true;
          Store.save();
        }
        game.startNewGame(d || game.pendingDifficulty);
        if (ch > 0) game.startChapter(ch);
        if (bx > 0 && game.player) {
          game.player.x = bx;
          game.checkpointX = bx;
        }
        console.log('[Sanu] autostart level', game.levelIndex, game.level.id);
      }
    } catch (e) { }
  }).catch(function (err) {
    console.error('[Sanu] boot failed', err);
    if (fill) {
      fill.style.width = '100%';
      fill.style.background = '#7a1020';
    }
    var txt = document.querySelector('.load-text');
    if (txt) txt.textContent = 'Yükləmə alınmadı — səhifəni yenilə';
  });
})();
