# NHẬT KÝ TIẾN ĐỘ DỰ ÁN (PROGRESS.md) — ASHEN PACT

## 1. Tóm Tắt Kế Hoạch Toàn Bộ 9 Phase & Các Giả Định Kỹ Thuật

### 1.1 Lộ trình 9 Phase (Phase 0 → Phase 8)
1. **Phase 0 — Nền móng & Thiết kế (ĐÃ HOÀN THÀNH ✅):** Thiết lập monorepo `pnpm` (`apps/client`, `apps/server`, `packages/shared`), TS strict, ESLint, Prettier, Vitest, Playwright, bộ tài liệu sống `docs/`, thư viện vẽ procedural vector (`palette`, `primitives`, `outlined()`, `TextureBaker` theo DPR, `CutoutRig`), nhân vật mẫu **Thiết Vệ** + quái mẫu **Goblin Xạ Thủ**, scene `ArtGallery`, khung Phaser scenes + Colyseus hello room + `window.__GAME_DEBUG__`.
2. **Phase 1 — Core Gameplay & Game Feel (ĐÃ HOÀN THÀNH ✅):** Vòng lặp simulation 60Hz trong `packages/shared` + `LocalTransport`, di chuyển gia tốc, dash i-frame, camera lookahead, 4 vũ khí mẫu, 3 quái mẫu + AI/telegraph, spatial hash, hit-stop, screen shake, damage popup, ZzFX.
3. **Phase 2 — Pipeline Hình ảnh & Tương tác Map (ĐÃ HOÀN THÀNH ✅):** Tilemap procedural + autotile, lightmap động + bloom/vignette, particle/decal pool, đồ vỡ/thùng nổ, bề mặt tương tác nguyên tố, stress test 60 FPS (4P + 80 quái + 600 đạn).
4. **Phase 3 — Dungeon, Vòng lặp lượt chơi & Biome 1 hoàn chỉnh (ĐÃ HOÀN THÀNH ✅):** Sinh tầng procedural có kiểm chứng liên thông, minimap + fog of war, 14 vũ khí, rương/thương nhân/tượng thần/phòng bí mật, toàn bộ quái + Elite Biome 1, Boss **Mục Vương Nấm Độc** 3 phase, màn hình thắng/thua/kết quả, bot E2E tự vượt tầng & hạ Boss.
5. **Phase 4 — Co-op LAN (ĐÃ HOÀN THÀNH ✅):** Server authoritative Colyseus phục vụ tĩnh + WebSocket cùng cổng `2567`, LAN IP + QR code, `NetworkTransport`, client prediction + reconciliation, adaptive interpolation, deterministic bullet spawn, mô phỏng mạng Wi-Fi kém, E2E 4 client qua IP LAN thực.
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
  - Phát hiện lệch tâm hiển thị giữa `CutoutRig` (gốc `(0, 0)` tại chân/bóng với thân ở `offsetY = -12..-29`) và tâm hitbox/telegraph `(x, y)` của `WorldSim`, làm vòng tròn hitbox `F4` và các vùng cảnh báo đỏ (tia ngắm Goblin, hành lang húc của Heo Rừng, vòng nổ Nấm) bị lệch xuống dưới chân `12u` → Đã bù `RIG_FOOT_OFFSET_Y = 12` cho container của nhân vật, quái và hạt vỡ khi chết, giúp tâm thân nhân vật/quái trùng khớp hoàn toàn với tâm hitbox `F4` và telegraph.
  - Phát hiện công thức `subStep = (1 - this.alpha) * 0.8` trong `LocalTransport.getInterpolatedPlayerPos()` gây giật lùi vị trí ở màn hình `144Hz` khi người chơi đứng yên một lúc (`alpha > 0`) rồi bấm di chuyển (do `1 - alpha` giảm dần trước khi tick tiếp theo chạy) → Đã loại bỏ nhánh `subStep` sai và bổ sung `primeForImmediateTick(deltaMs)` khi thức dậy từ trạng thái đứng yên (`isAtRest && hasImmediateIntent`), đảm bảo phản hồi `< 1 frame` và nội suy tăng đơn điệu tuyệt đối ở cả `60Hz`, `120Hz` và `144Hz`.
  - Phát hiện `setTintFill(0xfde047)` khi quái gồng chiêu (`telegraph`) xóa mất toàn bộ viền tối `#141019` `2.5u` cùng chi tiết mắt/vũ khí thành mảng vàng phẳng, và bắn `scrap_shotgun` (5 viên/phát) phát trùng 5 lần SFX/trauma cùng 5 số sát thương chồng khít lên nhau → Đã đổi cảnh báo `telegraph` sang `setTint` nhân màu cam-vàng (`#ff9e64`) giữ nguyên viền tối, giới hạn `hitFlash` ở thân/đầu, gộp SFX/trauma/hit-stop theo từng nhịp bắn và rải đều vị trí các số sát thương liên tiếp theo hình rẻ quạt.
  - Phát hiện khi trượt dọc khe nối giữa 2 ô tường/trụ liền kề, thứ tự duyệt ô có thể đẩy ngang vào góc nội bộ của ô liền kề → Đã tách `ArenaMap.resolveCircleCollision` thành 2 pha (ưu tiên mặt phẳng chính diện trước góc ngoài) với `scratchBox` tái sử dụng không cấp phát bộ nhớ.
  - Phát hiện thiếu gọi `.setTexture(key)` cho các sprite đạn, vật phẩm rơi và hạt `CombatFxManager` khi `TextureBaker.bakeAll` tạo lại texture lúc đổi độ phân giải (`1080p` ↔ `1440p`), cùng việc `.filter()` mảng trên đường nóng `WorldSim` → Đã bổ sung Object Pool cho đạn/pickup/sprite, nén mảng tại chỗ (`in-place compaction`), gắn lại texture khi resize và bổ sung test E2E resize trực tiếp trong lúc bắn đạn.

---

### Phase 2 — Pipeline Hình Ảnh & Tương Tác Map (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Procedural Tilemap, Autotiling, Bóng Đổ Tường (AO) & Tường Bí Mật (`packages/shared`, `apps/client`):**
    - Mở rộng `ArenaMap` với 8 biến thể gạch sàn theo seed (`tileVariants[0..7]`), bitmask autotile 4 hướng Bắc–Đông–Nam–Tây (`getAutotileMask` `0..15`), bitmask bóng đổ hướng Tây-Bắc (`getWallAmbientOcclusionMask` `0..7`), và ô tường nứt bí mật `'cracked_wall'` (`destroyCrackedWall`).
    - Mở rộng `TextureBaker` bake toàn bộ 8 biến thể sàn Biome 1, 16 biến thể tường & 16 biến thể trụ autotile có mặt vách đá 3D hướng Nam (`7u`), 7 lớp phủ bóng đổ AO mềm, và ghép lên `arena_ground_composite` để chỉ tốn 1 draw call cho toàn bộ nền/tường/bề mặt tĩnh và chỉ vẽ lại đúng các ô thay đổi khi `mapRevision` tăng.
  - **Hệ Ánh Sáng Động & Post-FX Shader (`apps/client/src/fx/lighting-pipeline.ts`):**
    - Xây dựng `LightingPipeline` với lightmap `RenderTexture` chế độ hòa trộn `MULTIPLY` (màu ambient theo từng biome) + cọ sáng radial cộng hưởng cho người chơi, đồng đội P2–P4, đuốc lửa lập lòe (`torch_brazier`), nấm phát quang (`glow_mushroom`), thùng thuốc nổ, bề mặt cháy/điện/dung nham/đầm độc, đạn bay và tia chớp nổ.
    - Xây dựng `BiomePostFxPipeline` (WebGL fragment shader) hỗ trợ Bloom 4-tap phát sáng, Vignette, nhịp đập viền đỏ khi máu thấp (`Low-HP Heartbeat`), Chromatic Aberration khi chấn động mạnh và cân chỉnh màu sắc theo biome (`Color Grading`).
  - **6 Bề Mặt Tương Tác, 4 Trạng Thái Nguyên Tố & Đồ Vật Vỡ / Thùng Nổ Dây Chuyền:**
    - 6 bề mặt tương tác trong `ArenaMap`: `water` (dập lửa, dẫn điện lan flood-fill `electrifyWaterAt`, đóng băng `freezeSurfaceInRadius`), `oil` (làm chậm 15%, bắt lửa `burning_oil` lan sang cỏ/dầu lân cận và cháy tàn thành `ash`), `grass` (rung lá khi đi qua, bắt lửa `burning_grass`), `poison_swamp` (làm chậm + tích độc), `lava` (gây cháy tức thì + phát sáng cam), `ice` (giảm ma sát gây trượt quán tính, tan thành nước khi gặp lửa).
    - 4 trạng thái nguyên tố trong `WorldSim`: **Cháy (`burn`)** gây DoT mỗi `0.5s` và mồi lửa dầu/cỏ; **Lạnh (`chill`)** làm chậm `30%`, tích đủ `3` cộng dồn chuyển thành **Đóng Băng (`frozen`)** bất động `1.5s`, và khi trúng đòn nặng/chí mạng kích hoạt **Vỡ Băng (`shatter`)** gây **sát thương ×3**; **Sét (`shock`)** giật dây chuyền tối đa 2 mục tiêu trong `115u` và truyền điện toàn bộ vùng nước nối liền; **Độc (`poison`)** cộng dồn tối đa 3 tầng DoT và **chặn hồi máu**.
    - Đồ vật vỡ được (`wooden_crate`, `clay_vase` rơi vàng/năng lượng) và thùng thuốc nổ (`explosive_barrel`) kích nổ dây chuyền (`fuseTimer`), mồi lửa dầu/cỏ và phá vỡ tường nứt bí mật `'cracked_wall'`.
  - **Hệ Particle/Decal Bền, Afterimage Dash, Ambient & Cài Đặt Chất Lượng Đồ Họa:**
    - Mở rộng `CombatFxManager`: ring-buffer 120 vệt decal bền trên sàn (`fx_decal_scorch`, `fx_decal_splatter`, `fx_decal_frost`), pool bóng mờ `afterimage` khi Dash, hạt lá rừng rơi & sương mù trôi nổi (`ambientPool`), mảnh gỗ/gốm/băng vỡ và tia sét gấp khúc (`lightningGraphics`).
    - Xây dựng `GraphicsSettingsManager` (`high` / `medium` / `low` lưu `localStorage` + `autoQuality` tự động hạ cấu hình khi FPS tụt kéo dài).
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (4/4 Vitest test suites = 25 unit tests bao gồm soak test 3 phút `10.800` ticks; 4/4 Playwright E2E test suites).
  - Stress Test (4 người chơi giả lập P1–P4 cầm vũ khí tầm xa riêng biệt + 80 quái + 625 đạn + 48 nguồn sáng động thực tế + 234 particle + 10 decal ở 1080p High với `lightmapRt` & `BiomePostFxPipeline` bật đầy đủ): đạt **60.0 FPS** (`16.65 ms` frame time, `sim.step()` chỉ `~0.6 ms`), không rò rỉ bộ nhớ.
  - Console trình duyệt: **0 errors, 0 warnings**.
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-2/` và `docs/screenshots/phase-1/`:
    - `docs/screenshots/phase-2/dynamic-lighting-and-surfaces-1080p.png`
    - `docs/screenshots/phase-2/elemental-reactions-and-barrels-1080p.png`
    - `docs/screenshots/phase-2/graphics-quality-and-debug-1080p.png`
    - `docs/screenshots/phase-2/stress-test-4p-80e-600b-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 2:**
  - Phát hiện trong kịch bản Stress Test 625 viên đạn nguyên tố bay qua hồ nước/băng mỗi frame làm `mapRevision` tăng liên tục, khiến `GameScene.syncArenaTilesWithMapRevision()` gọi `arenaGroundTex.refresh()` (`gl.texImage2D` trên canvas `2304×1408` = 13 MB) mỗi frame → Đã khóa biến đổi bề mặt liên tục trong chế độ Stress Test, ghép toàn bộ 792 ô nền/tường thành 1 texture `arena_ground_composite`, và dùng texture `2x` chuẩn 1080p (`rig_full_*` và `proj_stress_enemy` / `proj_stress_player`).
  - Phát hiện `LightingPipeline.update()` có nhánh `isHeavySwarm = projectiles.length > 200` tắt ngầm `lightmapRt`, gỡ `BiomePostFxPipeline` và gán giả `activeLightCount = 45` trong Stress Test, đồng thời đặt `lightmapRt` ở `depth = 780` (`MULTIPLY`) làm tối sẫm các vùng cảnh báo đỏ `telegraphGraphics` (`depth 15`), đạn quái (`depth 42`), số sát thương (`depth 80`) và vòng hitbox `F4` (`depth 90`) xuống ~25% độ sáng → Đã xóa bỏ nhánh bypass `isHeavySwarm`, giữ nguyên `lightmapRt` + `BiomePostFxPipeline` hoạt động thực sự trong Stress Test (vẽ đủ 48 nguồn sáng động ở `60.0 FPS`), chuyển `lightmapRt` về `depth = 34` và nâng `telegraphGraphics` lên `depth = 38` để mọi tín hiệu nguy hiểm, đạn, hiệu ứng hạt, số sát thương và hitbox luôn sáng rõ 100% trên nền tối.
  - Phát hiện `bakeWallTile` và `bakePillarTile` vẽ viền tối `#141019` bao kín cả 4 cạnh của từng ô lẻ bất kể bitmask `mask`, trụ `2×2` bị tách thành 4 khối vuông có 4 chấm ngọc lục bảo riêng rẽ, các ô bề mặt (`water`, `lava`, `poison_swamp`, `oil`, `ice`, `grass`) bị bo góc tách rời nhau và vũng dầu `oil` đen đặc như hố thủng → Đã sửa autotiling tường/trụ nối liền mạch qua các cạnh tiếp giáp (`hasN/E/S/W`), gom tâm trụ `2×2` thành 1 biểu tượng cổ ngữ duy nhất ở giao điểm, bổ sung `getSurfaceAutotileMask(tx, ty)` + `TextureBaker.drawSurfaceTile()` nối liền các hồ bề mặt cùng loại và tạo ánh tím dầu hắc rõ nét cho `oil`.
  - Phát hiện hàm kẹp biên cứng `TILE_SIZE + radius` trong `ArenaMap.resolveCircleCollision` và `checkProjectileWallHit` chặn người chơi và đạn đi vào ô tường nứt bí mật `'cracked_wall'` tại `(18, 0)` ngay cả sau khi đã nổ thông thành `'floor'` → Đã kiểm tra tính đặc (`isSolidTile`) của ô biên trước khi kẹp và rớt thưởng (`gold` + `energy`) khi phá vỡ tường bí mật.
  - Phát hiện hạ cấu hình đồ họa (`G`) không cắt giảm các decal đã vẽ vượt `budget.maxDecals` hay thu phóng `lightmapRt` theo `budget.lightmapScale`, `teammateFxOpacity = 0.7` chưa áp dụng cho đạn của P2–P4, đạn Stress Test bị co nhỏ khi resize `1080p ↔ 1440p`, chấm trạng thái nguyên tố của quái ở sát mép trên đè lên thanh HUD, đồng đội giả lập P2–P4 cầm kiếm nhưng bắn đạn, và các phép cấp phát mảng/object mỗi frame trong `stepSurfaces` / `world-sim` / `GameScene` → Đã sửa triệt để toàn bộ các lỗi trên và kiểm chứng bằng soak test 3 phút (`10.800` ticks) cùng E2E test resize & hạ cấu hình.

---

### Phase 3 — Dungeon, Vòng Lặp Lượt Chơi & Biome 1 Hoàn Chỉnh (Vertical Slice Solo) (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Sinh Tầng Procedural Theo Seed, Minimap & Fog of War (`packages/shared/src/sim/dungeon-gen.ts`):**
    - Xây dựng `generateDungeonFloor(seed, floorNumber, playerCount)` tạo đồ thị `9` phòng trên lưới `5×5`: đường chính từ `Start` tới `Portal` (Tầng 1) hoặc `Boss` (Tầng 2) tại phòng xa nhất theo BFS, xáo trộn tất định (`seeded shuffle`) các phòng đặc biệt (**Phòng Kho Báu (`treasure`)**, **Cửa Hàng (`merchant`)**, **Điện Thờ Cổ (`shrine`)**) giữa các nhánh nhưng đảm bảo ít nhất 1 phòng kề `start` là `combat`, và nối **Phòng Bí Mật (`secret`)** qua tường nứt `'cracked_wall'`.
    - Hàm `verifyDungeonConnectivity(graph)` dùng BFS xác minh 100% phòng liên thông từ phòng Khởi Đầu (kiểm chứng tự động trên `100` seed liên tiếp trong unit test).
    - Cơ chế khóa cửa sắt (`door_locked`) khi vào phòng chiến đấu/trùm, sinh các đợt quái (`room.waves`) kèm vòng triệu hồi ma thuật `0.8s`, mở cửa (`door_open`) và rơi rương thưởng khi dọn sạch phòng, lưu bền vững trạng thái rương/vật phẩm rơi/cửa hàng theo `roomId` khi di chuyển qua lại giữa các phòng, cập nhật Fog of War (`hidden` / `discovered` / `visited` / `cleared`) và Minimap góc phải trên (bấm `Tab` phóng to bản đồ tầng).
  - **14 Vũ Khí Đủ 5 Bậc Hiếm, Rương, Thương Nhân, Điện Thờ & 8 Buff Giữa Tầng (`packages/shared/src/data/game-data.ts`, `world-sim.ts`):**
    - Mở rộng kho vũ khí lên **14 vũ khí** trải đều 5 bậc hiếm (`common`, `uncommon`, `rare`, `epic`, `legendary`): `knight_sword`, `hunting_bow`, `apprentice_wand`, `thorn_staff`, `rivet_gun`, `rusty_pistol`, `scrap_shotgun`, `gale_smg`, `frost_scepter`, `tesla_coil_rifle`, `scorpion_smg`, `dragonfire_shotgun`, `jade_guandao`, `solar_staff`.
    - Rương kho báu theo bậc hiếm phát cột sáng màu tương ứng khi mở, Thương Nhân Hắc Ám bán vũ khí + Bình Máu (`health_potion`) + Giáp Tinh Luyện (`armor_upgrade` `+2` Giáp tối đa) từ `room.shopOffers` bằng Xu Vàng (`[E]`), Điện Thờ Cổ Đại cho phép dâng `25 Xu` hoặc `2 Máu` (`[E]`) để nhận phước lành (`shrineBlessingId` + `+30` Năng Lượng tối đa + Vũ khí Sử Thi/Huyền Thoại).
    - Bảng chọn **1 trong 3 Buff Giữa Tầng** khi bước qua Cổng Dịch Chuyển sang Tầng 2 với đầy đủ hiệu ứng thực thi trong `WorldSim` cho cả 8 buff (`vitality_surge`, `iron_bastion`, `arcane_wellspring`, `eagle_precision`, `ricochet_mastery`, `gale_reflex` và 2 nâng cấp kỹ năng Thiết Vệ: `vanguard_fortress` khiên 360° & `vanguard_charge` lao kích nổ sóng lửa ×2 sát thương).
  - **Đủ 6 Quái Thường Biome 1, Biến Thể Tinh Anh (Elite) & Boss Mục Vương Nấm Độc 3 Phase:**
    - Hoàn thiện đủ 6 quái Biome 1: `goblin_shooter` (Goblin Xạ Thủ), `green_slime` (Slime Xanh tách làm 2 `mini_slime` khi chết), `spore_bomber` (Nấm Nổ Độc để lại đầm độc `poison_swamp`), `wild_boar` (Heo Rừng Húc), `goblin_shaman` (Pháp Sư Goblin hồi máu đồng minh không trúng độc & bắn cầu độc), `thorn_turret` (Ụ Gai Độc cố định bắn 6 gai vòng tròn).
    - Biến thể **Elite** (`fast`, `shield`, `explosive_death`, `regen`) có hào quang vàng, kích thước `1.25×`, máu `2.2×` và rớt vật phẩm/xu giá trị cao.
    - **Boss Mục Vương Nấm Độc (`spore_king`)** đầy đủ **3 Phase**:
      - **Phase 1 (`100% → 66% HP`):** Bắn vòng 12 đạn bào tử độc xoay tròn + triệu hồi `mini_slime`.
      - **Phase 2 (`66% → 33% HP`):** Độn thổ ngầm dưới đất rồi trồi lên phát nổ AoE + 8 gai độc hướng tâm + trải đầm độc `poison_swamp` tại điểm trồi, xen kẽ bắn vòng 14 bào tử + triệu hồi `spore_bomber`.
      - **Phase 3 (`≤ 33% HP`):** Bao phủ viền phòng bằng sương độc `poison_swamp` (`applyBossPhase3ToxicBorder`), tăng tốc độ di chuyển/tấn công, bắn vòng 16 bào tử kèm chùm 3 đạn độc nhắm thẳng người chơi.
    - Màn hình tổng kết Chiến Thắng / Thất Bại hiển thị đầy đủ thống kê lượt chơi (bao gồm cả thời gian hoàn thành lượt chơi và tổng xu thu thập) cùng nút/phím tắt **Chơi Lại (`[Enter]`)**.
  - **100% Procedural Vector Art & Nâng Cấp `ArtGalleryScene` 3 Trang:**
    - Bổ sung cutout rig 8 bộ phận cho `green_slime`, `mini_slime`, `goblin_shaman`, `thorn_turret`, `merchant`, `spore_king`, sprite 14 vũ khí, 5 bậc rương đóng/mở, cửa khóa/mở, cổng dịch chuyển, tượng thần cổ đại; nâng cấp `ArtGalleryScene` lên 3 trang trưng bày (`1. Mẫu Chuẩn`, `2. Quái & Boss`, `3. Vũ Khí & Map`) với cơ chế lazy-build từng trang để giữ tốc độ resize 1440p mượt mà.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (5/5 Vitest test suites = 34 unit tests; 5/5 Playwright E2E test suites).
  - Bot E2E tự động vượt toàn bộ Tầng 1, chọn Buff qua Cổng Dịch Chuyển sang Tầng 2, tiêu diệt Boss Mục Vương Nấm Độc qua đủ 3 phase và bấm `[Enter]` khởi tạo lượt chơi mới không lỗi, giữ vững **~60.0 FPS** (`0` console errors/warnings).
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-3/`:
    - `docs/screenshots/phase-3/room-start-and-minimap-1080p.png`
    - `docs/screenshots/phase-3/minimap-tab-expanded-1080p.png`
    - `docs/screenshots/phase-3/room-combat-6-enemies-and-elite-1080p.png`
    - `docs/screenshots/phase-3/room-treasure-chest-pillar-1080p.png`
    - `docs/screenshots/phase-3/room-merchant-shop-1080p.png`
    - `docs/screenshots/phase-3/room-shrine-blessing-1080p.png`
    - `docs/screenshots/phase-3/room-secret-treasure-1080p.png`
    - `docs/screenshots/phase-3/room-portal-active-1080p.png`
    - `docs/screenshots/phase-3/modal-between-floor-buffs-1080p.png`
    - `docs/screenshots/phase-3/room-boss-muc-vuong-phase1-1080p.png`
    - `docs/screenshots/phase-3/room-boss-muc-vuong-phase3-1080p.png`
    - `docs/screenshots/phase-3/modal-victory-summary-1080p.png`
    - `docs/screenshots/phase-3/art-gallery-page2-enemies-boss-1080p.png`
    - `docs/screenshots/phase-3/art-gallery-page3-weapons-props-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 3:**
  - Phát hiện `WorldSim` chưa kết nối mảng `room.waves` và `room.shopOffers` từ `dungeon-gen.ts`, làm rơi mất trạng thái rương/vật phẩm khi quay lại phòng cũ và thiếu thực thi thực tế cho 5/8 buff tầng (`eagle_precision`, `ricochet_mastery`, `gale_reflex`, `vanguard_fortress`, `vanguard_charge`) → Đã kết nối trọn vẹn dữ liệu sinh phòng vào `WorldSim`, lưu bền vững `roomChestsByRoomId` / `roomItemsByRoomId`, bổ sung vật phẩm `armor_upgrade`, đổi 25 Xu hoặc 2 Máu tại Điện Thờ và cài đặt đầy đủ 8 buff kèm unit test kiểm chứng.
  - Phát hiện nhãn cửa Bắc/Đông (`N/E`) bị đè lên thanh Top HUD / thanh máu Boss hoặc tràn mép phải màn hình, nhãn Điện Thờ đè lên vật phẩm rơi, và hiệu ứng Chromatic Aberration ở tâm màn hình làm nhòe chữ trong bảng chọn Buff / bảng Chiến Thắng → Đã kẹp tọa độ hiển thị nhãn cửa trong vùng an toàn camera (`safeTopY..safeBottomY`, `safeLeftX..safeRightX`), tách khoảng cách vật phẩm rơi ở Điện Thờ, giới hạn Chromatic Aberration ở rìa màn hình và tắt rung chấn khi mở bảng modal.
  - Phát hiện `ArenaMap.resolveCircleCollision`, `checkProjectileWallHit` và `resolveCircleVsAABB` cấp phát đối tượng kết quả tạm trên mỗi lần gọi (gây áp lực GC trong soak test 3 phút) → Đã chuyển sang đối tượng kết quả tái sử dụng (`circleResOut`, `wallHitOut`, `circleAABBOut`) không cấp phát bộ nhớ trên đường nóng.
- **Bước tiếp theo (Phase 4):**
  - Triển khai **Phase 4 — Co-op LAN**: Host server (Colyseus) chạy simulation authoritative + phục vụ client tĩnh cùng cổng `2567`, `NetworkTransport`, client prediction + reconciliation, adaptive interpolation, lệnh `pnpm host` kèm IP LAN + mã QR, Hub nhiều người, scaling theo số người, gục/hồi sinh/linh hồn, loot instanced, ping + emote.

---

### Phase 4 — Co-op LAN (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Host Server Authoritative (`apps/server`) & Lệnh `pnpm host`:**
    - Triển khai `CoopRoom` (`apps/server/src/rooms/CoopRoom.ts`) chạy vòng lặp simulation `WorldSim` authoritative ở **60Hz** (`16.67ms`) và phát sóng gói tin trạng thái đã lượng tử hóa (`encodeWorldSnapshot`, tọa độ `1/16` đơn vị, góc `1 byte` `0..255`, sinh loạt đạn tất định qua sự kiện `bullet_volley_spawned` kèm `seed` thay vì đồng bộ từng viên đạn mỗi tick) ở **30Hz** (`33.33ms`), giữ băng thông **≤ ~12–24 KB/s/client** (dưới ngưỡng `30 KB/s`).
    - Phục vụ trực tiếp bản build tĩnh của `apps/client/dist` trên cùng cổng `2567` với WebSocket Colyseus (`apps/server/src/index.ts`), hỗ trợ tự động vào thẳng phòng Hub khi truy cập địa chỉ gốc `http://<IP-LAN>:2567/`, tự động dò tìm toàn bộ địa chỉ IPv4 LAN hợp lệ qua `os.networkInterfaces()` (`/api/host-info`, loại bỏ loopback và dải ảo WSL/Docker/Hyper-V), và bổ sung script `pnpm host` tự động build + khởi chạy Host kèm bảng hướng dẫn kết nối LAN trong terminal.
  - **`NetworkTransport`, Client Prediction, Cosmetic Hit Prediction, Adaptive Interpolation & Giả Lập Mạng Wi-Fi (`packages/shared/src/protocol/`):**
    - Triển khai `NetworkTransport` (`network-transport.ts`) tuân thủ `ITransport`: dự đoán phía client (Client-Side Prediction) cho di chuyển (cả khi sống và ở trạng thái Linh Hồn) + Dash ở 0ms độ trễ, đối chiếu mượt (Smooth Reconciliation) theo cấp số nhân không giật hình khi nhận gói tin 30Hz từ Host, nội suy thực thể thích ứng (Adaptive Entity Interpolation) tự động co giãn độ trễ đệm trong khoảng **50–100ms** dựa trên jitter thực tế, và **dự đoán va chạm đạn thẩm mỹ phía client (`stepClientProjectilesCosmetic`)** tạo tia lửa + nháy sáng quái tức thì khi đạn chạm mục tiêu trong khi chờ Host xác nhận sát thương chuẩn.
    - Triển khai bộ giả lập mạng `WifiSimulator` (`wifi-sim.ts`) tích hợp phím tắt `F9` trên client với 4 cấu hình: `off` (`0ms`), `good` (`10ms ± 2ms`, `0%` loss), `normal` (`30ms ± 8ms`, `0.3%` loss), `bad` (`80ms ± 20ms`, `2%` loss + spike `300ms`) và phím `F10` kích hoạt spike thủ công.
  - **Mã QR Procedural Không Phụ Thuộc & Sảnh Doanh Trại (`Hub`), Chọn 5 Nhân Vật, Reconnect 30s:**
    - Tự cài đặt bộ sinh ma trận QR Code chuẩn ISO/IEC 18004 (Version 2–4, Byte mode, Reed-Solomon GF(256) ECC Level L, tự chọn mask tối ưu) hoàn toàn bằng TypeScript thuần tại `packages/shared/src/core/qr.ts` và vẽ trực tiếp lên `Phaser.GameObjects.Graphics`.
    - Xây dựng Sảnh **Doanh Trại (`Hub`)** cho 1–4 người chơi: 5 tượng nhân vật (**Thiết Vệ**, **Liệp Ưng**, **Lam Hỏa**, **Mộc Linh**, **Bánh Răng**) kèm bộ kỹ năng riêng, công tắc **Trùng NV: TẮT/BẬT** (mặc định **TẮT** theo đặc tả, tự động gán nhân vật chưa trùng khi người chơi mới vào phòng), nút **Sẵn Sàng (`[V]`)**, bảng mời Co-op LAN (`[I]`) hiển thị IP LAN + mã QR + nút **Sao chép link mời** + nút **Đuổi (`Kick`)** cho Host, kệ 4 vũ khí thử nghiệm miễn phí, bù nhìn tập luyện, và ô nhập **Tên nhân vật** + **IP LAN** thủ công tại `MenuScene`.
    - Chặn người chơi mới tham gia giữa lúc đội đang chiến đấu trong hầm ngục (chỉ cho phép vào ở Sảnh Chờ `Hub` hoặc giữa các tầng `buff_choice`); hỗ trợ tự động kết nối lại (**Reconnect 30s**) bằng `reconnectToken` lưu trong `sessionStorage` giữ nguyên nhân vật, vũ khí, máu/giáp và vàng; xử lý **Host ngắt kết nối** đưa toàn bộ Client về `MenuScene` kèm thông báo tiếng Việt rõ ràng.
  - **Cơ Chế Gameplay Co-op 1–4 Người (`packages/shared/src/sim/world-sim.ts` & `GameScene.ts`):**
    - **Scaling 1–4P & Cơ chế Boss 3–4P:** Tăng máu và số lượng quái mỗi đợt theo bảng `COOP_SCALING` (Máu quái: `1P: 1.0x`, `2P: 1.4x`, `3P: 1.8x`, `4P: 2.2x`; Máu Boss: `1P: 1.0x`, `2P: 1.9x`, `3P: 2.8x`, `4P: 3.7x`); riêng tổ đội 3–4 người khi gặp Boss **Mục Vương Nấm Độc** xuất hiện thêm 2 **Nấm Hộ Vệ (`spore_guardian`)** tạo khiên giảm 65% sát thương lên Boss cho tới khi đồng đội phối hợp phá hủy cả 2 nấm.
    - **Gục Ngã (`Downed`) → Cứu Dậy (`Revive`) → Linh Hồn (`Ghost`):** Khi HP về 0 mà còn đồng đội sống, người chơi vào trạng thái **Gục Ngã (20s)** có thể bò chậm; đồng đội đứng gần giữ `[E]` trong **2.5s** (riêng **Mộc Linh** cứu nhanh gấp đôi trong **1.25s** hoặc kích hoạt kỹ năng **Cây Thiêng Cổ Thụ** hồi sinh tức thì toàn bộ đồng đội gục trong vùng sáng) để cứu dậy với 2 HP + 1.5s bất tử. Hết 20s chuyển sang **Linh Hồn (`Ghost`)** và tự động hồi sinh với **50% HP** khi đồng đội dọn sạch phòng.
    - **Chiến Lợi Phẩm Instanced, Chia Sẻ Vũ Khí (`[X]`), Ping Ngữ Cảnh (`[Z]` / Chuột Giữa) & Emote (`[1..4]`):** Mở rương và nhặt cầu năng lượng/xu được phân phối riêng (instanced) cho từng người chơi; bấm `[X]` vứt vũ khí đang cầm ra đất cho đồng đội nhặt; bấm `[Z]` hoặc chuột giữa để phát Ping ngữ cảnh (`Tập trung đánh!`, `Vật phẩm ở đây!`, `Cứu đồng đội!`, `Di chuyển tới đây!`); bấm `[1..4]` hiện bong bóng biểu cảm nhanh; tự động dịch chuyển đồng đội còn ở ngoài vào phòng chiến đấu/trùm khi khóa cửa; bảng HUD đồng đội bên trái hiển thị máu, trạng thái và **ping từng người** kèm cảnh báo vàng `⚠` khi `ping > 100ms` và mũi tên chỉ hướng đồng đội ngoài màn hình.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (6/6 Vitest test suites = 42 unit tests; 6/6 Playwright E2E test suites).
  - Kiểm thử E2E `tests/e2e/phase4.spec.ts` kết nối **4 trình duyệt độc lập qua địa chỉ IPv4 LAN thực của máy (`192.168.12.103:2567`)**: vào Hub chọn 4 nhân vật khác nhau, kiểm chứng chặn chọn trùng nhân vật mặc định, kiểm chứng kết nối qua link mời `?join=` lẫn URL LAN gốc `/`, phát Emote + Ping, bật cấu hình **Wi-Fi tệ (`bad` + spike `300ms`)** kiểm chứng di chuyển mượt không giật lùi, băng thông đạt **≤ 24 KB/s/client** (mục tiêu `≤ 30 KB/s`), Host giữ vững **~60 FPS** ở `1080p High`, kiểm chứng Gục Ngã & Hồi Sinh, Reconnect 30s, cùng vượt Tầng 1 và xử lý Host thoát phòng (`0` console errors/warnings).
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-4/`:
    - `docs/screenshots/phase-4/hub-4p-qr-1080p.png`
    - `docs/screenshots/phase-4/coop-combat-4p-1080p.png`
    - `docs/screenshots/phase-4/coop-downed-revive-1080p.png`
    - `docs/screenshots/phase-4/menu-host-disconnect-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 4:**
  - Phát hiện `enterHub()` dùng chung layout phòng `start` khiến mặt đất Doanh Trại có các vũng dung nham/đầm độc/dầu và cột đá che khuất tượng nhân vật, đồng thời nhãn phụ của tượng thứ 5 (`Bánh Răng`) chạm mép trái bảng mời Co-op LAN → Đã bổ sung `ArenaMap.clearInteriorForHub()` làm sạch mặt sàn Doanh Trại, dời 5 tượng nhân vật sang trái (`cx - 355..cx + 5`, lệch tầng `y = cy - 96` và `cy - 182`) cách biệt hoàn toàn với bảng mời và xếp kệ 4 vũ khí thử nghiệm theo lưới 2×2 không chồng chữ.
  - Phát hiện khi dịch chuyển 4 người chơi qua phòng mới (`enterRoom`), `remotePlayerSamples` trong `NetworkTransport` còn giữ mẫu tọa độ phòng cũ gây trượt vị trí trong 100ms đầu, nhãn tên người chơi chồng lên nhau hoặc chạm thanh Top HUD khi áp sát tường Bắc → Đã xóa bộ đệm mẫu nội suy khi đổi phòng (`roomChanged`), bố trí đội hình xuất hiện 4 người theo lưới 2×2 rộng rãi (`[-95, -48]`, `[35, -48]`, `[-95, 52]`, `[35, 52]`) và tự động lật nhãn tên xuống dưới chân nhân vật khi người chơi tiến sát tường trên (`y - 26 < safeTopY`).
  - Phát hiện bản cài đặt đầu tiên còn đồng bộ mảng từng viên đạn trong mỗi snapshot 30Hz thay vì sinh loạt đạn tất định theo `seed` + dự đoán va chạm thẩm mỹ phía client, để mặc định `allowDuplicateCharacters = true` và chưa chặn người chơi mới vào giữa lúc đang đánh tầng hầm ngục → Đã chuyển sang phát sự kiện `bullet_volley_spawned` kèm `seed` kết hợp `spawnDeterministicVolley` và `stepClientProjectilesCosmetic` trên client (loại bỏ hoàn toàn đồng bộ mảng đạn mỗi tick), đặt mặc định `allowDuplicateCharacters = false` và chặn join mới khi đội đang trong trận chiến.
  - Phát hiện khi chạy đồng thời 4 trình duyệt 1080p trên cùng 1 máy trong Playwright E2E, bộ giám sát `autoQuality` hiểu nhầm độ trễ khởi tạo tab phụ thành tụt FPS và hạ chất lượng đồ họa của Host xuống `THẤP` → Đã giới hạn `autoQuality` chỉ tự hạ cấp ở chế độ `solo` và bỏ qua các frame khi tab bị ẩn (`document.hidden`).
- **Checklist Kiểm Thử Thủ Công Trên 2+ Máy Thật Qua Mạng LAN (Manual Multi-Machine LAN Checklist):**
  - [ ] **Bước 1 — Khởi chạy Host:** Trên Máy 1 (Host), chạy lệnh `pnpm host` (hoặc `AshenPact-Host.exe` ở Phase 8). Xác nhận terminal in rõ danh sách URL IPv4 LAN (ví dụ `http://192.168.1.x:2567/?coop=host`) và Windows Firewall đã cho phép cổng TCP `2567` (Private/Public network).
  - [ ] **Bước 2 — Kết nối từ Máy 2..4 / Điện thoại / Laptop cùng Wi-Fi:** Trên Máy 2 (và Máy 3, 4), quét mã QR hiển thị trên màn hình Doanh Trại của Máy 1 hoặc nhập địa chỉ `http://<IP-LAN-Máy-1>:2567` vào trình duyệt Chrome/Edge/Firefox. Xác nhận vào thẳng phòng Doanh Trại cùng Máy 1 trong `< 2 giây`.
  - [ ] **Bước 3 — Kiểm tra Sảnh Doanh Trại & Chọn Nhân Vật:** Mỗi máy chọn 1 bức tượng nhân vật bằng phím `[E]`, thử bật/tắt **Trùng NV**, thử nhặt vũ khí trên kệ thử nghiệm, bắn bù nhìn tập luyện, bấm `[1..4]` phát Emote, bấm `[Z]` phát Ping và bấm `[V]` Sẵn Sàng.
  - [ ] **Bước 4 — Kiểm tra Độ Trễ, Ping HUD & Chuyển Phòng:** Bước vào Cổng Khởi Hành sang Tầng 1. Kiểm tra bảng đồng đội góc trái trên hiển thị đúng số `ms` ping của từng máy (cảnh báo vàng `⚠` nếu `> 100ms`), di chuyển và bắn không có cảm giác trễ tay trên máy Client, và khi 1 máy bước vào phòng Giao Chiến thì các máy còn ở ngoài tự động được dịch chuyển vào cùng phòng.
  - [ ] **Bước 5 — Kiểm tra Gục Ngã / Cứu Dậy / Chia Sẻ Vũ Khí / Reconnect 30s:** Để 1 máy bị quái đánh gục (`GỤC NGÃ`), máy đồng đội đến gần giữ `[E]` cứu dậy; thử bấm `[X]` vứt vũ khí cho máy kia nhặt; thử bấm `F5` (tải lại trang) trên Máy 2 và xác nhận tự động kết nối lại đúng vị trí + giữ nguyên vũ khí trong vòng 30 giây.
- **Bước tiếp theo (Phase 5):**
  - Triển khai **Phase 5 — 5 Nhân Vật, Hệ Nguyên Tố & Synergy**: Hoàn thiện animation/VFX/SFX riêng cho cả 5 nhân vật, 2 nâng cấp mỗi kỹ năng, đầy đủ 6 phản ứng nguyên tố + Team Combo, preview kỹ năng ở Hub và công cụ Balance Harness headless xuất `docs/balance-report.md`.



