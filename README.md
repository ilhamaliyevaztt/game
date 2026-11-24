# Sən hələ də məni axtarırsan? — Alice · BDU

Yağışlı Bakıda, BDU-nun dəhlizlərində Leo Alice-i axtarır. Atmosferik 2D psixoloji qorxu
platforması. Tam **statik sayt** (HTML + CSS + vanilla JS) — server, framework və build
addımı yoxdur. **PWA** kimi telefona quraşdırıla bilər və oflayn oynanır.

## Hekayə

> Axşam idi. Yağış yavaş-yavaş yağırdı. Leo adlı gənc oğlan evə qayıdarkən bulvarda tək
> dayanan bir qız gördü. Qızın adı Alice idi...

Leo BDU-nun bulvarından, həyətindən, dəhlizlərindən və **314-cü auditoriyadan** keçərək
axtarır. Arxiv zirzəmisində tapılan qovluq hər şeyi dəyişir: *"Tələbə Alice M. — akademik
məzuniyyət. Tarix: dörd il əvvəl."* Leo niyə xatırlamır? Son iki bölmə bunun cavabıdır.

**İki fərqli son var** — Alice-ə ağ çiçək verib-verməməyindən asılıdır.

## Bölmələr (7)

| # | Ad | Xüsusiyyət |
|---|-----|-----------|
| I | Yağışlı Bakı | Tanışlıq, ilk məktub, telefon mesajı |
| II | BDU həyəti | Düşmənlər, açar, 314-cü auditoriya elanı |
| III | Universitet dəhlizi | 2 açar, şəkil, qan divar yazısı |
| IV | Auditoriya 314 | Alice ilə görüş, çiçək vermə fürsəti |
| V | Arxiv zirzəmisi | Qaranlıq, 2 açar, ov tüfəngi, **həqiqət qovluğu** |
| VI | Kölgə Alice | Boss döyüşü (alice_corrupt) |
| VII | Oyanış | Final boss (göz), son dialoq, iki son |

## Çətinlik rejimləri

| Rejim | Ürək | Düşmən HP | Sürət | Güllə | Xal |
|-------|------|-----------|-------|-------|-----|
| Asan | 5 | ×0.7 | ×0.86 | ×1.6 | ×0.8 |
| Orta | 4 | ×1.0 | ×1.0 | ×1.0 | ×1.0 |
| Çətin | 3 | ×1.45 | ×1.16 | ×0.62 | ×1.5 |

Çətin rejimdə mühit daha qaranlıqdır və tikanlar 2 zərbə vurur.

## İşləyən mexanikalar

- **Hərəkət**: A/D, **Shift** qaçış, **Space** tullanma (coyote-time + jump buffer),
  **S** əyilmə, bir tərəfli ledge-lərdən yuxarı keçmək
- **Döyüş**: **J** / sol klik, tüfəng (2 güllə), düşmən HP, knockback, boss mərmiləri
- **12 düşmən növü**: skull, skullB, crawler, crouch, hound, stalker, horn, lurk,
  shadow, veil, alicecorrupt (boss), eye2 (final boss, atəş açır)
- **Ümumi pul kisəsi**: sikkələr `localStorage`-da saxlanılır, bütün bölmələrdə keçərli
- **Mağaza**: güllə, tibb dəsti, **ağ çiçək**, neft lampası, qəhvə, qalxan, ov tüfəngi
- **Çiçək hədiyyəsi**: Alice-in yanında **E** basaraq ver → son dəyişir
- **Yoxlama nöqtələri**: hər bölmədə 3–5 anchor. Öldükdə *keçdiyin yerdən* davam edirsən;
  yığdığın pul və öldürdüyün düşmənlər saxlanılır. "Başdan başlat" — bölmənin qəniməti
  sıfırlanır və pul geri qaytarılır
- **Bölmə seçimi**: açılmış bölmədən başlaya bilərsən
- **Dialoq**: typewriter, portretlər, çiçək vermə səhnəsi
- **Atmosfer**: parallaks fon, yağış, şimşək, qaranlıq/fənər, VHS glitch, silkələnmə, vinyet

## Mobil

- Toxunma idarəsi: ◀ ▶ / əyil ▾ / E / atəş ✦ / tullan ▲
- `viewport-fit=cover` + `safe-area-inset` (notch dəstəyi)
- Kiçik ekran üçün ayrı CSS (panellər, mağaza, bölmə siyahısı)
- **Quraşdırıla bilən PWA**: `manifest.webmanifest` + `sw.js` + 192/512 ikonlar.
  "Tətbiqi quraşdır" düyməsi → ekranda ikon kimi açılır, tam ekran, oflayn.
  (iOS Safari: Paylaş → Ekrana əlavə et)

## Performans

- **Fixed-step fizika** (1/60 accumulator) — kadr düşməsində donma yoxdur
- **Keşlənmiş qradientlər və brick pattern** — kadr başına allocation yoxdur
- **Culling** — kamera xaricindəki prop/düşmən/əşya çəkilmir, uzaq düşmən AI-ı dayanır
- **Particle cap** (240) + floating text cap
- **Glitch** `getImageData`-sız (canvas slice blit) — mobil Chrome-da donmur
- **"Yüksək effektlər"** söndürüləndə partikül/flash azalır (zəif cihazlar)

## Fayl strukturu

```
webapp/
├── index.html            # bütün ekranlar
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # service worker (oflayn keş)
├── css/style.css
├── js/
│   ├── store.js          # profil, çətinlik, pul kisəsi, mağaza, run snapshot
│   ├── assets.js         # 115 sprite manifest + blitH (hədəf hündürlüyə miqyas)
│   ├── audio.js          # Web Audio sintezatoru
│   ├── input.js          # klaviatura/siçan/touch → vahid state
│   ├── levels.js         # 7 bölmə + 2 son
│   ├── entities.js       # Player, Enemy(12 növ), Item, Npc, Bullet
│   ├── game.js           # mühərrik
│   └── main.js           # bootstrap, RAF, PWA qeydiyyatı
├── ecosystem.config.cjs  # PM2 (lokal statik server)
└── assets/               # 115 PNG
```

## Assetlər

Bütün sprite-lər təqdim edilən **1024×576 asset vərəqindən** proqram yolu ilə çıxarıldı:
BDU fonları (Bakı bulvarı, BDU baş binası, kampus, auditoriya), BDU geyimli Leo (4 kadr +
atəş) və Alice (4 kadr + korrupsiya), 7 yeni canavar, telefon/mesaj qutusu/portal/pentagram,
portretlər. Fon rəngi flood-fill + connected-component filtri ilə şəffaf edildi.

## Lokal işə salma

```bash
cd /home/user/webapp
pm2 start ecosystem.config.cjs     # python3 -m http.server 3000
# → http://localhost:3000
```

Debug: `?play=1&diff=hard&ch=4` → birbaşa bölməyə atlayır.

## Validasiya

```
OK  ch1 surf=18 unreach=0 exit=true badItems=0
OK  ch2 surf=19 unreach=0 exit=true badItems=0
OK  ch3 surf=18 unreach=0 exit=true badItems=0
OK  ch4 surf=18 unreach=0 exit=true badItems=0
OK  ch5 surf=22 unreach=0 exit=true badItems=0
OK  ch6 surf=18 unreach=0 exit=true badItems=0
OK  ch7 surf=13 unreach=0 exit=true badItems=0
*** ALL LEVELS PLAYABLE ***
```

Bütün platformalar BFS ilə real fizika parametrləri (tullanma 138px, qaçış reach 188px)
ilə yoxlanıldı — hamısı çatılandır, çıxışlar əlçatandır.

## Texniki qeydlər

- Oyun dünyası: `y` ayaq səviyyəsi, yer səthi `y = 470`
- Canvas 1024×576, CSS ilə `min(100vw, 100vh*16/9)` miqyaslanır
- `localStorage` açarları: `alice_profile_v3`, `alice_run_v3`, `alice_settings_v3`
- GitHub: https://github.com/ilhamaliyevaztt/game
