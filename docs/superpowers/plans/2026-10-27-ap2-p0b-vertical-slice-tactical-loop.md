# Ashen Pact 2.0 — Phase P0B: Vertical Slice Độ Vui (`ap2-p0b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng hoàn chỉnh và kiểm chứng độ sướng tay của **Tam Giác Hành Động 3 Giây** trong Biome 1 (`Rừng Cổ`): 3 Archetype hình học phòng chiến thuật đầu tiên (`TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`) có `Mirror & Prop Jitter` và `Door Clearance Guarantee`, Quy luật Vật lý toàn cục (`Flip Cover [E] + Micro-Blank`, `Dash-Kick / Melee-Kick`, `Wall-Slam`, `Chasm Ring-Out`), Luật sinh tồn & 3 vật thể tương tác Biome 1 (`moss_table`, `volatile_spore_pod`, `rotten_totem_pillar`), Hệ thống Nhịp Vũ Khí Chủ Động (`CLIP_RELOAD` + `Perfect Reload [R]`, `HEAT_VENT` + `Tactical Vent [R]`, `MELEE_COMBO` 3 đòn + `Parry Deflect`, `Holster Auto-Reload 2.0s`) kèm 4 vũ khí đại diện (`rivet_gun`, `apprentice_staff`, `knight_sword`, `tesla_carbine`), thanh `Micro-Bar 32×5px` dưới chân nhân vật, VFX/Texture/Audio ZzFX, và bộ 10 cảnh chụp/strip 8-frame kiểm chứng cho **Playtest Gate 1**.

**Architecture:** Tách toàn bộ logic mới sang các module chuyên biệt dưới `650 dòng/file` (`arena-room-archetypes.ts`, `sim-tactical-physics.ts`, `sim-weapon-cadence.ts`, `sim-weapon-specials.ts`, `hud-micro-reload-bar.ts`, `combat-fx-weapons-v2.ts`, `visual-scene-ap2-p0.ts`) theo đúng Bảng 0.5 của `master-promt-v3.md`, đảm bảo không có file `.ts` nào vượt trần `1000 dòng`.

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`).

---

## Task 1 (`P0B.1`): Cài Đặt 3 Archetype Hình Học Phòng Chiến Thuật Đầu Tiên (`TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`) Có `Mirror & Prop Jitter`
- [ ] Tạo `packages/shared/src/sim/arena-room-archetypes.ts` và kết nối vào `arena-map.ts` + `sim-dungeon-rooms.ts`.
- [ ] Cài đặt `SurfaceKind = 'chasm'` và `configureRoomLayout(roomSeed, archetype, biome, activeDoorSides)` với `flipX`, `flipY`, `Prop Jitter ±1..2 tiles`, `Door Clearance Guarantee` (`3×3` sảnh quanh cửa mở), và nhánh chữ Y chống đi vòng cho `TWIN_BRIDGES`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p0b-room-archetypes.test.ts` kiểm chứng 500 `roomSeed` liên thông BFS giữa mọi cửa mở và chặn 100% đi vòng ngoài 2 cây cầu ở `TWIN_BRIDGES`.

## Task 2 (`P0B.2`): Cài Đặt Quy Luật Vật Lý Toàn Cục: `Flip Cover [E]`, `Dash-Kick / Melee-Kick`, `Wall-Slam` & `Chasm Ring-Out`
- [ ] Tạo `packages/shared/src/sim/sim-tactical-physics.ts`, kết nối vào `interact-target.ts`, `sim-player.ts`, `sim-enemies-core.ts`, `network-transport.ts`.
- [ ] Cài đặt thứ tự ưu tiên cứng của phím `[E]`: `1. Revive (<=52px)` -> `2. Flip Cover ('low' -> 'flipped', Micro-Blank r=56px 0.15s xóa đạn địch)` -> `3. Interact/Pickup (<=64px)`.
- [ ] Cài đặt `Dash-Kick` (`dot >= 0.45`, bỏ qua đẩy lùi người chơi, trượt `520 px/s` theo `aimAngle`) và `Melee-Kick` + đồng bộ dự đoán va chạm trên `network-transport.ts` (`:367` & `:711`).
- [ ] Cài đặt `Wall-Slam` (`hypot(kbVx, kbVy) >= 120 px/s` đập tường/cột/bia chắn gây `Dmg_WallSlam`, Hit-stun `0.40s` ngắt Telegraph, kích nổ `Shatter` nếu đang đóng băng) và `Chasm Ring-Out` (quái bộ binh thường chết tức thì + vọt loot lên bờ; Tinh Anh mất `30% MaxHP` + Choáng `1.0s`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p0b-tactical-physics.test.ts`.

## Task 3 (`P0B.3`): Cài Đặt Quy Luật Sinh Tồn Biome 1 (`Thảm Thực Vật Cộng Hưởng`) & 3 Vật Thể Chiến Thuật Biome 1 (`moss_table`, `volatile_spore_pod`, `rotten_totem_pillar`)
- [ ] Cài đặt Luật Biome 1: đứng trên `grass` (`tall_grass`) khi `Dash` hoặc `Perfect Reload [R]` bung phấn hoa tăng `+25%` tốc chạy trong `2.0s`; đạn/kỹ năng Lửa chạm `grass` hoặc `poison_swamp` cháy lan dây chuyền (`320 px/s`).
- [ ] Cài đặt 3 vật thể tương tác Biome 1: `moss_table` (vỡ bung vùng Phấn Hoa Hồi Giáp `+1 Giáp`, `r=72px`), `volatile_spore_pod` (sút bay `520 px/s`, nổ Độc + Trói chân `1.2s`, `r=96px`), `rotten_totem_pillar` (đổ sập theo hướng lực đè dải chữ nhật `160×56px` gây `Dmg_Hazard` + Choáng `1.5s`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p0b-biome1-props.test.ts`.

## Task 4 (`P0B.4`): Cài Đặt Hệ Thống Nhịp Vũ Khí (`CLIP_RELOAD`, `HEAT_VENT`, `MELEE_COMBO` 3 Đòn + `Parry Deflect`) & 4 Vũ Khí Đại Diện (`rivet_gun`, `apprentice_staff`, `knight_sword`, `tesla_carbine`)
- [ ] Tạo `packages/shared/src/sim/sim-weapon-cadence.ts` và `packages/shared/src/sim/sim-weapon-specials.ts`.
- [ ] Cài đặt `CLIP_RELOAD` (`Finale Shot +50% Additive DMG`, `Perfect Reload [R]` ở khung vàng `45%–70%` cấp `Overclocked Shot +45% Additive DMG`), `HEAT_VENT` (Nhiệt Cam `65%–95%` tăng `+25%` tốc bắn & `+25% Additive DMG`, Quá Nhiệt `100%` khóa `1.10s`, `Tactical Vent [R]` ở `65%–95%` xả nhiệt về `0%` trong `0.25s`), `MELEE_COMBO` (3 đòn, Đòn 3 mở `Parry Deflect 0.18s` phản tối đa 3 đạn địch ở `760 px/s`), và `Holster Auto-Reload 2.0s`.
- [ ] Cài đặt cơ chế độc bản cho 4 vũ khí đại diện: `rivet_gun` (6 đinh tán từ tính + lưới hồ quang điện `180px`), `apprentice_staff` (phát thứ 3 cầu lớn + `Tactical Vent` phóng Tia Tam Giác Nguyên Tố tới con trỏ), `knight_sword` (Lunge 24px + Đòn 3 Lưỡi Kiếm Khí Bán Nguyệt `240px` + `Parry Deflect`), `tesla_carbine` (`SHOT_FLAG.DYNAMIC_BOUNCE` + `Smart Bounce` sau khi xuyên quái/bia chắn/lăng kính + `Finale Shot` giật sét 3 mục tiêu + `Perfect Reload` `+1` nảy).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p0b-weapon-cadence-specials.test.ts`.

## Task 5 (`P0B.5`): Giao Diện Thanh `Micro-Bar 32×5px` Dưới Chân Nhân Vật, Texture Baker Props Biome 1, VFX & 4 Hiệu Ứng Âm Thanh ZzFX
- [ ] Tạo `apps/client/src/scenes/game-scene/hud-micro-reload-bar.ts` (hiển thị cho `CLIP_RELOAD` đang nạp và `HEAT_VENT` có nhiệt `> 0%`, ẩn hoàn toàn khi cầm `MELEE_COMBO`).
- [ ] Tạo `apps/client/src/fx/combat-fx-weapons-v2.ts` và cập nhật `texture-baker-props.ts`, `texture-baker-surfaces.ts`, `room-entities-sync.ts`, `zzfx.ts` (vực `chasm`, cầu `TWIN_BRIDGES`, 3 trạng thái `moss_table`, `volatile_spore_pod`, `rotten_totem_pillar`, VFX 4 vũ khí + `Micro-Blank` + `Dash-Kick` + `Wall-Slam` + `RING-OUT!`, 4 âm thanh ZzFX mới).
- [ ] Viết unit test `apps/client/test/ap2-p0b-microbar-fx.test.ts`.

## Task 6 (`P0B.6`): Xây Dựng Bộ Cảnh Chụp Kiểm Chứng Hình Ảnh & Strip 8-Frame Cho `Phase P0B` (`tests/e2e/helpers/visual-scene-ap2-p0.ts`)
- [ ] Tạo `tests/e2e/helpers/visual-scene-ap2-p0.ts` với đủ 10 cảnh chụp/strip (`ap2-b1-twin-bridges`, `ap2-b1-gauntlet-chokepoint`, `ap2-b1-central-bastion`, `ap2-flip-cover-microblank`, `ap2-dash-kick-wall-slam`, `ap2-chasm-ring-out`, `ap2-microbar-perfect-reload`, `ap2-heat-vent-staff`, `ap2-melee-combo3-parry`, `ap2-tesla-smart-bounce`), có ghi đè `sampleRects.floor_center` cho `ap2-b1-twin-bridges` và `ap2-b1-central-bastion`.
- [ ] Đăng ký nhóm cảnh `ap2-p0b` vào `tests/e2e/helpers/visual-scenes.ts` và `tools/run-shots.ts`.

## Task 7 (`P0B.7`): Visual Gate, Phase Gate `P0B` & Báo Cáo Kiểm Chứng `Playtest Gate 1`
- [ ] Chạy `pnpm shots -- --phase ap2-p0b --label after --group ap2-p0b` & `npx tsx tools/visual-metrics.ts --dir docs/screenshots/ap2-p0b/after`.
- [ ] Triệu hồi Visual Reviewer (`pro`) kiểm định 10 cảnh + strip (`>= 8.0/10`, `0` blocker, `0` major).
- [ ] Chạy `pnpm verify` & `pnpm perf`, ghi báo cáo **Playtest Gate 1** vào `docs/PROGRESS.md`, commit và tag `ap2-p0b`.
