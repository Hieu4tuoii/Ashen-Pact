# Ashen Pact 2.0 — Phase P5: Tổng Duyệt Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói Release `v2.0.0` & Kết Thúc Nhánh (`ap2-p5` / `v2.0.0`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kiểm định chéo toàn bộ hệ thống **Ashen Pact 2.0: Tactical Arena Overhaul** ở cấp độ sản phẩm phát hành thương mại `v2.0.0` — xử lý dứt điểm mọi `minor (deferred)` còn tồn đọng trong sổ cái `P0A–P4B`, chụp toàn bộ danh mục cảnh (`v0.2.0` + `6` nhóm cảnh `Ashen Pact 2.0`, đa độ phân giải, `Low` quality, song ngữ `vi`/`en`, `b3-combat-grayscale`) với `--verify-freeze` & `HARD_ASSERT`, vượt qua **Holistic Visual Gate (`Model: pro` `>= 8.5 / 10` trên cả 10 tiêu chí, `0 blocker`, `0 major`)**, kiểm toán cân bằng cuối game (`pnpm balance`, Boss Tầng 6 sống `>= 45s` trước build mạnh) & hiệu năng/soak 60Hz 4P (`pnpm perf` + `>= 200` chu kỳ chuyển phòng/phân rã súng/lật sút bàn), đồng bộ toàn bộ tài liệu sống, nâng phiên bản lên `2.0.0`, đóng gói `release/AshenPact-v2.0.0-win-x64.zip`, tổng duyệt code toàn nhánh (`Model: pro`), gắn tag `ap2-p5` & `v2.0.0`, và trình menu 3 lựa chọn `finishing-a-development-branch`.

**Spec:**
- `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4 — Toàn bộ Phần 1 → Phần 8)
- `master-promt-v3.md` — Mục `0.2`, `0.3`, `0.4`, `0.5`, `0.6`, `PHASE P5` (dòng `1108–1147`), Mục `5` (`VISUAL SCENES CATALOG`), Mục `6` (`RUBRIC 10 TIÊU CHÍ`), Mục `7` (`HARD PROHIBITIONS`)

**Architecture & File Decomposition Map (`< 1000` dòng / file `.ts`):**
- `tests/e2e/visual.spec.ts` (`438` dòng) & `tests/e2e/helpers/visual-strip-harness.ts` (`372` dòng): Nâng `test.setTimeout(2_700_000)` cho full-catalog `--verify-freeze`, hỗ trợ an toàn strip `ArtGalleryScene` (`expectedScene !== 'GameScene'`) và giữ `HARD_ASSERT` tuyệt đối `100%` trên mọi cảnh `ap2-*` (cũng như mọi cảnh có `stripSchedule` / `apexEvent`), trong khi cho phép các cảnh showcase `v0.2.0` cũ không có `stripSchedule` chạy `WARN_ONLY` + kiểm định `--verify-freeze` tất định.
- Đóng các mục `minor (deferred)` nhỏ còn lại từ sổ cái `P1B` & `P4A` trong `sim-weapon-cadence.ts`, `sim-weapon-specials-p1b-legendary.ts`, `sim-progression-bot.ts`, `sim-weapon-mutators-p4a.ts` (giữ mọi file `< 990` dòng).
- `packages/shared/test/ap2-p5-holistic-soak-balance.test.ts` (file test mới `< 500` dòng): Kiểm toán đường cong sức mạnh Tầng 1 → Tầng 6 với full `24 Action Blessings + 10 Mutators + 6 Duo Boons + 6 Ashen Pacts/Relics` (Boss Tầng 6 `forge_titan` TTK `>= 45s`, không nổ số quá trần `3-Bucket`) và bài Soak 4P Co-op 60Hz qua `>= 200` lần chuyển phòng + `>= 200` lần giữ `[X] 0.5s` phân rã súng + `>= 200` lần lật/sút Bia Chắn (`p95 tick < 4.5ms`, kích thước `encodeWorldSnapshot` không phình, không rò rỉ pool/heap).
- `tools/balance-simulations-p3c.ts` / `tools/balance-harness.ts` (`< 700` dòng): Bổ sung kiểm tra `Late-Game Synergy Floor 6 Boss Resilience` vào `pnpm balance` và xuất `docs/balance-report.md`.
- Tài liệu sống (`Task P5.3`): `docs/GDD.md`, `docs/BALANCE.md`, `docs/TECH.md`, `docs/ART_GUIDE.md`, `README.md`, `docs/RELEASE_NOTES.md`.
- Nâng phiên bản `2.0.0` & Đóng gói (`Task P5.4`): `package.json`, `packages/shared/package.json`, `apps/client/package.json`, `apps/server/package.json`, `tools/package-release.ts`, `apps/server/src/index.ts`, `apps/client/src/scenes/MenuScene.ts` (`982` dòng — sửa tại chỗ dòng `229`, `+0` dòng ròng), `tests/e2e/phase8.spec.ts`, `packages/shared/test/phase8-soak-release.test.ts`, `packages/shared/test/polish-p12-release-version.test.ts`, `README.md`, `docs/RELEASE_NOTES.md`, `docs/QA_CHECKLIST.md`, `CREDITS.md`, `docs/CREDITS.md`.

**Global Constraints (Bất khả xâm phạm — sao chép nguyên văn từ Mục `0.3`, `0.5`, `0.6`, `7`):**
1. **`pnpm verify` xanh tuyệt đối:** `typecheck`, `lint`, `test` (Vitest), `build`, và `e2e` (Playwright) đều pass 100%. Cấm dùng `.skip`, `.todo` hoặc xóa bài test để ép xanh.
2. **Zero Runtime Noise:** `0` console error, `0` uncaught page error, `0` WebGL/shader warning trong suốt quá trình chạy E2E và chụp `pnpm shots`.
3. **Tính Tất Định & Đồng Bộ Mạng 60Hz 4P:** `0` `Math.random()` trong `packages/shared/src/sim/` (100% qua `SeededRng`); mọi đạn sinh từ `spawnDeterministicVolleyImpl` dùng `deterministicId = ((ev.eventId & 0x3fffff) << 6) | (i & 0x3f)`; đạn `SHOT_FLAG.DYNAMIC_BOUNCE` tuân thủ `Zero-Rubberband Client Hold` (`awaitingServerRedirectTimer = 0.12`).
4. **Ngân Sách Thực Thể & Hiệu Năng 60Hz:** `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`; Server tick `p95 < 4.5ms` ở 60Hz 4P; Client GPU thật (`pnpm perf`) cảnh thường `>= 60 FPS`, cảnh `__GAME_STRESS_TEST__` `>= 58 FPS`.
5. **Kỷ Luật Module Hóa (`< 1000 dòng / file`):** Không một file `.ts` nào trong toàn bộ dự án (`packages/`, `apps/`, `tools/`, `tests/`) được vượt quá `1000 dòng`.
6. **Chuẩn Thẩm Mỹ Golden Room v0.2.0 & Holistic Visual Gate Engine 2.6 (`HARD_ASSERT`):** Full-Screen Clear Visibility (`vignetteStrength = 0.0`, `cornerRetentionRatio >= 0.82`, `centerDeltaL <= 8`, `floorDeltaL <= 14`, `contrastWithInkDark >= 22`, `brazierLightPoolDeltaL >= +8`); đạn địch lõi trắng + `#E84545` + viền `INK_DARK` `1.5u` nổi bật nhất màn hình; đồng minh VFX alpha `0.50`; `5/5` cổng `evaluateAnimationGates` `HARD_ASSERT` PASS 100% trên toàn bộ cảnh strip `ap2-*`; Holistic `pro` Visual Reviewer chấm **mọi tiêu chí trong Rubric 10 Tiêu Chí `>= 8.5 / 10`**, `0 blocker`, `0 major`.
7. **Song Ngữ Việt – Anh (`i18n`) & Cấm `godMode` Cân Bằng & Cấm Đụng Nhánh `master`:** `vi.json` và `en.json` đồng bộ 100%, không cắt dấu tiếng Việt; `pnpm balance` chạy thật với `AVERAGE_PLAYER_BOT_PROFILE` (`Perfect Reload = 50%`, `Flip + Dash-Kick = 40%`, `godMode = false`); tuyệt đối không commit thẳng lên `master` hoặc tự ý merge trước khi người dùng chọn ở `Task P5.6`.

**Review Focus (5 Rủi Ro Trọng Tâm Của Phase P5 & Bài Test Sở Hữu):**
1. **Rủi ro 1 — Full-Catalog `pnpm shots` (`~140+` cảnh × 2 pass `--verify-freeze`) gặp timeout hoặc crash trên cảnh `ArtGalleryScene` không có `GameScene`:** Kiểm chứng trực tiếp trong `Task P5.1` qua `pnpm shots -- --phase ap2-p5 --label final --verify-freeze` (`exit 0`, `0` console/WebGL errors, `100%` cảnh `ap2-*` PASS `HARD_ASSERT` `5/5` cổng).
2. **Rủi ro 2 — Nổ số sát thương cuối game (`Floor 6`) khi kết hợp đồng thời `Action Blessings + Weapon Mutators + Elemental Duo Boons + Awakened Relics`:** Kiểm chứng trong `Task P5.2` qua `packages/shared/test/ap2-p5-holistic-soak-balance.test.ts` & `pnpm balance` (khẳng định `3-Bucket Damage Pipeline` `Soft Cap 2.80x / Hard Cap 3.80x` + `Boss Single-Hit Cap 18x` giữ TTK Boss Tầng 6 `forge_titan >= 45s` ngay cả trước tổ hợp build mạnh nhất).
3. **Rủi ro 3 — Rò rỉ bộ nhớ / phình kích thước gói tin `snapshot-codec.ts` sau hàng trăm chu kỳ chuyển phòng, phân rã súng `[X] 0.5s` và lật/sút bàn 4P Co-op:** Kiểm chứng trong `Task P5.2` qua bài test `200+` chu kỳ trong `ap2-p5-holistic-soak-balance.test.ts` (`p95 tick < 4.5ms`, snapshot bytes ổn định, entity pools không vượt trần).
4. **Rủi ro 4 — Xung đột kiểm tra phiên bản `polish-p12-release-version.test.ts` giữa bước cập nhật tài liệu (`Task P5.3`) và bước nâng version `2.0.0` (`Task P5.4`):** Giải quyết bằng quy tắc tách bạch rõ: `Task P5.3` giữ tương thích `polish-p12-release-version.test.ts` (`pnpm test` xanh 100%), và `Task P5.4` nâng đồng bộ toàn bộ mã nguồn + tài liệu + `polish-p12-release-version.test.ts` + `phase8.spec.ts` từ `0.2.1` lên `2.0.0` kèm `git grep` kiểm chứng không sót chuỗi `0.2.1` cũ trong manifest/launcher/server/HUD/test.
5. **Rủi ro 5 — Tàn dư mã chết (`energy`, 6 vũ khí clone, 6 stat-sticks, `activeBuffIds`) hoặc file `.ts >= 1000` dòng lọt qua 14 Phase:** Kiểm chứng tự động bằng script quét tĩnh và kiểm toán độc lập bởi **Whole-Branch Senior Code Reviewer (`Model: 'pro'`)** trên toàn bộ diff `git merge-base master HEAD..HEAD` tại `Task P5.5`.

---

## Task 1 (`P5.1`): Đóng Dứt Điểm `minor (deferred)` Tồn Đọng, Chụp Toàn Bộ Danh Mục Cảnh (`--phase ap2-p5 --label final --verify-freeze`) & Tổng Duyệt Holistic Visual Gate (`Model: pro` `>= 8.5 / 10`)

**Files:**
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-weapon-specials-p1b-legendary.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/sim/sim-weapon-mutators-p4a.ts`
- Create: `packages/shared/test/ap2-p5-deferred-cleanup.test.ts`
- Modify: `tests/e2e/visual.spec.ts`
- Modify: `tests/e2e/helpers/visual-strip-harness.ts`
- Output Artifacts: `docs/screenshots/ap2-p5/final/*` (`metrics.json`, `.png`, `-unlit.png`, `-roi-*.png`, `-strip.png`, `-telemetry-summary.md`) & `docs/screenshots/ap2-p5/review-1.md`

- [ ] **Step 1 (TDD RED — Deferred Minors Regression Tests):** Tạo `packages/shared/test/ap2-p5-deferred-cleanup.test.ts` kiểm chứng 4 mục `minor (deferred)` còn mở từ sổ cái `P1B` & `P4A`:
  1. Đòn 3 `berserker_axe` (`Đoạn Đầu Đài`) cộng số đạn địch bị phá/phản từ `triggerBerserkerGuillotineFinisher` vào `bulletsDestroyed` của sự kiện `melee_swing`.
  2. `solar_archon_staff` (`Tactical Vent` `Siêu Tân Tinh`) ghi nhận đạn địch bị xóa qua `sim.recordDestroyedProjectiles(...)` để đồng bộ thống kê `shotsBlockedOrDestroyed` / sự kiện `projectiles_destroyed`.
  3. Khi Bot sửa `ancient_mechanism` sinh `ancient_turret` trong `sim-progression-bot.ts`, hàm `enforcePlayerDeployableCap(sim, player.id)` được gọi để tổng deployables của người chơi không bao giờ vượt `MAX_DEPLOYABLES_PER_PLAYER = 8`.
  4. Trong `updateHoloDecoyTurretSummon` (`sim-weapon-mutators-p4a.ts`), nếu chủ sở hữu Co-op đã rời phòng (`!owner`), `holo_decoy_turret` tự hết hạn (`s.ttlSec = 0; s.hp = 0`) thay vì fallback `?? sim.player`.
  Chạy `npx vitest run packages/shared/test/ap2-p5-deferred-cleanup.test.ts` để xác nhận RED trên các hành vi chưa khép kín.

- [ ] **Step 2 (TDD GREEN — Minimal Surgical Fixes `< 1000` dòng):** Thực hiện sửa gọn 4 điểm trên trong `sim-weapon-cadence.ts`, `sim-weapon-specials-p1b-legendary.ts`, `sim-progression-bot.ts`, `sim-weapon-mutators-p4a.ts`. Chạy lại `npx vitest run packages/shared/test/ap2-p5-deferred-cleanup.test.ts` xác nhận `4/4` PASS và kiểm tra số dòng của cả 4 file đều `< 990` dòng.

- [ ] **Step 3 (Full-Catalog Visual Harness Hardening):**
  1. Trong `tests/e2e/visual.spec.ts`: nâng `test.setTimeout(900_000)` lên `test.setTimeout(2_700_000)` (`45` phút) để đủ ngân sách thời gian chạy 2 pass `--verify-freeze` trên toàn bộ `~140+` cảnh.
  2. Trong `tests/e2e/helpers/visual-strip-harness.ts` & `tests/e2e/visual.spec.ts`:
     - Nếu `scene.captureStrip` chạy trên cảnh không phải `GameScene` (`scene.expectedScene !== 'GameScene'`, ví dụ `gallery-characters`, `gallery-enemies` trong `ArtGalleryScene`), chụp `frameCount ?? 8` khung hình bằng cách bước tất định `stepDeterministicFrames(page, scene.stripFramesPerStep ?? 4)` giữa các frame, ghép `-strip.png` (`buildHorizontalStripPng` hoặc lưới tổng quan) và trích xuất ảnh `.png` ổn định cho `--verify-freeze` mà không gọi `win.__STRIP_HARNESS__!` (vốn chỉ tồn tại trong `GameScene`).
     - Với mọi cảnh `ap2-*` (và mọi cảnh có khai báo `stripSchedule` hoặc `apexEvent`), giữ **bắt buộc 100% `gateMode: 'HARD_ASSERT'`** (`5/5` cổng `evaluateAnimationGates` không khoan nhượng). Với các cảnh showcase hồi quy cũ của `v0.2.0` (`!scene.id.startsWith('ap2-') && !scene.stripSchedule && !scene.apexEvent`), mặc định `gateMode: 'WARN_ONLY'` để vẫn xuất đủ `-strip.png`, `-roi-*.png`, `-telemetry-summary.md`, `metrics.json` và kiểm chứng `--verify-freeze` tất định (`diffRatio < 0.005`, `traceHashMatched === true`).

- [ ] **Step 4 (Capture Full Visual Catalog `final` with `--verify-freeze`):**
  Chạy lệnh chụp toàn bộ danh mục cảnh (không lọc `--group` hay `--scenes` để bao phủ 100% cảnh `v0.2.0` + 6 nhóm `Ashen Pact 2.0` + `1440p`, `2560×1080` ultrawide, `1280×1024`, `Low` quality, `vi` & `en`, `b3-combat-grayscale`):
  ```bash
  pnpm shots -- --phase ap2-p5 --label final --verify-freeze
  ```
  Xác nhận `exit 0`, `0` console errors/warnings, `100%` cảnh strip `ap2-*` PASS `5/5` cổng `HARD_ASSERT`, và `metrics.json` ghi nhận đầy đủ `freezeDiffs`.

- [ ] **Step 5 (Commit & Task Review `P5.1`):** Chạy `pnpm typecheck && pnpm lint && pnpm test`, commit thay đổi code + bộ ảnh `docs/screenshots/ap2-p5/final/`, và kiểm định qua Task Reviewer.

- [ ] **Step 6 (Holistic `pro` Visual Gate — Ngưỡng Thương Mại `>= 8.5 / 10`):**
  Controller triệu hồi **Independent Holistic Visual Reviewer (`TypeName: 'research'`, `Model: 'pro'`)** đọc trực tiếp `docs/screenshots/ap2-p5/final/metrics.json`, bộ ảnh đại diện đa độ phân giải / `Low` / `vi` & `en` / `b3-combat-grayscale.png` và các tấm `1:1 Native Pixel` `-roi-*.png` + `-strip.png` + `-telemetry-summary.md` trải đều cả 6 nhóm cảnh Ashen Pact 2.0, trả lời 5 câu hỏi `Stage-Based Audit Questions` và chấm **Rubric 10 Tiêu Chí (Mục `6`)**.
  - **Điều kiện PASS:** **`10/10` tiêu chí đều đạt `>= 8.5 / 10`**, `0 blocker`, `0 major`. Lưu nguyên văn biên bản vào `docs/screenshots/ap2-p5/review-1.md` (và commit biên bản). Nếu bất kỳ tiêu chí nào `< 8.5 / 10` hoặc có lỗi thị giác, chạy vòng Fix Loop qua Implementer → chụp lại `--verify-freeze` → chấm lại bởi `pro` Visual Reviewer mới cho tới khi đạt `10/10 >= 8.5 / 10`.

---

## Task 2 (`P5.2`): Kiểm Toán Cân Bằng Cuối Cùng (`pnpm balance`) & Kiểm Toán Hiệu Năng / Soak Test 60Hz 4P (`pnpm perf`)

**Files:**
- Modify: `tools/balance-simulations-p3c.ts`
- Modify: `tools/balance-harness.ts`
- Create: `packages/shared/test/ap2-p5-holistic-soak-balance.test.ts`
- Modify: `docs/balance-report.md`

- [ ] **Step 1 (TDD — Late-Game Synergy Floor 6 Boss Audit & 200-Cycle 4P Co-op Soak Test):**
  Tạo `packages/shared/test/ap2-p5-holistic-soak-balance.test.ts` (`< 500` dòng) gồm 2 nhóm kiểm định thực chiến không hệ số giả:
  1. **Kiểm toán Đường cong sức mạnh cuối game (`Floor 1 -> Floor 6`, Full `24 Blessings + 10 Mutators + 6 Duo Boons + 6 Awakened Relics`):**
     - Mô phỏng Bot người chơi thật (`AVERAGE_PLAYER_BOT_PROFILE`: `godMode = false`, `Perfect Reload = 50%`, `Flip + Dash-Kick = 40%`) mang tổ hợp build cuối game mạnh (vũ khí nâng cấp + `2` Daedalus Mutators + `6` Action Blessings + `2` Elemental Duo Boons + `2` Awakened Relics) đối đầu Boss Tầng 6 `forge_titan` (`globalFloor = 6`) trên nhiều hạt giống cố định: xác nhận `3-Bucket Damage Pipeline` (`Soft Cap 2.80x / Hard Cap 3.80x` + `Boss Single-Hit Cap 18.0x`) ngăn chặn tuyệt đối hiện tượng nổ số one-shot Boss, giữ **thời gian sống thực tế của Boss Tầng 6 `forge_titan` `>= 45.0s`** (`avgSec >= 45` và `<= 125`), `zeroOneShots === true`.
  2. **Kiểm toán Chịu tải 60Hz 4P Co-op LAN & Chống Rò Rỉ `>= 200` Chu Kỳ (`Room Transitions / Weapon Salvage / Flip & Dash-Kick`):**
     - Khởi tạo `WorldSim` 4P Co-op (`coopMode: true`) trang bị hỗn hợp vũ khí `DYNAMIC_BOUNCE` + `P4A` Mutators/Blessings + `P4B` Duo Boons + `Ashen Pacts`.
     - Thực thi liên tiếp **`>= 200` lần chuyển phòng (`enterRoom`)**, **`>= 200` lần giữ `[X]` `0.50s` (`30 ticks`) phân rã vũ khí dưới đất (`Weapon Salvage`)**, và **`>= 200` lần nhấn `[E]` lật Bia Chắn + `Dash-Kick` sút vật thể trượt**, xen kẽ giao tranh 4P 60Hz và mã hóa gói tin mạng `encodeWorldSnapshot(sim)` (`snapshot-codec.ts`).
     - Khẳng định định lượng:
       - Thời gian xử lý `sim.step(1/60)` trên Server đạt **`p95 < 4.5ms`**.
       - Kích thước gói tin nhị phân/JSON từ `encodeWorldSnapshot` nằm gọn trong ngân sách (`<= 24 KB` đỉnh, chênh lệch kích thước snapshot cuối chu kỳ 200 so với chu kỳ 20 `<= +15%` — không phình mảng `worldItems`, `props`, `events`).
       - Trần Object Pool được giữ tuyệt đối (`playerProjectiles <= 240`, `enemyProjectiles <= 160`, `deployables/player <= 8`, `tacticalProps/room <= 16`) và mức tăng bộ nhớ `heapUsed` sau warmup `< 48 MB`.

- [ ] **Step 2 (Cập nhật `pnpm balance` Bổ Sung Mục Kiểm Toán Build Cuối Game Tầng 6):**
  Mở rộng nhẹ `tools/balance-simulations-p3c.ts` & `tools/balance-harness.ts` (giữ mỗi file `< 700` dòng) để đo và in thêm bảng **Late-Game Full-Synergy Floor 6 Boss Resilience (`24 Blessings + 10 Mutators + 6 Duo Boons`)** vào `docs/balance-report.md` khi chạy `pnpm balance`, xác nhận `allTargetsPassed === true` (`9/9` chỉ tiêu chuẩn + chỉ tiêu Boss Tầng 6 trước build cuối game `>= 45s`). Nếu phát hiện bất kỳ tổ hợp Duo Boon/Mutator nào làm Boss Tầng 6 bốc hơi `< 45s`, điều chỉnh hệ số nội bộ đúng chuẩn Spec Rev 4 để khóa chặt đường cong cân bằng.

- [ ] **Step 3 (Chạy Thực Tế `pnpm balance`, `pnpm perf` & Unit Tests):**
  - Chạy `npx vitest run packages/shared/test/ap2-p5-holistic-soak-balance.test.ts packages/shared/test/phase8-soak-release.test.ts` (`PASS 100%`).
  - Chạy `pnpm balance` xuất `docs/balance-report.md` mới nhất (`exit 0`, toàn bộ chỉ tiêu PASS).
  - Chạy `pnpm perf` trên GPU thật (`exit 0`, VSync Normal `>= 60 FPS`, VSync Stress `>= 58 FPS`, Server/Client frame-time đạt chuẩn).
  - Commit kết quả và kiểm định qua Task Reviewer.

---

## Task 3 (`P5.3`): Đồng Bộ Toàn Bộ Tài Liệu Kiến Trúc & Thiết Kế Sống (`docs/*.md` & `README.md`)

**Files:**
- Modify: `docs/GDD.md`
- Modify: `docs/BALANCE.md`
- Modify: `docs/TECH.md`
- Modify: `docs/ART_GUIDE.md`
- Modify: `README.md`
- Modify: `docs/RELEASE_NOTES.md`

- [ ] **Step 1 (`docs/GDD.md` — Thiết kế Gameplay Ashen Pact 2.0 Toàn Diện):**
  Cập nhật đầy đủ kiến trúc gameplay mới theo Spec Rev 4:
  - **Tam Giác Hành Động 3 Giây** (`Active Weapon Cadence [R]/Combo 3` → `Flip Cover [E] + Micro-Blank + Dash-Kick` → `Wall-Slam / Chasm Ring-Out / Boss Armor Break`) và việc cắt bỏ hoàn toàn thanh `Energy`, 6 vũ khí clone, 6 stat-sticks.
  - **6 Archetype Phòng Chiến Thuật** (`TWIN_BRIDGES` vực chữ Y, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`, `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING`), Quy luật 3 Biome & 9 Vật thể tương tác (`moss_table`, `volatile_spore_pod`, `rotten_totem_pillar`, `glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`, `forge_blast_shield`, `pneumatic_press`, `slag_crucible`).
  - **18 Vũ Khí Độc Bản** chia theo 3 gia tộc nhịp (`CLIP_RELOAD` Khung Vàng `45%–70%`, `HEAT_VENT` Vùng Cam `65%–95%`, `MELEE_COMBO` Đòn 3 `Parry Deflect 0.18s`), khởi đầu 1 vũ khí ở Ô 1 + `Holster Auto-Reload 2.0s`.
  - **Hệ Thống Build Cá Nhân Hóa (`Per-Player`):** `24` Phước lành Hành động (4 nhóm × 6 thẻ), `10` Nâng cấp Kỹ năng Nhân vật, `10` Bản độ Búa Rèn (`Daedalus Weapon Mutators`), `6` Phước lành Giao thoa Nguyên tố (`Elemental Duo Boons` — `35%` ở ô thẻ thứ 3), `6` Khế ước Tro Tàn (`1 Tế Đàn / Biome` ở Tầng Lẻ `1, 3, 5`) → `6` Di vật Thức tỉnh sau Boss Tầng Chẵn (`2, 4, 6`).
  - **Đồ Thị Phòng Động, Kinh Tế & Thử Thách:** Phòng Bí Mật tường nứt + **Đấu Trường Kỹ Năng 20 Giây (`Secret Skill Arena 20s` → Rương `100% Legendary` + `+40G`)**, Giữ `[X]` `0.5s` Phân Rã Vũ Khí (`Weapon Salvage`), Thưởng phòng hoàn hảo `+10G`, bảng giá Thương Nhân chuẩn.
  - **AI Quái & 3 Boss:** `Bounded Predictive Lead Aiming` (`±28°` + tia chỉ ngắm `0.35s`), `12` hành vi quái tương tác địa hình qua 3 Biome, cơ chế Phá Giáp Trực Quan `1–2 Bước` của `spore_king`, `kryssa_ice_queen`, `forge_titan` kèm `Boss Supply Drop 18s` và thanh `bossStaggerAccum`.

- [ ] **Step 2 (`docs/BALANCE.md`, `docs/TECH.md`, `docs/ART_GUIDE.md`):**
  - `docs/BALANCE.md`: Đồng bộ công thức `3-Bucket Damage Pipeline` (`Soft Cap 2.80x / Hard Cap 3.80x`, `M_EnemyVuln <= 1.75x`, `Boss Single-Hit Cap 18.0x`, `One-Split Rule`, `MAX_PELLETS_PER_TRIGGER = 9`), cấu hình `AVERAGE_PLAYER_BOT_PROFILE` (`godMode = false`, `50%` `[R]`, `40%` Flip+Kick), và bảng số liệu `pnpm balance` mới nhất từ `Task P5.2` (bao gồm kiểm toán build cuối game Tầng 6).
  - `docs/TECH.md`: Ghi rõ kiến trúc đồng bộ đạn mạng 60Hz (`deterministicId` 16-bit/28-bit, `SHOT_FLAG.DYNAMIC_BOUNCE`, `Zero-Rubberband Client Hold 0.12s`, `replacedProjectileId`, `projectiles_destroyed`), tách trạng thái `Per-Player` trong `snapshot-codec.ts` (`<= 64` events ưu tiên), trần Object Pool 60Hz (`240 / 160 / 16 / 8`), kiến trúc module hóa `< 1000` dòng/file (`288+` files), và hệ thống kiểm định hình ảnh **Animation & Moment Verification Engine 2.6 (`HARD_ASSERT`)**.
  - `docs/ART_GUIDE.md`: Bổ sung quy chuẩn visual cho Bia Chắn 3 trạng thái (`'low' | 'flipped' | 'sliding'`), 9 Đồ Chơi Biome, vực sâu `chasm` & cầu đôi, thanh `Micro-Bar 32×5px` dưới chân nhân vật (ẩn trên `MELEE_COMBO`), thẻ `Duo Boon` viền Kim Cương Đôi Cầu Vồng, Modal Tế Đàn Khế Ước & Đe Rèn Cổ Đại, đồng hồ 20s phòng Bí Mật, đồng thời khẳng định bảo toàn 100% chuẩn **Golden Room v0.2.0** (`vignetteStrength = 0.0`, đạn địch `#E84545` tương phản cao nhất, VFX đồng minh alpha `0.50`).

- [ ] **Step 3 (`README.md` & `docs/RELEASE_NOTES.md`):**
  - Cập nhật `README.md` phản ánh đầy đủ tính năng và bảng phím điều khiển mới của Ashen Pact 2.0 (`[R]` Nạp Đạn Hoàn Hảo / Xả Nhiệt Chiến Thuật, `[E]` Cứu đồng đội / Lật Bia Chắn / Tương tác, `Shift` Lướt & `Dash-Kick`, `[X]` Vứt nhanh / Giữ `0.5s` Phân Rã Súng).
  - Bổ sung mục lớn **"What's New in Ashen Pact v2.0.0 — Tactical Arena Overhaul"** vào đầu `docs/RELEASE_NOTES.md` (giữ lại mục lịch sử `v0.2.1 ("Polish & Depth")` bên dưới để đảm bảo tính liên tục lịch sử phát hành và giữ `polish-p12-release-version.test.ts` pass 100% trước khi `Task P5.4` nâng toàn bộ version string sang `2.0.0`).
  - Chạy `pnpm test` xác nhận toàn bộ Vitest suites PASS `100%`, commit `docs(p5): synchronize GDD, BALANCE, TECH, ART_GUIDE, README and RELEASE_NOTES for v2.0.0`, và kiểm định qua Task Reviewer.

---

## Task 4 (`P5.4`): Nâng Phiên Bản Lên `2.0.0` (`Version Bump`) & Kiểm Thử Đóng Gói Bản Phát Hành (`pnpm package:release` + `pnpm verify`)

**Files:**
- Modify: `package.json`
- Modify: `packages/shared/package.json`
- Modify: `apps/client/package.json`
- Modify: `apps/server/package.json`
- Modify: `tools/package-release.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/client/src/scenes/MenuScene.ts`
- Modify: `tests/e2e/phase8.spec.ts`
- Modify: `packages/shared/test/phase8-soak-release.test.ts`
- Modify: `packages/shared/test/polish-p12-release-version.test.ts`
- Modify: `README.md`
- Modify: `docs/RELEASE_NOTES.md`
- Modify: `docs/QA_CHECKLIST.md`
- Modify: `CREDITS.md`
- Modify: `docs/CREDITS.md`

- [ ] **Step 1 (TDD RED — Cập Nhật Bài Test Kiểm Định Phiên Bản Phát Hành `v2.0.0`):**
  Cập nhật `packages/shared/test/polish-p12-release-version.test.ts`, `packages/shared/test/phase8-soak-release.test.ts` (dòng `360–361`) và `tests/e2e/phase8.spec.ts` (dòng `9, 11, 23, 24, 86, 140`) để khẳng định phiên bản **`2.0.0`** và gói phát hành **`AshenPact-v2.0.0-win-x64`** / **`AshenPact-v2.0.0-win-x64.zip`** trên toàn hệ thống (bao gồm kiểm tra `MenuScene.ts` hiển thị `'v2.0.0 · LAN'` và không còn `0.2.1` trong manifest, `package-release.ts`, `apps/server/src/index.ts`, `MenuScene.ts`, `phase8.spec.ts`, `README.md`, `CREDITS.md`, `docs/CREDITS.md`, `docs/QA_CHECKLIST.md`).
  Chạy `npx vitest run packages/shared/test/polish-p12-release-version.test.ts` để xác nhận RED.

- [ ] **Step 2 (TDD GREEN — Nâng Version `0.2.1` → `2.0.0` Toàn Hệ Thống):**
  1. `package.json`, `packages/shared/package.json`, `apps/client/package.json`, `apps/server/package.json`: `"version": "2.0.0"`.
  2. `tools/package-release.ts`: `const RELEASE_NAME = 'AshenPact-v2.0.0-win-x64';` và cập nhật toàn bộ tiêu đề C# Launcher / `.bat` / banner đóng gói sang `v2.0.0` (`ASHEN PACT v2.0.0 WIN-X64`).
  3. `apps/server/src/index.ts`: `/api/health` và `/api/host-info` trả `version: '2.0.0'`, banner khởi động in `'  ASHEN PACT v2.0.0 — MÁY CHỦ CO-OP LAN ĐÃ KHỞI ĐỘNG THÀNH CÔNG'`.
  4. `apps/client/src/scenes/MenuScene.ts` (dòng `229`, sửa tại chỗ giữ nguyên `982` dòng `< 1000`): đổi `'v0.2.1 · LAN'` thành `'v2.0.0 · LAN'`.
  5. Cập nhật tiêu đề phiên bản và tên gói `AshenPact-v2.0.0-win-x64.zip` trong `README.md`, `docs/RELEASE_NOTES.md` (giữ mục lịch sử `v0.2.1` bên dưới nhưng header & hướng dẫn tải chính là `v2.0.0` / `AshenPact-v2.0.0-win-x64`), `docs/QA_CHECKLIST.md`, `CREDITS.md`, `docs/CREDITS.md`.
  6. Quét `git grep -n "0\.2\.1"` và `git grep -n "0\.2\.0"` trên toàn repo để xác nhận không bỏ sót bất kỳ hằng số phiên bản cũ nào ngoài nhật ký lịch sử.

- [ ] **Step 3 (Đóng Gói Bản Phát Hành Độc Lập & Chạy Full `pnpm verify`):**
  1. Chạy `pnpm package:release` để biên dịch client + server bundle + C# `AshenPact-Host.exe` và đóng gói `release/AshenPact-v2.0.0-win-x64/` cùng `release/AshenPact-v2.0.0-win-x64.zip`.
  2. Chạy `npx vitest run packages/shared/test/polish-p12-release-version.test.ts packages/shared/test/phase8-soak-release.test.ts` (`PASS 100%`).
  3. Chạy trọn bộ `pnpm verify` (`pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm e2e` — bao gồm `tests/e2e/phase8.spec.ts` giải nén/chạy `AshenPact-Host.exe` `v2.0.0` ở cả chế độ `--debug` Co-op LAN thật Chromium + Edge lẫn chế độ release mặc định khóa debug!).
  4. Hoàn nguyên các ảnh side-effect E2E cũ trong `docs/screenshots/phase-0..phase-8` / `polish-p1` (nếu E2E ghi đè timestamp/ảnh cũ), giữ `git status` sạch, commit `chore(release): bump version to 2.0.0 and verify standalone Windows release package`, và kiểm định qua Task Reviewer.

---

## Task 5 (`P5.5`): Tổng Duyệt Code Toàn Nhánh (`requesting-code-review`, `Model: 'pro'`), Phase Gate Cuối & Gắn Tag `ap2-p5` + `v2.0.0`

**Files:**
- Modify: `docs/PHASES.md`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1 (Kiểm Toán Tĩnh Toàn Kho Mã Nguồn Trước Tổng Duyệt):**
  Chạy script kiểm toán tự động trên toàn bộ nhánh `overhaul/v2.0`:
  1. Xác nhận `100%` file `.ts` trong `packages/`, `apps/`, `tools/`, `tests/` đều **nghiêm ngặt `< 1000` dòng** (`0` vi phạm).
  2. Xác nhận `0` lệnh gọi `Math.random()` trong `packages/shared/src/sim/`.
  3. Xác nhận `0` tàn dư mã chết của `maxEnergy` / `energyRegen` / `energyCost`, 6 vũ khí clone (`rusty_pistol`, `dual_pistols`, `venom_smg`, `frost_bow`, `frost_scepter`, `dragon_breath_shotgun`), 6 thẻ cộng chỉ số phẳng (`vitality_surge`, `iron_bastion`, `arcane_wellspring`, `eagle_precision`, `gale_reflex`, `ricochet_mastery`), và `activeBuffIds` trong `packages/` & `apps/`.

- [ ] **Step 2 (Whole-Branch Senior Code Review — `TypeName: 'research'`, `Model: 'pro'`):**
  Xuất gói tổng duyệt toàn nhánh từ `git merge-base master HEAD` (`f26d4b7`) tới `HEAD` (`git log --oneline`, `git diff --stat`, kết quả kiểm toán tĩnh, danh sách file thay đổi) và triệu hồi **Senior Code Reviewer (`Model: 'pro'`)** kiểm toán độc lập toàn bộ kiến trúc `Ashen Pact 2.0`:
  1. Triệt tiêu 100% tàn dư `energy`, 6 vũ khí clone, 6 stat-sticks, `worldSim.activeBuffIds`.
  2. Kỷ luật `< 1000` dòng/file trên 100% file `.ts` và tính tất định `SeededRng`.
  3. Bảo mật cổng `--debug` trong bản phát hành mặc định (`AshenPact-Host.exe` không lộ `window.__GAME_*`, từ chối `debug_cmd`/`set_god_mode` với `debug_rejected`) và an toàn đồng bộ mạng 60Hz (`deterministicId`, `Zero-Rubberband Client Hold`, per-player `meta.playerId` validation trên `CoopRoom.ts`).
  - Nếu Reviewer phát hiện bất kỳ vấn đề nào (`Critical` / `Important` / `Minor` có rủi ro thực tế): giao 1 vòng Fix Wave gọn cho Implementer → Scoped Re-Reviewer xác nhận `ADDRESSED` → chạy lại `pnpm package:release`, `pnpm verify`, `pnpm balance` và `pnpm perf`.

- [ ] **Step 3 (Cập Nhật `docs/PHASES.md`, `docs/PROGRESS.md` & Gắn Tag `ap2-p5` + `v2.0.0`):**
  - Chạy tươi `pnpm verify` và `pnpm perf` (`verification-before-completion`).
  - Cập nhật `docs/PHASES.md` (đánh dấu `[x]` toàn bộ 14/14 Phase `P0A` → `P5`) và `docs/PROGRESS.md` (ghi biên bản nghiệm thu `Phase P5` & `v2.0.0`: bảng điểm Holistic Visual Gate `>= 8.5/10`, kết quả `pnpm balance`, `pnpm perf`, `pnpm verify`, `AshenPact-v2.0.0-win-x64.zip`, và tổng hợp Rulings).
  - Commit `chore(release): finalize Ashen Pact v2.0.0 holistic QA and release gate (ap2-p5)` và gắn đồng thời 2 git tag trên nhánh `overhaul/v2.0`: **`ap2-p5`** và **`v2.0.0`**.

---

## Task 6 (`P5.6`): Báo Cáo Tổng Kết Chiến Dịch & Trình Menu Kết Thúc Nhánh (`finishing-a-development-branch`)

- [ ] **Step 1 (Thu Thập Toàn Bộ Rulings Trước Khi Dọn Workspace Tạm):**
  - Đọc `finishing-a-development-branch/SKILL.md`.
  - Trích xuất đầy đủ mọi dòng `Ruling:` theo thứ tự thời gian từ toàn bộ `.superpowers/sdd/*/progress.md` và `docs/PROGRESS.md`.
  - Dọn dẹp các subagent đang mở (`manage_subagents(kill_all)`) và thư mục scratch `.superpowers/sdd/*` theo đúng quy trình kết thúc của `subagent-driven-development` (xác nhận `git status -s` sạch 100%).

- [ ] **Step 2 (Trình Bày Báo Cáo Tổng Kết Chiến Dịch Tiếng Việt & Menu 3 Lựa Chọn — DỪNG CHỜ USER):**
  Xuất báo cáo tổng kết hoàn chỉnh bằng tiếng Việt (kèm link `file:///`):
  1. Bảng tổng hợp toàn bộ **14 Phase (`P0A` → `P5`)**, commit/tag và trạng thái nghiệm thu.
  2. Bảng đối chiếu điểm **Visual Reviewer Rubric 10 Tiêu Chí** (`baseline` → `final P5`, mọi tiêu chí `>= 8.5 / 10`).
  3. Bằng chứng chạy tươi của **`pnpm verify`**, **`pnpm balance`**, **`pnpm perf`** và gói phát hành **`release/AshenPact-v2.0.0-win-x64.zip`**.
  4. Mục **"Các Ruling tôi đã tự quyết"** (đầy đủ theo thứ tự thời gian kèm lý do & chi phí nếu sai) và **"Cần tôi xem"** (nếu có).
  5. Trình bày đúng **Menu 3 lựa chọn của `finishing-a-development-branch`** (1. Merge nhánh `overhaul/v2.0` vào `master` ngay trên máy local / 2. Push nhánh `overhaul/v2.0` và tạo Pull Request / 3. Giữ nguyên nhánh `overhaul/v2.0` để tự kiểm tra thêm) và **DỪNG LẠI CHỜ NGƯỜI DÙNG LỰA CHỌN**.
