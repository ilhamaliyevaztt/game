/* ============================================================
   levels.js — 5 chapters  (geometry generated to be provably reachable)
   physics: jump height 138px, air reach ~188px (run)
   climbing steps: dy=100, dx=80  (safe margin)
   ============================================================ */
(function (global) {
  'use strict';

  const G = 470;
  const FLOOR_H = 300;
  const STEP_Y = 100;
  const STEP_X = 80;

  function floor(x, w) { return { x: x, y: G, w: w, h: FLOOR_H, kind: 'ground' }; }
  function plat(x, y, w) { return { x: x, y: y, w: w || 120, h: 20, kind: 'ledge' }; }
  function box(x, y, s) { s = s || 44; return { x: x, y: y - s, w: s, h: s, kind: 'crate' }; }
  function hazard(x, w) { return { x: x, y: G - 15, w: w, h: 15 }; }

  function floors() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) {
      const s = arguments[i];
      out.push(floor(s[0], s[1] - s[0]));
    }
    return out;
  }
  function coins(x1, x2, y, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      out.push({ type: 'coin', x: Math.round(x1 + (x2 - x1) * t), y: y });
    }
    return out;
  }
  /** three-step climb: returns { platforms, items, topY } */
  function climb(cx) {
    const l1 = plat(cx, G - STEP_Y, 130);
    const l2 = plat(cx + STEP_X, G - STEP_Y * 2, 130);
    const l3 = plat(cx + STEP_X * 2, G - STEP_Y * 3, 130);
    const items = [
      { type: 'coin', x: cx + 40, y: l1.y - 34 },
      { type: 'coin', x: cx + 95, y: l1.y - 34 },
      { type: 'coin', x: cx + STEP_X + 40, y: l2.y - 34 },
      { type: 'coin', x: cx + STEP_X + 95, y: l2.y - 34 },
      { type: 'coin', x: cx + STEP_X * 2 + 40, y: l3.y - 34 },
      { type: 'coin', x: cx + STEP_X * 2 + 95, y: l3.y - 34 }
    ];
    return { platforms: [l1, l2, l3], items: items, l1: l1, l2: l2, l3: l3 };
  }
  function cat() {
    const out = [];
    for (let i = 0; i < arguments.length; i++) if (Array.isArray(arguments[i])) out.push.apply(out, arguments[i]);
    return out;
  }
  /* ============================================================
     I — Yağışlı küçə
     ============================================================ */
  const c1 = climb(430);
  const c2 = climb(1010);
  const c3 = climb(1860);
  const c4 = climb(2620);

  const ch1 = {
    id: 'ch1',
    kicker: 'Bölmə I',
    name: 'Yağışlı küçə',
    sub: 'Axşam idi. Yağış yavaş-yavaş yağırdı.',
    bg: 'bg_pier', bgParallax: 0.34, rain: 'light', mood: 'calm', dark: 0.12,
    width: 3040,
    objective: 'Küçə ilə irəli get. Qaranlıqda tək dayanan biri var.',
    start: { x: 120, y: G },
    platforms: cat(
      floors([0, 760], [900, 1620], [1760, 2400], [2540, 3040]),
      c1.platforms, c2.platforms, c3.platforms, c4.platforms,
      [box(720, G), box(2320, G)]
    ),
    hazards: [hazard(1500, 70), hazard(2200, 70)],
    props: [
      { a: 'prop_fence', x: 90, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 250, y: G, s: 0.95 },
      { a: 'prop_bench', x: 340, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 690, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 960, y: G, s: 0.95 },
      { a: 'prop_sign', x: 1090, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1350, y: G, s: 1.0, dark: true },
      { a: 'prop_barrel2', x: 1790, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 2000, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2260, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2460, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 2800, y: G, s: 0.95 }
    ],
    items: cat(
      coins(180, 340, G - 36, 3),
      c1.items, c2.items, c3.items, c4.items,
      [{ type: 'ammo', x: c2.l3.x + 65, y: c2.l3.y - 34 }],
      [{ type: 'medkit', x: c4.l2.x + 65, y: c4.l2.y - 30 }],
      coins(1630, 1740, G - 36, 3),
      coins(2410, 2520, G - 36, 3),
      [{ type: 'note', x: 470, y: G - 30, portrait: 'i_letter', title: 'Məktub', lines: [
        { who: '', text: 'Kağızın üstündə tək bir cümlə var: “Bəzən insan sevdiyi şeyləri itirməkdən qorxur.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu əl yazısını heç yerdən tanımıram... amma içimdə nəsə titrədi.' }
      ] }]
    ),
    enemies: [],
    npcs: [
      {
        kind: 'alice', x: 2880, y: G, s: 1.15,
        talk: [
          { who: 'Leo', portrait: 'leo_0', text: 'Evə qayıdırdım. Küçə isə tamamilə boş idi.' },
          { who: 'Alice', portrait: 'alice_0', text: 'Sən də buradan keçirsən?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Sən tək? Bu soyuqda, bu yağışda?' },
          { who: 'Alice', portrait: 'alice_1', text: 'Mənim adım Alice-dir.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Leo. Sənə kömək lazımdır?' },
          { who: 'Alice', portrait: 'alice_2', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən də qorxursan?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Nəyi itirməkdən?' },
          { who: 'Alice', portrait: 'alice_0', text: 'Hələ bilmirsən. Amma tezliklə biləcəksən.' }
        ],
        after: 'O, sadəcə qəribə bir qızdır... deyəsən.'
      }
    ],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Yağış yavaş-yavaş yağırdı. Küçə lampaları bir-bir sönürdü.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Yenə gecikdim. Evə çatmaq üçün bu küçədən keçməliyəm.' }
      ] },
      { x: 1900, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu küçədə heç kim yoxdur... amma o kağızı təkrar-təkrar yada salıram.' }
      ] }
    ],
    exit: { x: 2985, y: G, to: 1 }
  };
  /* ============================================================
     II — Meşə yolu
     ============================================================ */
  const d1 = climb(470);
  const d2 = climb(1180);
  const d3 = climb(2190);
  const d4 = climb(2860);

  const ch2 = {
    id: 'ch2',
    kicker: 'Bölmə II',
    name: 'Meşə yolu',
    sub: 'Sonrakı günlərdə onlar tez-tez görüşməyə başladılar.',
    bg: 'bg_forest', bgParallax: 0.28, rain: 'light', mood: 'calm', dark: 0.2,
    width: 3440,
    objective: 'Meşədən keç. Köhnə evin qapısı qıfıllıdır — açarı tap.',
    start: { x: 110, y: G },
    platforms: cat(
      floors([0, 620], [760, 1300], [1440, 2060], [2200, 2740], [2880, 3440]),
      d1.platforms, d2.platforms, d3.platforms, d4.platforms,
      [box(1220, G), box(2500, G)]
    ),
    hazards: [hazard(1060, 72), hazard(1880, 72), hazard(2600, 72)],
    props: [
      { a: 'prop_tree', x: 160, y: G, s: 1.1 },
      { a: 'prop_fence', x: 420, y: G, s: 0.9 },
      { a: 'prop_tree', x: 820, y: G, s: 0.95, flip: true },
      { a: 'prop_barrel', x: 1150, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1320, y: G, s: 1.15, dark: true },
      { a: 'prop_sign', x: 1490, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2000, y: G, s: 1.05, flip: true },
      { a: 'prop_lamppost', x: 2230, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2960, y: G, s: 1.1, dark: true },
      { a: 'prop_fence', x: 3080, y: G, s: 0.9 },
      { a: 'prop_door', x: 3380, y: G, s: 1.05 }
    ],
    items: cat(
      coins(150, 330, G - 36, 3),
      d1.items, d2.items, d3.items, d4.items,
      [{ type: 'key', x: d2.l3.x + 65, y: d2.l3.y - 34, id: 'forest' }],
      [{ type: 'medkit', x: d4.l2.x + 65, y: d4.l2.y - 30 }],
      [{ type: 'ammo', x: d3.l3.x + 65, y: d3.l3.y - 34 }],
      coins(660, 750, G - 36, 2),
      coins(1320, 1420, G - 36, 2),
      coins(2760, 2860, G - 36, 2),
      [{ type: 'note', x: d1.l2.x + 65, y: d1.l2.y - 30, portrait: 'i_scroll', title: 'Ağacdakı qeyd', lines: [
        { who: '', text: 'Ağacın gövdəsinə bıçaqla yazılıb: “O, səni izləyir. Sən isə onu tanımırsan.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu... Alice-in əl yazısıdır?' }
      ] }]
    ),
    enemies: [
      { type: 'skull', x: 380, y: G, patrol: [250, 600], speed: 52 },
      { type: 'crawler', x: 1150, y: G, patrol: [1000, 1280], speed: 92 },
      { type: 'skull', x: 1620, y: G, patrol: [1460, 1860], speed: 58 },
      { type: 'crawler', x: 2350, y: G, patrol: [2220, 2580], speed: 96 },
      { type: 'skull', x: 3060, y: G, patrol: [2920, 3200], speed: 62 }
    ],
    npcs: [],
    triggers: [
      { x: 300, once: true, lines: [
        { who: '', text: 'Bir neçə gün keçdi. Onlar birlikdə gəzir, danışır və susurdular.' },
        { who: 'Alice', portrait: 'alice_1', text: 'Sən məni heç vaxt sorğu-sual etmirsən. Niyə?' },
        { who: 'Leo', portrait: 'leo_0', text: 'Çünki bilirəm ki, cavab məni qorxudar.' }
      ] },
      { x: 1460, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu meşədə nəsə var. Addımlarımdan başqa bir səs də eşidirəm.' }
      ] },
      { x: 3320, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Qıfıllı qapı. Açar olmadan keçə bilmərəm.' }
      ] }
    ],
    exit: { x: 3400, y: G, to: 2, needsKey: true }
  };
  /* ============================================================
     III — Köhnə ev
     ============================================================ */
  const e1 = climb(380);
  const e2 = climb(1050);
  const e3 = climb(1800);
  const e4 = climb(2440);

  const ch3 = {
    id: 'ch3',
    kicker: 'Bölmə III',
    name: 'Köhnə ev',
    sub: 'Qapı açıq, otaqlar isə bomboş idi.',
    bg: 'bg_house', bgParallax: 0.22, rain: 'off', mood: 'tense', dark: 0.34,
    width: 2820,
    objective: 'Evi axtar. Yerdə bir şəkil və qanla yazılmış bir cümlə var.',
    start: { x: 100, y: G },
    platforms: cat(
      floors([0, 700], [840, 1500], [1640, 2220], [2360, 2820]),
      e1.platforms, e2.platforms, e3.platforms, e4.platforms,
      [box(1300, G)]
    ),
    hazards: [hazard(1250, 70), hazard(2100, 70)],
    props: [
      { a: 'prop_lamppost', x: 60, y: G, s: 0.85 },
      { a: 'prop_table', x: 230, y: G, s: 1.0 },
      { a: 'prop_chair', x: 320, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 640, y: G, s: 1.15 },
      { a: 'prop_window1', x: 900, y: G - 130, s: 1.0 },
      { a: 'prop_window2', x: 960, y: G - 150, s: 1.0 },
      { a: 'prop_bookshelf', x: 1120, y: G, s: 1.1 },
      { a: 'prop_flowerpot', x: 1210, y: G, s: 1.0 },
      { a: 'prop_bed', x: 1700, y: G, s: 1.15 },
      { a: 'prop_window1', x: 2000, y: G - 140, s: 1.0 },
      { a: 'prop_plant', x: 2260, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2560, y: G, s: 1.1 },
      { a: 'prop_door', x: 2720, y: G, s: 1.05 }
    ],
    items: cat(
      coins(150, 300, G - 36, 3),
      e1.items, e2.items, e3.items, e4.items,
      [{ type: 'photo', x: e3.l3.x + 65, y: e3.l3.y - 34, portrait: 's_portrait', title: 'Şəkil', lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu... Alice-in şəklidir. Amma kağızın kənarları yanıb.' },
        { who: '', text: 'Şəklin arxasında kiçik hərflərlə yazılıb: “Məni xatırla. Məni bağışla.”' }
      ] }],
      [{ type: 'ammo', x: e2.l3.x + 65, y: e2.l3.y - 34 }],
      [{ type: 'medkit', x: e4.l2.x + 65, y: e4.l2.y - 30 }],
      coins(720, 830, G - 36, 2),
      coins(1520, 1620, G - 36, 2),
      coins(2240, 2340, G - 36, 2),
      [{ type: 'note', x: 2660, y: G - 30, portrait: 's_letter_blood', title: 'Qanla yazı', lines: [
        { who: '', text: 'Divarda qanla yazılıb: “SƏN HEÇ VAXT MƏNİ HƏQİQİQƏTƏN TANIMAMIŞSAN.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu nə deməkdir? Alice?!' },
        { who: '', text: 'Elə həmin anda arxadan qəribə bir səs eşidildi...' }
      ] }]
    ),
    enemies: [
      { type: 'crawler', x: 1000, y: G, patrol: [860, 1230], speed: 100 },
      { type: 'skull', x: 1740, y: G, patrol: [1660, 2060], speed: 56 },
      { type: 'crawler', x: 2450, y: G, patrol: [2380, 2700], speed: 108 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Həmin gecə telefonuna mesaj gəldi: “Məni tapmaq istəyirsənsə, köhnə evə gəl.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Qapı açıqdır. Otaqlar isə... bomboşdur.' }
      ] },
      { x: 1600, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu evdə heç nə yoxdur. Yalnız toz, qan və bir şəkil.' }
      ] }
    ],
    exit: { x: 2760, y: G, to: 3 }
  };
  /* ============================================================
     IV — Zirzəmi
     ============================================================ */
  const f1 = climb(430);
  const f2 = climb(1120);
  const f3 = climb(1900);
  const f4 = climb(2700);
  const f5 = climb(3200);

  const ch4 = {
    id: 'ch4',
    kicker: 'Bölmə IV',
    name: 'Zirzəmi',
    sub: 'Səs aşağıdan gəlirdi.',
    bg: 'bg_room', bgParallax: 0.18, rain: 'off', mood: 'tense', dark: 0.6,
    width: 3660,
    objective: 'İki açarı tap və çıxış qapısını aç. Qaranlıqda diqqətli ol.',
    start: { x: 100, y: G },
    platforms: cat(
      floors([0, 640], [780, 1380], [1520, 2100], [2240, 2820], [2960, 3660]),
      f1.platforms, f2.platforms, f3.platforms, f4.platforms, f5.platforms,
      [box(560, G), box(2300, G)]
    ),
    hazards: [hazard(940, 70), hazard(1980, 70), hazard(2650, 70)],
    props: [
      { a: 'prop_barrel', x: 200, y: G, s: 0.9 },
      { a: 'prop_barrel2', x: 260, y: G, s: 0.9 },
      { a: 'prop_crate', x: 400, y: G, s: 1.1 },
      { a: 'prop_lamppost', x: 820, y: G, s: 0.85 },
      { a: 'prop_bookshelf', x: 1180, y: G, s: 1.0 },
      { a: 'prop_barrel', x: 1650, y: G, s: 0.9 },
      { a: 'prop_crate', x: 2400, y: G, s: 1.0 },
      { a: 'prop_lamppost', x: 3120, y: G, s: 0.85 },
      { a: 'prop_bookshelf', x: 3420, y: G, s: 1.05 },
      { a: 'prop_door', x: 3600, y: G, s: 1.1 }
    ],
    items: cat(
      coins(150, 330, G - 36, 3),
      f1.items, f2.items, f3.items, f4.items, f5.items,
      [{ type: 'key', x: f2.l3.x + 65, y: f2.l3.y - 34, id: 'base1' }],
      [{ type: 'key', x: f4.l3.x + 65, y: f4.l3.y - 34, id: 'base2' }],
      [{ type: 'shotgun', x: f5.l2.x + 65, y: f5.l2.y - 30 }],
      [{ type: 'medkit', x: f3.l1.x + 65, y: f3.l1.y - 30 }],
      [{ type: 'ammo', x: f1.l3.x + 65, y: f1.l3.y - 34 }],
      coins(660, 760, G - 36, 2),
      coins(1400, 1500, G - 36, 2),
      coins(2120, 2220, G - 36, 2),
      coins(2840, 2940, G - 36, 2),
      [{ type: 'note', x: f1.l2.x + 65, y: f1.l2.y - 30, portrait: 's_hand', title: 'Divardakı əl izi', lines: [
        { who: '', text: 'Divarda qanlı bir əl izi var. Barmaqlar aşağıya doğru uzanır.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu əl çox kiçikdir... Alice?' }
      ] }]
    ),
    enemies: [
      { type: 'skull', x: 480, y: G, patrol: [140, 600], speed: 66 },
      { type: 'crawler', x: 1000, y: G, patrol: [800, 1360], speed: 112 },
      { type: 'skull', x: 1750, y: G, patrol: [1540, 1940], speed: 70 },
      { type: 'shadow', x: 2300, y: G - 130, speed: 74 },
      { type: 'crawler', x: 2500, y: G, patrol: [2260, 2800], speed: 118 },
      { type: 'skull', x: 3150, y: G, patrol: [2980, 3380], speed: 74 },
      { type: 'crawler', x: 3450, y: G, patrol: [3000, 3620], speed: 120 }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Pilləkən aşağıya, tam qaranlığa aparırdı. Aşağıdan nəm və pas iyi gəlirdi.' },
        { who: 'Leo', portrait: 'leo_0', text: 'İşıq yoxdur... Amma geri qayıtmaq olmaz.' }
      ] },
      { x: 1450, once: true, lines: [
        { who: '', text: 'Küncdən sürünən bir kölgə keçdi.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Onlar... məni görürlər.' }
      ] },
      { x: 3520, once: true, lines: [
        { who: 'Alice', portrait: 'alice_ghost', text: 'Sən gəldin. Mən bilirdim ki, gələcəksən.' }
      ] }
    ],
    exit: { x: 3610, y: G, to: 4, needsKeys: 2 }
  };
  /* ============================================================
     V — Son
     ============================================================ */
  const h1 = climb(450);
  const h2 = climb(1180);
  const h3 = climb(1830);

  const ch5 = {
    id: 'ch5',
    kicker: 'Bölmə V',
    name: 'Son',
    sub: '“Sən heç vaxt məni həqiqətən tanımamısan.”',
    bg: 'bg_street', bgParallax: 0.30, dark: 0.42, rain: 'heavy', mood: 'tense',
    width: 2560,
    objective: 'Alice ilə üz-üzə gəl.',
    start: { x: 100, y: G },
    platforms: cat(
      floors([0, 820], [960, 1580], [1720, 2560]),
      h1.platforms, h2.platforms, h3.platforms,
      [box(1500, G)]
    ),
    hazards: [hazard(1180, 70)],
    props: [
      { a: 'prop_lamppost', x: 200, y: G, s: 0.95 },
      { a: 'prop_bench', x: 300, y: G, s: 0.9 },
      { a: 'prop_sign', x: 700, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 1000, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1450, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 1900, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2150, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2260, y: G, s: 0.9 }
    ],
    items: cat(
      coins(160, 340, G - 36, 3),
      h1.items, h2.items, h3.items,
      [{ type: 'shotgun', x: h1.l2.x + 65, y: h1.l2.y - 30 }],
      [{ type: 'ammo', x: h1.l3.x + 65, y: h1.l3.y - 34 }],
      [{ type: 'ammo', x: h2.l2.x + 65, y: h2.l2.y - 30 }],
      [{ type: 'medkit', x: h3.l2.x + 65, y: h3.l2.y - 30 }],
      coins(830, 940, G - 36, 2),
      coins(1600, 1700, G - 36, 2),
      coins(2000, 2120, G - 36, 3)
    ),
    enemies: [
      { type: 'shadow', x: 1120, y: G - 140, speed: 76 },
      { type: 'crawler', x: 1400, y: G, patrol: [1000, 1560], speed: 124 },
      { type: 'shadow', x: 1660, y: G - 160, speed: 84 },
      { type: 'bride', x: 2020, y: G, hp: 12, speed: 58 }
    ],
    npcs: [
      {
        kind: 'alice_ghost', x: 2380, y: G, s: 1.1, final: true,
        talk: [
          { who: 'Alice', portrait: 'alice_ghost', text: 'Sən hələ də məni axtarırsan?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Sən kimsən? Sən əslində kim idin?' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Mən sənin itirdiyin şeyəm. Sən məni xatırlamaq istəmədin.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Yalan deyirsən. Mən səni...' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən isə itirməkdənsə, unutmağı seçdin.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Alice... məni bağışla.' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Artıq gecdir. Amma sən hələ də nəfəs alırsan. Bu kifayətdir.' }
        ]
      }
    ],
    triggers: [
      { x: 200, once: true, lines: [
        { who: '', text: 'Küçə qırmızı işığa bürünmüşdü. Yağış artıq tufan idi.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Alice... haradasan?' }
      ] },
      { x: 1250, once: true, lines: [
        { who: '', text: 'Addımlarımın arxasınca başqa addımlar da eşidilirdi.' }
      ] }
    ],
    exit: null
  };
  const LEVELS = [ch1, ch2, ch3, ch4, ch5];
  LEVELS.forEach(function (L, i) {
    L.index = i;
    L.spawn = L.start;
    L.props = L.props || []; L.enemies = L.enemies || [];
    L.npcs = L.npcs || []; L.triggers = L.triggers || [];
    L.hazards = L.hazards || []; L.items = L.items || [];
    if (!L.dark) L.dark = 0;
  });

  const ENDING = {
    title: 'Sən hələ də məni axtarırsan?',
    body: [
      'Leo dizləri üstünə çökdü. Yağış onun üzünü yudu, amma qəlbindəki ləkə getmədi.',
      'Alice-in sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
      'Səhər açılanda küçədə yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
      'Məktubun içində tək bir cümlə var idi:',
      '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
      'Leo o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
      'Çünki bəzən kömək istəmək — sadəcə xatırlamaq deməkdir.',
      '<em>— Son —</em>'
    ]
  };

  global.GameLevels = LEVELS;
  global.GameEnding = ENDING;
})(window);
