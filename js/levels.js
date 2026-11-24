/* ============================================================
   levels.js — 7 chapters, BDU story
   physics contract: jump height ~138px, run air reach ~188px
   climbing steps: dy=100, dx=80 (safe margin)
   ground surface y = 470
   ============================================================ */
(function (global) {
  'use strict';

  var G = 470;
  var FLOOR_H = 300;
  var STEP_Y = 100;
  var STEP_X = 80;

  function floor(x, w) { return { x: x, y: G, w: w, h: FLOOR_H, kind: 'ground' }; }
  function plat(x, y, w) { return { x: x, y: y, w: w || 120, h: 20, kind: 'ledge' }; }
  function box(x, y, s) { s = s || 44; return { x: x, y: y - s, w: s, h: s, kind: 'crate' }; }
  function hazard(x, w) { return { x: x, y: G - 15, w: w, h: 15 }; }

  /** floors([x1,x2],[x3,x4],...) -> solid ground segments with gaps */
  function floors() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      var s = arguments[i];
      out.push(floor(s[0], s[1] - s[0]));
    }
    return out;
  }
  function coins(x1, x2, y, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      out.push({ type: 'coin', x: Math.round(x1 + (x2 - x1) * t), y: y });
    }
    return out;
  }
  function climb(cx) {
    var l1 = plat(cx, G - STEP_Y, 130);
    var l2 = plat(cx + STEP_X, G - STEP_Y * 2, 130);
    var l3 = plat(cx + STEP_X * 2, G - STEP_Y * 3, 130);
    return {
      platforms: [l1, l2, l3],
      l1: l1, l2: l2, l3: l3,
      items: [
        { type: 'coin', x: cx + 40, y: l1.y - 34 },
        { type: 'coin', x: cx + 95, y: l1.y - 34 },
        { type: 'coin', x: cx + STEP_X + 40, y: l2.y - 34 },
        { type: 'coin', x: cx + STEP_X + 95, y: l2.y - 34 },
        { type: 'coin', x: cx + STEP_X * 2 + 40, y: l3.y - 34 },
        { type: 'coin', x: cx + STEP_X * 2 + 95, y: l3.y - 34 }
      ]
    };
  }
  function cat() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      if (Array.isArray(arguments[i])) out.push.apply(out, arguments[i]);
    }
    return out;
  }

  /* ============================================================
     I — Yağışlı Bakı
     ============================================================ */
  var a1 = climb(400), a2 = climb(980), a3 = climb(1720), a4 = climb(2420);

  var ch1 = {
    id: 'ch1',
    kicker: 'Bölmə I',
    name: 'Yağışlı Bakı',
    sub: 'Axşam idi. Yağış yavaş-yavaş yağırdı.',
    bg: 'bg_baku', bgParallax: 0.34, rain: 'light', mood: 'calm', dark: 0.14,
    width: 3120,
    objective: 'Bulvar boyu irəli get. Fənərlərin altında tək dayanan biri var.',
    start: { x: 120, y: G },
    checkpoints: [400, 1000, 1800, 2500],
    platforms: cat(
      floors([0, 760], [900, 1620], [1760, 2400], [2540, 3120]),
      a1.platforms, a2.platforms, a3.platforms, a4.platforms,
      [box(720, G), box(2280, G)]
    ),
    hazards: [hazard(1520, 70), hazard(2180, 70)],
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
      { a: 'prop_plant', x: 2650, y: G, s: 0.85 },
      { a: 'prop_lamppost', x: 2860, y: G, s: 0.95 }
    ],
    items: cat(
      coins(180, 340, G - 36, 4),
      a1.items, a2.items, a3.items, a4.items,
      [{ type: 'ammo', x: a2.l3.x + 65, y: a2.l3.y - 34 }],
      [{ type: 'medkit', x: a4.l2.x + 65, y: a4.l2.y - 30 }],
      coins(1630, 1740, G - 36, 3),
      coins(2410, 2520, G - 36, 3),
      { type: 'note', x: 500, y: G - 30, icon: 'i_letter', title: 'Məktub', lines: [
        { who: '', text: 'Bulvar skamyasının üstündə bir vərəq var. Yağış mürəkkəbi axıdıb, amma bir cümlə hələ oxunur:' },
        { who: '', text: '“Bəzən insan sevdiyi şeyləri itirməkdən qorxur.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu əl yazısı... Bunu mən yazmışam. Nə vaxt?' }
      ] },
      { type: 'phone', x: 1250, y: G - 28, icon: 'u_phone', title: 'Telefon', lines: [
        { who: '', text: 'Ekranda tanımadığım bir nömrədən mesaj var. Vaxt: bu gecə, 03:14.' },
        { who: '???', portrait: 'u_phone_alice', text: 'Sən hələ də məni axtarırsan?' },
        { who: 'Leo', portrait: 'leo_0', text: 'Kimdir bu? Nömrə... mövcud deyil.' }
      ] }
    ),
    enemies: [],
    npcs: [
      {
        kind: 'alice', sprite: 'alice_a0', x: 2940, y: G, s: 1.0,
        gift: true,
        talk: [
          { who: 'Leo', portrait: 'leo_0', text: 'Evə qayıdırdım. Bulvar isə tamamilə boş idi.' },
          { who: 'Alice', portrait: 'alice_a0', text: 'Sən də buradan keçirsən?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Sən tək? Bu soyuqda, bu yağışda?' },
          { who: 'Alice', portrait: 'alice_a1', text: 'Mənim adım Alice-dir. Sən isə Leo. Bilirəm.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Hardan bilirsən?' },
          { who: 'Alice', portrait: 'alice_a2', text: 'Çünki mən səni çoxdan tanıyıram. Sən isə məni... yenicə xatırlayırsan.' },
          { who: 'Alice', portrait: 'alice_a0', text: 'Sabah universitetə gəl. Kafedranın qabağında gözləyəcəyəm.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Universitet? Amma indi tətil deyil ki...' },
          { who: 'Alice', portrait: 'alice_a1', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən də qorxursan?' }
        ],
        after: 'O, yağışın içində əridi — sanki heç olmamışdı.'
      }
    ],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Yağış yavaş-yavaş yağırdı. Fənərlər bir-bir sönürdü.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Yenə gecikdim. Yataqxanaya çatmaq üçün bu bulvardan keçməliyəm.' },
        { who: '', text: 'Cibimdə telefon titrədi. Ekran işığında yalnız bir sətir göründü...' }
      ] },
      { x: 1960, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu bulvarda hər gecə eyni qoxu var: yağış, dəniz və köhnə kağız.' },
        { who: '', text: 'Nə qədər ki, bu yolu tanıyıram — bir o qədər də yad görünür.' }
      ] }
    ],
    exit: { x: 3040, y: G, to: 1 }
  };

  /* ============================================================
     II — BDU həyəti
     ============================================================ */
  var b1 = climb(460), b2 = climb(1180), b3 = climb(1980), b4 = climb(2820);

  var ch2 = {
    id: 'ch2',
    kicker: 'Bölmə II',
    name: 'BDU həyəti',
    sub: 'Universitetin həyəti gecə daha böyük görünür.',
    bg: 'bg_bdu', bgParallax: 0.26, rain: 'light', mood: 'tense', dark: 0.2,
    width: 3520,
    objective: 'Həyətdən keç. Baş binanın qapısı qıfıllıdır — açarı tap.',
    start: { x: 110, y: G },
    checkpoints: [520, 1240, 2050, 2900],
    platforms: cat(
      floors([0, 620], [760, 1300], [1440, 2060], [2200, 2740], [2880, 3520]),
      b1.platforms, b2.platforms, b3.platforms, b4.platforms,
      [box(1200, G), box(2500, G)]
    ),
    hazards: [hazard(1060, 72), hazard(1880, 72), hazard(2600, 72)],
    props: [
      { a: 'prop_tree', x: 160, y: G, s: 1.1 },
      { a: 'prop_fence', x: 420, y: G, s: 0.9 },
      { a: 'prop_flowerpot', x: 520, y: G, s: 0.9 },
      { a: 'prop_tree', x: 820, y: G, s: 0.95, flip: true },
      { a: 'prop_barrel', x: 1150, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1320, y: G, s: 1.15, dark: true },
      { a: 'prop_sign', x: 1490, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 1700, y: G, s: 1.0 },
      { a: 'prop_tree', x: 2010, y: G, s: 1.05, flip: true },
      { a: 'prop_lamppost', x: 2230, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2420, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2960, y: G, s: 1.1, dark: true },
      { a: 'prop_fence', x: 3080, y: G, s: 0.9 },
      { a: 'prop_door', x: 3460, y: G, s: 1.05 }
    ],
    items: cat(
      coins(150, 330, G - 36, 4),
      b1.items, b2.items, b3.items, b4.items,
      [{ type: 'key', x: b2.l3.x + 65, y: b2.l3.y - 34, id: 'bdu' }],
      [{ type: 'medkit', x: b4.l2.x + 65, y: b4.l2.y - 30 }],
      [{ type: 'ammo', x: b3.l3.x + 65, y: b3.l3.y - 34 }],
      coins(660, 750, G - 36, 2),
      coins(1320, 1420, G - 36, 2),
      coins(2760, 2860, G - 36, 2),
      { type: 'note', x: b1.l2.x + 65, y: b1.l2.y - 30, icon: 'i_scroll', title: 'Divardakı elan', lines: [
        { who: '', text: 'Elan lövhəsi: “314-cü auditoriya təmirə görə bağlıdır. Heç kim girməsin.”' },
        { who: '', text: 'Aşağıda kiminsə əli ilə yazılıb: “O, hələ də orada gözləyir.”' },
        { who: 'Leo', portrait: 'leo_0', text: '314... Bu rəqəm mənim yuxularımda da var.' }
      ] }
    ),
    enemies: [
      { type: 'skull', x: 380, y: G, patrol: [250, 600], speed: 54 },
      { type: 'crawler', x: 1150, y: G, patrol: [1000, 1280], speed: 92 },
      { type: 'stalker', x: 1620, y: G, patrol: [1460, 1860], speed: 60 },
      { type: 'hound', x: 2350, y: G, patrol: [2220, 2580], speed: 128 },
      { type: 'skull', x: 3060, y: G, patrol: [2920, 3200], speed: 62 }
    ],
    npcs: [],
    triggers: [
      { x: 300, once: true, lines: [
        { who: '', text: 'Darvazada lövhə: “BAKI DÖVLƏT UNİVERSİTETİ · 1919”.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Dörd ildir bu həyətdən keçirəm. Amma heç vaxt bu qədər sakit olmamışdı.' },
        { who: 'Alice', portrait: 'alice_a1', text: 'Sən məni heç vaxt sorğu-sual etmirsən. Niyə?' },
        { who: 'Leo', portrait: 'leo_0', text: 'Çünki bilirəm ki, cavab məni qorxudar.' }
      ] },
      { x: 1460, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Ayaq səsimdən başqa bir səs də eşidirəm. Arxa tərəfdə. Həmişə iki addım arxada.' }
      ] },
      { x: 3400, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Baş binanın qapısı. Qıfıllıdır. Açar olmadan keçə bilmərəm.' }
      ] }
    ],
    exit: { x: 3480, y: G, to: 2, needsKey: true }
  };
  /* ============================================================
     III — Universitet dəhlizi
     ============================================================ */
  var c1 = climb(380), c2 = climb(1060), c3 = climb(1840), c4 = climb(2560);

  var ch3 = {
    id: 'ch3',
    kicker: 'Bölmə III',
    name: 'Universitet dəhlizi',
    sub: 'Dəhlizlər gecə uzanır, qapılar isə yad adlar daşıyır.',
    bg: 'bg_campus', bgParallax: 0.2, rain: 'off', mood: 'tense', dark: 0.36,
    width: 3300,
    objective: 'Dəhlizlə irəli get. İki açar — iki qıfıllı qapı. Divardakı yazıları oxu.',
    start: { x: 100, y: G },
    checkpoints: [440, 1120, 1900, 2620],
    platforms: cat(
      floors([0, 700], [840, 1500], [1640, 2220], [2360, 3300]),
      c1.platforms, c2.platforms, c3.platforms, c4.platforms,
      [box(1300, G), box(2900, G)]
    ),
    hazards: [hazard(1250, 70), hazard(2100, 70), hazard(2740, 70)],
    props: [
      { a: 'prop_lamppost', x: 60, y: G, s: 0.85 },
      { a: 'prop_bookshelf', x: 250, y: G, s: 1.15 },
      { a: 'prop_bench', x: 400, y: G, s: 0.9 },
      { a: 'prop_window1', x: 620, y: G - 130, s: 1.0 },
      { a: 'prop_window2', x: 690, y: G - 150, s: 1.0 },
      { a: 'prop_bookshelf', x: 900, y: G, s: 1.1 },
      { a: 'prop_flowerpot', x: 1010, y: G, s: 0.95 },
      { a: 'prop_plant', x: 1180, y: G, s: 0.95 },
      { a: 'prop_bookshelf', x: 1560, y: G, s: 1.1 },
      { a: 'prop_window1', x: 1780, y: G - 140, s: 1.0 },
      { a: 'prop_bench', x: 2000, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2260, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2520, y: G, s: 1.1 },
      { a: 'prop_window2', x: 2760, y: G - 150, s: 1.0 },
      { a: 'prop_bookshelf', x: 3060, y: G, s: 1.1 },
      { a: 'prop_door', x: 3220, y: G, s: 1.05 }
    ],
    items: cat(
      coins(150, 300, G - 36, 4),
      c1.items, c2.items, c3.items, c4.items,
      [{ type: 'key', x: c2.l3.x + 65, y: c2.l3.y - 34, id: 'k1' }],
      [{ type: 'key', x: c4.l3.x + 65, y: c4.l3.y - 34, id: 'k2' }],
      [{ type: 'ammo', x: c1.l3.x + 65, y: c1.l3.y - 34 }],
      [{ type: 'ammo', x: c3.l2.x + 65, y: c3.l2.y - 30 }],
      [{ type: 'medkit', x: c3.l3.x + 65, y: c3.l3.y - 30 }],
      coins(720, 830, G - 36, 2),
      coins(1520, 1620, G - 36, 2),
      coins(2240, 2340, G - 36, 2),
      { type: 'photo', x: c1.l2.x + 65, y: c1.l2.y - 30, icon: 's_portrait', title: 'Şəkil', lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu şəkil... 314-cü auditoriya. Cərgədə oturanlar arasında mən də varam.' },
        { who: '', text: 'Yanımda bir qız oturub. Üzü qələmlə cızılıb — sanki kimsə onu silmək istəyib.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Arxasında yazılıb: “Məni xatırla. Məni bağışla.”' }
      ] },
      { type: 'phone', x: 2150, y: G - 28, icon: 'u_phone', title: 'Mesaj', lines: [
        { who: '', text: 'Yenə həmin nömrə. Bu dəfə iki mesaj.' },
        { who: '???', portrait: 'u_phone_alice', text: '314-cü auditoriyaya gəl.' },
        { who: '???', portrait: 'u_phone_alice', text: 'Qorxma. Mən səni gözləyirəm.' }
      ] },
      { type: 'note', x: 3120, y: G - 30, icon: 's_letter_blood', title: 'Divar yazısı', lines: [
        { who: '', text: 'Divarda qanla yazılıb: “SƏN HEÇ VAXT MƏNİ HƏQİQƏTƏN TANIMAMIŞSAN.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu nə deməkdir? Alice?!' },
        { who: '', text: 'Dəhlizin sonunda bir qapı çırpıldı.' }
      ] }
    ),
    enemies: [
      { type: 'crouch', x: 1000, y: G, patrol: [860, 1230], speed: 96 },
      { type: 'hound', x: 1400, y: G, patrol: [1300, 1560], speed: 140 },
      { type: 'skull', x: 1740, y: G, patrol: [1660, 2060], speed: 58 },
      { type: 'shadow', x: 2300, y: G - 150, speed: 78 },
      { type: 'crouch', x: 2500, y: G, patrol: [2380, 2700], speed: 104 },
      { type: 'stalker', x: 2860, y: G, patrol: [2720, 3060], speed: 64 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Dəhlizin işıqları nəfəs alırmış kimi yanıb-sönür.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Burada dərsə gəlmişəm, yüz dəfə. Amma indi qapı nömrələri... düzülmür.' },
        { who: '', text: '101, 102, 314, 102. Sonra yenə 314.' }
      ] },
      { x: 1600, once: true, lines: [
        { who: 'Leo', portrait: 'leo_0', text: 'Bu dəhlizdə heç nə yoxdur. Yalnız toz, köhnə kağız və qan.' },
        { who: 'Alice', portrait: 'alice_a2', text: 'Yoxdur? Sən sadəcə baxmaq istəmirsən.' }
      ] }
    ],
    exit: { x: 3260, y: G, to: 3, needsKeys: 2 }
  };
  /* ============================================================
     IV — Auditoriya 314
     ============================================================ */
  var d1 = climb(400), d2 = climb(1080), d3 = climb(1820), d4 = climb(2460);

  var ch4 = {
    id: 'ch4',
    kicker: 'Bölmə IV',
    name: 'Auditoriya 314',
    sub: 'Bu otaqda bir dəfə çox vacib bir şey deyilməli idi.',
    bg: 'bg_class', bgParallax: 0.16, rain: 'off', mood: 'calm', dark: 0.3,
    width: 2960,
    objective: 'Auditoriyanın o biri ucuna çat. Partaların üstündə xatirələr qalıb.',
    start: { x: 100, y: G },
    checkpoints: [460, 1140, 1880, 2520],
    platforms: cat(
      floors([0, 700], [840, 1480], [1620, 2180], [2320, 2960]),
      d1.platforms, d2.platforms, d3.platforms, d4.platforms,
      [box(1320, G), box(2760, G)]
    ),
    hazards: [hazard(1220, 70), hazard(2060, 70)],
    props: [
      { a: 'prop_lamppost', x: 70, y: G, s: 0.8 },
      { a: 'prop_table', x: 230, y: G, s: 1.0 },
      { a: 'prop_chair', x: 320, y: G, s: 1.0 },
      { a: 'prop_table', x: 520, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 660, y: G, s: 1.15 },
      { a: 'prop_window1', x: 900, y: G - 130, s: 1.0 },
      { a: 'prop_window2', x: 960, y: G - 150, s: 1.0 },
      { a: 'prop_table', x: 1150, y: G, s: 1.0 },
      { a: 'prop_flowerpot', x: 1240, y: G, s: 1.0 },
      { a: 'prop_table', x: 1560, y: G, s: 1.0 },
      { a: 'prop_chair', x: 1660, y: G, s: 1.0 },
      { a: 'prop_bed', x: 1900, y: G, s: 1.15 },
      { a: 'prop_window1', x: 2100, y: G - 140, s: 1.0 },
      { a: 'prop_plant', x: 2300, y: G, s: 1.0 },
      { a: 'prop_table', x: 2500, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2700, y: G, s: 1.1 },
      { a: 'prop_door', x: 2880, y: G, s: 1.05 }
    ],
    items: cat(
      coins(150, 300, G - 36, 4),
      d1.items, d2.items, d3.items, d4.items,
      [{ type: 'photo', x: d3.l3.x + 65, y: d3.l3.y - 34, icon: 's_portrait', title: 'Parta üstündəki şəkil', lines: [
        { who: '', text: 'Şəkildə iki əl görünür. Biri dəftər tutur, digəri çiçək.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Mən bu çiçəyi... ona vermək istəmişdim. Amma heç vaxt vermədim.' },
        { who: 'Alice', portrait: 'alice_a1', text: 'Sən həmişə bir gün daha gözləyirdin. Bir gün daha. Sonra heç bir gün qalmadı.' }
      ] }],
      [{ type: 'ammo', x: d2.l3.x + 65, y: d2.l3.y - 34 }],
      [{ type: 'medkit', x: d4.l2.x + 65, y: d4.l2.y - 30 }],
      coins(720, 830, G - 36, 2),
      coins(1520, 1620, G - 36, 2),
      coins(2200, 2300, G - 36, 2),
      { type: 'note', x: d1.l2.x + 65, y: d1.l2.y - 30, icon: 'u_msgbox', title: 'Lövhədə', lines: [
        { who: '', text: 'Lövhədə təbaşir ilə yazılıb: “San hələ də məni axtarırsan?”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu yazı bugünkü deyil. Tozun altından çıxır — illərlə buradadır.' },
        { who: '', text: 'Və altında, daha kiçik hərflərlə: “Mən də səni.”' }
      ] }
    ),
    enemies: [
      { type: 'hound', x: 1150, y: G, patrol: [860, 1240], speed: 132 },
      { type: 'crouch', x: 1700, y: G, patrol: [1640, 2000], speed: 100 },
      { type: 'lurk', x: 2400, y: G, patrol: [2340, 2700], speed: 92 },
      { type: 'shadow', x: 2000, y: G - 160, speed: 74 }
    ],
    npcs: [
      {
        kind: 'alice', sprite: 'alice_a2', x: 2820, y: G, s: 1.0,
        gift: true,
        talk: [
          { who: 'Alice', portrait: 'alice_a2', text: 'Sən gəldin. Mən də elə bilirdim ki, gəlməyəcəksən.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Alice... sən buradasan? Dörd ildir?' },
          { who: 'Alice', portrait: 'alice_a1', text: 'Dörd il? Sən neçə dəfə bu auditoriyadan keçdin, Leo?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Bilmirəm. Çox.' },
          { who: 'Alice', portrait: 'alice_a2', text: 'Hər dəfə başını aşağı salırdın. Hər dəfə bir addım sürətlənirdin.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Mən... qorxdum. Sənə deməyə qorxdum.' },
          { who: 'Alice', portrait: 'alice_a0', text: 'Bilirəm. Amma qorxmaq cinayət deyil. Susmaq isə... yarımçıq qalan şeydir.' },
          { who: 'Alice', portrait: 'alice_a1', text: 'Aşağıda, arxivdə bir şey qoydum. Sənin üçün. Get.' }
        ],
        after: 'O, bir dəfə gülümsədi — və otaq işıqlandı.'
      }
    ],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Qapının üstündə: “314”. Altında kiçik bir kağız yapışdırılıb: “Burada bir dəfə bir qız gözlədi.”' },
        { who: 'Leo', portrait: 'leo_0', text: 'Mən bu otaqda otuz iki dəfə imtahan verdim. Və bir dəfə də... cavab vermədim.' }
      ] },
      { x: 1560, once: true, lines: [
        { who: '', text: 'Partaların üstündə toz qatı var. Amma bir partanın üstü təmizdir — sanki kimsə indicə qalxıb.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu, mənim yerim idi. Yanımdakı yer isə... heç vaxt boş olmamışdı.' }
      ] }
    ],
    exit: { x: 2900, y: G, to: 4 }
  };
  /* ============================================================
     V — Arxiv zirzəmisi
     ============================================================ */
  var e1 = climb(420), e2 = climb(1120), e3 = climb(1900), e4 = climb(2680), e5 = climb(3260);

  var ch5 = {
    id: 'ch5',
    kicker: 'Bölmə V',
    name: 'Arxiv zirzəmisi',
    sub: 'Səs aşağıdan gəlirdi — kağız, pas və nəfəs.',
    bg: 'bg_room', bgParallax: 0.18, rain: 'off', mood: 'tense', dark: 0.62,
    width: 3720,
    objective: 'İki açarı tap, çıxış qapısını aç. Qaranlıqda lampanı saxla.',
    start: { x: 100, y: G },
    checkpoints: [480, 1180, 1960, 2740, 3320],
    platforms: cat(
      floors([0, 640], [780, 1380], [1520, 2100], [2240, 2820], [2960, 3720]),
      e1.platforms, e2.platforms, e3.platforms, e4.platforms, e5.platforms,
      [box(560, G), box(2300, G)]
    ),
    hazards: [hazard(940, 70), hazard(1980, 70), hazard(2650, 70), hazard(3060, 70)],
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
      { a: 'prop_door', x: 3660, y: G, s: 1.1 }
    ],
    items: cat(
      coins(150, 330, G - 36, 4),
      e1.items, e2.items, e3.items, e4.items, e5.items,
      [{ type: 'key', x: e2.l3.x + 65, y: e2.l3.y - 34, id: 'a1' }],
      [{ type: 'key', x: e4.l3.x + 65, y: e4.l3.y - 34, id: 'a2' }],
      [{ type: 'shotgun', x: e5.l2.x + 65, y: e5.l2.y - 30 }],
      [{ type: 'medkit', x: e3.l1.x + 65, y: e3.l1.y - 30 }],
      [{ type: 'medkit', x: e5.l1.x + 65, y: e5.l1.y - 30 }],
      [{ type: 'ammo', x: e1.l3.x + 65, y: e1.l3.y - 34 }],
      [{ type: 'ammo', x: e4.l1.x + 65, y: e4.l1.y - 34 }],
      coins(660, 760, G - 36, 2),
      coins(1400, 1500, G - 36, 2),
      coins(2120, 2220, G - 36, 2),
      coins(2840, 2940, G - 36, 2),
      { type: 'note', x: e1.l2.x + 65, y: e1.l2.y - 30, icon: 's_hand', title: 'Divardakı əl izi', lines: [
        { who: '', text: 'Divarda qanlı bir əl izi var. Barmaqlar aşağıya doğru uzanır.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu əl çox kiçikdir... Alice?' },
        { who: '', text: 'Əlin altında rəqəmlər: 03 · 14' }
      ] },
      { type: 'note', x: 3000, y: G - 30, icon: 'i_letter', title: 'Qovluq', lines: [
        { who: '', text: 'Tozlu qovluqda bir sənəd: “Tələbə Alice M. — 314-cü qrup. Status: akademik məzuniyyət.”' },
        { who: '', text: 'Tarix: bu gündən dörd il əvvəl.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Məzuniyyət? Amma heç kim mənə demədi... Mən niyə xatırlamıram?' }
      ] }
    ),
    enemies: [
      { type: 'skull', x: 480, y: G, patrol: [140, 600], speed: 66 },
      { type: 'crawler', x: 1000, y: G, patrol: [800, 1360], speed: 112 },
      { type: 'stalker', x: 1750, y: G, patrol: [1540, 1940], speed: 72 },
      { type: 'shadow', x: 2300, y: G - 130, speed: 80 },
      { type: 'crawler', x: 2500, y: G, patrol: [2260, 2800], speed: 118 },
      { type: 'horn', x: 3150, y: G, patrol: [2980, 3380], speed: 74 },
      { type: 'crouch', x: 3480, y: G, patrol: [3020, 3640], speed: 116 }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Pilləkən aşağıya, tam qaranlığa aparırdı. Aşağıdan nəm və pas iyi gəlirdi.' },
        { who: 'Leo', portrait: 'leo_0', text: 'İşıq yoxdur... Amma geri qayıtmaq olmaz. O dedi ki, burada bir şey qoyub.' }
      ] },
      { x: 1450, once: true, lines: [
        { who: '', text: 'Küncdən sürünən bir kölgə keçdi. Sonra ikinci. Sonra on.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Onlar... məni görürlər. Və qaçmırlar.' }
      ] },
      { x: 3560, once: true, lines: [
        { who: 'Alice', portrait: 'alice_corrupt', text: 'Sən gəldin. Mən bilirdim ki, gələcəksən.' }
      ] }
    ],
    exit: { x: 3690, y: G, to: 5, needsKeys: 2 }
  };
  /* ============================================================
     VI — Kölgə Alice
     ============================================================ */
  var f1 = climb(420), f2 = climb(1120), f3 = climb(1780), f4 = climb(2400);

  var ch6 = {
    id: 'ch6',
    kicker: 'Bölmə VI',
    name: 'Kölgə Alice',
    sub: '“Sən məni xatırlamaq istəmədin. Mən də səni unutdum.”',
    bg: 'bg_campus', bgParallax: 0.28, rain: 'heavy', mood: 'tense', dark: 0.5,
    width: 3000,
    objective: 'Kölgəni dayandır. Qaçmaq mümkün deyil — döyüş.',
    start: { x: 100, y: G },
    checkpoints: [460, 1180, 1860, 2460],
    platforms: cat(
      floors([0, 820], [960, 1580], [1720, 2400], [2540, 3000]),
      f1.platforms, f2.platforms, f3.platforms, f4.platforms,
      [box(1500, G), box(2600, G)]
    ),
    hazards: [hazard(1180, 70), hazard(2200, 70)],
    props: [
      { a: 'prop_lamppost', x: 200, y: G, s: 0.95 },
      { a: 'prop_bench', x: 300, y: G, s: 0.9 },
      { a: 'prop_sign', x: 700, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 1000, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1450, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 1900, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2150, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2260, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2800, y: G, s: 1.1, dark: true }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      f1.items, f2.items, f3.items, f4.items,
      [{ type: 'ammo', x: f1.l3.x + 65, y: f1.l3.y - 34 }],
      [{ type: 'ammo', x: f2.l2.x + 65, y: f2.l2.y - 30 }],
      [{ type: 'medkit', x: f3.l3.x + 65, y: f3.l3.y - 30 }],
      [{ type: 'medkit', x: f4.l2.x + 65, y: f4.l2.y - 30 }],
      coins(830, 940, G - 36, 2),
      coins(1600, 1700, G - 36, 2),
      coins(2020, 2140, G - 36, 3)
    ),
    enemies: [
      { type: 'shadow', x: 1120, y: G - 140, speed: 80 },
      { type: 'hound', x: 1400, y: G, patrol: [1000, 1560], speed: 140 },
      { type: 'veil', x: 1700, y: G - 60, speed: 78 },
      { type: 'shadow', x: 2000, y: G - 170, speed: 88 },
      { type: 'alicecorrupt', x: 2620, y: G, hp: 16, speed: 82, boss: true }
    ],
    npcs: [],
    triggers: [
      { x: 220, once: true, lines: [
        { who: '', text: 'Həyət qırmızı işığa bürünmüşdü. Yağış artıq tufan idi.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Alice... haradasan?' },
        { who: 'Alice', portrait: 'alice_corrupt', text: 'Səncə mən heç vaxt burada olmamışam?' }
      ] },
      { x: 1240, once: true, lines: [
        { who: '', text: 'Addımlarımın arxasınca başqa addımlar da eşidilirdi. Sonra dayandı.' },
        { who: 'Alice', portrait: 'alice_corrupt', text: 'Bəs niyə dörd il gözlədim, Leo? Niyə?' }
      ] },
      { x: 2400, once: true, lines: [
        { who: 'Alice', portrait: 'alice_corrupt', text: 'Daha qaçma. Mən səni bu dəfə buraxmayacağam.' }
      ] }
    ],
    exit: { x: 2920, y: G, to: 6, afterBoss: true }
  };
  /* ============================================================
     VII — Oyanış
     ============================================================ */
  var g1 = climb(420), g2 = climb(1120), g3 = climb(1760);

  var ch7 = {
    id: 'ch7',
    kicker: 'Bölmə VII',
    name: 'Oyanış',
    sub: '“Həqiqət göz kimidir — baxmaqdan qaçmaq olmur.”',
    bg: 'bg_baku', bgParallax: 0.3, rain: 'heavy', mood: 'tense', dark: 0.44,
    width: 2760,
    objective: 'Gözə bax. Qaçma. Bu, son qapıdır.',
    start: { x: 100, y: G },
    checkpoints: [460, 1180, 1800],
    platforms: cat(
      floors([0, 820], [960, 1580], [1720, 2760]),
      g1.platforms, g2.platforms, g3.platforms,
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
      { a: 'prop_bench', x: 2300, y: G, s: 0.9 }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      g1.items, g2.items, g3.items,
      [{ type: 'ammo', x: g1.l3.x + 65, y: g1.l3.y - 34 }],
      [{ type: 'ammo', x: g2.l2.x + 65, y: g2.l2.y - 30 }],
      [{ type: 'medkit', x: g2.l3.x + 65, y: g2.l3.y - 30 }],
      [{ type: 'medkit', x: g3.l2.x + 65, y: g3.l2.y - 30 }],
      coins(830, 940, G - 36, 2),
      coins(1600, 1700, G - 36, 2)
    ),
    enemies: [
      { type: 'eye2', x: 2280, y: G - 120, hp: 22, speed: 70, boss: true, final: true },
      { type: 'veil', x: 1400, y: G - 80, speed: 76 },
      { type: 'shadow', x: 1100, y: G - 150, speed: 82 }
    ],
    npcs: [
      {
        kind: 'alice_ghost', sprite: 'alice_ghost', x: 2620, y: G, s: 1.05, final: true, gift: true,
        talk: [
          { who: 'Alice', portrait: 'alice_ghost', text: 'Sən hələ də məni axtarırsan?' },
          { who: 'Leo', portrait: 'leo_0', text: 'Sən kimsən? Sən əslində kim idin?' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Mən sənin itirdiyin şeyəm. Sən məni xatırlamaq istəmədin.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Yalan deyirsən. Mən səni...' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən isə itirməkdənsə, unutmağı seçdin.' },
          { who: 'Leo', portrait: 'leo_0', text: 'Alice... məni bağışla.' },
          { who: 'Alice', portrait: 'alice_ghost', text: 'Artıq gecdir. Amma sən hələ də nəfəs alırsan. Bu kifayətdir.' },
          { who: '', text: 'O, yağışın içində bir dəfə daha göründü — və bu dəfə gözlərində qorxu yox idi.' }
        ]
      }
    ],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Bulvar yenə boş idi. Amma bu dəfə göy üzündə bir göz açılmışdı.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Deməli varsan. Məni izləyən şey — sən.' }
      ] },
      { x: 1260, once: true, lines: [
        { who: '', text: 'Yağış damlaları havada dayandı. Sonra geri, yuxarı qalxdı.' },
        { who: 'Leo', portrait: 'leo_0', text: 'Bu qorxu mənim içimdədir. Ona görə də onu yalnız mən dayandıra bilərəm.' }
      ] }
    ],
    exit: null
  };
  /* ---------------- registry ---------------- */
  var LEVELS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7];

  LEVELS.forEach(function (L, i) {
    L.index = i;
    L.spawn = L.start;
    L.props = L.props || [];
    L.enemies = L.enemies || [];
    L.npcs = L.npcs || [];
    L.triggers = L.triggers || [];
    L.hazards = L.hazards || [];
    L.items = L.items || [];
    L.checkpoints = L.checkpoints || [];
    if (!L.dark) L.dark = 0;
  });

  /* ---------------- endings ---------------- */
  var ENDING_KIND = {
    title: 'Son — Bağışlanma',
    body: [
      'Leo dizləri üstünə çökdü. Yağış onun üzünü yudu, amma qəlbindəki ləkə getmədi.',
      'Alice-in sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
      'O, əlindəki çiçəyi son dəfə qaldırdı. Çiçək islanmışdı, amma hələ də ağ idi.',
      '<em>“Mən səni gözlədim. Səni günahlandırmadım. Sadəcə... bir dəfə də olsun, arxaya baxmağını istədim.”</em>',
      'Səhər açılanda BDU-nun həyətində yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
      'Məktubun içində tək bir cümlə var idi:',
      '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
      'Leo o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
      'Çünki bəzən kömək istəmək — sadəcə xatırlamaq deməkdir.',
      '<em>— Son —</em>'
    ]
  };

  var ENDING_PLAIN = {
    title: 'Son — Sükut',
    body: [
      'Leo dizləri üstünə çökdü. Yağış onun üzünü yudu, amma qəlbindəki ləkə getmədi.',
      'Alice-in sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
      'O, heç nə demədi. Deməyə sözü də qalmamışdı.',
      'Səhər açılanda BDU-nun həyətində yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
      'Məktubun içində tək bir cümlə var idi:',
      '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
      'Leo o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
      'Amma bəzən, gecə yarısı, telefonunu açıb o nömrəyə yenə baxırdı.',
      '<em>— Son —</em>'
    ]
  };

  global.GameLevels = LEVELS;
  global.GameEnding = ENDING_KIND;
  global.GameEndingPlain = ENDING_PLAIN;
})(window);
