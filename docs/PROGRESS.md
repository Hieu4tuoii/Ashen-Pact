# NHẬT KÝ TIẾN ĐỘ DỰ ÁN (PROGRESS.md) — ASHEN PACT

## 1. Tóm Tắt Kế Hoạch Toàn Bộ 9 Phase & Các Giả Định Kỹ Thuật

### 1.1 Lộ trình 9 Phase (Phase 0 → Phase 8)
1. **Phase 0 — Nền móng & Thiết kế (ĐÃ HOÀN THÀNH ✅):** Thiết lập monorepo `pnpm` (`apps/client`, `apps/server`, `packages/shared`), TS strict, ESLint, Prettier, Vitest, Playwright, bộ tài liệu sống `docs/`, thư viện vẽ procedural vector (`palette`, `primitives`, `outlined()`, `TextureBaker` theo DPR, `CutoutRig`), nhân vật mẫu **Thiết Vệ** + quái mẫu **Goblin Xạ Thủ**, scene `ArtGallery`, khung Phaser scenes + Colyseus hello room + `window.__GAME_DEBUG__`.
2. **Phase 1 — Core Gameplay & Game Feel (ĐÃ HOÀN THÀNH ✅):** Vòng lặp simulation 60Hz trong `packages/shared` + `LocalTransport`, di chuyển gia tốc, dash i-frame, camera lookahead, 4 vũ khí mẫu, 3 quái mẫu + AI/telegraph, spatial hash, hit-stop, screen shake, damage popup, ZzFX.
3. **Phase 2 — Pipeline Hình ảnh & Tương tác Map:** Tilemap procedural + autotile, lightmap động + bloom/vignette, particle/decal pool, đồ vỡ/thùng nổ, bề mặt tương tác nguyên tố, stress test 60 FPS (4P + 80 quái + 600 đạn).
4. **Phase 3 — Dungeon, Vòng lặp lượt chơi & Biome 1 hoàn chỉnh:** Sinh tầng procedural có kiểm chứng liên thông, minimap + fog of war, 12 vũ khí, rương/thương nhân/tượng thần/phòng bí mật, toàn bộ quái + Elite Biome 1, Boss **Mục Vương Nấm Độc** 3 phase.
5. **Phase 4 — Co-op LAN:** Server authoritative Colyseus phục vụ tĩnh + WebSocket cùng cổng `2567`, LAN IP + QR code, `NetworkTransport`, client prediction + reconciliation, adaptive interpolation, deterministic bullet spawn, mô phỏng mạng Wi-Fi kém, E2E 4 client qua IP LAN thực.
6. **Phase 5 — 5 Nhân vật, Hệ Nguyên tố & Synergy:** Hoàn thiện Thiết Vệ, Liệp Ưng, Lam Hỏa, Mộc Linh, Bánh Răng kèm nâng cấp skill, 6 phản ứng nguyên tố + Team Combo, công cụ Balance Harness headless xuất `docs/balance-report.md`.
7. **Phase 6 — Biome 2 & 3 + Boss:** Hoàn thiện Hầm Băng Vĩnh Cửu (**Băng Hậu Kryssa**) và Lò Rèn Dung Nham (**Titan Lò Rèn**), đủ 24 vũ khí, cơ chế map chuyên biệt.
8. **Phase 7 — UI/UX & Âm thanh hoàn thiện:** Menu động, HUD vector, Settings đầy đủ, MVP screen, i18n `vi`/`en`, nhạc động 2 lớp khám phá/chiến đấu + âm thanh định vị.
9. **Phase 8 — Cân bằng cuối, Hiệu năng, QA & Bản phát hành:** Soak test 20 phút, đóng gói `AshenPact-Host.exe` + `start-host.bat` chạy độc lập, `README.md` tiếng Việt, `RELEASE_NOTES.md`, tag `v0.1.0`.

### 1.2 Các Giả Định Kỹ Thuật (Explicit Assumptions)
- **Môi trường thực thi:** Windows 10/11 với Node.js `v24.14.0` và `pnpm 9.15.2`.
- **Font OFL đóng gói local:** Sử dụng font `Be Vietnam Pro` (SIL Open Font License 1.1) đóng gói trực tiếp tại `apps/client/public/fonts/` và bundle local qua `@fontsource/be-vietnam-pro` để đảm bảo hiển thị trọn vẹn tiếng Việt có dấu mà không cần kết nối Internet.
- **Độ phân giải chuẩn và DPR Supersampling:** Thế giới có vùng nhìn cơ sở `960×540` đơn vị; `TextureBaker` bake toàn bộ bộ phận cutout rig ở hệ số `5x` (1080p) và `7x` (1440p) (kẹp trong khoảng `4x–8x`) với `{ willReadFrequently: true }` trên 2D canvas để vừa sắc nét tuyệt đối (kể cả bản phóng đại `2.25×` trong `ArtGalleryScene`) vừa tránh mọi cảnh báo `ReadPixels` khi upload lên WebGL.
- **Cổng mạng mặc định:** Server Colyseus chạy tại cổng `2567` (tự động thử cổng kế tiếp nếu bận), Vite dev server chạy tại cổng `5173`.

---

## 2. Nhật Ký Thực Thi Các Phase

### Phase 0 — Nền móng & Thiết kế (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - Khởi tạo Git repository, cấu hình monorepo `pnpm` (`packages/shared`, `apps/client`, `apps/server`) với TypeScript `strict: true`, ESLint 9, Prettier 3, Vitest 2, Playwright.
  - Tạo trọn bộ tài liệu sống tại `docs/`: `GDD.md`, `TECH.md`, `ART_GUIDE.md`, `BALANCE.md`, `PHASES.md`, `PROGRESS.md`, `CREDITS.md`.
  - Xây dựng `packages/shared`: `SeededRandom` (Mulberry32 + FNV-1a, hỗ trợ cả seed số nguyên, số thực và chuỗi), `FixedTimestepLoop` (60Hz + interpolation `alpha`), va chạm hình học (`circleVsCircle`, `circleVsAABB`), lượng tử hóa gói tin mạng, và bảng dữ liệu tĩnh cho 5 nhân vật, vũ khí, quái Biome 1 và Co-op scaling.
  - Xây dựng `apps/server`: Server Colyseus + Express trên cổng `2567`, `HelloRoom` chạy vòng lặp 60Hz, tự động dò tìm địa chỉ IPv4 LAN hợp lệ (`/api/host-info`).
  - Xây dựng `apps/client`:
    - Thư viện vẽ procedural `src/art/` (`palette.ts` 42 màu, `easing.ts`, `primitives.ts` với hàm `outlined()`, `rig-defs.ts`, `texture-baker.ts`, `cutout-rig.ts`).
    - Nhân vật mẫu **Thiết Vệ (Vanguard)** và quái mẫu **Goblin Xạ Thủ (Goblin Shooter)** gồm 8 bộ phận cutout tách rời, chạy mượt animation tham số `idle` và `run`.
    - Các scene `BootScene`, `PreloadScene`, `MenuScene`, `GameScene`, `ArtGalleryScene` (`?scene=gallery`) cùng `DebugOverlay` (`F1`) và `window.__GAME_DEBUG__`.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (12/12 unit tests, 2/2 E2E test suites).
  - FPS đo qua `window.__GAME_DEBUG__`: **~60.3 FPS** (`16.59 ms` frame time).
  - Console trình duyệt: **0 errors, 0 warnings**.
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-0/`:
    - `docs/screenshots/phase-0/menu-1080p.png`
    - `docs/screenshots/phase-0/game-1080p.png`
    - `docs/screenshots/phase-0/art-gallery-1080p-idle.png`
    - `docs/screenshots/phase-0/art-gallery-1080p-run-p2.png`
    - `docs/screenshots/phase-0/art-gallery-1440p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 0:**
  - Phát hiện các tập con `unicode-range` (`vietnamese`, `latin-ext`, `latin`) của font `Be Vietnam Pro` không tự động tải khi DOM rỗng (khiến Canvas 2D fallback các ký tự có dấu chồng như `ắ ằ ẳ ẵ ặ...` sang Times New Roman) → Đã chủ động gọi `document.fonts.load(...)` với chuỗi tiếng Việt mẫu và `face.load()` cho toàn bộ `FontFace` trong `PreloadScene` trước khi khởi tạo scene, đồng thời đồng bộ đủ 12 file `.woff2` (`latin`, `latin-ext`, `vietnamese` × `400, 600, 700, 800`) tại `apps/client/public/fonts/`.
  - Phát hiện sự kiện `this.scale.on('resize', ...)` không được gỡ khi chuyển scene gây lỗi `TypeError` khi đổi độ phân giải sau khi chuyển cảnh, và thiếu cập nhật lại texture/resolution trong `MenuScene`/`GameScene` khi `bakeScale` thay đổi → Đã gắn cleanup tại `Phaser.Scenes.Events.SHUTDOWN` (bao gồm cả rời phòng Colyseus và hủy listener `F1`) và tự động làm mới toàn bộ rig, tile sprite, text resolution khi resize.
  - Phát hiện text mặc định của Phaser ở `resolution: 1` hơi mềm khi camera zoom 2x–2.67x → Đã gắn `resolution: TextureBaker.getBakeScale()` cho mọi đối tượng chữ, giúp chữ tiếng Việt có dấu sắc nét tuyệt đối ở cả 1080p và 1440p.
  - Phát hiện cảnh báo `GL Driver Message: GPU stall due to ReadPixels` khi upload 2D canvas lên WebGL → Đã bật `{ willReadFrequently: true }` trên 2D canvas của `TextureBaker` và cấu hình D3D11 ANGLE cho Chromium, đưa số lượng warning về 0.

---

### Phase 1 — Core Gameplay & Game Feel (Solo, Phòng Thử Nghiệm) (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Simulation 60Hz & Transport (`packages/shared`):**
    - Mở rộng `math/vec2.ts` (`resolveCircleVsAABB`, `isCircleInCone`, `approach`, `normalizeAngle`, `angleDiff`) và xây dựng `SpatialHashGrid<T>` (`64×64` đơn vị, zero-allocation trên đường nóng).
    - Xây dựng `ArenaMap` (`36×22` ô = `1152×704` đơn vị, tường bao + 4 trụ chiến thuật `2×2`, trượt tường mượt qua `resolveCircleCollision`, kiểm tra đạn đập tường qua `checkProjectileWallHit`).
    - Xây dựng `WorldSim` chạy tất định ở `60Hz` (`dt = 1/60s`): di chuyển gia tốc/giảm tốc, Dash i-frame (`0.2s` bất tử, `1.2s` hồi chiêu), Giáp hấp thụ sát thương trước HP + tự hồi sau `2.0s` (Thiết Vệ), kỹ năng chủ động **Tường Khiên Hồng Ngọc** (`120°` chắn đạn trước mặt trong `3.5s` và nổ sóng xung kích phản kích), nam châm hút ngọc năng lượng & xu vàng.
    - Xây dựng `ITransport` và `LocalTransport` với accumulator khởi tạo sẵn giúp **phản hồi input < 1 frame** ở cả màn hình `60Hz` và `144Hz`, kèm nội suy vị trí render (`lerp(prev, curr, alpha)`).
  - **4 Vũ khí mẫu & 3 Quái mẫu + Bù nhìn tập luyện:**
    - 4 vũ khí mẫu: `knight_sword` (Kiếm Hiệp Sĩ — chém vòng cung `115°`, phá hủy đạn địch), `rusty_pistol` (Súng Lục Rỉ Sét), `scrap_shotgun` (Shotgun Phế Liệu — chùm 5 viên), `gale_smg` (Tiểu Liên Gió Lốc).
    - 3 quái mẫu + bù nhìn: `goblin_shooter` (Goblin Xạ Thủ — giữ khoảng cách + telegraph 3 tia laser đỏ `0.5s` trước khi bắn chùm 3 viên), `wild_boar` (Heo Rừng Đột Biến — khóa hướng + telegraph hành lang đỏ `0.7s` trước khi lao húc), `spore_bomber` (Nấm Cảm Tử — áp sát + telegraph vòng tròn đỏ phồng dần `0.6s` trước khi phát nổ AoE `R = 68u`), cùng `training_dummy` (Bù Nhìn Tập Luyện hiển thị DPS thực tế).
    - Mọi quái khi sinh ra đều có vòng tròn ma thuật tím dưới sàn `0.8s` (`spawning` state) trước khi kích hoạt AI/hitbox.
  - **Procedural Art, Animation, Combat FX & ZzFX Audio (`apps/client`):**
    - Mở rộng `rig-defs.ts` và `texture-baker.ts`: thêm cutout rig 8 bộ phận cho `wild_boar`, `spore_bomber`, `training_dummy`; bake sprite cho cả 4 vũ khí mẫu, tường/trụ có chiều sâu, đạn người chơi & đạn quái tương phản cao, tâm ngắm (crosshair), hạt tia lửa và ngọc năng lượng/xu.
    - Mở rộng `cutout-rig.ts` với 5 trạng thái hoạt ảnh tham số (`idle`, `run`, `dash`, `attack`, `hurt`), tự động xoay tay cầm vũ khí theo góc chuột, giật lùi vũ khí khi bắn và chớp sáng `hitFlash` (`90ms`).
    - Xây dựng `ZzfxSynth` (`apps/client/src/audio/zzfx.ts`): bộ tổng hợp âm thanh Web Audio 100% bằng code (dao động sóng + biến thiên cao độ ±6% + định vị stereo + giới hạn đa âm + cổng kích hoạt theo tương tác người dùng để không gây cảnh báo Autoplay).
    - Xây dựng `CombatFxManager` (`apps/client/src/fx/combat-fx.ts`): Object pool 160 hạt tia lửa/vỏ đạn/mảnh vỡ rig khi quái chết, pool 40 chữ số sát thương nảy lên, `hit-stop` (`30–50ms`) và rung màn hình theo `trauma^2` dùng hàm hài Perlin mượt mà.
    - Nâng cấp `GameScene` & `DebugOverlay`: camera lookahead `22%` mượt không giật, HUD vector tiếng Việt sắc nét, phím tắt debug `F1` (Overlay), `F2` (Bất tử + đầy NL), `F3` (Triệu hồi đợt quái), `F4` (Hitbox + lưới Spatial Hash 64×64), `F5` (Đổi vũ khí).
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (3/3 Vitest test suites = 20 unit tests; 3/3 Playwright E2E test suites).
  - FPS đo qua `window.__GAME_DEBUG__`: **~60.1 FPS** (`16.65 ms` frame time).
  - Console trình duyệt: **0 errors, 0 warnings**.
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-1/`:
    - `docs/screenshots/phase-1/arena-overview-1080p.png`
    - `docs/screenshots/phase-1/combat-shotgun-feel-1080p.png`
    - `docs/screenshots/phase-1/enemy-telegraphs-and-shield-1080p.png`
    - `docs/screenshots/phase-1/debug-hitboxes-f1-f4-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 1:**
  - Phát hiện ở màn hình tần số quét cao (`144Hz`, `dt = 6.94ms`), frame đầu tiên sau khi gửi input chưa làm tăng vị trí nội suy nếu `FixedTimestepLoop` khởi tạo accumulator bằng `0` → Đã khởi tạo accumulator ở `SIM_STEP_MS - 0.001` kết hợp xử lý sub-frame đầu tiên trong `LocalTransport`, đảm bảo phản hồi input `< 1 frame` ở cả `60Hz` lẫn `144Hz` và giữ nội suy đơn điệu 100%.
  - Khi tự review screenshot `enemy-telegraphs-and-shield-1080p.png`, phát hiện chuỗi trạng thái HUD phía trên hơi sát mép phải khi kỹ năng Khiên đang đếm ngược và vị trí bù nhìn mặc định `(160, 144)` nằm gần thanh HUD trên → Đã dời bù nhìn về `(210, 260)` và tinh chỉnh bố cục chữ HUD trên để toàn bộ chuỗi tiếng Việt có dấu hiển thị thoáng, cân đối.
- **Bước tiếp theo (Phase 2):**
  - Triển khai **Phase 2 — Pipeline Hình Ảnh & Tương Tác Map**: Tilemap procedural có chiều sâu + autotile, hệ ánh sáng động (lightmap `RenderTexture` + `ADD` blend + bloom + vignette), hệ particle/decal bền (pool), đồ vỡ được & thùng nổ, 6 loại bề mặt tương tác nguyên tố (Cháy/Lạnh/Sét/Độc), cài đặt chất lượng đồ họa + auto quality, và bài stress test giữ ≥ 60 FPS ở 1080p High.
