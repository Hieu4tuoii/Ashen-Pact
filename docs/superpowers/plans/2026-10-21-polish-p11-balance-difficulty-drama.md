# Phase P11 — Độ Khó & Kịch Tính ("Polish & Depth" v0.2.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp toàn diện độ khó thực chất và kịch tính trình bày cho Ashen Pact v0.2.0 theo đúng المục 3.10, 3.11 và 4.P11 của `docs/superpowers/specs/2026-10-20-polish-v0.2.0-design.md`:
1. **Bước 1 (Task 1 — Honest Balance Harness & Locked Bot Profile):** Loại bỏ toàn bộ hệ số giả (`encounterScale`, `roomFactor`, `godMode = true`, hồi máu giả, năng lượng vô hạn) khỏi `tools/balance-simulations.ts` và `tools/balance-harness.ts`; xây dựng và **khóa** `tools/bot-profile.ts` (bot "người chơi trung bình": ngắm chính xác `~70%`, phản xạ `250ms`, xác suất dash né telegraph `65%`, không `godMode`, chạy `>= 30` seed mỗi cấu hình, báo cáo trung vị `p50` và `p10`/`p90`); cập nhật mục tiêu mới vào `docs/BALANCE.md` và sửa ghi chú `GOBLIN_GREEN` trong `docs/ART_GUIDE.md`; đồng thời đăng ký `SCENE_GROUPS.p11` và chụp bộ ảnh `docs/screenshots/polish-p11/before/` kèm `--verify-freeze`. **Commit và khóa `tools/bot-profile.ts` ở Task 1 trước khi bắt đầu Task 2.**
2. **Bước 2 (Task 2 — Data-Driven Difficulty Levers, Boss Drama & Presentation):**
   - Sửa lỗi tốc bắn co-op bị nhân đôi trong `packages/shared/src/sim/sim-enemies-core.ts`.
   - Thêm `BIOME_SCALING` (HP, tốc bắn/cooldown, elite bonus cho Biome 1/2/3) trong `packages/shared/src/data/scaling.ts` và áp dụng trong `spawnEnemyImpl` + `getEnemyCooldownScaleImpl`.
   - Nâng HP Boss thật (`spore_king`, `kryssa_ice_queen`, `forge_titan`) theo DPS đo được (bắt đầu từ vùng `×5–7`, tinh chỉnh bằng harness thật để thời lượng Boss đạt `60–120s` và lệch 1P↔4P `<= ±20%`).
   - Nhịp độ phòng & Đợt chồng nhau (Overlapping Waves): mỗi tầng có **4 phòng combat** (gồm 3 phòng combat chuẩn + 1 **Phòng Thử Thách** có 3 đợt chồng nhau, mỗi đợt có Elite, thưởng rương cao hơn 1 bậc); số quái mỗi đợt `min(6, 4 + ...)`; xác suất Elite solo `22%` (Tầng 1) / `32%` (Tầng 2); đợt kế tiếp spawn sớm khi còn `<= 25%` quái của đợt hiện tại HOẶC sau `12s` (tối đa 2 đợt chồng nhau cùng lúc) kèm vòng triệu hồi cảnh báo `0.8s`.
   - Thêm 2 modifier Elite mới: `volley` (+2 viên mỗi lượt bắn) và `vengeful` (khi chết kích hoạt vòng 8 viên đạn chậm có cảnh báo telegraph `0.5s`).
   - Tốc đạn địch `+12–15%`, cooldown tấn công `-10–15%`, **giữ nguyên thời gian telegraph (`>= 0.4s`)**; chỉ tăng sát thương có chọn lọc ở Elite và đòn Boss có telegraph dài nhất (không tăng sát thương quái thường, không có one-shot).
   - Hồi giáp chậm hơn `+0.5s`; hồi sinh sau khi dọn phòng trả `35%` HP (thay vì `50%`); giá cửa hàng tăng (`health_potion: 25`, `weapon: 40 / 60`, `armor_upgrade: 45`).
   - Boss Kháng CC (đóng băng tối đa `0.6s`, giảm dần hiệu lực trong cửa sổ `8s`; Tê Liệt không ngắt `telegraph` ở Phase 3), Chuyển Phase kịch tính (`1.2s` bất tử + gầm vang + rung màn hình + xóa đạn quanh Boss + mở màn bằng chiêu đặc trưng ngay lập tức), và Enrage mềm sau `90s` (mỗi `15s` cooldown `×0.93`, tối đa `×0.75`, hào quang/viền đỏ và nhạc combat dồn dập hơn).
   - Trình bày kịch tính & Mục 3.11: banner đợt quái `"ĐỢT X/Y"`, bộ đếm quái còn lại trên HUD, nhạc combat tăng cường độ khi HP thấp hoặc Boss enrage, sửa `weapon_swapped` không phát SFX của người khác ở máy mình, và thông báo toast khi bật/tắt fullscreen hoặc tự động đổi chất lượng đồ họa.
3. **Bước 3 (Task 3 — Visual Gate, Balance Report, Full Verification & Git Tag `polish-p11`):** Chụp ảnh `after` + strip 8 frame cho `SCENE_GROUPS.p11` kèm `--verify-freeze`, chạy Blind A/B `pro` Visual Reviewer, xuất `docs/balance-report.md` đạt chuẩn bằng `pnpm balance`, chạy `pnpm verify` + `pnpm perf`, ghi checklist test tay vào `docs/PROGRESS.md` và gắn tag `polish-p11`.

**Architecture:**
- Tách bạch rõ ràng Bước 1 (thước đo & bot profile tại `tools/bot-profile.ts`, `tools/balance-simulations.ts`, `tools/balance-harness.ts`) và Bước 2 (data/sim levers tại `packages/shared/src/data/*`, `packages/shared/src/sim/*` và trình bày client tại `apps/client/src/scenes/game-scene/p11-drama-hud.ts`, `sim-events.ts`, `music-synth.ts`, `graphics-settings.ts`).
- Mọi hiệu ứng HUD/visual kịch tính mới của P11 được đặt trong module riêng `apps/client/src/scenes/game-scene/p11-drama-hud.ts` và helper cảnh chụp đặt trong `tests/e2e/helpers/visual-scene-p11-helpers.ts` để giữ tất cả file nguồn và test nghiêm ngặt `< 1000` dòng.

**Tech Stack:** TypeScript, Phaser 3, Vitest, Playwright, `tsx` Headless Balance Harness (`WorldSim` 60Hz).

---

## Cấu Trúc File Dự Kiến

### Tạo mới:
- `tools/bot-profile.ts` — Cấu hình khóa cứng (`Object.freeze`) cho bot "người chơi trung bình" (`aimAccuracy: 0.70`, `reactionDelaySec: 0.25`, `dashDodgeProbability: 0.65`, `godMode: false`, `infiniteEnergy: false`, danh sách `30` seed chuẩn, hàm tính `p10`/`p50`/`p90` và bộ điều khiển AI bot trung thực dùng chung cho harness).
- `apps/client/src/scenes/game-scene/p11-drama-hud.ts` — Pure helpers & Phaser rendering cho Banner Đợt Quái (`"ĐỢT X/Y"`), Bộ Đếm Quái Còn Lại (`"Quái: N"`), Hào Quang & Huy Hiệu Boss Chuyển Phase (`1.2s` invuln) / Boss Enrage Mềm (`>= 90s`), và Toast thông báo khi bật/tắt Fullscreen hoặc Tự động đổi chất lượng đồ họa.
- `tests/e2e/helpers/visual-scene-p11-helpers.ts` — Định nghĩa `P11_SCENE_IDS` và `P11_VISUAL_SCENES` (`p11-boss-phase-transition` + strip, `p11-boss-enrage` + strip, `p11-wave-overlap-challenge` + strip, cùng các cảnh boss/combat đối chiếu).
- `packages/shared/test/polish-p11-balance-difficulty.test.ts` — Bộ unit test kiểm chứng toàn bộ cơ chế P11: `BIOME_SCALING`, sửa lỗi nhân đôi tốc bắn co-op, 4 phòng combat + Phòng Thử Thách, đợt chồng nhau (`<= 25%` hoặc `12s`), modifier Elite `volley` & `vengeful`, kháng CC của Boss (freeze `<= 0.6s` + DR `8s`, Tê Liệt không ngắt telegraph Phase 3), chuyển phase `1.2s` bất tử + xóa đạn + chiêu mở màn, enrage mềm sau `90s` (`×0.93` mỗi `15s` tới sàn `×0.75`), hồi giáp `+0.5s`, hồi sinh dọn phòng `35%` HP, giá shop mới, và các hàm pure của `p11-drama-hud.ts` / `bot-profile.ts`.
- `tests/e2e/polish-p11.spec.ts` — E2E test kiểm chứng HUD đếm quái còn lại, banner đợt quái chồng nhau, hiệu ứng chuyển phase & enrage của Boss, toast khi bật/tắt fullscreen & auto-quality, và bot autoplay vượt qua tầng an toàn.

### Chỉnh sửa:
- `tools/balance-simulations.ts` — Xóa bỏ hoàn toàn `encounterScale`, `roomFactor`, `godMode = true`, hồi máu giả và năng lượng vô hạn; dùng bot từ `tools/bot-profile.ts` để đo thực tế trên `WorldSim` 60Hz.
- `tools/balance-harness.ts` — Chạy `>= 30` seed mỗi cấu hình, báo cáo `p50` (trung vị) và `p10`/`p90`, bổ sung metric HP+giáp mất mỗi phòng (`25–50%` ở B1), tỉ lệ bị gục (`downedRate`), tỉ lệ thắng Boss theo từng Biome (`B1 80–95%`, `B2 70–90%`, `B3 60–85%`, `0` one-shot), và chỉ số độ khó đo thật giữa Biome 1 → 2 → 3 (`+20–25%`).
- `docs/BALANCE.md` & `docs/ART_GUIDE.md` — Cập nhật bảng mục tiêu Mục 3.10, đồng bộ bảng thông số vũ khí/quái/boss với code, và sửa ghi chú `GOBLIN_GREEN` trong `docs/ART_GUIDE.md`.
- `packages/shared/src/data/types.ts` — Mở rộng `EliteModifier` thêm `'volley' | 'vengeful'`.
- `packages/shared/src/data/scaling.ts` — Thêm `BIOME_SCALING` (`hpMultiplier`, `cooldownScale`, `projectileSpeedMultiplier`, `eliteBonusMultiplier`, `eliteDamageBonus`) cho Biome 1, 2, 3.
- `packages/shared/src/data/enemies.ts` — Nâng HP thật của 3 Boss (`spore_king`, `kryssa_ice_queen`, `forge_titan`), giảm nhẹ cooldown tấn công (`-10–15%`) trong khi giữ nguyên `telegraphDurationSec >= 0.4s`, tăng chọn lọc sát thương đòn telegraph dài nhất của Boss, và thêm mô tả cho `volley` & `vengeful`.
- `packages/shared/src/data/characters/index.ts` — Tăng `armorRegenDelaySec` thêm `+0.5s` cho cả 5 nhân vật (`3.5s → 4.0s`, riêng Thiết Vệ `2.8s → 3.3s`).
- `packages/shared/src/sim/world-sim-types.ts` & `packages/shared/src/sim/world-sim-events.ts` — Thêm trường trạng thái cho `SimEnemyState` (`waveIndex`, `bossPhaseTransitionTimer`, `bossCombatElapsedSec`, `bossFreezeDrTimer`, `bossFreezeCountWindow`, `bossEnrageLevel`) và thêm event `wave_started` / `boss_enraged` / `vengeful_telegraph`.
- `packages/shared/src/sim/world-sim.ts` — Thêm `waveElapsedSec` và danh sách `pendingVengefulRings` để kích hoạt vòng 8 đạn chậm của Elite `vengeful` sau `0.5s` telegraph.
- `packages/shared/src/sim/dungeon-gen.ts` — Mỗi tầng có **4 phòng combat** (giữ nguyên RNG của 9 phòng đầu `id = 0..8` để bảo toàn tuyệt đối layout các cảnh visual, và nhánh thêm phòng thứ 10 `id = 9` làm Phòng Thử Thách `isChallenge: true` bằng RNG nhánh `rng.fork('challenge_combat_room')`), số quái mỗi đợt `min(6, 4 + ...)`, xác suất Elite solo `22%` / `32%`, danh sách 6 `ELITE_MODIFIERS` (thêm `volley`, `vengeful`), và giá cửa hàng mới (`health_potion: 25`, `weapon: 40 / 60`, `armor_upgrade: 45`).
- `packages/shared/src/sim/sim-props-spawning.ts` — Áp dụng `BIOME_SCALING` trong `spawnEnemyImpl` (trừ dummy/illusion/core phụ) và tăng chọn lọc sát thương cho Elite.
- `packages/shared/src/sim/sim-enemies-core.ts` — Sửa lỗi nhân đôi tốc bắn co-op ở dòng `263` (`e.attackCooldownTimer = Math.max(0, e.attackCooldownTimer - dtSec)` vì `getEnemyCooldownScale` đã nhân `coopCdScale`), áp dụng `BIOME_SCALING` + Boss Soft Enrage (`>= 90s`, mỗi `15s` nhân `0.93` tới sàn `0.75`) trong `getEnemyCooldownScaleImpl`, và nâng cấp `checkBossPhaseTransitionsImpl` (`1.2s` bất tử `bossPhaseTransitionTimer = 1.2` + xóa đạn quanh Boss + kích hoạt ngay chiêu đặc trưng mở màn).
- `packages/shared/src/sim/sim-enemies-biome1.ts`, `sim-enemies-biome2.ts`, `sim-enemies-biome3.ts` — Tăng tốc đạn địch `+12–15%`, hỗ trợ Elite modifier `volley` (+2 viên đạn mỗi lượt bắn), và đòn chữ ký có telegraph dài nhất của mỗi Boss tăng nhẹ sát thương (không one-shot).
- `packages/shared/src/sim/sim-combat-damage.ts` — Áp dụng kháng CC cho Boss (đóng băng tối đa `0.6s`, giảm dần hiệu lực trong cửa sổ `8s` `bossFreezeDrTimer`; phản ứng `paralysis` không ngắt `telegraph` của Boss ở Phase 3), chặn sát thương trong `1.2s` chuyển phase của Boss (`bossPhaseTransitionTimer > 0`), và kích hoạt vòng telegraph `0.5s` → 8 viên đạn chậm khi hạ gục Elite `vengeful`.
- `packages/shared/src/sim/sim-dungeon-rooms.ts` & `packages/shared/src/sim/sim-progression-bot.ts` — Hồi sinh sau khi dọn phòng với `35%` HP (`Math.max(2, Math.ceil(p.maxHp * 0.35))`), cập nhật giá cửa hàng fallback (`25 / 40 / 60 / 45`), và triển khai cơ chế Đợt chồng nhau (Overlapping Waves: spawn đợt kế tiếp khi còn `<= 25%` quái của đợt hiện tại hoặc sau `12s`, tối đa 2 đợt chồng nhau cùng lúc, phát event `wave_started`).
- `apps/client/src/audio/music-synth.ts` & `apps/client/src/audio/zzfx.ts` — Tăng cường độ nhạc combat (`intensityBoost`) khi người chơi còn ít máu (`HP <= 30%`) hoặc khi Boss bước vào trạng thái Enrage mềm (`>= 90s`), thêm âm thanh còi báo động đợt quái (`wave_horn`) và tiếng gầm chuyển phase/enrage của Boss.
- `apps/client/src/ui/graphics-settings.ts` — Phát sự kiện toast khi `setFullscreen` thay đổi trạng thái hoặc khi `updateAutoQualityMonitor` tự động hạ mức đồ họa.
- `apps/client/src/scenes/game-scene/sim-events.ts`, `telegraphs-and-overlays.ts`, `hud-qol-and-minimap.ts`, `GameScene.ts` — Kết nối `p11-drama-hud.ts`, sửa `weapon_swapped` chỉ phát SFX khi `ev.playerId === sim.player.id`, hiển thị banner đợt quái, bộ đếm quái còn lại, hào quang bất tử chuyển phase / viền đỏ Boss Enrage, và toast thông báo Fullscreen / Auto-Quality.

---

### Task 1: Bước 1 — Honest Balance Harness, Locked Bot Profile (`tools/bot-profile.ts`), Cập Nhật `BALANCE.md` / `ART_GUIDE.md` & Chụp Ảnh `before` Cho `SCENE_GROUPS.p11`

**Files:**
- Create: `tools/bot-profile.ts`
- Modify: `tools/balance-simulations.ts`
- Modify: `tools/balance-harness.ts`
- Modify: `docs/BALANCE.md`
- Modify: `docs/ART_GUIDE.md`
- Create: `tests/e2e/helpers/visual-scene-p11-helpers.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Modify: `tools/run-shots.ts`
- Create: `packages/shared/test/polish-p11-bot-profile.test.ts`

- [ ] **Step 1: Đăng ký `SCENE_GROUPS.p11` và chụp ảnh `before` kèm `--verify-freeze`**
  - Tạo `tests/e2e/helpers/visual-scene-p11-helpers.ts` định nghĩa `P11_SCENE_IDS` và `P11_VISUAL_SCENES` gồm 9 cảnh (`p11-boss-phase-transition` kèm strip 8 frame, `p11-boss-enrage` kèm strip 8 frame, `p11-wave-overlap-challenge` kèm strip 8 frame, `boss-b1`, `boss-b2`, `boss-b3`, `b1-combat`, `b2-combat`, `b3-combat`).
  - Nối `p11: P11_SCENE_IDS` vào `SCENE_GROUPS` trong `tests/e2e/helpers/visual-scenes.ts` và thêm `'p11'` vào `tools/run-shots.ts`.
  - Chạy `pnpm shots -- --phase p11 --label before --group p11 --verify-freeze` để lưu bộ ảnh `docs/screenshots/polish-p11/before/` trước khi thêm bất kỳ thay đổi gameplay/hình ảnh nào của P11.

- [ ] **Step 2: Viết unit test (TDD RED) cho `tools/bot-profile.ts` và thống kê phân vị `p10`/`p50`/`p90`**
  - Tạo `packages/shared/test/polish-p11-bot-profile.test.ts` kiểm tra:
    - `AVERAGE_PLAYER_BOT_PROFILE` bị khóa cứng (`Object.isFrozen(AVERAGE_PLAYER_BOT_PROFILE) === true`), có `aimAccuracy` trong `[0.65, 0.75]`, `reactionDelaySec` trong `[0.20, 0.30]`, `dashDodgeProbability` trong `[0.60, 0.70]`, `godMode === false`, `infiniteEnergy === false`, và `seeds.length >= 30`.
    - Hàm `computeDistributionStats(values)` tính chính xác `p10`, `p50` (median), `p90`, `mean`, `min`, `max`.
    - Hàm `computeBotInputForPlayer` áp dụng độ trễ phản xạ `250ms` trước khi né telegraph, chỉ kích hoạt Dash với xác suất `dashDodgeProbability` (`65%`) theo RNG tất định, và tạo độ lệch ngắm tương ứng `aimAccuracy` (`70%`).

- [ ] **Step 3: Cài đặt `tools/bot-profile.ts` và nâng cấp `tools/balance-simulations.ts` & `tools/balance-harness.ts` (TDD GREEN)**
  - Trong `tools/bot-profile.ts`: định nghĩa và `Object.freeze` `AVERAGE_PLAYER_BOT_PROFILE`, danh sách 30 seed cố định, `computeDistributionStats`, và bộ điều khiển AI bot trung thực.
  - Trong `tools/balance-simulations.ts`:
    - Xóa toàn bộ `godMode = true`, `roomFactor`, `encounterScale`, hồi máu giả (`if (pl.hp <= 2 && pl.armor <= 0)`), và năng lượng vô hạn (`pl.energy = pl.maxEnergy`).
    - Đo thời gian dọn phòng combat thật trên `WorldSim`, phần trăm HP + Giáp mất mỗi phòng (`hpAndArmorLostPct`), tỉ lệ bị gục mỗi phòng (`downedCount`), thời gian đánh Boss thật và tỉ lệ thắng Boss ở Biome 1, 2, 3, kiểm tra không có đòn đánh nào gây one-shot (`maxSingleHitDamage < totalHpAndArmor`), và đo chỉ số độ khó thực tế giữa Biome 1 → 2 → 3.
  - Trong `tools/balance-harness.ts`:
    - Chạy đủ `30` seed cho mỗi cấu hình chính, tổng hợp `p50` (trung vị) kèm `p10–p90`, xuất báo cáo Markdown chi tiết theo bảng mục tiêu Mục 3.10.
    - Thêm cờ/tham số tùy chọn `enforceTargets = false` ở Bước 1 (hoặc xuất trạng thái thực tế của Bước 1 trước khi tune ở Bước 2 để không làm gãy `phase5-synergy.test.ts` giữa chừng, sau đó ở Task 2 bật kiểm tra nghiêm ngặt toàn bộ mục tiêu Mục 3.10).
  - Cập nhật `docs/BALANCE.md` (bảng mục tiêu Mục 3.10 + quy trình khóa `bot-profile.ts`) và sửa ghi chú `GOBLIN_GREEN` ở dòng 42 của `docs/ART_GUIDE.md`.

- [ ] **Step 4: Chạy test, kiểm tra giới hạn dòng `< 1000` và commit khóa `tools/bot-profile.ts`**
  - Chạy `npx vitest run packages/shared/test/polish-p11-bot-profile.test.ts` và `pnpm typecheck` + `pnpm lint`.
  - Commit Task 1 độc lập để khóa `tools/bot-profile.ts` trước khi bước sang Task 2.

---

### Task 2: Bước 2 — Các Đòn Bẩy Độ Khó Data-Driven, Boss Kháng CC / Chuyển Phase / Enrage, Trình Bày Kịch Tính & Tinh Chỉnh Cân Bằng Đạt Chuẩn 3.10

**Files:**
- Modify: `packages/shared/src/data/types.ts`
- Modify: `packages/shared/src/data/scaling.ts`
- Modify: `packages/shared/src/data/enemies.ts`
- Modify: `packages/shared/src/data/characters/index.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/world-sim-events.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/src/sim/dungeon-gen.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome1.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome2.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome3.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Create: `apps/client/src/scenes/game-scene/p11-drama-hud.ts`
- Modify: `apps/client/src/audio/music-synth.ts`
- Modify: `apps/client/src/audio/zzfx.ts`
- Modify: `apps/client/src/ui/graphics-settings.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-qol-and-minimap.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `packages/shared/test/polish-p11-bot-profile.test.ts` (hoặc mở rộng thành `polish-p11-balance-difficulty.test.ts`)
- Modify: `packages/shared/test/phase3-sim.test.ts`, `packages/shared/test/phase4-coop.test.ts`, `packages/shared/test/phase5-synergy.test.ts`
- Create: `tests/e2e/polish-p11.spec.ts`

- [ ] **Step 1: Viết unit tests (TDD RED) cho toàn bộ cơ chế độ khó & kịch tính P11**
  - Kiểm tra sửa lỗi nhân đôi tốc bắn co-op (`attackCooldownTimer` giảm đúng `dtSec` mỗi tick, tổng thời gian hồi chiêu ở 4P nhanh hơn 1P đúng theo `COOP_SCALING[4].enemyCooldownScale` một lần duy nhất).
  - Kiểm tra `BIOME_SCALING` cho Biome 1, 2, 3 (HP quái, tốc bắn/cooldown, elite bonus) áp dụng trong `spawnEnemyImpl` và `getEnemyCooldownScaleImpl` (không làm tăng HP của `kryssa_clone` `isIllusion` quá 30).
  - Kiểm tra `generateDungeonFloor` sinh đúng **4 phòng combat** mỗi tầng (3 phòng thường + 1 Phòng Thử Thách `isChallenge === true` có 3 đợt, mỗi đợt có Elite, thưởng rương cao hơn 1 bậc), số quái mỗi đợt `min(6, 4 + ...)`, xác suất Elite solo `22%` / `32%`, và giá shop mới (`health_potion: 25`, `weapon: 40/60`, `armor_upgrade: 45`).
  - Kiểm tra Đợt chồng nhau (Overlapping Waves): khi số quái còn sống của đợt hiện tại giảm xuống `<= 25%` HOẶC sau `12s` kể từ đầu đợt (và số đợt đang chồng `< 2`), đợt tiếp theo tự động spawn với vòng triệu hồi `0.8s` và phát event `wave_started`.
  - Kiểm tra 2 modifier Elite mới: `volley` (+2 viên đạn mỗi lượt bắn) và `vengeful` (khi chết để lại vòng cảnh báo telegraph `0.5s` rồi bắn 8 viên đạn chậm tỏa tròn).
  - Kiểm tra hồi giáp chậm hơn `+0.5s` cho cả 5 nhân vật và hồi sinh dọn phòng trả đúng `35%` HP (`Math.max(2, Math.ceil(p.maxHp * 0.35))`).
  - Kiểm tra Boss Kháng CC (đóng băng tối đa `0.6s`, giảm dần hiệu lực `0.6s → 0.3s → 0.15s` trong cửa sổ `8s`; phản ứng `paralysis` không ngắt `telegraph` của Boss ở Phase 3).
  - Kiểm tra Boss Chuyển Phase (`66%` / `33%` HP): đặt `bossPhaseTransitionTimer = 1.2` (bất tử trước đòn đánh thường trong `1.2s`), xóa đạn đang bay quanh Boss, phát event `boss_phase_changed`, và mở màn ngay bằng chiêu đặc trưng.
  - Kiểm tra Boss Enrage mềm sau `90s`: mỗi `15s` sau mốc `90s`, hệ số hồi chiêu nhân `×0.93` (sàn tối đa `×0.75`), tăng `bossEnrageLevel` và phát event `boss_enraged`.
  - Kiểm tra các helper hiển thị trong `p11-drama-hud.ts` (banner đợt quái, đếm quái còn lại, chỉ báo Boss enrage/chuyển phase, toast fullscreen & auto-quality, cường độ nhạc combat động).

- [ ] **Step 2: Cài đặt toàn bộ đòn bẩy gameplay & trình bày kịch tính (TDD GREEN) — KHÔNG sửa `tools/bot-profile.ts`**
  - Thực hiện các thay đổi trong `packages/shared/src/data/*`, `packages/shared/src/sim/*`, và `apps/client/src/*`.
  - Chạy `pnpm balance` lặp lại và tinh chỉnh các thông số data-driven (HP Boss, `BIOME_SCALING`, sát thương chọn lọc của Elite/Boss, tốc đạn/cooldown) cho đến khi `pnpm balance` (với `>= 30` seed/cấu hình và `tools/bot-profile.ts` đã khóa từ Task 1) **ĐẠT 100% tất cả các mục tiêu trong bảng Mục 3.10** và ghi báo cáo mới ra `docs/balance-report.md` + đồng bộ `docs/BALANCE.md`.
  - Cập nhật `tests/e2e/helpers/visual-scene-p11-helpers.ts` để các cảnh `p11-boss-phase-transition`, `p11-boss-enrage`, `p11-wave-overlap-challenge` kích hoạt đầy đủ hiệu ứng P11 mới khi chụp `after`.
  - Tạo `tests/e2e/polish-p11.spec.ts` kiểm tra E2E cho các tính năng P11 và bot autoplay vượt tầng.

- [ ] **Step 3: Chạy full unit test, E2E test và kiểm tra giới hạn `< 1000` dòng**
  - Chạy `pnpm --filter @ashen-pact/shared build`, `npx vitest run`, `pnpm typecheck`, `pnpm lint`, `npx playwright test tests/e2e/polish-p11.spec.ts`.
  - Khôi phục mọi ảnh screenshot cũ nếu bị E2E ghi đè (`git checkout -- docs/screenshots/phase-*`).
  - Commit Task 2.

---

### Task 3: Bước 3 — Visual Gate (`after` + Blind A/B Review `pro`), Full Verification & Git Tag `polish-p11`

**Files:**
- Modify: `docs/screenshots/polish-p11/after/*`
- Create: `docs/screenshots/polish-p11/review.md`
- Modify: `docs/balance-report.md`
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`

- [ ] **Step 1: Chụp bộ ảnh `after` và strip 8 frame cho `SCENE_GROUPS.p11` kèm `--verify-freeze`**
  - Chạy `pnpm shots -- --phase p11 --label after --group p11 --verify-freeze`.
  - Kiểm tra mọi cảnh đạt `diffRatio < 0.005` (`0.5%`) giữa 2 lượt chụp freeze và kiểm tra `docs/screenshots/polish-p11/after/metrics.json`.

- [ ] **Step 2: Tạo bộ Blind A/B ngẫu nhiên theo từng cảnh và điều phối `pro` Visual Reviewer độc lập**
  - Tạo `docs/screenshots/polish-p11/blind-ab/version-A` và `version-B` ngẫu nhiên độc lập theo từng cảnh (cô lập `ab-mapping.json` ra ngoài thư mục `blind-ab/` trong lúc review).
  - Điều phối subagent `research` (`model: 'pro'`) chỉ đọc ảnh, strip 8 frame và `metrics.json` (không đọc code) để chấm điểm theo Rubric Mục 6.
  - Lưu báo cáo vào `docs/screenshots/polish-p11/review.md` (yêu cầu `PASS`, `0` Blocker, `0` Major, mọi tiêu chí mục tiêu `>= 8.0/10`). Nếu có vấn đề thị giác thì điều phối implementer sửa và chụp lại cho đến khi `PASS`.

- [ ] **Step 3: Chạy cổng chất lượng toàn diện (`pnpm balance`, `pnpm verify`, `pnpm perf`), cập nhật tài liệu kèm Checklist Test Tay và gắn tag `polish-p11`**
  - Chạy `pnpm balance`, `pnpm verify` (`typecheck`, `lint`, `test`, `build`, `e2e`) và `pnpm perf`.
  - Cập nhật `docs/PROGRESS.md` (bao gồm kết quả P11 và **Checklist Test Tay Độ Khó & Kịch Tính** theo yêu cầu Mục 4.P11) và `docs/PHASES.md`.
  - Commit và gắn git tag `polish-p11`.
