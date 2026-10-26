# Ashen Pact 2.0 — Phase P2A: Đồ Thị Phòng Động, Phòng Bí Mật Nứt Tường, Đe Rèn Cổ Đại (`6 Core Mutators`) & Phân Rã Súng (`ap2-p2a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế phòng bí mật cố định ở `(3,2)` và giải đố bàn đạp nam châm bằng Đồ thị phòng động theo Tầng Lẻ (`1, 3, 5`: có `shrine` + Đe Rèn Cổ Đại `daedalus_anvil`) / Tầng Chẵn (`2, 4, 6`: không có `shrine`, có Bàn Tinh Luyện Vũ Khí `upgrade_anvil` + `boss`), Phòng Bí Mật Động mở bằng `Dash-Kick / Wall-Slam` qua Tường Nứt (`cracked_wall`), 6 Bản Độ Búa Rèn Cốt Lõi (`Daedalus Weapon Mutators #1–#6`), và cơ chế Giữ `[X]` (`DROP_WEAPON`) `0.5s` ngoài giao tranh để Phân Rã Vũ Khí thành Vàng cá nhân.

**Architecture:** Tạo mới `packages/shared/src/data/ashen-pacts.ts` (`< 450 dòng`), `packages/shared/src/sim/sim-ashen-pacts.ts` (`< 650 dòng`), `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts` (`< 600 dòng`), `tests/e2e/helpers/visual-scene-ap2-p2.ts` (`< 600 dòng`).

---

## Task 1 (`P2A.1`): Đại Tu Đồ Thị Phòng (`dungeon-gen.ts`) & Phòng Bí Mật Động (`Dynamic Secret Room`)
- [ ] Xóa đoạn gắn cứng phòng `secret` ở `(3,2)` và 2 thùng nổ đặt sẵn trước cửa phòng bí mật (`dungeon-gen.ts:198-212`, `sim-props-spawning.ts:25-26`).
- [ ] Cấu trúc đồ thị theo Tầng Lẻ (`localFloor === 1`: `1 start`, `1 shrine` tại `distanceFromStart = 1`, `4 combat`, `1 treasure`, `1 merchant`, `1 secret`, `1 portal`) và Tầng Chẵn (`localFloor === 2`: không có `shrine`, thay bằng `combat`, kết thúc bằng `boss`).
- [ ] Phòng Bí Mật Động gắn ngẫu nhiên theo `seed` vào cạnh trống của `treasure`, `merchant` hoặc `combat` cuối nhánh, mở bằng `Dash-Kick / Wall-Slam` đập vỡ `cracked_wall`, bên trong có 1 Rương Vũ Khí (`Rare/Epic`) + 2 Cụm Tinh Thể Vàng (`+30G`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2a-dungeon-graph.test.ts` kiểm chứng `verifyDungeonConnectivity() === true` trên `1,000 seeds` cho cả 6 tầng.

## Task 2 (`P2A.2`): Cài Đặt Xưởng Rèn Kho Báu & 6 Bản Độ Búa Rèn Cốt Lõi (`Daedalus Weapon Mutators`)
- [ ] Xóa cơ chế giải đố bàn đạp + cục đá tự hút nam châm ở phòng `treasure`; thay bằng Xưởng Rèn Kho Báu: đặt 1 Rương Vũ Khí + **Đe Rèn Cổ Đại (`daedalus_anvil`)** ở Tầng Lẻ (chọn 1 trong 2 `Weapon Mutator` tương thích với súng đang cầm, tối đa 2 Mutator/súng; đồng bộ `select_mutator` theo `meta.playerId`) hoặc **Bàn Tinh Luyện Vũ Khí (`upgrade_anvil`)** ở Tầng Chẵn (`upgradeLevel + 1` -> `+20% Base DMG`).
- [ ] Cài đặt 6 Core Weapon Mutators: `mutator_finale_jolt` (kẹp an toàn không lùi xuống `chasm`), `mutator_gravity_singularity`, `mutator_shockwave_edge`, `mutator_chain_harpoon`, `mutator_prism_splitter` (`MAX_PELLETS_PER_TRIGGER = 9`), `mutator_thermal_meltdown`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2a-daedalus-mutators.test.ts`.

## Task 3 (`P2A.3`): Cơ Chế Giữ Phím `DROP_WEAPON` (`0.5s`) Phân Rã Vũ Khí (`Weapon Salvage`) & Kinh Tế Thương Nhân
- [ ] Khi phòng sạch quái (`enemies.length === 0`), đứng gần vũ khí rơi trên đất (`dist <= 48px`, `costGold === 0`) và giữ `DROP_WEAPON` (`[X]`) liên tục `0.50s` (`30 ticks`): phân rã súng cộng Vàng cá nhân (`Common = 10G`, `Uncommon = 15G`, `Rare = 22G`, `Epic = 30G`, `Legendary = 45G`).
- [ ] Thưởng Dọn Phòng Không Mất Máu (`Flawless Room Bonus`): `+10 Gold` kèm popup `+10 VÀNG HOÀN HẢO!`.
- [ ] Chuẩn hóa Bảng Giá Thương Nhân (`Cost = round(base * (1 + 0.10 * (globalFloor - 1)))`): Huyết Dược / Tinh Thể Giáp `32G`, Rương Vũ Khí `55G`, Thẻ Phước Lành `68G`, Tinh Luyện Vũ Khí `75G`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2a-salvage-economy.test.ts`.

## Task 4 (`P2A.4`): Giao Diện Modal Đe Rèn Cổ Đại, Vòng Tiến Độ Giữ `[X]` Phân Rã Súng & Bake Texture Đe Rèn / Tường Nứt
- [ ] Tạo `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts` vẽ Modal chọn `Weapon Mutator`, thanh tiến độ giữ `[X] 0.5s Phân Rã` trên prompt tương tác, và bake texture `daedalus_anvil` + `cracked_secret_wall`.

## Task 5 (`P2A.5`): Xây Dựng Cảnh Chụp Kiểm Chứng Đe Rèn, Tường Nứt & Phân Rã Súng (`visual-scene-ap2-p2.ts`)
- [ ] Tạo `tests/e2e/helpers/visual-scene-ap2-p2.ts` với 4 cảnh: `ap2-treasure-forge-workshop`, `ap2-modal-daedalus-mutator`, `ap2-weapon-salvage-hold` (strip 8 frame), `ap2-secret-wall-crack-break` (strip 8 frame).

## Task 6 (`P2A.6`): Visual Gate & Phase Gate `P2A`
- [ ] Chạy `pnpm shots -- --phase ap2-p2a --label after --group ap2-p2a`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p2a`.
