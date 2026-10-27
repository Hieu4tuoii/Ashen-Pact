# Ashen Pact 2.0 — Phase P3C: Nâng Cấp Bot AI Thực Tế (`Human-Like Bot Profile`), Cân Bằng Tự Động (`pnpm balance`) & Playtest Gate 2 (`ap2-p3c`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Huấn luyện Bot AI sử dụng toàn bộ cơ chế mới của Ashen Pact 2.0 với xác suất giống người thật (`Perfect Reload / Vent [R]` = `50%`, `Flip Cover [E] + Dash-Kick` = `40%`, phá giáp Boss 1–2 bước trong 3–6s, gắn Mutator, ký Khế Ước, phân rã súng thừa), chạy mô phỏng cân bằng không hệ số giả để tinh chỉnh thông số 18 vũ khí, 5 Class và 3 Boss đạt chuẩn nghiệm thu.

---

## Task 1 (`P3C.1`): Nâng Cấp Bot AI (`sim-progression-bot.ts` & `tools/bot-profile.ts`) Theo Profile Người Chơi Thật
- [ ] Tạo/cập nhật `tools/bot-profile.ts` và `packages/shared/src/sim/sim-progression-bot.ts`:
  - Tỷ lệ bấm trúng `Perfect Reload / Tactical Vent [R]` = `50%`.
  - Tỷ lệ chủ động lật Bia Chắn `[E]` khi có đạn địch bay tới và thực hiện `Dash-Kick` = `40%`.
  - Khi Boss bật trạng thái Giáp ở `66%` & `33% HP`: Bot di chuyển tới Bia Chắn / Đồ Chơi gần nhất (trong vòng 3–6 giây) để thực hiện `Dash-Kick` phá giáp Boss.
  - Ngoài giao tranh: Bot tương tác Đe Rèn Cổ Đại gắn `Mutator`, ký Khế Ước Tro Tàn hợp lý, và giữ `DROP_WEAPON` `0.5s` để phân rã súng thừa lấy Vàng mua đồ tại Chợ Đen.
  - Tuyệt đối không dùng `godMode = true` hay nhân máu giả trong `tools/balance-simulations.ts`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3c-human-bot-profile.test.ts`.

## Task 2 (`P3C.2`): Mở Rộng `tools/balance-harness.ts` & `tools/balance-simulations.ts` Đo Đạc Toàn Diện 18 Vũ Khí & 5 Class
- [ ] Đo thực tế DPS Thường vs DPS Active `[R]` của toàn bộ 18 vũ khí.
- [ ] Chạy mô phỏng `>= 30 runs` có seed cố định cho từng Class trong cả 5 Class (`vanguard`, `ranger`, `elementalist`, `druid`, `engineer`) ở chế độ Solo `1P`, Co-op `2P` và Co-op `4P`.

## Task 3 (`P3C.3`): Tinh Chỉnh Thông Số Cân Bằng (`weapons.ts`, `enemies.ts`, `scaling.ts`) Đạt Chuẩn Nghiệm Thu
- [ ] Độ lệch DPS giữa 5 vũ khí khởi đầu `< 5%`.
- [ ] Tỷ lệ thắng (`Winrate`) giữa 5 Class không lệch nhau quá `+-6%`.
- [ ] Thời gian hạ Boss B1 / B2 / B3 nằm trong khoảng `60–120 giây` (độ lệch giữa `1P` và `4P` `<= +-20%`).
- [ ] Tỷ lệ thắng Boss: B1 `80–95%`, B2 `70–90%`, B3 `60–85%`, `0` trường hợp bị one-shot từ đầy máu+giáp.

## Task 4 (`P3C.4`): Xuất Báo Cáo Cân Bằng (`docs/balance-report.md`) & Cập Nhật `docs/BALANCE.md`
- [ ] Chạy `pnpm balance` xuất bảng số liệu đầy đủ vào `docs/balance-report.md` và đồng bộ `docs/BALANCE.md`.

## Task 5 (`P3C.5`): Phase Gate `P3C` (`pnpm verify` + `pnpm balance` + `pnpm perf` + tag `ap2-p3c`) & Báo Cáo `Playtest Gate 2`
- [ ] Chạy `pnpm verify`, `pnpm balance` và `pnpm perf`, ghi báo cáo nghiệm thu `Playtest Gate 2` vào `docs/PROGRESS.md` & `docs/PHASES.md`, commit và tag `ap2-p3c`.
