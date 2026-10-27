# Ashen Pact 2.0 — Phase P1A: Kho Vũ Khí Độc Bản Đợt 1 (`ap2-p1a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cài đặt hoàn chỉnh **7 Vũ Khí Độc Bản Đợt 1** (2 vũ khí khởi đầu còn lại `hunter_crossbow`, `thorn_staff`; 3 vũ khí Uncommon `scrap_shotgun`, `gale_smg`, `frag_launcher`; 2 vũ khí Rare `seed_gun`, `tether_staff`) với cơ chế tương tác chủ động, VFX procedural, âm thanh ZzFX, bộ 7 cảnh strip chuyển động 8 frame (`ap2-p1a`), và kiểm thử TDD 100%.

**Architecture:** Mở rộng `packages/shared/src/sim/sim-weapon-specials.ts` (hoặc tách thêm `sim-weapon-specials-b.ts` nếu vượt `600 dòng`) và `apps/client/src/fx/combat-fx-weapons-v2.ts`, tạo mới `tests/e2e/helpers/visual-scene-ap2-p1.ts` cho bộ cảnh chụp `ap2-p1a`.

**Tech Stack:** TypeScript 5.x, Vitest, Phaser 3, Colyseus 60Hz deterministic simulation, Playwright visual verification (`pnpm shots`, `tools/visual-metrics.ts`).

---

## Task 1 (`P1A.1`): Hai Vũ Khí Khởi Đầu Còn Lại: `hunter_crossbow` (Liệp Ưng) & `thorn_staff` (Mộc Linh)
- [x] Cài đặt `hunter_crossbow` (`CLIP_RELOAD`, Băng `4`, Nạp `0.95s`, `15 DMG`, giữ cò `0.35s`: `22 DMG` xuyên 2, `kb=220`, `procCoeff = 1.00`): mỗi mũi tên cắm lại trên thân quái (`e.stuckArrows`, tối đa 4); `Finale Shot` hoặc `Perfect Reload [R]` giật dây rút toàn bộ mũi tên gây `6 DMG × số mũi` + làm chậm `30%` trong `1.5s`.
- [x] Cài đặt `thorn_staff` (`CLIP_RELOAD`, Băng `5`, Nạp `1.00s`, `11 DMG`, `Finale: 17 DMG Độc`, tầm `240px`, `procCoeff = 0.75`): quất dây gai xuyên hàng quái cắm `1 Gai Ký Sinh` (`e.parasiticThorns`, tối đa 5); `Finale Shot` kéo giật kẻ địch ở cuối tầm ngược về trước mặt `90px`; `Perfect Reload [R]` hoặc sau `Finale Shot` kích nổ toàn bộ Gai Ký Sinh gây `7 DMG Độc × số gai`.
- [x] Viết unit test TDD `packages/shared/test/ap2-p1a-starter-weapons.test.ts`.

## Task 2 (`P1A.2`): Bộ Ba Vũ Khí Uncommon: `scrap_shotgun`, `gale_smg` & `frag_launcher`
- [x] Cài đặt `scrap_shotgun` (`CLIP_RELOAD`, Băng `2`, Nạp `0.85s`, `5 × 6 mảnh = 30 DMG`, `kb = 250`, `procCoeff = 0.22`): Point-Blank (`dist <= 96px` nhân `×1.35 DMG` + `Wall-Slam`); `Finale Shot` bắn phế liệu nóng đỏ (`+50% Additive DMG`, áp `Lửa`); `Perfect Reload [R]` hất 2 vỏ đạn nóng gây `16 DMG Lửa` + khựng `0.3s`.
- [x] Cài đặt `gale_smg` (`HEAT_VENT`, `5 DMG`, Spin-up `6.0 -> 10.5/s`, `heatPerShot = 3.0%`, `procCoeff = 0.25`): giữ cò tăng tốc bắn + `+15%` tốc chạy; ở Nhiệt Cam (`65%–95%`) mỗi viên thứ 6 phóng kèm Lưỡi Gió Xuyên Thấu (`14 DMG`, `kb=140`); `Tactical Vent [R]` nổ Cơn Lốc Xoáy (`r=96px`, `24 DMG`) xóa đạn sát thân & hất văng quái `Wall-Slam`.
- [x] Cài đặt `frag_launcher` (`CLIP_RELOAD`, Băng `3`, Nạp `1.10s`, nổ chính `22 DMG Lửa` `r=68px`, 5 mảnh con `× 6 DMG` tối đa 2 mảnh/mục tiêu): nảy 1 nhịp rồi nổ; hỗ trợ **Hold-and-Release Airburst** (buông chuột trái khi lựu đạn đang bay kích nổ ngay trên không `r=104px` vòng qua sau lưng khiên `iron_shielder`).
- [x] Viết unit test TDD `packages/shared/test/ap2-p1a-uncommon-weapons.test.ts`.

## Task 3 (`P1A.3`): Hai Vũ Khí Rare: `seed_gun` & `tether_staff`
- [x] Cài đặt `seed_gun` (`CLIP_RELOAD`, Băng `4`, Nạp `1.00s`, `13 DMG Độc`, `2.4/s`, `procCoeff = 0.80`): mỗi phát gieo `1 Nụ Hoa Sinh Mệnh` (tối đa 4 nụ, rỉa `6 DMG Độc/s`); `Finale Shot` hoặc `Perfect Reload [R]` nở rộ gây `24 DMG Độc` + Trói chân `1.0s` (`r=88px`), và **chỉ khi nở trúng ít nhất 1 quái đang sống** mới bung Sương Hồi Phục (`+1 Giáp`, hồi `+1 HP` với ICD `12.0s/người`, tối đa 2 lần/phòng).
- [x] Cài đặt `tether_staff` (`HEAT_VENT`, `11 DMG / 0.25s Sét`, `heatPerSec = 22%/s`, tầm `280px`, `procCoeff = 0.28`): gắn đầu neo vào Đồng đội / Summon / Bia Chắn Lật Được / Quái đầu tiên, tạo Dây Cắt Sét Cao Thế; `Tactical Vent [R]` thu ngắn dây kéo giật toàn bộ quái chạm dây gom về điểm neo rồi phát nổ `32 DMG Sét`.
- [x] Viết unit test TDD `packages/shared/test/ap2-p1a-rare-weapons.test.ts`.

## Task 4 (`P1A.4`): Procedural VFX & Audio Cho 7 Vũ Khí Đợt 1 (`combat-fx-weapons-v2.ts` & `room-entities-sync.ts`)
- [x] Vẽ mũi tên cắm & tia giật rút tên (`hunter_crossbow`), dây gai `240px` & gai ký sinh nở (`thorn_staff`), phế liệu nóng đỏ & vỏ đạn văng (`scrap_shotgun`), lưỡi gió & lốc xoáy `[R]` (`gale_smg`), vòng nổ trên không `Airburst` (`frag_launcher`), nụ hoa & sương hồi phục (`seed_gun`), dây cắt sét & xung kéo `[R]` (`tether_staff`).

## Task 5 (`P1A.5`): Xây Dựng Cảnh Chụp & Strip 8-Frame Cho 7 Vũ Khí Đợt 1 (`tests/e2e/helpers/visual-scene-ap2-p1.ts`)
- [x] Tạo 7 cảnh strip 8 frame: `ap2-wep-crossbow-rip`, `ap2-wep-thorn-pull`, `ap2-wep-shotgun-wallslam`, `ap2-wep-gale-vent`, `ap2-wep-frag-airburst`, `ap2-wep-seed-bloom`, `ap2-wep-tether-pull`.

## Task 6 (`P1A.6`): Visual Gate & Phase Gate `P1A`
- [x] Chạy `pnpm shots -- --phase ap2-p1a --label after --group ap2-p1a`, chấm qua Visual Reviewer (`pro` `10.0/10.0 PASS`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p1a`.
