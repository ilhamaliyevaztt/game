# Sən hələ də məni axtarırsan? — Sanu · BDU

Yağışlı Bakıda, BDU-nun dəhlizlərində **Nuran**, **Sanu**-nu axtarır. Atmosferik 2D
psixoloji qorxu platforması. Tam **statik sayt** (HTML + CSS + vanilla JS) — server,
framework və build addımı yoxdur. **PWA** kimi telefona quraşdırıla bilər və oflayn oynanır.

## Hekayə

> Axşam idi. Yağış yavaş-yavaş yağırdı. Nuran adlı gənc oğlan evə qayıdarkən bulvarda tək
> dayanan bir qız gördü. Qızın adı Sanu idi. Amma Nuran onu ilk dəfə görürdü...

Sanu deyir: *"Sabah universitetə gəl."* Səhər BDU-nun həyətində qız yoxdur — yalnız qapının
üstündə bir rəqəm: **314**.

Nuran BDU-nun bulvarından, həyətindən, dəhlizlərindən və **314-cü auditoriyadan** keçərək
axtarır. Arxiv zirzəmisində tapılan qovluq hər şeyi dəyişir:

> *"Tələbə Sanu M. — akademik məzuniyyət. Tarix: dörd il əvvəl."*
> *"Nuran Ə. — travmatik itki. Yaddaşın qoruyucu silinməsi aparılıb."*

Nuran niyə xatırlamır? Son iki bölmə bunun cavabıdır.

**İki fərqli son var** — Sanu-ya ağ çiçək verib-verməməyindən asılıdır.
**12 qeydlik jurnal** bütün hekayə parçalarını sonradan oxumağa imkan verir.

## Bölmələr (7)

| # | Ad | Xüsusiyyət |
|---|-----|-----------|
| I | Yağışlı Bakı | Tanışlıq, ilk məktub, 03:14 telefonu — düşmən yoxdur (öyrədici) |
| II | BDU həyəti | İlk düşmənlər, açar, 314-cü auditoriya elanı |
| III | Universitet dəhlizi | 2 açar, cızılmış şəkil, qan divar yazısı |
| IV | Auditoriya 314 | Sanu ilə görüş, çiçək vermə fürsəti |
| V | Arxiv zirzəmisi | Qaranlıq, 2 açar, ov tüfəngi, **həqiqət qovluğu** |
| VI | Kölgə Sanu | Boss döyüşü (sanu_corrupt) |
| VII | Oyanış | Final boss (göz), son dialoq, iki son |

## Çətinlik rejimləri (yenidən balanslandı)

| Rejim | Ürək | Düşmən HP | Sürət | Güllə | Başlanğıc güllə | Tikan | Xal |
|-------|------|-----------|-------|-------|-----------------|-------|-----|
| Asan | 6 | ×0.62 | ×0.80 | ×2.1 | 30 | 1 | ×0.8 |
| Orta | 5 | ×0.88 | ×0.94 | ×1.45 | 24 | 1 | ×1.0 |
| Çətin | 4 | ×1.15 | ×1.08 | ×1.05 | 20 | 2 | ×1.5 |

Hər rejim **tam keçilə biləndir**. Əvvəlki versiyada çətin rejim keçilməz idi (3 ürək,
×1.45 HP, ×0.62 güllə) — indi fərq hiss olunur, amma bölmə atlamaq mümkündür.

**Avtomatik kömək:** bir bölmədə 3 dəfə ölsən, ölüm ekranı "Çətinliyi azalt" düyməsi göstərir
(Çətin → Orta → Asan). Heç vaxt softlock olmur.

## İşləyən mexanikalar

- **Hərəkət**: A/D, **Shift** qaçış, **Space** tullanma (coyote-time + jump buffer),
  **S** əyilmə (tavanı yoxlayır), bir tərəfli ledge-lərdən yuxarı keçmək
- **Döyüş**: **J** / sol klik, tüfəng (2 güllə), düşmən HP, knockback, boss mərmiləri.
  **Güllə bitəndə yumruq zərbəsi** avtomatik işləyir — boss döyüşündə softlock yoxdur
- **12 düşmən növü**: skull, skullB, crawler, crouch, hound, stalker, horn, lurk,
  shadow, veil, sanu_corrupt (boss), eye2 (final boss, atəş açır)
- **Ümumi pul kisəsi**: sikkələr `localStorage`-da saxlanılır, bütün bölmələrdə keçərli
- **Mağaza**: güllə (2 növ), tibb dəsti, **ağ çiçək**, neft lampası, qəhvə, qalxan, ov tüfəngi
- **Jurnal**: 12 qeyd — məktub, telefon mesajları, şəkillər, qovluq, son söz
- **Çiçək hədiyyəsi**: Sanu-nun yanında **E** basaraq ver → son dəyişir
- **Yoxlama nöqtələri**: hər bölmədə 3–5 anchor. Öldükdə *keçdiyin yerdən* davam edirsən
- **Bölmə seçimi**: açılmış bölmədən başlaya bilərsən
- **Prolog**: ilk oyunda 6 səhnəlik giriş (bir dəfə göstərilir)
- **Dialoq**: typewriter, portretlər, çiçək vermə səhnəsi
- **Atmosfer**: parallaks fon, yağış, şimşək, qaranlık/fənər, VHS glitch, silkələnmə, vinyot

## Düzəldilən buglar (v4)

| Bug | Düzəliş |
|-----|---------|
| Tikanlar yerin **ortasında**, boşluqda asılı | Hamısı bərk yerə oturduldu, hər iki tərəfdə ≥70px eniş/eniş sahəsi |
| Pəncərələr havada (`G-130`), auditoriyada çarpayı, küçə lampası dəhlizdə/zirzəmidə | Yalnız kontekstə uyğun prop-lar (kitab şkafı, çəllək, skamya) |
| Pilləkən klasteri boşluğun üstündə (əlçatmaz) | Hər bölmədə **tək davamlı zəmin** — dibsiz çuxur yoxdur |
| `prof.ammo` hər bölmədə sıfırlanmırdı → sonsuz güllə | `Store.takeConsumables()` — birdəfəlik verilir |
| `shop-back` / `howto-back` yanlış ekrana qayıdırdı | `from` state-i düzgün izlənir |
| Dialoq açılanda fixed-step döngüsü davam edirdi → ikiqat trigger | Hər addımdan sonra `state !== 'play'` yoxlanır |
| `advanceLevel` ikiqat çağırılırdı (transition) | `_advancing` guard |
| Boss döyüşündə güllə bitsə → softlock | Melee fallback + boss öləndə resupply düşür |
| `ctx.filter` hər kadrda (çox yavaş) | Silindi, `globalAlpha` ilə əvəzləndi |
| Hər düşmən/əşya üçün yeni radial gradient | `Assets.blitGlow()` — keşlənmiş sprite |
| `saveRun` hər kadrda `localStorage`-a yazırdı | 0.6s debounce |
| Köhnə `alice_*` save-ləri itirdi | v3 → v4 miqrasiya + təmizləmə |
| Jurnal olmadığı üçün hekayə itirdi | 12 qeydlik jurnal (fasilə menyusundan) |

## Performans

- **Fixed-step fizika** (1/60 accumulator), state dəyişəndə dərhal çıxır
- **Keşlənmiş qradientlər, brick pattern və glow sprite-lər** — kadrda allocation yoxdur
- **Culling** — kamera xaricindəki prop/düşmən/əşya çəkilmir, uzaq düşmən AI-ı dayanır
- **Solid clip** — platformalar yalnız görünən hissədə `fillRect` alır
- **Particle cap** (220) + floating text cap (24) + toast cap (4)
- **Glitch** `getImageData`-sız (canvas slice blit) — mobil Chrome-da donmur
- **Avtomatik keyfiyyət**: 90 kadr >34ms olarsa "yüksək effektlər" avtomatik sönür
- **Asset sayı 115 → 72** — istifadə olunmayan sprite-lər manifestdən çıxarıldı
- **`prefers-reduced-motion`** dəstəyi

## Fayl strukturu

```
webapp/
├── index.html            # bütün ekranlar (proloq, jurnal, mağaza, ...)
├── manifest.webmanifest  # PWA manifest
├── sw.js                 # service worker (oflayn keş)
├── css/style.css         # dizayn tokenları + responsive
├── js/
│   ├── store.js          # profil, çətinlik, pul kisəsi, mağaza, jurnal, run snapshot
│   ├── assets.js         # 72 sprite manifest + blitH + keşlənmiş glow
│   ├── audio.js          # Web Audio sintezatoru
│   ├── input.js          # klaviatura/siçan/touch → vahid state
│   ├── levels.js         # 7 bölmə + 2 son
│   ├── entities.js       # Player(Nuran), Enemy(12), Item, Npc(Sanu), Bullet
│   ├── game.js           # mühərrik
│   └── main.js           # bootstrap, RAF, PWA, avtomatik keyfiyyət
├── tools/
│   └── validate-levels.js # həndəsə validasiyası (node, asılılıq yoxdur)
├── ecosystem.config.cjs  # PM2 (lokal statik server)
└── assets/               # 115 PNG (72-si istifadə olunur)
```

## Lokal işə salma

```bash
cd /home/user/webapp
pm2 start ecosystem.config.cjs     # python3 -m http.server 3000
# → http://localhost:3000
```

Debug: `?play=1&diff=hard&ch=4&x=1500` → birbaşa bölməyə/nöqtəyə atlayır.

## Validasiya

```bash
node tools/validate-levels.js
```

Yoxlanılanlar: zəmin davamlılığı, pilləkən çatımlılığı (dy ≤ 108, dx ≤ 96), tikan eniş
sahəsi (≥70px), prop-ların yerdə olması və sıxlığı, item/düşmən/NPC/trigger/checkpoint/exit
dayaqları, açar sayı, dialoq personajları, son mətnləri, `Alice`/`Leo` qalıqları.

```
PASSED — 0 errors, 0 warning(s)
  ch1  w=2800  ledges=12  spikes=2  props=14  items=40  enemies=0  exit=x2740
  ch2  w=3200  ledges=12  spikes=3  props=13  items=37  enemies=5  exit=x3080
  ch3  w=3400  ledges=12  spikes=3  props=10  items=42  enemies=6  exit=x3300
  ch4  w=3000  ledges=12  spikes=2  props=11  items=37  enemies=4  exit=x2920
  ch5  w=3600  ledges=15  spikes=4  props=10  items=49  enemies=7  exit=x3500
  ch6  w=3000  ledges=12  spikes=2  props= 9  items=38  enemies=5  exit=x2920
  ch7  w=2800  ledges= 9  spikes=1  props= 7  items=29  enemies=3  exit=finale
```

## Texniki qeydlər

- Oyun dünyası: `y` ayaq səviyyəsi, yer səthi `y = 470`
- Canvas 1024×576, CSS ilə `min(100vw, 100vh*16/9)` miqyaslanır
- `localStorage` açarları: `sanu_profile_v4`, `sanu_run_v4`, `sanu_settings_v4`
  (köhnə `alice_*_v3` açarları avtomatik miqrasiya olunur)
- Fizika: tullanma ~138px, qaçış hava məsafəsi ~188px, yerçəkim 2250

## GitHub

https://github.com/ilhamaliyevaztt/game
