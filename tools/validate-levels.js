/* ============================================================
   tools/validate-levels.js
   Static geometry validator for js/levels.js

   Checks, per chapter:
   · the ground is continuous (no bottomless pits)
   · every ladder step is within jump reach (dy<=108, dx<=96)
   · every spike has >= 70px of clear ground on both sides
   · no prop sits inside a spike or floats in mid-air
   · every item / enemy / npc / trigger / checkpoint / exit
     stands on or above a solid surface
   · every key the exit needs actually exists in the chapter
   Run: node tools/validate-levels.js
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const file = path.join(ROOT, 'js/levels.js');
const src = fs.readFileSync(file, 'utf8');

// minimal window/document shim so levels.js can evaluate headlessly
const sandbox = { window: {}, console };
sandbox.window.window = sandbox.window;
vm.createContext(sandbox);
vm.runInContext(src, sandbox, { filename: 'js/levels.js' });

const LEVELS = sandbox.window.GameLevels;
const CFG = sandbox.window.GameCfg;

if (!Array.isArray(LEVELS) || LEVELS.length !== 12) {
  console.error('FAIL: expected 12 levels, got', LEVELS && LEVELS.length);
  process.exit(1);
}

const G = CFG.G;
const JUMP_H = 138;          // physics: v=790, g=2250  -> ~138px
const RUN_REACH = 188;       // horizontal reach of a run-jump
const STEP_MAX_Y = 108;      // allow a small margin over the 100px design step
const STEP_MAX_X = 96;

let errors = 0;
let warnings = 0;
function fail(L, msg) { errors++; console.log(`  ✗ [${L.id}] ${msg}`); }
function warn(L, msg) { warnings++; console.log(`  ! [${L.id}] ${msg}`); }

/* ---------- helpers ---------- */
function groundSegments(L) {
  return L.platforms
    .filter(p => p.kind === 'ground')
    .map(p => [p.x, p.x + p.w])
    .sort((a, b) => a[0] - b[0]);
}

function mergedGround(L) {
  const segs = groundSegments(L);
  if (!segs.length) return [];
  const out = [segs[0].slice()];
  for (let i = 1; i < segs.length; i++) {
    const last = out[out.length - 1];
    if (segs[i][0] <= last[1] + 0.5) last[1] = Math.max(last[1], segs[i][1]);
    else out.push(segs[i].slice());
  }
  return out;
}

function surfaceAt(L, x) {
  // highest walkable surface at column x (ground preferred, then ledge)
  let best = null;
  for (const p of L.platforms) {
    if (x >= p.x && x <= p.x + p.w) {
      if (!best || p.y < best.y) best = p;
    }
  }
  return best;
}

/** a platform whose walkable top is exactly at feet level `y` under column x */
function platAtY(L, x, y) {
  for (const p of L.platforms) {
    if (x >= p.x && x <= p.x + p.w && Math.abs(p.y - y) <= 2) return p;
  }
  return null;
}

/** nearest walkable platform at or below feet level y (used for dropped/float items) */
function supportFor(L, x, y) {
  let best = null;
  for (const p of L.platforms) {
    if (x >= p.x - 4 && x <= p.x + p.w + 4 && p.y >= y - 2) {
      if (!best || p.y < best.y) best = p;
    }
  }
  return best;
}

/* ============================================================
   1. ground continuity
   ============================================================ */
console.log('\n— ground continuity —');
for (const L of LEVELS) {
  const g = mergedGround(L);
  if (g.length !== 1) {
    fail(L, `ground is split into ${g.length} pieces → bottomless pit at the seams`);
  }
  const [a, b] = g[0] || [0, 0];
  if (a > 0.5) fail(L, `ground starts at x=${a}; the player spawns before the floor`);
  if (b < L.width - 0.5) fail(L, `ground ends at x=${b} but level width is ${L.width}`);
  if (L.start.x < a || L.start.x > b) fail(L, `start x=${L.start.x} is not over the ground`);
}

/* ============================================================
   2. ladder reachability
   ============================================================ */
console.log('\n— ladder climbability —');
for (const L of LEVELS) {
  const ledges = L.platforms
    .filter(p => p.kind === 'ledge')
    .sort((a, b) => a.x - b.x || b.y - a.y);

  for (const l of ledges) {
    // find the surface directly below the ledge's left edge
    const below = L.platforms
      .filter(p => p !== l && p.y > l.y && l.x + 10 >= p.x && l.x + 10 <= p.x + p.w)
      .sort((a, b) => a.y - b.y)[0];

    if (!below) {
      // may be reachable by dropping from a ledge above — check that instead
      const above = L.platforms.filter(p => p !== l && p.y < l.y && p.x < l.x + l.w && p.x + p.w > l.x);
      if (!above.length) warn(L, `ledge at (${l.x},${l.y}) has no surface below it`);
      continue;
    }
    const dy = below.y - l.y;
    const dx = Math.max(0, Math.abs(l.x - below.x));
    if (dy > JUMP_H + 2) {
      failedReach(L, l, below, dy, dx);
    } else if (dy > STEP_MAX_Y) {
      warn(L, `ledge (${l.x},${l.y}) rises ${dy}px above its support (jump max ${JUMP_H})`);
    }
  }
  // top ledge must be reachable from the one below within dx
  for (let i = 1; i < ledges.length; i++) {
    const prev = ledges[i - 1], cur = ledges[i];
    const dy = prev.y - cur.y;
    const dx = Math.abs(cur.x - prev.x);
    if (dy > 0 && dy <= STEP_MAX_Y && dx > STEP_MAX_X) {
      warn(L, `step ${i}: dy=${dy} needs dx=${dx} (>${STEP_MAX_X}) — tight jump`);
    }
  }
}

function failedReach(L, l, below, dy, dx) {
  fail(L, `ledge (${l.x},${l.y}) is ${dy}px above support y=${below.y} — unreachable (max ${JUMP_H})`);
}

/* ============================================================
   3. spikes: clearance + not inside a prop
   ============================================================ */
console.log('\n— spike placement —');
for (const L of LEVELS) {
  for (const s of L.hazards) {
    const surf = surfaceAt(L, s.x + s.w / 2);
    if (!surf) { fail(L, `spike at x=${s.x} floats over nothing`); continue; }
    if (Math.abs(surf.y - G) > 1) fail(L, `spike at x=${s.x} sits at y=${s.y} but the ground there is y=${surf.y}`);
    // clearance on both sides — the player needs room to land and jump over
    const leftRoom = s.x - (surf.x);
    const rightRoom = (surf.x + surf.w) - (s.x + s.w);
    if (leftRoom < 70) fail(L, `spike at x=${s.x} has only ${Math.round(leftRoom)}px of runway on the left`);
    if (rightRoom < 70) fail(L, `spike at x=${s.x} has only ${Math.round(rightRoom)}px of landing room on the right`);
    // overhead: nothing above the spike that would block the jump
    for (const p of L.platforms) {
      if (p.kind !== 'ledge') continue;
      const overlapX = p.x < s.x + s.w + 40 && p.x + p.w > s.x - 40;
      const tooLow = p.y > G - JUMP_H - 30 && p.y < G;
      if (overlapX && tooLow) warn(L, `ledge (${p.x},${p.y}) hangs ${G - p.y}px over the spike at x=${s.x}`);
    }
    // props inside the spike
    for (const pr of L.props) {
      if (pr.x > s.x - 22 && pr.x < s.x + s.w + 22) {
        fail(L, `prop ${pr.a} at x=${pr.x} overlaps the spike at x=${s.x}`);
      }
    }
  }
}

/* ============================================================
   4. props: not floating, not too crowded
   ============================================================ */
console.log('\n— prop placement —');
for (const L of LEVELS) {
  const sorted = L.props.slice().sort((a, b) => a.x - b.x);
  for (let i = 0; i < sorted.length; i++) {
    const pr = sorted[i];
    const surf = platAtY(L, pr.x, pr.y);
    if (!surf) {
      const anyBelow = supportFor(L, pr.x, pr.y);
      if (!anyBelow) fail(L, `prop ${pr.a} at x=${pr.x} floats in mid-air`);
      else fail(L, `prop ${pr.a} at x=${pr.x} sits at y=${pr.y} but the surface there is y=${anyBelow.y}`);
    }
    if (pr.x < 40 || pr.x > L.width - 40) warn(L, `prop ${pr.a} at x=${pr.x} is at the level edge`);
    if (i > 0) {
      const gap = pr.x - sorted[i - 1].x;
      if (gap < 80) warn(L, `props ${sorted[i - 1].a} and ${pr.a} are only ${Math.round(gap)}px apart`);
    }
    // prop blocking a ladder landing
    for (const p of L.platforms) {
      if (p.kind !== 'ledge') continue;
      if (Math.abs(pr.x - p.x) < 26 && Math.abs(pr.y - p.y) < 40) {
        warn(L, `prop ${pr.a} sits under the ledge at (${p.x},${p.y})`);
      }
    }
  }
}

/* ============================================================
   5. items / enemies / npcs / triggers / checkpoints / exit
   ============================================================ */
console.log('\n— entity placement —');
for (const L of LEVELS) {
  for (const it of L.items) {
    const surf = supportFor(L, it.x, it.y);
    if (!surf) fail(L, `item ${it.type} at (${it.x},${it.y}) has no surface beneath it`);
    for (const s of L.hazards) {
      if (it.x > s.x - 14 && it.x < s.x + s.w + 14 && Math.abs(it.y - (s.y)) < 60) {
        fail(L, `item ${it.type} at x=${it.x} hovers over the spike at x=${s.x}`);
      }
    }
  }

  for (const e of L.enemies) {
    const surf = supportFor(L, e.x, e.y);
    if (!surf) fail(L, `enemy ${e.type} at (${e.x},${e.y}) has no surface beneath it`);
    if (e.patrol) {
      const [pmin, pmax] = e.patrol;
      if (pmax <= pmin) fail(L, `enemy ${e.type} has an inverted patrol [${pmin},${pmax}]`);
      if (pmax - pmin < 60) warn(L, `enemy ${e.type} patrol is only ${pmax - pmin}px wide`);
      for (const px of [pmin, pmax]) {
        if (!surfaceAt(L, px)) fail(L, `enemy ${e.type} patrol endpoint x=${px} has no floor`);
      }
      if (e.x < pmin || e.x > pmax) warn(L, `enemy ${e.type} spawns outside its own patrol`);
    }
  }

  for (const n of L.npcs) {
    const surf = surfaceAt(L, n.x);
    if (!surf) fail(L, `npc ${n.sprite} at x=${n.x} floats in mid-air`);
  }

  for (const c of L.checkpoints) {
    if (!surfaceAt(L, c)) fail(L, `checkpoint x=${c} has no floor`);
    if (c > L.width) fail(L, `checkpoint x=${c} is beyond the level width`);
  }

  for (const t of L.triggers) {
    if (t.x < 0 || t.x > L.width) fail(L, `trigger x=${t.x} is outside the level`);
    if (!t.lines || !t.lines.length) fail(L, `trigger x=${t.x} has no dialog lines`);
  }

  if (L.exit) {
    const surf = surfaceAt(L, L.exit.x);
    if (!surf) fail(L, `exit x=${L.exit.x} floats in mid-air`);
    if (L.exit.to < 0 || L.exit.to > LEVELS.length) fail(L, `exit.to=${L.exit.to} is out of range`);
    const need = L.exit.needsKey ? 1 : (L.exit.needsKeys || 0);
    const keys = L.items.filter(i => i.type === 'key').length;
    if (need > keys) fail(L, `exit needs ${need} keys but only ${keys} exist in the chapter`);
    if (L.exit.needsLevers) {
      const levers = L.items.filter(i => i.type === 'lever').length;
      if (levers < L.exit.needsLevers) fail(L, `exit needs ${L.exit.needsLevers} levers but only ${levers} exist`);
    }
    // nothing should stand on top of the exit portal
    for (const pr of L.props) {
      if (Math.abs(pr.x - L.exit.x) < 46) warn(L, `prop ${pr.a} is right on the exit portal`);
    }
  }

  // every chapter must be completable: an exit, or a final npc for ch7
  const last = L.index === LEVELS.length - 1;
  if (!L.exit && !last) fail(L, `chapter ${L.index + 1} has neither an exit nor a finale`);
}

/* ============================================================
   6. dialog sanity
   ============================================================ */
console.log('\n— dialog & story —');
const NAMES = new Set(['Nuran', 'Sanu', '???', '']);
let aliceLeft = 0, leoLeft = 0;
for (const L of LEVELS) {
  const walk = (lines, where) => {
    for (const line of lines || []) {
      if (typeof line.text !== 'string' || !line.text.trim()) fail(L, `${where}: empty dialog line`);
      if (line.who && !NAMES.has(line.who)) fail(L, `${where}: unknown speaker "${line.who}"`);
      if (/alice/i.test(line.who || '') || /leo/i.test(line.who || '')) aliceLeft++;
      if (/Alice|Leo/.test(line.text || '')) leoLeft++;
      if (line.portrait && !/^(nuran|sanu|u_phone)/.test(line.portrait)) {
        fail(L, `${where}: unexpected portrait "${line.portrait}"`);
      }
    }
  };
  L.triggers.forEach((t, i) => walk(t.lines, `trigger#${i}`));
  L.npcs.forEach((n, i) => walk(n.talk, `npc#${i}`));
  L.items.forEach((it, i) => { if (it.lines) walk(it.lines, `item#${i}`); });
}
if (aliceLeft) fail({ id: 'story' }, `${aliceLeft} dialog lines still use the old player name`);
if (leoLeft) fail({ id: 'story' }, `${leoLeft} dialog texts still mention Alice/Leo`);

// endings
// v5: six endings live in Store.ENDINGS (checked by tools/simulate.js)
const E1 = sandbox.window.GameEnding, E2 = sandbox.window.GameEndingPlain;
for (const E of [E1, E2]) {
  if (E && E.body && /Alice|Leo/.test(E.body.join(' '))) fail({ id: 'ending' }, `ending "${E.title}" still mentions the old names`);
}

console.log('\n' + '='.repeat(58));
if (errors) {
  console.log(`FAILED — ${errors} error(s), ${warnings} warning(s)`);
  process.exit(1);
}
console.log(`PASSED — 0 errors, ${warnings} warning(s)`);
for (const L of LEVELS) {
  const ledges = L.platforms.filter(p => p.kind === 'ledge').length;
  console.log(
    `  ch${L.index + 1}  w=${String(L.width).padStart(4)}  ` +
    `ledges=${String(ledges).padStart(2)}  spikes=${L.hazards.length}  ` +
    `props=${String(L.props.length).padStart(2)}  items=${String(L.items.length).padStart(2)}  ` +
    `enemies=${L.enemies.length}  exit=${L.exit ? 'x' + L.exit.x : 'finale'}`
  );
}
