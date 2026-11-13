# Authentic Free SFX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tích hợp hoàn chỉnh hệ thống hiệu ứng âm thanh thu âm thực tế miễn phí (`CC0 1.0` & `CC-BY-4.0`) đã qua mastering chuyên sâu vào toàn bộ 18 vũ khí, kỹ năng, phản ứng nguyên tố, nạp đạn, địa hình, quái/Boss, vật phẩm và UI của Ashen Pact (`v2.0.0`) với độ khớp 100% và không phát sinh bất kỳ cảnh báo console nào.

**Architecture:** Xây dựng pipeline mastering DSP tất định (`numpy`/`scipy`) xuất `160` tệp `.wav` chuẩn RIFF PCM16 Mono `32kHz` (`3.04 MB`) kèm `manifest.json` vào `apps/client/public/sfx/`. Nâng cấp `ZzfxSynth` thành bộ phát Sample-First Hybrid WebAudio nạp mẫu qua `fetch` + `parseWavPcm16` (không chạm `AudioContext` trước tương tác người dùng để giữ `0` console warnings), hydrate `AudioBuffer` độ trễ `0 ms` khi mở khóa âm thanh, xoay vòng biến thể round-robin, định vị không gian 2D và quản lý `24` kênh theo độ ưu tiên.

**Tech Stack:** TypeScript 5.6 (`strict`), Web Audio API, Phaser 3, Vitest, Playwright, Python 3 (`numpy`, `scipy`) cho DSP mastering & QA.

---

### Task 1: Xây Dựng Kho Âm Thanh Thực Tế Đã Mastering (`apps/client/public/sfx/`) & Kiểm Định DSP Độc Lập

**Files:**
- Create: `<scratch>/build_sfx_bank.py`
- Create: `<scratch>/verify_mastered_sfx.py`
- Create: `apps/client/public/sfx/manifest.json`
- Create: `apps/client/public/sfx/LICENSE-THIRD-PARTY.txt`
- Create: `apps/client/public/sfx/{weapons,combat,skills,elements,foley,enemies,world,ui}/*.wav`

- [x] **Step 1: Viết script `<scratch>/build_sfx_bank.py` phối lớp & mastering toàn bộ `105` `SfxId` (`160` biến thể `.wav`)**
  - Cắt chính xác cửa sổ xung đỉnh từ 17 bộ nguồn đã giải mã trong `<scratch>/sfx_sources` & `<scratch>/decoded_wav`.
  - Áp dụng khử DC offset, lọc thông cao (`35Hz`/`75Hz`/`120Hz`), cân bằng EQ/loudness theo bậc vai trò, giới hạn đỉnh mềm `-1.0 dBFS` (`0` clipping), fade-in `1.2ms` và fade-out cosine mượt (`tailMaxAbs <= 0.002`).
  - Xuất `manifest.json` và `LICENSE-THIRD-PARTY.txt`.

- [x] **Step 2: Chạy `<scratch>/build_sfx_bank.py` sinh toàn bộ file `.wav` và `manifest.json`**
  - Run: `python "<scratch>/build_sfx_bank.py"`
  - Expected: Sinh thành công 100% file cho toàn bộ `105` `SfxId` mà không có lỗi.

- [x] **Step 3: Viết và chạy `<scratch>/verify_mastered_sfx.py` kiểm định chất lượng âm học từng file**
  - Run: `python "<scratch>/verify_mastered_sfx.py"`
  - Expected: `100% PASS` trên mọi tiêu chí: định dạng RIFF PCM16 Mono `32000 Hz`, không rỗng (`rmsDb >= -34 dB`), `0` mẫu vượt ngưỡng clipping, `onsetMs <= 3.5 ms` cho mọi SFX tức thời, `tailMaxAbs <= 0.0025` chống tiếng tách cuối file. Tinh chỉnh ngay nếu bất kỳ file nào lệch chuẩn.

---

### Task 2: Viết Bộ Unit Test TDD Trước Khi Sửa Code (RED Phase)

**Files:**
- Create: `apps/client/test/authentic-sfx-overhaul.test.ts`

- [x] **Step 1: Tạo bài kiểm thử toàn diện `apps/client/test/authentic-sfx-overhaul.test.ts`**
  - Kiểm tra toàn bộ `105` `SfxId` đều có trong `SFX_PRESETS` và `SFX_SAMPLE_CATALOG`, không chứa `'bullet_graze'`.
  - Kiểm tra mọi đường dẫn `.wav` trong `SFX_SAMPLE_CATALOG` tồn tại thực tế trong `apps/client/public/sfx/`, khớp `manifest.json`, giải mã thành công qua `parseWavPcm16`, có năng lượng âm thanh thực (`RMS > 0.015`), không clipping, không cụt đuôi.
  - Kiểm tra `resolveWeaponAttackSfx` phân bổ đúng âm thanh đặc trưng cho toàn bộ `18` vũ khí trong `WEAPONS` (bao gồm `rivet_gun` phát thứ 6 `isFinale: true` → `'shoot_rivet_finale'`), đồng thời `resolveWeaponShootSfx` giữ nguyên 100% giá trị tương thích ngược.
  - Kiểm tra `resolveEnemyProjectileSfx`, `resolvePickupSfx`, `resolveFootstepSurfaceSfx`.
  - Kiểm tra `ZzfxSynth`: `preloadSamples()` không khởi tạo `AudioContext`, round-robin không lặp biến thể liên tiếp khi `variations.length > 1`, ưu tiên đánh cắp kênh (voice stealing) khi đầy `24` kênh, định vị stereo pan + suy giảm khoảng cách, và fallback tổng hợp khi mẫu chưa nạp.
  - Kiểm tra tích hợp sự kiện thực tế qua `processSimEventsImpl` và `handleBatch2WeaponSimEvent`: vũ khí mới, nhặt đồ phân loại (`gold`, `life_seed`, `prey_emblem`, `item_purchased`), đạn quái (`goblin_bow`, `shaman_staff`, `dwarf_mortar`, `welder_arc`), `hit_armor`, `impact_wall`, `solar_converge`, `shaman_heal`, `grass_rustle`, `shockwave_slam`.

- [x] **Step 2: Chạy Vitest xác nhận trạng thái RED**
  - Run: `pnpm --filter @ashen-pact/client test authentic-sfx-overhaul`
  - Expected: FAIL vì `sfx-catalog.ts` và các API/ID mới chưa được triển khai.

---

### Task 3: Nâng Cấp Engine Âm Thanh WebAudio & Danh Mục Mẫu (`GREEN` Phần 1)

**Files:**
- Create: `apps/client/src/audio/sfx-catalog.ts`
- Modify: `apps/client/src/audio/zzfx.ts`
- Modify: `apps/client/src/scenes/PreloadScene.ts`

- [x] **Step 1: Tạo `apps/client/src/audio/sfx-catalog.ts`**
  - Định nghĩa `VoicePriority`, `SfxSampleEntry`, `SFX_SAMPLE_CATALOG` cho toàn bộ `105` `SfxId`, `parseWavPcm16(buffer: ArrayBuffer)`, `resolveWeaponAttackSfx`, `resolveEnemyProjectileSfx`, `resolvePickupSfx`, `resolveFootstepSurfaceSfx`.

- [x] **Step 2: Nâng cấp `apps/client/src/audio/zzfx.ts`**
  - Mở rộng `SfxId` và `SFX_PRESETS` thêm `26` ID mới (tổng cộng `105` ID), xuất lại các helper từ `sfx-catalog.ts`.
  - Bổ sung `preloadSamples()`, `isSampleLoaded(id)`, `isAudioReady()`, `injectDecodedSampleForTest(...)`, `setAudioContextForTest(...)`, bộ xoay vòng biến thể round-robin, hydrate `AudioBuffer` qua `WeakMap<AudioContext, Map<string, AudioBuffer>>`, `GainNode` + `StereoPannerNode`, và quản lý `24` kênh ưu tiên.

- [x] **Step 3: Gọi `void zzfx.preloadSamples()` trong `apps/client/src/scenes/PreloadScene.ts`**
  - Khởi động nạp nền toàn bộ mẫu `.wav` ngay khi mở ứng dụng mà không chặn luồng render và không tạo cảnh báo console.

---

### Task 4: Ghép Nối 100% Sự Kiện Gameplay, Nạp Đạn, Bước Chân & Cập Nhật Credits (`GREEN` Phần 2)

**Files:**
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/fx/combat-fx-weapons-p1b.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `CREDITS.md`
- Modify: `docs/CREDITS.md`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`

- [x] **Step 1: Cập nhật `sim-events.ts` và `combat-fx-weapons-p1b.ts`**
  - Sử dụng `resolveWeaponAttackSfx(ev.weaponId, { isFinale })` cho tiếng bắn/chém thực tế của người chơi (vẫn dùng `resolveWeaponShootSfx` hoặc kiểm tra `ev.weaponId === 'scrap_shotgun'` cho logic vỏ đạn/giật nòng shotgun).
  - Ánh xạ tiếng đạn quái qua `resolveEnemyProjectileSfx(ev.weaponId)`.
  - Phân biệt `crit_hit` > `hit_armor` > `hit_enemy` khi gây sát thương lên quái.
  - Phát `impact_wall` (tối đa 1 lần/step) khi đạn đập tường không bị khiên/kiếm cản.
  - Phân loại `pickup_collected` qua `resolvePickupSfx(ev.pickupKind)` và `item_purchased` (`costGold === 0 ? 'pickup_weapon' : 'pickup'`).
  - Phát `shaman_heal`, `grass_rustle`, `shockwave_slam` và `solar_converge` (`solar_converge_burst`).

- [x] **Step 2: Bổ sung vòng đời âm thanh nạp đạn & bước chân địa hình trong `GameScene.ts`**
  - Theo dõi cạnh lên/xuống của `sim.player.reloadTimer > 0.02` để phát `reload_start` và `reload_complete` (tránh phát chồng nếu tick đó vừa kích hoạt `perfect_reload`).
  - Khi `shouldEmitFootstepDust(...)` kích hoạt và `zzfx.isAudioReady()`, lấy `sim.map.getSurfaceAtWorld(playerPos.x, playerPos.y + RIG_FOOT_OFFSET_Y)` để phát `resolveFootstepSurfaceSfx(...)` có định vị không gian nhẹ.

- [x] **Step 3: Cập nhật `CREDITS.md`, `docs/CREDITS.md` và `vi.json` / `en.json`**
  - Đồng bộ tuyệt đối `CREDITS.md` và `docs/CREDITS.md` (`v2.0.0`, đầy đủ ghi nhận `CC-BY-4.0` cho Oculus Audio Pack 01 và các nguồn `CC0 1.0`).
  - Cập nhật mô tả âm thanh tại `packages/shared/src/i18n/vi.json` và `en.json`.

- [x] **Step 4: Chạy Vitest xác nhận trạng thái GREEN**
  - Run: `pnpm --filter @ashen-pact/client test authentic-sfx-overhaul`
  - Expected: `100% PASS`.

---

### Task 5: Kiểm Định WebAudio Trực Tiếp Trên Chromium & Toàn Bộ Suite Dự Án

**Files:**
- Create (temporary verification script in `<scratch>`): `<scratch>/verify_browser_webaudio.mjs`

- [x] **Step 1: Chạy kiểm định thực tế trên trình duyệt Chromium bằng Playwright**
  - Mở ứng dụng thật, xác nhận `zzfx.preloadSamples()` nạp `100%` tệp `.wav` (`200 OK`), kích hoạt click người dùng mở khóa `AudioContext`, phát thử đại diện toàn bộ 18 vũ khí, kỹ năng, phản ứng nguyên tố, Boss, nạp đạn, bước chân và UI qua `AnalyserNode`, xác nhận biên độ tín hiệu đầu ra thực `> 0` và `0` console warnings / `0` console errors.

- [x] **Step 2: Chạy trọn bộ lệnh kiểm tra chất lượng dự án**
  - Run: `pnpm typecheck`
  - Run: `pnpm lint`
  - Run: `pnpm test`
  - Run: `pnpm build`
  - Run: `pnpm e2e`
  - Expected: Tất cả 5 cổng kiểm tra đều `PASS` 100% (`exit code 0`).
