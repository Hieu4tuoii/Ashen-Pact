# Ashen Pact 2.0 — Phase P3A: Đại Tu AI Quái (`Bounded Predictive Lead Aiming`) & 12 Hành Vi Quái Tương Tác Địa Hình (`ap2-p3a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4 — Phần 6, mục `6.1` & `6.2`; Phần 7, mục `7.1–7.3`) & `master-promt-v3.md` (Mục `0.3`, `0.4`, `0.5`, `2.1`, `2.2`, `4.Phase P3A`, `5`, `6`, `7`).

**Global Constraints:**
1. **`pnpm verify` xanh tuyệt đối:** `typecheck`, `lint`, `test` (Vitest), `build`, và `e2e` (Playwright) đều pass 100%. Cấm dùng `.skip`, `.todo`.
2. **Zero Runtime Noise:** `0` console error, `0` uncaught page error, `0` WebGL/shader warning.
3. **Tính Tất Định (Determinism) & Đồng Bộ Mạng 60Hz 4 Người Chơi:** Mọi phép ngẫu nhiên trong `packages/shared/src/sim/` bắt buộc đi qua `SeededRng` của `WorldSim` (cấm dùng `Math.random()`). Mọi viên đạn sinh ra từ `spawnDeterministicVolleyImpl` dùng `deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f)`.
4. **Ngân Sách Thực Thể & Hiệu Năng 60Hz:** `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`. Không cấp phát mảng/object tạm trong vòng lặp 60Hz. Server tick `p95 < 4.5ms`, Client VSync Normal `>= 60 FPS`, Stress `>= 58 FPS`.
5. **Kỷ Luật Kiến Trúc Module Hóa (`< 1000 dòng / file`):** Không một file `.ts` nào trong toàn bộ dự án được vượt quá `1000 dòng`. Vì `sim-enemies-core.ts` đã ở mức `970 dòng`, `sim-enemies-biome1.ts` `839 dòng`, `sim-combat-damage.ts` `938 dòng`, `telegraphs-and-overlays.ts` `794 dòng`, `visual-scenes.ts` `967 dòng`: bắt buộc đặt logic mới của Phase P3A vào `packages/shared/src/sim/sim-enemies-tactical-ai.ts` (`< 650 dòng`), `apps/client/src/fx/combat-fx-p3a.ts` (`< 500 dòng`), và `tests/e2e/helpers/visual-scene-ap2-p3.ts` (`< 650 dòng`), chỉ gọi kết nối gọn từ các file hiện hữu.
6. **Bảo Toàn Chuẩn Thẩm Mỹ Golden Room v0.2.0 & Engine 2.6 `HARD_ASSERT`:** Mọi cảnh strip đạt `5/5` cổng `evaluateAnimationGates(..., 'HARD_ASSERT')`, `--verify-freeze` (`diffPixels === 0`, `traceHashMatched === true`), và được chấm điểm bởi **Visual Reviewer độc lập (`research`, model `pro`)** đạt `0 blocker`, `0 major`, tất cả tiêu chí `>= 8.0/10`.
7. **Song Ngữ Việt – Anh (`i18n`):** Mọi chuỗi popup/thông báo mới phải có mặt đồng thời trong `vi.json` và `en.json`.

**Review Focus (5 Rủi Ro Kỹ Thuật & Toán Học Trọng Tâm):**
1. **Kẹp trần góc ngắm đón đầu (`Bounded Predictive Lead Aiming`):** Công thức `timeToHit = Math.min(0.65, dist(e, p) / projectileSpeed)`, `predPos = p.pos + p.vel * timeToHit * leadFactor` (`0.35` cho quái thường, `0.65` cho Tinh Anh/Boss) phải kẹp góc lệch tối đa `±28°` (`0.49 rad`) dùng `angleDiff` chuẩn hóa vòng tròn `[-π, π]` để không bao giờ bị đảo dấu qua ranh giới `±π` (`ap2-p3a-lead-aiming.test.ts`).
2. **Tia chỉ ngắm cảnh báo `0.35s` cuối (`Red-Orange Sightline Telegraph`):** Trong `0.35s` cuối trước khi khai hỏa, góc ngắm phải khóa cố định (`sightlineLockedAngle`) và hiển thị đường chỉ ngắm đỏ cam (`#FF5722` lõi sáng trắng-vàng) rõ nét trên `combat-fx-p3a.ts` / `telegraphs-and-overlays.ts` (`ap2-p3a-lead-aiming.test.ts` + cảnh `ap2-ai-lead-aim-telegraph`).
3. **Tương tác vật lý 2 chiều giữa Quái & Địa hình Biome 1 (`Rừng Cổ`):** `wild_boar` húc `410 px/s` vào `rotten_totem_pillar` phải tự làm cột đổ sập đè chính nó (`Dmg_Hazard` + Choáng `1.5s`); `spore_bomber` đang gồng tự hủy (`0.65s`) có thể bị `Dash-Kick` hoặc Cận chiến sút văng ngược `520 px/s` rồi nổ sát thương lên cả quái địch; `goblin_shaman` cắm Cọc Totem Hộ Thể (`shaman_totem`) giảm `40%` sát thương cho đồng minh nối dây và khi bị bàn chắn `Dash-Kick` tông gãy sẽ phản phệ Choáng `1.2s` lên toàn bộ quái đang nối dây (`ap2-p3a-biome1-enemies.test.ts`).
4. **Tương tác vật lý 2 chiều giữa Quái & Địa hình Biome 2 (`Hầm Băng`):** `snow_spirit` chết kết tinh thành `sliding_ice_block` (tuân thủ `MAX_TACTICAL_PROPS_PER_ROOM = 16`); `baby_yeti` chủ động đẩy trượt `sliding_ice_block` ở `460 px/s` về phía người chơi và người chơi có thể dùng `Dash-Kick` hoặc Đòn 3 Cận chiến (`Parry Deflect`) sút bật ngược khối băng đập sát thương chí mạng lên chính `baby_yeti`; `ice_mage` ưu tiên bắn tia băng vào `cryo_prism_pillar` để khúc xạ 3 tia quạt (bị chặn nếu người chơi lật `glacial_barricade` trước Lăng Kính); `ice_golem` giảm `75%` sát thương đạn mặt trước nhưng vỡ giáp ngay lập tức kèm sát thương `Shatter` khi bị `sliding_ice_block` đâm trúng hoặc bị `Wall-Slam` (`ap2-p3a-biome2-enemies.test.ts`).
5. **Tương tác vật lý 2 chiều giữa Quái & Địa hình Biome 3 (`Lò Rèn`):** `coal_golem` chết rơi ra `coal_bomb` đếm ngược `2.0s` có thể `Dash-Kick` sút trượt `520 px/s` vào đội hình địch; `iron_shielder` trúng đòn nguyên tố `Sét (Shock)` vào mặt khiên dẫn điện phóng hồ quang hình nón phía sau lưng giật tê liệt (`stun 1.2s` + sát thương `Shock`) toàn bộ quái nấp sau khiên; `dwarf_cannon` bắn đạn cối cầu vồng (`Lobbed Mortar`) vượt vật chắn thấp rơi xuống vòng chỉ thị đỏ (`r=52px`) sau `0.85s`; `welder_drone` bị hạ rơi nổ xung EMP (`r=110px`) làm choáng `1.5s` toàn bộ quái trong bán kính (`ap2-p3a-biome3-enemies.test.ts`).

---

## Task 1 (`P3A.1`): Cài Đặt Công Thức Ngắm Đón Đầu Có Giới Hạn (`Bounded Predictive Lead Aiming`) & Tia Chỉ Ngắm `0.35s`
- [ ] Tạo `packages/shared/src/sim/sim-enemies-tactical-ai.ts` và re-export từ `packages/shared/src/sim/sim-enemies-core.ts` & `packages/shared/src/index.ts`:
  - Viết hàm `computePredictiveLeadAimAngle(enemy, targetPlayer, projectileSpeed, leadFactor, maxLeadAngleRad = 0.49, jitterRad = 0)`:
    - `timeToHit = Math.min(0.65, dist(e, p) / Math.max(1, projectileSpeed))`
    - `predX = p.x + p.vx * timeToHit * leadFactor`, `predY = p.y + p.vy * timeToHit * leadFactor` (`leadFactor = 0.35` cho quái thường, `0.65` cho Tinh Anh / Boss)
    - Kẹp trần độ lệch góc tối đa so với góc ngắm thẳng `directAngle = Math.atan2(p.y - e.y, p.x - e.x)` là `±28°` (`0.49 rad` / `(28 * Math.PI) / 180`).
- [ ] Trong `0.35s` cuối của Telegraph trước khi khai hỏa (`e.stateTimer <= 0.35`), khóa góc ngắm đón đầu và vẽ Đường Chỉ Ngắm Đỏ Cam (`#FF5722` + lõi sáng `#FFF7ED`) rõ nét trong `apps/client/src/fx/combat-fx-p3a.ts` (được gọi từ `telegraphs-and-overlays.ts`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-lead-aiming.test.ts`.

## Task 2 (`P3A.2`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 1 (`Rừng Cổ`)
- [ ] `goblin_shooter`: chủ động tìm điểm nấp sau `moss_table` hoặc ô `grass`, bắn chùm 2 mũi tên thẳng (`±15°`) + 1 mũi tên ngắm đón đầu ở giữa (`leadFactor = 0.35`).
- [ ] `wild_boar`: húc tốc độ `BOAR_CHARGE_SPEED = 410 px/s`; nếu người chơi đứng trước `rotten_totem_pillar` rồi Lướt né, Lợn Rừng tự húc gãy cột đá mục khiến cột đổ sập đè chính nó (`Dmg_Hazard` + Choáng `1.5s`).
- [ ] `spore_bomber`: khi chạy lại gần và gồng tự hủy (`telegraphDurationSec = 0.65s`), người chơi có thể dùng `Dash-Kick` hoặc đòn Cận chiến (`Melee-Kick`) sút văng `spore_bomber` bay ngược (`520 px/s`) vào giữa đội hình địch rồi nổ tung (gây sát thương nổ lên cả quái địch trong `SPORE_EXPLOSION_RADIUS`).
- [ ] `goblin_shaman`: cắm Cọc Totem Hộ Thể (`shaman_totem` prop) buff giáp giảm `40%` sát thương cho quái quanh đó (`r <= 220px`); người chơi dùng `Dash-Kick` sút bàn chắn/vật thể tông gãy Cọc Totem sẽ làm toàn bộ quái đang nối dây bị phản phệ Choáng `1.2s`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome1-enemies.test.ts`.

## Task 3 (`P3A.3`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 2 (`Hầm Băng`)
- [ ] `snow_spirit`: khi bị tiêu diệt sẽ kết tinh thành một Khối Băng Trượt (`sliding_ice_block`) ngay tại chỗ để người chơi `Dash-Kick` sút vào đám quái còn lại.
- [ ] `baby_yeti`: chủ động tìm và đẩy trượt `sliding_ice_block` dọc mặt sàn (`460 px/s`) về phía người chơi (gây sát thương cho người chơi nếu trúng); người chơi có thể dùng `Dash-Kick` hoặc Đòn 3 Cận chiến (`Parry Deflect`) sút bật ngược khối băng đó (`600 px/s`) đập vào chính `baby_yeti` và quái địch.
- [ ] `ice_mage`: nếu trong tầm có `cryo_prism_pillar` mà không bị chắn bởi `glacial_barricade` `'flipped'`, ưu tiên ngắm bắn tia băng vào `cryo_prism_pillar` để khúc xạ thành 3 tia quạt đạn địch quét phòng; người chơi nhấn `[E]` lật `glacial_barricade` chặn trước Lăng Kính sẽ cắt đường tia.
- [ ] `ice_golem`: lớp giáp băng mặt trước giảm `75%` sát thương đạn thường (`frontShieldReduction: 0.75`), nhưng chỉ cần bị `Dash-Kick` Khối Băng (`sliding_ice_block` / `glacial_barricade`) đâm trúng hoặc bị `Wall-Slam` đập vào tường là lớp giáp băng vỡ tan ngay lập tức (`shieldBrokenTimer = 8.0s`, nhận sát thương phản ứng `Shatter` + Choáng `1.2s`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome2-enemies.test.ts`.

## Task 4 (`P3A.4`): Cài Đặt 4 Hành Vi Quái Tương Tác Địa Hình Biome 3 (`Lò Rèn`)
- [ ] `coal_golem`: khi chết rơi ra Bom Lò Than (`coal_bomb` prop) đếm ngược `2.0s` — người chơi có thể `Dash-Kick` hoặc Cận chiến sút trượt quả bom (`520 px/s`) bay vào đám xạ thủ địch phát nổ AoE Lửa (`r=92px`).
- [ ] `iron_shielder`: khiên sắt mặt trước chặn đạn thường (`frontShieldReduction: 0.80`), nhưng khi trúng đòn nguyên tố `Sét (Shock)` vào mặt khiên sẽ dẫn điện phóng hồ quang hình nón phía sau khiên (`r=150px`), giật tê liệt (`stun 1.2s` + sát thương `Shock`) toàn bộ quái đang nấp phía sau khiên.
- [ ] `dwarf_cannon`: bắn đạn cối cầu vồng (`Lobbed Mortar`) vượt qua vật chắn thấp, bay по quỹ đạo parabol rơi xuống vòng chỉ thị đỏ trên sàn (`r=52px`) sau `0.85s`.
- [ ] `welder_drone`: khi bị bắn hạ sẽ rơi xuống phát nổ xung EMP (`r=110px`) làm choáng toàn bộ quái xung quanh trong `1.5s` và xóa lớp `shieldArmor` của chúng.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3a-biome3-enemies.test.ts`.

## Task 5 (`P3A.5`): Xây Dựng Cảnh Chụp & Strip Engine 2.6 (`8 Frames`) Cho AI Quái Tương Tác Địa Hình (`tests/e2e/helpers/visual-scene-ap2-p3.ts`)
- [ ] Tạo 6 cảnh theo chuẩn **Engine 2.6 (`HARD_ASSERT`)** trong `tests/e2e/helpers/visual-scene-ap2-p3.ts` (`< 650 dòng`), đăng ký nhóm `ap2-p3a` trong `tools/run-shots.ts` và `tests/e2e/helpers/visual-scenes.ts` (đảm bảo `visual-scenes.ts < 1000 dòng`):
  1. `ap2-ai-lead-aim-telegraph` (Tĩnh: Đường chỉ ngắm đỏ cam `0.35s` đón đầu hướng di chuyển của `goblin_shooter` & Tinh Anh)
  2. `ap2-ai-boar-pillar-crash` (`captureStrip: true`, 8 frame: Người chơi lướt né trước `rotten_totem_pillar`, `wild_boar` húc sập cột đè chính nó tại `F5 ★ HERO`)
  3. `ap2-ai-spore-bomber-kick` (`captureStrip: true`, 8 frame: Người chơi `Dash-Kick` sút văng `spore_bomber` đang gồng nổ bay ngược vào đám quái nổ tung tại `F5 ★ HERO`)
  4. `ap2-ai-yeti-iceblock-counter` (`captureStrip: true`, 8 frame: `baby_yeti` đẩy trượt `sliding_ice_block`, người chơi `Dash-Kick` / `Parry` sút bật ngược khối băng đập trúng `baby_yeti` tại `F5 ★ HERO`)
  5. `ap2-ai-shielder-shock-arc` (`captureStrip: true`, 8 frame: Bắn đạn Sét vào mặt khiên `iron_shielder` phóng hồ quang giật tê liệt đám quái nấp sau khiên tại `F5 ★ HERO`)
  6. `ap2-ai-dwarf-mortar-lob` (`captureStrip: true`, 8 frame: `dwarf_cannon` bắn đạn cối cầu vồng vượt qua tấm chắn rơi nổ xuống vòng chỉ thị đỏ sau `0.85s` tại `F5 ★ HERO`)

## Task 6 (`P3A.6`): Visual Gate (Engine 2.6 `HARD_ASSERT` + `--verify-freeze`) & Phase Gate `P3A`
- [ ] Chạy `pnpm shots -- --phase ap2-p3a --label after --group ap2-p3a --verify-freeze` ở chế độ `HARD_ASSERT`, chấm qua Visual Reviewer độc lập (`research`, model `pro` `>= 8.0/10` trên `<scene>.png`, `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`, `metrics.json`), chạy `pnpm verify` & `pnpm perf`, cập nhật `docs/PROGRESS.md` & `docs/PHASES.md`, commit và tag `ap2-p3a`.
