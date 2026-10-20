# Phase P4 — Kiến trúc Map Hybrid: Phòng chuẩn B1, Palette `ENV`, Sàn "Tĩnh lặng giữa tâm", Tường 3D 3 lớp & Surface Kiến trúc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Triển khai kiến trúc Map Hybrid ("Chi tiết ven tường, Tĩnh lặng giữa tâm") cho Ashen Pact v0.2.0 theo quy trình 2 bước của Spec mục 3.5 & 4.P4:
- **Bước A (Task 1 — Phòng chuẩn B1 / Vertical Slice):** Chụp bộ ảnh `before` P4; cập nhật `ENV_PALETTE` trong `palette.ts`; viết lại `bakeBiomeTile`, `bakeWallTile`, `bakePillarTile`, `bakeWallAoOverlay` trong `texture-baker-tiles.ts` và `drawSurfaceTile` trong `texture-baker-surfaces.ts`; tính `distToWall` và phân vùng variant sàn (`distToWall <= 2` ven tường có mạch gạch `1×1`/`2×2` + lưới thoát nước sắt lõm vs `distToWall > 2` Center Arena phẳng mịn `ΔL* <= 8`) trong `arena-tiles.ts` + `apps/client/src/world/biome-architecture.ts`; dựng bộ decor tối thiểu cho Phòng chuẩn B1 (rễ cây cổ thụ Bezier S-curve tràn mép tường với đầu mút decal phẳng `2u`, cụm nấm phát quang + dây leo góc tường, đá bước chân trên ô khô ven đầm độc/nước, bệ đá chậu lửa & bóng đổ cột `-135°`); vượt qua ngưỡng định lượng `metrics.json` và cổng **Step A Blind A/B `pro` Visual Reviewer Gate** (`Criteria 1, 2, 3 >= 8.0`), sau đó khóa bộ ảnh `docs/screenshots/polish-p4/golden-room/*.png` và ghi thông số Phòng chuẩn vào `docs/ART_GUIDE.md`.
- **Bước B (Task 2 — Nhân rộng Hub, Biome 2, Biome 3 & Kiểm chứng toàn diện):** Áp dụng và tinh chỉnh đồng bộ kiến trúc Map Hybrid (`ENV` palette, sàn 2 vùng, tường 3D 3 lớp, bóng đổ `-135°`, surface bờ viền/rãnh đá vát, và `warmGlowPool` tương thích nền sáng B2) cho **Hub (`0`), Biome 2 (`2`), và Biome 3 (`3`)**; chụp toàn bộ 11 cảnh P4 `after` với `--verify-freeze`; đạt 100% ngưỡng định lượng `metrics.json` trên cả 3 biome & Hub; vượt qua **Step B Blind A/B `pro` Visual Reviewer Gate** (kèm đối chiếu nhất quán phong cách với `golden-room`); cập nhật `docs/PROGRESS.md` và `docs/PHASES.md`.

**Architecture:**
- **`apps/client/src/art/palette.ts`:** Thêm bảng màu `ENV_PALETTE` cho `0` (Hub — Khu Đá Cổ), `1` (B1 — Rừng Cổ), `2` (B2 — Hầm Băng), `3` (B3 — Lò Rèn) đúng thông số `floor`, `seam`, `var`, `wallTop`, `wallFront`, `shadow`, `rim`, `accent` trong Spec mục 3.5; mở rộng `getBiomeTheme(biome: 0 | 1 | 2 | 3)`.
- **`apps/client/src/world/biome-architecture.ts`:** Module thuần client tính `computeTileDistToWall(map, tx, ty)`, `resolveHybridFloorVariant(tx, ty, distToWall)`, sinh kế hoạch kiến trúc phòng `buildRoomArchitecturePlan(map, roomType, biome, seed)` tuân thủ nghiêm ngặt 3 nguyên tắc mục 3.5 (hướng sáng `-135°`, vật có khối chỉ trên `wall`/`pillar` còn trên sàn đi được chỉ có decal phẳng `ΔL* <= 10` tự ẩn khi `surface !== 'none'`, ngân sách mật độ `<= 8` decor lớn, `<= 1` decor nhỏ / 3 ô ven tường, `>= 40%` ô ven tường trống, `0` decor nổi ở Center Arena), và vẽ lớp kiến trúc lên `arenaGroundTex`.
- **`apps/client/src/art/texture-baker-tiles.ts` & `texture-baker-surfaces.ts`:**
  - `bakeBiomeTile`: bỏ viền `INK_DARK` từng ô, bỏ bóng hình chữ C, bỏ bevel sáng. Tách `variant 0..3` (ven tường `distToWall <= 2`: mạch gạch `1u` `ENV.seam`, đan xen gạch `1×1` và `2×2`, vết nứt mảnh, lưới thoát nước sắt lõm ở `variant 2`, và gạch chuyển tiếp `variant 3` ở `distToWall === 2`) và `variant 4..7` (Center Arena `distToWall > 2`: mặt đá phẳng mịn, mạch gạch mờ hẳn `alpha <= 0.08`, biến thiên tần số thấp `±2–3%` theo cụm 3–4 ô để `centerDeltaL <= 8`).
  - `bakeWallTile` & `bakePillarTile`: cấu trúc 3 lớp 3D (`Top Cap` màu `ENV.wallTop` sáng hơn sàn `ΔL* +12..18` có viền `INK_DARK` `2.2u` + rim-light `ENV.rim` ở cạnh Bắc/Tây; `South Cliff Face` cao `12u` màu `ENV.wallFront` tối hơn sàn `ΔL* -8..-12` có 2 hàng mạch đá ngang/dọc trầm tĩnh; bỏ hoàn toàn chấm glow lặp lại trên tường).
  - `bakeWallAoOverlay`: bóng tiếp xúc mềm `7u` (`alpha ~0.35`) dưới chân tường Bắc/Tây kết hợp vệt bóng đổ chéo về Đông–Nam (`14u`, `alpha ~0.22`, hướng sáng `-135°`) từ góc tường và trụ đá.
  - `drawSurfaceTile`: giảm độ bão hòa `~30%`, họa tiết nội vùng `ΔL* <= 10`; dựa theo `surfaceMask` vẽ bờ tự nhiên bo cong 2 lớp (`P1` cho `water`, `electrified_water`, `poison_swamp`, `grass`, `burning_grass`, `ice`) và gờ rãnh đá bazan vát `4u` (`P3` `#7F6559` / `#3B2D29` cho `lava`, `oil`, `burning_oil`, `conveyor`, `chasm`, `ash`).

**Tech Stack:** TypeScript, Phaser 3, Canvas 2D procedural texture baking, Vitest, Playwright.

---

### Task 1: Bước A — Phòng chuẩn B1 (Vertical Slice), Kiểm chứng định lượng `metrics.json`, Blind A/B `pro` Visual Gate & Khóa Phòng chuẩn (`golden-room` + `ART_GUIDE.md`)

**Files:**
- Modify: `tests/e2e/helpers/visual-scene-helpers.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Modify: `tools/visual-metrics.ts`
- Modify: `packages/shared/test/visual-metrics.test.ts`
- Create: `apps/client/test/polish-p4-map-architecture.test.ts`
- Modify: `apps/client/src/art/palette.ts`
- Create: `apps/client/src/world/biome-architecture.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Modify: `apps/client/src/art/texture-baker-tiles.ts`
- Modify: `apps/client/src/art/texture-baker-surfaces.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `docs/ART_GUIDE.md`

- [ ] **Step 1: Căn chỉnh `ENVIRONMENT_SAMPLE_RECTS`, cập nhật `tools/visual-metrics.ts` và chụp bộ ảnh `before` của Phase P4**
  - Trong `tests/e2e/helpers/visual-scene-helpers.ts`: đặt `floor_center` của `ENVIRONMENT_SAMPLE_RECTS` tại `{ name: 'floor_center', x: 832, y: 664, width: 128, height: 96 }` (tương ứng tọa độ thế giới `wx: 384..448, wy: 332..380`, `tx: 12..13, ty: 10..11`, `distToWall >= 4` — vùng sàn trống 100% ở Center Arena không vướng nhân vật, tâm ngắm `ui_crosshair`, quái, đạn, trụ đá hay bàn dẫm).
  - Trong `tests/e2e/helpers/visual-scenes.ts`: thêm `captureUnlit: true, sampleRects: ENVIRONMENT_SAMPLE_RECTS` cho `b1-poison-swamp`, `b3-lava-surface`, và `b3-combat-low`.
  - Trong `tools/visual-metrics.ts`: cập nhật `computeSceneEnvironmentSummary` để khi không có `floor_all`, `centerDeltaL` lấy từ `unlitRegions['center_arena']?.deltaL ?? unlitRegions['floor_center']?.deltaL` và `floorDeltaL` tính độ chênh `max(p95L) - min(p5L)` trên toàn bộ các vùng sàn (`floor_center` + `corner_*`), giúp đo chính xác cả `centerDeltaL <= 8` lẫn `floorDeltaL <= 14`.
  - Chạy `pnpm shots -- --phase p4 --label before --scenes b1-start-room,b1-combat,b1-combat-low,b1-poison-swamp,b2-start-room,b2-combat,b3-start-room,b3-combat,b3-lava-surface,b3-combat-low,hub-solo` TRƯỚC khi sửa bất kỳ code render nào trong `apps/client`.

- [ ] **Step 2: Viết unit test TDD (`apps/client/test/polish-p4-map-architecture.test.ts`) và xác nhận RED**
  - Kiểm tra bảng màu `ENV_PALETTE` (`0, 1, 2, 3`), độ sáng `L*` của `floor` (`28–40` cho Hub/B1/B3, `40–50` cho B2), và độ tương phản với `INK_DARK` (`>= 22`).
  - Kiểm tra `computeTileDistToWall` và `resolveHybridFloorVariant` (`variant 0..3` khi `distToWall <= 2`, `variant 4..7` khi `distToWall > 2`, lưới thoát nước sắt lõm `variant 2` chỉ ở `distToWall === 1`).
  - Kiểm tra `buildRoomArchitecturePlan` cho B1 tuân thủ 3 nguyên tắc mục 3.5: vật có khối chỉ trên `wall`/`pillar`; `0` decor nổi trong Center Arena; `stepping_stone` chỉ nằm trên ô sàn khô (`surface === 'none'`) cạnh `poison_swamp`/`water`; decal sàn tự ẩn khi `surface !== 'none'` (bao gồm sau `applyBossPhase3ToxicBorder()`); ngân sách mật độ (`<= 8` decor lớn, `<= 1` decor nhỏ / 3 ô ven tường, `>= 40%` ô ven tường để trống).
  - Chạy `npx vitest run apps/client/test/polish-p4-map-architecture.test.ts` để ghi nhận trạng thái RED.

- [ ] **Step 3: Triển khai `ENV_PALETTE`, Sàn Hybrid, Tường 3D 3 lớp, Surface kiến trúc và Phòng chuẩn B1 (`biome-architecture.ts`)**
  - Cập nhật `apps/client/src/art/palette.ts`, `apps/client/src/world/biome-architecture.ts`, `apps/client/src/art/texture-baker.ts`, `apps/client/src/art/texture-baker-tiles.ts`, `apps/client/src/art/texture-baker-surfaces.ts`, `apps/client/src/scenes/GameScene.ts`, và `apps/client/src/scenes/game-scene/arena-tiles.ts`.
  - Chạy `npx vitest run apps/client/test/polish-p4-map-architecture.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm test` xác nhận GREEN.

- [ ] **Step 4: Chụp ảnh Bước A (`b1-start-room,b1-combat,b1-combat-low,b1-poison-swamp`) với `--verify-freeze`, kiểm tra `metrics.json`, chạy Step A Blind A/B `pro` Visual Gate & Khóa Phòng chuẩn**
  - Chạy `pnpm shots -- --phase p4 --label after --scenes b1-start-room,b1-combat,b1-combat-low,b1-poison-swamp --verify-freeze`.
  - Xác nhận `docs/screenshots/polish-p4/after/metrics.json` đạt toàn bộ ngưỡng mục 3.5 cho B1 (`floorMeanL` `28–40`, `centerDeltaL <= 8.0`, `floorDeltaL <= 14.0`, `floorMeanS <= 0.35`, `contrastWithInkDark >= 22.0`, `cornerToUnlitRatio >= 0.82`, `minCornerL >= 15.0`, `brazierToFloorDeltaL >= +8.0`, `clipWhiteRatio < 0.005`).
  - Thiết lập thư mục `.superpowers/sdd/2026-10-20-polish-p4-hybrid-map-architecture/blind-ab-step-a/` và chạy `pro` Visual Reviewer Gate cho Phòng chuẩn B1 (`Criteria 1, 2, 3 >= 8.0`, `0 blocker`, `0 major`).
  - Sao chép bộ ảnh Phòng chuẩn B1 đã đạt vào `docs/screenshots/polish-p4/golden-room/` và cập nhật mục "Phòng chuẩn (Golden Room B1 — Khóa tại Phase P4)" trong `docs/ART_GUIDE.md`.

---

### Task 2: Bước B — Nhân rộng cho Hub, Biome 2, Biome 3, Kiểm chứng định lượng 11 cảnh, Step B Blind A/B `pro` Visual Gate & Tài liệu

**Files:**
- Modify: `apps/client/src/fx/lighting-pipeline.ts` (nếu cần tinh chỉnh `warmGlowPool` ở B2 để đạt `brazierToFloorDeltaL >= +8.0` trên nền `#446E78` sáng `L* ~ 44`)
- Modify: `apps/client/src/world/biome-architecture.ts`
- Modify: `apps/client/src/art/texture-baker-tiles.ts`
- Modify: `apps/client/src/art/texture-baker-surfaces.ts`
- Modify: `apps/client/test/polish-p4-map-architecture.test.ts`
- Create: `docs/screenshots/polish-p4/review.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`

- [ ] **Step 1: Hoàn thiện & kiểm chứng `ENV` palette, sàn 2 vùng, tường 3D 3 lớp, bóng đổ `-135°`, và surface kiến trúc trên Hub (`0`), Biome 2 (`2`), Biome 3 (`3`)**
  - Bổ sung unit test cho Hub (`0`), Biome 2 (`2`), và Biome 3 (`3`) trong `apps/client/test/polish-p4-map-architecture.test.ts`.
  - Đảm bảo ở Biome 2 (nền `#446E78` có `L* ≈ 43.8`), vũng sáng chậu lửa (`warmGlowPool`) vẫn đạt `brazierToFloorDeltaL >= +8.0` và `clipWhiteRatio < 0.005`.

- [ ] **Step 2: Chụp toàn bộ 11 cảnh Phase P4 `after` với `--verify-freeze` và xác nhận 100% ngưỡng `metrics.json`**
  - Chạy `pnpm shots -- --phase p4 --label after --scenes b1-start-room,b1-combat,b1-combat-low,b1-poison-swamp,b2-start-room,b2-combat,b3-start-room,b3-combat,b3-lava-surface,b3-combat-low,hub-solo --verify-freeze`.
  - Kiểm tra `docs/screenshots/polish-p4/after/metrics.json` trên toàn bộ các cảnh có `sampleRects` của Hub, B1, B2, B3:
    - `floorMeanL`: `28–40` (Hub, B1, B3) và `40–50` (B2)
    - `centerDeltaL <= 8.0` và `floorDeltaL <= 14.0`
    - `floorMeanS <= 0.35` (`<= 0.40` cho B2)
    - `contrastWithInkDark >= 22.0`
    - `cornerToUnlitRatio >= 0.82` và `minCornerL >= 15.0`
    - `brazierToFloorDeltaL >= +8.0`
    - `clipWhiteRatio < 0.005`

- [ ] **Step 3: Thiết lập Blind A/B cho toàn bộ 11 cảnh, chạy Step B `pro` Visual Reviewer Gate (kèm ảnh `golden-room` tham chiếu phong cách), lưu `docs/screenshots/polish-p4/review.md` và cập nhật `docs/PROGRESS.md` & `docs/PHASES.md`**
  - Tạo `.superpowers/sdd/2026-10-20-polish-p4-hybrid-map-architecture/blind-ab/` (`version-A` / `version-B`) và `ab-mapping.json`.
  - Dispatch `pro` Visual Reviewer subagent chấm điểm mù 11 cặp ảnh cùng bộ ảnh khóa `docs/screenshots/polish-p4/golden-room/`.
  - Lưu báo cáo vào `docs/screenshots/polish-p4/review.md`, cập nhật `docs/PROGRESS.md` và `docs/PHASES.md`, commit toàn bộ.
