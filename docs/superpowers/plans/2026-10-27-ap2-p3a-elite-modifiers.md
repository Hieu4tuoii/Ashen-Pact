# Ashen Pact 2.0 — Phase P3A: Đại Tu 4 Biến Thể Tinh Anh (`Elite Modifiers`: `shield`, `splitter`, `haste`, `vampiric`) (`ap2-p3a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế các biến thể Tinh Anh tăng chỉ số đơn thuần bằng 4 Biến Thể Cơ Học Độc Đáo (`shield` Phản Đạn Mặt Trước góc `+-50 deg`, `splitter` Phân Bào Năng Lượng `<= 15% HP` gồng `1.0s` có thể cắt đứt bằng `Wall-Slam / Dash-Kick`, `haste` Xung Kích Bóng Ảnh sau 2 lần nhận đạn với `ICD = 3.5s`, `vampiric` Dây Hút Sinh Lực `<= 150px` hồi `4% maxHp/s` có thể cắt đứt bằng `Dash`), kèm hiển thị Khiên Năng Lượng Lục Giác, vòng gồng phân bào, vệt bóng ảnh, dây máu đỏ và bộ cảnh/strip kiểm chứng (`ap2-p3a`).

**Architecture:** Mở rộng `packages/shared/src/sim/sim-enemy-ai.ts` (`< 750 dòng`), `apps/client/src/scenes/game-scene/entity-sync.ts`, `tests/e2e/helpers/visual-scene-ap2-p3.ts` (`< 600 dòng`).

---

## Task 1 (`P3A.1`): Cài Đặt Cơ Học 4 Biến Thể Tinh Anh (`shield`, `splitter`, `haste`, `vampiric`) Trong `sim`
- [ ] **`shield` (Khiên Phản Đạn Mặt Trước):** Thay giảm `80% DMG` bằng Khiên Năng Lượng Lục Giác phía trước (`+-50 deg`): đạn thường bắn vào mặt khiên bị **bật nảy ngược lại (`Reflect`)** với `50%` tốc độ gốc (đạn phản hồi đổi màu cam-đỏ có thể gây sát thương cho cả người chơi lẫn quái khác nếu lừa đường đạn). Cách khắc chế: bắn vòng sau lưng, dùng đạn nổ địa hình (`void_cannon`, `runic_shortbow`), hoặc `Dash-Kick` thẳng vào mặt khiên để phá vỡ khiên trong `4.0s` và gây choáng `1.0s`.
- [ ] **`splitter` (Phân Bào Năng Lượng):** Khi máu tụt xuống `<= 15% maxHp`, quái dừng lại phát sáng tím gồng trong `1.0s`: nếu không bị kết liễu hoặc không bị hất `Wall-Slam / Dash-Kick` trong `1.0s` đó, nó tách làm 2 bản sao nhỏ (`35% maxHp`, tốc chạy `+20%`); nếu người chơi nhanh tay đá `Dash-Kick` hoặc dồn đòn kết liễu trong lúc gồng `1.0s`, quái nổ tung ngay lập tức và rơi gấp đôi Vàng.
- [ ] **`haste` (Xung Kích Bóng Ảnh):** Quái không chỉ chạy nhanh (`+35%`) mà mỗi khi nhận sát thương từ 2 viên đạn liên tiếp sẽ tự động **Lướt Ngang (`Side-Step Dash` `75px`, hồi chiêu nội tại `ICD = 3.5s`)** để né đường ngắm thẳng của người chơi, buộc người chơi phải đón đầu hoặc dùng bẫy/khống chế.
- [ ] **`vampiric` (Dây Hút Sinh Lực):** Khi đứng trong bán kính `150px` quanh người chơi, quái phóng một sợi dây năng lượng đỏ nối vào người chơi: sau `1.2s` duy trì dây nối mà người chơi không `Dash` cắt đứt hoặc nấp sau tường/cột, quái hút `1 Giáp` của người chơi và tự hồi `8% maxHp` mỗi giây.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-elite-modifiers.test.ts`.

## Task 2 (`P3A.2`): Hiển Thị Khiên Lục Giác Phản Đạn, Vòng Gồng Phân Bào, Vệt Bóng Ảnh & Dây Hút Sinh Lực (`entity-sync.ts`, `combat-vfx.ts`)
- [ ] Vẽ Khiên Năng Lượng Lục Giác góc `+-50 deg` trước mặt Elite `shield` (nhấp nháy vỡ khi bị `Dash-Kick`).
- [ ] Vẽ vòng gồng tím `1.0s` quanh Elite `splitter` khi `<= 15% HP`.
- [ ] Vẽ vệt dư ảnh (`afterimage trail`) khi Elite `haste` lướt ngang.
- [ ] Vẽ sợi dây năng lượng đỏ nối từ Elite `vampiric` tới người chơi trong bán kính `150px`.

## Task 3 (`P3A.3`): Xây Dựng Cảnh Chụp & Strip Kiểm Chứng 4 Biến Thể Tinh Anh (`visual-scene-ap2-p3.ts`)
- [ ] Tạo `tests/e2e/helpers/visual-scene-ap2-p3.ts` với cảnh `ap2-elite-4-modifiers-showcase` (4 quái Tinh Anh `shield`, `splitter`, `haste`, `vampiric` hiển thị rõ telegraph cơ học) và đăng ký nhóm `ap2-p3a`.

## Task 4 (`P3A.4`): Visual Gate & Phase Gate `P3A`
- [ ] Chạy `pnpm shots -- --phase ap2-p3a --label after --group ap2-p3a`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p3a`.
