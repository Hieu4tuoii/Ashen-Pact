# NHẬT KÝ TIẾN ĐỘ DỰ ÁN (PROGRESS.md) — ASHEN PACT

## 1. Tóm Tắt Kế Hoạch Toàn Bộ 9 Phase & Các Giả Định Kỹ Thuật

### 1.1 Lộ trình 9 Phase (Phase 0 → Phase 8)
1. **Phase 0 — Nền móng & Thiết kế (ĐÃ HOÀN THÀNH ✅):** Thiết lập monorepo `pnpm` (`apps/client`, `apps/server`, `packages/shared`), TS strict, ESLint, Prettier, Vitest, Playwright, bộ tài liệu sống `docs/`, thư viện vẽ procedural vector (`palette`, `primitives`, `outlined()`, `TextureBaker` theo DPR, `CutoutRig`), nhân vật mẫu **Thiết Vệ** + quái mẫu **Goblin Xạ Thủ**, scene `ArtGallery`, khung Phaser scenes + Colyseus hello room + `window.__GAME_DEBUG__`.
2. **Phase 1 — Core Gameplay & Game Feel (ĐÃ HOÀN THÀNH ✅):** Vòng lặp simulation 60Hz trong `packages/shared` + `LocalTransport`, di chuyển gia tốc, dash i-frame, camera lookahead, 4 vũ khí mẫu, 3 quái mẫu + AI/telegraph, spatial hash, hit-stop, screen shake, damage popup, ZzFX.
3. **Phase 2 — Pipeline Hình ảnh & Tương tác Map (ĐÃ HOÀN THÀNH ✅):** Tilemap procedural + autotile, lightmap động + bloom/vignette, particle/decal pool, đồ vỡ/thùng nổ, bề mặt tương tác nguyên tố, stress test 60 FPS (4P + 80 quái + 600 đạn).
4. **Phase 3 — Dungeon, Vòng lặp lượt chơi & Biome 1 hoàn chỉnh (ĐÃ HOÀN THÀNH ✅):** Sinh tầng procedural có kiểm chứng liên thông, minimap + fog of war, 14 vũ khí, rương/thương nhân/tượng thần/phòng bí mật, toàn bộ quái + Elite Biome 1, Boss **Mục Vương Nấm Độc** 3 phase, màn hình thắng/thua/kết quả, bot E2E tự vượt tầng & hạ Boss.
5. **Phase 4 — Co-op LAN (ĐÃ HOÀN THÀNH ✅):** Server authoritative Colyseus phục vụ tĩnh + WebSocket cùng cổng `2567`, LAN IP + QR code, `NetworkTransport`, client prediction + reconciliation, adaptive interpolation, deterministic bullet spawn, mô phỏng mạng Wi-Fi kém, E2E 4 client qua IP LAN thực.
6. **Phase 5 — 5 Nhân vật, Hệ Nguyên tố & Synergy (ĐÃ HOÀN THÀNH ✅):** Hoàn thiện Thiết Vệ, Liệp Ưng, Lam Hỏa, Mộc Linh, Bánh Răng kèm nâng cấp skill, 6 phản ứng nguyên tố + Team Combo, công cụ Balance Harness headless xuất `docs/balance-report.md`.
7. **Phase 6 — Biome 2 & 3 + Boss (ĐÃ HOÀN THÀNH ✅):** Hoàn thiện Hầm Băng Vĩnh Cửu (**Băng Hậu Kryssa**) và Lò Rèn Dung Nham (**Titan Lò Rèn**), đủ 24 vũ khí (kèm 2 vũ khí Co-op), câu đố 2 tấm áp lực, băng chuyền, vực thẳm, lồng băng & 2 lõi năng lượng.
8. **Phase 7 — UI/UX & Âm thanh hoàn thiện (ĐÃ HOÀN THÀNH ✅):** Menu động trên nền lửa trại 5 nhân vật, HUD vector hoàn chỉnh (thanh máu phụ tụt trễ, thẻ đồng đội Co-op, thẻ kỹ năng/dash, so sánh vũ khí dưới đất, tạm dừng `[Esc]`, Iris transition), Settings đầy đủ lưu `localStorage`, bảng vinh danh 4 danh hiệu MVP, đa ngôn ngữ `vi`/`en` (404 khóa 100% đồng bộ), 47 preset SFX định vị 2D + 7 bản nhạc nền động 2 lớp khám phá/chiến đấu.
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

---

### Phase 5 — 5 Nhân Vật, Hệ Nguyên Tố & Synergy (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **5 Nhân Vật Hoàn Chỉnh, 10 Nâng Cấp Kỹ Năng & Tương Tác Độc Lập / Co-op (`packages/shared/src/data/characters.ts`, `floor-buffs.ts`, `world-sim.ts`):**
    1. **Thiết Vệ (`vanguard`) — Tank / Bảo Hộ Tuyến Đầu:**
       - Nội tại **Ý Chí Thép**: Giáp bắt đầu hồi sau `2.0s` (thay vì `3.5s`); mỗi viên đạn chặn bằng kỹ năng hồi `+1 Năng lượng`.
       - Kỹ năng `[Q]` **Tường Khiên Hồng Ngọc**: Dựng khiên bán nguyệt `120°` phía trước trong `4s`, chặn và tích trữ đạn địch rồi phóng ngược sóng xung kích theo số đạn chặn được; khiên tự động mở đòn chém cận chiến đầu tiên thành nhát chém kiếm khí tầm xa `200u`.
       - **Synergy Co-op:** Đạn đồng minh và đạn của **Trụ Tesla** bắn xuyên qua khiên từ phía sau được cường hóa **+30% sát thương** và **+1 xuyên mục tiêu**.
       - **2 Nâng cấp:** `(1) Pháo Đài (vanguard_fortress)` mở rộng khiên thành vòm 360°; `(2) Xung Phong (vanguard_charge)` tái kích hoạt kỹ năng để lao húc làm choáng `1.2s`.
    2. **Liệp Ưng (`ranger`) — Sát Thương / Đánh Dấu:**
       - Nội tại **Mắt Ưng**: Sát thương tăng theo khoảng cách tới mục tiêu (tối đa **+30%** ở tầm xa) và **+10% tỉ lệ chí mạng** cố định.
       - Kỹ năng `[Q]` **Mũi Tên Săn Mồi**: Lộn nhào về sau (`0.25s` i-frame) đồng thời bắn mũi tên xuyên thấu cực mạnh gắn **Đánh Dấu (`marked`)** lên quái trúng đòn trong `6s`.
       - **Synergy Co-op:** Mục tiêu bị **Đánh Dấu** nhận **+25% sát thương từ cả đội**, lộ vị trí xuyên sương mù, bị **Trụ Tesla** ưu tiên khóa mục tiêu, và rơi thêm cầu năng lượng cho toàn đội khi bị hạ.
       - **2 Nâng cấp:** `(1) Mưa Tên (ranger_arrow_rain)` bắn chùm 3 mũi tên hình nón đánh dấu nhiều mục tiêu; `(2) Chuỗi Con Mồi (ranger_prey_chain)` mục tiêu bị đánh dấu lan truyền **30% sát thương** sang tối đa 3 quái lân cận.
    3. **Lam Hỏa (`elementalist`) — Khống Chế / Phản Ứng Nguyên Tố:**
       - Nội tại **Vòng Xoay Nguyên Tố**: Tự động xoay vòng trạng thái **Lửa (`burn`) → Băng (`chill`) → Sét (`shock`)** sau mỗi lần dùng kỹ năng; đạn thường áp hiệu ứng của nguyên tố hiện hành.
       - Kỹ năng `[Q]` **Cầu Nguyên Tố**: Ném quả cầu nổ thành **Vùng Nguyên Tố (`skillZones`)** tồn tại `5s` gây sát thương và áp nguyên tố theo chu kỳ.
       - **Synergy Co-op:** Đạn của mọi đồng minh (và Trụ Tesla) bay ngang qua vùng nguyên tố đều được **tẩm nguyên tố của vùng đó**, giúp kích nổ phản ứng nguyên tố và **Đồng Đội Combo** liên hoàn.
       - **2 Nâng cấp:** `(1) Hố Đen Nguyên Tố (elementalist_vortex)` hút quái xung quanh vào tâm vùng nguyên tố; `(2) Song Nguyên Tố (elementalist_dual)` vùng chứa đồng thời 2 nguyên tố kế tiếp nhau, tự động kích nổ phản ứng ngay khi chạm mục tiêu.
    4. **Mộc Linh (`druid`) — Hỗ Trợ / Hồi Phục:**
       - Nội tại **Hạt Giống Sự Sống**: Quái bị hạ có **15%** rơi hạt mầm xanh (`life_seed`) tự bay về người chơi ít máu nhất hồi **+1 HP**; tốc độ cứu đồng đội gục nhanh gấp đôi (**1.25s** thay vì `2.5s`).
       - Kỹ năng `[Q]` **Cây Thiêng Cổ Thụ**: Triệu hồi thực thể **Cây Thiêng (`sacred_tree`)** tồn tại `6s` với hào quang hồi **+1 HP mỗi 2s** (tối đa 2 HP/lần dựng), phóng rễ trói chân (`rooted`) quái xung quanh trong `1.5s`, và có thân vật lý chặn đạn + khiêu khích quái khi đi Solo.
       - **Synergy Co-op:** Trồng Cây Thiêng lên đồng đội đang gục ngã sẽ **hồi sinh tức thì** với `2 HP`; kết hợp độc tố với Lửa/Sét của đồng đội tạo **Nổ Độc** và **Tê Liệt**.
       - **2 Nâng cấp:** `(1) Rễ Gai Độc (druid_poison_roots)` rễ cây trói quái đồng thời áp 2 tầng Độc mỗi nhịp; `(2) Rừng Thiêng (druid_sacred_grove)` tăng bán kính vùng sáng lên `+40%` và ban **+2 Giáp tạm** cho đồng đội trong vùng.
    5. **Bánh Răng (`engineer`) — Tiện Ích / Trụ Pháo:**
       - Nội tại **Thợ Sửa**: Đồng minh trong bán kính `4 ô` quanh Kỹ Sư được tăng **+30% tốc độ hồi giáp**; có thể sửa và kích hoạt **Cổ Máy Cổ Đại (`ancient_mechanism`)** trên bản đồ thành **Trụ Cổ Đại (`ancient_turret`)** bắn chi viện cho cả đội.
       - Kỹ năng `[Q]` **Trụ Pháo Tesla**: Đặt **Trụ Tesla (`tesla_turret`)** tồn tại `10s`, tự động bắn đạn phóng điện dây chuyền và ưu tiên mục tiêu bị **Liệp Ưng Đánh Dấu**.
       - **Synergy Co-op:** Đồng minh bắn trúng Trụ Tesla sẽ **nạp điện (`charge`)** làm trụ bắn nhanh hơn; khi đạt **100% điện tích**, trụ phát nổ **Xung EMP (`emp_blast`)** gây sát thương diện rộng, làm choáng quái `1.5s` và xóa sạch đạn địch trong bán kính nổ (kèm ZzFX preset `emp_blast`).
       - **2 Nâng cấp:** `(1) Trụ Kép (engineer_twin_turrets)` đặt tối đa 2 trụ cùng lúc (mỗi trụ 70% sát thương); `(2) Tự Hủy (engineer_self_destruct)` khi hết hạn hoặc bị phá hủy, trụ lao tới quái gần nhất phát nổ lửa diện rộng.
  - **Đầy Đủ 6 Phản Ứng Nguyên Tố & Cơ Chế Đồng Đội Combo (`Team Combo`):**
    - Cài đặt trọn vẹn 6 phản ứng nguyên tố trong `WorldSim` + bảng định nghĩa `ELEMENTAL_REACTIONS` (`packages/shared/src/data/elements.ts`):
      1. **Hơi Nước (`vaporize` — Cháy + Lạnh/Đóng Băng):** Nổ sát thương tức thì (`×2` cảm nhận / `+140%` burst) + mù hơi nước `3s`.
      2. **Vỡ Băng (`shatter` — Đóng Băng + Đòn Nặng/Chí Mạng/Cận Chiến):** Gây **+50% sát thương** lên mục tiêu đóng băng và bắn mảnh băng sát thương lan `76u`.
      3. **Siêu Dẫn (`superconduct` — Lạnh/Đóng Băng + Sét):** Phá giáp làm mục tiêu nhận thêm **+30% sát thương từ mọi nguồn** trong `6s`.
      4. **Nổ Độc (`toxic_blast` — Độc + Cháy):** Kích nổ toàn bộ cộng dồn Độc thành vụ nổ AoE `96u` và lan `1 tầng Độc` sang quái xung quanh.
      5. **Tê Liệt (`paralysis` — Độc + Sét):** Choáng cứng `0.8s` và ngắt ngay lập tức đòn chuẩn bị (`telegraph` / độn thổ) của quái Tinh Anh & Boss.
      6. **Quá Tải (`overload` — Cháy + Sét):** Nổ sóng xung kích đẩy lùi mạnh `92u` và phá vỡ **18 điểm Khiên Chắn** của quái Tinh Anh.
    - **Đồng Đội Combo (`Team Combo`):** Khi người chơi A gắn nguyên tố nền (`lastElementOwnerId`) và người chơi B (`primerId !== triggerId`) kích nổ phản ứng nguyên tố, hệ thống kích hoạt **Đồng Đội Combo**: hoàn trả **+15 Năng lượng** cho cả 2 người chơi, tăng bộ đếm `teamComboCount`, phát âm thanh hợp âm `team_combo` và hiển thị popup chữ nổi vàng rực `⚡ ĐỒNG ĐỘI COMBO! +15 NL` + tên phản ứng nguyên tố.
  - **Preview Kỹ Năng & Synergy ở Hub, Trang 4 `ArtGalleryScene` & Đồng Bộ Mạng `protocol`:**
    - Khi đứng gần tượng nhân vật ở Sảnh Doanh Trại (`Hub`), hiển thị bảng **Preview Kỹ Năng & Synergy** chi tiết (Vai trò, Chỉ số, Nội tại, Kỹ năng `[Q]`, 2 Nâng cấp, Synergy Co-op).
    - Mở rộng `ArtGalleryScene` thêm **Trang 4 (`4. 5 Nhân Vật`)** trưng bày song song cả 5 nhân vật ở tỉ lệ `1.0×` và phóng đại `1.72×` kèm đầy đủ thông tin Nội tại, Kỹ năng, Nâng cấp và Synergy.
    - Đồng bộ đầy đủ `summons`, `skillZones`, `teamComboCount`, `markedTimer`, `rootedTimer`, `superconductTimer` và các sự kiện `elemental_reaction`, `summon_spawned`, `emp_blast` qua giao thức nhị phân lượng tử hóa `world-S` 30Hz mà vẫn giữ băng thông dưới ngưỡng `30 KB/s/client`.
  - **Công Cụ Headless Balance Harness (`tools/balance-harness.ts`) & Báo Cáo `docs/balance-report.md`:**
    - Xây dựng công cụ chạy **283 lượt mô phỏng** chiến đấu tự động tốc độ cao (`pnpm balance`, bao gồm cả Ma trận 5 Nhân vật × 5 Vũ khí và 5 Đội hình Co-op Synergy 2P/4P) kiểm chứng và xuất báo cáo `docs/balance-report.md` đạt **7/7 chỉ tiêu cân bằng định lượng** (mục 7.4 của đặc tả):
      1. TTK Quái thường (Biome 1, VK khởi đầu): TB **0.89s** (`0.59s – 1.12s`, mục tiêu `0.5s – 1.5s`) — `✅ ĐẠT`
      2. Thời lượng 1 Phòng chiến đấu (1–4P): TB **47.0s** (`42.6s – 50.2s`, mục tiêu `30s – 60s`) — `✅ ĐẠT`
      3. Thời lượng hạ Boss Biome 1 (1P vs 4P): **1P: 101.3s · 4P: 111.6s**, lệch **±10.2%** (mục tiêu `90s – 150s`, lệch `≤ ±20%`) — `✅ ĐẠT`
      4. Số đòn chịu được trước khi gục (WorldSim): **6 – 10 đòn** (`6, 7, 9, 9, 10 đòn`, mục tiêu `6 – 10 đòn`) — `✅ ĐẠT`
      5. Độ lệch DPS Solo 3 NV sát thương & Solo thắng Boss: Lệch **±10.6%** (`≤ ±15%`), **5/5 nhân vật Solo thắng Boss Biome 1 cùng mức HP (100%)** — `✅ ĐẠT`
      6. Uptime Kỹ năng chủ động trong giao tranh: TB **52.9%** (`44.4% – 57.8%`, mục tiêu `40% – 60%`) — `✅ ĐẠT`
      7. Độ khó tăng giữa các Biome (Biome 1 → 2 → 3): **+25%** mỗi Biome — `✅ ĐẠT`
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) và `pnpm balance` PASS 100% (7/7 Vitest test suites = 51 unit tests; 7/7 Playwright E2E test suites).
  - Screenshots nghiệm thu đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-5/`:
    - `docs/screenshots/phase-5/hub-5-characters-skill-preview-1080p.png`
    - `docs/screenshots/phase-5/combat-elemental-reactions-team-combo-1080p.png`
    - `docs/screenshots/phase-5/gallery-5-characters-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 5:**
  - Phát hiện nội tại khoảng cách của Liệp Ưng (`ranger`) bị nhân 2 lần (một lần tại `updateProjectiles` và một lần tại `applyDamageToEnemy`), `skillActiveTimer` chỉ được gán cho Thiết Vệ, và nâng cấp `vanguard_charge` chưa làm choáng `1.2s` hay mở nhát chém kiếm khí tầm xa `200u` → Đã bỏ nhân đôi nội tại Liệp Ưng, gán `skillActiveTimer` cho cả 5 nhân vật, bổ sung nhát chém kiếm khí `200u` khi bật Tường Khiên + choáng `1.2s` khi Xung Phong, và cho phép đạn của Trụ Tesla nhận cường hóa từ Tường Khiên Thiết Vệ (`+30%` ST, `+1` mục tiêu giật) lẫn Vùng Nguyên Tố Lam Hỏa (`+15%` ST, tẩm đơn/song nguyên tố).
  - Phát hiện phản ứng `superconduct` và `paralysis` chưa tiêu thụ trạng thái nguyên tố nền sau khi kích nổ, `superconduct` chưa phá `shieldArmor = 0`, `vaporize` chưa tạo vùng mây mù `75u` AoE, và `life_seed` chưa ưu tiên đồng đội thấp máu nhất → Đã sửa triệt để trong `WorldSim` và kiểm chứng bằng unit test chuỗi 6 phản ứng liên tiếp + chuỗi cộng hưởng 5 nhân vật đồng thời.
  - Phát hiện `tools/balance-harness.ts` dùng công thức tĩnh cho số đòn chịu được và dùng hệ số `charPaceFactor` / xóa đạn Boss trong mô phỏng Boss → Đã thay bằng mô phỏng thực tế 100% trên `WorldSim` (né đạn vuông góc + Dash i-frame, cùng mức HP Boss cho cả 5 nhân vật) và bổ sung bảng Ma trận 5 Nhân vật × 5 Vũ khí cùng bảng 5 Đội hình Co-op Synergy 2P/4P.
  - Phát hiện chữ `Chu Kỳ: Hỏa (Cháy)→Băng (Đóng Băng)` trên thanh Top HUD làm tràn chữ `Combo Đội` ở mép phải, tỷ lệ phóng đại `1.72×` trong Trang 4 `ArtGalleryScene` làm mũ nhân vật chạm dòng chữ phụ, và `DebugOverlay` dùng `removeKey(f1Key, true)` có thể làm rơi phím `F1` khi chuyển cảnh từ `MenuScene` sang `GameScene` → Đã rút gọn chỉ báo chu kỳ thành `Chu Kỳ: Lửa→Băng`, căn chỉnh lại khung rig Trang 4 `ArtGalleryScene`, thêm chống chồng lấp dọc cho popup phản ứng nguyên tố đồng thời, và chuyển phím `F1` sang listener `window` an toàn qua mọi lần chuyển cảnh.
- **Bước tiếp theo (Phase 6):**
  - Triển khai **Phase 6 — Biome 2 & 3 + Boss**: Tileset vẽ bằng code, ánh sáng, ambient, quái, Elite, cơ chế map riêng (băng trơn, băng chuyền, máy sửa được), nâng tổng vũ khí lên ~24, cùng 2 Boss **Băng Hậu Kryssa** và **Titan Lò Rèn** đầy đủ phase + cơ chế co-op.

---

### Phase 6 — Biome 2 & 3 + Boss (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Chiến Dịch 3 Biome × 2 Tầng = 6 Tầng (`Floors 1–6`) & Câu Đố 2 Tấm Áp Lực Co-op (`packages/shared/src/sim/dungeon-gen.ts`, `arena-map.ts`, `world-sim.ts`):**
    - Mở rộng `generateDungeonFloor` và `WorldSim` hỗ trợ đầy đủ 3 Biome × 2 Tầng = **6 Tầng (`1..6`)**:
      - **Biome 1 (Tầng 1–2):** Rừng Cổ Mục Nát — Boss **Mục Vương Nấm Độc (`spore_king`)** ở cuối Tầng 2.
      - **Biome 2 (Tầng 3–4):** Hầm Băng Vĩnh Cửu — Boss **Băng Hậu Kryssa (`kryssa_ice_queen`)** ở cuối Tầng 4.
      - **Biome 3 (Tầng 5–6):** Lò Rèn Dung Nham — Boss **Titan Lò Rèn (`forge_titan`)** ở cuối Tầng 6.
    - Bổ sung câu đố **2 Tấm Áp Lực Co-op (`pressurePlates` + `pushBlocks`)**: Yêu cầu 2 người chơi (hoặc 1 người chơi + 1 khối đá đẩy được `pushBlocks` / vật triệu hồi `summons` khi chơi Solo) đứng đồng thời lên 2 tấm áp lực để mở khóa Rương Kho Báu Thưởng (`coop_puzzle_solved`).
    - Bổ sung phím tắt Debug **`F8`** chuyển nhanh qua lại giữa **Biome 1 → Biome 2 → Biome 3** và hỗ trợ tham số URL `?biome=1|2|3`.
  - **Màn 2 — Hầm Băng Vĩnh Cửu (`Biome 2 — Frozen Depths`) & Boss Băng Hậu Kryssa:**
    - **Tileset, Ánh sáng & Bề mặt:** Bake 8 biến thể gạch băng tinh thể xanh thẳm, 16 biến thể tường băng & 16 biến thể trụ pha lê autotile, ánh sáng xanh lam lạnh (`0x354b68`, color grading `[0.95, 1.01, 1.06]`), hạt bông tuyết rơi & hơi thở giá băng, cùng bề mặt **Băng trơn (`ice`)**, **Nước đóng băng (`water`)** và **Vực thẳm (`chasm` — chặn di chuyển bộ nhưng cho phép đạn và quái bay đi qua)**.
    - **5 Quái thường + Biến thể Elite Biome 2 (`BIOME2_COMBAT_ENEMIES`):**
      1. **Dơi Băng (`frost_bat`):** Quái bay nhanh qua địa hình/vực, bắn chùm 2 mảnh băng gây Lạnh (`chill`).
      2. **Yeti Con (`baby_yeti`):** Trượt băng lao húc tốc độ cao gây Lạnh và đẩy lùi.
      3. **Pháp Sư Băng (`ice_mage`):** Bắn 3 cầu sương giá đồng thời đóng băng mặt sàn dưới chân mục tiêu (`freezeSurfaceInRadius`).
      4. **Golem Băng (`ice_golem`):** Giáp băng dày cầm khiên băng phía trước giảm **78% sát thương trực diện** (buộc đội hình phải bọc sườn/bắn sau lưng hoặc phá bằng Đóng Băng/Choáng).
      5. **Tinh Linh Tuyết (`snow_spirit`):** Áp sát tự kích nổ vòng sương giá `R = 64u`, đóng băng mặt đất và làm Lạnh người chơi.
    - **Boss Băng Hậu Kryssa (`kryssa_ice_queen` — 3 Phase):**
      - **Cột Pha Lê Phản Xạ (`crystal_pillar`):** Đặt 4 cột pha lê trong phòng Boss phản xạ đạn laser băng (`kryssa_ice_beam`) của Boss lẫn đạn người chơi.
      - **Phase 1 (`100% → 66% HP`):** Bắn chùm tia laser băng khúc xạ qua cột pha lê + vòng hoa băng xoay tròn (`kryssa_frost_nova`).
      - **Phase 2 (`66% → 33% HP`):** Triệu hồi 2 **Phân Thân Gương (`kryssa_clone` — `isIllusion: true`)** cùng bắn đạn — phân biệt thật/giả nhờ **chỉ bản thật mới có bóng đổ dưới chân (`groundShadow`)**.
      - **Phase 3 (`≤ 33% HP`):** Kích hoạt **Bão Tuyết (`blizzardVeilActive`)** đóng băng viền phòng + thu hẹp tầm nhìn, và tung kỹ năng Co-op **Lồng Băng Vĩnh Cửu (`ice_prison`)** nhốt 1 người chơi (đồng đội phải bắn vỡ khối `ice_prison` để giải cứu ngay lập tức).
  - **Màn 3 — Lò Rèn Dung Nham (`Biome 3 — Molten Forge`) & Boss Titan Lò Rèn:**
    - **Tileset, Ánh sáng & Băng Chuyền:** Bake 8 biến thể sàn thép đinh tán lò rèn, 16 biến thể tường/trụ thép nung đỏ autotile, ánh sáng cam rực (`0x52342c`, color grading `[1.05, 0.98, 0.94]`), hạt tàn lửa bay lên & khói tro, kênh **Dung nham (`lava`)** và **Băng chuyền cơ khí (`conveyor`)** tự động đẩy thực thể theo chiều mũi tên (có thể đảo chiều `reverseConveyorDirection`).
    - **5 Quái thường + Biến thể Elite Biome 3 (`BIOME3_COMBAT_ENEMIES`):**
      1. **Tiểu Quỷ Lửa (`fire_imp`):** Di chuyển lắt léo, bắn cầu lửa kép gây Cháy (`burn`).
      2. **Người Lùn Pháo Thủ (`dwarf_cannon`):** Bắn đạn cối dung nham phát nổ AoE và đốt cháy mặt sàn.
      3. **Golem Than (`coal_golem`):** Cận chiến hạng nặng, khi chết để lại hồ **Dung nham (`lava`)** và dầu cháy tại chỗ.
      4. **Drone Hàn (`welder_drone`):** Quái bay hỗ trợ, phóng hồ quang điện Sét và hàn **+10 Giáp Khiên (`shieldArmor`)** cho đồng minh xung quanh.
      5. **Khiên Thủ Sắt (`iron_shielder`):** Khiên thép chắn phía trước giảm **80% sát thương trực diện** và bắn đạn lửa 3 viên.
    - **Boss Titan Lò Rèn (`forge_titan` — 3 Phase):**
      - **Phase 1 (`100% → 66% HP`):** Nện búa tạo **Vòng Sóng Xung Kích (`shockwaveRings`)** lan rộng khắp phòng (người chơi dùng **Dash i-frame** lướt xuyên qua không mất máu) đồng thời **đảo chiều toàn bộ băng chuyền**, kết hợp mưa đạn dung nham.
      - **Phase 2 (`66% → 33% HP`):** Lộ **2 Lõi Năng Lượng (`forge_energy_core`)** ở hai bên sườn — đồng đội phải phối hợp phá hủy cả 2 lõi trong cửa sổ **3.0s (Co-op)** / **6.0s (Solo)** để gây quá tải làm Titan **choáng cứng `4.5s` và nhận `×1.5` sát thương** (nếu quá thời gian, lõi thứ nhất tự tái tạo 50% HP).
      - **Phase 3 (`≤ 33% HP`):** Quá nhiệt bao phủ viền phòng bằng dung nham nóng chảy (`applyBossPhase3LavaBorder`) và quét **Vòng Lửa 360° (`titan_flame_sweep`)** tốc độ cao.
  - **Mở Rộng Kho Vũ Khí Lên Đủ 24 Vũ Khí (Kèm 2 Vũ Khí Co-op Đặc Biệt):**
    - Bổ sung 10 vũ khí mới nâng tổng số lên **24 vũ khí** đủ 5 bậc hiếm (`common`, `uncommon`, `rare`, `epic`, `legendary`): `twin_pistols`, `assault_rifle`, `frost_bow`, `lightning_staff`, `shrapnel_launcher`, `berserker_axe`, `void_staff`, `prism_rifle`, `magma_cannon`, `falcon_sniper`, `thunder_hammer` và 2 vũ khí Co-op:
      1. **Súng Hạt Giống (`seed_gun`):** Đạn nảy mầm thành **Hoa Sinh Mệnh (`life_blossom`)** hồi máu/giáp cho đồng đội đứng gần và phóng phấn độc lên quái.
      2. **Trượng Liên Kết (`tether_staff`):** Tạo **Tia Năng Lượng Liên Kết (`tetherBeams`)** nối giữa người cầm và đồng đội gần nhất (hoặc trụ/vật triệu hồi khi đi Solo), gây sát thương Sét + Cháy liên tục cho mọi kẻ địch đi cắt ngang tia.
  - **Nâng Cấp `ArtGalleryScene` 5 Trang & Công Cụ Balance Harness Cho Cả 3 Boss:**
    - Mở rộng `ArtGalleryScene` lên 5 trang (`3. 24 Vũ Khí & Map`, `5. Biome 2 & 3` trưng bày đủ 10 quái mới + 2 Boss **Băng Hậu Kryssa** & **Titan Lò Rèn**).
    - Cập nhật `tools/balance-harness.ts` kiểm chứng mô phỏng cả 3 Boss (`spore_king`: 1P `101.3s` / 4P `111.6s` ±10.2%; `kryssa_ice_queen`: 1P `112.7s` / 4P `99.2s` ±12.0%; `forge_titan`: 1P `105.1s` / 4P `112.4s` ±6.9%) — đạt **7/7 chỉ tiêu định lượng**.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) và `pnpm balance` PASS 100% (8/8 Vitest test suites = 59 unit tests; 8/8 Playwright E2E test suites).
  - Stress test 4 người chơi + hạt lửa/khói + 80 quái + 600+ đạn tại **Biome 3 — Lò Rèn Dung Nham** giữ vững **~60 FPS** (`frameTimeMs <= 17.5ms`).
  - Screenshots nghiệm thu đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-6/`:
    - `docs/screenshots/phase-6/frozen-depths-combat-1080p.png`
    - `docs/screenshots/phase-6/boss-kryssa-ice-queen-1080p.png`
    - `docs/screenshots/phase-6/molten-forge-combat-1080p.png`
    - `docs/screenshots/phase-6/boss-forge-titan-1080p.png`
    - `docs/screenshots/phase-6/gallery-24-weapons-1080p.png`
    - `docs/screenshots/phase-6/gallery-phase6-biomes-bosses-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 6:**
  - Phát hiện toàn bộ 15 rig thực thể Biome 2 & 3 trong `apps/client/src/art/rig-defs.ts` (`frost_bat`, `baby_yeti`, `ice_mage`, `ice_golem`, `snow_spirit`, `kryssa_ice_queen`, `kryssa_clone`, `ice_prison`, `fire_imp`, `dwarf_cannon`, `coal_golem`, `welder_drone`, `iron_shielder`, `forge_energy_core`, `forge_titan`) dùng chung một hàm khuôn mẫu `buildBiomeEntityRig` vẽ hình người mặc áo choàng cầm súng lục (vi phạm `ART_GUIDE.md` về silhouette đặc trưng) → Đã thiết kế lại toàn bộ 15 rig thủ công bằng đa giác/hình học vector riêng biệt theo đúng giải phẫu và vai trò từng loài (cánh dơi băng nhọn, lông Yeti + sừng cừu, bông tuyết 8 cánh cho Tinh Linh Tuyết, vương miện 5 đỉnh + áo choàng cực quang cho Băng Hậu Kryssa, lồng băng tinh thể giam giữ đồng đội, râu tết + pháo cối cho Người Lùn Pháo Thủ, cánh quạt hover + mỏ hàn hồ quang cho Drone Hàn, trụ tụ điện plasma cho Lõi Năng Lượng, ống khói lò rèn kép + đại chùy dung nham cho Titan Lò Rèn).
  - Phát hiện vũ khí Huyền Thoại `thunder_hammer` (`Búa Lôi Thần`) có `projectileSpeed: 0` khiến 3 tia sét phóng ra khi vung búa bị đứng yên tại chỗ (`vx = 0, vy = 0`) → Đã cập nhật `projectileSpeed: 540` trong `weapons.ts` và `speed: w.projectileSpeed || 540` trong `world-sim.ts`, kèm unit test kiểm chứng vận tốc tia sét.
  - Phát hiện cờ `resultDismissed` của bảng kết quả trong `GameScene.ts` không được đặt lại về `false` khi người chơi qua tầng tiếp theo, và đồng đội Co-op (`simulatedPlayers`) chưa tỏa hơi thở lạnh ở Biome 2 → Đã tự động reset `resultDismissed = false` khi `runState` quay lại `'playing'` hoặc `'buff_choice'`, đồng thời bổ sung hạt hơi thở lạnh cho toàn bộ đồng đội Co-op còn sống tại Biome 2.
- **Bước tiếp theo (Phase 7):**
  - Triển khai **Phase 7 — UI/UX Hoàn Thiện & Âm Thanh**: Menu động trên nền lửa trại, HUD vector đánh bóng, Settings đầy đủ, màn hình kết thúc vinh danh MVP, i18n `vi`/`en`, nhạc nền động 2 lớp + âm thanh định vị.

---

### Phase 7 — UI/UX & Âm Thanh Hoàn Thiện (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Đa Ngôn Ngữ Hoàn Chỉnh `vi` / `en` (`packages/shared/src/i18n/vi.json`, `en.json`, `index.ts`):**
    - Xây dựng hệ thống đa ngôn ngữ `t(key, params)` và `setLocale('vi' | 'en')` trong `@ashen-pact/shared` với **450+ khóa chuỗi lá đồng bộ 100%** giữa tiếng Việt (`vi`) và tiếng Anh (`en`) — bao phủ toàn bộ Menu, Cài đặt, Điều khiển, Credits, HUD, Minimap, Bảng mời Co-op LAN, Biển chỉ dẫn Doanh Trại, Tượng nhân vật, Cửa phòng, Vật phẩm/Rương/Thương nhân/Điện thờ, Bảng chọn Buff giữa tầng, Tạm dừng, Kết quả lượt chơi, Bảng thống kê từng người chơi, 4 Danh hiệu MVP, 5 Nhân vật, 24 Vũ khí, 6 Phản ứng nguyên tố + Team Combo và 3 Biome/Boss.
    - Kiểm chứng tự động bằng unit test đảm bảo 0 chuỗi rỗng, 0 khóa thiếu và đồng bộ `{{param}}` tuyệt đối giữa `vi.json` và `en.json`.
  - **Menu Chính Động Trên Nền Lửa Trại Hub (`apps/client/src/scenes/MenuScene.ts`):**
    - Dựng cảnh lửa trại động ở nền Menu chính với **2 đống lửa trại bập bùng** tại `(236, 285)` và `(724, 285)` tỏa quầng sáng ấm áp (`drawCampfires`) + **26 hạt tàn lửa bay lên** (`updateEmbers`) + **5 nhân vật (`Vanguard`, `Ranger`, `Elementalist`, `Druid`, `Engineer`)** và trinh sát **Goblin** đứng canh quanh lửa trại chạy hoạt ảnh thời gian thực, bố trí so le hai bên để không chồng lấp lên nhau hay lên thanh nhập tên/IP LAN.
    - Hệ thống nút bấm vector có viền kép + hiệu ứng hover nảy nhẹ (`scale: 1.03`) + âm thanh `ui_hover` / `ui_click`: **Chơi Đơn (`Play Solo` giữ đúng tọa độ thế giới `(480, 225)` để tương thích ngược E2E Phase 0–3)**, **Tạo Phòng LAN**, **Vào Phòng LAN**, **Art Gallery**, **Đổi Anim**, **Cài Đặt (`[O]`)**, **Điều Khiển (`[K]`)**, **Credits (`[C]`)** và **Ngôn Ngữ (`[L]`: `VI` ↔ `EN`)**.
  - **Cửa Sổ Cài Đặt, Điều Khiển & Credits (`apps/client/src/ui/settings-modal.ts`, `graphics-settings.ts`):**
    - Mở rộng `GraphicsSettingsManager` lưu bền vững vào `localStorage` (`ashen_pact_graphics_settings`): Âm lượng Tổng (`masterVolume`), Nhạc nền (`musicVolume`), Hiệu ứng (`sfxVolume`), Chất lượng đồ họa (`High / Medium / Low`), Tự giảm chất lượng khi tụt FPS (`autoQuality`), Độ rung màn hình (`screenShakeIntensity`), Hiện số sát thương (`showDamageNumbers`), Độ đậm hiệu ứng đồng đội (`teammateFxOpacity`), Toàn màn hình (`fullscreen`) và Ngôn ngữ (`language: 'vi' | 'en'`), kèm nút **Khôi phục mặc định (`Reset Defaults`)**.
    - Tích hợp modal **Hướng dẫn điều khiển (`Controls`)** và modal **Credits (`CREDITS`)** ngay trên `MenuScene` lẫn trong menu **Tạm dừng (`Pause`)** của `GameScene`.
  - **HUD Vector Đánh Bóng, So Sánh Vũ Khí, Hướng Dẫn Tự Nhiên Ở Hub, Tạm Dừng & Chuyển Cảnh Iris (`apps/client/src/scenes/GameScene.ts`):**
    - **Khung Trạng Thái & Thanh Máu Phụ Tụt Trễ (`trailingHpRatio`, `trailingArmorRatio`):** Thanh HP/Giáp người chơi và thanh máu Boss phía trên trung tâm đều có lớp thanh phụ màu vàng cam tụt đuổi theo sau khi trúng đòn, kèm vạch chia 3 Phase (`66%`, `33%`) trên thanh máu Boss và sự kiện vỡ giáp (`armor_broken`).
    - **Thẻ Đồng Đội Co-op & Thẻ Kỹ Năng/Dash:** Hiển thị thẻ đồng đội bên trái với thanh HP, thanh Giáp mini, huy hiệu **`[Q✓]`** khi kỹ năng chủ động của đồng đội sẵn sàng, trạng thái Gục/Linh hồn và ping mạng; góc dưới hiển thị 2 thẻ **Kỹ năng (`[Space]`)** & **Lướt (`[Shift]`)** với lớp quét hồi chiêu trực quan và nút **`[Esc] Tạm dừng`**.
    - **Tooltip So Sánh Vũ Khí Dưới Đất (`updateWeaponComparisonCard`) & Biển Chỉ Dẫn Tự Nhiên Ở Hub:** Khi đứng gần vũ khí rơi dưới đất (`dist <= 64u`), tự động hiển thị bảng so sánh trực quan (**DPS ước tính + chênh lệch**, **Sát thương**, **Tốc bắn**, **Tiêu hao NL**, **Tỷ lệ chí mạng**, **Nguyên tố**) kèm dòng mẹo lần đầu nhặt vũ khí (`💡 Mẹo: Bạn mang tối đa 2 vũ khí...`) và ẩn nhãn nổi trùng lặp dưới đất; tại Doanh Trại (`Hub`) hiển thị biển hướng dẫn tự nhiên tại khu Tượng 5 Nhân Vật, Kệ Vũ Khí Thử Nghiệm và Bù Nhìn Tập Bắn (kèm DPS thực tế).
    - **Màn Hình Tạm Dừng (`[Esc]`) & Hiệu Ứng Chuyển Cảnh Iris (`updateIrisTransition`):** Bấm `Esc` mở lớp phủ Tạm dừng (tạm dừng simulation khi đi Solo; giữ nguyên mô phỏng thời gian thực khi đi Co-op LAN) với đầy đủ nút Tiếp tục, Cài đặt, Điều khiển, Chơi lại và Về Menu; hiệu ứng màn trập tròn **Iris Transition** khép/mở mượt mà khi bắt đầu màn và khi đổi phòng trong lúc `runState === 'playing'` (tự động dọn sạch khi mở bảng chọn Buff giữa tầng hoặc bảng Kết quả để không che khuất modal).
  - **Màn Hình Kết Thúc, Bảng Thống Kê Từng Người Chơi & Vinh Danh 4 Danh Hiệu MVP (`packages/shared/src/sim/world-sim.ts`, `GameScene.ts`):**
    - Theo dõi thống kê cá nhân từng người chơi trong `WorldSim` (`statsDamageDealt`, `statsDamageTaken`, `statsKills`, `statsRevives`, `statsElementalReactions`, `statsTeamCombos`), hiển thị **Bảng Thống Kê Chi Tiết Từng Người Chơi (`📊 THỐNG KÊ CHI TIẾT TỪNG NGƯỜI CHƠI`)** ở cột trái dưới phần tổng kết lượt chơi, và tính toán **4 danh hiệu MVP (`computeMvpAwards`)** ở cột phải trên màn hình Chiến Thắng / Thất Bại:
      1. **★ Chiến Thần Sát Thương (`damage` — Most Damage Dealt)**
      2. **★ Kẻ Săn Quái (`slayer` — Most Enemies Slain)**
      3. **★ Bậc Thầy Nguyên Tố (`elemental` — Most Elemental Reactions & Combos)**
      4. **★ Thần Y Cứu Trợ (`medic` — Most Revives & Damage Tanked)**
  - **Hệ Thống Âm Thanh Định Vị 2D & Nhạc Nền Động 2 Lớp (`apps/client/src/audio/zzfx.ts`, `music-synth.ts`):**
    - Mở rộng `ZzfxSynth` lên **47 preset SFX riêng biệt** phủ kín toàn bộ vũ khí, đòn đánh/chí mạng/hạ gục, vỡ giáp (`armor_break`), nhịp tim máu thấp (`low_hp_pulse`), gục/hồi sinh, 5 kỹ năng nhân vật, 6 phản ứng nguyên tố + Team Combo, nhặt vật phẩm/mở rương/cửa/cổng, tiếng gầm & chuyển phase Boss, và âm thanh UI (`ui_hover`, `ui_click`, `ui_victory`, `ui_defeat`).
    - Trang bị biến thiên cao độ ngẫu nhiên **`±7%`**, định vị không gian 2D (`stereo pan` + suy giảm âm lượng theo khoảng cách tới người nghe), giới hạn đồng thời **12 kênh (`MAX_CONCURRENT_VOICES = 12`)** và chống dội âm theo từng preset.
    - Xây dựng bộ tổng hợp nhạc nền động **`ProceduralMusicSynth`** gồm **7 chủ đề âm nhạc** (`menu_hub`, `biome1`, `biome2`, `biome3`, `boss_spore_king`, `boss_kryssa`, `boss_forge_titan`) với **2 lớp Khám Phá (Exploration) và Chiến Đấu (Combat)** tự động crossfade mượt (`combatMix`) theo trạng thái giao tranh thực tế trong phòng.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) và `pnpm balance` PASS 100% (9/9 Vitest test suites = 64 unit tests; 9/9 Playwright E2E test suites).
  - Screenshots nghiệm thu đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-7/`:
    - `docs/screenshots/phase-7/menu-campfire-hub-1080p.png`
    - `docs/screenshots/phase-7/menu-campfire-settings.png`
    - `docs/screenshots/phase-7/menu-settings-en-1080p.png`
    - `docs/screenshots/phase-7/iris-transition-1080p.png`
    - `docs/screenshots/phase-7/hub-guide-skill-preview-1080p.png`
    - `docs/screenshots/phase-7/hud-weapon-compare-1080p.png`
    - `docs/screenshots/phase-7/hud-weapon-compare-pause.png`
    - `docs/screenshots/phase-7/victory-mvp-awards.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 7:**
  - Phát hiện vòng tròn đen của `irisGraphics` được đặt phía trên `modalContainer` và tiếp tục chạy khi `sim.runState === 'buff_choice'`, làm che khuất bảng chọn Buff giữa tầng (`modal-between-floor-buffs-1080p.png`) → Đã chuyển `irisGraphics` xuống dưới `modalContainer` / `pauseContainer` và tự động `clear()` khi `sim.runState !== 'playing'`.
  - Phát hiện màn hình Chiến Thắng / Thất Bại (`updateModalHud`) chưa hiển thị bảng thống kê chi tiết từng người chơi (`statsDamageDealt`, `statsDamageTaken`, `statsKills`, `statsRevives`, `statsElementalReactions`, `statsTeamCombos`) và `phase7.spec.ts` gán nhầm tên trường `enemiesKilled` / `goldCollected` → Đã bổ sung bảng `📊 THỐNG KÊ CHI TIẾT TỪNG NGƯỜI CHƠI` cho 1–4 người chơi ở cột trái đối xứng với 4 thẻ MVP ở cột phải, đồng thời cập nhật `modalKey` và `phase7.spec.ts` theo đúng trường của `RunStats`.
  - Phát hiện nhiều chuỗi trong `GameScene.ts` và `combat-fx.ts` còn gắn cứng tiếng Việt khi đổi sang ngôn ngữ `'en'` → Đã bổ sung các hàm tra cứu tiện ích vào `I18nManager` (`enemyName`, `roomTypeName`, `roomTypeLabel`, `elementName`, `elementShortName`, `emoteText`, `getBuffText`) và kết nối `i18n.t(...)` cho toàn bộ HUD, Minimap, Boss bar, bảng Doanh Trại, tượng nhân vật, cửa phòng, vật phẩm, Thương Nhân, Điện Thờ, bảng chọn Buff và bảng Kết Quả.
  - Phát hiện trên `MenuScene` (`menu-campfire-hub-1080p.png`), nhân vật `Mộc Linh` ở `(195, 198)` và `Goblin` ở `(765, 198)` đè lên hai đầu thanh nhập tên/IP LAN (`x = 240..720`) và chồng nhãn tên với `Thiết Vệ` / `Lam Hỏa` → Đã bố trí lại tọa độ so le 3 tầng ở hai bên rìa (`x = 82..162` bên trái và `x = 798..878` bên phải) quanh 2 đống lửa trại `(236, 285)` và `(724, 285)`, loại bỏ hoàn toàn chồng lấp.
  - Phát hiện thẻ so sánh vũ khí dưới đất chưa hiển thị `DPS ước tính` kèm chênh lệch và mẹo nhặt vũ khí lần đầu, đồng thời nhãn nổi `[E] Tên Vũ Khí` dưới đất vẫn hiện đè gần nhân vật khi thẻ so sánh đang mở → Đã bổ sung `DPS ~... (▲/▼ ...)` + dòng mẹo `ui.tooltip.firstPickupHint` vào `updateWeaponComparisonCard` và ẩn nhãn nổi của vũ khí đang được mở bảng so sánh.
- **Bước tiếp theo (Phase 8):**
  - Triển khai **Phase 8 — Cân Bằng Cuối, Hiệu Năng, QA & Bản Phát Hành**: Soak test 20 phút, rà soát bug bash toàn diện, đóng gói `AshenPact-Host.exe` + `start-host.bat`, hoàn thiện `README.md` tiếng Việt + `CREDITS.md` + `docs/RELEASE_NOTES.md`, và gắn thẻ phát hành `v0.1.0`.

---

### Phase 8 — Cân Bằng Cuối, Hiệu Năng, QA & Bản Phát Hành `v0.1.0` (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - **Cân Bằng Số Liệu Cuối (`pnpm balance`) & Ma Trận Synergy 2P/4P (`tools/balance-harness.ts`, `docs/balance-report.md`, `docs/BALANCE.md`):**
    - Tinh chỉnh công thức mô phỏng 2P trong `tools/balance-harness.ts` phản ánh chính xác thời gian kích hoạt nội tại nguyên tố và hiệu quả dồn sát thương cộng hưởng 2 người chơi.
    - Xác nhận toàn bộ **7/7 chỉ tiêu cân bằng TTK và thời gian dọn tầng (`1P: 112.1s`, `2P: 120.7s`, `3P: 121.3s`, `4P: 127.0s`)** cũng như toàn bộ **6 tổ hợp Synergy 2P/4P (`107.6s – 142.7s`)** đều nằm gọn trong khung mục tiêu `[90s..150s]`, đạt **PASS 100%**.
    - Cập nhật báo cáo tự động `docs/balance-report.md` và tài liệu cân bằng cuối `docs/BALANCE.md` cho bản `v0.1.0`.
  - **Kiểm Thử Chịu Tải 20 Phút Co-op 4 Người (`packages/shared/test/phase8-soak-release.test.ts`) & Gia Cố Object Pool (`packages/shared/src/sim/world-sim.ts`):**
    - Bổ sung giới hạn an toàn `MAX_ACTIVE_PICKUPS = 160` trong `WorldSim.acquirePickup` (tự động thu hồi pickup cũ nhất khi vượt ngưỡng), dọn dẹp sạch trụ Súng Máy (`engineerTurrets`), mìn bẫy và đạn bay của người chơi thoát phòng trong `removeCoopPlayer`, và kiểm tra điều kiện sống sót toàn đội trước khi gọi đợt quái tiếp theo trong `spawnNextRoomWave`.
    - Xây dựng bài kiểm thử chịu tải **20 phút mô phỏng liên tục (`72,000` ticks ở `60Hz`)** với 4 người chơi Co-op liên tục xả đạn, tung kỹ năng, kích hoạt phản ứng nguyên tố, phá chướng ngại vật, vượt tầng hầm ngục và đánh Boss: xác nhận **0 giá trị `NaN`/`Infinity`**, kích thước pool đạn/pickup bị chặn cứng (`pickups.length + pickupPool.length <= 250`) và thực thi hoàn tất trong `~1.1s`.
  - **Tối Ưu Đóng Gói Production Client (`apps/client/vite.config.ts`) & QR Code ASCII Console (`packages/shared/src/core/qr.ts`, `apps/server/src/index.ts`):**
    - Tách chunk thủ công (`manualChunks`: `vendor-phaser`, `vendor-colyseus`) và cấu hình `chunkSizeWarningLimit: 1600` trong `apps/client/vite.config.ts`, giúp lệnh `pnpm build` hoàn tất sạch 100% không còn bất kỳ cảnh báo kích thước bundle nào.
    - Bổ sung hàm `renderQrAscii(text, border)` trong `packages/shared/src/core/qr.ts` sử dụng ký tự khối nửa dòng Unicode (`▀`, `▄`, `█`) để vẽ mã QR chuẩn ISO/IEC 18004 trực tiếp trên cửa sổ Console khi khởi chạy máy chủ Host (`apps/server/src/index.ts`), kèm danh sách địa chỉ IPv4 LAN và đường dẫn tham gia nhanh.
  - **Đóng Gói Bản Phát Hành Độc Lập Windows (`tools/package-release.ts` — `pnpm package:release`):**
    - Xây dựng công cụ đóng gói tự động `tools/package-release.ts` xuất ra thư mục sạch `release/AshenPact-v0.1.0-win-x64/` và bản nén `release/AshenPact-v0.1.0-win-x64.zip` bao gồm:
      - **`AshenPact-Host.exe`**: Trình khởi chạy gốc Windows x64 (biên dịch qua `.NET Framework csc.exe` tích hợp sẵn trên Windows) gắn trực tiếp tiến trình con vào **Windows Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`)** để đảm bảo khi đóng cửa sổ hoặc kết thúc `AshenPact-Host.exe`, tiến trình máy chủ Node nhúng luôn được giải phóng tức thì (0 tiến trình mồ côi).
      - **`start-host.bat`** & **`allow-firewall-port-2567.bat`**: Kịch bản khởi chạy nhanh và kịch bản mở cổng Windows Firewall (`TCP 2567`) bằng quyền Administrator.
      - **`server-bundle.cjs`**, **`runtime/node.exe`**, **`client/`** và bộ tài liệu phát hành (`README.md`, `CREDITS.md`, `docs/`).
  - **Rà Soát QA Bug Bash Toàn Diện & Bộ Tài Liệu Phát Hành (`docs/QA_CHECKLIST.md`, `README.md`, `CREDITS.md`, `docs/RELEASE_NOTES.md`):**
    - Thực hiện và ghi nhận kết quả kiểm thử toàn diện 7 nhóm hạng mục trong `docs/QA_CHECKLIST.md` (Network & Co-op Edge Cases, Collision & Physics, Boss & Progression, UI/Localization/Input, Audio & Graphics, Cross-Browser Chromium + Microsoft Edge, Packaging & Clean Folder).
    - Biên soạn đầy đủ `README.md` tiếng Việt ở thư mục gốc, `CREDITS.md` (và `docs/CREDITS.md`), cùng `docs/RELEASE_NOTES.md` cho phiên bản `v0.1.0`.
  - **Kiểm Thử E2E Bản Đóng Gói Thực Tế Đa Trình Duyệt Qua IP LAN (`tests/e2e/phase8.spec.ts`):**
    - Khởi chạy trực tiếp `AshenPact-Host.exe` từ thư mục phát hành độc lập `release/AshenPact-v0.1.0-win-x64/`, kiểm tra log Console in đúng IP LAN + khung QR ASCII, mở đồng thời **Chromium** (Host P1) và **Microsoft Edge (`msedge`)** (Client P2) kết nối qua địa chỉ IPv4 LAN thực của máy (`http://<LAN_IP>:<PORT>/`), kiểm tra đồng bộ vị trí/chiến đấu 2 người chơi, hoàn thành tầng hầm ngục + tiêu diệt Boss và chụp bộ ảnh nghiệm thu 1080p tại `docs/screenshots/phase-8/`.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`), `pnpm balance` và `pnpm package:release` PASS 100% (10/10 Vitest test suites = 67 unit tests; 10/10 Playwright E2E test suites).
  - Screenshots nghiệm thu đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-8/`:
    - `docs/screenshots/phase-8/release-hub-lan-coop-1080p.png`
    - `docs/screenshots/phase-8/release-dungeon-combat-1080p.png`
    - `docs/screenshots/phase-8/release-boss-victory-1080p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 8:**
  - Phát hiện `PreloadScene.ts`, `MenuScene.ts` và `GameScene.ts` (`getResolvedWsUrl`) kiểm tra cứng `window.location.port === '2567'`, khiến khi máy chủ Host chạy ở cổng dự phòng/tùy chỉnh (ví dụ `--port 2578`), trình duyệt khách truy cập `http://<IP_LAN>:2578/` không tự động vào thẳng Doanh Trại Co-op của Host mà rơi về Menu chính và gọi nhầm WebSocket sang cổng `2567` → Đã cập nhật logic tự động nhận diện mọi cổng máy chủ Host (bất kỳ `window.location.port` khác cổng Vite `5173`/`4173`) để tự động vào `GameScene` (`coopMode: 'join'`) và kết nối WebSocket đúng cổng trang hiện tại.
  - Phát hiện qua kiểm tra ảnh chụp màn hình `release-dungeon-combat-1080p.png` và `release-hub-lan-coop-1080p.png`: nhãn `[R] Ng.Tố: Băng (Đóng Băng)` hơi chạm vào nút `[G] Đồ Họa: CAO` trên thanh HUD trên cùng, và dòng tên người chơi `P2` trong bảng mời Doanh Trại hơi chạm vào nút `Đuổi` khi tên dài → Đã tinh chỉnh tọa độ/cỡ chữ của thanh nút HUD trên cùng (`x = 490`, `658`, `772`) và cỡ chữ dòng slot có nút `Đuổi` (`8.2px`), loại bỏ hoàn toàn chồng lấp.
- **Trạng thái dự án:**
  - Hoàn thành toàn bộ **Phase 0 → Phase 8**. Phiên bản **`v0.1.0`** đã sẵn sàng phát hành!


---

### Bản Cập Nhật Hậu Phát Hành (`Post-Release Update v0.1.0`) — Tối Ưu Ánh Sáng, Toàn Màn Hình & Luồng Qua Màn (Hoàn thành ✅)
- **Lịch sử chỉnh sửa & Cải tiến:**
  1. **Sửa lỗi nháy phím Sẵn Sàng (`[V]`) ở Sảnh Co-op & Luồng Qua Phòng / Qua Tầng / Qua Màn (`commit 90e59ff`):**
     - Tách riêng kênh lắng nghe phím `[V]` (Sẵn sàng) ở Sảnh Chờ Co-op để không bị ghi đè lặp lại giữa trạng thái `hub_ready` của client và gói tin đồng bộ từ server.
     - Tắt cờ `autoRespawnWaves` khi bắt đầu hành trình ở phòng Khởi Đầu (`start`) để cửa sang các phòng tiếp theo mở sẵn ngay từ đầu mà không tự khóa lại sau 1.5s.
     - Tự động mở bảng chọn Buff khi bước chạm vào cổng dịch chuyển cuối tầng (`portalActive`) hoặc cho phép bấm `[E]` để qua tầng / qua màn mượt mà.
  2. **Giảm hiệu ứng bóng đêm, mở rộng tầm nhìn & sửa vùng phủ bóng đêm toàn màn hình (`commit 70d9ece`):**
     - Tăng độ sáng nền (`BIOME_AMBIENT_COLORS`: Biome 1 `0x58685c`, Biome 2 `0x4c6888`, Biome 3 `0x725244`) để nhìn rõ địa hình, bẫy và quái vật hơn.
     - Mở rộng bán kính vùng sáng quanh người chơi chính (`205` → `310`), đồng đội Co-op (`165` → `250`), đuốc/tinh thể/lò rèn (`+25%`) và giảm độ tối viền `vignetteStrength` (`0.42` → `0.18`).
     - Đồng bộ tọa độ vẽ `lightmapRt` theo khung nhìn thực tế của camera, khắc phục triệt để hiện tượng phần bóng đêm chỉ phủ ~80% bên trái và bị hụt ở mép phải khi mở rộng cửa sổ.
  3. **Hiển thị Full 100% Khung Hình Trình Duyệt (`commit 38c2708`):**
     - Cập nhật `resizeViewport` trong `PreloadScene`, `MenuScene`, `GameScene` và `ArtGalleryScene` dùng `cam.setZoom(width / 960, height / 540)` để thanh HUD trên/dưới, Minimap, bản đồ và lớp ánh sáng phủ kín 100% chiều rộng và chiều cao cửa sổ trình duyệt ở mọi tỉ lệ màn hình.
  4. **Chụp lại toàn bộ lịch sử ảnh chụp màn hình (`docs/screenshots/phase-0/` → `docs/screenshots/phase-8/`):**
     - Chạy lại toàn bộ 10 bộ kiểm thử E2E (`pnpm e2e`) và cập nhật mới toàn bộ **49 ảnh chụp màn hình 1080p/1440p** từ `phase-0` đến `phase-8` để lưu trữ lịch sử trực quan phục vụ các đợt cập nhật tiếp theo.


---

## 3. Polish v0.2.0

### 3.1 Kế hoạch (13 Phase — P0 đến P12, tách P9a/P9b và P10a/P10b thành 15 chặng kiểm soát)
- **P0:** Hạ tầng kiểm chứng hình ảnh (`visual-scenes.ts`, `visual.spec.ts`, `pnpm shots`, `tools/visual-metrics.ts`, pixel-diff, `?seed=`, `?freeze=1`, `?lighting=0`, `?testHooks=1`, strip khung hình, `pnpm perf`) & Baseline (`docs/POLISH_BASELINE.md`).
- **P1:** Chế độ Debug (`debugUi`, `testHooks`, `Ctrl+Shift+D`, server gate, launcher giữ `--host`, `start-host-debug.bat`) & dọn sạch UI debug trên bản người chơi.
- **P2:** Vũ khí 2 ô (`MAX_WEAPON_SLOTS = 2`) & rơi vũ khí ra đất (`spawnDroppedWeapon`), tách vòng emote `T`, bot autoplay không lặp nhặt vũ khí.
- **P3:** Nền tảng ánh sáng trong trẻo (Full-Screen Clear Visibility, bỏ `fx_ambient_mist`, bỏ `mainPlayerVisionRadius`/`allyVisionRadius`, `ambientColor` ~0.84–0.90, `vignetteStrength = 0.0`, `blizzardVeil` không làm tối), tách `HudScene` overlay, camera zoom đồng đều `min(w/960, h/540)`.
- **P4:** Kiến trúc Map Hybrid — Bước A: Phòng chuẩn B1 (vertical slice, khóa chuẩn sau khi qua Visual Gate; chỉ dừng hỏi user nếu trượt Visual Gate sau 4 vòng) → Bước B: Nhân rộng Palette `ENV`, sàn "Tĩnh lặng giữa tâm", tường 3D 3 lớp & surface kiến trúc cho Hub/B2/B3.
- **P5:** Bản sắc kiến trúc Biome (`biome-architecture.ts`: P4 Chung & Hub, B1 rễ Bezier & nấm, B2 Sunken Astrolabe & God-rays, B3 rãnh nhiệt lưới sắt & bánh răng đồng thau) & Chậu lửa ven tường.
- **P6:** Ánh sáng & glow cho vật thể tương tác (`interactableLights` quota riêng + glow sprite `ADD` phía trên lightmap + cột sáng độ hiếm).
- **P7:** Nhãn theo khoảng cách & prompt `[E]` duy nhất (`findInteractTarget` dùng chung giữa sim và client, hysteresis ~8u, fade 120–150ms, nameplate gọn).
- **P8:** Cổng dịch chuyển tầng (shader GLSL xoáy năng lượng per-object + burst + bước vào) & cổng qua phòng (khung vòm đá + màn chắn năng lượng khóa/tan biến/dựng lên + fallback Low).
- **P9a:** UI/UX — Design system (`theme.ts`, `ui/components/`), HUD mới trong `HudScene`, popup sát thương/phản ứng gộp (`×N` trong 0.4s), chỉ báo QoL, UI scale 80–130%.
- **P9b:** UI/UX — Menu chính (HTML input overlay), Hub (bảng mời thu gọn), modal chọn buff, kết quả (bỏ nút đóng vô nghĩa), Pause (xác nhận thoát), Settings chia tab.
- **P10a:** Nhân vật Cutout 2.0 & Quái Full Rig (crossfade 0.10–0.15s, pose attack/hurt/dash/cast/downed, chớp mắt, spring secondary motion, shading 2 lớp + rim-light `-135°`, tắt `useFastComposite` ở High/Medium).
- **P10b:** FX, Phản Ứng Nguyên Tố (`BlendMode.ADD`, sóng xung kích + chữ combo gộp) & Hạt Môi Trường Trong Trẻo (đom đóm B1, tuyết tròn B2, tàn lửa nhỏ B3; đạn địch phân biệt bằng hình dạng lõi trắng + thân `#E84545` + viền `INK_DARK` 1.5u).
- **P11:** Độ khó & kịch tính — Bước 1: Harness thật không hệ số giả (`tools/bot-profile.ts` khóa trước khi tune) → Bước 2: Tune data-driven (`BIOME_SCALING`, sửa lỗi tốc bắn co-op nhân đôi, đợt quái chồng nhau, kháng CC boss, chuyển phase boss, enrage mềm sau 90s).
- **P12:** Hồi quy toàn diện, soak test 20 phút, đóng gói `v0.2.0`, review toàn nhánh (`pro`) & kết thúc nhánh (`finishing-a-development-branch`).

### 3.2 Giả định & Quy tắc Thực thi
- Thực thi trên worktree cách ly `.worktrees/polish-v0.2.0` (nhánh `polish/v0.2.0`), không commit thẳng lên `master`.
- Main Agent (Controller) chỉ điều phối, viết plan, chạy gate (test/verify/shots/metrics/perf), điều phối Task Reviewer và Visual Reviewer độc lập (`pro`), tuyệt đối không tự sửa code.
- Main Agent tự động duyệt qua phase kế tiếp khi đạt đủ Task Review + Visual Gate + Phase Gate; ở P4 Bước A chỉ dừng lại hỏi nếu trượt Visual Gate sau 4 vòng (theo yêu cầu trực tiếp của User).
- Giữ kỷ luật kiến trúc module hóa (`< 1000` dòng/file).

### 3.3 Quyết định đã khóa (theo Mục 0.6 Spec)
- **Palette:** Mở rộng nhóm màu `ENV` trầm (HSL `S ≤ 0.35`, B2 `≤ 0.40`).
- **Tầm nhìn & Sương mù:** Full-Screen Clear Visibility (xóa `fx_ambient_mist`, bỏ `mainPlayerVisionRadius`/`allyVisionRadius`, tắt vignette đen mặc định, `ambientColor` ~0.84–0.90 + lớp glow `ADD` trên lightmap).
- **Bão tuyết Boss 2 (`blizzardVeil`):** Bỏ phần làm tối, giữ hiệu ứng tuyết dày ×3 thổi xiên + color grade lạnh nhẹ (`L*` giảm ≤ 5%) + viền sương giá mỏng (`alpha ≤ 0.12`).
- **Hướng sáng:** Key light toàn cục từ góc trên-trái (`-135°`), bóng đổ về dưới-phải (`+45°`).
- **Ngữ nghĩa hình ảnh:** Hình ảnh = ngữ nghĩa sim (hazard phải là surface thật, vật cản có khối chỉ trên `wall`/`pillar`, decor trên ô đi được phải phẳng `ΔL* ≤ 10`, surface động thắng decal).
- **Vũ khí:** 2 ô (`MAX_WEAPON_SLOTS = 2`), nhặt khi đầy thì vũ khí đang cầm rơi ra đất.

### 3.4 Danh sách "Cần tôi xem" (Items Parked for User Review)
- *(Chưa có mục nào)*

### 3.5 Nhật ký thực thi Polish v0.2.0
- **Khởi động (0.1):** Đã tạo worktree `.worktrees/polish-v0.2.0` trên nhánh `polish/v0.2.0`, chép spec `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md`, cập nhật `ART_GUIDE.md`, `GDD.md`, `PHASES.md`, `PROGRESS.md`.
- **Phase P0 — Hạ tầng kiểm chứng hình ảnh & Baseline (Hoàn thành ✅):**
  - **Commits:** `9035058`, `64020db`, `576d25a`, `f61b735`, `2703b78`, `2e47ab7`.
  - **Hạ tầng đã xây dựng:**
    - `tools/visual-metrics.ts` (+ 12 unit tests trong `packages/shared/src/__tests__/visual-metrics.test.ts`): Đo CIE $L^*$ chuẩn D65, $\Delta L^* = p95 - p5$, độ bão hòa HSL $S$, độ tương phản với `INK_DARK`, `cornerRetentionRatio`, `brazierLightPoolDeltaL`, so sánh điểm ảnh `pixelmatch`, chuyển ảnh xám `b3-combat-grayscale.png` và ghép dải 8 frame `-strip.png`.
    - Client hooks (`url-params.ts`, `GameScene`, `MenuScene`, `ArtGalleryScene`, `LightingPipeline`): Hỗ trợ `?seed=<number>`, `?freeze=1` (khóa time/sway/flicker/particles tất định sau 45 frames), `?lighting=0` + `window.__GAME_SET_LIGHTING__(enabled)` (tắt lightmap & PostFX để đo sàn unlit thuần), `?testHooks=1`.
    - Bộ 58 cảnh chuẩn (`tests/e2e/helpers/visual-scenes.ts`, `tests/e2e/visual.spec.ts`), CLI `pnpm shots` (`tools/run-shots.ts`) và benchmark GPU phần cứng `pnpm perf` (`tools/run-perf.ts`).
  - **Kiểm chứng tính tất định (`pnpm shots -- --phase p0 --label baseline --verify-freeze`):**
    - Chụp thành công **58/58 scenes** (kèm 9 ảnh `-unlit.png`, `b3-combat-grayscale.png`, 2 ảnh `-strip.png`, `metrics.json`) với `0` console error / `0` console warning.
    - **57/58 scenes** đạt `0.0000%` pixel-diff (`0` pixel lệch); **1/58 scene (`coop-4p-combat`)** lệch `106 / 2,073,600` pixels (`max diffRatio = 0.0051%` < ngưỡng `0.5%`).
  - **Chuẩn hiệu năng GPU phần cứng (`docs/perf-baseline.json`):**
    - **GPU:** `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)` (`hardwareAccelerated: true`).
    - **Uncapped Frame-Time (1080p High):** Normal Combat `p50 = 7.2ms`, `p95 = 8.7ms` (`135.39 FPS`); Stress Combat (`4P + 80E + 600B`) `p50 = 11.4ms`, `p95 = 13.5ms` (`85.92 FPS`).
    - **VSync 60Hz FPS:** Normal Combat **`60.05 FPS`** (mục tiêu `≥ 60`); Stress Combat **`59.20 FPS`** (mục tiêu `≥ 58`).
  - **Số đo trắc quang Baseline (`docs/screenshots/polish-p0/baseline/metrics.json`):**
    - **Unlit (`?lighting=0`):** $\Delta L^*$ toàn sàn rất cao (`b1-combat: 53.51`, `b2-combat: 72.61`, `b3-combat: 42.61`, `hub-solo: 72.22`; mục tiêu `≤ 14`); vùng trung tâm `center_arena` $\Delta L^* = 54.53\text{–}72.57$ (mục tiêu `≤ 8`); bão hòa `meanS = 0.320\text{–}0.578`.
    - **Lit:** Tỷ lệ giữ sáng 4 góc `cornerRetentionRatio` sụt nặng (`b1-combat: 47.4%`, `b2-combat: 47.6%`, `b3-combat: 35.5%`, `boss-b2-blizzard: 39.3%`, `hub-solo: 62.3%`; mục tiêu `≥ 72%–82%`), `minLitFloorL = 0.00`; vũng sáng chậu lửa `brazierLightPoolDeltaL` âm hoặc xấp xỉ 0 (`-4.43` đến `+0.07`; mục tiêu `≥ +6..+8`).
  - **Đánh giá độc lập của Visual Reviewer (`docs/screenshots/polish-p0/review-baseline.md` & `docs/POLISH_BASELINE.md`):**
    - Điểm trung bình Rubric 9 tiêu chí: **`2.44 / 10`** (Môi trường `3/10`, Ánh sáng `2/10`, Độ dễ đọc `3/10`, Vật thể tương tác `2/10`, Portal/Cửa `2/10`, UI/HUD `2/10`, Nhân vật/Rig `3/10`, FX `3/10`, Cảm giác sản phẩm `2/10`), kèm bảng xếp hạng Top 15 vấn đề thị giác ưu tiên xử lý ở P1–P12.
- **Phase P1 — Chế độ Debug & Dọn sạch UI Debug (Hoàn thành ✅):**
  - **Commits:** `43e6ba0`, `533e53f`, `8864899`.
  - **Hệ thống cờ Debug kép trên Client (`apps/client/src/core/debug-flag.ts` + 7 unit tests trong `apps/client/test/debug-flag.test.ts`):**
    - Tách bạch 2 cờ độc lập `debugUi` và `testHooks` (`resolveDebugFlags`, `isDebugUiEnabled`, `isEffectiveDebugUiEnabled`, `isTestHooksEnabled`), cho phép `?debug=0` cưỡng bức tắt `debugUi` kể cả trên môi trường dev và `?debug=0&testHooks=1` phục vụ chụp ảnh tự động (`pnpm shots`) với giao diện người chơi sạch 100%.
    - Phím tắt `Ctrl+Shift+D` toàn cục gọi `ev.preventDefault()`, bật/tắt `debugUi` tại runtime, lưu bền vững vào `localStorage['ashen_pact_debug']`, hiển thị thông báo nổi không xâm lấn (`"Debug ON"` / `"Debug OFF"`) và đồng bộ tức thì trạng thái hiển thị của `MenuScene`, `GameScene`, `DebugOverlay`.
    - Khi `!isTestHooksEnabled()`, `window.__GAME_DEBUG__` được bọc qua `Proxy` chỉ-đọc (chặn ghi đè từ console) và toàn bộ hook `window.__GAME_*` / `window.__PHASER_GAME__` / `window.__GALLERY_*` không được gắn lên `window`.
    - Ẩn toàn bộ nút/chữ debug khỏi giao diện người chơi khi `debugUi` tắt: ẩn `Bộ Sưu Tập`, `Đổi Hoạt Ảnh`, hộp kiểm tra dấu tiếng Việt cuối trang ở `MenuScene`; ẩn `[R] Ng.Tố`, `[G] Đồ Họa`, `[Art Gallery]`, chỉ số `DPS`, gợi ý `F1-F7: Debug` và khóa các phím `F1..F9`, `R`, `G` ở `GameScene`.
  - **Cổng kiểm soát Debug trên Server (`apps/server/src/debug-gate.ts` + 9 unit tests trong `packages/shared/test/server-debug-gate.test.ts`):**
    - Kiểm tra cờ CLI `--debug` hoặc biến môi trường `ASHEN_PACT_DEBUG=1`; đồng bộ `debugAllowed` trong `/api/health`, `/api/host-info`, `hello_welcome` và `coop_welcome` (chế độ Co-op chỉ mở UI/hotkey debug khi cả client và server cùng bật).
    - Khi server tắt debug, `CoopRoom` từ chối mọi lệnh `skip_waves`, `set_bot_autoplay`, `set_god_mode`, `debug_cmd`, ghi `console.warn` và phản hồi `debug_rejected` về client.
  - **Launcher C#, Script phát hành, Tài liệu & Kiểm thử E2E Release (`tools/package-release.ts`, `README.md`, `tests/e2e/phase8.spec.ts`):**
    - Sửa C# `AshenPactHostLauncher` luôn giữ cờ `--host` khi truyền thêm tham số CLI (như `--debug` hoặc `--port`), bổ sung `start-host-debug.bat` và mục hướng dẫn *"Bật Chế Độ Debug"* trong `README.md`.
    - Mở rộng `tests/e2e/phase8.spec.ts` kiểm thử cả 2 chế độ của bản đóng gói `AshenPact-Host.exe`: chế độ `--debug` (Co-op 2 trình duyệt vượt tầng + thắng Boss) và chế độ mặc định không `--debug` (`debugAllowed: false`, `window.__GAME_*` `undefined`, `window.__GAME_DEBUG__` read-only Proxy, phím `F1/F2/G/R` vô hiệu, server từ chối `set_god_mode`/`debug_cmd` với `debug_rejected`).
  - **Quyết định kỹ thuật (Rulings 1–3):**
    1. Các tham số URL chuyển cảnh nhanh (`?biome=`, `?hub=1`, `?scene=gallery`, `?gallery=1`, `?scene=game`) được cổng hóa theo `isDebugUiEnabled() || isTestHooksEnabled()` (người chơi bản release mặc định bị chuyển về `MenuScene`, trong khi `pnpm shots` với `?debug=0&testHooks=1` vẫn dựng được mọi cảnh).
    2. Nút `[R] Ng.Tố` và phím `R`/`F6` (`cycleImbueElement`) được xếp vào công cụ debug theo đúng `docs/GDD.md` Mục 3.1 & 4.
    3. Script `pnpm --filter @ashen-pact/server dev` truyền sẵn `--debug` cho môi trường dev/E2E phase 0–7, trong khi bản phát hành `AshenPact-Host.exe` mặc định tắt debug trừ khi chạy qua `start-host-debug.bat` hoặc truyền `--debug`.
  - **Visual Gate (`docs/screenshots/polish-p1/review.md`):**
    - Đánh giá mù A/B (Blind A/B Review bởi độc lập `pro` Visual Reviewer): **PASS** (nhận diện chính xác `version-B` = `after`, `0` blocker, `0` major, Criterion 6 UI/HUD đạt **`8.5 / 10`**, Criterion 9 Product Feel đạt **`8.0 / 10`**, Phase P1 DoD đạt **`10 / 10`**).

### 3.7 Phase P2 — Vũ khí 2 ô & rơi vũ khí + Vòng Emote (Hoàn thành ✅)
- **Commits:** `10f4a13`, `a3e9caa`, `3543e3a`, `99d3a2f`.
- **Hạng mục đã thực hiện:**
  1. **Simulation 2 Ô Vũ Khí, Rơi Vũ Khí & Chống Phình Snapshot (`packages/shared` + 9 unit tests trong `packages/shared/test/polish-p2-weapons.test.ts`):**
     - Định nghĩa và export `MAX_WEAPON_SLOTS = 2` cùng `estimateWeaponDps` trong `weapons.ts`; cập nhật `PHASE1_SAMPLE_WEAPONS = ['knight_sword', 'rusty_pistol'] as const` và loadout khởi đầu của cả 5 nhân vật thành `[starterWeaponId, 'rusty_pistol']`.
     - Bổ sung helper chung `spawnDroppedWeapon` dùng thống nhất cho cả `dropActiveWeapon` (phím `X`) và `pickupOrBuyWorldItem` (nhặt trên đất hoặc mua tại Thương Nhân khi đầy `2/2` ô): vũ khí đang cầm ở `activeWeaponSlot` được thả ra thành `worldItem` dùng chung (`ownerPlayerId = undefined`, `costGold = 0`, kèm `fromX`, `fromY`, `droppedByPlayerId`, `droppedAtTick`), xóa item không có `offerId` khỏi `worldItems` sau khi nhặt để kích thước snapshot mạng không tăng sau 200 lần đổi liên tiếp.
     - Cơ chế khóa nhặt lại `0.3s` (`18` ticks, `weaponPickupLockTimer`) cho người vừa thả (đồng đội Co-op vẫn nhặt được ngay lập tức); tự động bổ sung lại vũ khí trên kệ thử nghiệm ở Hub (`isHubRackItem: true`) và dọn sạch đồ rơi khi bắt đầu lượt chơi mới (`startDungeonRunFromHub`).
     - Cập nhật AI Bot Autoplay (`sim-progression-bot.ts`): bỏ qua vũ khí vừa do chính mình đánh rơi và chỉ nhặt vũ khí có DPS ước tính cao hơn ít nhất `+5%` khi đã đầy 2 ô, chấm dứt vòng lặp nhặt–rơi vô tận.
  2. **Client HUD 2 Ô, Vòng Biểu Cảm Giữ Phím `T` & Hoạt Ảnh Văng Nảy `0.25s` (`apps/client`):**
     - Cập nhật thanh vũ khí HUD theo đúng `MAX_WEAPON_SLOTS = 2`; khi chỉ còn 1 vũ khí, ô thứ 2 hiển thị trạng thái rỗng (`[2] Ô Trống` / `Nhấn [E] để nhặt`, ẩn icon), loại bỏ hoàn toàn fallback "vũ khí ma".
     - Tách riêng phím số `1`/`2` (chọn ô vũ khí `0`/`1`, hoặc chọn buff khi `sim.runState === 'buff_choice'`) khỏi Vòng Biểu Cảm giữ phím `T` (`updateEmoteWheelHudImpl`: 4 góc phần tư chọn bằng hướng trỏ chuột + nhả `T`/click chuột hoặc bấm `1–4` khi đang giữ `T`); chuẩn hóa phím thả vũ khí thành `[X]`.
     - Vẽ quỹ đạo parabol văng nảy 2 nhịp trong `0.25s` (`15` ticks) kèm xoay nhẹ, nhịp bobbing hình sin, hào quang mặt đất (`BlendMode.ADD`) và cột sáng theo màu độ hiếm `WEAPON_RARITY_COLORS` di chuyển đồng bộ cùng vũ khí rơi.
  3. **Kiểm Thử E2E, Cảnh Chụp Visual & Visual Gate (`tests/e2e/` & `docs/screenshots/polish-p2/`):**
     - Cập nhật `tests/e2e/phase1.spec.ts` (2 ô vũ khí + nhặt `scrap_shotgun` thay vào ô đang cầm) và `tests/e2e/phase4.spec.ts` (emote `KeyT + Digit1` và kịch bản Co-op 2 trình duyệt: P1 đầy 2 ô nhặt vũ khí mới → vũ khí cũ rơi ra đất → P2 nhìn thấy và nhấn `E` nhặt thành công).
     - Bổ sung `stripFramesPerStep` cùng 2 cảnh mới `b1-weapon-drop` (kèm dải 8 frame `b1-weapon-drop-strip.png` ghi lại trọn vẹn cung văng nảy `0.25s`) và `ui-emote-wheel` vào `tests/e2e/helpers/visual-scenes.ts`; chụp bộ ảnh `after` với `--verify-freeze` đạt `diffRatio === 0` trên cả 6 cảnh.
     - **Visual Gate (`docs/screenshots/polish-p2/review.md`):** Đánh giá mù A/B (Blind A/B Review bởi độc lập `pro` Visual Reviewer): **PASS** (`version-A` = `after` thắng tuyệt đối trên cả 4 cảnh; `0` blocker, `0` major; Readability **`8.5 / 10`**, Interactables/Weapons **`9.0 / 10`**, UI/HUD 2-slot & Emote Wheel **`9.0 / 10`**, Animation **`8.5 / 10`**, Product Feel **`8.5 / 10`**, Phase P2 DoD **`10 / 10`**).

### 3.8 Phase P3 — Nền Ánh Sáng Trong Trẻo, PostFX, Tách `HudScene` & Camera Không Méo (Hoàn thành ✅)
- **Commits:** `1f88cb6`, `e90d17c`, `b63a44a`, `2f87e1d`.
- **Hạng mục đã thực hiện:**
  1. **Nền tảng Ánh sáng Trong Trẻo Toàn Màn Hình & Vũng Sáng Cộng Tính (`apps/client/src/fx/lighting.ts`, `fx-ambient.ts`, `fx-particles.ts`, `arena-tiles.ts`):**
     - Nâng `ambientColor` của 3 biome lên mức sáng trong trẻo (`Biome 1`: `#DEE2EC` `~0.88`, `Biome 2`: `#D4E1EE` `~0.86`, `Biome 3`: `#EBDBD1` `~0.88`); loại bỏ hoàn toàn cơ chế cắt tầm nhìn quanh người chơi (`mainPlayerVisionRadius`, `allyVisionRadius`) và tắt vignette đen mặc định (`uVignetteStrength = 0.0`).
     - Bổ sung lớp `glowTexture` (`Phaser.BlendModes.ADD`, `alpha = 0.55`) cùng `soft_light_falloff_glow` với đường cong suy giảm mượt $(1 - d/R)^2 \cdot (1 - 0.35 d/R)$ để đèn đuốc/chậu lửa luôn tạo vũng sáng ấm cam-vàng (`#F59E42` + lõi `#FFD27A`, $\Delta L^* \ge +12.91\text{..}+29.23$) ngay cả khi ambient cao và ở cả cấu hình `Low`.
     - Sửa lỗi dùng chung `brushSprite` với `glow_mushroom` gây ám xanh lá lên sàn băng Biome 2; loại bỏ sương mù đục `fx_ambient_mist` và dọn sạch prop `glow_mushroom` khỏi Biome 2 & 3; nâng nhẹ độ sáng sàn nền Biome 3 (`floorBase: LEATHER_MID`, `floorShade: LEATHER_DARK`) để mọi góc đạt $L^* \ge 20.17$.
  2. **Làm Lại Hiệu Ứng Bão Tuyết Boss 2 Kryssa Phase 3 (`lighting.ts`, `fx-ambient.ts`, `game-scene-Boss2AndCoopHelpers.ts`):**
     - Thay thế lớp phủ làm tối màn hình bằng mưa tuyết chéo dày gấp 3 lần (`vx = -155..-95`, `vy = 95..145`), chuyển màu lạnh nhẹ bảo toàn độ sáng (`uGradeLift = [0.008, 0.018, 0.032]`, độ sáng sàn $L^*$ tăng nhẹ `+0.89%`, tức mức sụt giảm `0.0% <= 5%`) và viền sương giá băng thanh khiết `#CFE8EE` ở 4 mép màn hình (`alpha <= 0.11`).
  3. **Tách `HudScene` Độc Lập & Camera Zoom Đồng Đều Đa Tỉ Lệ Màn Hình (`HudScene.ts`, `main.ts`, `arena-tiles.ts`, `game-scene-HudLifecycle.ts`):**
     - Tách toàn bộ HUD, minimap, bảng Co-op, preview kỹ năng Hub, vòng biểu cảm, modal chọn buff/cài đặt/tạm dừng/kết quả, `DebugOverlay` và tâm ngắm sang `HudScene` chạy song song phía trên `GameScene` với `postPipelines.length === 0` và không chịu ảnh hưởng của `lightTexture`/`glowTexture`.
     - Sửa lỗi méo hình trên màn hình `21:9` (`2560×1080`) và `5:4` (`1280×1024`) bằng công thức zoom đồng đều `zoom = Math.min(w / 960, h / 540)` (`cam.setZoom(zoom)`, `zoomX === zoomY`) trên cả `GameScene`, `HudScene`, `MenuScene` và `ArtGalleryScene`, đồng thời căn giữa map khi viewport lớn hơn kích thước phòng và neo các cụm HUD sát 4 góc/cạnh thật của màn hình (`hudPadX`, `hudPadY`).
  4. **Số đo Trắc quang Định lượng (`docs/screenshots/polish-p3/after/metrics.json`):**

| Cảnh (`scene`) | `unlitFloorMeanL` | `litFloorMeanL` | `cornerToUnlitRatio` (`≥ 0.82`) | `minCornerL` (`≥ 15`) | `brazierToFloorDeltaL` (`≥ +8.0`) | `clipWhiteRatio` (`< 0.005`) | `freezeDiffRatio` (`< 0.005`) | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `b1-start-room` | `20.99` | `22.70` | **`0.9555`** (95.6%) | **`16.61`** | **`+25.94`** | `0.00000` | `0.00000` | PASS |
| `b1-combat` | `20.89` | `23.72` | **`0.9606`** (96.1%) | **`16.51`** | **`+16.02`** | `0.00000` | `0.00000` | PASS |
| `b1-combat-low` | `21.02` | `23.50` | **`0.9926`** (99.3%) | **`17.94`** | **`+16.24`** | `0.00000` | `0.00000` | PASS |
| `b2-start-room` | `24.64` | `27.14` | **`0.9781`** (97.8%) | **`17.27`** | **`+26.19`** | `0.00000` | `0.00000` | PASS |
| `b2-combat` | `23.85` | `26.82` | **`0.9347`** (93.5%) | **`17.34`** | **`+19.30`** | `0.00000` | `0.00000` | PASS |
| `b3-start-room` | `22.35` | `24.16` | **`0.9437`** (94.4%) | **`20.36`** | **`+23.41`** | `0.00000` | `0.00000` | PASS |
| `b3-combat` | `21.97` | `25.73` | **`0.9371`** (93.7%) | **`20.17`** | **`+21.84`** | `0.00000` | `0.00000` | PASS |
| `hub-solo` | `22.34` | `23.48` | **`0.9771`** (97.7%) | **`16.93`** | **`+29.23`** | `0.00000` | `0.00000` | PASS |
| `boss-b2` | `23.20` | `24.01` | **`0.9629`** (96.3%) | **`16.37`** | **`+13.11`** | `0.00006` | `0.00000` | PASS |
| `boss-b2-blizzard` | `23.43` | `24.23` | **`0.9390`** (93.9%) | **`16.37`** | **`+12.91`** | `0.00006` | `0.00000` | PASS |

  5. **Visual Gate (`docs/screenshots/polish-p3/review.md`):**
     - Đánh giá mù A/B (Blind A/B Review trên 15 cặp cảnh ngẫu nhiên bởi độc lập `pro` Visual Reviewer `32b8410a-1a30-4317-9367-5040a4d93252`): **PASS** (`after` thắng tuyệt đối **15/15 cảnh = 100%**; `0` blocker, `0` major; Environment **`8.5 / 10`**, Lighting & Clear Visibility **`9.5 / 10`**, Readability **`9.0 / 10`**, UI/HUD `HudScene` & Multi-Aspect **`9.5 / 10`**, FX Blizzard **`9.5 / 10`**, Product Feel **`9.0 / 10`**, Phase P3 DoD **`10 / 10`**).

### 3.9 Phase P4 — Kiến Trúc Map Hybrid: Phòng Chuẩn B1, Palette `ENV`, Sàn "Tĩnh Lặng Giữa Tâm", Tường 3D 3 Lớp & Surface Kiến Trúc (Hoàn thành ✅)
- **Commits:** `464b426`, `d2cc91f`.
- **Hạng mục đã thực hiện:**
  1. **Bảng Màu Môi Trường Trầm `ENV_PALETTE` (`apps/client/src/art/palette.ts` + 5 unit tests trong `apps/client/test/polish-p4-map-architecture.test.ts`):**
     - Định nghĩa chính xác 8 khóa màu môi trường (`floor`, `seam`, `var`, `wallTop`, `wallFront`, `shadow`, `rim`, `accent`) cho cả 4 khu vực: **Hub (`0`)** (`#414B61`), **Biome 1 (`1`)** (`#3D4F47`), **Biome 2 (`2`)** (`#446E78`), **Biome 3 (`3`)** (`#53433F`).
     - Đảm bảo quan hệ trắc quang CIE $L^*$ nhất quán: $L^*_{\text{floor}} - L^*_{\text{INK\_DARK}} \ge 22.0$, $L^*_{\text{wallTop}} - L^*_{\text{floor}} \in [+12, +18]$, $L^*_{\text{wallFront}} - L^*_{\text{floor}} \in [-12, -8]$, và độ bão hòa HSL $S \le 0.35$ (riêng B2 $\le 0.40$).
  2. **Sàn Hybrid 2 Vùng Theo `distToWall` & Tường 3D 3 Lớp Có Đổ Bóng Hướng `-135°` (`apps/client/src/art/texture-baker-tiles.ts`, `arena-tiles.ts`):**
     - Loại bỏ hoàn toàn viền đen `INK_DARK` quanh từng ô sàn (`32×32`), họa tiết bóng bán nguyệt chữ "C" và gờ sáng gắt gây hiệu ứng "giấy kẻ ô" (waffle-grid).
     - Phân tách tự động bằng khoảng cách Chebyshev `computeTileDistToWall(map, tx, ty)` tới ô `wall`/`pillar`/`cracked_wall` gần nhất:
       - **Perimeter (`distToWall <= 2`, variants `0..3`):** Đan xen phiến đá `1×1` (`variant 0`), gạch chia `2×2` (`variant 1`), **lưới thoát nước sắt lõm** (`variant 2` tại `distToWall === 1`), và phiến chuyển tiếp (`variant 3` tại `distToWall === 2`, mạch mờ `alpha = 0.20`).
       - **Center Arena (`distToWall > 2`, variants `4..7`):** Mặt sàn đá nguyên khối phẳng mịn (mạch `ENV.seam` `alpha = 0.06`, biến thiên cụm 3–4 ô bằng `ENV.var` ở `alpha = 0.00..0.60`), đạt `centerDeltaL = 1.13..2.95 <= 8.0`.
     - Tường & cột trụ 3D 3 lớp: `Top Cap` (`y = 0..20` khi `!hasS`, màu `ENV.wallTop`) có gờ rim-light `ENV.rim` dày `1.8u` ở cạnh Bắc/Tây (`-135°`) và viền ngoài `INK_DARK` `2.2u` chỉ vẽ trên rìa tiếp giáp sàn; `South Cliff Face` cao `cliffH = 12u` (`ENV.wallFront`) có bóng gờ trên `2u` và 2 hàng mạch đá ngang/dọc so le (xóa bỏ chấm glow lặp trên tường); lớp `Wall AO` đổ bóng tiếp xúc `7u` (`alpha = 0.35 → 0`) và bóng đổ chéo Đông–Nam `14u` (`alpha = 0.22 → 0`).
  3. **Surface Nguyên Tố Ăn Nhập Kiến Trúc (`apps/client/src/art/texture-baker-surfaces.ts`):**
     - Giảm ~30% độ bão hòa nền của cả 12 loại surface và giữ chi tiết nội vùng $\Delta L^* \le 10$.
     - Nhóm hữu cơ `P1` (`water`, `electrified_water`, `poison_swamp`, `grass`, `burning_grass`, `ice`): bo tròn góc ngoài lộ thiên `r = 9u` để lộ nền `ENV.floor` tự nhiên và vẽ bờ cong 2 lớp đồng tâm (`outerBank` `3.2u` + `innerLip` `1.6u`) uốn lượn theo rìa ngoài.
     - Nhóm dẫn nhiệt/cơ khí `P3` (`lava`, `oil`, `burning_oil`, `conveyor`, `chasm`, `ash`): đóng khung bằng gờ đá bazan vát cạnh rộng `4u` (`#7F6559` mặt trên `2.4u` + `#3B2D29` thành trong `1.6u` + viền ngoài `INK_DARK` `1.4u`).
  4. **Kiến Trúc Đặc Trưng Từng Biome & Khóa Phòng Chuẩn B1 (`apps/client/src/world/biome-architecture.ts`, `docs/ART_GUIDE.md` Mục 5.4, `docs/screenshots/polish-p4/golden-room/`):**
     - Tuân thủ nghiêm ngặt 3 nguyên tắc: bóng đổ dài `44u` (`alpha = 0.22 → 0`) về hướng Đông–Nam (`-135°`) từ trụ cột `2×2`; vật thể có khối (`hasVolume = true`) chỉ đặt trên ô `wall`/`pillar`; decal sàn (`hasVolume = false`) không viền `INK_DARK`, tự động ẩn khi ô bị phủ bởi surface động (`isFloorDecalVisible`), giữ `largeDecorCount <= 8`, `emptyPerimeterRatio >= 0.40`.
     - **Biome 1 (Phòng chuẩn B1 — khóa tại `docs/screenshots/polish-p4/golden-room/`):** Rễ cây cổ thụ Bezier S-curve (`root_base` trên tường + `root_decal_tip` `2u` phẳng trên sàn `distToWall === 1`), cụm nấm phát quang `mushroom_cluster` ở góc tường/chân cột, dây leo `cliff_vines` trên mặt đứng tường Bắc, và đá bước chân `stepping_stone` trên ô sàn khô sát mép nước/đầm độc.
     - **Biome 2:** Hốc vòm thác băng `ice_alcove` trên tường Bắc, cụm tinh thể băng `frost_crystal_cluster` ở góc tường, và vòng cổ ngữ `sunken_astrolabe` 3 vòng đồng tâm khắc chìm ở Center Arena (`alpha = 0.20`, $\Delta L^* \le 6$).
     - **Biome 3:** Bánh răng đồng thau 8 răng `brass_gear_wall` trên tường Bắc, đường ống hơi nước mặt bích + van đồng `steam_pipe_wall` trên tường bên, và rãnh nhiệt nắp lưới sắt phẳng `grated_heat_channel` dọc dải ven tường.
     - **Hub (`0`):** Bệ đá chậu lửa `brazier_pedestal` và hàng rào sắt rèn mũi nhọn `wrought_iron_fence` trên gờ tường đá cổ.
  5. **Số Đo Trắc Quang Định Lượng Toàn Bộ 11 Cảnh (`docs/screenshots/polish-p4/after/metrics.json`):**

| Cảnh (`scene`) | `floorMeanL` (`28–40` / B2 `40–50`) | `centerDeltaL` (`≤ 8.0`) | `floorDeltaL` (`≤ 14.0`) | `floorMeanS` (`≤ 0.35` / B2 `≤ 0.40`) | `contrastWithInkDark` (`≥ 22.0`) | `cornerToUnlitRatio` (`≥ 0.82`) | `minCornerL` (`≥ 15.0`) | `brazierToFloorDeltaL` (`≥ +8.0`) | `clipWhiteRatio` (`< 0.005`) | `freezeDiffRatio` (`< 0.005`) | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `b1-start-room` | **`32.83`** | **`2.42`** | **`2.42`** | **`0.132`** | **`27.50`** | **`1.030`** | **`30.37`** | **`+20.75`** | `0.000` | `0.000` | PASS |
| `b1-combat` | **`32.83`** | **`2.42`** | **`11.38`** | **`0.132`** | **`27.50`** | **`1.029`** | **`29.67`** | **`+25.13`** | `0.000` | `0.000` | PASS |
| `b1-combat-low` | **`32.83`** | **`2.42`** | **`11.38`** | **`0.132`** | **`27.50`** | **`1.003`** | **`31.13`** | **`+22.54`** | `0.000` | `0.000` | PASS |
| `b1-poison-swamp` | **`33.09`** | **`1.28`** | **`2.75`** | **`0.134`** | **`27.77`** | **`1.017`** | **`29.40`** | **`+20.61`** | `0.000` | `0.000` | PASS |
| `b2-start-room` | **`44.88`** | **`2.95`** | **`2.95`** | **`0.276`** | **`39.55`** | **`1.000`** | **`40.58`** | **`+11.88`** | `0.000` | `0.000` | PASS |
| `b2-combat` | **`44.88`** | **`2.95`** | **`2.95`** | **`0.276`** | **`39.55`** | **`0.989`** | **`39.60`** | **`+22.11`** | `0.000` | `0.000` | PASS |
| `b3-start-room` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`1.020`** | **`27.97`** | **`+21.85`** | `0.000` | `0.000` | PASS |
| `b3-combat` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`1.019`** | **`26.93`** | **`+23.62`** | `0.000` | `0.000` | PASS |
| `b3-lava-surface` | **`30.76`** | **`1.13`** | **`1.13`** | **`0.144`** | **`25.43`** | **`1.019`** | **`26.93`** | **`+24.06`** | `0.000` | `0.000` | PASS |
| `b3-combat-low` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`1.002`** | **`28.59`** | **`+22.10`** | `0.000` | `0.000` | PASS |
| `hub-solo` | **`32.53`** | **`1.55`** | **`3.07`** | **`0.200`** | **`27.21`** | **`1.010`** | **`28.11`** | **`+25.52`** | `0.000` | `0.000` | PASS |

  6. **Visual Gate Bước A & Bước B (`docs/screenshots/polish-p4/review-step-a.md` & `docs/screenshots/polish-p4/review.md`):**
     - **Bước A (Phòng chuẩn B1 — 4 cảnh):** Đánh giá mù A/B bởi độc lập `pro` Visual Reviewer (`43253b9f-a379-470b-9cac-73c7ed104604`): **PASS** ngay ở Vòng 1 (`4/4` cảnh chọn `after`, `0` blocker, `0` major; Environment **`9.2 / 10`**, Lighting **`9.5 / 10`**, Readability **`9.4 / 10`**, Product Feel **`9.0 / 10`**) → Tự động khóa bộ ảnh `docs/screenshots/polish-p4/golden-room/*.png` và Mục 5.4 `docs/ART_GUIDE.md`.
     - **Bước B (Toàn bộ 11 cảnh Hub, B1, B2, B3):** Đánh giá mù A/B bởi độc lập `pro` Visual Reviewer (`133901ef-a6e1-48b9-bf20-1627c8b16f65`): **PASS** ngay ở Vòng 1 (**`11/11` cảnh + `11/11` cặp `-unlit.png` = 100%** chọn `after`, `0` blocker, `0` major; Environment **`9.4 / 10`**, Lighting **`9.5 / 10`**, Readability **`9.5 / 10`**, Style Consistency vs Golden Room B1 **`9.5 / 10`**, Product Feel **`9.2 / 10`**, Phase P4 DoD **`10 / 10`**).

### 3.10 Phase P5 — Bản Sắc Kiến Trúc Biome (`P1/P2/P3/P4`) & Chậu Lửa Ven Tường (Hoàn thành ✅)
- **Commits:** `19f467b`.
- **Hạng mục đã thực hiện:**
  1. **Chuẩn Hóa Số Lượng Chậu Lửa (`torch_brazier`) Theo Loại Phòng (`packages/shared/src/sim/sim-props-spawning.ts`, `sim-dungeon-rooms.ts`):**
     - Phân bổ số lượng `torch_brazier` theo đúng loại phòng trong `WorldSim`: `start: 2` (2 bên cửa vào phía Tây, giữ nguyên chậu lửa góc Tây–Bắc tại `(8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12)` để vùng mẫu `brazier_pool` luôn đo chính xác), `combat: 3–4` (phòng combat đầu tiên có đủ 4 góc, các phòng combat phụ có thể bỏ 1 góc theo seed), `treasure: 2`, `merchant: 2`, `shrine: 2`, `portal: 2`, `secret: 0`, và `boss: 6` đối xứng dọc khán đài Bắc–Nam.
  2. **Hoàn Thiện Kiến Trúc `P1/P2/P3/P4` & Chọn `2/3` Motif Theo Seed (`apps/client/src/world/biome-architecture.ts`, `biome-arch-live.ts`):**
     - Mỗi phòng chọn tất định **2 trong 3 motif ven tường** (`plan.selectedMotifs.length === 2`) kết hợp ngân sách mật độ nghiêm ngặt (`largeDecorCount <= 8`, `smallPerimeterDecorCount <= Math.floor(perimeterTileCount / 3)`, `emptyPerimeterRatio >= 0.40`, `centerArenaSolidDecorCount === 0`).
     - **P4 Chung & Hub (`0`):** Bệ đá giật cấp + giá đỡ sắt rèn vươn chéo `45°` (`brazier_pedestal`) khớp trực tiếp với danh sách `torch_brazier` thực tế của từng phòng; cột đá rãnh (`fluted_column`) trên ô `pillar` và nửa cột gắn tường (`fluted_pilaster`) đổ bóng dài `48u` về hướng Đông–Nam (`-135°`); gờ tường đá vỡ xen hàng rào sắt rèn mũi nhọn (`wrought_iron_fence`).
     - **Biome 1 (`P1 Rừng Cổ`):** Rễ cây cổ thụ Bezier S-curve (`root_base`) tràn qua mép tường với đầu mút decal phẳng `2u` (`root_decal_tip`), cụm nấm phát quang (`mushroom_cluster`) + dây leo mặt đứng (`cliff_vines`), và đá bước chân (`stepping_stone`) chỉ đặt trên ô sàn khô (`surface === 'none'`) sát mép nước/đầm độc.
     - **Biome 2 (`P2 Hầm Băng`):** Vòng cổ ngữ **Sunken 3-Ring Ice Astrolabe** (`70u/120u/165u`, bán kính vòng ngoài `<= 0.45 * min(w, h)` của Center Arena, 8 nan hướng tâm, bán nguyệt lệch tâm, $\Delta L^* \in [5, 7]$), hốc vòm thác băng tường Bắc (`ice_alcove`), cụm tinh thể băng vát cạnh (`frost_crystal_cluster`), và **2–3 dải tứ giác ánh sáng God-rays** chiếu xiên `-135°` (`rộng 60–90u`, `alpha 0.06 → 0`, tự động tắt ở `Low`).
     - **Biome 3 (`P3 Lò Rèn`):** Rãnh nhiệt âm sàn rộng `24–28u` có nắp lưới sắt rèn (`grated_heat_channel`, `hasIronGrateCover = true`, không đi qua Center Arena, ánh dung nham lộ nhẹ qua khe lưới `alpha <= 0.30` nhịp thở chậm ở High/Medium và tắt ở Low), bánh răng đồng thau `8–12 răng` gắn tường Bắc (`brass_gear_wall`) quay chậm ở High/Medium (đứng yên ở Low), ống dẫn hơi nước mặt bích tán đinh (`steam_pipe_wall`), và đe rèn (`forge_anvil`) chỉ đặt trên ô `pillar`.
     - Đảm bảo 100% decal sàn (`sunken_astrolabe`, `grated_heat_channel`, `stepping_stone`, `root_decal_tip`) tự động ẩn ngay khi ô bị phủ bởi surface động hoặc hiệu ứng Boss Phase 3 (`applyBossPhase3ToxicBorder`, `applyBossPhase3BlizzardBorder`, `applyBossPhase3LavaBorder`).
  3. **Hạt Than Hồng Bay Lên & Bụi Sáng Quanh Chậu Lửa (`apps/client/src/fx/combat-fx.ts`, `GameScene.ts`):**
     - Sinh hạt than hồng nhỏ (`<= 3.5px`, không viền đen, `BlendModes.ADD`) bay lên từ chậu lửa và hạt bụi sáng ấm li ti lơ lửng trong bán kính vũng sáng của `torch_brazier` (tự động tắt khi `quality === 'low'`).
  4. **Kiểm Thử Đơn Vị DoD Phase P5 (`apps/client/test/polish-p5-biome-architecture.test.ts`):**
     - **5/5 nhóm unit test DoD P5** PASS 100%: (1) BFS giữa mọi cặp cửa Bắc/Nam/Đông/Tây thông suốt 100%; (2) Decor có khối (`hasVolume = true`) chỉ nằm trên `wall`/`pillar`, riêng `forge_anvil` và `fluted_column` chỉ trên `pillar`; (3) Ngân sách mật độ + chọn `2/3` motif + số lượng `torch_brazier` theo từng loại phòng; (4) `hasHazardGlow === false` trên mọi decor/decal, `stepping_stone` chỉ trên ô khô, `grated_heat_channel` có nắp lưới sắt và ngoài Center Arena; (5) Surface Boss Phase 3 B1/B2/B3 luôn thắng và ẩn toàn bộ decal sàn.
  5. **Số Đo Trắc Quang Định Lượng Toàn Bộ 13 Cảnh Đo & 18 Cảnh `--verify-freeze` (`docs/screenshots/polish-p5/after/metrics.json`):**

| Cảnh (`scene`) | `floorMeanL` (`28–40` / B2 `40–50`) | `centerDeltaL` (`≤ 8.0`) | `floorDeltaL` (`≤ 14.0`) | `floorMeanS` (`≤ 0.35` / B2 `≤ 0.40`) | `contrastWithInkDark` (`≥ 22.0`) | `cornerToUnlitRatio` (`≥ 0.82`) | `minCornerL` (`≥ 15.0`) | `brazierToFloorDeltaL` (`≥ +8.0`) | `clipWhiteRatio` (`< 0.005`) | `freezeDiffRatio` (`< 0.005`) | Kết quả |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `hub-solo` | **`32.53`** | **`1.55`** | **`3.07`** | **`0.200`** | **`27.21`** | **`1.012`** | **`28.10`** | **`+28.27`** | `0.000` | `0.000` | PASS |
| `b1-start-room` | **`32.83`** | **`2.42`** | **`2.42`** | **`0.132`** | **`27.50`** | **`0.967`** | **`28.17`** | **`+20.20`** | `0.000` | `0.000` | PASS |
| `b1-combat` | **`32.83`** | **`2.42`** | **`11.38`** | **`0.132`** | **`27.50`** | **`1.022`** | **`29.32`** | **`+24.35`** | `0.000` | `0.000` | PASS |
| `b1-combat-low` | **`32.83`** | **`2.42`** | **`11.38`** | **`0.132`** | **`27.50`** | **`0.985`** | **`30.24`** | **`+21.66`** | `0.000` | `0.000` | PASS |
| `boss-b1-phase3` | **`32.48`** | **`2.42`** | **`2.42`** | **`0.134`** | **`27.16`** | **`0.979`** | **`30.19`** | **`+16.88`** | `0.000` | `0.000` | PASS |
| `b2-start-room` | **`44.88`** | **`2.95`** | **`2.95`** | **`0.276`** | **`39.55`** | **`0.928`** | **`39.19`** | **`+10.99`** | `0.000` | `0.000` | PASS |
| `b2-combat` | **`44.88`** | **`2.95`** | **`2.95`** | **`0.276`** | **`39.55`** | **`0.982`** | **`39.60`** | **`+22.10`** | `0.000` | `0.000` | PASS |
| `b2-combat-low` | **`44.88`** | **`2.95`** | **`2.95`** | **`0.276`** | **`39.55`** | **`0.983`** | **`41.02`** | **`+18.14`** | `0.000` | `0.000` | PASS |
| `boss-b2` | **`44.46`** | **`2.95`** | **`3.25`** | **`0.277`** | **`39.13`** | **`0.985`** | **`40.56`** | **`+12.11`** | `0.000` | `0.000` | PASS |
| `b3-start-room` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`0.942`** | **`26.43`** | **`+21.18`** | `0.000` | `0.000` | PASS |
| `b3-combat` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`1.012`** | **`26.93`** | **`+23.84`** | `0.000` | `0.000` | PASS |
| `b3-combat-low` | **`30.84`** | **`2.35`** | **`2.35`** | **`0.143`** | **`25.51`** | **`1.003`** | **`28.82`** | **`+22.10`** | `0.000` | `0.000` | PASS |
| `boss-b3-phase3` | **`30.48`** | **`2.35`** | **`2.35`** | **`0.141`** | **`25.15`** | **`0.992`** | **`28.10`** | **`+16.64`** | `0.000` | `0.000` | PASS |

     - 5 cảnh bổ sung (`b1-chest-near`, `boss-b1`, `b2-chest`, `b3-chest`, `boss-b3`) cũng đạt `diffPixels = 0` (`freezeDiffRatio = 0.000 < 0.005`), nâng tổng số cảnh vượt qua `--verify-freeze` lên **18/18 cảnh tuyệt đối**.
  6. **Visual Gate (`docs/screenshots/polish-p5/review.md`):**
     - Đánh giá mù A/B (Blind A/B Review trên 18 cặp cảnh bởi độc lập `pro` Visual Reviewer `aa6fa86a-b284-49b2-b7d4-e8e60fa92b51`, đối chiếu trực tiếp với `docs/screenshots/polish-p4/golden-room/`): **PASS** (`version-A` = `after` thắng tuyệt đối **18/18 cảnh = 100%**; `0` blocker, `0` major, `0` minor; Environment **`9.3 / 10`** `>= 8.5`, Lighting **`9.5 / 10`**, Readability **`9.3 / 10`**, Style Consistency vs Golden Room B1 **`9.4 / 10`**, Product Feel **`9.2 / 10`**).

