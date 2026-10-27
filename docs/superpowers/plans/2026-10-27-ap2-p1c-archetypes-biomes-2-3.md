# Ashen Pact 2.0 — Phase P1C: Mở Rộng 3 Archetype Phòng Mới & Hệ Sinh Thái Tương Tác Biome 2 + Biome 3 (`ap2-p1c`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đủ **6/6 Archetype hình học phòng chiến thuật** với 3 Archetype mới (`CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`) và toàn bộ **Luật Sinh Tồn + 6 Vật Thể Tương Tác Địa Hình của Biome 2 (`Hầm Băng Vĩnh Cửu`: `glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`) & Biome 3 (`Lò Rèn Dung Nham`: `forge_blast_shield`, `pneumatic_press`, `slag_crucible`)**, kèm Texture Baker procedural, VFX và bộ cảnh chụp/strip 8-frame (`ap2-p1c`).

**Architecture:** Mở rộng `packages/shared/src/sim/arena-room-archetypes.ts`, `sim-tactical-physics.ts`, `sim-props-spawning.ts`, `texture-baker-props.ts`, `texture-baker-surfaces.ts`, `room-entities-sync.ts`, và `tests/e2e/helpers/visual-scene-ap2-p1.ts`.

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`).

---

## Task 1 (`P1C.1`): Cài Đặt 3 Archetype Phòng Chiến Thuật Tiếp Theo (`CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`)
- [ ] `CROSSFIRE_CONVEYORS`: 2 làn Băng Chuyền / Luồng Gió / Dòng Chảy rộng 3 ô chạy song song (`ty: 6..8` chảy sang Đông, `ty: 13..15` chảy sang Tây), cuốn người chơi, quái vật và các Vật Chắn đang trượt đi với vận tốc `110 px/s`.
- [ ] `PRISM_LABYRINTH`: 5 bức tường chắn so le (`2×4` ô) bố trí dạng bàn cờ khắp phòng, xen kẽ là các `cryo_prism_pillar` / `rotten_totem_pillar` / `pneumatic_press`.
- [ ] `CRUMBLING_PILLAR_RING`: 6 cây cột lớn (`2×2` ô) xếp thành hình lục giác quanh tâm phòng, kèm 4 Bia Chắn nằm giữa các khe cột; cột bị bắn gãy hoặc `Wall-Slam` sập xuống đè vùng dài `160px` và mở thông dần không gian phòng.
- [ ] Đảm bảo `FlipX/FlipY`, `Prop Jitter ±1..2`, `Door Clearance Guarantee` và BFS liên thông 100% trên 500 `roomSeed`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1c-room-archetypes-2.test.ts`.

## Task 2 (`P1C.2`): Cài Đặt Quy Luật Sinh Tồn & 3 Vật Thể Tương Tác Biome 2 (`glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`)
- [ ] Luật Biome 2 (`Quán Tính Băng Vĩnh Cửu`): trên mặt băng (`ice`), lực `Knockback` lên quái và khoảng cách/vận tốc trượt của vật thể (`Dash-Kick`) tăng `+50%`; mọi đòn `Wall-Slam` trong Biome 2 tự động phát xung áp `1 tầng Chill` (`r=64px`).
- [ ] `glacial_barricade` (`65 HP`): lật bằng `[E]`; khi `Dash-Kick` sút trượt đi đâm trúng quái/tường, vỡ tung và đóng cọc **3 Nhũ Băng Nhọn** xuống sàn ($\text{Dmg}_{\text{Hazard}}$ + Đóng Băng `1.5s`, tồn tại `4.0s` làm cột chắn đạn, tuân thủ trần `MAX_TACTICAL_PROPS_PER_ROOM = 16`).
- [ ] `sliding_ice_block`: sút trượt xuyên phòng (`600 px/s`), nảy qua tường `1 lần` như bi-a, húc văng cả hàng quái.
- [ ] `cryo_prism_pillar`: bắn đạn (`splitGeneration === 0`) vào Lăng Kính khúc xạ tách làm **3 tia hình quạt (`splitGeneration = 1`, `+20% Additive DMG`, tẩm `Chill`, gắn `SHOT_FLAG.DYNAMIC_BOUNCE`)** hướng về cụm quái đông nhất.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1c-biome2-props.test.ts`.

## Task 3 (`P1C.3`): Cài Đặt Quy Luật Sinh Tồn & 3 Vật Thể Tương Tác Biome 3 (`forge_blast_shield`, `pneumatic_press`, `slag_crucible`)
- [ ] Luật Biome 3 (`Nhịp Đập Lò Nung`): các dải `conveyor` tự động đảo chiều đồng bộ mỗi `8.0s` (có `conveyorWarningTimer = 1.2s` nhấp nháy đèn mũi tên cảnh báo trước khi đổi chiều); trong Biome 3, vũ khí `HEAT_VENT` tăng nhiệt nhanh hơn `+15%` nhưng Xung Xả Áp `[R]` (`Tactical Vent`) có bán kính rộng gấp rưỡi (`r=110px`).
- [ ] `forge_blast_shield` (`85 HP`): lật bằng `[E]`; khi `Dash-Kick` sút đi, lao dọc sàn và phóng kèm **Cơn Sóng Lửa rộng `88px`**.
- [ ] `pneumatic_press` (`Cooldown = 4.0s`): khi người chơi `Dash-Kick` vật chắn / quái trượt vào khung búa (hoặc quái/Boss bước vào tâm cảm biến), dập xuống sau `0.35s` gây $\text{Dmg}_{\text{Hazard}}$ nghiền quái & phá giáp Boss (`0` sát thương lên người chơi, chỉ đẩy nhẹ ra mép).
- [ ] `slag_crucible`: khi `Dash-Kick` hoặc bắn vỡ, đổ tràn **Thảm Dung Nham dài `192px`** thiêu đốt hàng quái.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1c-biome3-props.test.ts`.

## Task 4 (`P1C.4`): Bake Texture Procedural & VFX Cho Archetypes + Props Biome 2 & Biome 3
- [ ] Vẽ 3 trạng thái `'low' | 'flipped' | 'sliding'` cho `glacial_barricade` và `forge_blast_shield`, 3 cọc nhũ băng nhọn, `sliding_ice_block`, `cryo_prism_pillar`, `pneumatic_press`, `slag_crucible`, và băng chuyền `conveyor` có đèn mũi tên cảnh báo đảo chiều `1.2s`.

## Task 5 (`P1C.5`): Xây Dựng Cảnh Chụp & Strip Engine 2.6 (`8 / 12 Frames`) Cho Biome 2 & Biome 3 (`visual-scene-ap2-p1c.ts`)
- [ ] Tạo 7 cảnh chụp tĩnh & strip theo chuẩn **Engine 2.6** (`ap2-b2-prism-labyrinth`, `ap2-b2-glacial-kick-spikes` strip, `ap2-b2-prism-refract` strip, `ap2-b3-crossfire-conveyors`, `ap2-b3-pneumatic-press-crush` strip, `ap2-b3-blast-shield-wave` strip, `ap2-crumbling-pillar-ring` strip), có ghi đè `sampleRects.floor_center` cho các phòng có tường/búa máy ở tâm, `F1 = windup_hold`, `apexEvent` thật từ `WorldSim`, `0` external state mutations, 100% actor containment trong `640×360` ROI.

## Task 6 (`P1C.6`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P1C`
- [ ] Chạy `pnpm shots --phase ap2-p1c --label after --group ap2-p1c --verify-freeze` ở chế độ `HARD_ASSERT` (`5/5` cổng animation PASS + `freezeDiffRatio = 0.0000`, `traceHashMatched = true`), chấm qua Visual Reviewer (`pro` `>= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p1c`.
