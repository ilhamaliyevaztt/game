# Sən hələ də məni axtarırsan? — Sanu · BDU

Yağışlı Bakıda, BDU-nun dəhlizlərində **Nuran**, **Sanu**-nu axtarır. Atmosferik 2D
psixoloji qorxu platforması. Tam **statik sayt** (HTML + CSS + vanilla JS) — server,
framework və build addımı yoxdur. **PWA** kimi telefona quraşdırıla bilər və oflayn oynanır.

## Hekayə

> Axşam idi. Yağış yavaş-yayış yağırdı. Nuran evə qayıdarkən bulvarda tək dayanan bir qız
> gördü. Qızın adı Sanu idi. Amma Nuran onu ilk dəfə görürdü...

Sanu deyir: *"Sabah universitetə gəl."* Səhər BDU-nun həyətində qız yoxdur — yalnız
qapının üstündə bir rəqəm: **314**.

Arxiv zirzəmisində tapılan qovluq hər şeyi dəyişir: *"Tələbə Sanu M. — akademik
məzuniyyət, dörd il əvvəl."* / *"Nuran Ə. — travmatik itki, yaddaşın qoruyucu silinməsi."*

**v5 — 12 bölmə, 6 fərqli son, real seçimlər, hər bölmədə fərqli oyun qaydası.**

## Bölmələr (12) və oyun rejimləri

| # | Ad | Rejim | Xüsusiyyət |
|---|-----|-------|-----------|
| I | Yağışlı Bakı | calm | Tanışlıq, ilk qərar (kölgəyə yaxınlaş/keç), düşmən yox |
| II | BDU həyəti | tense | İlk düşmənlər, açar, darvaza qərarı |
| III | Universitet dəhlizi | tense | 2 açar, cızılmış şəkil, yanıb-sönən lampa |
| IV | Auditoriya 314 | calm | Sanu ilə görüş, **üzr qərarı**, şəkil qərarı |
| V | Arxiv zirzəmisi | dark | Qaranlıq + lampa, ov tüfəngi, **həqiqət qovluğu qərarı** |
| VI | Kölgə Sanu | boss | Boss (3 fazalı enrage: 50% / 25% HP) |
| VII | Güzgü dəhlizi | mirror | **Əksin səni 0.9s gecikmə ilə izləyir** (twin düşmən) |
| VIII | Yataqxana otağı | stealth | **Səs metrı** — qaçsan/atəş açsan yuxudakılar oyanır |
| IX | Qara pilləkən | chase | **Qaranlıq divarı arxanca gəlir**, dayansan tutur |
| X | Stansiya · 03:14 | puzzle | **İki qolu** tap və işə sal, sonra qatar qapısı açılır |
| XI | Pərdə tuneli | dark | Pərdə arxasında kölgələr, qərar (aç/keç) |
| XII | Oyanış | boss | Final boss (göz) + **son qərar** (çiçək / get / qal) |

## 6 son

| Son | Şərt |
|-----|------|
| **Bağışlanma** | qovluğu oxu + üzr dilə + çiçək ver + ≥16 jurnal qeydi |
| **Gecikmiş çiçək** | çiçək ver, amma həqiqəti tam bilmə |
| **Sükut** | çiçək vermədən get |
| **Həqiqət** | qovluğu oxu + şəkli cır + çiçək vermə |
| **Kül** | qovluğu yandır |
| **Qalmaq** (gizli) | qovluğu oxu + sonda "Yerində qal" seç |

"Sonlar" menyusundan hansı sonları açdığını görə bilərsən (`localStorage`).

## Mağaza və inventar (düzəldildi)

**v5-də alınan hər şey oyunda qalır və istifadə olunur:**

- `profile.inv` — tək həqiqət mənbəyi. Heç nə "drain" edilmir.
- **1** tibb dəsti · **2** neft lampası · **3** qəhvə · **4** qalxan · **5** alov fişəngi
- Alt hissədəki **hotbar** düymələri də işləyir (mobil üçün)
- Pullar, çiçək və güllə ümumi hesabda saxlanılır — bölmələr arasında keçərli
- Mağazada hər əşyanın yanında "çantanda: N" göstərilir

## İşləyən mexanikalar

- **Hərəkət**: A/D, Shift qaçış, Space tullanma (coyote-time + jump buffer), S əyilmə
- **Döyüş**: J / sol klik, tüfəng (2 güllə), güllə bitəndə yumruq (softlock yoxdur)
- **14 düşmən növü** (yeni: `twin` güzgü əksi, `sleeper` yuxulu)
- **Choice overlay** — klaviatura (↑↓ + Enter) və klik ilə, seçim profile yazılır
- **12 qeydlik → 26 qeydlik jurnal**, 6 son qalereyası
- **Çətinlik**: Asan / Orta / Çətin, tam keçiləndir, 3 ölümdən sonra azaltma təklifi

## Performans (optimallaşdırma)

- `ctx.shadowBlur` render yolundan **tamamilə çıxarıldı** (hər sprite üçün off-screen blur pass idi) → cached glow sprite-lər
- **HUD diffing**: ürəklər/güllə/sikkə/slot yalnız dəyər dəyişəndə DOM-a yazılır
- `localStorage` yazıları **debounce** edildi (420 ms) + `pagehide`-də flush
- Fixed-step fizika accumulator, camera culling, particle cap 220
- Zəif cihaz üçün avtomatik `lowFx` düşməsi

## Test

```bash
node tools/validate-levels.js   # 12 bölmə həndəsə + mətn validasiyası → PASSED, 0 error
node tools/simulate.js          # headless oyun simulyasiyası (real kod, stub DOM)
```

## Deployment

- **Platform**: statik (GitHub Pages / Cloudflare Pages / istənilən statik host)
- **Tech**: HTML + CSS + vanilla JS + Canvas2D + Web Audio (heç bir xarici asılılıq)
- **Status**: ✅ işləyir

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
