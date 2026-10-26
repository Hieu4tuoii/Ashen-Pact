# Ashen Pact 2.0 — Phase P4A: Đại Tu HUD, Thẻ So Sánh Súng 2.0, Bách Khoa Toàn Thư (`Codex 2.0`) & Bảng Phân Tích Sát Thương Cuối Trận (`ap2-p4a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện toàn bộ giao diện HUD & Modal cho hệ thống 2.0 theo Mục 8 `master-promt-v3.md`: Thẻ So Sánh Vũ Khí 2.0 (`hud-weapon-comparison.ts`) hiển thị 4 thông số thực tế (`Hỏa lực cơ bản + Bậc Tinh Luyện`, `Nhịp vận hành`, `Đặc tính cơ học`, `Bản độ Búa Rèn Daedalus Mutators`) kèm nhắc phím `[E] Nhặt / Đổi` và `[Giữ X 0.5s] Phân rã (+Gold)`, Bách Khoa Toàn Thư (`hud-codex-modal.ts`) có đầy đủ tab `18 Vũ Khí`, `16 Phước Lành Cốt Lõi`, `6 Bản Độ Búa Rèn`, `6 Khế Ước & 6 Di Vật Thức Tỉnh`, và Bảng Tổng Kết Cuối Trận (`hud-modals.ts`) thống kê chi tiết sát thương theo nguồn (`Vũ khí`, `Kỹ năng & Phản ứng nguyên tố`, `Tương tác vật lý & Đồ chơi phòng`, `Di Vật Thức Tỉnh`) kèm số lần `Perfect Reload / Vent [R]` và `Wall-Slam / Dash-Kick`.

**Architecture:** Cập nhật `apps/client/src/scenes/game-scene/hud-weapon-comparison.ts`, `apps/client/src/scenes/game-scene/hud-codex-modal.ts`, `apps/client/src/scenes/game-scene/hud-modals.ts`, tạo `tests/e2e/helpers/visual-scene-ap2-p4.ts` (`< 600 dòng`).

---

## Task 1 (`P4A.1`): Đại Tu Thẻ So Sánh Vũ Khí (`hud-weapon-comparison.ts`) & Đồng Bộ Lưu Trữ (`storage-settings.ts`)
- [ ] Xóa dòng `Năng lượng / phát` trên Thẻ So Sánh Vũ Khí; thay bằng 4 thông số thực tế:
  1. **Hỏa lực cơ bản & Bậc Tinh Luyện** (`Sát thương x Số tia + Cấp +1/+2...`)
  2. **Nhịp vận hành** (`Băng đạn N viên (Nạp X.Xs)` / `Nhiệt độ (Tự nguội / Xả [R])` / `Tụ lực X.Xs` / `Chuỗi 3 đòn`)
  3. **Đặc tính cơ học** (ví dụ: *Viên thứ 4 ghim đinh sét*, *Nảy tường tăng 45% DMG*, *Đòn 3 hất văng Wall-Slam*)
  4. **Bản độ Búa Rèn (`Daedalus Mutators`)** đang gắn trên súng (nếu có)
- [ ] Hiển thị rõ 2 phím tương tác cạnh vũ khí rơi trên đất ngoài giao tranh: `[E] Nhặt / Đổi` và `[Giữ X 0.5s] Phân rã (+10..45 Vàng)`.
- [ ] Cập nhật `storage-settings.ts`: xóa tự động các ID vũ khí/buff cũ đã bị loại bỏ khỏi `unlockedCodexIds` trong `localStorage` để không gây lỗi hiển thị, đồng thời thêm mục theo dõi các `Ashen Relics` và `Weapon Mutators` đã khám phá.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4a-codex-breakdown.test.ts`.

## Task 2 (`P4A.2`): Nâng Cấp Bách Khoa Toàn Thư (`hud-codex-modal.ts`) & Bảng Phân Tích Sát Thương Cuối Trận (`hud-modals.ts`)
- [ ] Cập nhật `hud-codex-modal.ts` hiển thị đầy đủ danh mục `18 Vũ Khí Cơ Học`, `16 Phước Lành Cốt Lõi`, `6 Bản Độ Búa Rèn`, và `6 Khế Ước & 6 Di Vật Thức Tỉnh` (song ngữ VI/EN).
- [ ] Cập nhật màn hình Chiến Thắng / Thất Bại (`hud-modals.ts`) bổ sung bảng phân tích đóng góp sát thương của từng người chơi theo nguồn:
  - **Sát thương Vũ khí** (Đạn / Cận chiến)
  - **Sát thương Kỹ năng & Phản ứng nguyên tố**
  - **Sát thương Tương tác vật lý & Đồ chơi phòng** (`Wall-Slam`, `Dash-Kick`, thùng nổ, cột băng, bẫy điện...)
  - **Sát thương Di Vật Thức Tỉnh** (`Khế Ước Tro Tàn`)
  - Cùng số lần thực hiện **`Perfect Reload / Vent [R]`** và số pha **`Wall-Slam / Dash-Kick`**.

## Task 3 (`P4A.3`): Xây Dựng Cảnh Chụp Kiểm Chứng HUD, Thẻ So Sánh Súng 2.0, Codex & Bảng Tổng Kết (`visual-scene-ap2-p4.ts`)
- [ ] Tạo `tests/e2e/helpers/visual-scene-ap2-p4.ts` với 3 cảnh (`ap2-hud-weapon-compare-2.0`, `ap2-codex-weapons-and-pacts`, `ap2-victory-damage-breakdown`) và đăng ký nhóm `ap2-p4a`.

## Task 4 (`P4A.4`): Visual Gate & Phase Gate `P4A`
- [ ] Chạy `pnpm shots -- --phase ap2-p4a --label after --group ap2-p4a`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p4a`.
