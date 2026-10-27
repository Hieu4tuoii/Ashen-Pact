# DANH SÁCH KIỂM TRA CÁC PHASE (PHASES.md) — ASHEN PACT

> Quy tắc: Mỗi phase chỉ được đánh dấu hoàn thành `[x]` khi đạt 100% Definition of Done (DoD) chung và riêng, `pnpm verify` xanh, 0 console error/warning, FPS đạt mục tiêu và có đầy đủ screenshot tại `docs/screenshots/phase-N/`.

## DoD Chung Cho Mọi Phase
- [x] `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e` smoke) xanh 100%
- [x] 0 lỗi / warning trong console trình duyệt khi chạy E2E
- [x] FPS mục tiêu đạt (~60 FPS, đo qua `window.__GAME_DEBUG__`)
- [x] Screenshot lưu tại `docs/screenshots/phase-N/` và đã tự review bằng mắt theo `ART_GUIDE.md`
- [x] Cập nhật `docs/PROGRESS.md` và `docs/PHASES.md`
- [x] `git commit` (Conventional Commits) + `git tag phase-N`

---

## Phase 0 — Nền móng & Thiết kế (Hoàn thành ✅)
- [x] Init git, monorepo (`pnpm` workspaces), TypeScript `strict`, ESLint/Prettier, Vitest, Playwright, scripts `dev/build/test/e2e/verify`.
- [x] Viết đầy đủ `docs/GDD.md`, `docs/TECH.md`, `docs/ART_GUIDE.md`, `docs/BALANCE.md`, `docs/PHASES.md`, `docs/PROGRESS.md`, `CREDITS.md`.
- [x] Dựng nền móng thư viện vẽ `apps/client/src/art/` (palette 42 màu, primitives, `outlined()`, bake texture theo DPR, rig cutout + animation tham số) và scene `ArtGallery`; vẽ **1 nhân vật mẫu (Thiết Vệ) + 1 quái mẫu (Goblin Xạ Thủ)** với animation `idle` / `run` để chốt style.
- [x] Khung client Phaser (scene `Boot`, `Preload`, `Menu`, `Game`, `ArtGallery`), khung server Colyseus "hello room", package `packages/shared` với PRNG + fixed timestep loop + debug overlay `F1` + `window.__GAME_DEBUG__`.
- [x] **DoD riêng Phase 0:**
  - [x] `pnpm dev` chạy được client + server
  - [x] Scene trống / Game / ArtGallery đạt ~60 FPS (`60.2 FPS` / `16.61 ms`)
  - [x] Test E2E smoke pass (0 console errors/warnings)
  - [x] Render đúng chuỗi tiếng Việt có dấu: `"Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ"`
  - [x] Screenshot `ArtGallery` ở 1080p và 1440p cho thấy nhân vật/quái mẫu nét sắc, không răng cưa, không mờ, đúng `ART_GUIDE.md`

---

## Phase 1 — Core Gameplay & Game Feel (Solo, Phòng Thử Nghiệm) (Hoàn thành ✅)
- [x] Simulation trong `packages/shared` + `LocalTransport`; render interpolation.
- [x] Di chuyển có gia tốc, dash i-frame, ngắm chuột, camera lookahead, crosshair vẽ bằng code.
- [x] Nhân vật Thiết Vệ (animation cơ bản), 4 vũ khí mẫu (súng lục, shotgun, SMG, kiếm), đạn + va chạm tile + spatial hash grid.
- [x] 3 quái mẫu (bắn xa, lao húc, nổ) với AI cơ bản + telegraph.
- [x] HP/Giáp/Năng lượng, damage, knockback, hit flash, hit-stop, screen shake, số damage, SFX cơ bản (ZzFX).
- [x] **DoD riêng Phase 1:** Phản hồi input < 1 frame, không giật camera, chuyển động mượt ở 60/144Hz, bắn trúng có đủ flash + spark + âm + số damage + knockback; unit test cho damage/giáp/va chạm.

---

## Phase 2 — Pipeline Hình Ảnh & Tương Tác Map (Hoàn thành ✅)
- [x] Tilemap vẽ bằng code (bake tile + biến thể theo seed) + autotile, tường có chiều sâu/bóng; hệ ánh sáng lightmap + bloom + vignette + color grading.
- [x] Hệ particle (pool), decal bền, bóng đổ, ambient (lá/sương), afterimage dash.
- [x] Đồ vỡ được, thùng nổ, bề mặt nước/dầu/cỏ/đầm độc/dung nham/băng, trạng thái nguyên tố cơ bản (Cháy/Lạnh/Sét/Độc) + tương tác bề mặt.
- [x] Cài đặt chất lượng đồ họa + auto quality.
- [x] **DoD riêng Phase 2:** Stress test (4 người chơi giả lập + 80 quái + 600 đạn + particle) giữ ≥ 60 FPS ở 1080p High, không rò rỉ bộ nhớ (3 phút); screenshot ánh sáng động.

---

## Phase 3 — Dungeon, Vòng Lặp Lượt Chơi & Biome 1 Hoàn Chỉnh (Vertical Slice Solo) (Hoàn thành ✅)
- [x] Sinh tầng procedural theo seed (đảm bảo liên thông — có unit test), các loại phòng, cửa khóa + đợt quái + vòng triệu hồi, minimap + fog of war, dịch chuyển giữa tầng.
- [x] Vũ khí ~12 cái (14 vũ khí đủ 5 bậc hiếm), rương theo độ hiếm, xu + thương nhân + tượng thần, phòng bí mật, buff giữa tầng.
- [x] Toàn bộ quái + Elite biome 1, Boss Mục Vương đầy đủ 3 phase, màn hình thắng/thua/kết quả.
- [x] Thay toàn bộ placeholder bằng hình vẽ code hoàn chỉnh cho mọi entity/tile/icon của biome 1; cập nhật `ArtGallery`.
- [x] **DoD riêng Phase 3:** Chơi trọn biome 1 solo không lỗi; E2E bot tự đi qua 1 tầng bằng debug mà không crash; screenshot từng loại phòng + boss.

---

## Phase 4 — Co-op LAN (Hoàn thành ✅)
- [x] Host server (Colyseus) chạy sim authoritative + phục vụ client tĩnh cùng cổng, `NetworkTransport`, prediction + reconciliation, interpolation thích ứng, đạn tất định, giả lập mạng wifi.
- [x] Lệnh `pnpm host`, hiển thị IP LAN + mã QR + nút sao chép link trong Hub; ô nhập IP thủ công ở menu.
- [x] Hub nhiều người, chọn nhân vật, sẵn sàng, reconnect, xử lý Host thoát.
- [x] Scaling theo số người, gục/hồi sinh/linh hồn, loot instanced, ping + emote, dịch chuyển người ở ngoài vào phòng chiến đấu, màu định danh người chơi.
- [x] **DoD riêng Phase 4:** E2E với 4 client kết nối qua địa chỉ IP LAN của máy, cùng vào Hub, qua 1 tầng; mượt dưới profile "wifi tệ"; băng thông ≤ ~30 KB/s/client; Host ≥ 60 FPS; unit test scaling; checklist test tay trên 2+ máy thật trong `PROGRESS.md`.

---

## Phase 5 — 5 Nhân Vật, Hệ Nguyên Tố & Synergy (Hoàn thành ✅)
- [x] Hoàn thiện đủ 5 nhân vật (animation riêng, VFX skill, SFX riêng), 2 nâng cấp mỗi skill, phản ứng nguyên tố đầy đủ + Team Combo, preview kỹ năng ở Hub.
- [x] Balance harness headless xuất `docs/balance-report.md`.
- [x] **DoD riêng Phase 5:** Đạt mọi mục tiêu mục 7.4; unit test từng phản ứng nguyên tố; mỗi nhân vật solo qua được boss biome 1 trong harness; test co-op 2 và 4 người.

---

## Phase 6 — Biome 2 & 3 + Boss (Hoàn thành ✅)
- [x] Tileset vẽ bằng code, ánh sáng, ambient, quái, Elite, cơ chế map riêng (băng trơn, băng chuyền, máy sửa được), nâng tổng vũ khí lên ~24.
- [x] Boss Băng Hậu Kryssa và Titan Lò Rèn đầy đủ phase + cơ chế co-op + biến thể theo số người.
- [x] **DoD riêng Phase 6:** Chơi trọn 3 biome solo và 4 người (bot/debug) không crash; boss TTK đạt mục tiêu theo harness; stress test ở biome 3 ≥ 60 FPS.

---

## Phase 7 — UI/UX & Âm Thanh Hoàn Thiện (Hoàn thành ✅)
- [x] Menu chính động, HUD hoàn chỉnh, Settings đầy đủ, màn hình kết quả + MVP, chuyển cảnh, tooltip/hướng dẫn, i18n `vi`/`en`.
- [x] Bộ SFX đầy đủ, nhạc động khám phá/chiến đấu/boss, âm thanh định vị, voice limit.
- [x] **DoD riêng Phase 7:** Mọi luồng UI đi được bằng chuột không kẹt; không có chuỗi chưa dịch; mọi hành động gameplay đều có âm thanh; screenshot tất cả màn hình UI.

---

## Phase 8 — Cân Bằng Cuối, Hiệu Năng, QA & Bản Phát Hành (Hoàn thành ✅)
- [x] Chạy lại harness + điều chỉnh; soak test 20 phút; kiểm tra Chrome/Edge/Firefox.
- [x] Bug bash theo checklist (`docs/QA_CHECKLIST.md`).
- [x] Build production + đóng gói Host app cho Windows (`AshenPact-Host.exe` + `start-host.bat` + `allow-firewall-port-2567.bat`), thư mục release zip sạch (`release/AshenPact-v0.1.0-win-x64.zip`).
- [x] `README.md` tiếng Việt + hướng dẫn Windows Firewall + AP Isolation, `CREDITS.md` đầy đủ, `docs/RELEASE_NOTES.md`, `git tag phase-8` & `git tag v0.1.0`.

---

## Giai đoạn Polish v0.2.0

| Phase | Nội dung | Yêu cầu gốc | Trạng thái |
|---|---|---|---|
| P0 | Hạ tầng chụp ảnh/metrics/reviewer + baseline | Kiểm chứng bằng hình ảnh | [x] |
| P1 | Chế độ debug, dọn UI debug | Ẩn debug trong .exe | [x] |
| P2 | Vũ khí 2 ô + rơi vũ khí | 2 vũ khí, đổi thì rơi | [x] |
| P3 | Nền ánh sáng, PostFX, `HudScene`, camera không méo | Map dễ nhìn, ánh sáng | [x] |
| P4 | **Phòng chuẩn B1** (vertical slice) → Palette ENV, sàn, tường, surface cho mọi biome | Map đẹp, giảm tương phản | [x] |
| P5 | Trang trí biome còn lại, chậu lửa | Map đẹp, nguồn sáng đuốc | [x] |
| P6 | Đèn/glow vật thể tương tác | Nguồn sáng cho rương/đuốc/cổng/vật phẩm | [x] |
| P7 | Nhãn theo khoảng cách, prompt [E] | Gần mới hiện [E] tên | [x] |
| P8 | Cổng dịch chuyển & cổng qua phòng | Cổng đẹp, sáng ảo diệu | [x] |
| P9a | Design system, HUD trong game | UI/UX hiện đại (HUD) | [x] |
| P9b | Menu, Hub, modal, Pause, Settings, kết quả | UI/UX hiện đại (Screens/Modals) | [x] |
| P10a | Nhân vật Cutout 2.0 & Quái Full Rig: animation, shading 2 lớp & rim-light | Chi tiết, mượt, đẹp (Rig) | [x] |
| P10b | FX, Phản Ứng Nguyên Tố & Hạt Môi Trường Trong Trẻo | Chi tiết, mượt, đẹp (FX) | [x] |
| P11 | Harness thật + độ khó + kịch tính | Khó và kịch tính hơn | [x] |
| P12 | Hồi quy, hiệu năng, release v0.2.0 | Chất lượng sản phẩm | [x] |

---

## Giai đoạn Đại Tu Ashen Pact 2.0 — Tactical Arena Overhaul (`v0.2.1` → `v2.0.0`)

| Phase | Tag | Nội dung | Trạng thái |
|---|---|---|---|
| P0A | `ap2-p0a` | Nền tảng Dữ liệu, Giao thức Mạng 30Hz, Xóa Năng Lượng & Dọn Dẹp 18 Vũ Khí | [x] |
| P0B | `ap2-p0b` | Lát Cắt Dọc Core Fun: 3 Archetype Phòng, Vật Lý Chiến Thuật, Biome 1 & 4 Vũ Khí Chuẩn (Playtest Gate 1) | [x] |
| P1A | `ap2-p1a` | Đại Tu Vũ Khí Đợt 1 (7 Vũ Khí: Nỏ, Trượng Gai, Shotgun, SMG, Súng Lựu, Súng Hạt Giống, Trượng Xích) | [x] |
| P1B | `ap2-p1b` | Đại Tu Vũ Khí Đợt 2 (7 Vũ Khí Còn Lại) & Pipeline Sát Thương 3 Nhóm (3-Bucket Damage Cap) | [x] |
| P1C | `ap2-p1c` | 3 Archetype Phòng Còn Lại & Hệ Sinh Thái Biome 2 (Băng) + Biome 3 (Lò Rèn) | [ ] |
| P1D | `ap2-p1d` | 16 Phước Lành Hành Động Cốt Lõi (Core Action Blessings) & 10 Nâng Cấp Kỹ Năng Nhân Vật | [ ] |
| P2A | `ap2-p2a` | Đồ Thị Tầng Động (Odd/Even), Tường Nứt Bí Mật, Đe Thợ Rèn Daedalus & Phân Rã Vũ Khí | [ ] |
| P2B | `ap2-p2b` | Khế Ước Tro Tàn (Ashen Pacts: 1 Điện Thờ / Biome, Thử Thách Trọn Biome & 6 Thánh Vật Thức Tỉnh) | [ ] |
| P3A | `ap2-p3a` | Ngắm Đón Đầu Có Giới Hạn (`±28°`) & 12 Quái Tương Tác Địa Hình Qua 3 Biome | [ ] |
| P3B | `ap2-p3b` | 3 Boss Phá Giáp Tương Tác 1–2 Bước, Tiếp Tế Giữa Trận & Thanh Choáng `bossStaggerAccum` | [ ] |
| P3C | `ap2-p3c` | Hồ Sơ Bot Mô Phỏng Người Thật, Cân Bằng `pnpm balance` & Playtest Gate 2 | [ ] |
| P4A | `ap2-p4a` | Mở Rộng Chiều Sâu Đợt 1: 8 Phước Lành Hành Động Nâng Cao & 4 Đột Biến Vũ Khí Mở Rộng | [ ] |
| P4B | `ap2-p4b` | Mở Rộng Chiều Sâu Đợt 2: 6 Duo Boons Nguyên Tố & Đấu Trường Bí Mật 20 Giây | [ ] |
| P5 | `v2.0.0` | Kiểm Chứng Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói `v2.0.0` & Hoàn Tất Nhánh | [ ] |





---

## Giai đoạn Đại Tu Toàn Diện: Ashen Pact 2.0 (`v0.2.1` → `v2.0.0`)

| Phase | Tag | Nội dung trọng tâm | Gate đặc biệt | Trạng thái |
|---|---|---|---|---|
| **P0A** | `ap2-p0a` | **Hạ tầng Nền, The Purge, Per-Player State & Đồng bộ Đạn Tất định 60Hz:** Cắt bỏ Energy, cắt 6 vũ khí clone (`24→18`) & 6 thẻ cộng số chay, migration save `starterWeapons` sang danh sách `18` vũ khí, tách build/vàng theo từng người chơi, `INPUT_BUTTON.RELOAD_VENT` (`[R]`), `deterministicId` đạn 16-bit, ngân sách thực thể 60Hz | `pnpm verify` + `pnpm perf` | [x] |
| **P0B** | `ap2-p0b` | **Vertical Slice Độ Vui: 3 Archetype Phòng, Vật lý `Flip Cover + Kick + Wall-Slam + Ring-Out` & 4 Vũ khí Đại diện:** Cài đặt `TWIN_BRIDGES`, `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION` (có Mirror + Prop Jitter), cơ chế Lật bàn `[E]` + Đá bàn + Đập tường + Rơi vực, 3 vật thể Biome 1, `Micro-Bar 32×5px` dưới chân nhân vật, và 4 vũ khí đại diện cho 4 hệ nhịp (`rivet_gun` Active Reload, `apprentice_staff` Heat/Vent, `knight_sword` 3-Hit Combo + Parry, `tesla_carbine` Tether) | **Playtest Gate 1 (Kiểm chứng Độ Vui Cốt Lõi: PASS 4/4)** + Visual Gate (`10.0 / 10.0 PASS` + Engine 2.6 `5/5 Gates`) | [x] |
| **P1A** | `ap2-p1a` | **Kho Vũ Khí Độc Bản Đợt 1 (7 Vũ khí: Starter, Uncommon & Rare):** `hunter_crossbow`, `thorn_staff`, `scrap_shotgun`, `gale_smg`, `frag_launcher`, `seed_gun`, `tether_staff` + Procedural VFX & Audio riêng cho từng khẩu | Visual Gate (`10.0 / 10.0 PASS`) + Engine 2.6 (`8/12F` Strip + `1:1 ROI` + `5/5 Gates`) | [x] |
| **P1B** | `ap2-p1b` | **Kho Vũ Khí Độc Bản Đợt 2 (7 Vũ khí: Rare, Epic & Legendary) & 3-Bucket Damage Pipeline:** `focus_laser`, `void_staff`, `emerald_cleaver`, `berserker_axe`, `solar_archon_staff`, `magma_cannon`, `thunder_hammer` + Công thức 3-Bucket chống nổ số nhân | Visual Gate (`9.40 / 10.0 PASS` + Engine 2.6 `5/5 Gates`) + Damage Audit Test (`4,608` combinations PASS) | [x] |
| **P1C** | `ap2-p1c` | **Mở Rộng 3 Archetype Phòng Mới & Hệ Sinh Thái Tương Tác Biome 2 (Hầm Băng) + Biome 3 (Lò Rèn):** `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, `CRUMBLING_PILLAR_RING` + 6 vật thể tương tác Biome 2 & 3 (`glacial_barricade`, `sliding_ice_block`, `cryo_prism_pillar`, `forge_blast_shield`, `pneumatic_press`, `slag_crucible`) | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P1D** | `ap2-p1d` | **Hệ Thống 26 Thẻ Nâng Cấp Cốt Lõi (16 Action Blessings + 10 Character Skill Upgrades):** Thay thế hệ thẻ cũ bằng 16 Phước lành Hành động cốt lõi (4 nhóm × 4 thẻ core) + nâng cấp 10 thẻ Kỹ năng nhân vật tương tác trực tiếp với bàn chắn/nhịp súng/địa hình | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) + UI Card Review | [ ] |
| **P2A** | `ap2-p2a` | **Đồ Thị Phòng Động, Phòng Bí Mật Nứt Tường, Đe Rèn Cổ Đại (6 Core Mutators) & Phân Rã Súng (`Hold [X] 0.5s`):** Chuyển `treasure` thành `Xưởng Rèn Kho Báu`, cài 6 Bản độ Búa Rèn cốt lõi thay đổi hình học đạn, cơ chế giữ `[X]` 0.5s tách súng lấy mảnh rèn & nâng cấp Thương Nhân | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) + Economy Test | [ ] |
| **P2B** | `ap2-p2b` | **Hệ Thống "Khế Ước Tro Tàn" (`1 Tế Đàn / Biome — Full-Biome Trial`) & 6 Di Vật Thức Tỉnh:** Tế đàn xuất hiện ở Tầng Lẻ (`1, 3, 5`), chịu lời nguyền xuyên suốt 2 tầng của Biome và thức tỉnh thành Di Vật Vĩnh Viễn sau khi hạ Boss ở Tầng Chẵn (`2, 4, 6`) + Kẻ săn đuổi `Bóng Ma Đao Phủ` | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3A** | `ap2-p3a` | **Đại Tu AI Quái (`Bounded Predictive Lead Aiming`) & 12 Hành Vi Quái Tương Tác Địa Hình:** Ngắm đón đầu có giới hạn (`leadFactor`, `maxLeadAngleRad = 22°`, tia chỉ ngắm `0.35s`, sai số ngẫu nhiên) + 12 hành vi quái tương tác vật thể qua 3 Biome | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3B** | `ap2-p3b` | **Thiết Kế Lại 3 Boss Phá Giáp Trực Quan (1–2 Bước), `Boss Supply Drop` & `bossStaggerAccum`:** Cơ chế Phá Giáp 1–2 bước (dùng vật thể phòng **hoặc** đầy thanh Chấn Động `bossStaggerAccum` từ Active Reload/Parry/Skill), Tiếp tế phòng Boss mỗi `18s`, cùng chuỗi chiêu mới cho `spore_king`, `kryssa_ice_queen`, `forge_titan` | Visual Gate + Engine 2.6 (`8/12F` Strip + `1:1 ROI`) | [ ] |
| **P3C** | `ap2-p3c` | **Nâng Cấp Bot AI Thực Tế (`Human-Like Bot Profile`), Cân Bằng Tự Động (`pnpm balance`) & Playtest Gate 2:** Dạy Bot dùng Active Reload (65% thành công), Vent (ở 80% nhiệt), Lật bàn & Đá bàn, giải cơ chế Boss; chạy `pnpm balance` tinh chỉnh thông số đạt chuẩn TTK/Win-rate | **Playtest Gate 2 (`pnpm balance` 100% PASS)** | [ ] |
| **P4A** | `ap2-p4a` | **Mở Rộng Chiều Sâu Đợt 1: 8 Phước Lành Hành Động Nâng Cao & 4 Bản Độ Búa Rèn Mở Rộng:** Hoàn thiện đủ `24` Action Blessings (6 thẻ/nhóm) và `10` Weapon Mutators (`orbital_barrel`, `split_prism`, `shockwave_stock`, `tether_capacitor`) | Visual Gate | [ ] |
| **P4B** | `ap2-p4b` | **Mở Rộng Chiều Sâu Đợt 2: 6 Phước Lành Giao Thoa (`Elemental Duo Boons`) & Đấu Trường Bí Mật 20 Giây:** Mở khóa 6 thẻ Giao thoa Nguyên tố khi 2 nguyên tố kích hoạt >= 5 lần + nâng cấp Phòng Bí Mật thành thử thách 20 giây nhận Rương Sử Thi & Tế đàn tẩy thẻ | Visual Gate | [ ] |
| **P5** | `ap2-p5` | **Tổng Duyệt Hồi Quy Toàn Diện, Hiệu Năng 60Hz 4P, Đóng Gói `v2.0.0` & Kết Thúc Nhánh:** Chụp toàn bộ danh mục cảnh cũ + mới, Holistic `pro` Visual Gate, Soak Test 20 phút 4P, cập nhật toàn bộ `docs/*.md` & `README.md`, nâng phiên bản `2.0.0`, đóng gói `AshenPact-v2.0.0-win-x64.zip` | Holistic Visual Gate (`>= 8.5/10`) + Release Gate | [ ] |
