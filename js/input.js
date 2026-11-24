/* ============================================================
   input.js — keyboard + mouse + touch, unified action state
   ============================================================ */
(function (global) {
  'use strict';

  function Input() {
    this.state = {
      left: false, right: false, up: false, down: false,
      jump: false, jumpPressed: false,
      run: false,
      interact: false, interactPressed: false,
      fire: false, firePressed: false,
      pausePressed: false,
      anyPressed: false
    };
    this.prev = {};
    this.touch = { left: false, right: false, jump: false, fire: false, interact: false, crouch: false };
    this.mouse = { x: 0, y: 0, down: false };
    this.enabled = true;
    this._bind();
  }

  Input.prototype._bind = function () {
    var self = this;

    var KEYMAP = {
      ArrowLeft: 'left', KeyA: 'left',
      ArrowRight: 'right', KeyD: 'right',
      ArrowUp: 'up', KeyW: 'up',
      ArrowDown: 'down', KeyS: 'down',
      Space: 'jump',
      ShiftLeft: 'run', ShiftRight: 'run',
      KeyE: 'interact', Enter: 'interact',
      KeyJ: 'fire', KeyK: 'fire',
      Escape: 'pause', KeyP: 'pause'
    };

    function onKey(e, down) {
      var act = KEYMAP[e.code];
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'ArrowDown' ||
          e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
        e.preventDefault();
      }
      if (!act) return;
      if (!down && act === 'jump') { /* handled below */ }
      self._set(act, down);
      if (down) self.state.anyPressed = true;
    }

    window.addEventListener('keydown', function (e) {
      if (e.repeat) { onKey(e, true); return; }
      onKey(e, true);
    }, { passive: false });

    window.addEventListener('keyup', function (e) { onKey(e, false); }, { passive: false });

    window.addEventListener('blur', function () { self.releaseAll(); });

    // mouse
    var canvas = document.getElementById('game');
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        if (e.button === 0) { self.mouse.down = true; self._set('fire', true); self.state.anyPressed = true; }
      });
      window.addEventListener('mouseup', function (e) {
        if (e.button === 0) { self.mouse.down = false; self._set('fire', false); }
      });
      canvas.addEventListener('mousemove', function (e) {
        var r = canvas.getBoundingClientRect();
        self.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
        self.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
      });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    }

    // touch buttons
    var tbtns = document.querySelectorAll('.tbtn');
    Array.prototype.forEach.call(tbtns, function (btn) {
      var key = btn.getAttribute('data-key');
      var act = key === 'interact' ? 'interact' : key;
      function press(ev) {
        ev.preventDefault();
        self.touch[key] = true;
        self._syncTouch();
        self.state.anyPressed = true;
      }
      function release(ev) {
        ev.preventDefault();
        self.touch[key] = false;
        self._syncTouch();
      }
      btn.addEventListener('touchstart', press, { passive: false });
      btn.addEventListener('touchend', release, { passive: false });
      btn.addEventListener('touchcancel', release, { passive: false });
      btn.addEventListener('mousedown', press);
      btn.addEventListener('mouseup', release);
      btn.addEventListener('mouseleave', release);
    });
  };

  Input.prototype._syncTouch = function () {
    var t = this.touch;
    this.state.left = this._kb('left') || t.left;
    this.state.right = this._kb('right') || t.right;
    this.state.jump = this._kb('jump') || t.jump;
    this.state.fire = this._kb('fire') || t.fire;
    this.state.interact = this._kb('interact') || t.interact;
    this.state.down = this._kb('down') || t.crouch;
  };

  Input.prototype._kb = function (act) {
    return !!this.rawKb[act];
  };

  Input.prototype._set = function (act, down) {
    if (!this.rawKb) this.rawKb = {};
    this.rawKb[act] = down;
    if (act === 'pause') {
      if (down) this.state.pausePressed = true;
      return;
    }
    this._syncTouch();
  };

  Input.prototype.releaseAll = function () {
    this.rawKb = {};
    this.mouse.down = false;
    this.touch = { left: false, right: false, jump: false, fire: false, interact: false, crouch: false };
    this._syncTouch();
  };

  /** call once per frame BEFORE reading; computes edge triggers */
  Input.prototype.beginFrame = function () {
    var s = this.state;
    s.jumpPressed = !!s.jump && !this.prev.jump;
    s.firePressed = !!s.fire && !this.prev.fire;
    s.interactPressed = !!s.interact && !this.prev.interact;
    this.prev.jump = s.jump;
    this.prev.fire = s.fire;
    this.prev.interact = s.interact;
    this.prev.pause = s.pausePressed;
  };

  Input.prototype.endFrame = function () {
    this.state.pausePressed = false;
    this.state.anyPressed = false;
  };

  global.InputState = new Input();
})(window);
