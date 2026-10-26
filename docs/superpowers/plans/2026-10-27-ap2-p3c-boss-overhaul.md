# Ashen Pact 2.0 — Phase P3C: Đại Tu 3 Trận Đánh Trùm (`Boss Overhaul`: Treant, Frost Wyrm, Chaos Warden) (`ap2-p3c`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp cả 3 Boss cuối Biome (`boss_treant` Hạt Giống Nổ trả ngược `120 DMG` + lộ Lõi Tim Gỗ choáng `2.5s`, `boss_frost_wyrm` lao húc vỡ Cột Băng choáng `2.5s` + nấp sau Cột Băng tránh Bão Tuyết Xoáy `0.9s`, `boss_chaos_warden` phá Tinh Thể Hư Không tạo Vòm Chắn Ánh Sáng + `Dash-Kick` trả Quả Cầu Hỗn Mang `200 DMG`) thành những bài kiểm tra tổng hợp kỹ năng 2.0 theo Mục 7.2 `master-promt-v3.md`.

**Architecture:** Mở rộng `packages/shared/src/sim/sim-boss-ai.ts` (`< 750 dòng`), `apps/client/src/scenes/game-scene/entity-sync.ts`, `tests/e2e/helpers/visual-scene-ap2-p3.ts`.

---

## Task 1 (`P3C.1`): Đại Tu Boss 1 — `boss_treant` (Cổ Thụ Ma Quái — Tầng 2)
- [ ] **Phase 1 (`100% -> 50% HP`):** Ngoài đòn quét rễ và vòng gai có telegraph rõ ràng, Cổ Thụ gieo **3 Hạt Giống Nổ (`Explosive Briar Seeds`)** ra sàn. Nếu để yên sau `4.0s` hạt giống nở thành `thorn_vine`; nhưng nếu người chơi dùng **`Dash-Kick` hoặc đòn Cận chiến Đòn 3 đánh bật Hạt Giống Nổ bay ngược trúng thân Cổ Thụ**, hạt giống phát nổ gây `120 DMG`, phá lớp vỏ cây cứng và làm Boss lộ **Lõi Tim Gỗ (`Exposed Heartwood` — choáng `2.5s`, nhận `+35% DMG`)**.
- [ ] **Phase 2 (`< 50% HP`):** Cổ Thụ cắm rễ hút sinh lực từ 2 Bụi Hoa Bào Tử ở góc phòng — người chơi phá hủy 2 bụi hoa này sẽ ngắt chiêu hồi máu và làm Boss tự sập xuống choáng `3.0s`.
- [ ] Viết unit test TDD trong `packages/shared/test/ap2-p3c-boss-overhaul.test.ts`.

## Task 2 (`P3C.2`): Đại Tu Boss 2 — `boss_frost_wyrm` (Hàn Long Cổ Đại — Tầng 4)
- [ ] **Phase 1 (`100% -> 50% HP`):** Hàn Long triệu hồi **4 Cột Băng Tinh Thể (`frost_spire`)** trên đấu trường. Khi Hàn Long gồng chuẩn bị lao húc (`Glacial Charge`), nếu người chơi đứng lừa sau một Cột Băng rồi `Dash` né kịp lúc, Hàn Long sẽ **đâm đầu thẳng vào Cột Băng**, làm cột băng vỡ tung, gây `140 DMG` và khiến Boss bị choáng `2.5s` giữa sàn đấu.
- [ ] **Phase 2 (`< 50% HP`):** Hàn Long bay vào giữa phòng gồng chiêu **Bão Tuyết Xoáy Toàn Phòng (`Whiteout Nova` — telegraph `1.8s`)**: người chơi phải nấp vào vùng khuất bóng (`Line-of-Sight Shadow`) phía sau các Cột Băng còn nguyên vẹn để tránh sát thương đóng băng toàn màn hình; ngay sau cơn bão, các cột băng tan chảy tạo luồng hơi ấm giúp người chơi tăng `+30%` tốc độ bắn trong `4.0s`.
- [ ] Bổ sung unit test TDD trong `packages/shared/test/ap2-p3c-boss-overhaul.test.ts`.

## Task 3 (`P3C.3`): Đại Tu Boss 3 — `boss_chaos_warden` (Cai Ngục Hỗn Mang — Tầng 6)
- [ ] **Phase 1 (`100% -> 65% HP` — Lửa & Đá Đen):** Cai Ngục dựng các trụ đá dung nham và quét tia laser cắt chữ thập; người chơi có thể đẩy trụ đá va vào nhau hoặc lừa tia laser của Boss cắt qua chính trụ đá để tạo mảnh văng sát thương ngược lại Boss.
- [ ] **Phase 2 (`65% -> 30% HP` — Băng & Hư Không):** Đấu trường xuất hiện **2 Tinh Thể Phân Cực Hư Không (`Void Polarity Pylons`)** ở 2 bên: người chơi phá vỡ một tinh thể đúng lúc Boss đang niệm chú sẽ biến vùng xung quanh tinh thể đó thành **Vòm Chắn Ánh Sáng (`Sanctuary Dome`)** vô hiệu hóa mưa thiên thạch hỗn mang và tăng `+40% DMG` cho mọi người chơi đứng bên trong.
- [ ] **Phase 3 (`< 30% HP` — Phán Quyết Tro Tàn):** Cai Ngục phóng **Quả Cầu Hỗn Mang Chậm (`Chaos Core Orb`)** bay về phía đội hình: người chơi thực hiện `Dash-Kick` hoặc `Perfect Reload/Vent [R]` (tạo xung năng lượng) hay `Đòn 3 Finisher` cận chiến trúng quả cầu sẽ **đánh bật Quả Cầu Hỗn Mang bay ngược lại ngực Cai Ngục**, gây `200 DMG` và làm Boss quỳ gối lộ điểm yếu trong `3.0s`.
- [ ] Bổ sung unit test TDD trong `packages/shared/test/ap2-p3c-boss-overhaul.test.ts`.

## Task 4 (`P3C.4`): Hiển Thị Telegraph Cơ Học Tương Tác Của 3 Boss & Cảnh Strip Kiểm Chứng (`visual-scene-ap2-p3.ts`)
- [ ] Vẽ Hạt Giống Nổ + Lõi Tim Gỗ (`boss_treant`), vùng khuất bóng `Line-of-Sight Shadow` sau Cột Băng (`boss_frost_wyrm`), và Vòm Chắn Ánh Sáng + Quả Cầu Hỗn Mang (`boss_chaos_warden`).
- [ ] Bổ sung 3 strip 8 frame (`ap2-boss-treant-seed-counter`, `ap2-boss-wyrm-pillar-crash`, `ap2-boss-warden-orb-parry`) vào `visual-scene-ap2-p3.ts` và đăng ký nhóm `ap2-p3c`.

## Task 5 (`P3C.5`): Visual Gate & Phase Gate `P3C`
- [ ] Chạy `pnpm shots -- --phase ap2-p3c --label after --group ap2-p3c`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p3c`.
