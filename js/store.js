/* ============================================================
   store.js — profile, difficulty, inventory, chapters, shop,
              choices/flags, endings, journal
   ------------------------------------------------------------
   v5 (12 chapters)
   · ONE source of truth for consumables: profile.inv.  A shop
     purchase is a real, persistent item the player carries and
     uses inside the run (no draining, nothing evaporates).
   · choices + flags decide which of the 6 endings you get.
   · everything is defensive: a corrupt entry can never break
     the game, and every write is debounced.
   ============================================================ */
(function (global) {
  'use strict';

  var PROFILE_KEY  = 'sanu_profile_v5';
  var RUN_KEY      = 'sanu_run_v5';
  var SETTINGS_KEY = 'sanu_settings_v5';
  var LEGACY = {
    profile: ['sanu_profile_v4', 'alice_profile_v3', 'alice_profile_v2'],
    run: ['sanu_run_v4', 'alice_run_v3'],
    settings: ['sanu_settings_v4', 'alice_settings_v3']
  };

  var TOTAL_CHAPTERS = 12;

  /* ---------------- difficulty ----------------
     Every mode must stay finishable: the heart pool grows as the
     enemies get harder, and ammo is a persistent inventory pool.  */
  var DIFFICULTIES = {
    easy: {
      key: 'easy', name: 'Asan', tag: 'Hekayə üçün',
      desc: '6 ürək, zəif və yavaş düşmənlər, bol güllə. Hekayəni rahat yaşa.',
      hearts: 6, dmgMul: 0.5, hpMul: 0.62, spdMul: 0.8, aggroMul: 0.72,
      ammoMul: 2.1, coinMul: 1.35, scoreMul: 0.8, medDropMul: 2.2,
      hazardDmg: 1, ammoStart: 34, medStart: 3, invulnBonus: 0.5,
      noiseMul: 0.8, chaseSpeed: 0.86
    },
    normal: {
      key: 'normal', name: 'Orta', tag: 'Tövsiyə olunur',
      desc: '5 ürək, balanslı düşmənlər, kifayət qədər güllə. Əsl atmosfer buradadır.',
      hearts: 5, dmgMul: 0.85, hpMul: 0.88, spdMul: 0.94, aggroMul: 0.9,
      ammoMul: 1.45, coinMul: 1, scoreMul: 1, medDropMul: 1.4,
      hazardDmg: 1, ammoStart: 28, medStart: 2, invulnBonus: 0.25,
      noiseMul: 1, chaseSpeed: 1
    },
    hard: {
      key: 'hard', name: 'Çətin', tag: 'Cəsarətli üçün',
      desc: '4 ürək, davamlı və sürətli düşmənlər, tikanlar 2 zərbə vurur.',
      hearts: 4, dmgMul: 1, hpMul: 1.15, spdMul: 1.08, aggroMul: 1.12,
      ammoMul: 1.05, coinMul: 0.95, scoreMul: 1.5, medDropMul: 0.9,
      hazardDmg: 2, ammoStart: 24, medStart: 1, invulnBonus: 0,
      noiseMul: 1.15, chaseSpeed: 1.08
    }
  };

  var SOFTER = { hard: 'normal', normal: 'easy', easy: null };

  /* ---------------- inventory ----------------
     kind: 'use'  -> consumed by the player with a hotkey
                           1 medkit · 2 lampa · 3 qəhvə · 4 qalxan · 5 alov
           'ammo' -> spent by shooting
           'gift' -> given to Sanu
           'perm' -> permanent unlock (shotgun)                  */
  var INV_KEYS = ['ammo', 'medkit', 'lantern', 'coffee', 'shield', 'flare', 'flower'];

  var ITEMS = [
    { id: 'ammo10',  name: 'Güllə qutusu',  sub: '+14 güllə',            icon: 'i_bullets', price: 22,  inv: 'ammo',    amount: 14 },
    { id: 'ammo30',  name: 'Patron yeşiyi', sub: '+40 güllə',            icon: 'i_bullets', price: 55,  inv: 'ammo',    amount: 40 },
    { id: 'medkit',  name: 'Tibb dəsti',    sub: 'İstifadə: 1 · +1 ürək', icon: 'i_medkit',  price: 40,  inv: 'medkit',  amount: 1 },
    { id: 'lantern', name: 'Neft lampası',  sub: 'İstifadə: 2 · işıq',   icon: 'i_potion',  price: 36,  inv: 'lantern', amount: 1 },
    { id: 'coffee',  name: 'Səhər qəhvəsi', sub: 'İstifadə: 3 · sürət',  icon: 'i_grenade', price: 30,  inv: 'coffee',  amount: 1 },
    { id: 'shield',  name: 'Kölgə qalxanı', sub: 'İstifadə: 4 · 1 zərbə',icon: 'i_scroll',  price: 70,  inv: 'shield',  amount: 1 },
    { id: 'flare',   name: 'Alov fişəngi',  sub: 'İstifadə: 5 · kor edir',icon: 'i_gem',     price: 45,  inv: 'flare',   amount: 1 },
    { id: 'flower',  name: 'Ağ çiçək',      sub: 'Sanu-ya hədiyyə',      icon: 'i_flower',  price: 50,  inv: 'flower',  amount: 1 },
    { id: 'shotgun', name: 'Ov tüfəngi',    sub: 'Daimi güclü silah',    icon: 'i_shotgun', price: 150, perm: 'hasShotgun' }
  ];

  /* ---------------- journal ----------------
     26 fragments. Unlocking is permanent across runs — this is
     also the key to the two hidden endings.                    */
  var JOURNAL = [
    { id: 'j_letter',  ch: 1,  icon: 'i_letter',       title: 'Islanmış vərəq',        text: 'Bulvar skamyasının üstündə bir vərəq. Yağış mürəkkəbi axıdıb, amma bir cümlə hələ oxunur: “Bəzən insan sevdiyi şeyləri itirməkdən qorxur.” Bu əl yazısı mənimkidir. Nə vaxt yazmışam?' },
    { id: 'j_phone1',  ch: 1,  icon: 'u_phone',        title: 'Naməlum nömrə · 03:14', text: 'Telefonda bir mesaj: “Sən hələ də məni axtarırsan?” Nömrə mövcud deyil. Mesajın vaxtı bu gecədir — 03:14.' },
    { id: 'j_bench',   ch: 1,  icon: 'i_scroll',       title: 'Skamyanın altı',        text: 'Skamyanın altında iki köhnəlmiş bilet: “314” və bir də onun cırılmış yarısı. Eyni gecə, eyni qatar. Biri mənimkidir — bəs digəri?' },
    { id: 'j_notice',  ch: 2,  icon: 'i_scroll',       title: 'Divardakı elan',        text: '“314-cü auditoriya təmirə görə bağlıdır. Heç kim girməsin.” Altında kiminsə əli ilə yazılıb: “O, hələ də orada gözləyir.” 314 rəqəmi yuxularımda da var.' },
    { id: 'j_ground',  ch: 2,  icon: 's_blood',        title: 'Həyətdəki kərpic',      text: 'Həyətin kərpic döşəməsində bir sıra daş qalxmışdı. Altında qazılmış kiçik çuxur: içində bir dənə saç sancağı və “N + S” hərfləri. Mən bu hərfləri heç vaxt yazmamışam. Ya yazmışam?' },
    { id: 'j_photo1',  ch: 3,  icon: 's_portrait',     title: 'Cızılmış şəkil',        text: '314-cü auditoriya. Cərgədə oturanlar arasında mən də varam. Yanımdakı qızın üzü qələmlə cızılıb — sanki kimsə onu silmək istəyib. Arxasında: “Məni xatırla. Məni bağışla.”' },
    { id: 'j_phone2',  ch: 3,  icon: 'u_phone',        title: 'İki mesaj',             text: '“314-cü auditoriyaya gəl.” / “Qorxma. Mən səni gözləyirəm.” Eyni nömrə. Eyni saat. Hər dəfə bir addım daha yaxın.' },
    { id: 'j_blood',   ch: 3,  icon: 's_letter_blood', title: 'Divar yazısı',          text: 'Divarda qanla: “SƏN HEÇ VAXT MƏNİ HƏQİQƏTƏN TANIMAMIŞSAN.” Dəhlizin sonunda bir qapı çırpıldı.' },
    { id: 'j_lamp',    ch: 3,  icon: 'i_potion',       title: 'Yanıb-sönən lampa',     text: 'Dəhlizin üçüncü lampası nəfəs alırmış kimi yanıb-sönür. Hər söndükdə qulağıma bir səs gəlir: “gecikdin”. Lampanın altında köhnə bir qan ləkəsi var.' },
    { id: 'j_board',   ch: 4,  icon: 'u_msgbox',       title: 'Lövhədəki təbaşir',     text: '“Sanu hələ də məni axtarırsan?” Bu yazı bugünkü deyil — tozun altından çıxır, illərlə buradadır. Və altında, daha kiçik hərflərlə: “Mən də səni.”' },
    { id: 'j_photo2',  ch: 4,  icon: 's_portrait',     title: 'Parta üstündəki şəkil', text: 'İki əl: biri dəftər tutur, digəri çiçək. Mən bu çiçəyi ona vermək istəmişdim. Amma heç vaxt vermədim. Həmişə “bir gün daha” gözlədim. Sonra heç bir gün qalmadı.' },
    { id: 'j_desk',    ch: 4,  icon: 'i_letter',       title: 'Partanın altı',         text: 'Partanın altına yapışdırılmış bir kağız: “Əgər bunu oxuyursansa, deməli mən artıq danışa bilmirəm. Amma sən məni yenə də eşidirsən, elə deyil? Bu otaq sənin yaddaşının bir parçasıdır. Divarı sındırmaq üçün qapını axtarma.”' },
    { id: 'j_hand',    ch: 5,  icon: 's_hand',         title: 'Divardakı əl izi',      text: 'Qanlı əl izi, barmaqlar aşağıya uzanır. Əl çox kiçikdir. Altında rəqəmlər: 03 · 14.' },
    { id: 'j_folder',  ch: 5,  icon: 'i_letter',       title: 'Arxiv qovluğu',         text: '“Tələbə Sanu M. — 314-cü qrup. Status: akademik məzuniyyət.” Tarix: bu gündən dörd il əvvəl. Heç kim mənə demədi. Mən niyə xatırlamıram?' },
    { id: 'j_truth',   ch: 5,  icon: 's_blood',        title: 'Qovluğun arxası',       text: 'İkinci səhifə, daha köhnə mürəkkəb: “Nuran Ə. — müraciət: psixoloji dəstək. Səbəb: travmatik itki, yaddaşın qoruyucu silinməsi.” Deməli... xatırlamamaq mənim qərarım deyildi. Bu, müdafiə idi.' },
    { id: 'j_receipt', ch: 5,  icon: 'u_msgbox',       title: 'Kassa qəbzi',           text: 'Qovluğun arasında bir qəbz: “03:14 · dəniz kənarı · iki bilet”. Qəbzin üstündə qələmlə: “Onu gözləmə. Qaç.” Mənim əl yazımdır. Amma mən heç vaxt qaçmadım.' },
    { id: 'j_mirror',  ch: 7,  icon: 's_portrait',     title: 'Güzgüdəki ikinci',      text: 'Güzgüdə mənim əksim mənə baxmırdı. O, bir az geridə qalmışdı — sanki mən hərəkət etdikcə o tərəddüd edirdi. Sonra gülümsədi. Mən gülümsəmirdim.' },
    { id: 'j_twin',    ch: 7,  icon: 'i_photo',        title: 'İki Nuran',             text: 'Dəhlizin sonunda bir də mən var idim. Amma onun gözləri yaşlı idi. “Sən buradan çıxanda,” dedi, “məni burada qoyacaqsan.” O, yalan demirdi.' },
    { id: 'j_room',    ch: 8,  icon: 'prop_bed',       title: 'Yataqxana otağı',       text: 'Divarda kiçik karandaş işarələri: dörd il, hər gecə bir cizgi. Saydım — min dörd yüz altmış. Bir nəfər bu otaqda hər gecə oyanıb eyni şeyi gözləyib.' },
    { id: 'j_sms',     ch: 8,  icon: 'u_phone',        title: 'Göndərilməmiş mesaj',   text: 'Telefonun qaralama qutusunda yazılmış, heç vaxt göndərilməmiş bir mesaj: “Sabah gələcəm. Söz verirəm.” Tarix: dörd il əvvəl, 03:14.' },
    { id: 'j_stairs',  ch: 9,  icon: 'prop_ladder',    title: 'Qara pilləkən',         text: 'Pilləkənin ortasında bir ayaqqabı. Tək. Sonra ikinci — üç pillə yuxarıda. Kimsə qaçarkən ayaqqabılarını itirib. Və heç vaxt geri qayıtmayıb.' },
    { id: 'j_roof',    ch: 9,  icon: 's_blood',        title: 'Damda',                 text: 'Damın kənarında iki əl izi — biri mənim, biri onun. Aralarında on beş santimetr. O qədər yaxın, o qədər uzaq.' },
    { id: 'j_clock',   ch: 10, icon: 'u_lock',         title: '03:14',                 text: 'Stansiyanın saatı həmişə 03:14-də dayanıb. Bilet satan adam dedi: “Bu qatar dörd ildir ki, hər gecə eyni vaxtda gəlir. Heç kim minmir. Bir nəfər də düşmür.”' },
    { id: 'j_ticket',  ch: 10, icon: 'i_scroll',       title: 'İki bilet',             text: 'Kassanın altında iki bilet tapdım. Birində adım yazılıb: “Nuran Ə.” Digərində — silinmiş, amma barmağımla toxunanda hərflər qalxdı: “Sanu M.”' },
    { id: 'j_veil',    ch: 11, icon: 'mon_veil',       title: 'Pərdə',                 text: 'Tunelin ortasında pərdə kimi bir şey asılıb. Onun arxasında insanlar dayanıb — hamısı arxası mənə. Onların arasında bir qız var, boynuma sarılanlar kimi. Toxunmaq istədim. Pərdə yırtıldı.' },
    { id: 'j_last',    ch: 12, icon: 'i_gem',          title: 'Son söz',               text: '“Sən məni xatırlamaq istəmədin, mən də səni unutdum. Amma unutmaq — bağışlamaq deyil. Sən hələ də nəfəs alırsan. Bu kifayətdir.”' }
  ];

  /* ---------------- endings ----------------
     Six endings. Which one you get is decided by the choices
     you actually made, plus how much of the truth you gathered. */
  var ENDINGS = {
    forgive: {
      id: 'forgive', title: 'Son — Bağışlanma', tone: 'kind', secret: false,
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
    },
    mild: {
      id: 'mild', title: 'Son — Gecikmiş çiçək', tone: 'kind', secret: false,
      body: [
        'Çiçək onun əlində qaldı. Sanu baxdı, baxdı — və gülümsədi.',
        'Amma gülüşün yarısı yarımçıq qaldı, çünki Nuran hələ də deməli olduğu şeyi deməmişdi.',
        '<em>“Sağ ol,”</em> dedi Sanu. <em>“Amma sən hələ də bilmirsən niyə gecikdin.”</em>',
        'O, yağışın içində əridi — bu dəfə geri qayıtmaq üçün deyil.',
        'Nuran sonra həmin gecəni bir neçə dəfə yuxuda gördü: bir qızın əlində çiçək, gözlərində isə cavabsız qalan sual.',
        'Bir dəfə də olsun arxivə qayıtmadı. Həqiqəti öyrənmədi.',
        'Bəzən yarımçıq bağışlanma, tam bir sükutdan yaxşıdır — amma yalnız bir az.',
        '<em>— Son —</em>'
      ]
    },
    silence: {
      id: 'silence', title: 'Son — Sükut', tone: 'cold', secret: false,
      body: [
        'Nuran heç nə demədi. Deməyə sözü də qalmamışdı.',
        'Sanu-nun sifəti yavaş-yavaş soldu — əvvəl gözləri, sonra gülüşü, sonra adı.',
        'Səhər açılanda BDU-nun həyətində yalnız bir nəfər qaldı: əlində köhnə bir şəkil, cibində isə oxunmamış bir məktub.',
        '<em>“Bəzən insan sevdiyi şeyləri itirməkdən qorxur. Mən isə onları heç vaxt əldə etməmişəm.”</em>',
        'Nuran o gündən sonra bir daha heç kimə “sənə kömək lazımdır?” demədi.',
        'Amma bəzən, gecə yarısı, telefonunu açıb o nömrəyə yenə baxırdı.',
        'Bir dəfə mesaj yazdı: “Buradayam.” Göndərmədi.',
        '<em>— Son —</em>'
      ]
    },
    truth: {
      id: 'truth', title: 'Son — Həqiqət', tone: 'cold', secret: false,
      body: [
        'Nuran hər şeyi bilirdi. Arxiv qovluğunu, kassa qəbzini, cırılmış bileti, göndərilməmiş mesajı.',
        'Bildiyi üçün də heç nə demədi. Çünki həqiqət artıq deyilmişdi — illər əvvəl, bir xəstəxana otağında, bir imza ilə.',
        'Sanu onun susduğunu gördü və başını tərpətdi. <em>“Deməli oxumusan.”</em>',
        '<em>“Oxumuşam,”</em> dedi Nuran. <em>“Və yenə də səni buraxıram.”</em>',
        'Bu dəfə ağlaya bilmədi. Ağlamaq üçün də yaddaş lazımdır.',
        'Dörd il əvvəl bir qız dəniz kənarında onu gözlədi. Bu gecə bir oğlan öz yaddaşını geri aldı — və ilk dəfə onunla vidalaşdı.',
        'Səhər BDU-nun arxivində bir qovluq tapıldı: “bağlanmış iş”. İçi boş idi.',
        '<em>— Son —</em>'
      ]
    },
    ash: {
      id: 'ash', title: 'Son — Kül', tone: 'bad', secret: false,
      body: [
        'Qovluq alov aldı. Kağız qıvrıldı, mürəkkəb qaraldı, sonra hər şey kül oldu.',
        'Nuran külü ayağı ilə dağıtdı. <em>“Xatırlamağa dəyməz,”</em> dedi.',
        'Amma kül yox olmur. O, ayaqqabının altına, paltarın qatlarına, nəfəsə qarışır.',
        'O gecədən sonra Nuran hər dəfə güzgüyə baxanda bir az daha az şey görürdü.',
        'Əvvəl çiçəyin adını unutdu. Sonra 314-ü. Sonra onun səsini.',
        'İndi telefonunda bir nömrə var, adı yoxdur. Ayda bir dəfə ona “kimsən?” yazır.',
        'Cavab gəlmir. Çünki cavab verən də, soruşan da — eyni adamdır.',
        '<em>— Son —</em>'
      ]
    },
    stay: {
      id: 'stay', title: 'Son — Qalmaq', tone: 'secret', secret: true,
      body: [
        'Nuran çiçəyi vermədi. Uzatmadı da. Sadəcə yerində qaldı.',
        '<em>“Mən getmirəm,”</em> dedi. <em>“Bu dəfə getmirəm.”</em>',
        'Sanu-nun gözlərində ilk dəfə qorxu yox, təəccüb var idi.',
        '<em>“Bilirsən ki, bu otaq sənin yaddaşındır. Burada qalsan — oyanmayacaqsan.”</em>',
        '<em>“Bilirəm.”</em>',
        'Yağış dayandı. Fənərlər bir-bir yandı. Bulvar bir daha boş deyildi.',
        'Səhər BDU-nun həyətində bir dərs qaldı. Müəllim adları oxudu: “Nuran Əliyev.” Cavab gəlmədi.',
        'İkinci dəfə oxudu: “Sanu Məmmədova.” Cavab gəlmədi.',
        'Amma həmin axşam həyətin kərpic döşəməsində iki yeni əl izi tapıldı — yan-yana.',
        'Və dörd il əvvəl yazılmış bir məktub nəhayət oxundu: <em>“Bir gün qalmağı seçəcəyəm.”</em>',
        '<em>— Gizli son —</em>'
      ]
    }
  };

  /* ---------------- helpers ---------------- */
  function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
  function int(v, d) { return Math.max(0, Math.floor(num(v, d))); }

  function readKey(list) {
    for (var i = 0; i < list.length; i++) {
      try {
        var raw = localStorage.getItem(list[i]);
        if (raw) return raw;
      } catch (e) { }
    }
    return null;
  }

  function freshInv() {
    var o = {};
    for (var i = 0; i < INV_KEYS.length; i++) o[INV_KEYS[i]] = 0;
    return o;
  }

  var Store = {
    DIFFICULTIES: DIFFICULTIES,
    SOFTER: SOFTER,
    SHOP: ITEMS,
    ITEMS: ITEMS,
    JOURNAL: JOURNAL,
    ENDINGS: ENDINGS,
    TOTAL_CHAPTERS: TOTAL_CHAPTERS,
    INV_KEYS: INV_KEYS,
    profile: null,
    _dirty: false,
    _saveTO: 0,

    /* ---------- profile ---------- */
    load: function () {
      var p = null;
      try { p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); } catch (e) { p = null; }
      if (!p) {
        var legacy = readKey(LEGACY.profile);
        if (legacy) { try { p = JSON.parse(legacy); } catch (e) { p = null; } }
      }
      if (!p || typeof p !== 'object') p = {};

      var journal = {};
      if (p.journal && typeof p.journal === 'object') {
        for (var k in p.journal) if (p.journal[k]) journal[k] = 1;
      }
      var choices = {};
      if (p.choices && typeof p.choices === 'object') {
        for (var c in p.choices) if (typeof p.choices[c] === 'string') choices[c] = p.choices[c];
      }
      var seen = {};
      if (p.endingsSeen && typeof p.endingsSeen === 'object') {
        for (var e in p.endingsSeen) if (p.endingsSeen[e]) seen[e] = 1;
      }

      var inv = freshInv();
      var srcInv = (p.inv && typeof p.inv === 'object') ? p.inv : p;
      for (var i = 0; i < INV_KEYS.length; i++) {
        var key = INV_KEYS[i];
        var legacyKey = key === 'medkit' ? 'medkits'
          : key === 'lantern' ? 'lanterns'
          : key === 'coffee' ? 'coffees'
          : key === 'shield' ? 'shields'
          : key === 'flower' ? 'flowers' : key;
        inv[key] = int(srcInv[key] !== undefined ? srcInv[key] : srcInv[legacyKey], 0);
      }

      var prof = {
        difficulty: DIFFICULTIES[p.difficulty] ? p.difficulty : 'normal',
        wallet: int(p.wallet, 0),
        unlocked: Math.max(1, Math.min(TOTAL_CHAPTERS, Math.floor(num(p.unlocked, 1)))),
        chapters: (p.chapters && typeof p.chapters === 'object') ? p.chapters : {},
        inv: inv,
        gifts: int(p.gifts, 0),
        hasShotgun: !!p.hasShotgun,
        bestScore: int(p.bestScore, 0),
        deaths: int(p.deaths, 0),
        endings: int(p.endings, 0),
        seenIntro: !!p.seenIntro,
        beaten: !!p.beaten,
        journal: journal,
        choices: choices,
        endingsSeen: seen,
        playTime: num(p.playTime, 0)
      };
      for (var id in prof.chapters) {
        var c = prof.chapters[id];
        if (!c || typeof c !== 'object') { delete prof.chapters[id]; continue; }
        c.done = !!c.done;
        c.best = int(c.best, 0);
        c.runs = int(c.runs, 0);
      }
      this.profile = prof;
      return prof;
    },

    /** debounced write — the render loop can call this freely */
    save: function (immediate) {
      if (!this.profile) return;
      this._dirty = true;
      if (immediate) { this.flush(); return; }
      if (this._saveTO) return;
      var self = this;
      this._saveTO = setTimeout(function () {
        self._saveTO = 0;
        self.flush();
      }, 420);
    },

    flush: function () {
      if (!this.profile || !this._dirty) return;
      this._dirty = false;
      try { localStorage.setItem(PROFILE_KEY, JSON.stringify(this.profile)); } catch (e) { }
    },

    reset: function () {
      try {
        localStorage.removeItem(PROFILE_KEY);
        localStorage.removeItem(RUN_KEY);
        LEGACY.profile.concat(LEGACY.run).forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { }
      this.profile = null;
      return this.load();
    },

    /* ---------- difficulty ---------- */
    diff: function () {
      var p = this.profile || this.load();
      return DIFFICULTIES[p.difficulty] || DIFFICULTIES.normal;
    },

    setDifficulty: function (key) {
      var p = this.profile || this.load();
      if (DIFFICULTIES[key]) p.difficulty = key;
      this.save();
      return DIFFICULTIES[p.difficulty];
    },

    softerThan: function (key) { return SOFTER[key] || null; },

    /* ---------- wallet ---------- */
    wallet: function () { return (this.profile || this.load()).wallet; },

    addCoins: function (n) {
      var p = this.profile || this.load();
      p.wallet = Math.max(0, p.wallet + Math.round(n));
      this.save();
      return p.wallet;
    },

    spend: function (n) {
      var p = this.profile || this.load();
      if (p.wallet < n) return false;
      p.wallet -= n;
      this.save();
      return true;
    },

    /* ---------- inventory (persistent — the fix) ---------- */
    inv: function () { return (this.profile || this.load()).inv; },

    addItem: function (key, amount) {
      var p = this.profile || this.load();
      if (p.inv[key] === undefined) return 0;
      p.inv[key] = Math.max(0, p.inv[key] + (amount === undefined ? 1 : Math.round(amount)));
      this.save();
      return p.inv[key];
    },

    countItem: function (key) {
      var p = this.profile || this.load();
      return p.inv[key] || 0;
    },

    /** consume one unit; returns true when something was consumed */
    useItem: function (key) {
      var p = this.profile || this.load();
      if (!p.inv[key] || p.inv[key] <= 0) return false;
      p.inv[key] -= 1;
      this.save();
      return true;
    },

    /* ---------- chapters ---------- */
    isUnlocked: function (index) {
      var p = this.profile || this.load();
      return (index + 1) <= p.unlocked;
    },

    unlockThrough: function (index) {
      var p = this.profile || this.load();
      var target = Math.min(TOTAL_CHAPTERS, index + 1);
      if (target > p.unlocked) { p.unlocked = target; this.save(); }
      return p.unlocked;
    },

    markChapter: function (id, score) {
      var p = this.profile || this.load();
      var c = p.chapters[id] || { done: false, best: 0, runs: 0 };
      c.done = true;
      c.runs = (c.runs || 0) + 1;
      c.best = Math.max(num(c.best, 0), Math.round(num(score, 0)));
      p.chapters[id] = c;
      if (score > p.bestScore) p.bestScore = Math.round(score);
      this.save();
      return c;
    },

    chapterDone: function (id) {
      var p = this.profile || this.load();
      return !!(p.chapters[id] && p.chapters[id].done);
    },

    chapterBest: function (id) {
      var p = this.profile || this.load();
      return p.chapters[id] ? p.chapters[id].best : 0;
    },

    /* ---------- purchases ---------- */
    buy: function (itemId) {
      var item = null;
      for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === itemId) item = ITEMS[i];
      if (!item) return { ok: false, reason: 'missing' };
      var p = this.profile || this.load();
      if (item.perm && p[item.perm]) return { ok: false, reason: 'owned' };
      if (item.id === 'shotgun' && !p.hasShotgun && p.wallet < item.price) {
        return { ok: false, reason: 'poor' };
      }
      if (p.wallet < item.price) return { ok: false, reason: 'poor' };
      p.wallet -= item.price;
      if (item.perm) {
        p[item.perm] = true;
        p.inv.ammo += 24;
      } else if (item.inv) {
        p.inv[item.inv] = (p.inv[item.inv] || 0) + (item.amount || 1);
      }
      this.save();
      return { ok: true, item: item, wallet: p.wallet, inv: p.inv };
    },

    /* ---------- choices / flags ---------- */
    choose: function (id, value) {
      var p = this.profile || this.load();
      if (!id) return;
      p.choices[id] = String(value);
      this.save();
      return p.choices[id];
    },

    choice: function (id) {
      var p = this.profile || this.load();
      return p.choices[id] || null;
    },

    hasChoice: function (id, value) {
      var p = this.profile || this.load();
      return p.choices[id] === String(value);
    },

    /* ---------- endings ---------- */
    endingFor: function () {
      var p = this.profile || this.load();
      var c = p.choices;
      var found = 0;
      for (var k in p.journal) if (p.journal[k]) found++;

      if (c.folder === 'burn') return ENDINGS.ash;
      if (c.final === 'stay') return ENDINGS.stay;
      if (c.folder === 'read' && c.photo === 'tear' && c.final !== 'flower') return ENDINGS.truth;
      if (c.final === 'flower') {
        if (c.folder === 'read' && c.apology === 'speak' && found >= 16) return ENDINGS.forgive;
        return ENDINGS.mild;
      }
      return ENDINGS.silence;
    },

    recordEnding: function (ending) {
      var p = this.profile || this.load();
      if (!ending) return;
      p.endingsSeen[ending.id] = 1;
      p.endings++;
      p.beaten = true;
      this.save(true);
    },

    endingsFound: function () {
      var p = this.profile || this.load();
      var n = 0;
      for (var k in p.endingsSeen) if (p.endingsSeen[k]) n++;
      return n;
    },

    /* ---------- journal ---------- */
    addJournal: function (id) {
      var p = this.profile || this.load();
      if (!id || p.journal[id]) return false;
      p.journal[id] = 1;
      this.save();
      return true;
    },

    journal: function () {
      var p = this.profile || this.load();
      var found = [];
      for (var i = 0; i < JOURNAL.length; i++) {
        if (p.journal[JOURNAL[i].id]) found.push(JOURNAL[i]);
      }
      return found;
    },

    journalCount: function () {
      var p = this.profile || this.load();
      var n = 0;
      for (var k in p.journal) if (p.journal[k]) n++;
      return n;
    },

    /* ---------- run snapshot ---------- */
    saveRun: function (run) {
      try { localStorage.setItem(RUN_KEY, JSON.stringify(run)); } catch (e) { }
    },

    loadRun: function () {
      var r = null;
      try { r = JSON.parse(localStorage.getItem(RUN_KEY) || 'null'); } catch (e) { r = null; }
      if (!r) {
        var legacy = readKey(LEGACY.run);
        if (legacy) { try { r = JSON.parse(legacy); } catch (e) { r = null; } }
      }
      if (!r || typeof r !== 'object' || typeof r.level !== 'number') return null;
      if (r.level < 0 || r.level >= TOTAL_CHAPTERS) return null;
      return r;
    },

    clearRun: function () {
      try {
        localStorage.removeItem(RUN_KEY);
        LEGACY.run.forEach(function (k) { localStorage.removeItem(k); });
      } catch (e) { }
    },

    hasRun: function () { return !!this.loadRun(); },

    /* ---------- settings ---------- */
    loadSettings: function () {
      var s = null;
      try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); } catch (e) { }
      if (!s) {
        var legacy = readKey(LEGACY.settings);
        if (legacy) { try { s = JSON.parse(legacy); } catch (e) { s = null; } }
      }
      if (!s || typeof s !== 'object') s = {};
      return {
        master: Math.max(0, Math.min(1, num(s.master, 0.7))),
        music: Math.max(0, Math.min(1, num(s.music, 0.55))),
        shake: s.shake !== false,
        crt: s.crt !== false,
        lowFx: !!s.lowFx,
        autoFx: s.autoFx !== false,
        hints: s.hints !== false
      };
    },

    saveSettings: function (s) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { }
    }
  };

  /* flush pending writes before the tab goes away */
  if (global.addEventListener) {
    global.addEventListener('pagehide', function () { Store.flush(); });
    global.addEventListener('visibilitychange', function () {
      if (global.document && global.document.hidden) Store.flush();
    });
  }

  global.Store = Store;
})(window);
