# Ashen Pact 2.0 — Phase P0A: Hạ Tầng Nền, The Purge, Per-Player State & Đồng Bộ Đạn Tất Định 60Hz

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thực hiện sạch sẽ toàn bộ các cải tiến kiến trúc nền tảng cho Ashen Pact 2.0: cắt bỏ triệt để hệ thống Thanh Năng Lượng (`energy`), xóa 6 vũ khí clone (`24 -> 18` vũ khí độc bản) và 6 thẻ cộng chỉ số phẳng (`Stat-Sticks`), khởi tạo nhân vật với đúng 1 vũ khí khởi đầu ở Ô 1 (`starterWeapons = [cDef.starterWeaponId]`), tách `Per-Player Build State` + `Instanced Gold`, cài đặt kiến trúc đồng bộ đạn tất định 2 tầng 60Hz (`INPUT_BUTTON.RELOAD_VENT`, `SHOT_FLAG`, `deterministicId`, `Zero-Rubberband Client Hold`, `projectiles_destroyed`, ưu tiên gói `snapshot-codec.ts` lên `64` events, nâng trần Object Pool), và cập nhật HUD thay thanh Energy bằng thanh Nhịp Vũ Khí (`CLIP_RELOAD` / `HEAT_VENT` / `MELEE_COMBO`).

**Architecture:** Giữ nguyên kiến trúc deterministic simulation 60Hz trong `@ashen-pact/shared`, server Colyseus trong `@ashen-pact/server` và client Phaser 3 trong `@ashen-pact/client`. Mọi file `.ts` bắt buộc giữ `< 1000 dòng`. Các thay đổi nền tảng trong Phase P0A chuẩn bị trực tiếp các trường dữ liệu (`cadenceKind`, `clipSize`, `reloadDurationSec`, `heatPerShot`, `procCoefficient`, `blessingIds`, `weaponMutators`, `duoBoonIds`, `activePactId`, `awakenedRelicIds`, `buffChoices`) cho các Phase P0B → P5.

**Tech Stack:** TypeScript `strict`, Vitest, Playwright, Phaser 3, Colyseus, `pnpm` workspaces.

**Spec:** `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Phần 1 `1.1–1.3`, Phần 3 `3.1–3.3`, Phần 4 `4.1`, Phần 7 `7.1–7.2`, Phần 8 `Phase 0A`) & `master-promt-v3.md` (Mục `Phase P0A`).

**Global Constraints:**
- Không một file `.ts` nào trong toàn bộ dự án được vượt quá `1000 dòng`.
- Mọi phép ngẫu nhiên trong `packages/shared/src/sim/` bắt buộc đi qua `SeededRng` của `WorldSim` (cấm `Math.random()`).
- Mọi viên đạn sinh ra từ `spawnDeterministicVolleyImpl` phải dùng `const deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f);`.
- Đạn có cờ `SHOT_FLAG.DYNAMIC_BOUNCE` khi chạm tường/bia chắn/lăng kính trên Client phải áp dụng `Zero-Rubberband Client Hold` (`b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12`).
- Khóa cứng trần Object Pool: `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`.
- Song ngữ Việt – Anh (`vi.json` & `en.json`) đồng bộ 100%, không cắt dấu tiếng Việt.
- Tất cả lệnh đọc/ghi/chạy test phải thực hiện bên trong worktree `c:\Freelancer\game-coop-team\.worktrees\overhaul-v2.0`.

**Review Focus:**
- Đảm bảo không còn bất kỳ tham chiếu nào tới `energy`, `maxEnergy`, `energyRegen`, `energyCost`, hay pickup `kind: 'energy'` trong sim, protocol và HUD.
- Đảm bảo 6 vũ khí clone (`rusty_pistol`, `dual_pistols`, `venom_smg`, `frost_bow`, `frost_scepter`, `dragon_breath_shotgun`) và 6 stat-stick buffs (`vitality_surge`, `iron_bastion`, `arcane_wellspring`, `eagle_precision`, `gale_reflex`, `ricochet_mastery` cũ) được xóa sạch và thay thế hợp lệ trong toàn bộ test/scenes.
- Đảm bảo `starterWeapons = [cDef.starterWeaponId]` tại cả 2 vị trí trong `sim-coop-hub.ts` (`createPlayerStateImpl` và `applyCharacterStatsToPlayer`).
- Đảm bảo `worldSim.activeBuffIds` toàn cục bị loại bỏ, thay bằng trạng thái riêng trên từng `SimPlayerState` và đồng bộ qua `snapshot-codec.ts` + `network-transport.ts` + `CoopRoom.ts` (`select_buff` theo `meta.playerId`).
- Đảm bảo `deterministicId`, `SHOT_FLAG`, `Zero-Rubberband Client Hold`, `projectiles_destroyed` và ưu tiên event trong `snapshot-codec.ts` (`<= 64` events) hoạt động chính xác 100%.

---

## Task List

### Task 1 (`P0A.1`): Cắt bỏ Thanh Năng Lượng (`energy`), Định nghĩa Metadata Nhịp Vũ Khí & Cập nhật Nội tại Nhân vật (`Section 1.1 #1 & Section 3.1`)
- [ ] **Files:**
  - `packages/shared/src/data/types.ts`
  - `packages/shared/src/data/weapons.ts`
  - `packages/shared/src/sim/world-sim-types.ts`
  - `packages/shared/src/sim/sim-player.ts`
  - `packages/shared/src/sim/sim-combat-damage.ts`
  - `packages/shared/src/sim/sim-skills-mechanics.ts`
  - `packages/shared/src/sim/sim-coop-hub.ts`
  - `packages/shared/src/protocol/snapshot-codec.ts`
  - `packages/shared/src/protocol/network-transport.ts`
  - `packages/shared/test/ap2-p0a-energy-purge.test.ts` (New TDD test file)
- [ ] **Steps (TDD):**
  1. Viết unit test `packages/shared/test/ap2-p0a-energy-purge.test.ts` kiểm tra:
     - `SimPlayerState` không còn trường `energy`, `maxEnergy`, `energyRegen`; thay vào đó có các trường trạng thái nhịp vũ khí cơ bản (`clipAmmo`, `clipMax`, `reloadTimer`, `reloadDuration`, `reloadLockout`, `overclockedNextShot`, `weaponHeat`, `overheatLockTimer`, `meleeComboStep`, `meleeComboResetTimer`, `meleeParryWindowTimer`, `holsterReloadTimers`, `vanguardShieldBonusAdd`, `elementalConvergenceTimer`).
     - `WeaponDef` không còn `energyCost`, có đầy đủ `cadenceKind: 'CLIP_RELOAD' | 'HEAT_VENT' | 'MELEE_COMBO'`, `clipSize`, `reloadDurationSec`, `heatPerShot`, `procCoefficient` theo đúng bảng 18 vũ khí trong Spec Rev 4 Mục 3.3.
     - `SimPickup` không còn `kind: 'energy'`, có thêm `kind: 'prey_emblem'`.
     - Nội tại **Thiết Vệ (`vanguard` — Ý Chí Thép):** `armorRegenDelaySec = 3.0` (`CHARACTERS.vanguard`); mỗi viên đạn địch bị chặn bởi `Tường Khiên Hồng Ngọc` nạp lại `+1` viên đạn vào băng đang cầm (hoặc giảm `15%` Nhiệt nếu cầm vũ khí `HEAT_VENT`) VÀ cộng `+0.15` vào `p.vanguardShieldBonusAdd` (tối đa `0.75`, tức `+75% Additive Damage` cho phát bắn/nhát chém kế tiếp, tiêu thụ sau khi bắn/chém).
     - Kỹ năng **Liệp Ưng (`ranger` — Mũi Tên Săn Mồi):** Hạ gục mục tiêu đang bị Đánh Dấu (`markedTimer > 0`) sinh ra pickup `kind: 'prey_emblem'`. Khi người chơi nhặt `prey_emblem`: lập tức nạp đầy băng đạn hiện tại (`p.clipAmmo = p.clipMax`), bật `p.overclockedNextShot = true`, đưa Nhiệt về `0%` (`p.weaponHeat = 0; p.overheatLockTimer = 0`), và giảm `2.0s` hồi chiêu Kỹ năng (`p.skillCooldown = Math.max(0, p.skillCooldown - 2.0)`).
     - **Đồng Đội Combo (`Team Elemental Reaction`):** Khi người chơi A áp nguyên tố mồi (`lastElementOwnerId`) và người chơi B (`B !== A`) kích nổ Phản Ứng Nguyên Tố trong vòng `3.0s`, cả A và B nhận `elementalConvergenceTimer = 3.0`: lập tức làm mới đầy Băng đạn (`clipAmmo = clipMax`) / đưa Nhiệt về `0%`, và trong suốt khi `elementalConvergenceTimer > 0` được tăng `+20%` Tốc độ di chuyển & `+20%` Tốc độ bắn.
  2. Chạy `pnpm --filter @ashen-pact/shared test ap2-p0a-energy-purge` xác nhận FAIL (`RED`).
  3. Triển khai thay đổi trong `types.ts`, `weapons.ts`, `characters.ts`, `world-sim-types.ts`, `sim-player.ts`, `sim-combat-damage.ts`, `sim-skills-mechanics.ts`, `sim-coop-hub.ts`, `snapshot-codec.ts`, `network-transport.ts`.
  4. Chạy lại unit test xác nhận PASS (`GREEN`).

---

### Task 2 (`P0A.2`): Cắt bỏ 6 Vũ khí Clone (`24 -> 18 Vũ khí`), 6 Thẻ Stat-Sticks & Migration Khởi tạo Ô Vũ khí (`Section 1.2 & 1.3`)
- [ ] **Files:**
  - `packages/shared/src/data/types.ts`
  - `packages/shared/src/data/weapons.ts`
  - `packages/shared/src/data/enemies.ts`
  - `packages/shared/src/sim/sim-coop-hub.ts`
  - `packages/shared/src/sim/world-sim-types.ts`
  - `apps/client/src/art/rig-defs.ts`
  - `apps/client/src/scenes/art-gallery-pages.ts`
  - `apps/client/src/scenes/game-scene/entity-sync.ts`
  - `apps/client/src/i18n/locales/vi.json`
  - `apps/client/src/i18n/locales/en.json`
  - `tests/e2e/helpers/visual-scenes.ts`
  - `packages/shared/test/*.test.ts`
  - `packages/shared/test/ap2-p0a-purge-arsenal.test.ts` (New TDD test file)
- [ ] **Steps (TDD):**
  1. Viết unit test `packages/shared/test/ap2-p0a-purge-arsenal.test.ts` kiểm tra:
     - `WEAPON_IDS` và `WEAPONS` có đúng **18 vũ khí độc bản**, hoàn toàn không chứa `rusty_pistol`, `dual_pistols`, `venom_smg`, `frost_bow`, `frost_scepter`, `dragon_breath_shotgun`.
     - `FLOOR_BUFFS` không chứa 6 thẻ cộng chỉ số phẳng (`vitality_surge`, `iron_bastion`, `arcane_wellspring`, `eagle_precision`, `gale_reflex`, `ricochet_mastery` bản cũ) và đã đổi tên `vanguard_fortress` $\to$ `vanguard_bastion_prism`, `elementalist_dual` $\to$ `elementalist_twin_orbit`.
     - Mọi nhân vật tạo từ `createPlayerStateImpl` và `applyCharacterStatsToPlayer` (`sim-coop-hub.ts`) đều bắt đầu với `weapons.length === 1` (`weapons[0] === cDef.starterWeaponId`, Ô 2 trống).
  2. Chạy `pnpm --filter @ashen-pact/shared test ap2-p0a-purge-arsenal` xác nhận FAIL (`RED`).
  3. Thực hiện xóa 6 vũ khí clone và 6 stat-stick buffs, cập nhật `sim-coop-hub.ts` tại cả 2 vị trí (`createPlayerStateImpl` và `applyCharacterStatsToPlayer`) sang `const starterWeapons = [cDef.starterWeaponId];`, gỡ 6 vũ khí đã xóa khỏi `rig-defs.ts`, `art-gallery-pages.ts`, `entity-sync.ts`, và cập nhật các bài test cũ + `visual-scenes.ts` sang các ID hợp lệ trong bộ 18 vũ khí.
  4. Chạy `pnpm --filter @ashen-pact/shared test` xác nhận PASS (`GREEN`).

---

### Task 3 (`P0A.3`): Tách Biệt Build & Kinh Tế Theo Từng Người Chơi (`Per-Player Build State & Instanced Gold` — `Section 1.1 #6, 4.1 & 5.2B`)
- [ ] **Files:**
  - `packages/shared/src/data/types.ts`
  - `packages/shared/src/sim/world-sim-types.ts`
  - `packages/shared/src/sim/world-sim.ts`
  - `packages/shared/src/sim/sim-coop-hub.ts`
  - `packages/shared/src/sim/sim-progression-bot.ts`
  - `packages/shared/src/sim/sim-dungeon-rooms.ts`
  - `packages/shared/src/sim/sim-combat-damage.ts`
  - `packages/shared/src/sim/sim-player.ts`
  - `packages/shared/src/sim/sim-skills-mechanics.ts`
  - `packages/shared/src/protocol/snapshot-codec.ts`
  - `packages/shared/src/protocol/network-transport.ts`
  - `apps/server/src/rooms/CoopRoom.ts`
  - `packages/shared/test/ap2-p0a-per-player-state.test.ts` (New TDD test file)
- [ ] **Steps (TDD):**
  1. Viết unit test `packages/shared/test/ap2-p0a-per-player-state.test.ts` kiểm tra:
     - `WorldSim` không còn thuộc tính mảng `activeBuffIds` hay `pendingBuffChoices` toàn cục.
     - Mỗi `SimPlayerState` có độc lập: `blessingIds: BlessingId[]`, `weaponMutators: Record<number, WeaponMutatorId[]>`, `duoBoonIds: DuoBoonId[]`, `activePactId: AshenPactId | null`, `pactOriginalWeaponId: WeaponId | null`, `awakenedRelicIds: AshenRelicId[]`, `buffChoices: BlessingId[]`, và `gold: number`.
     - Trong trận Co-op 2–4 người chơi: khi qua cổng tầng (`buff_choice`), mỗi người chơi được rút `p.buffChoices` riêng (3 lựa chọn độc lập, không làm cạn bể thẻ của đồng đội); khi người chơi 1 gọi `sim.selectFloorBuff(buffId, 'p1')`, chỉ `p1.blessingIds` nhận thẻ đó, còn `p2.blessingIds` giữ nguyên độc lập.
     - Vàng (`p.gold`) là Instanced: khi quái chết rơi vàng / mở rương / thưởng dọn phòng, mỗi người chơi nhận vàng riêng; khi `p1` mua đồ ở `merchant`, chỉ `p1.gold` bị trừ.
     - `encodeWorldSnapshot` / `decodeWorldSnapshot` (`snapshot-codec.ts`) và `NetworkTransport` đồng bộ đầy đủ các trường per-player (`blessingIds`, `weaponMutators`, `duoBoonIds`, `activePactId`, `pactOriginalWeaponId`, `awakenedRelicIds`, `buffChoices`, `gold`) cho từng người chơi.
  2. Chạy `pnpm --filter @ashen-pact/shared test ap2-p0a-per-player-state` xác nhận FAIL (`RED`).
  3. Triển khai tách `Per-Player Build State` & `Instanced Gold`, cập nhật `snapshot-codec.ts`, `network-transport.ts`, và `apps/server/src/rooms/CoopRoom.ts` (`select_buff` tra `this.playersBySession.get(client.sessionId)` và truyền `meta.playerId`).
  4. Chạy unit test xác nhận PASS (`GREEN`).

---

### Task 4 (`P0A.4`): Giao Thức `INPUT_BUTTON.RELOAD_VENT` (`[R]`), Định Danh Đạn Tất Định (`deterministicId`), `SHOT_FLAG`, `Zero-Rubberband Client Hold`, `projectiles_destroyed` & Ngân Sách Thực Thể 60Hz (`Section 7.1 & 7.2`)
- [ ] **Files:**
  - `packages/shared/src/protocol/messages.ts`
  - `packages/shared/src/protocol/snapshot-codec.ts`
  - `packages/shared/src/protocol/network-transport.ts`
  - `packages/shared/src/sim/world-sim-types.ts`
  - `packages/shared/src/sim/world-sim-events.ts`
  - `packages/shared/src/sim/sim-projectiles.ts`
  - `apps/client/src/scenes/game-scene/input-and-network.ts`
  - `packages/shared/test/ap2-p0a-deterministic-projectiles.test.ts` (New TDD test file)
- [ ] **Steps (TDD):**
  1. Viết unit test `packages/shared/test/ap2-p0a-deterministic-projectiles.test.ts` kiểm tra:
     - `INPUT_BUTTON.RELOAD_VENT === (1 << 8)`.
     - `SHOT_FLAG` có `FINALE_SHOT = 1 << 0`, `OVERCLOCKED_SHOT = 1 << 1`, `DYNAMIC_BOUNCE = 1 << 2`.
     - Khi Server và 4 máy Client chạy `spawnDeterministicVolleyImpl(ev)` với cùng `ev.eventId`, toàn bộ viên đạn thứ `i` sinh ra trên cả 5 máy đều có `id === (((ev.eventId & 0x3fffff) << 6) | (i & 0x3f))` khớp nhau 100%.
     - Khi một viên đạn có `shotFlags & SHOT_FLAG.DYNAMIC_BOUNCE` chạm tường/bia chắn/lăng kính trong `stepClientProjectilesCosmeticImpl`, Client không tự nảy gương mà giữ viên đạn tại chỗ (`b.vx === 0`, `b.vy === 0`, `b.awaitingServerRedirectTimer === 0.12`). Khi `NetworkTransport` nhận `bullet_volley_spawned` có `replacedProjectileId: b.id`, viên đạn đang giữ bị xóa ngay và thay bằng chùm đạn mới từ Server.
     - Khi `NetworkTransport` nhận sự kiện `{ kind: 'projectiles_destroyed', ids }`, mọi viên đạn có `id` trong `ids` bị xóa tức thì khỏi `sim.projectiles`.
     - Trong `snapshot-codec.ts`, khi `netEvents` vượt quá 64 sự kiện (trộn lẫn `damage_number`, `status_applied` và `bullet_volley_spawned`, `projectiles_destroyed`), bộ mã hóa luôn ưu tiên giữ 100% `bullet_volley_spawned` và `projectiles_destroyed` và nâng giới hạn gói lên `64` sự kiện.
     - Hằng số ngân sách thực thể: `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`, và bể đạn người chơi tách biệt hoàn toàn với bể đạn địch (bắn > 240 viên đạn người chơi không bao giờ thu hồi đạn địch và ngược lại).
  2. Chạy `pnpm --filter @ashen-pact/shared test ap2-p0a-deterministic-projectiles` xác nhận FAIL (`RED`).
  3. Triển khai trong `messages.ts`, `snapshot-codec.ts`, `network-transport.ts`, `world-sim-types.ts`, `world-sim-events.ts`, `sim-projectiles.ts`, và gắn phím `KeyR` vào `INPUT_BUTTON.RELOAD_VENT` trong `apps/client/src/scenes/game-scene/input-and-network.ts`.
  4. Chạy unit test xác nhận PASS (`GREEN`).

---

### Task 5 (`P0A.5`): Cập Nhật HUD Thay Thế Thanh Energy Bằng Trạng Thái Băng Đạn / Nhiệt Độ / Combo 3 Đòn (`Section 1.3 #2`)
- [ ] **Files:**
  - `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
  - `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
  - `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
  - `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
  - `packages/shared/src/i18n/vi.json`
  - `packages/shared/src/i18n/en.json`
  - `apps/client/src/i18n/locales/vi.json` (if present, or shared i18n)
  - `apps/client/src/i18n/locales/en.json`
  - `apps/client/test/ap2-p0a-hud-cadence.test.ts` (New TDD test file)
- [ ] **Steps (TDD):**
  1. Viết unit test kiểm tra hàm định dạng thông tin nhịp vũ khí trên HUD và thẻ so sánh vũ khí (`CLIP_RELOAD` hiển thị các phân đoạn đạn + viên cuối vàng cam `Finale Shot` + `Đạn / Băng`; `HEAT_VENT` hiển thị thanh nhiệt chuyển sắc `Xanh -> Vàng -> Cam 65%–95% -> Đỏ 100%` + `% Nhiệt`; `MELEE_COMBO` hiển thị 3 nấc `Combo 1 -> 2 -> 3 PARRY!`) và kiểm tra đồng bộ khóa i18n `vi`/`en`.
  2. Gỡ bỏ hoàn toàn thanh Energy màu xanh dương khỏi thẻ trạng thái người chơi góc trên-trái và khỏi thẻ đồng đội Co-op trong `hud-combat-and-coop.ts` & `hud-setup-and-pause.ts`.
  3. Thay thế bằng thanh hiển thị **Nhịp Vũ Khí Đang Cầm** sắc nét, dễ đọc trên cả HUD góc trên-trái và 2 thẻ vũ khí góc dưới-phải; trên thẻ so sánh vũ khí (`hud-hub-and-cards.ts`), thay dòng "Tiêu hao NL" bằng thông tin nhịp (`Băng: X viên · Nạp: Ys` / `Nhiệt: X%/phát` / `Combo 3 đòn · Parry Đòn 3`).
  4. Đảm bảo mọi file `.ts` đều `< 1000 dòng`.

---

### Task 6 (`P0A.6`): Visual Gate & Phase Gate `P0A`
- [x] Chụp `pnpm shots -- --phase ap2-p0a --label after --scenes hub-solo,b1-start-room,b1-combat,coop-4p-combat,b1-hud-weapon-compare,b1-dark-interactables`.
- [x] Chạy `npx tsx tools/visual-metrics.ts --dir docs/screenshots/ap2-p0a/after`.
- [x] Triệu hồi **Visual Reviewer độc lập (`research`, `Model: 'pro'`)** kiểm tra trực tiếp các ảnh `.png` tại `docs/screenshots/ap2-p0a/after/`: xác nhận thanh Energy đã biến mất hoàn toàn, HUD Băng đạn/Nhiệt độ/Combo mới rõ nét, không chồng lấp chữ tiếng Việt, và ô vũ khí hiển thị đúng 1 vũ khí khởi đầu ở Ô 1 và Ô 2 trống khi bắt đầu. Lưu báo cáo vào `docs/screenshots/ap2-p0a/review-1.md`.
- [x] Chạy `pnpm verify` (`typecheck && lint && test && build && e2e`) và `pnpm perf` đạt 100%.
- [x] Cập nhật `docs/PROGRESS.md`, `docs/PHASES.md`, `task.md`, commit trên nhánh `overhaul/v2.0` và gắn tag `ap2-p0a`.
