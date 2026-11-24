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

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.style.transition = 'opacity .6s';
    loadingEl.style.opacity = '0';
    setTimeout(function () { loadingEl.classList.add('hidden'); }, 620);
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
    if (dt > 0.06) dt = 0.06;
    if (dt < 0) dt = 0.016;

    game._lastDt = dt;

    InputState.beginFrame();
    game.update(dt);
    game.draw();
    InputState.endFrame();

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

    game.state = 'title';
    game.show('title');
    game.refreshContinue();
    game.drawTitleBackdrop();

    hideLoading();
    requestAnimationFrame(loop);

    // ---- global hotkeys outside play ----
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape') {
        if (game.state === 'play') {
          game.state = 'pause';
          game.persistRun();
          game.show('pause');
        } else if (game.state === 'pause') {
          game.action('resume');
        } else if (game.state === 'select' || game.state === 'chapters' || game.state === 'shop') {
          game.action('difficulty-back');
        } else if (game.state === 'settings') {
          game.action('settings-back');
        }
      }
    });

    window.addEventListener('blur', function () { InputState.releaseAll(); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        InputState.releaseAll();
        if (game.state === 'play' && game.persistRun) game.persistRun();
      }
    });

    console.log('[Alice] ready — assets:', Assets.total);

    // debug/smoke-test hook: ?play=1[&diff=hard][&ch=2] jumps straight into a chapter
    try {
      var qs = new URLSearchParams(location.search);
      if (qs.get('play') === '1') {
        var d = qs.get('diff');
        var ch = parseInt(qs.get('ch') || '0', 10);
        game.startNewGame(d || game.pendingDifficulty);
        if (ch > 0) game.startChapter(ch);
        console.log('[Alice] autostart level', game.levelIndex, game.level.id);
      }
    } catch (e) { }
  }).catch(function (err) {
    console.error('[Alice] boot failed', err);
    if (fill) {
      fill.style.width = '100%';
      fill.style.background = '#7a1020';
    }
  });
})();
