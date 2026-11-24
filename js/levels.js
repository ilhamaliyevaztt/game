/* ============================================================
   levels.js — 7 chapters, BDU story (Sanu · Nuran)
   ------------------------------------------------------------
   GEOMETRY CONTRACT (validated in tools/validate-levels.js)
   · ground surface y = 470, one continuous floor per chapter
     (no bottomless pits — falling off is never instant death)
   · jump height 138px  |  run air reach 188px
   · ladder steps: dy = 100, dx = 80  → always climbable
   · every spike sits on solid ground with >= 80px of clear
     landing room on both sides
   · props are decorative only: never on a spike, never < 90px
     apart, never floating in mid-air
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

  /* ============================================================
     I — Yağışlı Bakı   (təmiz giriş, düşmən yox, öyrədici)
     ============================================================ */
  var a1 = ladder(400), a2 = ladder(1000), a3 = ladder(1620), a4 = ladder(2220);

  var ch1 = {
    id: 'ch1',
    kicker: 'Bölmə I',
    name: 'Yağışlı Bakı',
    sub: 'Axşam idi. Yağış yavaş-yavaş yağırdı.',
    bg: 'bg_baku', bgParallax: 0.34, rain: 'light', mood: 'calm', dark: 0.12,
    width: 2800,
    objective: 'Bulvar boyu irəli get. Fənərin altında tək dayanan biri var.',
    start: { x: 120, y: G },
    checkpoints: [520, 1120, 1740, 2340],
    platforms: cat(floor(0, 2800), a1.platforms, a2.platforms, a3.platforms, a4.platforms),
    hazards: [spikes(800, 60), spikes(2000, 60)],
    props: [
      { a: 'prop_fence', x: 80, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 240, y: G, s: 0.95 },
      { a: 'prop_bench', x: 350, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 560, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 690, y: G, s: 0.95 },
      { a: 'prop_sign', x: 960, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1180, y: G, s: 1.0, dark: true },
      { a: 'prop_barrel2', x: 1400, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 1560, y: G, s: 0.95 },
      { a: 'prop_plant', x: 1830, y: G, s: 0.85 },
      { a: 'prop_fence', x: 2180, y: G, s: 0.95 },
      { a: 'prop_lamppost', x: 2400, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2560, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2680, y: G, s: 0.8 }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      a1.items, a2.items, a3.items, a4.items,
      coins(1040, 1260, G - 36, 3),
      coins(1660, 1880, G - 36, 3),
      coins(2260, 2460, G - 36, 3),
      { type: 'medkit', x: a4.l2.x + 65, y: a4.l2.y - 30 },
      { type: 'note', x: 560, y: G - 30, icon: 'i_letter', jid: 'j_letter', title: 'Islanmış vərəq', lines: [
        { who: '', text: 'Skamyanın üstündə bir vərəq var. Yağış mürəkkəbi axıdıb, amma bir cümlə hələ oxunur.' },
        { who: '', text: '“Bəzən insan sevdiyi şeyləri itirməkdən qorxur.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu əl yazısı... Bunu mən yazmışam. Nə vaxt? Niyə xatırlamıram?' }
      ] },
      { type: 'phone', x: 1400, y: G - 28, icon: 'u_phone', jid: 'j_phone1', title: 'Naməlum nömrə', lines: [
        { who: '', text: 'Ekranda tanımadığım bir nömrədən mesaj var. Vaxt: bu gecə, 03:14.' },
        { who: '???', portrait: 'u_phone_sanu', text: 'Sən hələ də məni axtarırsan?' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Kimdir bu? Nömrə... mövcud deyil.' },
        { who: '', text: 'Mesajı silmək istədim. Barmağım düyməyə getmədi.' }
      ] }
    ),
    enemies: [],
    npcs: [
      {
        kind: 'sanu', sprite: 'sanu_a0', x: 2560, y: G, s: 1.0, gift: true,
        talk: [
          { who: 'Nuran', portrait: 'nuran_0', text: 'Evə qayıdırdım. Bulvar isə tamamilə boş idi.' },
          { who: 'Sanu', portrait: 'sanu_a0', text: 'Sən də buradan keçirsən? Hər gecə eyni saatda.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Sən tək? Bu soyuqda, bu yağışda?' },
          { who: 'Sanu', portrait: 'sanu_a1', text: 'Mənim adım Sanu-dur. Sən isə Nuran. Bilirəm.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Hardan bilirsən?' },
          { who: 'Sanu', portrait: 'sanu_a2', text: 'Çünki mən səni çoxdan tanıyıram. Sən isə məni... yenicə xatırlayırsan.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Mən səni tanımıram. İlk dəfədir görürəm.' },
          { who: 'Sanu', portrait: 'sanu_a0', text: 'Yox. Sadəcə beynin məni sildi. Amma silinən şey yox olmur — yalnız gözlənir.' },
          { who: 'Sanu', portrait: 'sanu_a1', text: 'Sabah universitetə gəl. Kafedranın qabağında gözləyəcəyəm.' },
          { who: 'Nuran', portrait: 'nuran_0', text: 'Universitet? Amma tətildir ki...' },
          { who: 'Sanu', portrait: 'sanu_a2', text: 'Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Sən də qorxursan?' }
        ],
        after: 'O, yağışın içində əridi — sanki heç olmamışdı.'
      }
    ],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Yağış yavaş-yavaş yağırdı. Fənərlər bir-bir sönürdü.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Yenə gecikdim. Yataqxanaya çatmaq üçün bu bulvardan keçməliyəm.' },
        { who: '', text: 'Cibimdə telefon titrədi. Ekran işığında yalnız bir sətir göründü: “03:14”.' }
      ] },
      { x: 1250, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu bulvarda hər gecə eyni qoxu var: yağış, dəniz və köhnə kağız.' },
        { who: '', text: 'Nə qədər ki bu yolu tanıyıram — bir o qədər də yad görünür.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Sanki kimsə bu yolu mənim üçün təkrar-təkrar düzür.' }
      ] },
      { x: 2300, once: true, lines: [
        { who: '', text: 'Fənərin altında bir kölgə dayanmışdı. Yaxınlaşdıqca kölgə qadın siluetinə çevrildi.' }
      ] }
    ],
    exit: { x: 2740, y: G, to: 1 }
  };

  /* ============================================================
     II — BDU həyəti
     ============================================================ */
  var b1 = ladder(460), b2 = ladder(1150), b3 = ladder(1850), b4 = ladder(2550);

  var ch2 = {
    id: 'ch2',
    kicker: 'Bölmə II',
    name: 'BDU həyəti',
    sub: 'Universitetin həyəti gecə daha böyük görünür.',
    bg: 'bg_bdu', bgParallax: 0.26, rain: 'light', mood: 'tense', dark: 0.2,
    width: 3200,
    objective: 'Həyətdən keç. Baş binanın qapısı qıfıllıdır — açarı tap.',
    start: { x: 110, y: G },
    checkpoints: [560, 1240, 1940, 2640],
    platforms: cat(floor(0, 3200), b1.platforms, b2.platforms, b3.platforms, b4.platforms),
    hazards: [spikes(850, 60), spikes(1550, 60), spikes(2260, 60)],
    props: [
      { a: 'prop_tree', x: 170, y: G, s: 1.1 },
      { a: 'prop_fence', x: 380, y: G, s: 0.9 },
      { a: 'prop_flowerpot', x: 700, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 960, y: G, s: 1.0 },
      { a: 'prop_tree', x: 1280, y: G, s: 0.95, flip: true },
      { a: 'prop_barrel', x: 1420, y: G, s: 0.9 },
      { a: 'prop_sign', x: 1680, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1980, y: G, s: 1.15, dark: true },
      { a: 'prop_lamppost', x: 2180, y: G, s: 0.9 },
      { a: 'prop_plant', x: 2400, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2700, y: G, s: 1.1, dark: true },
      { a: 'prop_fence', x: 2880, y: G, s: 0.9 },
      { a: 'prop_lamppost', x: 3010, y: G, s: 0.85 }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      b1.items, b2.items, b3.items, b4.items,
      [{ type: 'key', x: b2.l3.x + 65, y: b2.l3.y - 34, id: 'bdu' }],
      [{ type: 'medkit', x: b4.l2.x + 65, y: b4.l2.y - 30 }],
      [{ type: 'ammo', x: b3.l3.x + 65, y: b3.l3.y - 34 }],
      coins(1680, 1840, G - 36, 3),
      coins(2340, 2500, G - 36, 2),
      { type: 'note', x: b1.l2.x + 65, y: b1.l2.y - 30, icon: 'i_scroll', jid: 'j_notice', title: 'Divardakı elan', lines: [
        { who: '', text: 'Elan lövhəsi: “314-cü auditoriya təmirə görə bağlıdır. Heç kim girməsin.”' },
        { who: '', text: 'Aşağıda kiminsə əli ilə yazılıb: “O, hələ də orada gözləyir.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: '314... Bu rəqəm mənim yuxularımda da var. Hər gecə.' }
      ] }
    ),
    enemies: [
      { type: 'skull', x: 600, y: G, patrol: [480, 820], speed: 54 },
      { type: 'crawler', x: 1050, y: G, patrol: [930, 1100], speed: 92 },
      { type: 'stalker', x: 1750, y: G, patrol: [1650, 1840], speed: 60 },
      { type: 'hound', x: 2450, y: G, patrol: [2360, 2520], speed: 128 },
      { type: 'skull', x: 2950, y: G, patrol: [2880, 3140], speed: 62 }
    ],
    npcs: [],
    triggers: [
      { x: 300, once: true, lines: [
        { who: '', text: 'Darvazada lövhə: “BAKI DÖVLƏT UNİVERSİTETİ · 1919”.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Dörd ildir bu həyətdən keçirəm. Amma heç vaxt bu qədər sakit olmamışdı.' },
        { who: 'Sanu', portrait: 'sanu_a1', text: 'Sən məni heç vaxt sorğu-sual etmirsən. Niyə?' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Çünki bilirəm ki, cavab məni qorxudar.' }
      ] },
      { x: 1600, once: true, lines: [
        { who: '', text: 'Ayaq səsimdən başqa bir səs də var. Həmişə iki addım arxada.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Dönürəm. Heç kim yoxdur. Amma addımlar dayanmır.' }
      ] },
      { x: 2960, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Baş binanın qapısı. Qıfıllıdır. Açar olmadan keçə bilmərəm.' }
      ] }
    ],
    exit: { x: 3080, y: G, to: 2, needsKey: true }
  };

  /* ============================================================
     III — Universitet dəhlizi
     ============================================================ */
  var c1 = ladder(380), c2 = ladder(1100), c3 = ladder(1900), c4 = ladder(2660);

  var ch3 = {
    id: 'ch3',
    kicker: 'Bölmə III',
    name: 'Universitet dəhlizi',
    sub: 'Dəhlizlər gecə uzanır, qapılar isə yad adlar daşıyır.',
    bg: 'bg_campus', bgParallax: 0.2, rain: 'off', mood: 'tense', dark: 0.34,
    width: 3400,
    objective: 'Dəhlizlə irəli get. İki açar — iki qıfıllı qapı.',
    start: { x: 100, y: G },
    checkpoints: [480, 1200, 2000, 2760],
    platforms: cat(floor(0, 3400), c1.platforms, c2.platforms, c3.platforms, c4.platforms),
    hazards: [spikes(760, 60), spikes(1480, 60), spikes(2300, 60)],
    props: [
      { a: 'prop_bookshelf', x: 200, y: G, s: 1.15 },
      { a: 'prop_bench', x: 600, y: G, s: 0.9 },
      { a: 'prop_flowerpot', x: 920, y: G, s: 0.95 },
      { a: 'prop_bookshelf', x: 1250, y: G, s: 1.1 },
      { a: 'prop_plant', x: 1620, y: G, s: 0.95 },
      { a: 'prop_bench', x: 1780, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 2100, y: G, s: 1.1 },
      { a: 'prop_plant', x: 2480, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2880, y: G, s: 1.1 },
      { a: 'prop_bench', x: 3160, y: G, s: 0.9 }
    ],
    items: cat(
      coins(150, 320, G - 36, 4),
      c1.items, c2.items, c3.items, c4.items,
      [{ type: 'key', x: c2.l3.x + 65, y: c2.l3.y - 34, id: 'k1' }],
      [{ type: 'key', x: c4.l3.x + 65, y: c4.l3.y - 34, id: 'k2' }],
      [{ type: 'ammo', x: c1.l3.x + 65, y: c1.l3.y - 34 }],
      [{ type: 'ammo', x: c3.l2.x + 65, y: c3.l2.y - 30 }],
      [{ type: 'medkit', x: c3.l3.x + 65, y: c3.l3.y - 30 }],
      coins(1640, 1860, G - 36, 3),
      coins(2400, 2580, G - 36, 3),
      { type: 'photo', x: c1.l2.x + 65, y: c1.l2.y - 30, icon: 's_portrait', jid: 'j_photo1', title: 'Cızılmış şəkil', lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu şəkil... 314-cü auditoriya. Cərgədə oturanlar arasında mən də varam.' },
        { who: '', text: 'Yanımda bir qız oturub. Üzü qələmlə cızılıb — sanki kimsə onu silmək istəyib.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Arxasında yazılıb: “Məni xatırla. Məni bağışla.”' },
        { who: '', text: 'Kağızın küncü barmaqlarımın altında titrədi.' }
      ] },
      { type: 'phone', x: 2260, y: G - 28, icon: 'u_phone', jid: 'j_phone2', title: 'İki mesaj', lines: [
        { who: '', text: 'Yenə həmin nömrə. Bu dəfə iki mesaj.' },
        { who: '???', portrait: 'u_phone_sanu', text: '314-cü auditoriyaya gəl.' },
        { who: '???', portrait: 'u_phone_sanu', text: 'Qorxma. Mən səni gözləyirəm.' }
      ] },
      { type: 'note', x: 3200, y: G - 30, icon: 's_letter_blood', jid: 'j_blood', title: 'Divar yazısı', lines: [
        { who: '', text: 'Divarda qanla yazılıb: “SƏN HEÇ VAXT MƏNİ HƏQİQƏTƏN TANIMAMIŞSAN.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu nə deməkdir? Sanu?!' },
        { who: '', text: 'Dəhlizin sonunda bir qapı çırpıldı.' }
      ] }
    ),
    enemies: [
      { type: 'crouch', x: 950, y: G, patrol: [860, 1080], speed: 96 },
      { type: 'hound', x: 1300, y: G, patrol: [1120, 1380], speed: 138 },
      { type: 'skull', x: 1750, y: G, patrol: [1600, 1880], speed: 58 },
      { type: 'shadow', x: 2100, y: G - 150, speed: 78 },
      { type: 'crouch', x: 2450, y: G, patrol: [2380, 2620], speed: 104 },
      { type: 'stalker', x: 3050, y: G, patrol: [2980, 3240], speed: 64 }
    ],
    npcs: [],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Dəhlizin işıqları nəfəs alırmış kimi yanıb-sönür.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Burada dərsə gəlmişəm, yüz dəfə. Amma indi qapı nömrələri... düzülmür.' },
        { who: '', text: '101, 102, 314, 102. Sonra yenə 314.' }
      ] },
      { x: 1700, once: true, lines: [
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu dəhlizdə heç nə yoxdur. Yalnız toz, köhnə kağız və qan.' },
        { who: 'Sanu', portrait: 'sanu_a2', text: 'Yoxdur? Sən sadəcə baxmaq istəmirsən.' }
      ] }
    ],
    exit: { x: 3300, y: G, to: 3, needsKeys: 2 }
  };

  /* ============================================================
     IV — Auditoriya 314
     ============================================================ */
  var d1 = ladder(400), d2 = ladder(1050), d3 = ladder(1800), d4 = ladder(2300);

  var ch4 = {
    id: 'ch4',
    kicker: 'Bölmə IV',
    name: 'Auditoriya 314',
    sub: 'Bu otaqda bir dəfə çox vacib bir şey deyilməli idi.',
    bg: 'bg_class', bgParallax: 0.16, rain: 'off', mood: 'calm', dark: 0.28,
    width: 3000,
    objective: 'Auditoriyanın o biri ucuna çat. O, səni gözləyir.',
    start: { x: 100, y: G },
    checkpoints: [460, 1150, 1900, 2500],
    platforms: cat(floor(0, 3000), d1.platforms, d2.platforms, d3.platforms, d4.platforms),
    hazards: [spikes(780, 60), spikes(1500, 60)],
    props: [
      { a: 'prop_table', x: 220, y: G, s: 1.0 },
      { a: 'prop_chair', x: 320, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 620, y: G, s: 1.15 },
      { a: 'prop_table', x: 900, y: G, s: 1.0 },
      { a: 'prop_flowerpot', x: 1240, y: G, s: 1.0 },
      { a: 'prop_table', x: 1400, y: G, s: 1.0 },
      { a: 'prop_chair', x: 1660, y: G, s: 1.0 },
      { a: 'prop_table', x: 1960, y: G, s: 1.0 },
      { a: 'prop_plant', x: 2200, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 2450, y: G, s: 1.1 },
      { a: 'prop_table', x: 2600, y: G, s: 1.0 }
    ],
    items: cat(
      coins(150, 320, G - 36, 4),
      d1.items, d2.items, d3.items, d4.items,
      [{ type: 'photo', x: d3.l3.x + 65, y: d3.l3.y - 34, icon: 's_portrait', jid: 'j_photo2', title: 'Parta üstündəki şəkil', lines: [
        { who: '', text: 'Şəkildə iki əl görünür. Biri dəftər tutur, digəri çiçək.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Mən bu çiçəyi... ona vermək istəmişdim. Amma heç vaxt vermədim.' },
        { who: 'Sanu', portrait: 'sanu_a1', text: 'Sən həmişə “bir gün daha” gözləyirdin. Bir gün daha. Sonra heç bir gün qalmadı.' }
      ] }],
      [{ type: 'ammo', x: d2.l3.x + 65, y: d2.l3.y - 34 }],
      [{ type: 'medkit', x: d4.l2.x + 65, y: d4.l2.y - 30 }],
      coins(1600, 1780, G - 36, 3),
      coins(2060, 2240, G - 36, 2),
      { type: 'note', x: d1.l2.x + 65, y: d1.l2.y - 30, icon: 'u_msgbox', jid: 'j_board', title: 'Lövhədə', lines: [
        { who: '', text: 'Lövhədə təbaşir ilə yazılıb: “Sanu hələ də məni axtarırsan?”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu yazı bugünkü deyil. Tozun altından çıxır — illərlə buradadır.' },
        { who: '', text: 'Və altında, daha kiçik hərflərlə: “Mən də səni.”' }
      ] }
    ),
    enemies: [
      { type: 'hound', x: 950, y: G, patrol: [860, 1040], speed: 132 },
      { type: 'crouch', x: 1650, y: G, patrol: [1620, 1780], speed: 100 },
      { type: 'lurk', x: 2200, y: G, patrol: [2120, 2290], speed: 92 },
      { type: 'shadow', x: 1900, y: G - 160, speed: 74 }
    ],
    npcs: [
      {
        kind: 'sanu', sprite: 'sanu_a2', x: 2700, y: G, s: 1.0, gift: true,
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
        after: 'O, bir dəfə gülümsədi — və otaq işıqlandı.'
      }
    ],
    triggers: [
      { x: 260, once: true, lines: [
        { who: '', text: 'Qapının üstündə: “314”. Altında kiçik bir kağız: “Burada bir dəfə bir qız gözlədi.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu otaqda otuz iki dəfə imtahan verdim. Və bir dəfə də... cavab vermədim.' }
      ] },
      { x: 1600, once: true, lines: [
        { who: '', text: 'Partaların üstündə toz qatı var. Amma biri təmizdir — sanki kimsə indicə qalxıb.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu, mənim yerim idi. Yanımdakı yer isə... heç vaxt boş olmamışdı.' }
      ] }
    ],
    exit: { x: 2920, y: G, to: 4 }
  };

  /* ============================================================
     V — Arxiv zirzəmisi
     ============================================================ */
  var e1 = ladder(420), e2 = ladder(1150), e3 = ladder(1900), e4 = ladder(2650), e5 = ladder(3200);

  var ch5 = {
    id: 'ch5',
    kicker: 'Bölmə V',
    name: 'Arxiv zirzəmisi',
    sub: 'Səs aşağıdan gəlirdi — kağız, pas və nəfəs.',
    bg: 'bg_room', bgParallax: 0.18, rain: 'off', mood: 'tense', dark: 0.6,
    width: 3600,
    objective: 'İki açarı tap, çıxış qapısını aç. Qaranlıqda lampanı saxla.',
    start: { x: 100, y: G },
    checkpoints: [520, 1240, 2000, 2740, 3300],
    platforms: cat(floor(0, 3600), e1.platforms, e2.platforms, e3.platforms, e4.platforms, e5.platforms),
    hazards: [spikes(800, 60), spikes(1560, 60), spikes(2350, 60), spikes(3050, 60)],
    props: [
      { a: 'prop_barrel', x: 220, y: G, s: 0.9 },
      { a: 'prop_barrel2', x: 620, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 1000, y: G, s: 1.0 },
      { a: 'prop_bookshelf', x: 1350, y: G, s: 1.0 },
      { a: 'prop_barrel', x: 1700, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 2150, y: G, s: 1.0 },
      { a: 'prop_barrel2', x: 2500, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 2850, y: G, s: 0.9 },
      { a: 'prop_bookshelf', x: 3250, y: G, s: 1.05 },
      { a: 'prop_bookshelf', x: 3450, y: G, s: 0.95 }
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
      coins(1660, 1860, G - 36, 3),
      coins(2450, 2620, G - 36, 3),
      { type: 'note', x: e1.l2.x + 65, y: e1.l2.y - 30, icon: 's_hand', jid: 'j_hand', title: 'Divardakı əl izi', lines: [
        { who: '', text: 'Divarda qanlı bir əl izi var. Barmaqlar aşağıya doğru uzanır.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu əl çox kiçikdir... Sanu?' },
        { who: '', text: 'Əlin altında rəqəmlər: 03 · 14' }
      ] },
      { type: 'note', x: 2980, y: G - 30, icon: 'i_letter', jid: 'j_folder', title: 'Arxiv qovluğu', lines: [
        { who: '', text: 'Tozlu qovluqda bir sənəd: “Tələbə Sanu M. — 314-cü qrup. Status: akademik məzuniyyət.”' },
        { who: '', text: 'Tarix: bu gündən dörd il əvvəl.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Məzuniyyət? Amma heç kim mənə demədi... Mən niyə xatırlamıram?' },
        { who: '', text: 'Qovluğun arxasında ikinci səhifə var. Daha köhnə mürəkkəb.' },
        { who: '', text: '“Nuran Ə. — müraciət: psixoloji dəstək. Səbəb: travmatik itki. Yaddaşın qoruyucu silinməsi aparılıb.”' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Deməli... xatırlamamaq mənim qərarım deyildi. Bu, müdafiə idi. Mən özümü sildirmişəm.' }
      ] }
    ),
    enemies: [
      { type: 'skull', x: 550, y: G, patrol: [300, 680], speed: 66 },
      { type: 'crawler', x: 1000, y: G, patrol: [880, 1120], speed: 112 },
      { type: 'stalker', x: 1750, y: G, patrol: [1650, 1880], speed: 72 },
      { type: 'shadow', x: 2100, y: G - 130, speed: 80 },
      { type: 'crawler', x: 2520, y: G, patrol: [2440, 2620], speed: 118 },
      { type: 'skull', x: 2950, y: G, patrol: [2880, 3030], speed: 70 },
      { type: 'horn', x: 3350, y: G, patrol: [3220, 3480], speed: 74 }
    ],
    npcs: [],
    triggers: [
      { x: 240, once: true, lines: [
        { who: '', text: 'Pilləkən aşağıya, tam qaranlığa aparırdı. Aşağıdan nəm və pas iyi gəlirdi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'İşıq yoxdur... Amma geri qayıtmaq olmaz. O dedi ki, burada bir şey qoyub.' }
      ] },
      { x: 1500, once: true, lines: [
        { who: '', text: 'Küncdən sürünən bir kölgə keçdi. Sonra ikinci. Sonra on.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Onlar məni görürlər. Və qaçmırlar.' }
      ] },
      { x: 3120, once: true, lines: [
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Sən gəldin. Mən bilirdim ki, gələcəksən.' }
      ] }
    ],
    exit: { x: 3500, y: G, to: 5, needsKeys: 2 }
  };

  /* ============================================================
     VI — Kölgə Sanu  (boss)
     ============================================================ */
  var f1 = ladder(420), f2 = ladder(1100), f3 = ladder(1800), f4 = ladder(2400);

  var ch6 = {
    id: 'ch6',
    kicker: 'Bölmə VI',
    name: 'Kölgə Sanu',
    sub: '“Sən məni xatırlamaq istəmədin. Mən də səni unutdum.”',
    bg: 'bg_campus', bgParallax: 0.28, rain: 'heavy', mood: 'tense', dark: 0.46,
    width: 3000,
    objective: 'Kölgəni dayandır. Qaçmaq mümkün deyil — döyüş.',
    start: { x: 100, y: G },
    checkpoints: [480, 1180, 1900, 2500],
    platforms: cat(floor(0, 3000), f1.platforms, f2.platforms, f3.platforms, f4.platforms),
    hazards: [spikes(850, 60), spikes(2200, 60)],
    props: [
      { a: 'prop_lamppost', x: 220, y: G, s: 0.95 },
      { a: 'prop_bench', x: 640, y: G, s: 0.9 },
      { a: 'prop_sign', x: 980, y: G, s: 0.9 },
      { a: 'prop_barrel', x: 1500, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1720, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 2000, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2400, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2560, y: G, s: 0.9 },
      { a: 'prop_tree', x: 2820, y: G, s: 1.1, dark: true }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      f1.items, f2.items, f3.items, f4.items,
      [{ type: 'ammo', x: f1.l3.x + 65, y: f1.l3.y - 34 }],
      [{ type: 'ammo', x: f2.l2.x + 65, y: f2.l2.y - 30 }],
      [{ type: 'medkit', x: f3.l3.x + 65, y: f3.l3.y - 30 }],
      [{ type: 'medkit', x: f4.l2.x + 65, y: f4.l2.y - 30 }],
      coins(1640, 1840, G - 36, 3),
      coins(2340, 2520, G - 36, 3)
    ),
    enemies: [
      { type: 'shadow', x: 1150, y: G - 140, speed: 80 },
      { type: 'hound', x: 1550, y: G, patrol: [1420, 1770], speed: 140 },
      { type: 'veil', x: 1950, y: G - 60, speed: 78 },
      { type: 'shadow', x: 2300, y: G - 170, speed: 88 },
      { type: 'sanu_corrupt', x: 2700, y: G, hp: 18, speed: 80, boss: true }
    ],
    npcs: [],
    triggers: [
      { x: 220, once: true, lines: [
        { who: '', text: 'Həyət qırmızı işığa bürünmüşdü. Yağış artıq tufan idi.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Sanu... haradasan?' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Səncə mən heç vaxt burada olmamışam?' }
      ] },
      { x: 1300, once: true, lines: [
        { who: '', text: 'Addımlarımın arxasınca başqa addımlar da eşidilirdi. Sonra dayandı.' },
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Bəs niyə dörd il gözlədim, Nuran? Niyə?' }
      ] },
      { x: 2450, once: true, lines: [
        { who: 'Sanu', portrait: 'sanu_corrupt', text: 'Daha qaçma. Mən səni bu dəfə buraxmayacağam.' }
      ] }
    ],
    exit: { x: 2920, y: G, to: 6, afterBoss: true }
  };

  /* ============================================================
     VII — Oyanış  (final boss + son dialoq)
     ============================================================ */
  var g1 = ladder(420), g2 = ladder(1100), g3 = ladder(1750);

  var ch7 = {
    id: 'ch7',
    kicker: 'Bölmə VII',
    name: 'Oyanış',
    sub: '“Həqiqət göz kimidir — baxmaqdan qaçmaq olmur.”',
    bg: 'bg_baku', bgParallax: 0.3, rain: 'heavy', mood: 'tense', dark: 0.42,
    width: 2800,
    objective: 'Gözə bax. Qaçma. Bu, son qapıdır.',
    start: { x: 100, y: G },
    checkpoints: [500, 1200, 1900],
    platforms: cat(floor(0, 2800), g1.platforms, g2.platforms, g3.platforms),
    hazards: [spikes(850, 60)],
    props: [
      { a: 'prop_lamppost', x: 220, y: G, s: 0.95 },
      { a: 'prop_bench', x: 640, y: G, s: 0.9 },
      { a: 'prop_sign', x: 960, y: G, s: 0.9 },
      { a: 'prop_tree', x: 1450, y: G, s: 1.1, dark: true },
      { a: 'prop_lamppost', x: 1950, y: G, s: 0.95 },
      { a: 'prop_fence', x: 2280, y: G, s: 0.95 },
      { a: 'prop_bench', x: 2700, y: G, s: 0.9 }
    ],
    items: cat(
      coins(160, 340, G - 36, 4),
      g1.items, g2.items, g3.items,
      [{ type: 'ammo', x: g1.l3.x + 65, y: g1.l3.y - 34 }],
      [{ type: 'ammo', x: g2.l2.x + 65, y: g2.l2.y - 30 }],
      [{ type: 'medkit', x: g2.l3.x + 65, y: g2.l3.y - 30 }],
      [{ type: 'medkit', x: g3.l2.x + 65, y: g3.l2.y - 30 }],
      coins(1620, 1820, G - 36, 3)
    ),
    enemies: [
      { type: 'veil', x: 1450, y: G - 80, speed: 76 },
      { type: 'shadow', x: 1650, y: G - 150, speed: 82 },
      { type: 'eye2', x: 2200, y: G - 120, hp: 24, speed: 70, boss: true, final: true }
    ],
    npcs: [
      {
        kind: 'sanu_ghost', sprite: 'sanu_ghost', x: 2580, y: G, s: 1.05,
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
      { x: 240, once: true, lines: [
        { who: '', text: 'Bulvar yenə boş idi. Amma bu dəfə göy üzündə bir göz açılmışdı.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Deməli varsan. Məni izləyən şey — sən.' }
      ] },
      { x: 1300, once: true, lines: [
        { who: '', text: 'Yağış damlaları havada dayandı. Sonra geri, yuxarı qalxdı.' },
        { who: 'Nuran', portrait: 'nuran_0', text: 'Bu qorxu mənim içimdədir. Ona görə də onu yalnız mən dayandıra bilərəm.' }
      ] },
      { x: 2100, once: true, lines: [
        { who: '', text: 'Göz böyüdü. İçində — dörd il əvvəlki o axşam.' }
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
    tone: 'kind',
    body: [
      'Nuran dizləri üstünə çökdü. Yağış onun üzünü yudu, amma qəlbindəki ləkə getmədi.',
      'Sanu-nun sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
      'O, əlindəki ağ çiçəyi son dəfə qaldırdı. Çiçək islanmışdı, amma hələ də ağ idi.',
      '<em>“Mən səni gözlədim. Səni günahlandırmadım. Sadəcə... bir dəfə də olsun, arxaya baxmağını istədim.”</em>',
      'Səhər açılanda BDU-nun həyətində yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
      'Məktubun içində tək bir cümlə var idi:',
      '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
      'Nuran o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
      'Çünki bəzən kömək istəmək — sadəcə xatırlamaq deməkdir.',
      '<em>— Son —</em>'
    ]
  };

  var ENDING_PLAIN = {
    title: 'Son — Sükut',
    tone: 'cold',
    body: [
      'Nuran dizləri üstünə çökdü. Yağış onun üzünü yudu, amma qəlbindəki ləkə getmədi.',
      'Sanu-nun sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
      'O, heç nə demədi. Deməyə sözü də qalmamışdı.',
      'Səhər açılanda BDU-nun həyətində yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
      'Məktubun içində tək bir cümlə var idi:',
      '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
      'Nuran o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
      'Amma bəzən, gecə yarısı, telefonunu açıb o nömrəyə yenə baxırdı.',
      '<em>— Son —</em>'
    ]
  };

  global.GameLevels = LEVELS;
  global.GameEnding = ENDING_KIND;
  global.GameEndingPlain = ENDING_PLAIN;
  global.GameCfg = { G: G, STEP_Y: STEP_Y, STEP_X: STEP_X, LEDGE_W: LEDGE_W };
})(window);
