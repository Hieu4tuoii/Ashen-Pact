# DANH SÃCH KIá»‚M TRA CÃC PHASE (PHASES.md) â€” ASHEN PACT

> Quy táº¯c: Má»—i phase chá»‰ Ä‘Æ°á»£c Ä‘Ã¡nh dáº¥u hoÃ n thÃ nh `[x]` khi Ä‘áº¡t 100% Definition of Done (DoD) chung vÃ  riÃªng, `pnpm verify` xanh, 0 console error/warning, FPS Ä‘áº¡t má»¥c tiÃªu vÃ  cÃ³ Ä‘áº§y Ä‘á»§ screenshot táº¡i `docs/screenshots/phase-N/`.

## DoD Chung Cho Má»i Phase
- [x] `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e` smoke) xanh 100%
- [x] 0 lá»—i / warning trong console trÃ¬nh duyá»‡t khi cháº¡y E2E
- [x] FPS má»¥c tiÃªu Ä‘áº¡t (~60 FPS, Ä‘o qua `window.__GAME_DEBUG__`)
- [x] Screenshot lÆ°u táº¡i `docs/screenshots/phase-N/` vÃ  Ä‘Ã£ tá»± review báº±ng máº¯t theo `ART_GUIDE.md`
- [x] Cáº­p nháº­t `docs/PROGRESS.md` vÃ  `docs/PHASES.md`
- [x] `git commit` (Conventional Commits) + `git tag phase-N`

---

## Phase 0 â€” Ná»n mÃ³ng & Thiáº¿t káº¿ (HoÃ n thÃ nh âœ…)
- [x] Init git, monorepo (`pnpm` workspaces), TypeScript `strict`, ESLint/Prettier, Vitest, Playwright, scripts `dev/build/test/e2e/verify`.
- [x] Viáº¿t Ä‘áº§y Ä‘á»§ `docs/GDD.md`, `docs/TECH.md`, `docs/ART_GUIDE.md`, `docs/BALANCE.md`, `docs/PHASES.md`, `docs/PROGRESS.md`, `CREDITS.md`.
- [x] Dá»±ng ná»n mÃ³ng thÆ° viá»‡n váº½ `apps/client/src/art/` (palette 42 mÃ u, primitives, `outlined()`, bake texture theo DPR, rig cutout + animation tham sá»‘) vÃ  scene `ArtGallery`; váº½ **1 nhÃ¢n váº­t máº«u (Thiáº¿t Vá»‡) + 1 quÃ¡i máº«u (Goblin Xáº¡ Thá»§)** vá»›i animation `idle` / `run` Ä‘á»ƒ chá»‘t style.
- [x] Khung client Phaser (scene `Boot`, `Preload`, `Menu`, `Game`, `ArtGallery`), khung server Colyseus "hello room", package `packages/shared` vá»›i PRNG + fixed timestep loop + debug overlay `F1` + `window.__GAME_DEBUG__`.
- [x] **DoD riÃªng Phase 0:**
  - [x] `pnpm dev` cháº¡y Ä‘Æ°á»£c client + server
  - [x] Scene trá»‘ng / Game / ArtGallery Ä‘áº¡t ~60 FPS (`60.2 FPS` / `16.61 ms`)
  - [x] Test E2E smoke pass (0 console errors/warnings)
  - [x] Render Ä‘Ãºng chuá»—i tiáº¿ng Viá»‡t cÃ³ dáº¥u: `"Tiáº¿ng Viá»‡t: áº¯ áº± áº³ áºµ áº· áº§ áº© áº« áº­ á»¡ á»± á»¯ á»¹ Ä Ä‘"`
  - [x] Screenshot `ArtGallery` á»Ÿ 1080p vÃ  1440p cho tháº¥y nhÃ¢n váº­t/quÃ¡i máº«u nÃ©t sáº¯c, khÃ´ng rÄƒng cÆ°a, khÃ´ng má», Ä‘Ãºng `ART_GUIDE.md`

---

## Phase 1 â€” Core Gameplay & Game Feel (Solo, PhÃ²ng Thá»­ Nghiá»‡m) (HoÃ n thÃ nh âœ…)
- [x] Simulation trong `packages/shared` + `LocalTransport`; render interpolation.
- [x] Di chuyá»ƒn cÃ³ gia tá»‘c, dash i-frame, ngáº¯m chuá»™t, camera lookahead, crosshair váº½ báº±ng code.
- [x] NhÃ¢n váº­t Thiáº¿t Vá»‡ (animation cÆ¡ báº£n), 4 vÅ© khÃ­ máº«u (sÃºng lá»¥c, shotgun, SMG, kiáº¿m), Ä‘áº¡n + va cháº¡m tile + spatial hash grid.
- [x] 3 quÃ¡i máº«u (báº¯n xa, lao hÃºc, ná»•) vá»›i AI cÆ¡ báº£n + telegraph.
- [x] HP/GiÃ¡p/NÄƒng lÆ°á»£ng, damage, knockback, hit flash, hit-stop, screen shake, sá»‘ damage, SFX cÆ¡ báº£n (ZzFX).
- [x] **DoD riÃªng Phase 1:** Pháº£n há»“i input < 1 frame, khÃ´ng giáº­t camera, chuyá»ƒn Ä‘á»™ng mÆ°á»£t á»Ÿ 60/144Hz, báº¯n trÃºng cÃ³ Ä‘á»§ flash + spark + Ã¢m + sá»‘ damage + knockback; unit test cho damage/giÃ¡p/va cháº¡m.

---

## Phase 2 â€” Pipeline HÃ¬nh áº¢nh & TÆ°Æ¡ng TÃ¡c Map (HoÃ n thÃ nh âœ…)
- [x] Tilemap váº½ báº±ng code (bake tile + biáº¿n thá»ƒ theo seed) + autotile, tÆ°á»ng cÃ³ chiá»u sÃ¢u/bÃ³ng; há»‡ Ã¡nh sÃ¡ng lightmap + bloom + vignette + color grading.
- [x] Há»‡ particle (pool), decal bá»n, bÃ³ng Ä‘á»•, ambient (lÃ¡/sÆ°Æ¡ng), afterimage dash.
- [x] Äá»“ vá»¡ Ä‘Æ°á»£c, thÃ¹ng ná»•, bá» máº·t nÆ°á»›c/dáº§u/cá»/Ä‘áº§m Ä‘á»™c/dung nham/bÄƒng, tráº¡ng thÃ¡i nguyÃªn tá»‘ cÆ¡ báº£n (ChÃ¡y/Láº¡nh/SÃ©t/Äá»™c) + tÆ°Æ¡ng tÃ¡c bá» máº·t.
- [x] CÃ i Ä‘áº·t cháº¥t lÆ°á»£ng Ä‘á»“ há»a + auto quality.
- [x] **DoD riÃªng Phase 2:** Stress test (4 ngÆ°á»i chÆ¡i giáº£ láº­p + 80 quÃ¡i + 600 Ä‘áº¡n + particle) giá»¯ â‰¥ 60 FPS á»Ÿ 1080p High, khÃ´ng rÃ² rá»‰ bá»™ nhá»› (3 phÃºt); screenshot Ã¡nh sÃ¡ng Ä‘á»™ng.

---

## Phase 3 â€” Dungeon, VÃ²ng Láº·p LÆ°á»£t ChÆ¡i & Biome 1 HoÃ n Chá»‰nh (Vertical Slice Solo) (HoÃ n thÃ nh âœ…)
- [x] Sinh táº§ng procedural theo seed (Ä‘áº£m báº£o liÃªn thÃ´ng â€” cÃ³ unit test), cÃ¡c loáº¡i phÃ²ng, cá»­a khÃ³a + Ä‘á»£t quÃ¡i + vÃ²ng triá»‡u há»“i, minimap + fog of war, dá»‹ch chuyá»ƒn giá»¯a táº§ng.
- [x] VÅ© khÃ­ ~12 cÃ¡i (14 vÅ© khÃ­ Ä‘á»§ 5 báº­c hiáº¿m), rÆ°Æ¡ng theo Ä‘á»™ hiáº¿m, xu + thÆ°Æ¡ng nhÃ¢n + tÆ°á»£ng tháº§n, phÃ²ng bÃ­ máº­t, buff giá»¯a táº§ng.
- [x] ToÃ n bá»™ quÃ¡i + Elite biome 1, Boss Má»¥c VÆ°Æ¡ng Ä‘áº§y Ä‘á»§ 3 phase, mÃ n hÃ¬nh tháº¯ng/thua/káº¿t quáº£.
- [x] Thay toÃ n bá»™ placeholder báº±ng hÃ¬nh váº½ code hoÃ n chá»‰nh cho má»i entity/tile/icon cá»§a biome 1; cáº­p nháº­t `ArtGallery`.
- [x] **DoD riÃªng Phase 3:** ChÆ¡i trá»n biome 1 solo khÃ´ng lá»—i; E2E bot tá»± Ä‘i qua 1 táº§ng báº±ng debug mÃ  khÃ´ng crash; screenshot tá»«ng loáº¡i phÃ²ng + boss.

---

## Phase 4 â€” Co-op LAN (HoÃ n thÃ nh âœ…)
- [x] Host server (Colyseus) cháº¡y sim authoritative + phá»¥c vá»¥ client tÄ©nh cÃ¹ng cá»•ng, `NetworkTransport`, prediction + reconciliation, interpolation thÃ­ch á»©ng, Ä‘áº¡n táº¥t Ä‘á»‹nh, giáº£ láº­p máº¡ng wifi.
- [x] Lá»‡nh `pnpm host`, hiá»ƒn thá»‹ IP LAN + mÃ£ QR + nÃºt sao chÃ©p link trong Hub; Ã´ nháº­p IP thá»§ cÃ´ng á»Ÿ menu.
- [x] Hub nhiá»u ngÆ°á»i, chá»n nhÃ¢n váº­t, sáºµn sÃ ng, reconnect, xá»­ lÃ½ Host thoÃ¡t.
- [x] Scaling theo sá»‘ ngÆ°á»i, gá»¥c/há»“i sinh/linh há»“n, loot instanced, ping + emote, dá»‹ch chuyá»ƒn ngÆ°á»i á»Ÿ ngoÃ i vÃ o phÃ²ng chiáº¿n Ä‘áº¥u, mÃ u Ä‘á»‹nh danh ngÆ°á»i chÆ¡i.
- [x] **DoD riÃªng Phase 4:** E2E vá»›i 4 client káº¿t ná»‘i qua Ä‘á»‹a chá»‰ IP LAN cá»§a mÃ¡y, cÃ¹ng vÃ o Hub, qua 1 táº§ng; mÆ°á»£t dÆ°á»›i profile "wifi tá»‡"; bÄƒng thÃ´ng â‰¤ ~30 KB/s/client; Host â‰¥ 60 FPS; unit test scaling; checklist test tay trÃªn 2+ mÃ¡y tháº­t trong `PROGRESS.md`.

---

## Phase 5 â€” 5 NhÃ¢n Váº­t, Há»‡ NguyÃªn Tá»‘ & Synergy (HoÃ n thÃ nh âœ…)
- [x] HoÃ n thiá»‡n Ä‘á»§ 5 nhÃ¢n váº­t (animation riÃªng, VFX skill, SFX riÃªng), 2 nÃ¢ng cáº¥p má»—i skill, pháº£n á»©ng nguyÃªn tá»‘ Ä‘áº§y Ä‘á»§ + Team Combo, preview ká»¹ nÄƒng á»Ÿ Hub.
- [x] Balance harness headless xuáº¥t `docs/balance-report.md`.
- [x] **DoD riÃªng Phase 5:** Äáº¡t má»i má»¥c tiÃªu má»¥c 7.4; unit test tá»«ng pháº£n á»©ng nguyÃªn tá»‘; má»—i nhÃ¢n váº­t solo qua Ä‘Æ°á»£c boss biome 1 trong harness; test co-op 2 vÃ  4 ngÆ°á»i.

---

## Phase 6 â€” Biome 2 & 3 + Boss (HoÃ n thÃ nh âœ…)
- [x] Tileset váº½ báº±ng code, Ã¡nh sÃ¡ng, ambient, quÃ¡i, Elite, cÆ¡ cháº¿ map riÃªng (bÄƒng trÆ¡n, bÄƒng chuyá»n, mÃ¡y sá»­a Ä‘Æ°á»£c), nÃ¢ng tá»•ng vÅ© khÃ­ lÃªn ~24.
- [x] Boss BÄƒng Háº­u Kryssa vÃ  Titan LÃ² RÃ¨n Ä‘áº§y Ä‘á»§ phase + cÆ¡ cháº¿ co-op + biáº¿n thá»ƒ theo sá»‘ ngÆ°á»i.
- [x] **DoD riÃªng Phase 6:** ChÆ¡i trá»n 3 biome solo vÃ  4 ngÆ°á»i (bot/debug) khÃ´ng crash; boss TTK Ä‘áº¡t má»¥c tiÃªu theo harness; stress test á»Ÿ biome 3 â‰¥ 60 FPS.

---

## Phase 7 â€” UI/UX & Ã‚m Thanh HoÃ n Thiá»‡n (HoÃ n thÃ nh âœ…)
- [x] Menu chÃ­nh Ä‘á»™ng, HUD hoÃ n chá»‰nh, Settings Ä‘áº§y Ä‘á»§, mÃ n hÃ¬nh káº¿t quáº£ + MVP, chuyá»ƒn cáº£nh, tooltip/hÆ°á»›ng dáº«n, i18n `vi`/`en`.
- [x] Bá»™ SFX Ä‘áº§y Ä‘á»§, nháº¡c Ä‘á»™ng khÃ¡m phÃ¡/chiáº¿n Ä‘áº¥u/boss, Ã¢m thanh Ä‘á»‹nh vá»‹, voice limit.
- [x] **DoD riÃªng Phase 7:** Má»i luá»“ng UI Ä‘i Ä‘Æ°á»£c báº±ng chuá»™t khÃ´ng káº¹t; khÃ´ng cÃ³ chuá»—i chÆ°a dá»‹ch; má»i hÃ nh Ä‘á»™ng gameplay Ä‘á»u cÃ³ Ã¢m thanh; screenshot táº¥t cáº£ mÃ n hÃ¬nh UI.

---

## Phase 8 â€” CÃ¢n Báº±ng Cuá»‘i, Hiá»‡u NÄƒng, QA & Báº£n PhÃ¡t HÃ nh (HoÃ n thÃ nh âœ…)
- [x] Cháº¡y láº¡i harness + Ä‘iá»u chá»‰nh; soak test 20 phÃºt; kiá»ƒm tra Chrome/Edge/Firefox.
- [x] Bug bash theo checklist (`docs/QA_CHECKLIST.md`).
- [x] Build production + Ä‘Ã³ng gÃ³i Host app cho Windows (`AshenPact-Host.exe` + `start-host.bat` + `allow-firewall-port-2567.bat`), thÆ° má»¥c release zip sáº¡ch (`release/AshenPact-v0.1.0-win-x64.zip`).
- [x] `README.md` tiáº¿ng Viá»‡t + hÆ°á»›ng dáº«n Windows Firewall + AP Isolation, `CREDITS.md` Ä‘áº§y Ä‘á»§, `docs/RELEASE_NOTES.md`, `git tag phase-8` & `git tag v0.1.0`.

---

## Giai Ä‘oáº¡n Polish v0.2.0

| Phase | Ná»™i dung | YÃªu cáº§u gá»‘c | Tráº¡ng thÃ¡i |
|---|---|---|---|
| P0 | Háº¡ táº§ng chá»¥p áº£nh/metrics/reviewer + baseline | Kiá»ƒm chá»©ng báº±ng hÃ¬nh áº£nh | [x] |
| P1 | Cháº¿ Ä‘á»™ debug, dá»n UI debug | áº¨n debug trong .exe | [x] |
| P2 | VÅ© khÃ­ 2 Ã´ + rÆ¡i vÅ© khÃ­ | 2 vÅ© khÃ­, Ä‘á»•i thÃ¬ rÆ¡i | [x] |
| P3 | Ná»n Ã¡nh sÃ¡ng, PostFX, `HudScene`, camera khÃ´ng mÃ©o | Map dá»… nhÃ¬n, Ã¡nh sÃ¡ng | [x] |
| P4 | **PhÃ²ng chuáº©n B1** (vertical slice) â†’ Palette ENV, sÃ n, tÆ°á»ng, surface cho má»i biome | Map Ä‘áº¹p, giáº£m tÆ°Æ¡ng pháº£n | [x] |
| P5 | Trang trÃ­ biome cÃ²n láº¡i, cháº­u lá»­a | Map Ä‘áº¹p, nguá»“n sÃ¡ng Ä‘uá»‘c | [x] |
| P6 | ÄÃ¨n/glow váº­t thá»ƒ tÆ°Æ¡ng tÃ¡c | Nguá»“n sÃ¡ng cho rÆ°Æ¡ng/Ä‘uá»‘c/cá»•ng/váº­t pháº©m | [x] |
| P7 | NhÃ£n theo khoáº£ng cÃ¡ch, prompt [E] | Gáº§n má»›i hiá»‡n [E] tÃªn | [x] |
| P8 | Cá»•ng dá»‹ch chuyá»ƒn & cá»•ng qua phÃ²ng | Cá»•ng Ä‘áº¹p, sÃ¡ng áº£o diá»‡u | [x] |
| P9a | Design system, HUD trong game | UI/UX hiá»‡n Ä‘áº¡i (HUD) | [x] |
| P9b | Menu, Hub, modal, Pause, Settings, káº¿t quáº£ | UI/UX hiá»‡n Ä‘áº¡i (Screens/Modals) | [x] |
| P10a | NhÃ¢n váº­t Cutout 2.0 & QuÃ¡i Full Rig: animation, shading 2 lá»›p & rim-light | Chi tiáº¿t, mÆ°á»£t, Ä‘áº¹p (Rig) | [x] |
| P10b | FX, Pháº£n á»¨ng NguyÃªn Tá»‘ & Háº¡t MÃ´i TrÆ°á»ng Trong Tráº»o | Chi tiáº¿t, mÆ°á»£t, Ä‘áº¹p (FX) | [x] |
| P11 | Harness tháº­t + Ä‘á»™ khÃ³ + ká»‹ch tÃ­nh | KhÃ³ vÃ  ká»‹ch tÃ­nh hÆ¡n | [x] |
| P12 | Há»“i quy, hiá»‡u nÄƒng, release v0.2.0 | Cháº¥t lÆ°á»£ng sáº£n pháº©m | [x] |

---

## Giai Ä‘oáº¡n Äáº¡i Tu Ashen Pact 2.0 â€” Tactical Arena Overhaul (`v0.2.1` â†’ `v2.0.0`)

| Phase | Tag | Ná»™i dung | Tráº¡ng thÃ¡i |
|---|---|---|---|
| P0A | `ap2-p0a` | Ná»n táº£ng Dá»¯ liá»‡u, Giao thá»©c Máº¡ng 30Hz, XÃ³a NÄƒng LÆ°á»£ng & Dá»n Dáº¹p 18 VÅ© KhÃ­ | [x] |
| P0B | `ap2-p0b` | LÃ¡t Cáº¯t Dá»c Core Fun: 3 Archetype PhÃ²ng, Váº­t LÃ½ Chiáº¿n Thuáº­t, Biome 1 & 4 VÅ© KhÃ­ Chuáº©n (Playtest Gate 1) | [x] |
| P1A | `ap2-p1a` | Äáº¡i Tu VÅ© KhÃ­ Äá»£t 1 (7 VÅ© KhÃ­: Ná», TrÆ°á»£ng Gai, Shotgun, SMG, SÃºng Lá»±u, SÃºng Háº¡t Giá»‘ng, TrÆ°á»£ng XÃ­ch) | [x] |
| P1B | `ap2-p1b` | Äáº¡i Tu VÅ© KhÃ­ Äá»£t 2 (7 VÅ© KhÃ­ CÃ²n Láº¡i) & Pipeline SÃ¡t ThÆ°Æ¡ng 3 NhÃ³m (3-Bucket Damage Cap) | [x] |
| P1C | `ap2-p1c` | 3 Archetype PhÃ²ng CÃ²n Láº¡i & Há»‡ Sinh ThÃ¡i Biome 2 (BÄƒng) + Biome 3 (LÃ² RÃ¨n) | [x] |
| P1D | `ap2-p1d` | 16 PhÆ°á»›c LÃ nh HÃ nh Äá»™ng Cá»‘t LÃµi (Core Action Blessings) & 10 NÃ¢ng Cáº¥p Ká»¹ NÄƒng NhÃ¢n Váº­t | [ ] |
| P2A | `ap2-p2a` | Äá»“ Thá»‹ Táº§ng Äá»™ng (Odd/Even), TÆ°á»ng Ná»©t BÃ­ Máº­t, Äe Thá»£ RÃ¨n Daedalus & PhÃ¢n RÃ£ VÅ© KhÃ­ | [ ] |
| P2B | `ap2-p2b` | Kháº¿ Æ¯á»›c Tro TÃ n (Ashen Pacts: 1 Äiá»‡n Thá» / Biome, Thá»­ ThÃ¡ch Trá»n Biome & 6 ThÃ¡nh Váº­t Thá»©c Tá»‰nh) | [ ] |
| P3A | `ap2-p3a` | Ngáº¯m ÄÃ³n Äáº§u CÃ³ Giá»›i Háº¡n (`Â±28Â°`) & 12 QuÃ¡i TÆ°Æ¡ng TÃ¡c Äá»‹a HÃ¬nh Qua 3 Biome | [ ] |
| P3B | `ap2-p3b` | 3 Boss PhÃ¡ GiÃ¡p TÆ°Æ¡ng TÃ¡c 1â€“2 BÆ°á»›c, Tiáº¿p Táº¿ Giá»¯a Tráº­n & Thanh ChoÃ¡ng `bossStaggerAccum` | [ ] |
| P3C | `ap2-p3c` | Há»“ SÆ¡ Bot MÃ´ Phá»ng NgÆ°á»i Tháº­t, CÃ¢n Báº±ng `pnpm balance` & Playtest Gate 2 | [ ] |
| P4A | `ap2-p4a` | Má»Ÿ Rá»™ng Chiá»u SÃ¢u Äá»£t 1: 8 PhÆ°á»›c LÃ nh HÃ nh Äá»™ng NÃ¢ng Cao & 4 Äá»™t Biáº¿n VÅ© KhÃ­ Má»Ÿ Rá»™ng | [ ] |
| P4B | `ap2-p4b` | Má»Ÿ Rá»™ng Chiá»u SÃ¢u Äá»£t 2: 6 Duo Boons NguyÃªn Tá»‘ & Äáº¥u TrÆ°á»ng BÃ­ Máº­t 20 GiÃ¢y | [ ] |
| P5 | `v2.0.0` | Kiá»ƒm Chá»©ng Há»“i Quy ToÃ n Diá»‡n, Hiá»‡u NÄƒng 60Hz 4P, ÄÃ³ng GÃ³i `v2.0.0` & HoÃ n Táº¥t NhÃ¡nh | [ ] |





---

## Giai Ä‘oáº¡n Äáº¡i Tu ToÃ n Diá»‡n: Ashen Pact 2.0 (`v0.2.1` â†’ `v2.0.0`)

| Phase | Tag | Ná»™i dung trá»ng tÃ¢m | Gate Ä‘áº·c biá»‡t | Tráº¡ng thÃ¡i |
|---|---|---|---|---|
| **P0A** | `ap2-p0a` | **Háº¡ táº§ng Ná»n, The Purge, Per-Player State & Äá»“ng bá»™ Äáº¡n Táº¥t Ä‘á»‹nh 60Hz:** Cáº¯t bá» Energy, cáº¯t 6 vÅ© khÃ­ clone (`24â†’18`) & 6 tháº» cá»™ng sá»‘ chay, migration save `starterWeapons` sang danh sÃ¡ch `18` vÅ© khÃ­, tÃ¡ch build/vÃ ng theo tá»«ng ngÆ°á»i chÆ¡i, `INPUT_BUTTON.RELOAD_VENT` (`[R]`), `deterministicId` Ä‘áº¡n 16-bit, ngÃ¢n sÃ¡ch thá»±c thá»ƒ 60Hz | `pnpm verify` + `pnpm perf` | [x] |
| **P0B** | `ap2-p0b` | **Vertical Slice Äá»™ Vui: 3 Archetype PhÃ²ng, Váº­t lÃ½ `Flip Cover + Kick + Wall-Slam + Ring-Out` & 4 VÅ© khÃ­ Äáº¡i diá»‡n:** CÃ i Ä‘áº·t `TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION` (cÃ³ Mirror + Prop Jitter), cÆ¡ cháº¿ Láº­t bÃ n `[E]` + ÄÃ¡ bÃ n + Äáº­p tÆ°á»ng + RÆ¡i vá»±c, 3 váº­t thá»ƒ Biome 1, `Micro-Bar 32Ã—5px` dÆ°á»›i chÃ¢n nhÃ¢n váº­t, vÃ  4 vÅ© khÃ­ Ä‘áº¡i diá»‡n cho 4 há»‡ nhá»‹p (`rivet_gun` Active Reload, `apprentice_staff` Heat/Vent, `knight_sword` 3-Hit Combo + Parry, `tesla_carbine` Tether) | **Playtest Gate 1 (Kiá»ƒm chá»©ng Äá»™ Vui Cá»‘t LÃµi: PASS 4/4)** + Visual Gate (`10.0 / 10.0 PASS` + Engine 2.6 `5/5 Gates`) | [x] |
| **P1A** | `ap2-p1a` | **Kho VÅ© KhÃ­ Äá»™c Báº£n Äá»£t 1 (7 VÅ© khÃ­: Starter, Uncommon & Rare):** `hunter_crossbow`, `thorn_staff`, `scrap_shotgun`, `gale_smg`, `frag_launcher`, `seed_gun`, `tether_staff` + Procedural VFX & Audio riÃªng cho tá»«ng kháº©u | Visual Gate (`10.0 / 10.0 PASS`) + Engine 2.6 (`8/12F` Strip + `1:1 ROI` + `5/5 Gates`) | [x] |
| **P1B** | `ap2-p1b` | **Kho VÅ© KhÃ­ Äá»™c Báº£n Äá»£t 2 (7 VÅ© khÃ­: Rare, Epic & Legendary) & 3-Bucket Damage Pipeline:** `focus_laser`, `void_staff`, `emerald_cleaver`, `berserker_axe`, `solar_archon_staff`, `magma_cannon`, `thunder_hammer` + CÃ´ng thá»©c 3-Bucket chá»‘ng ná»• sá»‘ nhÃ¢n | Visual Gate (`9.40 / 10.0 PASS` + Engine 2.6 `5/5 Gates`) + Damage Audit Test (`4,608` combinations PASS) | [x] |
| **P1C** | `ap2-p1c` | **Má»Ÿ Rá»™ng 3 Archetype PhÃ²ng Má»›i & Há»‡ Sinh ThÃ¡i TÆ°Æ¡ng TÃ¡c Biome 2 (Háº§m BÄƒng) + Biome 3 (LÃ² RÃ¨n):** `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING` + 6 váº­t thá»ƒ tÆ°Æ¡ng tÃ¡c Biome 2 & 3 (`glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`, `forge_blast_shield`, `pneumatic_press`, `slag_crucible`) | Visual Gate (`9.50 / 10.0 PASS`) + Engine 2.6 (`8/12F` Strip + `1:1 ROI` + `5/5 Gates`) | [x] |
| **P1D** | `ap2-p1d` | **Há»‡ Thá»‘ng 26 Tháº» NÃ¢ng Cáº¥p Cá»‘t LÃµi (16 Action Blessings + 10 Character Skill Upgrades):** Thay tháº¿ há»‡ tháº» cÅ© báº±ng 16 PhÆ°á»›c lÃ nh HÃ nh Ä‘á»™ng cá»‘t lÃµi (4 nhÃ³m Ã— 4 tháº» core) + nÃ¢ng cáº¥p 10 tháº» Ká»¹ nÄƒng nhÃ¢n váº­t tÆ°Æ¡ng tÃ¡c trá»±c tiáº¿p vá»›i bÃ n cháº¯n/nhá»‹p sÃºng/Ä‘á»‹a hÃ¬nh | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) + UI Card Review | [ ] |
| **P2A** | `ap2-p2a` | **Äá»“ Thá»‹ PhÃ²ng Äá»™ng, PhÃ²ng BÃ­ Máº­t Ná»©t TÆ°á»ng, Äe RÃ¨n Cá»• Äáº¡i (6 Core Mutators) & PhÃ¢n RÃ£ SÃºng (`Hold [X] 0.5s`):** Chuyá»ƒn `treasure` thÃ nh `XÆ°á»Ÿng RÃ¨n Kho BÃ¡u`, cÃ i 6 Báº£n Ä‘á»™ BÃºa RÃ¨n cá»‘t lÃµi thay Ä‘á»•i hÃ¬nh há»c Ä‘áº¡n, cÆ¡ cháº¿ giá»¯ `[X]` 0.5s tÃ¡ch sÃºng láº¥y máº£nh rÃ¨n & nÃ¢ng cáº¥p ThÆ°Æ¡ng NhÃ¢n | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) + Economy Test | [ ] |
| **P2B** | `ap2-p2b` | **Há»‡ Thá»‘ng "Kháº¿ Æ¯á»›c Tro TÃ n" (`1 Táº¿ ÄÃ n / Biome â€” Full-Biome Trial`) & 6 Di Váº­t Thá»©c Tá»‰nh:** Táº¿ Ä‘Ã n xuáº¥t hiá»‡n á»Ÿ Táº§ng Láº» (`1, 3, 5`), chá»‹u lá»i nguyá»n xuyÃªn suá»‘t 2 táº§ng cá»§a Biome vÃ  thá»©c tá»‰nh thÃ nh Di Váº­t VÄ©nh Viá»…n sau khi háº¡ Boss á»Ÿ Táº§ng Cháºµn (`2, 4, 6`) + Káº» sÄƒn Ä‘uá»•i `BÃ³ng Ma Äao Phá»§` | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3A** | `ap2-p3a` | **Äáº¡i Tu AI QuÃ¡i (`Bounded Predictive Lead Aiming`) & 12 HÃ nh Vi QuÃ¡i TÆ°Æ¡ng TÃ¡c Äá»‹a HÃ¬nh:** Ngáº¯m Ä‘Ã³n Ä‘áº§u cÃ³ giá»›i háº¡n (`leadFactor`, `maxLeadAngleRad = 22Â°`, tia chá»‰ ngáº¯m `0.35s`, sai sá»‘ ngáº«u nhiÃªn) + 12 hÃ nh vi quÃ¡i tÆ°Æ¡ng tÃ¡c váº­t thá»ƒ qua 3 Biome | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3B** | `ap2-p3b` | **Thiáº¿t Káº¿ Láº¡i 3 Boss PhÃ¡ GiÃ¡p Trá»±c Quan (1â€“2 BÆ°á»›c), `Boss Supply Drop` & `bossStaggerAccum`:** CÆ¡ cháº¿ PhÃ¡ GiÃ¡p 1â€“2 bÆ°á»›c (dÃ¹ng váº­t thá»ƒ phÃ²ng **hoáº·c** Ä‘áº§y thanh Cháº¥n Äá»™ng `bossStaggerAccum` tá»« Active Reload/Parry/Skill), Tiáº¿p táº¿ phÃ²ng Boss má»—i `18s`, cÃ¹ng chuá»—i chiÃªu má»›i cho `spore_king`, `kryssa_ice_queen`, `forge_titan` | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3C** | `ap2-p3c` | **NÃ¢ng Cáº¥p Bot AI Thá»±c Táº¿ (`Human-Like Bot Profile`), CÃ¢n Báº±ng Tá»± Äá»™ng (`pnpm balance`) & Playtest Gate 2:** Dáº¡y Bot dÃ¹ng Active Reload (65% thÃ nh cÃ´ng), Vent (á»Ÿ 80% nhiá»‡t), Láº­t bÃ n & ÄÃ¡ bÃ n, giáº£i cÆ¡ cháº¿ Boss; cháº¡y `pnpm balance` tinh chá»‰nh thÃ´ng sá»‘ Ä‘áº¡t chuáº©n TTK/Win-rate | **Playtest Gate 2 (`pnpm balance` 100% PASS)** | [ ] |
| **P4A** | `ap2-p4a` | **Má»Ÿ Rá»™ng Chiá»u SÃ¢u Äá»£t 1: 8 PhÆ°á»›c LÃ nh HÃ nh Äá»™ng NÃ¢ng Cao & 4 Báº£n Äá»™ BÃºa RÃ¨n Má»Ÿ Rá»™ng:** HoÃ n thiá»‡n Ä‘á»§ `24` Action Blessings (6 tháº»/nhÃ³m) vÃ  `10` Weapon Mutators (`orbital_barrel`, `split_prism`, `shockwave_stock`, `tether_capacitor`) | Visual Gate | [ ] |
| **P4B** | `ap2-p4b` | **Má»Ÿ Rá»™ng Chiá»u SÃ¢u Äá»£t 2: 6 PhÆ°á»›c LÃ nh Giao Thoa (`Elemental Duo Boons`) & Äáº¥u TrÆ°á»ng BÃ­ Máº­t 20 GiÃ¢y:** Má»Ÿ khÃ³a 6 tháº» Giao thoa NguyÃªn tá»‘ khi 2 nguyÃªn tá»‘ kÃ­ch hoáº¡t >= 5 láº§n + nÃ¢ng cáº¥p PhÃ²ng BÃ­ Máº­t thÃ nh thá»­ thÃ¡ch 20 giÃ¢y nháº­n RÆ°Æ¡ng Sá»­ Thi & Táº¿ Ä‘Ã n táº©y tháº» | Visual Gate | [ ] |
| **P5** | `ap2-p5` | **Tá»•ng Duyá»‡t Há»“i Quy ToÃ n Diá»‡n, Hiá»‡u NÄƒng 60Hz 4P, ÄÃ³ng GÃ³i `v2.0.0` & Káº¿t ThÃºc NhÃ¡nh:** Chá»¥p toÃ n bá»™ danh má»¥c cáº£nh cÅ© + má»›i, Holistic `pro` Visual Gate, Soak Test 20 phÃºt 4P, cáº­p nháº­t toÃ n bá»™ `docs/*.md` & `README.md`, nÃ¢ng phiÃªn báº£n `2.0.0`, Ä‘Ã³ng gÃ³i `AshenPact-v2.0.0-win-x64.zip` | Holistic Visual Gate (`>= 8.5/10`) + Release Gate | [ ] |
