# Sən hələ də məni axtarırsan? — Alice

Atmosferik 2D psixoloji qorxu platforması. Tam **statik sayt** (HTML + CSS + vanilla JS) —
heç bir server, framework, build addımı və ya xarici asılılıq yoxdur.

## Hekayə

> Axşam idi. Yağış yavaş-yavaş yağırdı. Leo adlı gənc oğlan evə qayıdarkən yolun kənarında
> tək dayanan bir qız gördü. Qızın adı Alice idi...

Leo Alice-i axtarmağa çıxır. Beş bölmə boyunca küçələrdən, meşədən, köhnə evdən və zirzəmidən
keçərək həqiqəti tapmağa çalışır. Son: *"Sən heç vaxt məni həqiqətən tanımamısan."*

## Bölmələr

| # | Ad | Xüsusiyyət |
|---|-----|-----------|
| I | Yağışlı küçə | Tək Alice ilə tanışlıq, ilk məktub |
| II | Meşə yolu | Düşmənlər, açar tapmacası, qıfıllı qapı |
| III | Köhnə ev | Şəkil + qanla yazı, hekayə açılır |
| IV | Zirzəmi | Qaranlıq (işıq dairəsi), 2 açar, ov tüfəngi |
| V | Son | Boss (bride) + final dialoq + son ekranı |

## İşləyən mexanikalar

- **Hərəkət**: A/D və ya ←/→, **Shift** qaçış, **Space** tullanma (coyote-time + jump buffer),
  **S** əyilmə, bir tərəfli platformalardan yuxarı keçmək
- **Döyüş**: **J** və ya sol klik atəş, güllə/patron idarəsi, düşmən HP, geri itələmə (knockback)
- **Düşmənlər**: 4 növ — `skull` (gəzən kəllə), `crawler` (sürünən), `shadow` (uçan kölgə),
  `bride` (boss). Aggro məsafəsi, patrul, yerdən düşməmək AI-ı, qaçma/izləmə
- **Zərər**: ürəklər (3 HP), toxunma zərəri, tikanlar, boşluğa düşmə, toxunulmazlıq müddəti
- **Əşyalar**: sikkə, patron, tibb qutusu, açar, ov tüfəngi, foto, qeyd/məktub
- **Qapılar**: açar tələb edən çıxışlar (`needsKey`, `needsKeys`)
- **Dialoq sistemi**: typewriter effekti, portretlər, E/Space ilə davam
- **Checkpoint**: avtomatik yadda saxlama (`localStorage`), "Davam et" düyməsi
- **Atmosfer**: parallaks fon, yağış (yüngül/güclü), şimşək, qaranlıq/fənər işığı,
  VHS glitch, ekran silkələnməsi, vinyet, aşağı HP-də qırmızı pulsasiya
- **Audio**: tamamilə Web Audio ilə sintez olunur (yağış, grom, addım, atəş, growl, drone musiqi) —
  heç bir audio fayl yoxdur
- **Nəzarət**: klaviatura + siçan + mobil toxunma düymələri, pauza/tənzimləmələr menyusu

## Fayl strukturu

```
webapp/
├── index.html          # bütün ekranlar (title, HUD, dialoq, menyular)
├── css/style.css       # üslub
├── js/
│   ├── assets.js       # sprite manifest + yükləyici (83 PNG)
│   ├── audio.js        # Web Audio sintezatoru
│   ├── input.js        # klaviatura/siçan/touch → vahid action state
│   ├── levels.js       # 5 bölmə: platformalar, düşmənlər, əşyalar, dialoqlar
│   ├── entities.js     # Player, Enemy, Item, Npc, Bullet + fizika
│   ├── game.js         # mühərrik: kamera, işıq, dialoq, hissəciklər, axın
│   └── main.js         # bootstrap + RAF dövrəsi
└── assets/             # 83 PNG (təqdim edilən asset vərəqindən çıxarıldı)
```

## Assetlər

Bütün sprite-lər və fonlar təqdim etdiyin **1024×576 asset vərəqindən** proqram yolu ilə
çıxarıldı: fon səhnələri (5), Leo (6 kadr + əyilmiş + arxa), Alice (3 + ghost),
canavarlar (6), əşyalar (14), mebel/prop (20), hekayə obyektləri (4), UI ikonları (10),
brick teksturası. Fon rəngi (tünd `#07070a`) border-connected flood-fill + feathering ilə
şəffaf edildi, hər sprite sərhədlərinə görə kəsildi.

## Necə işə salmaq

Statik saytdır — istənilən statik hostinqdə işləyir:

```bash
# lokal
python3 -m http.server 3000
# → http://localhost:3000
```

GitHub Pages / Cloudflare Pages / Netlify: kök qovluğu olduğu kimi yayımla, build lazım deyil.

## Validasiya

Bölmə həndəsəsi real fizika parametrləri ilə BFS ilə yoxlanıldı
(tullanma hündürlüyü 138px, qaçışda üfüqi məsafə ~188px):

```
ch1: surfaces=18 reachable=18
ch2: surfaces=19 reachable=19
ch3: surfaces=17 reachable=17
ch4: surfaces=22 reachable=22
ch5: surfaces=13 reachable=13
*** LEVELS PLAYABLE ***
```

Bütün platformalar, əşyalar, düşmənlər və NPC-lər çatıla biləndir; boşluqlar ≤140px,
tikanlar ≤72px (tullanaraq keçilir).

## Texniki qeydlər

- Oyun dünyası koordinatları: `y` ayaq səviyyəsi, yer səthi `y = 470`
- Canvas 1024×576, CSS ilə `min(100vw, 100vh*16/9)` miqyaslanır
- Bütün kod ES5-uyğun (köhnə brauzerlər üçün), `'use strict'`
- `localStorage` açarları: `alice_save`, `alice_settings`
