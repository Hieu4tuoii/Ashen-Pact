# NHẬT KÝ TIẾN ĐỘ DỰ ÁN (PROGRESS.md) — ASHEN PACT

## 1. Tóm Tắt Kế Hoạch Toàn Bộ 9 Phase & Các Giả Định Kỹ Thuật

### 1.1 Lộ trình 9 Phase (Phase 0 → Phase 8)
1. **Phase 0 — Nền móng & Thiết kế (ĐÃ HOÀN THÀNH ✅):** Thiết lập monorepo `pnpm` (`apps/client`, `apps/server`, `packages/shared`), TS strict, ESLint, Prettier, Vitest, Playwright, bộ tài liệu sống `docs/`, thư viện vẽ procedural vector (`palette`, `primitives`, `outlined()`, `TextureBaker` theo DPR, `CutoutRig`), nhân vật mẫu **Thiết Vệ** + quái mẫu **Goblin Xạ Thủ**, scene `ArtGallery`, khung Phaser scenes + Colyseus hello room + `window.__GAME_DEBUG__`.
2. **Phase 1 — Core Gameplay & Game Feel:** Vòng lặp simulation 60Hz trong `packages/shared` + `LocalTransport`, di chuyển gia tốc, dash i-frame, camera lookahead, 4 vũ khí mẫu, 3 quái mẫu + AI/telegraph, spatial hash, hit-stop, screen shake, damage popup, ZzFX.
3. **Phase 2 — Pipeline Hình ảnh & Tương tác Map:** Tilemap procedural + autotile, lightmap động + bloom/vignette, particle/decal pool, đồ vỡ/thùng nổ, bề mặt tương tác nguyên tố, stress test 60 FPS (4P + 80 quái + 600 đạn).
4. **Phase 3 — Dungeon, Vòng lặp lượt chơi & Biome 1 hoàn chỉnh:** Sinh tầng procedural có kiểm chứng liên thông, minimap + fog of war, 12 vũ khí, rương/thương nhân/tượng thần/phòng bí mật, toàn bộ quái + Elite Biome 1, Boss **Mục Vương Nấm Độc** 3 phase.
5. **Phase 4 — Co-op LAN:** Server authoritative Colyseus phục vụ tĩnh + WebSocket cùng cổng `2567`, LAN IP + QR code, `NetworkTransport`, client prediction + reconciliation, adaptive interpolation, deterministic bullet spawn, mô phỏng mạng Wi-Fi kém, E2E 4 client qua IP LAN thực.
6. **Phase 5 — 5 Nhân vật, Hệ Nguyên tố & Synergy:** Hoàn thiện Thiết Vệ, Liệp Ưng, Lam Hỏa, Mộc Linh, Bánh Răng kèm nâng cấp skill, 6 phản ứng nguyên tố + Team Combo, công cụ Balance Harness headless xuất `docs/balance-report.md`.
7. **Phase 6 — Biome 2 & 3 + Boss:** Hoàn thiện Hầm Băng Vĩnh Cửu (**Băng Hậu Kryssa**) và Lò Rèn Dung Nham (**Titan Lò Rèn**), đủ 24 vũ khí, cơ chế map chuyên biệt.
8. **Phase 7 — UI/UX & Âm thanh hoàn thiện:** Menu động, HUD vector, Settings đầy đủ, MVP screen, i18n `vi`/`en`, nhạc động 2 lớp khám phá/chiến đấu + âm thanh định vị.
9. **Phase 8 — Cân bằng cuối, Hiệu năng, QA & Bản phát hành:** Soak test 20 phút, đóng gói `AshenPact-Host.exe` + `start-host.bat` chạy độc lập, `README.md` tiếng Việt, `RELEASE_NOTES.md`, tag `v0.1.0`.

### 1.2 Các Giả Định Kỹ Thuật (Explicit Assumptions)
- **Môi trường thực thi:** Windows 10/11 với Node.js `v24.14.0` và `pnpm 9.15.2`.
- **Font OFL đóng gói local:** Sử dụng font `Be Vietnam Pro` (SIL Open Font License 1.1) đóng gói trực tiếp tại `apps/client/public/fonts/` và bundle local qua `@fontsource/be-vietnam-pro` để đảm bảo hiển thị trọn vẹn tiếng Việt có dấu mà không cần kết nối Internet.
- **Độ phân giải chuẩn và DPR Supersampling:** Thế giới có vùng nhìn cơ sở `960×540` đơn vị; `TextureBaker` bake toàn bộ bộ phận cutout rig ở hệ số `5x` (1080p) và `7x` (1440p) (kẹp trong khoảng `4x–8x`) với `{ willReadFrequently: true }` trên 2D canvas để vừa sắc nét tuyệt đối (kể cả bản phóng đại `2.25×` trong `ArtGalleryScene`) vừa tránh mọi cảnh báo `ReadPixels` khi upload lên WebGL.
- **Cổng mạng mặc định:** Server Colyseus chạy tại cổng `2567` (tự động thử cổng kế tiếp nếu bận), Vite dev server chạy tại cổng `5173`.

---

## 2. Nhật Ký Thực Thi Các Phase

### Phase 0 — Nền móng & Thiết kế (Hoàn thành ✅)
- **Những việc đã hoàn thành:**
  - Khởi tạo Git repository, cấu hình monorepo `pnpm` (`packages/shared`, `apps/client`, `apps/server`) với TypeScript `strict: true`, ESLint 9, Prettier 3, Vitest 2, Playwright.
  - Tạo trọn bộ tài liệu sống tại `docs/`: `GDD.md`, `TECH.md`, `ART_GUIDE.md`, `BALANCE.md`, `PHASES.md`, `PROGRESS.md`, `CREDITS.md`.
  - Xây dựng `packages/shared`: `SeededRandom` (Mulberry32 + FNV-1a, hỗ trợ cả seed số nguyên, số thực và chuỗi), `FixedTimestepLoop` (60Hz + interpolation `alpha`), va chạm hình học (`circleVsCircle`, `circleVsAABB`), lượng tử hóa gói tin mạng, và bảng dữ liệu tĩnh cho 5 nhân vật, vũ khí, quái Biome 1 và Co-op scaling.
  - Xây dựng `apps/server`: Server Colyseus + Express trên cổng `2567`, `HelloRoom` chạy vòng lặp 60Hz, tự động dò tìm địa chỉ IPv4 LAN hợp lệ (`/api/host-info`).
  - Xây dựng `apps/client`:
    - Thư viện vẽ procedural `src/art/` (`palette.ts` 42 màu, `easing.ts`, `primitives.ts` với hàm `outlined()`, `rig-defs.ts`, `texture-baker.ts`, `cutout-rig.ts`).
    - Nhân vật mẫu **Thiết Vệ (Vanguard)** và quái mẫu **Goblin Xạ Thủ (Goblin Shooter)** gồm 8 bộ phận cutout tách rời, chạy mượt animation tham số `idle` và `run`.
    - Các scene `BootScene`, `PreloadScene`, `MenuScene`, `GameScene`, `ArtGalleryScene` (`?scene=gallery`) cùng `DebugOverlay` (`F1`) và `window.__GAME_DEBUG__`.
- **Kết quả kiểm thử & Hiệu năng:**
  - `pnpm verify` (`typecheck` + `lint` + `test` + `build` + `e2e`) PASS 100% (12/12 unit tests, 2/2 E2E test suites).
  - FPS đo qua `window.__GAME_DEBUG__`: **~60.3 FPS** (`16.59 ms` frame time).
  - Console trình duyệt: **0 errors, 0 warnings**.
  - Screenshots đã chụp và kiểm tra trực quan bằng mắt tại `docs/screenshots/phase-0/`:
    - `docs/screenshots/phase-0/menu-1080p.png`
    - `docs/screenshots/phase-0/game-1080p.png`
    - `docs/screenshots/phase-0/art-gallery-1080p-idle.png`
    - `docs/screenshots/phase-0/art-gallery-1080p-run-p2.png`
    - `docs/screenshots/phase-0/art-gallery-1440p.png`
- **Vấn đề đã phát hiện & xử lý trong Phase 0:**
  - Phát hiện các tập con `unicode-range` (`vietnamese`, `latin-ext`, `latin`) của font `Be Vietnam Pro` không tự động tải khi DOM rỗng (khiến Canvas 2D fallback các ký tự có dấu chồng như `ắ ằ ẳ ẵ ặ...` sang Times New Roman) → Đã chủ động gọi `document.fonts.load(...)` với chuỗi tiếng Việt mẫu và `face.load()` cho toàn bộ `FontFace` trong `PreloadScene` trước khi khởi tạo scene, đồng thời đồng bộ đủ 12 file `.woff2` (`latin`, `latin-ext`, `vietnamese` × `400, 600, 700, 800`) tại `apps/client/public/fonts/`.
  - Phát hiện sự kiện `this.scale.on('resize', ...)` không được gỡ khi chuyển scene gây lỗi `TypeError` khi đổi độ phân giải sau khi chuyển cảnh, và thiếu cập nhật lại texture/resolution trong `MenuScene`/`GameScene` khi `bakeScale` thay đổi → Đã gắn cleanup tại `Phaser.Scenes.Events.SHUTDOWN` (bao gồm cả rời phòng Colyseus và hủy listener `F1`) và tự động làm mới toàn bộ rig, tile sprite, text resolution khi resize.
  - Phát hiện text mặc định của Phaser ở `resolution: 1` hơi mềm khi camera zoom 2x–2.67x → Đã gắn `resolution: TextureBaker.getBakeScale()` cho mọi đối tượng chữ, giúp chữ tiếng Việt có dấu sắc nét tuyệt đối ở cả 1080p và 1440p.
  - Phát hiện cảnh báo `GL Driver Message: GPU stall due to ReadPixels` khi upload 2D canvas lên WebGL → Đã bật `{ willReadFrequently: true }` trên 2D canvas của `TextureBaker` và cấu hình D3D11 ANGLE cho Chromium, đưa số lượng warning về 0.
- **Bước tiếp theo (Phase 1):**
  - Triển khai **Phase 1 — Core Gameplay & Game Feel (Solo, Phòng Thử Nghiệm)**: Simulation đầy đủ trong `packages/shared` + `LocalTransport`, di chuyển có gia tốc, dash i-frame, ngắm chuột + camera lookahead + crosshair, 4 vũ khí mẫu (súng lục, shotgun, SMG, kiếm), 3 quái mẫu (bắn xa, lao húc, nổ) với AI + telegraph, spatial hash grid, HP/Giáp/Năng lượng, hit-stop, screen shake, damage popup, và SFX ZzFX.
