/* ============================================================
   main.js — bootstrap, RAF loop, first-gesture audio unlock
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

    game._lastDt = dt;

    InputState.beginFrame();
    game.update(dt);
    game.draw();
    InputState.endFrame();

    requestAnimationFrame(loop);
  }

  Assets.load(function (p, name) {
    if (fill) fill.style.width = Math.round(p * 100) + '%';
  }).then(function () {
    game = new Game(canvas);
    window.__game = game;

    // pre-create the brick pattern once so the first frame is not blank
    try { game._makePattern(game.ctx, 'tex_brick', 2.1); } catch (e) { }

    game.state = 'title';
    game.show('title');
    game.refreshContinue();

    // title backdrop needs a first paint
    game.drawTitleBackdrop();

    hideLoading();
    requestAnimationFrame(loop);

    // ---- global hotkeys that work outside play ----
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Escape') {
        if (game.state === 'play') {
          game.state = 'pause';
          game.show('pause');
          document.getElementById('hud').classList.add('hidden');
        } else if (game.state === 'pause') {
          game.action('resume');
        } else if (game.state === 'dialog') {
          // allow skipping the whole line queue with Esc? no - keep flow intact
        }
      }
    });

    // safety: if the tab loses focus mid-jump, never leave keys stuck
    window.addEventListener('blur', function () { InputState.releaseAll(); });

    console.log('[Alice] ready — assets:', Object.keys(Assets.MANIFEST).length);
  }).catch(function (err) {
    console.error('[Alice] boot failed', err);
    if (fill) {
      fill.style.width = '100%';
      fill.style.background = '#7a1020';
    }
  });
})();
