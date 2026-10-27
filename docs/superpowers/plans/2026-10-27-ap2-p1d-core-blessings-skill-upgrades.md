# Ashen Pact 2.0 — Phase P1D: Hệ Thống 26 Thẻ Nâng Cấp Cốt Lõi (16 Action Blessings + 10 Character Skill Upgrades) (`ap2-p1d`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế hoàn toàn các buff cộng chỉ số cũ bằng **26 Thẻ Nâng Cấp Cốt Lõi** (16 Phước Lành Hành Động cốt lõi thuộc 4 nhóm `Barricade / Table Techs`, `Dash Techs`, `Reload, Vent & Finisher Techs`, `Geometry & Co-op Bullet Mods` + 10 Thẻ Nâng Cấp Kỹ Năng Nhân Vật), lưu trữ độc lập theo từng người chơi (`Per-Player`), kèm giao diện Modal chọn Phước lành song ngữ Việt/Anh, VFX và bộ cảnh chụp/strip chuẩn **Engine 2.6 (`8/12 frames` + `1:1 ROI` + `HARD_ASSERT`)** (`ap2-p1d`).

**Architecture:** Tạo mới `packages/shared/src/data/blessings.ts` (`< 500 dòng`) và `packages/shared/src/sim/sim-blessings.ts` (`< 650 dòng`), kết nối vào `sim-tactical-physics.ts`, `sim-player.ts`, `sim-weapon-cadence.ts`, `sim-skills-mechanics.ts`, `sim-projectiles.ts`, `hud-modals-and-debug.ts`, `combat-fx-weapons-v2.ts`, `visual-scene-ap2-p1.ts`.

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`, `tools/visual-animation-gates.ts`, `tools/visual-strip-renderer.ts` — Engine 2.6 `HARD_ASSERT`).

---

## Task 1 (`P1D.1`): Kiến Trúc Dữ Liệu Phước Lành & Nhóm 1: 4 Phước Lành Lật Chắn & Phá Địa Hình (`Barricade / Table Techs`)
- [x] Tạo `packages/shared/src/data/blessings.ts` và `packages/shared/src/sim/sim-blessings.ts`.
- [x] Cài đặt 4 thẻ Nhóm 1 (kích hoạt cả khi Lật Chắn `[E]` / `Dash-Kick` Chắn lẫn khi `Wall-Slam` / Đầy thanh `bossStaggerAccum`, sát thương tính qua `scaleBlessingDamage(baseDmg, F)`):
  - `table_tech_rocket` (`Lửa`): Lật Chắn `[E]` phóng 2 Tên Lửa Tầm Nhiệt (`base 26 DMG Lửa/quả`); `Dash-Kick` tấm chắn hóa Đầu Đạn Phản Lực (`620 px/s`) nổ `base 60 DMG Lửa` (`r=104px`).
  - `table_tech_blank_nova` (`Băng`): Lật Chắn `[E]` (hoặc `Wall-Slam` trên Tinh Anh/Boss) mở rộng vòng xóa đạn thành `r=160px` và Đóng Băng `1.5s` mọi kẻ địch trong bán kính đó.
  - `table_tech_prism_split` (`Sét`): Tấm chắn do bạn lật tỏa hào quang xanh; mọi viên đạn (`splitGeneration === 0`) của bạn và đồng đội bắn xuyên qua tấm chắn tách thành 2 tia (`splitGeneration = 1`, `+20% Additive DMG`, tẩm `Sét`, gắn `DYNAMIC_BOUNCE`).
  - `table_tech_billiard_master` (`Vật lý`): Tấm chắn, thùng nổ và khối băng do bạn `Dash-Kick` tăng `+35%` vận tốc, nảy qua tường tối đa 3 lần như bi-a và gây thêm `+40%` sát thương `Wall-Slam` / `bossStaggerAccum`.
- [x] Viết unit test TDD `packages/shared/test/ap2-p1d-blessings-group1.test.ts`.

## Task 2 (`P1D.2`): Nhóm 2 (`Dash Techs` — 4 Thẻ Core) & Nhóm 3 (`Reload, Vent & Finisher Techs` — 4 Thẻ Core)
- [x] Cài đặt 4 thẻ Nhóm 2 (`Dash Techs`):
  - `dash_tidal_ram` (`Băng`): Lướt bọc sóng băng húc văng quái (`kb=280`, `base 20 DMG Băng`); nếu quái bị húc đập vào tường (`Wall-Slam`), hồi `60%` hồi chiêu Lướt (`ICD 1.2s`).
  - `dash_venom_wake` (`Độc`): Lướt để lại dải Đầm Thủy Ngân Độc (`3.5s`); nếu cắt qua ít nhất 1 kẻ địch hoặc `Dash-Kick`, lập tức Nạp `50%` Băng đạn / Giảm `40%` Nhiệt.
  - `dash_flame_shackle` (`Lửa`): Lướt qua gần kẻ địch (`trong 88px`) phóng xích lửa kéo giật con quái đập thẳng vào tường/Bia Chắn gần nhất (`Wall-Slam` tức thì + `base 24 DMG Lửa`).
  - `dash_reload_acrobat` (`Vật lý`): Lướt trong khi đang Nạp đạn hoặc có Nhiệt `>= 50%` tua nhanh `40%` tiến độ nạp / hạ `35%` Nhiệt VÀ mở rộng Khung Vàng `[R]` kế tiếp gấp rưỡi (`35%–80%`).
- [x] Cài đặt 4 thẻ Nhóm 3 (`Reload, Vent & Finisher Techs` — chỉ kích hoạt khi bấm trúng `Perfect Reload [R]`, `Tactical Vent [R]`, hoặc khi Đòn 3 của `MELEE_COMBO` chém trúng ít nhất 1 quái / Parry trúng ít nhất 1 đạn; `ICD = 1.5s` súng / `2.0s` cận chiến):
  - `reload_tediore_chuck` (`Lửa`): Ném vỏ băng đạn / lõi nhiệt cũ về con trỏ (`520 px/s`), nổ `base (18 + 4 × số đạn đã bắn) DMG Lửa`.
  - `reload_frost_nova` (`Băng`): Phóng vòng băng giá (`r=110px`, `base 22 DMG Băng`), áp 2 tầng `Chill` và xóa đạn địch sát người.
  - `reload_magnet_vortex` (`Sét`): Bắn mỏ neo từ trường về trước `140px`, hút gom quái xung quanh chụm lại trong `0.8s`.
  - `reload_repulsor_shock` (`Vật lý`): Phóng sóng xung kích hình nón `140°` (`r=165px`), hất văng kẻ địch đang dính trạng thái nguyên tố đập vào tường (`kb=260`, `Wall-Slam`).
- [x] Viết unit test TDD `packages/shared/test/ap2-p1d-blessings-group2-3.test.ts`.

## Task 3 (`P1D.3`): Nhóm 4 (`Geometry & Co-op Bullet Mods` — 4 Thẻ Core) & 10 Thẻ Nâng Cấp Kỹ Năng Nhân Vật
- [x] Cài đặt 4 thẻ Nhóm 4 (`Geometry & Co-op Bullet Mods`):
  - `bullet_split_bounce` (`Vật lý`): Đạn nhận `+1` lần nảy tường; khi đạn gốc (`splitGeneration === 0`) chạm tường/cột/Bia Chắn lần đầu, tách đôi thành 2 viên đạn con (`splitGeneration = 1`, mỗi viên `70% DMG` gốc) bay góc chữ V (`DYNAMIC_BOUNCE`).
  - `bullet_ricochet_boom` (`Lửa`): Mỗi khi đạn nảy qua tường/vật chắn, tại điểm va chạm nổ Xung Lửa (`base 24 DMG × procCoeff`, `r=64px`, `kb=200`, `ICD = 0.20s`).
  - `bullet_heavy_pinball` (`Vật lý`): Đạn và đòn đánh tăng `+50%` `Knockback`; kẻ địch bị đẩy đập vào tường (`Wall-Slam`) nảy bật ngược lại, va vào quái khác làm cả hai cùng Choáng `0.8s`.
  - `bullet_coop_arc_relay` (`Sét`): Khi đạn hoặc nhát chém đi ngang qua Đồng Đội, Summon hoặc Bia Chắn Đã Lật (`trong 56px`), thực thể đó phóng tia Sét (`base 20 DMG × procCoeff`, `ICD = 0.30s`) vào kẻ địch gần nhất.
- [x] Cập nhật 10 Thẻ Nâng Cấp Kỹ Năng Nhân Vật (`vanguard_bastion_prism`, `vanguard_charge`, `ranger_arrow_volley`, `ranger_prey_chain`, `elementalist_vortex`, `elementalist_twin_orbit`, `druid_poison_roots`, `druid_sacred_grove`, `engineer_twin_turrets`, `engineer_self_destruct`).
- [x] Viết unit test TDD `packages/shared/test/ap2-p1d-blessings-group4-skills.test.ts` (kèm bài test rút thẻ qua 6 tầng cho 4 người chơi).

## Task 4 (`P1D.4`): Cập Nhật Giao Diện Modal Chọn Phước Lành (`Per-Player`) & VFX Cho 26 Thẻ
- [x] Cập nhật `hud-modals-and-debug.ts`, `combat-fx-weapons-v2.ts`, `vi.json`, `en.json` hiển thị rõ Nhóm Phước Lành (`[Chắn Chiến]`, `[Lướt Chiến]`, `[Nhịp Nạp]`, `[Đạn Đạo]`, `[Tuyệt Kỹ Class]`), biểu tượng nguyên tố, mô tả súc tích không tràn khung và dải icon Phước lành cá nhân trên HUD.

## Task 5 (`P1D.5`): Xây Dựng Cảnh Chụp Modal Phước Lành & Strip Engine 2.6 (`8 / 12 Frames`) Cho Các Phước Lành Tiêu Biểu
- [x] Bổ sung 7 cảnh theo chuẩn **Engine 2.6** (`ap2-modal-blessing-vi`, `ap2-modal-blessing-en`, `ap2-blessing-table-rocket` strip, `ap2-blessing-prism-split` strip, `ap2-blessing-tediore-chuck` strip, `ap2-skill-vanguard-prism` strip, `ap2-skill-elementalist-twin` strip; `F1 = windup_hold`, `apexEvent` thật từ `WorldSim`, `0` external state mutations, 100% actor containment) vào `visual-scene-ap2-p1d.ts` + `tools/run-shots.ts`.

## Task 6 (`P1D.6`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P1D`
- [x] Chạy `pnpm shots --phase ap2-p1d --label after --group ap2-p1d --verify-freeze` ở chế độ `HARD_ASSERT` (`5/5` cổng animation PASS + `freezeDiffRatio = 0.0000`, `traceHashMatched = true`), chấm qua Visual Reviewer (`pro` `9.73/10 >= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p1d`.
