# Ashen Pact 2.0 — Phase P5: Tổng Duyệt Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói `v2.0.0` & Kết Thúc Nhánh (`ap2-p5`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiểm định chéo toàn bộ hệ thống Ashen Pact 2.0 ở cấp độ sản phẩm phát hành thương mại `v2.0.0`, đạt Holistic Visual Gate (`Model: pro` `>= 8.5/10` trên mọi tiêu chí), cân bằng (`pnpm balance`), hiệu năng 60Hz 4P (`pnpm perf`), đồng bộ tài liệu, nâng phiên bản `2.0.0`, đóng gói bản phát hành (`pnpm package:release`), tổng duyệt code toàn nhánh và trình menu kết thúc nhánh.

---

## Task 1 (`P5.1`): Chụp Toàn Bộ Danh Mục Cảnh (`v0.2.0` + `Ashen Pact 2.0`) & Tổng Duyệt Holistic Visual Gate (`Model: pro` `>= 8.5/10`)
- [ ] Chạy `pnpm shots -- --phase ap2-p5 --label final` chụp toàn bộ danh mục cảnh và chạy `tools/visual-metrics.ts`.
- [ ] Triệu hồi Holistic Visual Reviewer (`research`, model `pro`) chấm tổng thể toàn bộ bộ ảnh `final` (mọi tiêu chí trong Rubric 10 Tiêu Chí đạt `>= 8.5 / 10`, `0 blocker`, `0 major`).

## Task 2 (`P5.2`): Kiểm Toán Cân Bằng Cuối Cùng (`pnpm balance`) & Kiểm Toán Hiệu Năng / Soak Test 60Hz 4P (`pnpm perf`)
- [ ] Chạy `pnpm balance` sau khi đã có đủ 24 Phước lành, 10 Mutators và 6 Duo Boons.
- [ ] Chạy `pnpm perf` và bài test chịu tải 4P Co-op LAN (`p95 < 4.5ms` Server tick, `>= 58 FPS` Client GPU stress test).

## Task 3 (`P5.3`): Đồng Bộ Toàn Bộ Tài Liệu Kiến Trúc & Thiết Kế (`docs/*.md` & `README.md`)
- [ ] Cập nhật `docs/GDD.md`, `docs/BALANCE.md`, `docs/TECH.md`, `docs/ART_GUIDE.md`, `README.md`, `RELEASE_NOTES.md`, `docs/PROGRESS.md`, `docs/PHASES.md`.

## Task 4 (`P5.4`): Nâng Phiên Bản Lên `2.0.0` (`Version Bump`) & Kiểm Thử Đóng Gói Bản Phát Hành (`pnpm package:release`)
- [ ] Cập nhật version từ `0.2.1` lên `2.0.0` tại tất cả `package.json`, `tools/package-release.ts`, banner Server, và `tests/e2e/phase8.spec.ts`.
- [ ] Chạy `pnpm package:release` và `pnpm verify`.

## Task 5 (`P5.5`): Tổng Duyệt Code Toàn Nhánh (`requesting-code-review`, `Model: 'pro'`) & Tag `v2.0.0`
- [ ] Triệu hồi Code Reviewer (`pro`) kiểm toán toàn bộ diff từ `git merge-base master HEAD` đến `HEAD`, xử lý mọi vấn đề (nếu có), chạy `pnpm verify` và gắn `git tag v2.0.0`.

## Task 6 (`P5.6`): Báo Cáo Tổng Kết Chiến Dịch & Trình Menu Kết Thúc Nhánh (`finishing-a-development-branch`)
- [ ] Xuất báo cáo tổng kết đầy đủ 14 Phase (`P0A` -> `P5`) và trình Menu 3 lựa chọn của `finishing-a-development-branch`.
