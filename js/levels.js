/* ============================================================
   levels.js — 12 chapters, BDU story (Sanu · Nuran)
   ------------------------------------------------------------
   GEOMETRY CONTRACT (validated in tools/validate-levels.js)
   · ground surface y = 470, one continuous floor per chapter
     (no bottomless pits — falling off is never instant death)
   · jump height 138px  |  run air reach 188px
   · ladder steps: dy = 100, dx = 80  → always climbable
   · every spike sits on solid ground with >= 70px of clear
     landing room on both sides, never under a low ledge
   · props are decorative only: never on a spike, never < 80px
     apart, never floating in mid-air

   NEW IN v5
   · 12 chapters instead of 7
   · per-chapter PLAY MODES: calm / tense / stealth / chase /
     mirror / puzzle — the rules of the room change, not just art
   · branches: `choice` items open a real decision overlay, the
     answer is stored and changes dialogue + the ending
   · `lever` items power a gate (puzzle chapters)
   ============================================================ */
(function (global) {
  'use strict';

  var G = 470;               // ground surface (feet level)
  var FLOOR_H = 340;         // thick enough that nothing shows under it
  var STEP_Y = 100;
  var STEP_X = 80;
  var LEDGE_W = 130;

  function floor(x, w) { return { x: x, y: G, w: w, h: FLOOR_H, kind: 'ground' }; }
  function plat(x, y, w) { return { x: x, y: y, w: w || LEDGE_W, h: 20, kind: 'ledge' }; }
  /** spike strip sitting ON the ground (top at y=G-16) */
  function spikes(x, w) { return { x: x, y: G - 16, w: w || 60, h: 16 }; }

  function coins(x1, x2, y, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var t = n === 1 ? 0.5 : i / (n - 1);
      out.push({ type: 'coin', x: Math.round(x1 + (x2 - x1) * t), y: y });
    }
    return out;
  }
  function cat() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) {
      if (Array.isArray(arguments[i])) out.push.apply(out, arguments[i]);
      else if (arguments[i]) out.push(arguments[i]);
    }
    return out;
  }

  /** three-step ladder: 100px rise per step, 80px sideways */
  function ladder(cx) {
    var l1 = plat(cx, G - STEP_Y);
    var l2 = plat(cx + STEP_X, G - STEP_Y * 2);
    var l3 = plat(cx + STEP_X * 2, G - STEP_Y * 3);
    return {
      l1: l1, l2: l2, l3: l3,
      platforms: [l1, l2, l3],
      items: [
        { type: 'coin', x: cx + 42, y: l1.y - 34 },
        { type: 'coin', x: cx + 92, y: l1.y - 34 },
        { type: 'coin', x: cx + STEP_X + 42, y: l2.y - 34 },
        { type: 'coin', x: cx + STEP_X + 92, y: l2.y - 34 },
        { type: 'coin', x: cx + STEP_X * 2 + 42, y: l3.y - 34 },
        { type: 'coin', x: cx + STEP_X * 2 + 92, y: l3.y - 34 }
      ]
    };
  }

  /** a decision the player takes by touching it */
  function choice(o) {
    return {
      type: 'choice', x: o.x, y: o.y || (G - 30),
      icon: o.icon || 'i_letter', cid: o.cid, title: o.title,
      prompt: o.prompt, options: o.options, jid: o.jid || null,
      lines: o.lines || null
    };
  }

  /* ============================================================
     I — Yağışlı Bakı
     ============================================================ */
  var a1 = ladder(430), a2 = ladder(1090), a3 = ladder(1750), a4 = ladder(2380);

  var ch1 = {
    id: 'ch1',
    kicker: 'Bölmə I',
    name: 'Yağışlı Bakı',
    sub: 'Axşam idi. Yağış yavaş-yavaş yağırdı.',
    bg: 'bg_baku', bgParallax: 0.34, rain: 'light', mood: 'calm', dark: 0.12,
    mode: 'calm',
    width: 2880,
    objective: 'Bulvar boyu irəli get. Fənərin altında tək dayanan biri var.',
    start: { x: 120, y: G },
    checkpoints: [520, 1140, 1800, 2420],
    platforms: cat(floor(0, 2880), a1.platforms, a2.platforms, a3.platforms, a4.platforms),
    hazards: [spikes(860, 60), spikes(2080, 60)],
    props: [
      { a: 'prop_fence', x: 80, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 250, y: G, s: 0.95 },
      { a: 'prop_bench', x: 360, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 620, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 720, y: G, s: 0.95 },
      { a: 'prop_sign', x: 1000, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1240, y: G, s: 1.0, dark: true },
      { a: 'prop_barrel2', x: 1440, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 1600, y: G, s: 0.95 },
      { a: 'prop_plant', x: 1880, y: G, s: 0.85 },
      { a: 'prop_fence', x: 2220, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 2480, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2620, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2730, y: G, s: 0.8 }
    ],
    items: cat(
      coins(170, 350, G - 36, 4),
      a1.items, a2.items, a3.items, a4.items,
      coins(1060, 1280, G - 36, 3),
      coins(1700, 1920, G - 36, 3),
      coins(2300, 2500, G - 36, 3),
      { type: 'medkit', x: a4.l2.x + 65, y: a4.l2.y - 30 },
      { type: 'note', x: 620, y: G - 30, icon: 'i_letter', jid: 'j_letter', title: 'Islanmış vərəq', lines: [
        { who: '', text: 'Skamyanın üstündə bir vərəq var. Yağış mürəkkəbi axıdıb, amma bir cümlə hələ oxunur.' },
        { who: '', text: '“Bəzən insan sevdiyi şeyləri itirməkdən qorxur.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu əl yazısı... Bunu mən yazmışam. Nə vaxt? Niyə xatırlamıram?' }
      ] },
      { type: 'note', x: 1000, y: G - 30, icon: 'i_scroll', jid: 'j_bench', title: 'Skamyanın altı', lines: [
        { who: '', text: 'Skamyanın altında iki köhnəlmiş bilet var. Birində “314” yazılıb — digəri cırılıb.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Eyni gecə. Eyni qatar. Biri mənim, bəs bu ikinci kimin idi?' }
      ] },
      { type: 'phone', x: 1440, y: G - 28, icon: 'u_phone', jid: 'j_phone1', title: 'Naməlum nömrə', lines: [
        { who: '', text: 'Ekranda tanımadığım bir nömrədən mesaj var. Vaxt: bu gecə, 03:14.' },
        { who: '???', portrait: 'u_phone_sanu', text: 'Sən hələ də məni axtarırsan?' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Kimdir bu? Nömrə... mövcud deyil.' },
        { who: '', text: 'Mesajı silmək istədim. Barmağım düyməyə getmədi.' }
      ] },
      choice({
        cid: 'stranger', x: 2360, icon: 's_portrait', title: 'Kölgə',
        prompt: 'Fənərin altında bir siluet dayanıb. Yaxınlaşırsan?',
        options: [
          { label: 'Yaxınlaş və danış', value: 'stay', hint: 'Qorxuya baxmayaraq bir addım at' },
          { label: 'Başını aşağı sal, keç get', value: 'walk', hint: 'Dörd il əvvəl də belə etmişdin' }
        ]
      })
    ),
    enemies: [],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Yağış yavaş-yavaş yağırdı. Fənərlər bir-bir sönürdü.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Yenə gecikdim. Yataqxanaya çatmaq üçün bu bulvardan keçməliyəm.' },
        { who: '', text: 'Cibimdə telefon titrədi. Ekran işığında yalnız bir sətir göründü: “03:14”.' }
      ] },
      { x: 1300, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu bulvarda hər gecə eyni qoxu var: yağış, dəniz və köhnə kağız.' },
        { who: '', text: 'Nə qədər ki bu yolu tanıyıram — bir o qədər də yad görünür.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Sanki kimsə bu yolu mənim üçün təkrar-təkrar düzür.' }
      ] },
      { x: 2240, once: true, lines: [
        { who: '', text: 'Fənərin altında bir kölgə dayanmışdı. Yaxınlaşdıqca kölgə qadın siluetinə çevrildi.' },
        { who: '', text: 'Siluet yerindən tərpənmədi. Yalnız başını bir az yana əydi — sanki “hələ də” deyirdi.' }
      ] }
    ],
    exit: { x: 2800, y: G, to: 1 }
  };

  /* ============================================================
     II — BDU həyəti
     ============================================================ */
  var b1 = ladder(470), b2 = ladder(1160), b3 = ladder(1860), b4 = ladder(2560);

  var ch2 = {
    id: 'ch2',
    kicker: 'Bölmə II',
    name: 'BDU həyəti',
    sub: 'Universitetin həyəti gecə daha böyük görünür.',
    bg: 'bg_bdu', bgParallax: 0.26, rain: 'light', mood: 'tense', dark: 0.2,
    mode: 'tense',
    width: 3240,
    objective: 'Həyətdən keç. Baş binanın qapısı qıfıllıdır — açarı tap.',
    start: { x: 110, y: G },
    checkpoints: [560, 1250, 1950, 2660],
    platforms: cat(floor(0, 3240), b1.platforms, b2.platforms, b3.platforms, b4.platforms),
    hazards: [spikes(900, 60), spikes(1600, 60), spikes(2300, 60)],
    props: [
      { a: 'prop_tree', x: 170, y: G, s: 1.1 },
      { a: 'prop_fence', x: 390, y: G, s: 0.9 },
      { a: 'prop_flowerpot', x: 720, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 1040, y: G, s: 1.0 },
      { a: 'prop_tree', x: 1300, y: G, s: 0.95, flip: true },
      { a: 'prop_barrel', x: 1440, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1700, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2000, y: G, s: 1.15, dark: true },
      { a: 'prop_lamppost', x: 2200, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2440, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2720, y: G, s: 1.1, dark: true },
      { a: 'prop_fence', x: 2900, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 3040, y: G, s: 0.85 }
    ],
    items: cat(
      coins(170, 350, G - 36, 4),
      b1.items, b2.items, b3.items, b4.items,
      [{ type: 'key', x: b2.l3.x + 65, y: b2.l3.y - 34, id: 'bdu' }],
      [{ type: 'medkit', x: b4.l2.x + 65, y: b4.l2.y - 30 }],
      [{ type: 'ammo', x: b3.l3.x + 65, y: b3.l3.y - 34 }],
      coins(1700, 1860, G - 36, 3),
      coins(2380, 2540, G - 36, 2),
      { type: 'note', x: b1.l2.x + 65, y: b1.l2.y - 30, icon: 'i_scroll', jid: 'j_notice', title: 'Divardakı elan', lines: [
        { who: '', text: 'Elan lövhəsi: “314-cü auditoriya təmirə görə bağlıdır. Heç kim girməsin.”' },
        { who: '', text: 'Aşağıda kiminsə əli ilə yazılıb: “O, hələ də orada gözləyir.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: '314... Bu rəqəm mənim yuxularımda da var. Hər gecə.' }
      ] },
      { type: 'note', x: 1440, y: G - 30, icon: 's_blood', jid: 'j_ground', title: 'Həyətdəki kərpic', lines: [
        { who: '', text: 'Kərpic döşəmədə bir daş qalxmışdı. Altında kiçik bir çuxur: bir saç sancağı və iki hərf.' },
        { who: 'Nuran', portrait: 'nuran_0', text: '“N + S”. Mən bunu heç vaxt yazmamışam.' },
        { who: '', text: 'Sancağın metali hələ də barmağımın istisini saxlayırdı.' }
      ] },
      { type: 'shotgun', x: b4.l3.x + 65, y: b4.l3.y - 30 },
      choice({
        cid: 'gate', x: 2900, icon: 'u_lock', title: 'Darıxan səs',
        prompt: 'Dəmir darvazanın arxasında kimsə oturub ağlayır. Səsi sənin səsindir.',
        options: [
          { label: 'Darvazanı aç, yanına get', value: 'help', hint: 'Kömək etmək — xatırlamaqdır' },
          { label: 'Eşitməmiş kimi keç', value: 'ignore', hint: 'Bu səs səni saxlayır' }
        ]
      })
    ),
    enemies: [
      { type: 'skull', x: 640, y: G, patrol: [520, 840], speed: 54 },
      { type: 'crawler', x: 1080, y: G, patrol: [960, 1120], speed: 92 },
      { type: 'stalker', x: 1780, y: G, patrol: [1680, 1860], speed: 60 },
      { type: 'hound', x: 2480, y: G, patrol: [2400, 2560], speed: 128 },
      { type: 'skull', x: 3020, y: G, patrol: [2960, 3180], speed: 62 }
    ],
    npcs: [],
    triggers: [
      { x: 300, once: true, lines: [
        { who: '', text: 'Darvazada lövhə: “BAKI DÖVLƏT UNİVERSİTETİ · 1919”.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Dörd ildir bu həyətdən keçirəm. Amma heç vaxt bu qədər sakit olmamışdı.' },
        { who: 'Sanu', portrait: 'sanu_a1', text: 'Sən məni heç vaxt sorğu-sual etmirsən. Niyə?' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Çünki bilirəm ki, cavab məni qorxudar.' }
      ] },
      { x: 1650, once: true, lines: [
        { who: '', text: 'Ayaq səsimdən başqa bir səs də var. Həmişə iki addım arxada.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Dönürəm. Heç kim yoxdur. Amma addımlar dayanmır.' }
      ] },
      { x: 3100, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Baş binanın qapısı. Qıfıllıdır. Açar olmadan keçə bilmərəm.' }
      ] }
    ],
    exit: { x: 3160, y: G, to: 2, needsKey: true }
  };

  /* ============================================================
     III — Universitet dəhlizi
     ============================================================ */
  var c1 = ladder(400), c2 = ladder(1150), c3 = ladder(1950), c4 = ladder(2700);

  var ch3 = {
    id: 'ch3',
    kicker: 'Bölmə III',
    name: 'Universitet dəhlizi',
    sub: 'Dəhlizlər gecə uzanır, qapılar isə yad adlar daşıyır.',
    bg: 'bg_campus', bgParallax: 0.2, rain: 'off', mood: 'tense', dark: 0.34,
    mode: 'tense',
    width: 3440,
    objective: 'Dəhlizlə irəli get. İki açar — iki qıfıllı qapı.',
    start: { x: 100, y: G },
    checkpoints: [500, 1240, 2040, 2800],
    platforms: cat(floor(0, 3440), c1.platforms, c2.platforms, c3.platforms, c4.platforms),
    hazards: [spikes(820, 60), spikes(1540, 60), spikes(2340, 60)],
    props: [
      { a: 'prop_bookshelf', x: 210, y: G, s: 1.15 },
      { a: 'prop_bench', x: 640, y: G, s: 0.9 },
      { a: 'prop_flowerpot', x: 960, y: G, s: 0.95 },
      { a: 'prop_bookshelf', x: 1290, y: G, s: 1.1 },
      { a: 'prop_plant', x: 1660, y: G, s: 0.95 },
      { a: 'prop_bench', x: 1820, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 2140, y: G, s: 1.1 },
      { a: 'prop_plant', x: 2500, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2900, y: G, s: 1.1 },
      { a: 'prop_bench', x: 3180, y: G, s: 0.9 }
    ],
    items: cat(
      coins(160, 330, G - 36, 4),
      c1.items, c2.items, c3.items, c4.items,
      [{ type: 'key', x: c2.l3.x + 65, y: c2.l3.y - 34, id: 'k1' }],
      [{ type: 'key', x: c4.l3.x + 65, y: c4.l3.y - 34, id: 'k2' }],
      [{ type: 'ammo', x: c1.l3.x + 65, y: c1.l3.y - 34 }],
      [{ type: 'ammo', x: c3.l2.x + 65, y: c3.l2.y - 30 }],
      [{ type: 'medkit', x: c3.l3.x + 65, y: c3.l3.y - 30 }],
      coins(1700, 1900, G - 36, 3),
      coins(2440, 2620, G - 36, 3),
      { type: 'photo', x: c1.l2.x + 65, y: c1.l2.y - 30, icon: 's_portrait', jid: 'j_photo1', title: 'Cızılmış şəkil', lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu şəkil... 314-cü auditoriya. Cərgədə oturanlar arasında mən də varam.' },
        { who: '', text: 'Yanımda bir qız oturub. Üzü qələmlə cızılıb — sanki kimsə onu silmək istəyib.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Arxasında yazılıb: “Məni xatırla. Məni bağışla.”' },
        { who: '', text: 'Kağızın küncü barmaqlarımın altında titrədi.' }
      ] },
      { type: 'phone', x: 1900, y: G - 28, icon: 'u_phone', jid: 'j_phone2', title: 'İki mesaj', lines: [
        { who: '', text: 'Yenə həmin nömrə. Bu dəfə iki mesaj.' },
        { who: '???', portrait: 'u_phone_sanu', text: '314-cü auditoriyaya gəl.' },
        { who: '???', portrait: 'u_phone_sanu', text: 'Qorxma. Mən səni gözləyirəm.' }
      ] },
      { type: 'note', x: 2250, y: G - 30, icon: 'i_potion', jid: 'j_lamp', title: 'Yanıb-sönən lampa', lines: [
        { who: '', text: 'Üçüncü lampa nəfəs alırmış kimi yanıb-sönür. Hər söndükdə qulağıma bir söz gəlir: “gecikdin”.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu səsi tanıyıram. Amma kimin olduğunu xatırlamıram.' }
      ] },
      { type: 'note', x: 3200, y: G - 30, icon: 's_letter_blood', jid: 'j_blood', title: 'Divar yazısı', lines: [
        { who: '', text: 'Divarda qanla yazılıb: “SƏN HEÇ VAXT MƏNİ HƏQİQƏTƏN TANIMAMIŞSAN.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu nə deməkdir? Sanu?!' },
        { who: '', text: 'Dəhlizin sonunda bir qapı çırpıldı.' }
      ] }
    ),
    enemies: [
      { type: 'crouch', x: 980, y: G, patrol: [890, 1110], speed: 96 },
      { type: 'hound', x: 1340, y: G, patrol: [1180, 1420], speed: 138 },
      { type: 'skull', x: 1780, y: G, patrol: [1640, 1920], speed: 58 },
      { type: 'shadow', x: 2140, y: G - 150, speed: 78 },
      { type: 'crouch', x: 2480, y: G, patrol: [2420, 2660], speed: 104 },
      { type: 'stalker', x: 3080, y: G, patrol: [3000, 3260], speed: 64 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Dəhlizin işıqları nəfəs alırmış kimi yanıb-sönür.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Burada dərsə gəlmişəm, yüz dəfə. Amma indi qapı nömrələri... düzülmür.' },
        { who: '', text: '101, 102, 314, 102. Sonra yenə 314.' }
      ] },
      { x: 1750, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu dəhlizdə heç nə yoxdur. Yalnız toz, köhnə kağız və qan.' },
        { who: 'Sanu', portrait: 'sanu_a2', text: 'Yoxdur? Sən sadəcə baxmaq istəmirsən.' }
      ] },
      { x: 2500, once: true, lines: [
        { who: '', text: 'Addımlarımın səsi dəyişdi. Artıq iki cüt ayaqqabı eşidilir — biri mənim, biri bir az geridə.' }
      ] }
    ],
    exit: { x: 3360, y: G, to: 3, needsKeys: 2 }
  };

  /* ============================================================
     IV — Auditoriya 314
     ============================================================ */
  var d1 = ladder(420), d2 = ladder(1080), d3 = ladder(1820), d4 = ladder(2340);

  var ch4 = {
    id: 'ch4',
    kicker: 'Bölmə IV',
    name: 'Auditoriya 314',
    sub: 'Bu otaqda bir dəfə çox vacib bir şey deyilməli idi.',
    bg: 'bg_class', bgParallax: 0.16, rain: 'off', mood: 'calm', dark: 0.28,
    mode: 'calm',
    width: 3060,
    objective: 'Auditoriyanın o biri ucuna çat. O, səni gözləyir.',
    start: { x: 100, y: G },
    checkpoints: [480, 1180, 1920, 2520],
    platforms: cat(floor(0, 3060), d1.platforms, d2.platforms, d3.platforms, d4.platforms),
    hazards: [spikes(840, 60), spikes(1560, 60)],
    props: [
      { a: 'prop_table', x: 220, y: G, s: 1.0 },
      { a: 'prop_chair', x: 320, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 640, y: G, s: 1.15 },
      { a: 'prop_table', x: 940, y: G, s: 1.0 },
      { a: 'prop_flowerpot', x: 1280, y: G, s: 1.0 },
      { a: 'prop_table', x: 1440, y: G, s: 1.0 },
      { a: 'prop_chair', x: 1700, y: G, s: 1.0 },
      { a: 'prop_table', x: 2000, y: G, s: 1.0 },
      { a: 'prop_plant', x: 2260, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2500, y: G, s: 1.1 },
      { a: 'prop_table', x: 2680, y: G, s: 1.0 }
    ],
    items: cat(
      coins(160, 330, G - 36, 4),
      d1.items, d2.items, d3.items, d4.items,
      [{ type: 'photo', x: d3.l3.x + 65, y: d3.l3.y - 34, icon: 's_portrait', jid: 'j_photo2', title: 'Parta üstündəki şəkil', lines: [
        { who: '', text: 'Şəkildə iki əl görünür. Biri dəftər tutur, digəri çiçək.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Mən bu çiçəyi... ona vermək istəmişdim. Amma heç vaxt vermədim.' },
        { who: 'Sanu', portrait: 'sanu_a1', text: 'Sən həmişə “bir gün daha” gözləyirdin. Bir gün daha. Sonra heç bir gün qalmadı.' }
      ] }],
      [{ type: 'ammo', x: d2.l3.x + 65, y: d2.l3.y - 34 }],
      [{ type: 'medkit', x: d4.l2.x + 65, y: d4.l2.y - 30 }],
      coins(1660, 1840, G - 36, 3),
      coins(2100, 2280, G - 36, 2),
      { type: 'note', x: d1.l2.x + 65, y: d1.l2.y - 30, icon: 'u_msgbox', jid: 'j_board', title: 'Lövhədə', lines: [
        { who: '', text: 'Lövhədə təbaşir ilə yazılıb: “Sanu hələ də məni axtarırsan?”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu yazı bugünkü deyil. Tozun altından çıxır — illərlə buradadır.' },
        { who: '', text: 'Və altında, daha kiçik hərflərlə: “Mən də səni.”' }
      ] },
      { type: 'note', x: 1440, y: G - 30, icon: 'i_letter', jid: 'j_desk', title: 'Partanın altı', lines: [
        { who: '', text: 'Partanın altına yapışdırılmış bir kağız: “Əgər bunu oxuyursansa, deməli mən artıq danışa bilmirəm.”' },
        { who: '', text: '“Amma sən məni yenə də eşidirsən. Bu otaq sənin yaddaşının bir parçasıdır. Divarı sındırmaq üçün qapını axtarma.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu əl yazısı... mənimkidir. Amma mən bu sözləri heç vaxt yazmamışam.' }
      ] },
      choice({
        cid: 'photo', x: 2460, icon: 's_portrait', title: 'Şəkil',
        prompt: 'Partanın üstündə bir şəkil var: sən və üzü cızılmış bir qız. Nə edirsən?',
        options: [
          { label: 'Şəkli cibinə qoy', value: 'keep', hint: 'Xatırlamağa razılaş' },
          { label: 'Şəkli cırıb at', value: 'tear', hint: 'Unutmaq daha asandır' }
        ]
      })
    ),
    enemies: [
      { type: 'hound', x: 980, y: G, patrol: [890, 1060], speed: 132 },
      { type: 'crouch', x: 1690, y: G, patrol: [1660, 1800], speed: 100 },
      { type: 'lurk', x: 2240, y: G, patrol: [2160, 2320], speed: 92 },
      { type: 'shadow', x: 1920, y: G - 160, speed: 74 }
    ],
    npcs: [
      {
        kind: 'sanu', sprite: 'sanu_a2', x: 2860, y: G, s: 1.0, gift: true,
        talk: [
          { who: 'Sanu', portrait: 'sanu_a2', text: 'Sən gəldin. Mən də elə bilirdim ki, gəlməyəcəksən.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Sanu... sən buradasan? Dörd ildir?' },
          { who: 'Sanu', portrait: 'sanu_a1', text: 'Dörd il? Sən neçə dəfə bu auditoriyadan keçdin, Nuran?' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Bilmirəm. Çox.' },
          { who: 'Sanu', portrait: 'sanu_a2', text: 'Hər dəfə başını aşağı salırdın. Hər dəfə bir addım sürətlənirdin.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Mən... qorxdum. Sənə deməyə qorxdum.' },
          { who: 'Sanu', portrait: 'sanu_a0', text: 'Bilirəm. Amma qorxmaq cinayət deyil. Susmaq isə... yarımçıq qalan şeydir.' },
          { who: 'Sanu', portrait: 'sanu_a1', text: 'Aşağıda, arxivdə bir şey qoydum. Sənin üçün. Get — və qaçma.' }
        ],
        after: 'O, bir dəfə gülümsədi — və otaq işıqlandı.',
        choiceAfter: {
          cid: 'apology',
          prompt: 'Onun qarşısında dayanırsan. Deməli olduğun söz boğazında ilişib qalıb.',
          options: [
            { label: '“Bağışla məni. Gecikdim.”', value: 'speak', hint: 'Dörd il sonra ilk dəfə' },
            { label: 'Sus və başını aşağı sal', value: 'silent', hint: 'Sükut da bir cavabdır' }
          ]
        }
      }
    ],
    triggers: [
      { x: 280, once: true, lines: [
        { who: '', text: 'Qapının üstündə: “314”. Altında kiçik bir kağız: “Burada bir dəfə bir qız gözlədi.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu otaqda otuz iki dəfə imtahan verdim. Və bir dəfə də... cavab vermədim.' }
      ] },
      { x: 1620, once: true, lines: [
        { who: '', text: 'Partaların üstündə toz qatı var. Amma biri təmizdir — sanki kimsə indicə qalxıb.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu, mənim yerim idi. Yanımdakı yer isə... heç vaxt boş olmamışdı.' }
      ] },
      { x: 2620, once: true, lines: [
        { who: '', text: 'Otağın o biri ucunda bir qız dayanıb. Dörd ildir eyni yerdə. Paltarı hələ də islanmışdır.' }
      ] }
    ],
    exit: { x: 2980, y: G, to: 4 }
  };

  /* ============================================================
     V — Arxiv zirzəmisi
     ============================================================ */
  var e1 = ladder(430), e2 = ladder(1180), e3 = ladder(1920), e4 = ladder(2680), e5 = ladder(3240);

  var ch5 = {
    id: 'ch5',
    kicker: 'Bölmə V',
    name: 'Arxiv zirzəmisi',
    sub: 'Səs aşağıdan gəlirdi — kağız, pas və nəfəs.',
    bg: 'bg_room', bgParallax: 0.18, rain: 'off', mood: 'tense', dark: 0.62,
    mode: 'dark',
    width: 3660,
    objective: 'İki açarı tap, çıxış qapısını aç. Qaranlıqda lampanı saxla (2).',
    start: { x: 100, y: G },
    checkpoints: [540, 1260, 2020, 2760, 3320],
    platforms: cat(floor(0, 3660), e1.platforms, e2.platforms, e3.platforms, e4.platforms, e5.platforms),
    hazards: [spikes(840, 60), spikes(1580, 60), spikes(2380, 60), spikes(3080, 60)],
    props: [
      { a: 'prop_barrel', x: 230, y: G, s: 0.9 },
      { a: 'prop_barrel2', x: 640, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 1020, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 1380, y: G, s: 1.0 },
      { a: 'prop_barrel', x: 1740, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 2180, y: G, s: 1.0 },
      { a: 'prop_barrel2', x: 2540, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 2900, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 3300, y: G, s: 1.05 },
      { a: 'prop_bookshelf', x: 3500, y: G, s: 0.95 }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      e1.items, e2.items, e3.items, e4.items, e5.items,
      [{ type: 'key', x: e2.l3.x + 65, y: e2.l3.y - 34, id: 'a1' }],
      [{ type: 'key', x: e4.l3.x + 65, y: e4.l3.y - 34, id: 'a2' }],
      [{ type: 'medkit', x: e3.l1.x + 65, y: e3.l1.y - 30 }],
      [{ type: 'medkit', x: e5.l1.x + 65, y: e5.l1.y - 30 }],
      [{ type: 'ammo', x: e1.l3.x + 65, y: e1.l3.y - 34 }],
      [{ type: 'ammo', x: e4.l1.x + 65, y: e4.l1.y - 34 }],
      coins(1700, 1900, G - 36, 3),
      coins(2480, 2660, G - 36, 3),
      { type: 'note', x: e1.l2.x + 65, y: e1.l2.y - 30, icon: 's_hand', jid: 'j_hand', title: 'Divardakı əl izi', lines: [
        { who: '', text: 'Divarda qanlı bir əl izi var. Barmaqlar aşağıya doğru uzanır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu əl çox kiçikdir... Sanu?' },
        { who: '', text: 'Əlin altında rəqəmlər: 03 · 14' }
      ] },
      { type: 'note', x: 2900, y: G - 30, icon: 'i_letter', jid: 'j_folder', title: 'Arxiv qovluğu', lines: [
        { who: '', text: 'Tozlu qovluqda bir sənəd: “Tələbə Sanu M. — 314-cü qrup. Status: akademik məzuniyyət.”' },
        { who: '', text: 'Tarix: bu gündən dörd il əvvəl.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Məzuniyyət? Amma heç kim mənə demədi... Mən niyə xatırlamıram?' },
        { who: '', text: 'Qovluğun arxasında ikinci səhifə var. Daha köhnə mürəkkəb.' },
        { who: '', text: '“Nuran Ə. — müraciət: psixoloji dəstək. Səbəb: travmatik itki. Yaddaşın qoruyucu silinməsi aparılıb.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Deməli... xatırlamamaq mənim qərarım deyildi. Bu, müdafiə idi. Mən özümü sildirmişəm.' }
      ] },
      { type: 'note', x: 3300, y: G - 30, icon: 'u_msgbox', jid: 'j_receipt', title: 'Kassa qəbzi', lines: [
        { who: '', text: 'Qovluğun arasında bir qəbz: “03:14 · dəniz kənarı · iki bilet”.' },
        { who: '', text: 'Qəbzin üstündə qələmlə: “Onu gözləmə. Qaç.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu mənim əl yazımdır. Amma mən heç vaxt qaçmadım.' }
      ] },
      choice({
        cid: 'folder', x: 2200, icon: 'i_letter', title: 'Həqiqət qovluğu',
        prompt: 'Qovluq əlindədir. İçində dörd il əvvəlki gecənin bütün həqiqəti var.',
        options: [
          { label: 'Hamısını oxu', value: 'read', hint: 'Həqiqət ağrıdır, amma yaddaşdır' },
          { label: 'Qovluğu yandır', value: 'burn', hint: 'Kül heç nə danışmır' },
          { label: 'Olduğu yerə qoy, get', value: 'leave', hint: 'Bəzi şeylər qaranlıqda qalmalıdır' }
        ]
      })
    ),
    enemies: [
      { type: 'skull', x: 580, y: G, patrol: [340, 700], speed: 66 },
      { type: 'crawler', x: 1040, y: G, patrol: [920, 1140], speed: 112 },
      { type: 'stalker', x: 1800, y: G, patrol: [1700, 1900], speed: 72 },
      { type: 'shadow', x: 2140, y: G - 130, speed: 80 },
      { type: 'crawler', x: 2560, y: G, patrol: [2480, 2660], speed: 118 },
      { type: 'skull', x: 2980, y: G, patrol: [2920, 3060], speed: 70 },
      { type: 'horn', x: 3380, y: G, patrol: [3260, 3520], speed: 74 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Pilləkən aşağıya, tam qaranlığa aparırdı. Aşağıdan nəm və pas iyi gəlirdi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'İşıq yoxdur... Amma geri qayıtmaq olmaz. O dedi ki, burada bir şey qoyub.' },
        { who: '', text: '[2] düyməsi neft lampasını yandırır. Qaranlıqda lampa həyat qurtarır.' }
      ] },
      { x: 1540, once: true, lines: [
        { who: '', text: 'Küncdən sürünən bir kölgə keçdi. Sonra ikinci. Sonra on.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Onlar məni görürlər. Və qaçmırlar.' }
      ] },
      { x: 3180, once: true, lines: [
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Sən gəldin. Mən bilirdim ki, gələcəksən.' }
      ] }
    ],
    exit: { x: 3580, y: G, to: 5, needsKeys: 2 }
  };

  /* ============================================================
     VI — Kölgə Sanu  (boss)
     ============================================================ */
  var f1 = ladder(440), f2 = ladder(1120), f3 = ladder(1820), f4 = ladder(2440);

  var ch6 = {
    id: 'ch6',
    kicker: 'Bölmə VI',
    name: 'Kölgə Sanu',
    sub: '“Sən məni xatırlamaq istəmədin. Mən də səni unutdum.”',
    bg: 'bg_campus', bgParallax: 0.28, rain: 'heavy', mood: 'tense', dark: 0.46,
    mode: 'boss',
    width: 3060,
    objective: 'Kölgəni dayandır. Qaçmaq mümkün deyil — döyüş.',
    start: { x: 100, y: G },
    checkpoints: [500, 1200, 1940, 2560],
    platforms: cat(floor(0, 3060), f1.platforms, f2.platforms, f3.platforms, f4.platforms),
    hazards: [spikes(890, 60), spikes(2260, 60)],
    props: [
      { a: 'prop_lamppost', x: 230, y: G, s: 0.95 },
      { a: 'prop_bench', x: 670, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1010, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 1520, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1740, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 2040, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2440, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2600, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2860, y: G, s: 1.1, dark: true }
    ],
    items: cat(
      coins(170, 350, G - 36, 4),
      f1.items, f2.items, f3.items, f4.items,
      [{ type: 'ammo', x: f1.l3.x + 65, y: f1.l3.y - 34 }],
      [{ type: 'ammo', x: f2.l2.x + 65, y: f2.l2.y - 30 }],
      [{ type: 'medkit', x: f3.l3.x + 65, y: f3.l3.y - 30 }],
      [{ type: 'medkit', x: f4.l2.x + 65, y: f4.l2.y - 30 }],
      coins(1700, 1900, G - 36, 3),
      coins(2400, 2580, G - 36, 3)
    ),
    enemies: [
      { type: 'shadow', x: 1180, y: G - 140, speed: 80 },
      { type: 'hound', x: 1580, y: G, patrol: [1460, 1800], speed: 140 },
      { type: 'veil', x: 1980, y: G - 60, speed: 78 },
      { type: 'shadow', x: 2340, y: G - 170, speed: 88 },
      { type: 'sanu_corrupt', x: 2740, y: G, hp: 22, speed: 84, boss: true }
    ],
    npcs: [],
    triggers: [
      { x: 230, once: true, mode: 'tense', lines: [
        { who: '', text: 'Həyət qırmızı işığa bürünmüşdü. Yağış artıq tufan idi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Sanu... haradasan?' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Səncə mən heç vaxt burada olmamışam?' }
      ] },
      { x: 1340, once: true, lines: [
        { who: '', text: 'Addımlarımın arxasınca başqa addımlar da eşidilirdi. Sonra dayandı.' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Bəs niyə dörd il gözlədim, Nuran? Niyə?' }
      ] },
      { x: 2500, once: true, mode: 'boss', lines: [
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Daha qaçma. Mən səni bu dəfə buraxmayacağam.' },
        { who: '', text: 'Kölgə qollarını açdı. İçindən yağış yağırdı — amma o yağış yuxarı qalxırdı.' }
      ] }
    ],
    exit: { x: 2980, y: G, to: 6, afterBoss: true }
  };

  /* ============================================================
     VII — Güzgü dəhlizi  (mirror mode)
     ============================================================ */
  var m1 = ladder(430), m2 = ladder(1130), m3 = ladder(1880), m4 = ladder(2600);

  var ch7 = {
    id: 'ch7',
    kicker: 'Bölmə VII',
    name: 'Güzgü dəhlizi',
    sub: 'Bu dəhlizdə hər şey bir az gecikmə ilə hərəkət edir.',
    bg: 'bg_campus', bgParallax: 0.24, rain: 'off', mood: 'tense', dark: 0.4,
    mode: 'mirror',
    width: 3300,
    objective: 'Dəhlizin sonuna çat. Arxanda gələn səndən qaç.',
    start: { x: 100, y: G },
    checkpoints: [520, 1220, 1960, 2680],
    platforms: cat(floor(0, 3300), m1.platforms, m2.platforms, m3.platforms, m4.platforms),
    hazards: [spikes(880, 60), spikes(1660, 60), spikes(2380, 60)],
    props: [
      { a: 'prop_window1', x: 200, y: G, s: 1.0 },
      { a: 'prop_window2', x: 380, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 700, y: G, s: 1.1 },
      { a: 'prop_window1', x: 1020, y: G, s: 1.0 },
      { a: 'prop_plant', x: 1320, y: G, s: 1.0 },
      { a: 'prop_window2', x: 1620, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2000, y: G, s: 1.1 },
      { a: 'prop_window1', x: 2280, y: G, s: 1.0 },
      { a: 'prop_plant', x: 2740, y: G, s: 1.0 },
      { a: 'prop_window2', x: 3020, y: G, s: 1.0 }
    ],
    items: cat(
      coins(170, 350, G - 36, 4),
      m1.items, m2.items, m3.items, m4.items,
      [{ type: 'ammo', x: m1.l3.x + 65, y: m1.l3.y - 34 }],
      [{ type: 'ammo', x: m3.l1.x + 65, y: m3.l1.y - 30 }],
      [{ type: 'medkit', x: m2.l2.x + 65, y: m2.l2.y - 30 }],
      [{ type: 'medkit', x: m4.l3.x + 65, y: m4.l3.y - 30 }],
      coins(1760, 1940, G - 36, 3),
      coins(2500, 2620, G - 36, 3),
      { type: 'note', x: 700, y: G - 30, icon: 's_portrait', jid: 'j_mirror', title: 'Güzgüdəki ikinci', lines: [
        { who: '', text: 'Divarda böyük bir güzgü var. Mənim əksim mənə baxmır.' },
        { who: '', text: 'O, bir az geridə qalır — sanki hərəkət etməyə tərəddüd edir.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Sonra gülümsədi. Mən gülümsəmirdim.' }
      ] },
      { type: 'note', x: 2740, y: G - 30, icon: 'i_photo', jid: 'j_twin', title: 'İki Nuran', lines: [
        { who: '', text: 'Dəhlizin sonunda bir də mən var idim. Amma onun gözləri yaşlı idi.' },
        { who: '', text: '“Sən buradan çıxanda,” dedi, “məni burada qoyacaqsan.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'O, yalan demirdi.' }
      ] },
      choice({
        cid: 'mirror', x: 1560, icon: 's_portrait', title: 'Güzgü',
        prompt: 'Güzgüdəki əksin səni gözləyir. O, sənin yerinə çıxmaq istəyir.',
        options: [
          { label: 'Üzünə bax və adını de', value: 'face', hint: 'Özünü tanımaq — qorxu ilə üzləşməkdir' },
          { label: 'Güzgünü sındır', value: 'shatter', hint: 'Yeddi il bəxtsizlik, bir anlıq rahatlıq' }
        ]
      })
    ),
    enemies: [
      { type: 'twin', x: 640, y: G, hp: 6, speed: 0, mirror: true },
      { type: 'shadow', x: 1450, y: G - 150, speed: 84 },
      { type: 'crouch', x: 2100, y: G, patrol: [2020, 2260], speed: 104 },
      { type: 'veil', x: 2560, y: G - 70, speed: 82 },
      { type: 'twin', x: 2900, y: G, hp: 6, speed: 0, mirror: true }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Dəhliz ikiqat görünür. Divarlar güzgü ilə örtülüb və hər biri bir az yalan danışır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Burada mənim əksim məndən bir addım geridə qalır.' },
        { who: '', text: '[Qaç] əksi səni izləyir. Dayan — o da dayanacaq.' }
      ] },
      { x: 1400, once: true, lines: [
        { who: '', text: 'Arxamda ayaq səsləri. Amma bu dəfə ritm mənimkidir — sadəcə bir az gecikmiş.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Mən qaçsam, o da qaçacaq. Mən dayansam...' }
      ] },
      { x: 2680, once: true, lines: [
        { who: '', text: 'Son güzgüdə iki Nuran var. Biri qaçır, digəri yalnız baxır.' }
      ] }
    ],
    exit: { x: 3220, y: G, to: 7 }
  };

  /* ============================================================
     VIII — Yataqxana otağı  (stealth: səs yuxudan oyadır)
     ============================================================ */
  var h1 = ladder(420), h2 = ladder(1080), h3 = ladder(1740), h4 = ladder(2400);

  var ch8 = {
    id: 'ch8',
    kicker: 'Bölmə VIII',
    name: 'Yataqxana otağı',
    sub: 'Dörd il bu otaqda hər gecə eyni şey təkrarlanıb.',
    bg: 'bg_house', bgParallax: 0.14, rain: 'off', mood: 'tense', dark: 0.52,
    mode: 'stealth',
    width: 3000,
    objective: 'Otaqdan çıx. Sakit get — qaçsan, onlar oyanacaq.',
    start: { x: 100, y: G },
    checkpoints: [500, 1160, 1820, 2480],
    platforms: cat(floor(0, 3000), h1.platforms, h2.platforms, h3.platforms, h4.platforms),
    hazards: [spikes(800, 60), spikes(1500, 60), spikes(2160, 60)],
    props: [
      { a: 'prop_bed', x: 210, y: G, s: 1.1 },
      { a: 'prop_table', x: 340, y: G, s: 1.0 },
      { a: 'prop_chair', x: 700, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 940, y: G, s: 1.1 },
      { a: 'prop_bed', x: 1300, y: G, s: 1.1 },
      { a: 'prop_window1', x: 1620, y: G, s: 1.0 },
      { a: 'prop_table', x: 1960, y: G, s: 1.0 },
      { a: 'prop_chair', x: 2300, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2620, y: G, s: 1.0 },
      { a: 'prop_window2', x: 2860, y: G, s: 1.0 }
    ],
    items: cat(
      coins(160, 320, G - 36, 4),
      h1.items, h2.items, h3.items, h4.items,
      [{ type: 'ammo', x: h1.l3.x + 65, y: h1.l3.y - 34 }],
      [{ type: 'medkit', x: h2.l2.x + 65, y: h2.l2.y - 30 }],
      [{ type: 'ammo', x: h3.l1.x + 65, y: h3.l1.y - 30 }],
      [{ type: 'medkit', x: h4.l3.x + 65, y: h4.l3.y - 30 }],
      coins(1620, 1740, G - 36, 3),
      coins(2280, 2400, G - 36, 3),
      { type: 'note', x: 340, y: G - 30, icon: 'prop_bed', jid: 'j_room', title: 'Divardakı cizgilər', lines: [
        { who: '', text: 'Divarda karandaşla çəkilmiş kiçik cizgilər var. Hər gecə üçün bir cizgi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Saydım. Min dörd yüz altmış. Bir nəfər bu otaqda hər gecə oyanıb eyni şeyi gözləyib.' }
      ] },
      { type: 'phone', x: 1620, y: G - 28, icon: 'u_phone', jid: 'j_sms', title: 'Göndərilməmiş mesaj', lines: [
        { who: '', text: 'Telefonun qaralama qutusunda yazılmış, heç vaxt göndərilməmiş bir mesaj var.' },
        { who: 'Nuran', portrait: 'nuran_0', text: '“Sabah gələcəm. Söz verirəm.” Tarix: dörd il əvvəl, 03:14.' },
        { who: '', text: 'Mesajın altında rəqəmlər: 03 · 14. Hər şey eyni rəqəmə qayıdır.' }
      ] },
      { type: 'key', x: 2860, y: G - 34, id: 'dorm' }
    ),
    enemies: [
      { type: 'sleeper', x: 620, y: G, patrol: [540, 700], speed: 96, dormant: true },
      { type: 'sleeper', x: 1420, y: G, patrol: [1340, 1500], speed: 90, dormant: true },
      { type: 'crawler', x: 1900, y: G, patrol: [1840, 1980], speed: 104 },
      { type: 'sleeper', x: 2340, y: G, patrol: [2260, 2420], speed: 100, dormant: true },
      { type: 'shadow', x: 2660, y: G - 140, speed: 76 }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Otaq mənim otağımdır. Amma çarpayı düzəldilməyib, pəncərə açıqdır, stolun üstündə iki stəkan var.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'İki stəkan. Biri mənim. Biri... həmişə boş qalan.' },
        { who: '', text: '[Stealth] Qaçmaq və atəş açmaq səs çıxarır. Səs yuxuda olanları oyadır.' }
      ] },
      { x: 1350, once: true, lines: [
        { who: '', text: 'Çarpayının üstündə bir qadın paltarı var. Islanmış. Hələ də damcılayır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu paltarı tanıyıram. Amma onu taxan qızı xatırlamıram.' }
      ] },
      { x: 2600, once: true, lines: [
        { who: '', text: 'Qapı arxasında ayaq səsləri. Sonra sükut. Sonra yenə ayaq səsləri — daha sürətli.' }
      ] }
    ],
    exit: { x: 2920, y: G, to: 8, needsKey: true }
  };

  /* ============================================================
     IX — Qara pilləkən / dam  (chase: qaranlıq dalğası)
     ============================================================ */
  var k1 = ladder(460), k2 = ladder(1140), k3 = ladder(1900), k4 = ladder(2620);

  var ch9 = {
    id: 'ch9',
    kicker: 'Bölmə IX',
    name: 'Qara pilləkən',
    sub: 'Arxanda qaranlıq yavaş-yavaş qalxır. Dayanmaq olmaz.',
    bg: 'bg_street', bgParallax: 0.3, rain: 'heavy', mood: 'tense', dark: 0.5,
    mode: 'chase',
    width: 3400,
    objective: 'Damda qaç. Qaranlıq arxanca gəlir — dayanma.',
    start: { x: 120, y: G },
    checkpoints: [560, 1240, 2000, 2720],
    platforms: cat(floor(0, 3400), k1.platforms, k2.platforms, k3.platforms, k4.platforms),
    hazards: [spikes(900, 60), spikes(1700, 60), spikes(2400, 60), spikes(3050, 60)],
    props: [
      { a: 'prop_lamppost', x: 250, y: G, s: 0.95 },
      { a: 'prop_barrel', x: 700, y: G, s: 0.9 },
      { a: 'prop_fence', x: 1000, y: G, s: 0.95 },
      { a: 'prop_barrel2', x: 1400, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1820, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 2160, y: G, s: 0.9 },
      { a: 'prop_fence', x: 2540, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 2880, y: G, s: 0.95 },
      { a: 'prop_barrel2', x: 3200, y: G, s: 0.9 }
    ],
    items: cat(
      coins(170, 340, G - 36, 4),
      k1.items, k2.items, k3.items, k4.items,
      [{ type: 'ammo', x: k1.l3.x + 65, y: k1.l3.y - 34 }],
      [{ type: 'ammo', x: k2.l2.x + 65, y: k2.l2.y - 30 }],
      [{ type: 'medkit', x: k3.l2.x + 65, y: k3.l2.y - 30 }],
      [{ type: 'medkit', x: k4.l3.x + 65, y: k4.l3.y - 30 }],
      coins(1820, 1940, G - 36, 3),
      coins(2520, 2640, G - 36, 3),
      { type: 'note', x: 700, y: G - 30, icon: 'prop_ladder', jid: 'j_stairs', title: 'Qara pilləkən', lines: [
        { who: '', text: 'Pilləkənin ortasında bir ayaqqabı. Tək. Sonra ikinci — üç pillə yuxarıda.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Kimsə qaçarkən ayaqqabılarını itirib. Və heç vaxt geri qayıtmayıb.' }
      ] },
      { type: 'note', x: 3180, y: G - 30, icon: 's_blood', jid: 'j_roof', title: 'Damda', lines: [
        { who: '', text: 'Damın kənarında iki əl izi var — biri mənim, biri onun.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Aralarında on beş santimetr. O qədər yaxın, o qədər uzaq.' }
      ] }
    ),
    enemies: [
      { type: 'hound', x: 1000, y: G, patrol: [940, 1120], speed: 142 },
      { type: 'crawler', x: 1560, y: G, patrol: [1480, 1640], speed: 120 },
      { type: 'horn', x: 2260, y: G, patrol: [2200, 2360], speed: 86 },
      { type: 'veil', x: 2900, y: G - 80, speed: 84 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, mode: 'chase', lines: [
        { who: '', text: 'Pilləkənin başında ayaq saxladım. Aşağıda qaranlıq var — hərəkət edir.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu qaranlıq mənim arxamca gəlir. Nəfəs aldıqca yaxınlaşır.' },
        { who: '', text: '[Qaçış] Dayansan, qaranlıq səni tutacaq. Qaç!' }
      ] },
      { x: 1700, once: true, lines: [
        { who: '', text: 'Damın kənarında dayandım. Aşağıda Bakı — işıqları bir-bir sönür.' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Dörd il əvvəl də bu damda dayanmışdın, Nuran. Amma o vaxt arxaya baxmırdın.' }
      ] },
      { x: 2900, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Qaranlıq yavaşladı. Sanki nəfəsini saxlayır.' }
      ] }
    ],
    exit: { x: 3320, y: G, to: 9 }
  };

  /* ============================================================
     X — Dəniz kənarı stansiya  (puzzle: iki qolu işə sal)
     ============================================================ */
  var s1 = ladder(420), s2 = ladder(1060), s3 = ladder(1760), s4 = ladder(2460);

  var ch10 = {
    id: 'ch10',
    kicker: 'Bölmə X',
    name: 'Stansiya · 03:14',
    sub: 'Bu qatar dörd ildir hər gecə eyni vaxtda gəlir.',
    bg: 'bg_pier', bgParallax: 0.22, rain: 'light', mood: 'calm', dark: 0.3,
    mode: 'puzzle',
    width: 3200,
    objective: 'İki naqil qolunu işə sal — sonra qatar qapısı açılacaq.',
    start: { x: 100, y: G },
    checkpoints: [520, 1180, 1880, 2560],
    platforms: cat(floor(0, 3200), s1.platforms, s2.platforms, s3.platforms, s4.platforms),
    hazards: [spikes(800, 60), spikes(1420, 60), spikes(2120, 60), spikes(2780, 60)],
    props: [
      { a: 'prop_bench', x: 200, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 340, y: G, s: 0.95 },
      { a: 'prop_bench', x: 700, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 940, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1220, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 1600, y: G, s: 0.95 },
      { a: 'prop_bench', x: 1960, y: G, s: 0.9 },
      { a: 'prop_barrel2', x: 2280, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 2620, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2960, y: G, s: 0.9 }
    ],
    items: cat(
      coins(160, 320, G - 36, 4),
      s1.items, s2.items, s3.items, s4.items,
      [{ type: 'lever', x: s1.l3.x + 65, y: s1.l3.y - 30, id: 'L1' }],
      [{ type: 'lever', x: s3.l3.x + 65, y: s3.l3.y - 30, id: 'L2' }],
      [{ type: 'ammo', x: s2.l2.x + 65, y: s2.l2.y - 30 }],
      [{ type: 'medkit', x: s4.l2.x + 65, y: s4.l2.y - 30 }],
      coins(1560, 1740, G - 36, 3),
      coins(2240, 2420, G - 36, 3),
      { type: 'note', x: 340, y: G - 30, icon: 'u_lock', jid: 'j_clock', title: '03:14', lines: [
        { who: '', text: 'Stansiyanın saatı həmişə 03:14-də dayanıb. Bilet satan adam dedi:' },
        { who: '', text: '“Bu qatar dörd ildir ki, hər gecə eyni vaxtda gəlir. Heç kim minmir. Bir nəfər də düşmür.”' }
      ] },
      { type: 'note', x: 1960, y: G - 30, icon: 'i_scroll', jid: 'j_ticket', title: 'İki bilet', lines: [
        { who: '', text: 'Kassanın altında iki bilet var.' },
        { who: '', text: 'Birində adım yazılıb: “Nuran Ə.” Digərində hərflər silinib.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Barmağımla toxunanda hərflər qalxdı: “Sanu M.”' }
      ] },
      choice({
        cid: 'ticket', x: 2380, icon: 'i_scroll', title: 'Bilet',
        prompt: 'Kassada iki bilet var: biri sənin, biri silinmiş adla. Nə edirsən?',
        options: [
          { label: 'İkisini də götür', value: 'both', hint: 'Onun üçün də yer saxla' },
          { label: 'Yalnız öz biletini götür', value: 'one', hint: 'Tək getmək daha asandır' }
        ]
      })
    ),
    enemies: [
      { type: 'skull', x: 560, y: G, patrol: [460, 740], speed: 60 },
      { type: 'hound', x: 1300, y: G, patrol: [1200, 1360], speed: 130 },
      { type: 'lurk', x: 1880, y: G, patrol: [1820, 2000], speed: 88 },
      { type: 'shadow', x: 2300, y: G - 150, speed: 78 },
      { type: 'stalker', x: 2960, y: G, patrol: [2880, 3120], speed: 66 }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Dəniz kənarı. Dəmir relslər yağışda parıldayır. Stansiyada heç kim yoxdur.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Saat 03:14-də dayanıb. Və qatarın qapısı bağlıdır.' },
        { who: '', text: '[Puzzle] İki naqil qolu iki ayrı yerdədir. Hər ikisini işə sal.' }
      ] },
      { x: 1500, once: true, lines: [
        { who: '', text: 'Birinci qol işə düşdü. İşıqlar bir az daha parlaq yandı. Qatarın qapısı cırıldadı.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Hələ bir qol qalır. Və mən hardasa bu qatarı gözləmişəm.' }
      ] },
      { x: 3120, once: true, lines: [
        { who: '', text: 'İkinci qol. Qatarın qapısı tam açıldı — içi boş, işıqları yanır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu qatar məni gözləyir. Dörd ildir.' }
      ] }
    ],
    exit: { x: 3130, y: G, to: 10, needsLevers: 2 }
  };

  /* ============================================================
     XI — Pərdə tuneli  (dark + veil)
     ============================================================ */
  var v1 = ladder(440), v2 = ladder(1240), v3 = ladder(2060), v4 = ladder(2860);

  var ch11 = {
    id: 'ch11',
    kicker: 'Bölmə XI',
    name: 'Pərdə tuneli',
    sub: 'Pərdənin arxasında hamı arxası sənə dayanıb.',
    bg: 'bg_forest', bgParallax: 0.2, rain: 'off', mood: 'tense', dark: 0.72,
    mode: 'dark',
    width: 3600,
    objective: 'Tunelin sonuna çat. Pərdəyə toxunma — yoxsa onlar dönəcək.',
    start: { x: 100, y: G },
    checkpoints: [540, 1320, 2140, 2940],
    platforms: cat(floor(0, 3600), v1.platforms, v2.platforms, v3.platforms, v4.platforms),
    hazards: [spikes(860, 60), spikes(1640, 60), spikes(2440, 60), spikes(3230, 60)],
    props: [
      { a: 'prop_tree', x: 210, y: G, s: 1.15, dark: true },
      { a: 'prop_barrel', x: 620, y: G, s: 0.9 },
      { a: 'prop_tree', x: 980, y: G, s: 1.2, dark: true },
      { a: 'prop_plant', x: 1420, y: G, s: 1.0 },
      { a: 'prop_tree', x: 1780, y: G, s: 1.1, dark: true },
      { a: 'prop_barrel2', x: 2200, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2600, y: G, s: 1.2, dark: true },
      { a: 'prop_plant', x: 3020, y: G, s: 1.0 },
      { a: 'prop_tree', x: 3380, y: G, s: 1.1, dark: true }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      v1.items, v2.items, v3.items, v4.items,
      [{ type: 'ammo', x: v1.l3.x + 65, y: v1.l3.y - 34 }],
      [{ type: 'ammo', x: v2.l1.x + 65, y: v2.l1.y - 30 }],
      [{ type: 'medkit', x: v3.l2.x + 65, y: v3.l2.y - 30 }],
      [{ type: 'medkit', x: v4.l1.x + 65, y: v4.l1.y - 30 }],
      [{ type: 'ammo', x: v4.l3.x + 65, y: v4.l3.y - 34 }],
      coins(1760, 1900, G - 36, 3),
      coins(2560, 2680, G - 36, 3),
      { type: 'note', x: 620, y: G - 30, icon: 'mon_veil', jid: 'j_veil', title: 'Pərdə', lines: [
        { who: '', text: 'Tunelin ortasında pərdə kimi bir şey asılıb. Onun arxasında insanlar dayanıb — hamısı arxası mənə.' },
        { who: '', text: 'Onların arasında bir qız var. Boynuma sarılanlar kimi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Toxunmaq istədim. Pərdə yırtıldı.' }
      ] },
      choice({
        cid: 'veil', x: 2060, icon: 'mon_veil', title: 'Pərdə',
        prompt: 'Pərdənin arxasında onlar dayanıb. Bir addım — və hamısı dönəcək.',
        options: [
          { label: 'Pərdəni arala, üzünə bax', value: 'open', hint: 'Həqiqəti görmək qorxudur' },
          { label: 'Gözlərini yum, keç get', value: 'pass', hint: 'Onlar səni görməsin' }
        ]
      })
    ),
    enemies: [
      { type: 'veil', x: 700, y: G - 60, speed: 80 },
      { type: 'shadow', x: 1160, y: G - 140, speed: 82 },
      { type: 'veil', x: 1560, y: G - 90, speed: 76 },
      { type: 'stalker', x: 2200, y: G, patrol: [2120, 2360], speed: 76 },
      { type: 'veil', x: 2700, y: G - 70, speed: 84 },
      { type: 'shadow', x: 3160, y: G - 160, speed: 88 }
    ],
    npcs: [],
    triggers: [
      { x: 250, once: true, lines: [
        { who: '', text: 'Tunelə girmişəm. İşıq yoxdur — yalnız pərdələr. Onlar nəfəs alır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: '[2] lampa. Qaranlıqda gözlər məni görəndə qaçmalıyam.' }
      ] },
      { x: 1800, once: true, lines: [
        { who: '', text: 'Arxada pərdə yırtıldı. Sonra ikinci. Sonra hamısı birdən.' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Onlar səni tanıyır, Nuran. Onlar sənin buraxdığın insanlardır.' }
      ] },
      { x: 3300, once: true, lines: [
        { who: '', text: 'Son pərdə. Arxasında işıq var — və qatarın səsi.' }
      ] }
    ],
    exit: { x: 3520, y: G, to: 11 }
  };

  /* ============================================================
     XII — Oyanış  (final boss + son qərar)
     ============================================================ */
  var x1 = ladder(420), x2 = ladder(1100), x3 = ladder(1800), x4 = ladder(2400);

  var ch12 = {
    id: 'ch12',
    kicker: 'Bölmə XII',
    name: 'Oyanış',
    sub: '“Həqiqət göz kimidir — baxmaqdan qaçmaq olmur.”',
    bg: 'bg_baku', bgParallax: 0.3, rain: 'heavy', mood: 'tense', dark: 0.44,
    mode: 'boss',
    width: 3000,
    objective: 'Gözə bax. Qaçma. Bu, son qapıdır.',
    start: { x: 100, y: G },
    checkpoints: [520, 1240, 1940, 2560],
    platforms: cat(floor(0, 3000), x1.platforms, x2.platforms, x3.platforms, x4.platforms),
    hazards: [spikes(850, 60), spikes(2200, 60)],
    props: [
      { a: 'prop_lamppost', x: 230, y: G, s: 0.95 },
      { a: 'prop_bench', x: 660, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1000, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1490, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 1990, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2320, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2740, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2920, y: G, s: 1.0, dark: true }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      x1.items, x2.items, x3.items, x4.items,
      [{ type: 'ammo', x: x1.l3.x + 65, y: x1.l3.y - 34 }],
      [{ type: 'ammo', x: x2.l2.x + 65, y: x2.l2.y - 30 }],
      [{ type: 'medkit', x: x2.l3.x + 65, y: x2.l3.y - 30 }],
      [{ type: 'medkit', x: x3.l2.x + 65, y: x3.l2.y - 30 }],
      [{ type: 'ammo', x: x4.l3.x + 65, y: x4.l3.y - 34 }],
      coins(1660, 1860, G - 36, 3),
      { type: 'note', x: 660, y: G - 30, icon: 'i_gem', jid: 'j_last', title: 'Son söz', lines: [
        { who: '', text: 'Skamyanın üstündə bir kağız var. Yağış onu islatmayıb — sanki indicə qoyulub.' },
        { who: 'Sanu', portrait: 'sanu_ghost', text: '“Sən məni xatırlamaq istəmədin, mən də səni unutdum. Amma unutmaq — bağışlamaq deyil.”' }
      ] }
    ),
    enemies: [
      { type: 'veil', x: 1470, y: G - 80, speed: 76 },
      { type: 'shadow', x: 1690, y: G - 150, speed: 82 },
      { type: 'horn', x: 2000, y: G, patrol: [1940, 2120], speed: 82 },
      { type: 'eye2', x: 2220, y: G - 120, hp: 30, speed: 72, boss: true, final: true }
    ],
    npcs: [
      {
        kind: 'sanu_ghost', sprite: 'sanu_ghost', x: 2760, y: G, s: 1.05,
        final: true, gift: true, needsBoss: true,
        talk: [
          { who: 'Sanu', portrait: 'sanu_ghost', text: 'Sən hələ də məni axtarırsan?' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Sən kimsən? Sən əslində kim idin?' },
          { who: 'Sanu', portrait: 'sanu_ghost', text: 'Mən sənin itirdiyin şeyəm. Sən məni xatırlamaq istəmədin.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Yalan deyirsən. Mən səni...' },
          { who: 'Sanu', portrait: 'sanu_ghost', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən isə itirməkdənsə, unutmağı seçdin.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Sanu... məni bağışla. Gecikdim. Dörd il gecikdim.' },
          { who: 'Sanu', portrait: 'sanu_ghost', text: 'Artıq gecdir. Amma sən hələ də nəfəs alırsan. Bu kifayətdir.' },
          { who: '', text: 'O, yağışın içində bir dəfə daha göründü — və bu dəfə gözlərində qorxu yox idi.' }
        ]
      }
    ],
    triggers: [
      { x: 250, once: true, lines: [
        { who: '', text: 'Bulvar yenə boş idi. Amma bu dəfə göy üzündə bir göz açılmışdı.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Deməli varsan. Məni izləyən şey — sən.' }
      ] },
      { x: 1400, once: true, lines: [
        { who: '', text: 'Yağış damlaları havada dayandı. Sonra geri, yuxarı qalxdı.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu qorxu mənim içimdədir. Ona görə də onu yalnız mən dayandıra bilərəm.' }
      ] },
      { x: 2140, once: true, mode: 'boss', lines: [
        { who: '', text: 'Göz böyüdü. İçində — dörd il əvvəlki o axşam.' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Bax. Qaçmaq istəsən də, bax.' }
      ] }
    ],
    exit: null
  };

  /* ---------------- registry ---------------- */
  var LEVELS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8, ch9, ch10, ch11, ch12];

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
    if (!L.mode) L.mode = 'calm';
  });

  global.GameLevels = LEVELS;
  global.GameCfg = { G: G, STEP_Y: STEP_Y, STEP_X: STEP_X, LEDGE_W: LEDGE_W };
})(window);
