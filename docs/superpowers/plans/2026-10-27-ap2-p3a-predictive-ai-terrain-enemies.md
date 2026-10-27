# Ashen Pact 2.0 — Phase P3A: Đại Tu AI Quái (`Bounded Predictive Lead Aiming`) & 12 Hành Vi Quái Tương Tác Địa Hình (`ap2-p3a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chấm dứt việc quái bắn vào vị trí cũ khiến người chơi chỉ cần đi bộ ngang là né được 100% đạn bằng `Bounded Predictive Lead Aiming` (`±28°` max lead angle, `0.35s` red-orange sightline telegraph), và biến cả **12 loại quái trong 3 Biome** thành các tác nhân tương tác trực tiếp với Bia Chắn và Đồ Chơi trong phòng.

**Architecture:** Mở rộng `packages/shared/src/sim/sim-enemies-core.ts`, `sim-enemies-biome1.ts`, `sim-enemies-biome2.ts`, `sim-enemies-biome3.ts`, `sim-tactical-physics.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, và tạo `tests/e2e/helpers/visual-scene-ap2-p3.ts` (`< 650 dòng`).

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`).

---

## Task 1 (`P3A.1`): Cài Đặt Công Thức Ngắm Đón Đầu Có Giới Hạn (`Bounded Predictive Lead Aiming`) & Tia Chỉ Ngắm `0.35s`
- [ ] Viết hàm `computePredictiveLeadAimAngle(enemy, targetPlayer, projectileSpeed, leadFactor)` trong `packages/shared/src/sim/sim-enemies-core.ts`:
  - `timeToHit = min(0.65, dist(e, p) / projectileSpeed)`
  - `predPos = p.pos + p.vel * timeToHit * leadFactor` (`leadFactor = 0.35` cho quái thường, `0.65` cho Tinh Anh / Boss)
  - Kẹp trần độ lệch góc tối đa so với góc ngắm thẳng là `±28°` (`0.49 rad`).
- [ ] Trong `0.35s` cuối của Telegraph trước khi khai hỏa, đồng bộ góc ngắm đã khóa và vẽ Đường Chỉ Ngắm Đỏ Cam (`#FF5722` lõi sáng) rõ nét trong `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-lead-aiming.test.ts`.

## Task 2 (`P3A.2`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 1 (`Rừng Cổ`)
- [ ] `goblin_shooter`: chủ động tìm điểm nấp sau `moss_table` hoặc `tall_grass`, bắn chùm 2 mũi tên thẳng + 1 mũi tên ngắm đón đầu (`leadFactor = 0.35`).
- [ ] `wild_boar`: húc tốc độ `410 px/s`; nếu người chơi đứng trước `rotten_totem_pillar` rồi Lướt né, Lợn Rừng tự húc gãy cột đá mục khiến cột đổ sập đè chính nó (`Dmg_Hazard` + Choáng `1.5s`).
- [ ] `spore_bomber`: khi chạy lại gần và gồng tự hủy (`0.65s`), người chơi có thể dùng `Dash-Kick` hoặc đòn Cận chiến sút văng `spore_bomber` bay ngược (`520 px/s`) vào giữa đội hình địch rồi nổ tung.
- [ ] `goblin_shaman`: cắm Cọc Totem Hộ Thể buff giáp giảm `40%` sát thương cho quái quanh đó; người chơi dùng `Dash-Kick` sút bàn chắn tông gãy Cọc Totem sẽ làm toàn bộ quái đang nối dây bị phản phệ Choáng `1.2s`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome1-enemies.test.ts`.

## Task 3 (`P3A.3`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 2 (`Hầm Băng`)
- [ ] `snow_spirit`: khi bị tiêu diệt sẽ kết tinh thành một Khối Băng Trượt (`sliding_ice_block`) ngay tại chỗ để người chơi `Dash-Kick` sút vào đám quái còn lại.
- [ ] `baby_yeti`: chủ động đẩy trượt `sliding_ice_block` dọc mặt sàn (`460 px/s`) về phía người chơi; người chơi có thể dùng `Dash-Kick` hoặc Đòn 3 Cận chiến (`Parry Deflect`) sút bật ngược khối băng đó đập vào chính `baby_yeti`.
- [ ] `ice_mage`: ngắm bắn tia băng vào `cryo_prism_pillar` để khúc xạ thành 3 tia quạt quét phòng; người chơi nhấn `[E]` lật `glacial_barricade` chặn trước Lăng Kính để cắt đường tia.
- [ ] `ice_golem`: lớp giáp băng mặt trước giảm `75%` sát thương đạn thường, nhưng chỉ cần bị `Dash-Kick` Khối Băng đâm trúng hoặc bị `Wall-Slam` đập vào tường là lớp giáp băng vỡ tan ngay lập tức (nhận sát thương `Shatter`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome2-enemies.test.ts`.

## Task 4 (`P3A.4`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 3 (`Lò Rèn`)
- [ ] `coal_golem`: khi chết rơi ra Bom Lò Than (`coal_bomb`) đếm ngược `2.0s` — người chơi có thể `Dash-Kick` sút trượt quả bom bay vào đám xạ thủ địch.
- [ ] `iron_shielder`: khiên sắt mặt trước chặn đạn thường, nhưng khi trúng đòn nguyên tố `Sét (Shock)` vào mặt khiên sẽ dẫn điện phóng hồ quang giật tê liệt toàn bộ quái đang nấp phía sau khiên.
- [ ] `dwarf_cannon`: bắn đạn cối cầu vồng (`Lobbed Mortar`) vượt qua vật chắn thấp, rơi xuống vòng chỉ thị đỏ trên sàn sau `0.85s`.
- [ ] `welder_drone`: khi bị bắn hạ sẽ rơi xuống phát nổ xung EMP (`r=110px`) làm choáng toàn bộ quái máy móc xung quanh trong `1.5s`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome3-enemies.test.ts`.

## Task 5 (`P3A.5`): Xây Dựng Cảnh Chụp & Strip Engine 2.6 (`8 / 12 Frames`) Cho AI Quái Tương Tác Địa Hình (`tests/e2e/helpers/visual-scene-ap2-p3.ts`)
- [ ] Tạo 6 cảnh theo chuẩn **Engine 2.6** trong `visual-scene-ap2-p3.ts`: `ap2-ai-lead-aim-telegraph`, `ap2-ai-boar-pillar-crash` (strip), `ap2-ai-spore-bomber-kick` (strip), `ap2-ai-yeti-iceblock-counter` (strip), `ap2-ai-shielder-shock-arc` (strip), `ap2-ai-dwarf-mortar-lob` (strip).

## Task 6 (`P3A.6`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P3A`
- [ ] Chạy `pnpm shots --phase ap2-p3a --label after --group ap2-p3a --verify-freeze` ở chế độ `HARD_ASSERT`, chấm qua Visual Reviewer (`pro` `>= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p3a`.
