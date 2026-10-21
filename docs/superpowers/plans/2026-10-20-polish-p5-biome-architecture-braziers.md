# Phase P5 — Bản sắc Kiến trúc Biome (`P1/P2/P3/P4`) & Chậu lửa Ven Tường Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện bản sắc kiến trúc cho cả 3 Biome & Hub theo đúng 4 đặc tả hình học (`P1/P2/P3/P4`) và 3 nguyên tắc môi trường trong Spec mục 3.5 & 4.P5, bám sát chuẩn thẩm mỹ của Phòng chuẩn B1 (`golden-room`) đã khóa ở Phase P4:
1. Chuẩn hóa số lượng chậu lửa (`torch_brazier`) theo loại phòng trong simulation (`start: 2`, `combat: 3–4`, `treasure: 2`, `merchant/shrine: 2`, `portal/secret: <= 2`, `boss: 6` đối xứng).
2. Hoàn thiện `apps/client/src/world/biome-architecture.ts`:
   - Chọn **2 trong 3 motif ven tường** theo seed & loại phòng (`selectedMotifs`) để các phòng cùng biome có biến thiên tự nhiên.
   - **P4 Chung & Hub:** Bệ đá giật cấp + giá đỡ sắt rèn vươn chéo `45°` treo chậu lửa khớp vị trí `torch_brazier` của phòng; cột đá rãnh (`fluted_column`) trên ô `pillar` và nửa cột gắn tường (`fluted_pilaster`) đổ bóng dài `48u` về Đông–Nam (`-135°`); gờ đá vỡ xen hàng rào sắt rèn mũi nhọn (`wrought_iron_fence`).
   - **Biome 1 (`P1 Rừng Cổ`):** Rễ cây cổ thụ Bezier S-curve tràn mép tường với đầu mút decal phẳng `2u`, cụm nấm phát quang + dây leo mặt đứng, đá bước chân trên ô sàn khô ven đầm độc/nước.
   - **Biome 2 (`P2 Hầm Băng`):** Sunken 3-Ring Ice Astrolabe (`70u/120u/165u`, vòng ngoài `<= 0.45 * min(w, h)` của Center Arena, 8 cung, bán nguyệt lệch tâm, `ΔL* 5–7`), hốc thác băng tường Bắc (`ice_alcove`), cụm pha lê vát cạnh (`frost_crystal_cluster`), và **2–3 dải tứ giác ánh sáng God-rays** chiếu xiên `-135°` (`rộng 60–90u`, `alpha 0.06 → 0`, tự động tắt ở `Low`).
   - **Biome 3 (`P3 Lò Rèn`):** Rãnh nhiệt âm sàn rộng `24–28u` có nắp lưới sắt rèn (`grated_heat_channel`, ánh dung nham lộ nhẹ qua khe lưới `alpha <= 0.30` nhịp thở chậm ở High/Medium, đứng yên ở Low), bánh răng đồng thau `8–12 răng` gắn tường quay chậm ở High/Medium (đứng yên ở Low), ống dẫn hơi nước mặt bích tán đinh (`steam_pipe_wall`), và đe rèn (`forge_anvil`) chỉ đặt trên ô `pillar`.
3. Thêm hạt than hồng bay lên (`<= 3.5px`, không viền đen, `BlendModes.ADD`) và hạt bụi sáng li ti lơ lửng trong vũng sáng chậu lửa (tự động tắt ở `Low`).
4. Kiểm chứng toàn diện bằng 5 nhóm unit test trong DoD P5, chụp 16 cảnh (`start`, `combat`, `chest`, `boss`, `boss-phase3`, `low` của 3 biome & Hub) với `--verify-freeze`, vượt qua `metrics.json` và cổng **Blind A/B `pro` Visual Reviewer Gate** (`Môi trường >= 8.5`).

**Architecture:**
- **`packages/shared/src/sim/sim-props-spawning.ts` & `sim-dungeon-rooms.ts`:** Điều chỉnh số lượng `torch_brazier` theo từng `room.type` (`start: 2`, `combat: 4` hoặc `3` theo seed ở các phòng combat phụ, `treasure: 2`, `merchant: 2`, `shrine: 2`, `portal: 2`, `secret: 0`, `boss: 6` đối xứng) mà vẫn giữ nguyên tọa độ chậu lửa góc Tây–Bắc `(8 * TILE_SIZE - 14, 5 * TILE_SIZE - 12)` để `ENVIRONMENT_SAMPLE_RECTS.brazier_pool` luôn đo chính xác.
- **`apps/client/src/world/biome-architecture.ts`:** Mở rộng `buildRoomArchitecturePlan` (nhận thêm danh sách tọa độ `braziers` tùy chọn để đặt `brazier_pedestal` khớp vị trí chậu lửa theo loại phòng; chọn 2/3 motif ven tường theo seed; thêm `fluted_column`, `fluted_pilaster`, `forge_anvil`, `godRays`), `getVisibleFloorDecals(plan, map)`, và quản lý lớp hiệu ứng động kiến trúc (`BiomeArchitectureLiveLayer`: God-rays B2, bánh răng đồng thau quay chậm & nhịp thở rãnh nhiệt B3, tự tắt ở `Low`).
- **`apps/client/src/fx/combat-fx.ts` & `GameScene.ts`:** Sinh hạt than hồng nhỏ (`<= 3.5px`, không viền) và bụi sáng li ti trong bán kính vũng sáng của `torch_brazier` khi `quality !== 'low'`.

**Tech Stack:** TypeScript, Phaser 3, Canvas 2D, Vitest, Playwright.

---

### Task 1: Số lượng Chậu lửa theo Loại phòng, Hoàn thiện `biome-architecture.ts` (P1/P2/P3/P4 + God-rays B2 + Bánh răng quay/Đe rèn/Rãnh nhiệt B3 + Hạt than hồng/Bụi sáng đuốc) & 5 Unit Tests DoD (TDD)

**Files:**
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `apps/client/src/world/biome-architecture.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/fx/combat-fx.ts`
- Modify: `apps/client/test/polish-p4-map-architecture.test.ts` (hoặc tạo `apps/client/test/polish-p5-biome-architecture.test.ts`)

- [ ] **Step 1: Thêm các cảnh thiếu (`b2-chest`, `b3-chest`, `b2-combat-low`) vào `visual-scenes.ts` và chụp bộ 16 ảnh `before` của Phase P5**
  - Trong `tests/e2e/helpers/visual-scenes.ts`: thêm `b2-chest` (phòng rương B2), `b3-chest` (phòng rương B3), và `b2-combat-low` (phòng combat B2 ở chất lượng Low, kèm `captureUnlit: true, sampleRects: ENVIRONMENT_SAMPLE_RECTS`), đồng thời gắn `captureUnlit: true, sampleRects: ENVIRONMENT_SAMPLE_RECTS` cho `boss-b1-phase3` và `boss-b3-phase3` để đo `centerDeltaL <= 8.0`.
  - Chạy `pnpm shots -- --phase p5 --label before --scenes hub-solo,b1-start-room,b1-combat,b1-combat-low,b1-chest-near,boss-b1,boss-b1-phase3,b2-start-room,b2-combat,b2-combat-low,b2-chest,boss-b2,b3-start-room,b3-combat,b3-combat-low,b3-chest,boss-b3,boss-b3-phase3` TRƯỚC khi sửa code sim/client của P5.

- [ ] **Step 2: Viết 5 nhóm Unit Test DoD Phase P5 (`apps/client/test/polish-p5-biome-architecture.test.ts`) và xác nhận RED**
  - Test (1): Ô trang trí không chặn đường đi giữa các cửa (BFS giữa các cửa Bắc/Nam/Đông/Tây luôn thông suốt 100%, không có decor nào thêm collision).
  - Test (2): Decor có khối (`hasVolume: true`, bao gồm `brazier_pedestal`, `fluted_column`, `fluted_pilaster`, `forge_anvil`, `brass_gear_wall`, `steam_pipe_wall`, `ice_alcove`, `frost_crystal_cluster`, `root_base`, `mushroom_cluster`, `cliff_vines`, `wrought_iron_fence`) chỉ nằm trên ô `wall`/`pillar`, riêng `forge_anvil` và `fluted_column` chỉ nằm trên ô `pillar`.
  - Test (3): Ngân sách mật độ (`largeDecorCount <= 8`, `smallPerimeterDecorCount <= Math.floor(perimeterTileCount / 3)`, `emptyPerimeterRatio >= 0.40`, `centerArenaSolidDecorCount === 0`), mỗi phòng biome chọn đúng `2` trong `3` motif ven tường (`plan.selectedMotifs.length === 2`), và số chậu lửa `torch_brazier` trong `WorldSim` đúng theo loại phòng (`start: 2`, `combat: 3..4`, `treasure: 2`, `merchant: 2`, `shrine: 2`, `portal: <= 2`, `boss: 6..8`).
  - Test (4): Không có decor phát sáng kiểu hazard ngoài surface thật của sim (`hasHazardGlow === false` trên mọi decor/decal, `stepping_stone` chỉ nằm trên ô khô `surface === 'none'`, `grated_heat_channel` luôn có `hasIronGrateCover === true` và không chạy qua Center Arena).
  - Test (5): Sau khi gọi `applyBossPhase3ToxicBorder()`, `applyBossPhase3BlizzardBorder()`, và `applyBossPhase3LavaBorder()`, `getVisibleFloorDecals(plan, map)` không còn bất kỳ decal sàn nào hiển thị trên ô có `surface !== 'none'`.
  - Chạy `npx vitest run apps/client/test/polish-p5-biome-architecture.test.ts` để ghi nhận RED.

- [ ] **Step 3: Triển khai số lượng chậu lửa theo loại phòng, hoàn thiện `biome-architecture.ts` (kèm God-rays B2, bánh răng đồng thau quay chậm & nhịp thở rãnh nhiệt B3, cột đá rãnh, đe rèn) và hạt than hồng/bụi sáng chậu lửa**
  - Cập nhật `packages/shared/src/sim/sim-props-spawning.ts` và `sim-dungeon-rooms.ts` cho số lượng `torch_brazier` theo loại phòng.
  - Cập nhật `apps/client/src/world/biome-architecture.ts`, `apps/client/src/scenes/GameScene.ts`, `apps/client/src/scenes/game-scene/arena-tiles.ts`, và `apps/client/src/fx/combat-fx.ts`.
  - Chạy `npx vitest run apps/client/test/polish-p5-biome-architecture.test.ts`, `pnpm typecheck`, `pnpm lint`, `pnpm test` xác nhận GREEN.

---

### Task 2: Chụp bộ 18 cảnh Phase P5 `after` với `--verify-freeze`, Kiểm chứng định lượng `metrics.json`, Blind A/B `pro` Visual Gate & Cập nhật Tài liệu

**Files:**
- Create: `docs/screenshots/polish-p5/review.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`

- [ ] **Step 1: Chụp 18 cảnh Phase P5 `after` với `--verify-freeze` và kiểm tra `metrics.json`**
  - Chạy `pnpm shots -- --phase p5 --label after --scenes hub-solo,b1-start-room,b1-combat,b1-combat-low,b1-chest-near,boss-b1,boss-b1-phase3,b2-start-room,b2-combat,b2-combat-low,b2-chest,boss-b2,b3-start-room,b3-combat,b3-combat-low,b3-chest,boss-b3,boss-b3-phase3 --verify-freeze`.
  - Xác nhận toàn bộ 18 cảnh đạt `diffRatio < 0.005` và mọi cảnh có `sampleRects` (bao gồm `boss-b1-phase3` và `boss-b3-phase3`) đạt `centerDeltaL <= 8.0`, `floorDeltaL <= 14.0`, `contrastWithInkDark >= 22.0`, `cornerToUnlitRatio >= 0.82`, `minCornerL >= 15.0`, `brazierToFloorDeltaL >= +8.0`, `clipWhiteRatio < 0.005`.

- [ ] **Step 2: Thiết lập Blind A/B, chạy `pro` Visual Reviewer Gate (kèm tham chiếu `golden-room`), lưu `docs/screenshots/polish-p5/review.md` và cập nhật `docs/PROGRESS.md` & `docs/PHASES.md`**
  - Tạo `.superpowers/sdd/2026-10-20-polish-p5-biome-architecture-braziers/blind-ab/` (`version-A` / `version-B`) và `ab-mapping.json`.
  - Dispatch `pro` Visual Reviewer subagent chấm điểm mù 18 cảnh kèm đối chiếu `docs/screenshots/polish-p4/golden-room/` (`Môi trường >= 8.5`, không rối mắt, không gây hiểu nhầm gameplay, không lệch phong cách so với phòng chuẩn).
  - Lưu `docs/screenshots/polish-p5/review.md`, cập nhật `docs/PROGRESS.md` & `docs/PHASES.md`, commit toàn bộ.
