# Ashen Pact 2.0 — Phase P2B: Hệ Thống "Khế Ước Tro Tàn" (`1 Tế Đàn / Biome — Full-Biome Trial`) & 6 Di Vật Thức Tỉnh (`ap2-p2b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài đặt hệ thống **Tế Đàn Khế Ước Tro Tàn (`1 Tế Đàn / Biome` tại Tầng Lẻ `1, 3, 5`)**: lời nguyền kéo dài xuyên suốt cả 2 tầng của Biome (bao gồm trận Boss cuối Biome ở Tầng Chẵn `2, 4, 6`) và ngay khi hạ Boss sẽ Thanh Tẩy Khế Ước thành **Di Vật Thức Tỉnh Vĩnh Viễn (`Awakened Ashen Relic`)**, đầy đủ 6 Khế Ước / 6 Di Vật (`pact_soul_chain`, `pact_shattered_glass`, `pact_searing_trigger`, `pact_volatile_arsenal`, `pact_ashen_hunted` kèm `Bóng Ma Đao Phủ`, `pact_ricochet_vow`), giao diện Modal Tế Đàn, Rig/VFX và bộ cảnh chụp/strip (`ap2-p2b`).

---

## Task 1 (`P2B.1`): Vòng Đời Tế Đàn Khế Ước (`1 Tế Đàn / Biome`) & Chuyển Hóa Khi Hạ Boss Biome
- [ ] Tại phòng `shrine` ở Tầng 1 của mỗi Biome (`globalFloor = 1, 3, 5`), tương tác `[E]` với Tế Đàn Khế Ước rút 2 lựa chọn Khế Ước (loại trừ Khế Ước đã lấy ở Biome trước) hoặc Khước Từ; đồng bộ `select_pact` theo `meta.playerId`.
- [ ] Giữ nguyên `p.activePactId` xuyên suốt Tầng Lẻ sang Tầng Chẵn và trong trận đánh Boss cuối Biome; ngay khi hạ Boss (`onBossDefeated`), xóa `p.activePactId = null`, thêm Di Vật tương ứng vào `p.awakenedRelicIds` và phát sự kiện thức tỉnh.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2b-pact-lifecycle.test.ts`.

## Task 2 (`P2B.2`): Cài Đặt 3 Khế Ước & Di Vật Đầu Tiên: `pact_soul_chain`, `pact_shattered_glass`, `pact_searing_trigger`
- [ ] `pact_soul_chain` -> `relic_blood_oath_tether`: nối dây xích với đồng đội gần nhất (hoặc quái `maxHp` cao nhất khi Solo), quá `260px` lâu hơn `2.5s` rút `1 Giáp` mỗi `2.5s`; thức tỉnh thành Tia Laser Lửa-Sét (`base 22 DMG/s`).
- [ ] `pact_shattered_glass` -> `relic_black_crystal_heart`: giảm `50% maxArmor` (tối thiểu `1`), `+20%` tốc chạy; thức tỉnh khôi phục `maxArmor` (`+0.8s` regen delay) và cấp `+65% Additive DMG` + xuyên khiên sau `Perfect Reload / Vent [R]` / Đòn 3 cận chiến.
- [ ] `pact_searing_trigger` -> `relic_perpetual_core`: bấm `[R]` trượt khung vàng hoặc Quá Nhiệt `100%` mất `1 Giáp` + khóa cò thêm `0.4s`; thức tỉnh mở rộng khung vàng `+25%` và phóng 3 Tên Lửa Tro Tàn (`base 20 DMG Lửa/quả`) mỗi khi `Perfect Reload / Vent [R]`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2b-pacts-1-3.test.ts`.

## Task 3 (`P2B.3`): Cài Đặt 3 Khế Ước & Di Vật Còn Lại: `pact_volatile_arsenal`, `pact_ashen_hunted`, `pact_ricochet_vow`
- [ ] `pact_volatile_arsenal` -> `relic_master_forge_seal`: lưu `pactOriginalWeaponId`, biến hình súng sau mỗi đợt quái hoặc mỗi `20.0s` trong phòng Boss; thức tỉnh khôi phục `pactOriginalWeaponId` + nâng `upgradeLevel + 1` (`+20% Base DMG`) + gắn miễn phí `+1 Weapon Mutator`.
- [ ] `pact_ashen_hunted` -> `relic_executioner_scythe`: sinh tối đa 1 `Bóng Ma Đao Phủ (ashen_executioner)` bất tử truy sát người ký; thức tỉnh triệu hồi Đao Phủ chém Lưỡi Hái Chữ Thập (`base 45 DMG`, kết liễu quái thường `<= 20% HP`) mỗi khi dùng Kỹ năng hoặc `Wall-Slam` (`ICD = 4.0s`).
- [ ] `pact_ricochet_vow` -> `relic_ancient_geometry_eye`: đạn bắn thẳng (`bounceCount === 0`) `-35% DMG`, đạn nảy / `Wall-Slam` / Đồ chơi `+70% Additive DMG` & `+1` nảy; thức tỉnh giảm phạt còn `-10%`, nhận `+1 Smart Bounce`, `+55% Additive DMG` đạn nảy & `+35% Wall-Slam`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p2b-pacts-4-6.test.ts`.

## Task 4 (`P2B.4`): Giao Diện Modal Tế Đàn Khế Ước, Huy Hiệu Lời Nguyền/Di Vật Trên HUD & Rig/VFX `Bóng Ma Đao Phủ`
- [ ] Mở rộng `hud-pact-and-forge-modals.ts`, vẽ Rig Cutout 2.0 cho `ashen_executioner`, dây xích linh hồn và tia laser Huyết Thệ.

## Task 5 (`P2B.5`): Xây Dựng Cảnh Chụp Kiểm Chứng Tế Đàn Khế Ước, Bóng Ma Đao Phủ & Di Vật Thức Tỉnh (`visual-scene-ap2-p2.ts`)
- [ ] Bổ sung 6 cảnh (`ap2-shrine-ashen-altar`, `ap2-modal-ashen-pact-vi`, `ap2-modal-ashen-pact-en`, `ap2-pact-soul-chain-stretch` strip, `ap2-pact-ashen-executioner` strip, `ap2-relic-awakening-banner` strip) vào `visual-scene-ap2-p2.ts`.

## Task 6 (`P2B.6`): Visual Gate & Phase Gate `P2B`
- [ ] Chạy `pnpm shots -- --phase ap2-p2b --label after --group ap2-p2b`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p2b`.
