# Ashen Pact 2.0 — Phase P4B: Mở Rộng Chiều Sâu Đợt 2: 6 Phước Lành Giao Thoa (`Elemental Duo Boons`) & Đấu Trường Bí Mật 20 Giây (`ap2-p4b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài đặt tầng sâu nhất của hệ thống Build (**6 Elemental Duo Boons** xuất hiện khi người chơi sở hữu cặp nguyên tố tương ứng) và thử thách kỹ năng tốc độ cao **Đấu Trường Bí Mật 20 Giây (`Secret Skill Arena 20s`)** trong Phòng Bí Mật.

---

## Task 1 (`P4B.1`): Logic Mở Khóa & Cài Đặt 6 Phước Lành Giao Thoa Nguyên Tố (`Elemental Duo Boons`)
- [ ] Khi rút 3 thẻ Phước lành qua tầng, nếu người chơi đang sở hữu ít nhất 2 nguyên tố tương ứng (từ Vũ khí đang mang hoặc các Phước lành đã lấy), có `35%` cơ hội ô thẻ thứ 3 nâng cấp thành Thẻ Giao Thoa Nguyên Tố (`Duo Boon`).
- [ ] Cài đặt 6 cơ chế Duo Boon độc bản:
  - `duo_superheated_cyclone` (`Lửa + Băng`): phản ứng Hơi Nước hóa thành Lốc Xoáy Nước Sôi tự động đuổi theo quái gần nhất (`140 px/s`, `base 14 DMG/s` trong `4.0s`).
  - `duo_cryo_shatter_spires` (`Băng + Vật Lý`): phản ứng Vỡ Băng (`Shatter`) đóng 4 Cột Băng Nhọn xuống sàn (`4.0s`) chặn đạn địch và phát nổ tiếp khi bị `Dash-Kick`.
  - `duo_superconduct_rail` (`Băng + Sét`): mục tiêu đang dính Siêu Dẫn (`Superconduct`) tạo từ trường hút các viên đạn bắn vào bán kính `100px` quanh nó bẻ cong lao thẳng vào người nó (`SHOT_FLAG.DYNAMIC_BOUNCE`).
  - `duo_napalm_chain_plague` (`Độc + Lửa`): phản ứng Nổ Độc bắn văng giọt Nhựa Lửa-Độc sang các quái trong `160px`, gây nổ dây chuyền tiếp theo khi mục tiêu bị hạ gục.
  - `duo_plasma_overload_star` (`Lửa + Sét`): phản ứng Quá Tải để lại Quả Cầu Lửa-Điện (`Plasma Star`) nảy qua lại 3 lần giữa các bức tường (`420 px/s`).
  - `duo_magnetic_bastion_ring` (`Sét + Vật Lý`): giữa các tấm Bia Chắn đã lật (`'flipped'`) trong khoảng cách `220px` tự động giăng lưới hồ quang điện (`base 28 DMG Sét/s`) đốt cháy mọi quái vật đi cắt ngang.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4b-duo-boons.test.ts`.

## Task 2 (`P4B.2`): Cài Đặt Đấu Trường Kỹ Năng 20 Giây Trong Phòng Bí Mật (`Secret Skill Arena 20s`)
- [ ] Bên trong phòng `secret`, đặt Đài Tinh Thể Thử Thách (`secret_challenge_crystal`).
- [ ] Nhấn `[E]` kích hoạt Tinh Thể: triệu hồi 1 đợt quái Tinh Anh kèm 4 Bia Chắn + 2 Thùng Nổ với đồng hồ đếm ngược `20.0 giây`.
- [ ] Nếu tiêu diệt hết đợt quái trong vòng `20.0s`: Rương trong phòng Bí Mật được Thăng Hoa lên bậc Huyền Thoại (`legendary`) chắc chắn 100% + thưởng thêm `+40 Gold`! Nếu hết `20.0s` chưa dọn xong: quái còn lại tan biến, người chơi vẫn mở được rương `Rare/Epic` gốc bình thường.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p4b-secret-arena.test.ts`.

## Task 3 (`P4B.3`): Giao Diện Thẻ Duo Boon (Viền Kim Cương Đôi), Đồng Hồ Đếm Ngược 20s & VFX 6 Duo Boons
- [ ] Vẽ khung thẻ Duo Boon có 2 biểu tượng nguyên tố giao nhau trên Modal chọn Phước lành, đồng hồ đếm ngược `20.0s` cho thử thách Bí Mật, và VFX cho 6 Duo Boons.

## Task 4 (`P4B.4`): Xây Dựng Cảnh Chụp & Strip Engine 2.6 (`8 / 12 Frames`) Cho 6 Duo Boons & Đấu Trường Bí Mật 20s (`visual-scene-ap2-p4.ts`)
- [ ] Bổ sung 5 cảnh theo chuẩn **Engine 2.6**: `ap2-modal-duo-boon-card`, `ap2-duo-magnetic-bastion-ring` (strip), `ap2-duo-superheated-cyclone` (strip), `ap2-duo-plasma-overload-star` (strip), `ap2-secret-arena-20s-trial` (strip).

## Task 5 (`P4B.5`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P4B`
- [ ] Chạy `pnpm shots --phase ap2-p4b --label after --group ap2-p4b --verify-freeze` ở chế độ `HARD_ASSERT`, chấm qua Visual Reviewer (`pro` `>= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p4b`.
