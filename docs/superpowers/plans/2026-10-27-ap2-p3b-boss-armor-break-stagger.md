# Ashen Pact 2.0 — Phase P3B: Thiết Kế Lại 3 Boss Với Cơ Chế Phá Giáp Trực Quan (`1–2 Bước`), `Boss Supply Drop` & `bossStaggerAccum` (`ap2-p3b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Biến 3 trận đánh Boss (`spore_king`, `kryssa_ice_queen`, `forge_titan`) thành đỉnh cao ứng dụng của vòng lặp `Lật Chắn [E] + Dash-Kick Đồ Chơi Biome + Phá Giáp 1–2 Bước`, kèm hệ thống tiếp tế `Boss Supply Drop` mỗi `18.0s` và thanh chấn động `bossStaggerAccum (0..100)`.

**Architecture:** Tạo mới `packages/shared/src/sim/sim-boss-armor-break.ts` (`< 650 dòng`), kết nối vào `sim-enemies-core.ts`, `sim-enemies-biome1.ts`, `sim-enemies-biome2.ts`, `sim-enemies-biome3.ts`, `hud-combat-and-coop.ts`, và `tests/e2e/helpers/visual-scene-ap2-p3.ts`.

---

## Task 1 (`P3B.1`): Hệ Thống Tiếp Tế Phòng Boss (`Boss Supply Drop 18s`) & Thanh Chấn Động Boss (`bossStaggerAccum 0..100`)
- [ ] Trong phòng `boss`, cứ mỗi `18.0s` (và ngay khi Boss chuyển Phase ở `66% HP` & `33% HP`), kiểm tra số lượng `Flippable Barricade` và `Biome Prop` đang còn trong phòng; nếu thiếu thì thả bổ sung từ trên cao xuống (vòng chỉ thị vàng `0.6s`) để luôn duy trì đủ `3 Bia Chắn + 2 Đồ Chơi Biome`.
- [ ] Thanh Chấn Động Boss (`bossStaggerAccum: 0..100`): nhận đòn có `knockback > 0` cộng `deltaStagger = (knockback / 12) * procCoefficient` (bị `Dash-Kick` Bia Chắn / Đồ Chơi đập trúng cộng thẳng `+50 Stagger`). Khi `bossStaggerAccum >= 100`: reset về `0` (ICD `6.0s`), kích nổ hiệu ứng `WALL-SLAM!` ngay trên người Boss (khựng `0.5s` + kích hoạt toàn bộ các Phước lành liên quan đến `Wall-Slam` / `Barricade Techs`).
- [ ] Vẽ thanh `Stagger Bar` màu Vàng Cam ngay dưới thanh Máu của Boss trên HUD.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-boss-supply-stagger.test.ts`.

## Task 2 (`P3B.2`): Đại Tu Boss Biome 1: `spore_king` (Mục Vương Nấm Độc — Phá Giáp 1 Bước)
- [ ] Khi máu chạm ngưỡng `66%` và `33% HP`, Mục Vương dựng Vỏ Bào Tử Cường Hóa (giảm `70%` sát thương đạn thường) và gồng lao húc.
- [ ] Phá Giáp 1 Bước: `Dash-Kick` bất kỳ `moss_table` hoặc `volatile_spore_pod` nào đập trúng Mục Vương (hoặc đứng trước `rotten_totem_pillar` dụ Mục Vương húc vào) làm Vỏ Bào Tử vỡ tan, gây `6% MaxHP` sát thương chuẩn (`Dmg_Hazard`) và Choáng Phá Giáp trong `3.5s` (`+40% EnemyVuln`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-boss1-spore-king.test.ts`.

## Task 3 (`P3B.3`): Đại Tu Boss Biome 2: `kryssa_ice_queen` (Băng Hậu Kryssa — Phá Giáp 1–2 Bước)
- [ ] Khi máu chạm ngưỡng `66%` và `33% HP`, Kryssa dựng Khiên Băng Hàn (giảm `75%` sát thương đạn thường) và quét tia Laser Băng Cực Hàn.
- [ ] Phá Giáp 1–2 Bước: Nhấn `[E]` lật `glacial_barricade` chặn tia laser của ả, sau đó dùng `Dash-Kick` sút chính `glacial_barricade` đó (hoặc `sliding_ice_block`) tông thẳng vào người Kryssa làm Khiên Băng vỡ nát, gây `6% MaxHP` sát thương chuẩn và Đóng Băng Phá Giáp trong `3.0s` (`+40% EnemyVuln`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-boss2-kryssa.test.ts`.

## Task 4 (`P3B.4`): Đại Tu Boss Biome 3: `forge_titan` (Titan Lò Rèn — Phá Giáp 1 Bước)
- [ ] Khi máu chạm ngưỡng `66%` và `33% HP`, Titan bật Giáp Nhiệt Hạch (giảm `75%` sát thương đạn thường) và thả các Lõi Năng Lượng / Bom Lò Than ra sàn.
- [ ] Phá Giáp 1 Bước: `Dash-Kick` bất kỳ `forge_blast_shield`, Lõi Năng Lượng, Bom Lò Than hoặc `slag_crucible` nào tông trúng Titan (hoặc kích hoạt `pneumatic_press` dập xuống khi Titan bước qua giữa phòng) làm Giáp Nhiệt Hạch quá tải phát nổ, gây `6% MaxHP` sát thương chuẩn và Choáng Phá Giáp trong `4.0s` (`+40% EnemyVuln`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-boss3-forge-titan.test.ts`.

## Task 5 (`P3B.5`): Giao Diện HUD Boss (Khiên Giáp + Thanh Stagger + Gợi Ý Phá Giáp) & Cảnh Chụp Strip Engine 2.6 (`8 / 12 Frames`) Cho 3 Boss (`visual-scene-ap2-p3.ts`)
- [ ] Trên thanh máu Boss, hiển thị lớp khung giáp bọc ngoài kèm dòng gợi ý chiến thuật ngắn gọn (`"SÚT BÀN ĐÁ / BÀO TỬ PHÁ GIÁP!"`, `"LẬT PHIẾN BĂNG CHẶN LASER & SÚT PHÁ KHIÊN!"`, `"SÚT KHIÊN THÉP / LÕI NĂNG LƯỢNG HOẶC DẬP BÚA MÁY!"`).
- [ ] Tạo 4 cảnh strip theo chuẩn **Engine 2.6**: `ap2-boss-supply-drop`, `ap2-boss1-armor-break`, `ap2-boss2-armor-break`, `ap2-boss3-armor-break`.

## Task 6 (`P3B.6`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P3B`
- [ ] Chạy `pnpm shots --phase ap2-p3b --label after --group ap2-p3b --verify-freeze` ở chế độ `HARD_ASSERT`, chấm qua Visual Reviewer (`pro` `>= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p3b`.
