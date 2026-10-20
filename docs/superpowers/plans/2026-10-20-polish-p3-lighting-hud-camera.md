# Phase P3: Nền Tảng Ánh Sáng Trong Trẻo, PostFX, Tách `HudScene` & Camera Không Méo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to execute this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển hệ thống ánh sáng từ mô hình "tối + khoét lỗ fog-of-war" sang mô hình **Full-Screen Clear Visibility** (ambient sáng trong trẻo ~84–90%, không fog-of-war, không sương mù `fx_ambient_mist`, không vignette đen mặc định, điểm nhấn ấm bằng `BlendModes.ADD`, bão tuyết Kryssa Phase 3 bằng hạt tuyết + viền băng thay vì phủ đen), tách toàn bộ HUD sang `HudScene` độc lập không chịu PostFX/lightmap và neo theo cạnh màn hình, đồng thời sửa lỗi méo hình do `cam.setZoom(zoomX, zoomY)` thành `cam.setZoom(zoom)` đồng nhất trên mọi tỷ lệ màn hình.

**Architecture:**
- **Lighting & PostFX (`apps/client/src/fx/lighting-pipeline.ts`, `apps/client/src/art/texture-baker-fx.ts`, `apps/client/src/fx/combat-fx-pools.ts`, `apps/client/src/fx/combat-fx.ts`, `apps/client/src/scenes/game-scene/entity-sync.ts`):**
  - Sửa `brushSprite` dùng `Phaser.BlendModes.ADD` khi vẽ vào `lightmapRt` (tránh pha trộn alpha `NORMAL` làm tối các kênh màu khác).
  - Làm mềm gradient `fx_light_radial` (`0 → 1.0`, `0.35 → 0.6`, `0.7 → 0.2`, `1.0 → 0.0`).
  - Nâng `ambientColor` lên mức sáng rõ toàn màn hình (`~0.867–0.871` trung bình kênh): Biome 1 `0xD9E3DD`, Biome 2 `0xD2E0E8`, Biome 3 `0xEBDBD1`, Hub `0xD6DCE8`.
  - Xóa hoàn toàn `mainPlayerVisionRadius` (`310`/`185`) và `allyVisionRadius` (`250`/`160`), chỉ giữ hào quang dịu quanh chân (`radius = 160, alpha = 0.24` cho người chơi chính; `radius = 145, alpha = 0.22` cho đồng đội).
  - Bổ sung pool 16 sprite `ADD` ấm (`depth: 35`, ngay trên `lightmapRt` ở `depth: 34`) cho `torch_brazier` (outer `#F59E42` + inner `#FFD27A`) để vùng quanh chậu lửa luôn ấm áp và đạt `brazierToFloorDeltaL >= +8.0` mà không làm cháy sáng.
  - Đặt `vignetteStrength = 0.0` mặc định (chỉ bật xung đỏ khi `player.hp <= 2`), `contrast = 0.98`, `bloomStrength = 0.14`.
  - Ẩn prop + ánh sáng xanh lá của `glow_mushroom` ở Biome 2, Biome 3 và Hub ở tầng client (`entity-sync.ts` và `lighting-pipeline.ts`), giới hạn `alpha <= 0.35` ở Biome 1.
  - Xóa hoàn toàn loại hạt `mist` (`fx_ambient_mist`) khỏi `combat-fx-pools.ts` và `combat-fx.ts`.
  - Thay thế `blizzardVeil` phủ tối ở Boss 2 Kryssa Phase 3 bằng: giữ nguyên độ sáng sàn (giảm mean `L*` `<= 5%`), tăng gấp 3 mật độ hạt tuyết bay chéo trong `CombatFxManager`, vẽ viền sương giá mỏng `#CFE8EE` (`alpha <= 0.12`, tuyệt đối không có màu đen) ở 4 mép màn hình, kèm SFX/cảnh báo khi bắt đầu Phase 3.
- **Camera Không Méo & Tách `HudScene` (`apps/client/src/scenes/HudScene.ts`, `apps/client/src/main.ts`, `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/MenuScene.ts`, `apps/client/src/scenes/ArtGalleryScene.ts`, `apps/client/src/scenes/game-scene/*`):**
  - Tạo `HudScene` chạy song song phía trên `GameScene` với camera không gắn `BiomePostFxPipeline` và không bị phủ `lightmapRt`.
  - Sửa `cam.setZoom(zoomX, zoomY)` thành `cam.setZoom(zoom)` (`zoom = Math.min(w / 960, h / 540)`) ở `GameScene` (`arena-tiles.ts`), `MenuScene.ts`, và `ArtGalleryScene.ts`.
  - Trong `updateCameraWithLookaheadAndShakeImpl`, tính `viewW = cam.width / zoom`, `viewH = cam.height / zoom` và căn giữa bản đồ khi `viewW >= map.width` (21:9 ultrawide) hoặc `viewH >= map.height` (5:4 `1280×1024`).
  - Neo các cụm HUD trong `HudScene` theo cạnh màn hình (`padX = Math.max(0, (viewW - 960) * 0.5)`, `padY = Math.max(0, (viewH - 540) * 0.5)`): góc trên-trái (`-padX, -padY`), trên-giữa (`0, -padY`), trên-phải (`+padX, -padY`), dưới-giữa (`0, +padY`), thanh nền trên/dưới phủ kín chiều ngang `[-padX .. 960 + padX]`.

**Tech Stack:** TypeScript, Phaser 3 WebGL, Vitest, Playwright.

---

### Task 1: Chụp ảnh `before` P3, Nâng Cấp Ánh Sáng Trong Trẻo, Bỏ Fog-of-War & `fx_ambient_mist`, Làm Lại Bão Tuyết Kryssa Phase 3

**Files:**
- Modify: `apps/client/src/art/texture-baker-fx.ts`
- Modify: `apps/client/src/fx/lighting-pipeline.ts`
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Modify: `tests/e2e/helpers/visual-scene-helpers.ts`
- Create: `apps/client/test/polish-p3-lighting-camera.test.ts`

- [ ] **Step 1: Chụp bộ ảnh `before` cho Phase P3 trước khi sửa code**
  Chạy:
  `pnpm shots -- --phase p3 --label before --scenes b1-start-room,b1-combat,b1-combat-low,b2-start-room,b2-combat,b3-start-room,b3-combat,hub-solo,boss-b2,boss-b2-blizzard,b1-combat-1440p,b1-combat-ultrawide,b1-combat-1280x1024,hub-solo-ultrawide,hub-solo-1280x1024`
- [ ] **Step 2: Viết unit test (TDD RED) cho thông số ánh sáng trong trẻo và tính toán zoom/neo HUD**
  Tạo `apps/client/test/polish-p3-lighting-camera.test.ts` kiểm tra:
  - Cấu hình ambient sáng của 3 biome + Hub (trung bình kênh `>= 0.84` và `<= 0.90`, không giảm tối khi `blizzardVeil` bật).
  - Hàm tính uniform zoom và `padX`/`padY` neo cạnh màn hình trên `1920×1080`, `2560×1440`, `2560×1080`, `1280×1024`.
- [ ] **Step 3: Cập nhật `texture-baker-fx.ts`, `lighting-pipeline.ts`, `combat-fx-pools.ts`, `combat-fx.ts`, `entity-sync.ts`, `GameScene.ts`**
  - Sửa `bakeLightRadialBrush` stops `0 / 0.35 / 0.7 / 1.0 → 1.0 / 0.6 / 0.2 / 0.0`.
  - Thêm `this.brushSprite.setBlendMode(Phaser.BlendModes.ADD)` trong `LightingPipeline`.
  - Nâng `ambientColor` cho Biome 1/2/3 & Hub; bỏ `mainPlayerVisionRadius` và `allyVisionRadius`; thêm pool 16 sprite `ADD` ấm (`depth: 35`) cho `torch_brazier`; đặt `vignetteStrength = 0.0`, `contrast = 0.98`, `bloomStrength = 0.14`.
  - Ẩn `glow_mushroom` ở Biome 2/3 & Hub (client-only trong `entity-sync.ts` và `lighting-pipeline.ts`).
  - Xóa hạt `mist` trong `combat-fx-pools.ts` và `combat-fx.ts`.
  - Làm lại `blizzardVeil` (Boss 2 Phase 3): giữ độ sáng sàn, kích hoạt `3×` hạt tuyết bay chéo trong `CombatFxManager`, vẽ khung băng sương `#CFE8EE` (`alpha <= 0.12`) ở 4 cạnh màn hình, phát SFX khi chuyển sang Phase 3.

---

### Task 2: Tách `HudScene` Độc Lập, Sửa Camera Uniform Zoom (`setZoom(zoom)`) & Neo HUD Đa Tỷ Lệ Màn Hình

**Files:**
- Create: `apps/client/src/scenes/HudScene.ts`
- Modify: `apps/client/src/main.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/MenuScene.ts`
- Modify: `apps/client/src/scenes/ArtGalleryScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `apps/client/src/ui/settings-modal.ts`
- Modify: `tests/e2e/phase2.spec.ts`

- [ ] **Step 1: Tạo `HudScene.ts` và đăng ký trong `main.ts`**
  - `HudScene` có camera độc lập (không gắn `BiomePostFxPipeline`, không có `lightmapRt`), cập nhật `cam.setZoom(zoom)` và `cam.centerOn(480, 270)`.
  - Tính `padX = Math.max(0, (viewW - 960) * 0.5)` và `padY = Math.max(0, (viewH - 540) * 0.5)`.
- [ ] **Step 2: Chuyển toàn bộ đối tượng HUD, Modal, Pause, DebugOverlay, Crosshair từ `GameScene` sang `HudScene` (`this.uiScene`) và neo cạnh màn hình**
  - Nhóm các phần tử HUD vào các container neo cạnh (`hudTopLeftContainer`, `hudTopCenterContainer`, `hudTopRightContainer`, `hudLeftEdgeContainer`, `hudBottomCenterContainer`) và vẽ lại thanh nền trên/dưới phủ kín `[-padX .. 960 + padX]`.
  - Cập nhật `DebugOverlay` và `ModalOverlayManager` để tương thích hoàn toàn với `HudScene` và giữ nguyên `window.__GAME_DEBUG__.scene === 'GameScene'`.
- [ ] **Step 3: Sửa `cam.setZoom(zoom)` đồng nhất ở `GameScene` (`arena-tiles.ts`), `MenuScene.ts`, `ArtGalleryScene.ts` và căn giữa camera khi viewport lớn hơn map**
  - Thay `cam.setZoom(zoomX, zoomY)` bằng `cam.setZoom(zoom)`.
  - Trong `updateCameraWithLookaheadAndShakeImpl`, dùng `viewW = cam.width / zoom`, `viewH = cam.height / zoom` để căn giữa khi `viewW >= map.width` hoặc `viewH >= map.height`.
- [ ] **Step 4: Cập nhật E2E test kiểm tra `HudScene` không có PostFX, uniform zoom (`zoomX === zoomY`) trên `2560×1080` và `1280×1024`**

---

### Task 3: Chuẩn Hóa Vùng Đo `metrics.json`, Chụp Ảnh `after` P3, Kiểm Định Định Lượng & Visual Gate (Blind A/B)

**Files:**
- Modify: `tests/e2e/helpers/visual-scene-helpers.ts`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`
- Create: `docs/screenshots/polish-p3/review.md`

- [ ] **Step 1: Cập nhật `ENVIRONMENT_SAMPLE_RECTS` trong `tests/e2e/helpers/visual-scene-helpers.ts`**
  - Căn chỉnh `brazier_pool` đúng vùng sàn cạnh chậu lửa (`torch_brazier` ở `(242, 148)` trong phòng dungeon và `(366, 317)` trong Hub) và đặt 4 vùng góc cách mọi nguồn sáng `>= 200u` theo Spec 3.5.
- [ ] **Step 2: Chụp bộ ảnh `after` của Phase P3 với `--verify-freeze` (cả có lighting và `?lighting=0`)**
  - Kiểm tra mọi chỉ số định lượng trong `docs/screenshots/polish-p3/after/metrics.json`:
    - `cornerToUnlitRatio >= 0.82` và `minCornerL >= 15` trên cả 3 biome & Hub.
    - `brazierToFloorDeltaL >= 8.0`.
    - `boss-b2-blizzard` giảm mean `L*` `<= 5%` so với `boss-b2`.
- [ ] **Step 3: Thiết lập Blind A/B và chạy `pro` Visual Reviewer đánh giá độc lập**
  - Ghi báo cáo vào `docs/screenshots/polish-p3/review.md`.
- [ ] **Step 4: Cập nhật `docs/PROGRESS.md` và `docs/PHASES.md`**
