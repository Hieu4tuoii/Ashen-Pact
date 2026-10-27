# Ashen Pact 2.0 — Phase P4A: Mở Rộng Chiều Sâu Đợt 1: 8 Phước Lành Hành Động Nâng Cao & 4 Bản Độ Búa Rèn Mở Rộng (`ap2-p4a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đủ **24/24 Phước Lành Hành Động** (8 thẻ nâng cao đánh dấu Phase 4) và **10/10 Bản Độ Búa Rèn (`Daedalus Weapon Mutators #7–#10`)** để tối đa hóa khả năng phối đồ (synergy), kèm VFX procedural và bộ cảnh chụp strip 8-frame (`ap2-p4a`).

**Architecture:** Mở rộng `packages/shared/src/data/blessings.ts`, `sim-blessings.ts`, `data/ashen-pacts.ts`, `sim-ashen-pacts.ts`, `combat-fx-weapons-v2.ts`, và tạo `tests/e2e/helpers/visual-scene-ap2-p4.ts` (`< 650 dòng`).

---

## Task 1 (`P4A.1`): Cài Đặt 4 Phước Lành Nâng Cao Của Nhóm 1 (`Barricade`) & Nhóm 2 (`Dash`)
- [ ] `table_tech_toxic_shrapnel` (`Độc`): khi tấm chắn/đồ chơi bị vỡ hoặc kẻ địch bị `Wall-Slam`, bắn tung 8 Mũi Gai Độc 360° (`base 20 DMG Độc/mũi`) và để lại đầm độc.
- [ ] `table_tech_magnet_snare` (`Sét`): ngay khi Lật Chắn (`[E]`), tấm chắn phát xung từ trường kéo tối đa 4 kẻ địch gần nhất (`trong 180px`) gom vào mặt trước tấm chắn và làm choáng `0.8s`.
- [ ] `dash_thunder_decoy` (`Sét`): tại vị trí bắt đầu Lướt, để lại Tượng Bóng Sét (`1.5s`) thu hút quái; khi hết giờ hoặc chạm đạn địch sẽ nổ `base 36 DMG Sét` (`r=88px`) và xóa đạn địch trong vùng.
- [ ] `dash_phase_blade` (`Vật lý`): sau mỗi cú Lướt, đòn đánh hoặc phát bắn đầu tiên trong `1.2s` phóng kèm Lưỡi Sóng Chấn Động (`base 28 DMG`) xóa đạn địch trước mặt.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4a-blessings-group1-2.test.ts`.

## Task 2 (`P4A.2`): Cài Đặt 4 Phước Lành Nâng Cao Của Nhóm 3 (`Reload/Vent`) & Nhóm 4 (`Bullet Geometry`)
- [ ] `reload_caustic_pod` (`Độc`): khi `Perfect Reload / Vent [R]` hoặc bắn `Finale Shot`, phóng Quả Nang Bào Tử lăn về phía trước `120px`; bắn trúng hoặc `Dash-Kick` vào quả nang sẽ nổ mưa axit (`base 38 DMG Độc`, cộng `delta_caustic = 0.25` trong `M_EnemyVuln`).
- [ ] `reload_holster_surge` (`Sét`): khi đổi vũ khí bằng `[Q]` (`ICD = 2.0s`), phóng 1 tia sét (`base 26 DMG Sét`) xuyên qua quái trước mặt và nạp đầy ngay vũ khí vừa cất.
- [ ] `bullet_wall_tether` (`Sét`): khi `Finale Shot` / `Overclocked Shot` chạm tường, cắm Cọc Điện Cao Thế (`4.5s`, tối đa `2 cọc/người`, tuân thủ trần `MAX_DEPLOYABLES_PER_PLAYER = 8`); hai cọc căng Dây Cắt Điện (`base 26 DMG Sét/s`).
- [ ] `bullet_orbit_return` (`Độc`): đạn tầm xa (gắn `SHOT_FLAG.DYNAMIC_BOUNCE`) khi bay hết tầm sẽ vòng ngược 180° bay trả về vị trí người chơi, gây `45% DMG Độc` từ sau lưng quái.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4a-blessings-group3-4.test.ts`.

## Task 3 (`P4A.3`): Cài Đặt 4 Bản Độ Búa Rèn Mở Rộng (`Daedalus Weapon Mutators #7–#10`)
- [ ] `mutator_holo_decoy_gun`: khi `Perfect Reload / Vent [R]`, để lại Bóng Pháo Ảnh (`3.5s`, tối đa 1 bóng/người) bắn phụ họa (`40% DMG`) về phía con trỏ chuột.
- [ ] `mutator_cluster_mortar`: đạn bay cầu vồng vượt qua vật chắn thấp và tách thành 3 mảnh nổ phụ khi chạm đích.
- [ ] `mutator_boomerang_core`: khi `Perfect Reload / Vent [R]`, phóng lưỡi cưa năng lượng xoay `200px` rồi thu về (`base 32 DMG`).
- [ ] `mutator_elemental_infusion`: vũ khí đang cầm nhận thêm Nguyên tố thứ hai từ vũ khí ở ô còn lại mỗi khi bắn `Finale Shot` hoặc `Overclocked Shot`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4a-expanded-mutators.test.ts`.

## Task 4 (`P4A.4`): Procedural VFX & Cảnh Chụp Strip 8-Frame Cho `Phase P4A` (`visual-scene-ap2-p4.ts`)
- [ ] Vẽ Tượng Bóng Sét `dash_thunder_decoy`, 2 Cọc Điện Cao Thế & dây sét `bullet_wall_tether`, đạn vòng cung hồi quy `bullet_orbit_return`, và Bóng Pháo Ảnh `mutator_holo_decoy_gun`.
- [ ] Tạo 4 cảnh strip 8 frame trong `tests/e2e/helpers/visual-scene-ap2-p4.ts`: `ap2-p4a-wall-tether-pylons`, `ap2-p4a-orbit-return-bullets`, `ap2-p4a-thunder-decoy-dash`, `ap2-p4a-holo-decoy-mutator`.

## Task 5 (`P4A.5`): Visual Gate & Phase Gate `P4A`
- [ ] Chạy `pnpm shots -- --phase ap2-p4a --label after --group ap2-p4a`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p4a`.
