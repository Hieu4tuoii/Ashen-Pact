# Phase P2 — Vũ Khí 2 Ô, Rơi Vũ Khí & Vòng Emote Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển hệ thống vũ khí từ 4 ô cố định sang tối đa 2 ô (`MAX_WEAPON_SLOTS = 2`), thêm cơ chế rơi vũ khí đang cầm ra đất (shared `worldItem` có `costGold = 0`, animation văng nảy cung `0.25s` + bob + glow độ hiếm) khi nhặt/mua lúc đầy, xóa `worldItems` đã nhặt (không có `offerId`) để chống phình snapshot, tự bổ sung kệ vũ khí ở Hub, cập nhật bot autoplay theo DPS, tách phím `1/2` chọn vũ khí khỏi vòng biểu cảm giữ phím `T`, và cập nhật HUD 2 ô (không còn "vũ khí ma").

**Architecture:**
1. **Shared Simulation (`packages/shared`):** Định nghĩa `MAX_WEAPON_SLOTS = 2` trong `weapons.ts`, cập nhật loadout khởi đầu `[starterWeaponId, 'rusty_pistol']` (Thiết Vệ dùng `['knight_sword', 'rusty_pistol']`), thêm helper chung `spawnDroppedWeapon` dùng cho cả `dropActiveWeaponImpl` và `pickupOrBuyWorldItemImpl`, phát `weapon_dropped` và `weapon_swapped` kèm `playerId`, khóa nhặt lại `0.3s` (`18` ticks), xóa item `pickedUp` không có `offerId` khỏi `worldItems`, giữ đồ rơi ở cả phòng `start` (`id === 0`), tự bổ sung kệ vũ khí Hub, và cập nhật AI bot (`droppedByPlayerId` + so sánh DPS ước tính).
2. **Client HUD, Input, Vòng Emote & FX (`apps/client`):** Cập nhật HUD 2 ô theo `MAX_WEAPON_SLOTS` (ô trống hiển thị trạng thái trống, bỏ fallback `PHASE1_SAMPLE_WEAPONS`), tách phím `1/2` (chọn ô vũ khí) khỏi vòng biểu cảm giữ phím `T` (4 lựa chọn chọn bằng chuột hoặc `1–4` khi đang giữ `T`), giới hạn phím `1–3` chọn buff chỉ khi mở modal buff, và vẽ hiệu ứng văng nảy cung `0.25s` + glow độ hiếm cho vũ khí rơi.
3. **Kiểm chứng (TDD + E2E Co-op + Visual Gate):** Unit test đầy đủ cho cơ chế 2 ô / rơi vũ khí / chống phình snapshot 200 lần đổi / bot autoplay; E2E co-op 2 client kiểm chứng P1 nhặt khi đầy → P2 thấy vũ khí rơi và nhặt được; chụp strip 8 frame quỹ đạo vũ khí rơi (`b1-weapon-drop-strip.png`) và đánh giá qua Visual Reviewer (blind A/B).

**Tech Stack:** TypeScript 5.6, Vitest, Phaser 3.85, Colyseus 0.15, Playwright E2E.

---

## Cấu Trúc File Tạo Mới / Chỉnh Sửa

- **Chỉnh sửa (`packages/shared`):**
  - `packages/shared/src/data/weapons.ts` — Thêm và export `MAX_WEAPON_SLOTS = 2` và helper `estimateWeaponDps(weaponId: string): number`.
  - `packages/shared/src/sim/world-sim-types.ts` — Cập nhật `PHASE1_SAMPLE_WEAPONS = ['knight_sword', 'rusty_pistol'] as const`, thêm các trường `droppedByPlayerId?: number`, `droppedAtTick?: number`, `fromX?: number`, `fromY?: number`, `isHubRackItem?: boolean` vào `SimWorldItemState`, và `weaponPickupLockTimer?: number` vào `SimPlayerState`.
  - `packages/shared/src/sim/world-sim-events.ts` — Thêm `playerId: number` vào `weapon_swapped`, và thêm sự kiện `weapon_dropped` (`playerId`, `itemId`, `weaponId`, `rarity`, `fromX`, `fromY`, `x`, `y`).
  - `packages/shared/src/sim/sim-coop-hub.ts` — Khởi tạo `weaponSlots: [cDef.starterWeaponId, 'rusty_pistol'].slice(0, MAX_WEAPON_SLOTS)`, đánh dấu `isHubRackItem: true` cho vũ khí trên kệ Hub, xóa sạch đồ rơi khi `startDungeonRunFromHubImpl`, viết helper `spawnDroppedWeaponImpl` và dùng chung trong `dropActiveWeaponImpl`.
  - `packages/shared/src/sim/sim-dungeon-rooms.ts` — Bỏ điều kiện `room.id !== 0` trong `populateRoomContentsImpl` để giữ đồ rơi ở phòng start (`id === 0`); trong `pickupOrBuyWorldItemImpl`: kiểm tra khóa `0.3s`, tự bổ sung lại kệ vũ khí Hub nếu `item.isHubRackItem`, xóa item không có `offerId` khỏi `worldItems` sau khi gán `item.pickedUp = true`, và khi đầy `MAX_WEAPON_SLOTS` thì gọi `spawnDroppedWeapon` tại vị trí `(item.x, item.y)` rồi thay vào ô đang cầm.
  - `packages/shared/src/sim/sim-props-spawning.ts` — Cập nhật `configureStressTestImpl` để `weaponSlots` có đúng 2 ô và `activeWeaponSlot = 1`; thêm `playerId: this.player.id` vào `weapon_swapped` trong `equipWeaponSlotImpl`.
  - `packages/shared/src/sim/sim-player.ts` — Giảm `p.weaponPickupLockTimer` theo `dtSec`; khi đồng đội đổi vũ khí qua `selectedSlot` hoặc `INPUT_BUTTON.SWAP`, phát `weapon_swapped` có `playerId: p.id`.
  - `packages/shared/src/sim/sim-progression-bot.ts` — Trong `interactWithNearestImpl` và `stepBotAutoPlayImpl`: tôn trọng khóa `weaponPickupLockTimer`, bot không nhặt lại vũ khí do chính mình vừa thả (`droppedByPlayerId` + cooldown) và chỉ nhặt khi DPS ước tính cao hơn vũ khí đang có (ưu tiên thay ô yếu nhất và luôn giữ ít nhất 1 vũ khí tầm xa).
  - `packages/shared/src/sim/world-sim.ts` — Đăng ký method `spawnDroppedWeapon` trên `WorldSim`.
  - `packages/shared/src/i18n/vi.json` & `packages/shared/src/i18n/en.json` — Cập nhật chuỗi `hubStatsHint`, `weaponCompareHeader`, `swapDrop`, `swapWeapon`, `mapPing`, `emote`, `pause` (`[G/X]` → `[X]`, `1-4` → `1-2`, vòng biểu cảm giữ `T`).
- **Chỉnh sửa (`apps/client`):**
  - `apps/client/src/scenes/GameScene.ts` — Thêm state cho vòng biểu cảm (`emoteWheelOpen`, `emoteWheelHoveredId`, `emoteWheelContainer`, phím `T`) và kiểu `glow` cho `worldItemSprites`.
  - `apps/client/src/scenes/game-scene/input-and-network.ts` — Phím `1/2` chọn ô vũ khí `0/1` (hoặc chọn buff khi `runState === 'buff_choice'`, hoặc chọn emote `1/2` khi đang giữ `T`); phím `3` chọn buff `2` khi `runState === 'buff_choice'` hoặc emote `3` khi giữ `T`; phím `4` chọn emote `4` khi giữ `T`; giữ `T` mở vòng biểu cảm và nhả `T` / click chuột kích hoạt emote đang trỏ.
  - `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `arena-tiles.ts` — Render đúng `MAX_WEAPON_SLOTS` (2 ô), hiển thị `Ô Trống` / `Empty Slot` khi chỉ còn 1 vũ khí, bỏ hoàn toàn fallback `PHASE1_SAMPLE_WEAPONS`.
  - `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts` — Vẽ vòng biểu cảm 4 hướng khi giữ `T` (`updateEmoteWheelHudImpl`) và cập nhật nhãn phím emote ở bảng Hub thành `[T+1..4]`.
  - `apps/client/src/scenes/game-scene/room-entities-sync.ts` & `sim-events.ts` — Hiệu ứng vũ khí rơi văng nảy cung `0.25s` (`fromX, fromY` → `x, y`) rồi bob kèm glow `BlendMode.ADD` theo độ hiếm; xử lý event `weapon_dropped` và `weapon_swapped` (lọc SFX theo `playerId` hoặc vị trí).
  - `apps/client/src/ui/debug-overlay.ts` & `hud-modals-and-debug.ts` — Thêm `emoteWheelOpen: boolean` vào `window.__GAME_DEBUG__`.
- **Tạo mới / Chỉnh sửa (Tests & Docs):**
  - `packages/shared/test/polish-p2-weapons.test.ts` (Tạo mới — Unit test TDD cho toàn bộ cơ chế Phase P2).
  - `packages/shared/test/phase1-sim.test.ts`, `phase2-sim.test.ts`, `phase4-coop.test.ts` — Cập nhật theo `MAX_WEAPON_SLOTS = 2`.
  - `tests/e2e/phase1.spec.ts` & `tests/e2e/phase4.spec.ts` — Cập nhật test 2 ô vũ khí, vòng emote `T`, và thêm kiểm chứng E2E Co-op 2 client: P1 nhặt khi đầy → P2 thấy vũ khí rơi và nhặt được.
  - `tests/e2e/helpers/visual-scenes.ts` & `tests/e2e/visual.spec.ts` — Thêm `stripFramesPerStep?: number`, cảnh `b1-weapon-drop` (kèm strip 8 frame quỹ đạo văng nảy `0.25s`) và `ui-emote-wheel`.
  - `docs/GDD.md`, `docs/PROGRESS.md`, `docs/PHASES.md`.

---

## Task 1: Shared 2-Slot Weapon System (`MAX_WEAPON_SLOTS = 2`), `spawnDroppedWeapon`, Snapshot Cleanup, Hub Rack & Bot Autoplay (TDD)

**Files:**
- Create: `packages/shared/test/polish-p2-weapons.test.ts`
- Modify: `packages/shared/src/data/weapons.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/world-sim-events.ts`
- Modify: `packages/shared/src/sim/sim-coop-hub.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-player.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/test/phase1-sim.test.ts`
- Modify: `packages/shared/test/phase2-sim.test.ts`
- Modify: `packages/shared/test/phase4-coop.test.ts`
- Modify: `docs/GDD.md`

- [ ] **Step 1: Chụp bộ ảnh `before` của Phase P2 trước khi sửa code**
  Chạy lệnh:
  ```bash
  pnpm shots -- --phase p2 --label before --scenes hub-solo,b1-start-room,b1-combat,b1-weapon-ground-near
  ```
  Xác nhận thư mục `docs/screenshots/polish-p2/before/` có đủ 4 ảnh (`hub-solo.png`, `b1-start-room.png`, `b1-combat.png`, `b1-weapon-ground-near.png`).

- [ ] **Step 2: Viết unit test TDD (`packages/shared/test/polish-p2-weapons.test.ts`) và chạy xác nhận RED**
  Kiểm tra đầy đủ 8 kịch bản:
  1. `MAX_WEAPON_SLOTS === 2` và mọi nhân vật khởi đầu với `[starterWeaponId, 'rusty_pistol']` (Thiết Vệ: `['knight_sword', 'rusty_pistol']`).
  2. Nhặt vũ khí khi đầy (`2/2`): vũ khí đang cầm được spawn thành `worldItem` shared (`costGold: 0`, `ownerPlayerId: undefined`) tại đúng tọa độ `(item.x, item.y)` của món vừa nhặt, thay vũ khí mới vào `activeWeaponSlot`, phát `weapon_dropped` và `weapon_swapped` có `playerId`.
  3. Mua vũ khí ở Merchant khi đầy (`2/2`): trừ vàng, đánh dấu `offer.purchased = true`, giữ lại item có `offerId` với `pickedUp: true`, đồng thời spawn vũ khí cũ thành `worldItem` shared (`costGold: 0`) tại vị trí của món vừa mua.
  4. Khóa `0.3s` (`18` ticks): người chơi vừa đổi vũ khí không thể nhặt lại món vừa rơi trong `< 18` ticks (`0.3s`), nhưng đồng đội `P2` nhặt được ngay lập tức hoặc chính `P1` nhặt lại được sau `>= 18` ticks.
  5. Chống phình snapshot: thực hiện 200 lần đổi/nhặt vũ khí liên tiếp (mỗi lần tiến `18` ticks), xác nhận `sim.worldItems.length` không tăng và `estimateSnapshotBytes(encodeWorldSnapshot(sim, []))` không tăng quá `64` bytes so với lần đổi thứ 1.
  6. Giữ đồ rơi ở phòng `start` (`id === 0`): thả hoặc đổi vũ khí ở phòng `0`, sang phòng khác rồi quay lại phòng `0` vẫn còn nguyên vũ khí rơi trên sàn.
  7. Kệ vũ khí Hub tự bổ sung ngay khi được nhặt (4 vị trí kệ luôn có vũ khí), và khi gọi `startDungeonRunFromHub()` thì mọi vũ khí rơi ở Hub bị xóa sạch.
  8. Bot autoplay không nhặt lại vũ khí do chính mình vừa thả (`droppedByPlayerId`) hoặc có DPS thấp hơn, không bị kẹt vòng lặp nhặt-thả.

- [ ] **Step 3: Triển khai logic 2 ô vũ khí & rơi vũ khí trong `packages/shared` và cập nhật `docs/GDD.md`**
  - Trong `packages/shared/src/data/weapons.ts`: export `MAX_WEAPON_SLOTS = 2` và `estimateWeaponDps(weaponId: string): number`.
  - Cập nhật `world-sim-types.ts`, `world-sim-events.ts`, `sim-coop-hub.ts`, `sim-dungeon-rooms.ts`, `sim-props-spawning.ts`, `sim-player.ts`, `sim-progression-bot.ts`, `world-sim.ts`.
  - Cập nhật `phase1-sim.test.ts`, `phase2-sim.test.ts`, `phase4-coop.test.ts` và `docs/GDD.md`.

- [ ] **Step 4: Chạy toàn bộ Vitest unit tests & typecheck確認 GREEN**
  Chạy:
  ```bash
  npx vitest run packages/shared/test/polish-p2-weapons.test.ts
  pnpm test
  pnpm typecheck
  pnpm lint
  ```
  Xác nhận toàn bộ unit test (bao gồm `phase3-sim.test.ts` bot autoplay victory) đều PASS với 0 lỗi.

---

## Task 2: Client 2-Slot HUD, `T` Hold Emote Wheel, `0.25s` Weapon Toss Arc + Rarity Glow, i18n & E2E Tests

**Files:**
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/ui/debug-overlay.ts`
- Modify: `tests/e2e/phase1.spec.ts`
- Modify: `tests/e2e/phase4.spec.ts`

- [ ] **Step 1: Cập nhật i18n (`vi.json`, `en.json`) và HUD 2 ô không còn "vũ khí ma"**
  - Thay `[G/X]` bằng `[X]`, `1-4` bằng `1-2`, bổ sung hướng dẫn giữ phím `T` mở vòng biểu cảm trong `vi.json` và `en.json`.
  - Trong `hud-setup-and-pause.ts`, `hud-combat-and-coop.ts`, `arena-tiles.ts`: dựng đúng `MAX_WEAPON_SLOTS` (2 ô) vũ khí; khi `p.weaponSlots[idx]` trống thì ẩn icon và hiển thị `[2] Ô Trống` (`Empty Slot`), tuyệt đối không fallback về `PHASE1_SAMPLE_WEAPONS`.

- [ ] **Step 2: Triển khai vòng biểu cảm giữ phím `T` và tách phím số `1/2`**
  - Trong `input-and-network.ts` và `GameScene.ts`:
    - Phím `1`/`2`: nếu `sim.runState === 'buff_choice'` thì chọn buff `0`/`1`; nếu đang giữ `T` (`this.keys.T.isDown`) thì chọn emote `1`/`2`; ngược lại chọn ô vũ khí `0`/`1`.
    - Phím `3`: nếu `sim.runState === 'buff_choice'` thì chọn buff `2`; nếu đang giữ `T` thì chọn emote `3`.
    - Phím `4`: nếu đang giữ `T` thì chọn emote `4`.
    - Khi giữ `T` (và không mở modal/pause): bật `this.emoteWheelOpen = true`, vẽ vòng biểu cảm 4 góc phần tư ở giữa màn hình (`updateEmoteWheelHudImpl` trong `hud-hub-and-cards.ts`), cho phép rê chuột chọn góc phần tư và click chuột hoặc nhả phím `T` (hoặc nhấn `1–4`) để phát emote.

- [ ] **Step 3: Hiệu ứng văng nảy cung `0.25s` + bob + glow độ hiếm cho vũ khí rơi**
  - Trong `room-entities-sync.ts`:
    - Mỗi `worldItemSprites` có thêm `glow: Phaser.GameObjects.Graphics` (`BlendMode.ADD`, depth `25`) vẽ hào quang màu độ hiếm `WEAPON_RARITY_COLORS[it.rarity]` dưới vũ khí.
    - Nếu `it.droppedAtTick !== undefined` và `(sim.tick - it.droppedAtTick) / 60 < 0.25`: nội suy vị trí từ `(it.fromX ?? it.x, it.fromY ?? it.y)` tới `(it.x, it.y)` kết hợp quỹ đạo parabol nảy 2 nhịp (`0.25s`) và góc xoay nhẹ, sau đó chuyển mượt sang nhịp bobbing hình sin.
  - Trong `sim-events.ts`: xử lý `weapon_dropped` (tạo transient light theo độ hiếm + phát SFX cho người thả hoặc theo vị trí) và `weapon_swapped` (chỉ phát SFX cho người đổi hoặc theo vị trí).

- [ ] **Step 4: Cập nhật `tests/e2e/phase1.spec.ts` và `tests/e2e/phase4.spec.ts` (thêm test Co-op 2 client đổi/nhặt vũ khí rơi)**
  - Trong `tests/e2e/phase1.spec.ts`: kiểm tra 2 vũ khí khởi đầu bằng `Digit1` / `Digit2`, sau đó nhặt `scrap_shotgun` thay vào ô đang cầm và bắn kiểm chứng hit-feel.
  - Trong `tests/e2e/phase4.spec.ts`: cập nhật thao tác emote bằng giữ `KeyT` + `Digit1`; bổ sung kiểm chứng E2E Co-op 2 client: P1 đang đầy 2 ô nhặt vũ khí mới → vũ khí cũ rơi ra đất thành `worldItem` shared → P2 nhìn thấy vũ khí rơi và nhấn `E` nhặt được vào kho vũ khí của P2.
  - Chạy `npx playwright test tests/e2e/phase1.spec.ts tests/e2e/phase4.spec.ts` xác nhận PASS với 0 console error/warning.

---

## Task 3: Cảnh Chụp Visual Phase P2 (`b1-weapon-drop` Strip 8 Frame, `ui-emote-wheel`), Visual Gate & Tài Liệu

**Files:**
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Create/Update: `docs/screenshots/polish-p2/after/*`
- Create: `docs/screenshots/polish-p2/review.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`

- [ ] **Step 1: Thêm `stripFramesPerStep?: number` vào `VisualSceneDef` và thêm 2 cảnh `b1-weapon-drop` (kèm strip 8 frame) & `ui-emote-wheel`**
  - Trong `tests/e2e/helpers/visual-scenes.ts` và `tests/e2e/visual.spec.ts`:
    - Hỗ trợ `stripFramesPerStep?: number` (mặc định `5`).
    - Thêm cảnh `b1-weapon-drop` (`captureStrip: true`, `stripFramesPerStep: 2`): người chơi ở phòng `b1-start-room` vừa thả/đổi vũ khí Epic/Legendary (`solar_archon_staff` hoặc `frost_scepter`), chụp 8 frame liên tiếp thể hiện rõ cung văng nảy `0.25s`, hào quang độ hiếm và thanh HUD 2 ô.
    - Thêm cảnh `ui-emote-wheel`: người chơi đang giữ phím `T` mở vòng biểu cảm 4 lựa chọn trên màn hình, trỏ chuột vào lựa chọn `[1] Tiến lên!`.

- [ ] **Step 2: Chụp bộ ảnh `after` của Phase P2 và thiết lập Blind A/B**
  - Chạy:
    ```bash
    pnpm shots -- --phase p2 --label after --scenes hub-solo,b1-start-room,b1-combat,b1-weapon-ground-near,b1-weapon-drop,ui-emote-wheel --verify-freeze
    ```
  - Tạo thư mục `.superpowers/sdd/2026-10-20-polish-p2-two-weapons/blind-ab/version-A` và `version-B` cho 4 cảnh đối chiếu (`hub-solo.png`, `b1-start-room.png`, `b1-combat.png`, `b1-weapon-ground-near.png`) kèm file ánh xạ `.superpowers/sdd/2026-10-20-polish-p2-two-weapons/ab-mapping.json`.

- [ ] **Step 3: Chạy Independent Visual Reviewer (`pro`), lưu `docs/screenshots/polish-p2/review.md` và cập nhật `PROGRESS.md`, `PHASES.md`**
  - Đánh giá mù `version-A` vs `version-B` cùng ảnh `b1-weapon-drop.png`, `b1-weapon-drop-strip.png`, `ui-emote-wheel.png`.
  - Lưu báo cáo vào `docs/screenshots/polish-p2/review.md`, cập nhật `docs/PROGRESS.md` và đánh dấu `[x]` Phase P2 trong `docs/PHASES.md`.
