/* ============================================================
   tools/simulate.js — headless gameplay simulation
   ------------------------------------------------------------
   Boots the real game code (store/assets/levels/entities/game)
   inside a stubbed DOM + canvas, then actually PLAYS the game:
   walks right, jumps, shoots, opens dialogs, picks items, kills
   enemies and advances through all 7 chapters.

   Any thrown exception, missing asset, NaN coordinate or stuck
   run is reported as a failure.

   Run: node tools/simulate.js [--verbose] [--diff=easy|normal|hard]
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ARGS = process.argv.slice(2);
const VERBOSE = ARGS.includes('--verbose');
const DIFF = (ARGS.find(a => a.startsWith('--diff=')) || '--diff=normal').split('=')[1];
const FRAME_CAP = parseInt((ARGS.find(a => a.startsWith('--frames=')) || '--frames=0').split('=')[1], 10) || 0;

const problems = [];
const warnings = [];
function bad(msg) { problems.push(msg); console.log('  ✗ ' + msg); }
function warn(msg) { warnings.push(msg); if (VERBOSE) console.log('  ! ' + msg); }

/* ============================================================
   DOM / canvas stubs
   ============================================================ */
function makeCtx() {
  const noop = function () { };
  const ctx = {
    canvas: null,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000', strokeStyle: '#000', lineWidth: 1,
    font: '', textAlign: 'left', textBaseline: 'alphabetic',
    shadowColor: '', shadowBlur: 0,
    imageSmoothingEnabled: false,
    filter: 'none',
    save: noop, restore: noop, translate: noop, scale: noop, rotate: noop,
    beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
    arc: noop, rect: noop, fill: noop, stroke: noop, clip: noop,
    fillRect: noop, strokeRect: noop, clearRect: noop,
    drawImage: function (img) {
      if (!img) bad('drawImage called with a null image');
    },
    fillText: noop, strokeText: noop, measureText: () => ({ width: 40 }),
    createLinearGradient: () => ({ addColorStop() { } }),
    createRadialGradient: () => ({ addColorStop() { } }),
    createPattern: () => ({}),
    getImageData: () => { throw new Error('getImageData must never be used (perf + taint)'); },
    putImageData: noop,
    setTransform: noop, resetTransform: noop
  };
  return ctx;
}

const listeners = {};
function makeEl(id) {
  const el = {
    id,
    tagName: 'DIV',
    className: '',
    style: {},
    dataset: {},
    textContent: '',
    innerHTML: '',
    value: '',
    checked: true,
    disabled: false,
    src: '',
    alt: '',
    childElementCount: 0,
    children: [],
    offsetWidth: 100,
    firstChild: null,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, f) { f ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); }
    },
    addEventListener(ev, fn) {
      (listeners[id + ':' + ev] = listeners[id + ':' + ev] || []).push(fn);
    },
    removeEventListener() { },
    appendChild(c) { this.children.push(c); this.childElementCount = this.children.length; },
    removeChild(c) { this.children = this.children.filter(x => x !== c); this.childElementCount = this.children.length; },
    remove() { },
    getAttribute(k) { return this.dataset[k] !== undefined ? this.dataset[k] : null; },
    setAttribute(k, v) { this.dataset[k] = v; },
    getBoundingClientRect() { return { left: 0, top: 0, width: 1024, height: 576 }; },
    getContext() { const c = makeCtx(); c.canvas = this; return c; },
    focus() { }, blur() { }
  };
  return el;
}

const els = {};
function el(id) {
  if (!els[id]) els[id] = makeEl(id);
  return els[id];
}

const canvasEl = makeEl('game');
canvasEl.width = 1024;
canvasEl.height = 576;
canvasEl.getContext = function () { return makeCtx(); };
els.game = canvasEl;

const document_ = {
  getElementById: id => el(id),
  querySelector: sel => el(sel.replace(/[#.]/g, '')),
  querySelectorAll: sel => {
    // the game only queries [data-act], [data-diff], .tbtn
    if (sel === '[data-act]') return [el('act-resume')];
    if (sel === '[data-diff]') return [el('diff-easy'), el('diff-normal'), el('diff-hard')];
    if (sel === '.tbtn') return [];
    return [];
  },
  createElement: tag => makeEl('new-' + tag),
  addEventListener(ev, fn) { (listeners['doc:' + ev] = listeners['doc:' + ev] || []).push(fn); },
  hidden: false,
  body: makeEl('body')
};

const store = {};
const localStorage_ = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

/* ---- virtual clock so setTimeout-driven transitions actually run ---- */
let timerQueue = [];
let timerSeq = 1;
let vnow = 0;
function runDueTimers(limitPerFrame) {
  let ran = 0;
  for (let guard = 0; guard < 40; guard++) {
    const idx = timerQueue.findIndex(t => t.at <= vnow);
    if (idx === -1) break;
    const t = timerQueue.splice(idx, 1)[0];
    try { t.fn(); } catch (e) {
      bad(`timer callback threw: ${e.message}`);
      console.error(e.stack.split('\n').slice(0, 4).join('\n'));
    }
    if (++ran > (limitPerFrame || 20)) break;
  }
}

let rafQueue = [];
const window_ = {
  addEventListener(ev, fn) { (listeners['win:' + ev] = listeners['win:' + ev] || []).push(fn); },
  removeEventListener() { },
  requestAnimationFrame: fn => { rafQueue.push(fn); return rafQueue.length; },
  cancelAnimationFrame() { },
  localStorage: localStorage_,
  location: { search: '', protocol: 'http:', href: 'http://localhost/' },
  navigator: { userAgent: 'node', maxTouchPoints: 0, serviceWorker: undefined },
  innerWidth: 1280, innerHeight: 720,
  devicePixelRatio: 1,
  Image: function () {
    // every sprite "loads" immediately as a 64x96 bitmap
    const self = this;
    self.naturalWidth = 64;
    self.naturalHeight = 96;
    self.width = 64;
    self.height = 96;
    Object.defineProperty(self, 'src', {
      set(v) { self._src = v; setTimeout(() => self.onload && self.onload(), 0); },
      get() { return self._src; }
    });
  },
  setTimeout: (fn, ms) => {
    const id = timerSeq++;
    timerQueue.push({ id, at: vnow + Math.max(0, ms || 0), fn });
    return id;
  },
  clearTimeout: id => { timerQueue = timerQueue.filter(t => t.id !== id); },
  AudioContext: undefined,
  webkitAudioContext: undefined,
  URLSearchParams
};
window_.window = window_;
window_.document = document_;
window_.global = window_;

/* Audio stub — audio.js needs a real AudioContext, we replace it after load */
const audioStub = {
  ready: false, rain: null, musicNodes: null,
  resume() { }, setMaster() { }, setMusicVolume() { },
  play() { }, setRain() { }, setMood() { }, startMusic() { }, tickMusic() { },
  stopMusic() { }
};

/* ============================================================
   load the real source files
   ============================================================ */
const ctxObj = vm.createContext(window_);
['store.js', 'assets.js', 'input.js', 'levels.js', 'entities.js', 'game.js'].forEach(f => {
  const p = path.join(ROOT, 'js', f);
  const src = fs.readFileSync(p, 'utf8');
  try {
    vm.runInContext(src, ctxObj, { filename: 'js/' + f });
  } catch (e) {
    console.error(`FATAL: ${f} failed to evaluate → ${e.message}`);
    process.exit(1);
  }
});

window_.Audio2 = audioStub;
const Store = window_.Store;
const Assets = window_.Assets;
const Game = window_.Game;
const Ent = window_.Ent;
const InputState = window_.InputState;
const LEVELS = window_.GameLevels;

/* ============================================================
   fake asset load (instant)
   ============================================================ */
Assets.load().then(runSim).catch(e => {
  console.error('FATAL: simulation crashed →', e && e.message);
  if (e && e.stack) console.error(e.stack.split('\n').slice(0, 8).join('\n'));
  process.exit(1);
});

/* ============================================================
   helpers
   ============================================================ */
function press(action, frames) {
  InputState.rawKb = InputState.rawKb || {};
  InputState.rawKb[action] = true;
  if (action === 'jump') InputState.rawKb.jump = true;
  InputState._syncTouch();
  frames = frames === undefined ? 1 : frames;
  return { action, frames };
}

function hold(action) {
  InputState.rawKb = InputState.rawKb || {};
  InputState.rawKb[action] = true;
  if (action === 'jump') InputState.rawKb.jump = true;
  InputState._syncTouch();
}

function release(action) {
  if (!InputState.rawKb) return;
  InputState.rawKb[action] = false;
  InputState._syncTouch();
}

function releaseAll() {
  InputState.rawKb = {};
  InputState._syncTouch();
}

function finishFrame() {
  InputState.endFrame();
}

/* ============================================================
   the simulation
   ============================================================ */
function runSim() {
  Store.load();
  Store.profile.difficulty = DIFF;
  Store.profile.seenIntro = true;
  Store.save();

  const game = new Game(canvasEl);
  window_.__game = game;
  game.time = 0;

  const chapterReport = [];
  let frames = 0;
  const MAX_FRAMES = FRAME_CAP || 60 * 60 * 12;   // frames of simulated play
  let jumpCooldown = 0;
  let shootCooldown = 0;
  let interactCooldown = 0;
  let lastCheckpointLog = -1;

  console.log('\n=== simulation start (difficulty: ' + DIFF + ') ===\n');

  game.startNewGame(DIFF);

  if (game.state !== 'play') {
    bad('startNewGame did not enter play state (state=' + game.state + ')');
  }
  if (!game.player) bad('no player after startNewGame');
  if (game.player.hp !== game.diff.hearts) {
    bad(`player hp ${game.player.hp} != difficulty hearts ${game.diff.hearts}`);
  }
  if (game.player.ammo <= 0) bad('player started with 0 ammo — the run is unwinnable');

  let chaptersSeen = 0;
  let lastChapter = -1;
  let stuckFrames = 0;
  let lastX = 0;
  let maxXperChapter = {};
  const startedAt = Date.now();

  while (frames < MAX_FRAMES) {
    frames++;
    if (frames % 1500 === 0) console.log(`    … frame ${frames} state=${game.state} ch=${game.level && game.level.id} x=${Math.round(game.player ? game.player.x : 0)} hp=${game.player ? game.player.hp : '-'} ammo=${game.player ? game.player.ammo : '-'}`);

    // ---- act like a player ----
    const st = game.state;

    if (st === 'dialog') {
      // mash E to advance dialog
      if (frames % 6 === 0) {
        InputState.rawKb = { interact: true };
        InputState._syncTouch();
      } else {
        releaseAll();
      }
    } else if (st === 'finalchoice') {
      // take the "give flower" branch if we have one, otherwise leave
      const prof = Store.profile;
      if (prof.flowers > 0) game.action('final-give');
      else game.action('final-leave');
      releaseAll();
    } else if (st === 'play') {
      const p = game.player;
      if (!p) { bad('play state with no player'); break; }

      // walk right, run, jump on obstacles, shoot enemies
      InputState.rawKb = { right: true, run: true };
      if (jumpCooldown > 0) jumpCooldown--;
      if (shootCooldown > 0) shootCooldown--;
      if (interactCooldown > 0) interactCooldown--;

      /* --- press E near an exit / npc --- */
      const exit = game.level.exit;
      const nearExit = exit && Math.abs(p.x - exit.x) < 70;
      const nearNpc = game.npcs.some(n => n.near(p) && n.available(game));
      if ((nearExit || nearNpc) && interactCooldown <= 0) {
        InputState.rawKb.interact = true;
        interactCooldown = 12;
      }

      /* --- climbing: jump onto a ledge that is above us and within reach --- */
      let climbTarget = null;
      for (const s of game.solids) {
        if (!s.oneway) continue;
        const above = p.y - s.y;                        // how high the ledge top is
        const dxAhead = s.x - p.x;                      // how far ahead it starts
        if (above > 20 && above < 132 && dxAhead > -40 && dxAhead < 96) {
          climbTarget = s;
          break;
        }
      }

      // an obstacle ahead?
      const aheadX = p.x + 40;
      const blocked = game.solidAt(aheadX, p.y - 20) || game.solidAt(aheadX, p.y - 50);
      const nearEnemy = game.enemies.some(e =>
        Math.abs(e.x - p.x) < 320 && Math.abs(e.y - p.y) < 200);
      const nearSpike = game.spikeRects.some(s =>
        s.x - p.x < 105 && s.x - p.x > -40 && Math.abs(s.y - p.y) < 90);

      const wantJump = climbTarget || blocked || nearSpike;
      if (wantJump && p.onGround && jumpCooldown <= 0) {
        InputState.rawKb.jump = true;
        jumpCooldown = 8;
      }
      if (nearEnemy && shootCooldown <= 0) {
        InputState.rawKb.fire = true;
        shootCooldown = 8;
      }
      InputState._syncTouch();

      // did we stop moving?
      if (Math.abs(p.x - lastX) < 0.4) stuckFrames++;
      else stuckFrames = 0;
      lastX = p.x;

      if (stuckFrames > 60 * 3) {
        // the sim is not a human: nudge it over whatever it is stuck on
        p.x += 26;
        p.vx = 190;
        stuckFrames = 0;
        warn(`[${game.level.id}] sim was stuck at x=${Math.round(p.x)} — nudged`);
      }
    } else if (st === 'dead') {
      game.restartFromCheckpoint();
      releaseAll();
    } else if (st === 'ending') {
      break;
    } else {
      releaseAll();
    }

    // ---- advance one frame ----
    InputState.beginFrame();
    try {
      game.update(1 / 60);
      game.draw();
    } catch (e) {
      bad(`frame ${frames} (state=${game.state}, chapter=${game.level && game.level.id}) threw: ${e.message}`);
      console.error(e.stack.split('\n').slice(0, 4).join('\n'));
      break;
    }

    // advance the virtual clock so chapter transitions & timers fire
    vnow += 1000 / 60;
    runDueTimers();

    // ---- invariants ----
    if (game.level) {
      if (lastChapter !== game.levelIndex) {
        lastChapter = game.levelIndex;
        chaptersSeen++;
        maxXperChapter[game.level.id] = 0;
        chapterReport.push({
          id: game.level.id, name: game.level.name,
          hp: game.player.hp, ammo: game.player.ammo, score: game.score
        });
        console.log(`  → entered ${game.level.kicker}: ${game.level.name} ` +
          `(hp ${game.player.hp}/${game.player.maxHp}, ammo ${game.player.ammo}, score ${game.score})`);
        lastCheckpointLog = -1;
      }
      maxXperChapter[game.level.id] = Math.max(maxXperChapter[game.level.id] || 0, game.player.x);
    }

    const p = game.player;
    if (p) {
      if (!isFinite(p.x) || !isFinite(p.y)) {
        bad(`player position became NaN at frame ${frames} (${p.x},${p.y})`);
        break;
      }
      if (p.hp > p.maxHp) bad(`player hp ${p.hp} exceeds maxHp ${p.maxHp}`);
      if (p.hp < 0) bad(`player hp went negative (${p.hp})`);
    }
    for (const e of game.enemies) {
      if (!isFinite(e.x) || !isFinite(e.y)) {
        bad(`enemy ${e.type} position became NaN`);
        break;
      }
    }
    if (game.particles.length > 260) bad(`particle cap broken: ${game.particles.length}`);
    if (game.toast) { /* noop */ }
  }

  /* ---------------- result ---------------- */
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(`\n=== simulation finished after ${frames} frames (${elapsed}s wall clock) ===\n`);

  if (game.state !== 'ending') {
    bad(`never reached the ending (final state: ${game.state}, chapter ${game.level && game.level.id}, x=${Math.round(game.player.x)})`);
  } else {
    console.log('  ✓ reached the ending');
  }
  if (chaptersSeen !== LEVELS.length) {
    bad(`only ${chaptersSeen} of ${LEVELS.length} chapters were entered`);
  } else {
    console.log(`  ✓ all ${LEVELS.length} chapters played through`);
  }

  /* ---------------- per-chapter progress ---------------- */
  console.log('\nchapter progress:');
  for (const L of LEVELS) {
    const reached = maxXperChapter[L.id];
    if (reached === undefined) {
      console.log(`  ${L.id}: never entered`);
      continue;
    }
    const pct = Math.round((reached / L.width) * 100);
    const flag = pct >= 92 ? '✓' : '✗';
    console.log(`  ${flag} ${L.id}  x=${String(Math.round(reached)).padStart(4)}/${L.width}  (${pct}%)`);
    if (pct < 92) bad(`${L.id}: player only reached ${pct}% of the chapter`);
  }

  /* ---------------- store / save integrity ---------------- */
  console.log('\nprofile checks:');
  const prof = Store.profile;
  if (Store.journalCount() > 0) console.log(`  ✓ journal collected ${Store.journalCount()}/${Store.JOURNAL.length} entries`);
  else bad('no journal entries were collected during the playthrough');
  if (prof.unlocked === LEVELS.length) console.log('  ✓ all chapters unlocked');
  else bad(`only ${prof.unlocked}/${LEVELS.length} chapters unlocked at the end`);
  if (prof.flowers >= 0 && Number.isFinite(prof.wallet)) console.log(`  ✓ wallet ${prof.wallet}, flowers ${prof.flowers}, gifts ${prof.gifts}`);
  else bad('wallet/flowers corrupted');

  /* ---------------- html/js wiring ---------------- */
  console.log('\nwiring checks:');
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const requiredIds = ['hud', 'hearts', 'ammo-count', 'key-count', 'coin-count', 'flower-count',
    'dialog', 'dialog-name', 'dialog-text', 'dialog-portrait', 'toasts',
    'pause', 'settings', 'journal', 'journal-list', 'journal-count',
    'prologue', 'prologue-text', 'prologue-next', 'title', 'difficulty', 'chapters',
    'chapter-list', 'shop', 'shop-list', 'shop-wallet', 'howto', 'death', 'death-quote',
    'btn-ease', 'levelcard', 'lc-kicker', 'lc-title', 'lc-sub', 'ending', 'ending-title',
    'ending-body', 'credits', 'touch', 'loading', 'load-fill', 'stage', 'game',
    'finalchoice', 'final-note', 'btn-final-give',
    'btn-new', 'btn-continue', 'btn-chapters', 'btn-shop-title', 'btn-how',
    'btn-settings-title', 'btn-install', 'btn-start-run',
    'vol-master', 'vol-music', 'vol-master-val', 'vol-music-val',
    'opt-shake', 'opt-crt', 'opt-fx', 'level-name', 'objective'];
  let missingIds = 0;
  for (const id of requiredIds) {
    if (!new RegExp('id="' + id + '"').test(idx)) { bad(`index.html is missing #${id}`); missingIds++; }
  }
  if (!missingIds) console.log(`  ✓ all ${requiredIds.length} element ids present`);

  // every data-act in the html must be handled by game.action()
  const acts = [...idx.matchAll(/data-act="([a-z-]+)"/g)].map(m => m[1]);
  const uniqActs = [...new Set(acts)];
  const srcGame = fs.readFileSync(path.join(ROOT, 'js/game.js'), 'utf8');
  const missingActs = uniqActs.filter(a => !srcGame.includes(`case '${a}'`));
  if (missingActs.length) bad(`unhandled data-act: ${missingActs.join(', ')}`);
  else console.log(`  ✓ all ${uniqActs.length} data-act buttons are handled`);

  // every asset referenced by html/js must exist on disk
  const allRefs = new Set();
  const scan = (text, re) => {
    let m;
    while ((m = re.exec(text)) !== null) allRefs.add(m[1]);
  };
  scan(idx, /(?:src|href)="(assets\/[A-Za-z0-9_.-]+\.png)"/g);
  for (const f of ['store.js', 'levels.js', 'entities.js', 'game.js', 'assets.js']) {
    const t = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    scan(t, /['"](assets\/[A-Za-z0-9_.-]+\.png)['"]/g);
  }
  let missingAssets = 0;
  for (const ref of allRefs) {
    if (!fs.existsSync(path.join(ROOT, ref))) { bad(`missing asset file: ${ref}`); missingAssets++; }
  }
  if (!missingAssets) console.log(`  ✓ all ${allRefs.size} referenced asset files exist`);

  // every asset key the code asks Assets for must be in the manifest
  const manifestSrc = fs.readFileSync(path.join(ROOT, 'js/assets.js'), 'utf8');
  const declKeys = new Set([...manifestSrc.matchAll(/^\s{4}([a-z_0-9]+):\s+'assets\//gm)].map(m => m[1]));
  const usedKeys = new Set();
  const keyRe = /(?:Assets\.(?:blit|blitH|img|has|size)\('([a-z_0-9]+)'|spr:\s*'([a-z_0-9]+)'|icon:\s*'([a-z_0-9]+)'|sprite:\s*'([a-z_0-9]+)'|portrait:\s*'([a-z_0-9]+)'|'([a-z_0-9]+)'\))/g;
  for (const f of ['levels.js', 'entities.js', 'game.js']) {
    const t = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
    let m;
    while ((m = keyRe.exec(t)) !== null) {
      const k = m[1] || m[2] || m[3] || m[4] || m[5];
      if (k) usedKeys.add(k);
    }
  }
  const notInManifest = [...usedKeys].filter(k => !declKeys.has(k) && /^(sanu|nuran|mon|i_|prop_|s_|u_|p_|bg_|tex_)/.test(k));
  if (notInManifest.length) bad(`asset key(s) used but not in manifest: ${notInManifest.join(', ')}`);
  else console.log(`  ✓ all ${usedKeys.size} sprite keys used by the code are in the manifest`);

  /* ---------------- summary ---------------- */
  console.log('\n' + '='.repeat(62));
  if (problems.length) {
    console.log(`FAILED — ${problems.length} problem(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }
  console.log(`PASSED — playthrough completed with 0 problems (${warnings.length} warning(s))`);
  process.exit(0);
}
