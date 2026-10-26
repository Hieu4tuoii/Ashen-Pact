# Ashen Pact 2.0 — Phase P1B: Kho Vũ Khí Độc Bản Đợt 2 & 3-Bucket Damage Pipeline (`ap2-p1b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đủ **18/18 Vũ Khí Độc Bản** với 7 vũ khí Đợt 2 (`focus_laser`, `void_staff`, `emerald_cleaver`, `berserker_axe`, `solar_archon_staff`, `magma_cannon`, `thunder_hammer`) và cài đặt khóa chặt **3-Bucket Damage Pipeline** (`packages/shared/src/sim/sim-damage-pipeline.ts`) kèm Property-Based Unit Test chứng minh không bao giờ nổ số nhân (`M_AdditivePool <= 3.80`, `splitGeneration <= 1`, tổng hệ số nhân 1 đòn trên Boss `<= 18.0x`).

**Architecture:** Tách toàn bộ công thức sát thương 3-Bucket sang `packages/shared/src/sim/sim-damage-pipeline.ts` (`< 400 dòng`), bổ sung cơ chế 7 vũ khí đợt 2 vào `sim-weapon-specials-b.ts` (`< 650 dòng`), mở rộng VFX và bộ 7 cảnh strip 8-frame trong `visual-scene-ap2-p1.ts`.

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`).

---

## Task 1 (`P1B.1`): Cài Đặt Vũ Khí Rare & Epic Tầm Xa: `focus_laser` & `void_staff`
- [ ] `focus_laser` (`HEAT_VENT`, DMG tia tăng `4 -> 11` mỗi `0.15s`, `Lửa`, tầm `520px`, `procCoeff = 0.25/nhịp`): tia laser liên tục khúc xạ thành 3 tia quạt qua `cryo_prism_pillar` hoặc Khiên Thiết Vệ; nhấn `[R]` Xả Áp (`65%–95%` Nhiệt) phóng Pháo Railgun Tức Thời (`46 DMG Lửa`, xuyên toàn phòng) rồi đưa nhiệt về `0%`.
- [ ] `void_staff` (`CLIP_RELOAD`, Băng `2 Cầu Hố Đen`, Nạp `1.05s`, tốc đạn `320 px/s`, hút `12 DMG/nhịp`, nổ Implosion `52 DMG Độc`, `procCoeff = 1.00`): hút quái và nuốt đạn địch trong `r=110px` (đẩy `projectiles_destroyed`); buông chuột trái (`Hold-and-Release Implosion`) hoặc hết tầm nổ `52 DMG Độc` (`+6 DMG` mỗi viên đạn địch đã nuốt, tối đa `+36 DMG`), gom quái vào một điểm.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1b-ranged-weapons.test.ts`.

## Task 2 (`P1B.2`): Cài Đặt Hai Vũ Khí Epic Cận Chiến (`MELEE_COMBO` 3 Đòn + `Parry Deflect`): `emerald_cleaver` & `berserker_axe`
- [ ] `emerald_cleaver` (`MELEE_COMBO`, DMG 3 đòn: `22 -> 26 -> 32 Boomerang`, `Độc`, `procCoeff = 0.85`): Đòn 1 & 2 chém cung rộng `135°` áp Độc; Đòn 3 (`Parry Deflect 0.18s`) ném xoay Đại Đao tới con trỏ (`280px`), xoay tròn `0.40s` phản tối đa 3 đạn địch rồi bay ngược về vị trí người chơi (`32 DMG`, kéo quái theo đường về).
- [ ] `berserker_axe` (`MELEE_COMBO`, DMG 3 đòn: `24 -> 30 -> 52 Đoạn Đầu Đài`, `Lửa`, `procCoeff = 0.80`): mỗi đòn trúng cộng dồn Huyết Nộ tăng tốc đánh (tối đa `+35%`, thêm `+15%` khi mất Giáp); Đòn 3 (`Parry Deflect 0.18s`) nhảy vọt `96px` bổ Đoạn Đầu Đài (`52 DMG Lửa`), đập vỡ ngay khiên `iron_shielder`, tạo vệt nứt lửa dài `160px`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1b-melee-weapons.test.ts`.

## Task 3 (`P1B.3`): Cài Đặt Bộ Ba Vũ Khí Huyền Thoại (`Legendary`): `solar_archon_staff`, `magma_cannon` & `thunder_hammer`
- [ ] `solar_archon_staff` (`HEAT_VENT`, `15 × 3 tia hội tụ Lửa`, vệ tinh chạm `12 DMG` với ICD `0.40s/quả`, nổ Siêu Tân Tinh `[R]`: `68 DMG`): 3 Mặt Trời Nhỏ xoay quanh người chơi, mỗi phát bắn phóng 3 tia lửa hội tụ tại con trỏ (`r=52px`); nhấn `[R]` Xả Áp (`65%–95%` Nhiệt) lao 3 Mặt Trời vào con trỏ nổ Siêu Tân Tinh (`68 DMG Lửa`, `r=120px`) + vùng Lửa Thái Dương `3.5s`.
- [ ] `magma_cannon` (`CLIP_RELOAD`, Băng `3 Nham Cầu`, Nạp `1.25s`, `38 DMG Lửa`, `kb = 280`, `procCoeff = 1.00`): bắn Khối Đá Nham Thạch (`r=20px`, `420 px/s`) lăn ủi quái đập tường (`Wall-Slam`) + trải Thảm Dung Nham rộng `48px` (`3.5s`); `Finale Shot` & `Perfect Reload [R]` phun 4 Vòi Dung Nham (`22 DMG/vòi`).
- [ ] `thunder_hammer` (`MELEE_COMBO`, DMG 3 đòn: `30 -> 34 -> 54 Cột Lôi Đình`, `Sét`, `kb = 320`): Đòn 1 & 2 `knockback = 320`; Đòn 3 (`Parry Deflect 0.18s`) đập búa tạo Cột Thu Lôi, đánh bật 3 đạn địch thành tia sét và giáng 3 tia sét lớn (`54 DMG Sét`, `r=110px`).
- [ ] Viết unit test TDD `packages/shared/test/ap2-p1b-legendary-weapons.test.ts`.

## Task 4 (`P1B.4`): Cài Đặt `3-Bucket Damage Pipeline` & Kiểm Toán Toán Học Chống Nổ Số Nhân (`sim-damage-pipeline.ts`)
- [ ] Tạo `packages/shared/src/sim/sim-damage-pipeline.ts` cài đặt `computeThreeBucketDamage`, `computeAdditivePoolMultiplier`, `computeEnemyVulnerabilityMultiplier`, `scaleBlessingDamage`, `splitGeneration: 0 | 1`, `MAX_PELLETS_PER_TRIGGER = 9`, `MAX_BOUNCE_COUNT = 4`.
- [ ] Viết Property-Based Unit Test `packages/shared/test/ap2-damage-pipeline.test.ts` kiểm toán hàng ngàn tổ hợp cộng dồn (`M_AdditivePool <= 3.80`, `splitGeneration === 1` không sinh thêm đạn con, tổng hệ số nhân trên Boss `<= 18.0x`).

## Task 5 (`P1B.5`): Procedural VFX Cho 7 Vũ Khí Đợt 2 & Bộ Cảnh Chụp Strip 8-Frame (`visual-scene-ap2-p1.ts`)
- [ ] Vẽ VFX cho 7 vũ khí đợt 2, cập nhật `ArtGalleryScene` hiển thị đúng 18 vũ khí độc bản, và tạo 7 cảnh strip 8 frame (`ap2-wep-laser-railgun`, `ap2-wep-cleaver-boomerang`, `ap2-wep-void-implosion`, `ap2-wep-axe-guillotine`, `ap2-wep-solar-supernova`, `ap2-wep-magma-geysers`, `ap2-wep-hammer-thunder`).

## Task 6 (`P1B.6`): Visual Gate & Phase Gate `P1B`
- [ ] Chạy `pnpm shots -- --phase ap2-p1b --label after --group ap2-p1b`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p1b`.
