# Ashen Pact 2.0 — Phase P5: Kiểm Thử Cân Bằng (`1,000-Run Bot Simulation`), Đại Tu E2E Suite, Kiểm Chứng 60 FPS & Phát Hành `v2.0.0` (`ap2-p5`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp `sim-progression-bot.ts` và `tools/balance-report.ts` để chạy mô phỏng 1,000 lượt chạy tự động kiểm chứng toàn bộ 18 vũ khí, 5 nhân vật, 16 Phước Lành, 6 Bản Độ Búa Rèn và 6 Khế Ước Tro Tàn đạt các ngưỡng cân bằng khắt khe của Mục 9.4 `master-promt-v3.md`; cập nhật toàn bộ bộ test E2E Playwright (`phase1.spec.ts`..`phase8.spec.ts`) và thêm `tests/e2e/ashen-pact-2.0.spec.ts`; chụp và chấm điểm Visual Gate cuối cùng trên toàn bộ 42 cảnh (`--group all` + `--group ap2-all`); chạy `pnpm verify` + `pnpm perf`, nâng version lên `2.0.0`, và hoàn tất nhánh phát triển theo `finishing-a-development-branch`.

**Architecture:** Cập nhật `packages/shared/src/sim/sim-progression-bot.ts`, `tools/balance-report.ts`, `tests/e2e/ashen-pact-2.0.spec.ts`, `package.json`, `docs/CHANGELOG.md`, `docs/PROGRESS.md`, `docs/PHASES.md`.

---

## Task 1 (`P5.1`): Nâng Cấp AI Bot Tự Chơi (`sim-progression-bot.ts`) & Công Cụ Báo Cáo Cân Bằng (`tools/balance-report.ts`) Cho Hệ Thống 2.0
- [ ] Cập nhật `sim-progression-bot.ts` để bot biết sử dụng `Perfect Reload / Vent [R]`, `Dash-Kick / Wall-Slam`, phân rã súng thừa lấy Vàng, chọn `Daedalus Mutator` tại Đe Rèn, và ký/thanh tẩy `Ashen Pact` qua 3 Biome.
- [ ] Chạy mô phỏng 1,000 lượt chạy và tinh chỉnh thông số (nếu cần) để đạt chuẩn cân bằng Mục 9.4:
  - Tỉ lệ thắng trung bình của Bot kỹ năng khá qua 6 tầng nằm trong khoảng `38% – 58%`.
  - Không có vũ khí nào trong 18 vũ khí chiếm tỉ lệ thắng lệch quá `+-12%` so với mức trung bình cùng bậc phẩm chất.
  - Sát thương từ tương tác môi trường (`Wall-Slam`, `Dash-Kick`, đồ chơi trong phòng) chiếm trung bình `12% – 25%` tổng sát thương trong các phòng giao tranh thường.
  - Tỉ lệ hoàn thành thử thách Khế Ước Tro Tàn (`Full-Biome + Boss Trial`) thành Di Vật Thức Tỉnh nằm trong khoảng `55% – 75%`.
- [ ] Viết unit test kiểm chứng cân bằng và deterministic soak test `packages/shared/test/ap2-p5-balance-soak.test.ts` (bao gồm kiểm chứng `MAX_PROJECTILES = 360`, `MAX_PARTICLES = 320`, `estimateSnapshotBytes(sim) <= 4608` với 4 người chơi Co-op).

## Task 2 (`P5.2`): Hoàn Thiện Bộ Test E2E Playwright (`tests/e2e/ashen-pact-2.0.spec.ts`) & Kiểm Tra Toàn Bộ `phase1..8.spec.ts`
- [ ] Tạo `tests/e2e/ashen-pact-2.0.spec.ts` kiểm chứng end-to-end trên trình duyệt thực tế:
  1. Không còn thanh Energy; HUD hiển thị đúng thanh Nhịp Vũ Khí (`magazine`, `heat`, `charge`, `melee_combo`) và thực hiện `Perfect Reload / Vent [R]` thành công.
  2. Thực hiện `Dash-Kick` đẩy thùng/quái tạo `Wall-Slam` và phá vỡ `cracked_wall` mở Phòng Bí Mật Động.
  3. Giữ `[X]` `0.5s` ngoài giao tranh phân rã súng rơi thành Vàng cá nhân; mở Đe Rèn Cổ Đại gắn `Daedalus Mutator`.
  4. Ký Khế Ước Tro Tàn tại Tầng 1, giữ qua Tầng 2, hạ Boss Tầng 2 và thức tỉnh thành Di Vật Vĩnh Viễn.
  5. Màn hình Tổng Kết Cuối Trận hiển thị bảng phân tích sát thương 4 nguồn và số pha `Perfect Reload` / `Wall-Slam`.

## Task 3 (`P5.3`): Final Visual Gate (`--group all` & `--group ap2-all`), Final Phase Gate (`pnpm verify` + `pnpm perf`), Nâng Cấp Phiên Bản `v2.0.0` & `finishing-a-development-branch`
- [ ] Chạy `pnpm shots -- --phase ap2-p5 --label after --group ap2-all` và chấm điểm qua subagent `Visual Reviewer` (`Model: 'pro'`) đạt `>= 8.0/10` (`0` blocker, `0` major).
- [ ] Chạy toàn bộ cổng kiểm chứng `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `test:e2e`) và `pnpm perf` (`avgFps >= 55`, `p99FrameTimeMs <= 28`, `heapGrowthMb <= 15`, `snapshotBytesAvg <= 4608`).
- [ ] Cập nhật `package.json` lên `"version": "2.0.0"`, cập nhật `docs/CHANGELOG.md`, `docs/PROGRESS.md`, `docs/PHASES.md`, commit và gắn tag `ap2-p5` & `v2.0.0`.
