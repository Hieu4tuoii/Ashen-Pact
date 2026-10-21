# Phase P12: Hồi Quy Toàn Diện, Hiệu Năng & Phát Hành `v0.2.0` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn tất nâng cấp Ashen Pact lên phiên bản **`v0.2.0 ("Polish & Depth")`**: đồng bộ version `0.2.0` trên toàn hệ thống, dọn dẹp các mục `minor (deferred)` trong ledger, cập nhật tài liệu phát hành (`README.md`, `docs/RELEASE_NOTES.md`, `docs/QA_CHECKLIST.md`, `CREDITS.md`), đóng gói bản phát hành Windows `AshenPact-v0.2.0-win-x64.zip` và kiểm chứng E2E qua IP LAN thực trên Chromium + Microsoft Edge + Soak Test 20 phút, chụp lại toàn bộ danh mục cảnh (`docs/screenshots/polish-p12/final/`) để đánh giá Holistic `pro` Visual Review đối chiếu với Baseline `v0.1.0` (mọi tiêu chí Rubric `>= 8.0/10`), chạy Whole-Branch `pro` Code Review (`git merge-base master HEAD..HEAD`), gắn tag `polish-p12` & `v0.2.0`, và trình bày menu hoàn tất nhánh.

**Architecture:**
1. **Đồng bộ Phiên bản `0.2.0` & Dọn dẹp Ledger:** Cập nhật `0.1.0` → `0.2.0` trong tất cả `package.json`, `apps/server/src/index.ts`, `tools/package-release.ts` (tên gói `AshenPact-v0.2.0-win-x64`, tiêu đề C# Launcher, batch scripts), `tests/e2e/phase8.spec.ts`, `packages/shared/test/phase8-soak-release.test.ts`, `CREDITS.md` và `docs/CREDITS.md`. Đồng thời xử lý 2 mục `minor (deferred)` của Phase P9b (`controlsModalOpen` khi đang mở tab `controls` của `SettingsModal` và phím tắt `[O]` mở `SettingsModal` khi đang mở `PauseModal`).
2. **Tài liệu & Đóng gói Phát hành `v0.2.0`:** Cập nhật `README.md` (sửa mô tả Bão Tuyết Phase 3 Kryssa không còn ghi `"thu hẹp tầm nhìn"`, cập nhật bảng phím điều khiển mới, tầng hầm 10 phòng có Phòng Thử Thách, các lệnh `pnpm shots`/`pnpm perf`/`pnpm balance`), viết `docs/RELEASE_NOTES.md` cho `v0.2.0`, cập nhật `docs/QA_CHECKLIST.md`, chạy `pnpm package:release`, chạy Soak Test 20 phút (`72,000` ticks @ 60Hz) và `tests/e2e/phase8.spec.ts`.
3. **Chụp Toàn Bộ Danh Mục Cảnh & Holistic `pro` Visual Gate:** Chạy `pnpm shots -- --phase p12 --label final --verify-freeze` để chụp toàn bộ danh mục cảnh vào `docs/screenshots/polish-p12/final/`, tạo bảng đối chiếu `baseline` (`polish-p0/baseline`) ↔ `final` (`polish-p12/final`), và điều phối `pro` Visual Reviewer độc lập chấm điểm tổng thể cả 9 tiêu chí Rubric Mục 6.
4. **Whole-Branch `pro` Code Review & Hoàn Tất Nhánh:** Chạy `requesting-code-review` (`pro` model) trên toàn nhánh `git merge-base master HEAD..HEAD` kèm danh sách phân loại mọi mục `minor (deferred)` / `parked`, chạy `pnpm verify` + `pnpm perf`, gắn tag `polish-p12` và `v0.2.0`, và trình bày báo cáo cuối cùng kèm menu 3 lựa chọn của `finishing-a-development-branch`.

**Tech Stack:** TypeScript 5.x, Phaser 3.80 (WebGL), Colyseus 0.15, Vitest, Playwright (Chromium + Microsoft Edge), Node.js 20+, C# `.NET` Host Launcher (`csc.exe`).

---

## Task 1: Bump Version `0.2.0`, Dọn Dẹp Ledger, Cập Nhật Tài Liệu Phát Hành, Đóng Gói `AshenPact-v0.2.0-win-x64.zip`, Soak Test 20 Phút & E2E `phase8.spec.ts`

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/client/package.json`
- Modify: `apps/server/package.json`
- Modify: `apps/server/src/index.ts`
- Modify: `tools/package-release.ts`
- Modify: `tests/e2e/phase8.spec.ts`
- Modify: `packages/shared/test/phase8-soak-release.test.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `README.md`
- Modify: `CREDITS.md`
- Modify: `docs/CREDITS.md`
- Modify: `docs/RELEASE_NOTES.md`
- Modify: `docs/QA_CHECKLIST.md`
- Create: `packages/shared/test/polish-p12-release-version.test.ts`

- [ ] **Step 1: Viết unit test kiểm tra đồng bộ phiên bản `0.2.0` và tài liệu phát hành (TDD RED)**
  - Tạo `packages/shared/test/polish-p12-release-version.test.ts` kiểm tra:
    - `package.json`, `packages/shared/package.json`, `apps/client/package.json`, `apps/server/package.json` đều có `"version": "0.2.0"`.
    - `tools/package-release.ts` định nghĩa `RELEASE_NAME = 'AshenPact-v0.2.0-win-x64'` và tiêu đề `Ashen Pact v0.2.0`.
    - `apps/server/src/index.ts` trả về `version: '0.2.0'` ở `/api/health`, `/api/host-info` và in banner `ASHEN PACT v0.2.0`.
    - `README.md` tham chiếu `v0.2.0`, `AshenPact-v0.2.0-win-x64.zip`, có hướng dẫn `Ctrl + Shift + D` / `start-host-debug.bat`, và dòng mô tả Boss Kryssa **không còn** chứa cụm `"thu hẹp tầm nhìn"`.
    - `docs/RELEASE_NOTES.md` và `docs/QA_CHECKLIST.md` được cập nhật cho `v0.2.0`.

- [ ] **Step 2: Thực thi bump version `0.2.0`, dọn dẹp 2 mục `minor (deferred)` của P9b và cập nhật tài liệu (TDD GREEN)**
  - Cập nhật `0.1.0` → `0.2.0` trong 4 file `package.json`, `apps/server/src/index.ts`, `tools/package-release.ts`, `tests/e2e/phase8.spec.ts`, `packages/shared/test/phase8-soak-release.test.ts`, `CREDITS.md`, `docs/CREDITS.md`.
  - Trong `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts:951`, đồng bộ `debug.controlsModalOpen = this.controlsModalOpen || (this.settingsModalOpen && this.settingsActiveTab === 'controls')`.
  - Trong `apps/client/src/scenes/game-scene/input-and-network.ts`, bổ sung xử lý phím `KeyO` khi `this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModalOpen` để mở `SettingsModal` đúng như nhãn nút `⚙ Cài Đặt [O]` trên Pause Modal.
  - Cập nhật `README.md`, `docs/RELEASE_NOTES.md`, `docs/QA_CHECKLIST.md`.

- [ ] **Step 3: Đóng gói `pnpm package:release`, chạy Soak Test 20 phút (`phase8-soak-release.test.ts`) và E2E `phase8.spec.ts`**
  - Xóa thư mục/zip cũ `release/AshenPact-v0.1.0-win-x64*` nếu còn tồn tại, chạy `pnpm package:release` tạo `release/AshenPact-v0.2.0-win-x64/` và `release/AshenPact-v0.2.0-win-x64.zip`.
  - Chạy `npx vitest run packages/shared/test/polish-p12-release-version.test.ts packages/shared/test/phase8-soak-release.test.ts`.
  - Chạy `npx playwright test tests/e2e/phase8.spec.ts` (kiểm chứng bản đóng gói `v0.2.0` chạy mặc định không có debug, chạy `--debug` có debug, và 2 client Chromium + Microsoft Edge kết nối qua IP LAN thực vượt ải + hạ Boss).
  - Khôi phục các ảnh chụp thư mục cũ nếu `phase8.spec.ts` ghi đè (`git checkout -- docs/screenshots/phase-8 docs/screenshots/polish-p1`).

---

## Task 2: Chụp Toàn Bộ Danh Mục Cảnh (`docs/screenshots/polish-p12/final/`), Tạo Đối Chiếu Baseline ↔ Final & Chạy Holistic `pro` Visual Review

**Files:**
- Create: `docs/screenshots/polish-p12/final/*` (captured via `pnpm shots -- --phase p12 --label final --verify-freeze`)
- Create: `docs/screenshots/polish-p12/comparison-summary.json`
- Create: `docs/screenshots/polish-p12/review.md`

- [ ] **Step 1: Chụp toàn bộ danh mục cảnh (`VISUAL_SCENES`) vào `docs/screenshots/polish-p12/final/` kèm `--verify-freeze`**
  - Chạy `pnpm shots -- --phase p12 --label final --verify-freeze`.
  - Kiểm tra `docs/screenshots/polish-p12/final/metrics.json` đảm bảo mọi cảnh đều có `freezeDiffRatio <= 0.005` (`0.5%`), `0` console error/warning, và toàn bộ chỉ số trắc quang đạt chuẩn Spec 3.5.

- [ ] **Step 2: Tổng hợp bảng đối chiếu trắc quang & ảnh Baseline (`polish-p0/baseline`) ↔ Final (`polish-p12/final`)**
  - Tạo `docs/screenshots/polish-p12/comparison-summary.json` và các ảnh ghép so sánh tiêu biểu (`b1-combat-compare.png`, `b2-combat-compare.png`, `b3-combat-compare.png`, `hub-solo-compare.png`, `menu-compare.png`, `modal-victory-compare.png`) trong `docs/screenshots/polish-p12/` để người dùng và Holistic Visual Reviewer quan sát trực tiếp sự lột xác từ `v0.1.0` lên `v0.2.0`.

- [ ] **Step 3: Điều phối Independent Holistic `pro` Visual Reviewer chấm điểm tổng thể 9 tiêu chí Rubric**
  - Reviewer đọc `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md`, `docs/ART_GUIDE.md`, `docs/screenshots/polish-p0/review-baseline.md`, `docs/screenshots/polish-p12/final/metrics.json`, ảnh phòng chuẩn B1 và bộ ảnh `polish-p0/baseline/` đối chiếu với `polish-p12/final/`.
  - Yêu cầu cổng Visual Gate P12: Mọi tiêu chí trong 9 tiêu chí Rubric Mục 6 đạt **`>= 8.0 / 10`**, không có tiêu chí nào thấp hơn baseline, `0` Blocker, `0` Major. Lưu báo cáo vào `docs/screenshots/polish-p12/review.md`.

---

## Task 3: Whole-Branch `pro` Code Review, Kiểm Định Cuối Cùng (`pnpm verify`, `pnpm perf`), Gắn Tag `polish-p12` & `v0.2.0` và Trình Bày Menu Hoàn Tất Nhánh

**Files:**
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`
- Modify: `.superpowers/sdd/2026-10-21-polish-p12-regression-release-v0.2.0/progress.md`

- [ ] **Step 1: Chuẩn bị gói Review Toàn Nhánh (`git merge-base master HEAD..HEAD`) và điều phối `pro` Whole-Branch Code Reviewer**
  - Xuất danh sách commit, thống kê file thay đổi, kiểm tra giới hạn `< 1000` dòng trên toàn bộ file nguồn/test, và danh sách toàn bộ các mục `minor (deferred)` / `parked` từ các ledger P0 → P11.
  - Điều phối subagent `research` (`model: 'pro'`) thực hiện Whole-Branch Code Review. Nếu phát hiện lỗi cần sửa trước khi merge, gom thành **một** fix dispatch duy nhất rồi re-review có phạm vi.

- [ ] **Step 2: Chạy Full Verification Gate (`pnpm verify`, `pnpm perf`, `pnpm balance`) và cập nhật `docs/PROGRESS.md` & `docs/PHASES.md`**
  - Chạy `pnpm verify` (`typecheck`, `lint`, `test`, `build`, `e2e`) và `pnpm perf`.
  - Cập nhật `docs/PROGRESS.md` (Mục `3.19 Phase P12 — Hồi quy toàn diện, hiệu năng & phát hành v0.2.0`), đánh dấu `[x]` cho P12 trong `docs/PHASES.md`, commit và gắn cả 2 git tag `polish-p12` và `v0.2.0`.

- [ ] **Step 3: Thực hiện `finishing-a-development-branch` (Trình bày Báo cáo Cuối & Menu 3 Lựa Chọn)**
  - Xuất báo cáo tổng kết gồm:
    1. Bảng điểm Visual Reviewer từ **Baseline (`v0.1.0`) → Final (`v0.2.0`)** theo từng tiêu chí trong 9 tiêu chí Rubric.
    2. Danh sách **"Cần tôi xem"** (các ảnh tiêu biểu, gói phát hành `AshenPact-v0.2.0-win-x64.zip`, báo cáo cân bằng `docs/balance-report.md`, checklist test tay).
    3. Mục **"Các Ruling tôi đã tự quyết"** tổng hợp từ P0 → P12.
    4. **Menu 3 lựa chọn** của `finishing-a-development-branch` (1. Merge về `master` tại máy / 2. Push và tạo Pull Request / 3. Giữ nguyên nhánh `polish/v0.2.0`) và chờ quyết định của người dùng.
