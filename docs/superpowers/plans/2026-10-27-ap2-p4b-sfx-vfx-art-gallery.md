# Ashen Pact 2.0 — Phase P4B: Nâng Cấp Procedural WebAudio SFX, VFX Polish & Triển Lãm Nghệ Thuật (`Art Gallery 2.0`) (`ap2-p4b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bổ sung đầy đủ các hiệu ứng âm thanh tổng hợp (`Procedural WebAudio SFX`) cho toàn bộ cơ chế mới của Ashen Pact 2.0, tinh chỉnh độ sắc nét VFX ánh sáng/hạt, và nâng cấp `ArtGalleryScene` (`art-gallery-pages.ts`) để trưng bày đầy đủ 18 Vũ Khí Cơ Học, 5 Đồ Chơi Tương Tác Phòng, Đe Rèn Cổ Đại, Tế Đàn Khế Ước, và `Bóng Ma Đao Phủ`.

**Architecture:** Cập nhật `apps/client/src/audio/sound-effects.ts`, `apps/client/src/scenes/art-gallery-pages.ts`, `tests/e2e/helpers/visual-scene-ap2-p4.ts`.

---

## Task 1 (`P4B.1`): Tổng Hợp WebAudio SFX Cho Toàn Bộ Cơ Chế Mới (`sound-effects.ts`)
- [ ] Bổ sung các hiệu ứng âm thanh tổng hợp (`WebAudio API`) khác biệt rõ ràng cho:
  - `sfx_perfect_reload_chime`: Tiếng *Keng!* kim loại sắc gọn nâng tông khi bấm `[R]` trúng điểm ngọt.
  - `sfx_reload_fumble_buzz`: Tiếng kẹt cơ khí trầm đục khi bấm `[R]` trượt khung vàng.
  - `sfx_thermal_vent_hiss`: Tiếng xì hơi áp suất cao khi xả nhiệt hoàn hảo.
  - `sfx_wall_slam_crunch`: Tiếng va đập đá vụn nặng lực khi quái đập vào tường/cột đá.
  - `sfx_dash_kick_impact`: Tiếng đá tống lực trầm chắc khi lướt tông vào thùng/quái.
  - `sfx_pact_sign_ominous` & `sfx_relic_awaken_fanfare`: Tiếng chuông trầm ký Khế Ước và hợp âm rực rỡ khi Khế Ước thức tỉnh thành Di Vật.
  - `sfx_weapon_salvage_clink`: Tiếng tháo rời cơ khí kèm tiếng đồng vàng rơi khi phân rã súng.
- [ ] Viết unit test kiểm chứng đăng ký và phát SFX an toàn trong `apps/client/test/ap2-p4b-audio-gallery.test.ts`.

## Task 2 (`P4B.2`): Nâng Cấp Triển Lãm Nghệ Thuật (`art-gallery-pages.ts`) & Cảnh Chụp Kiểm Chứng (`visual-scene-ap2-p4.ts`)
- [ ] Cập nhật `apps/client/src/scenes/art-gallery-pages.ts` trưng bày đúng 18 Vũ Khí Cơ Học (kèm nhãn `CadenceKind`), 5 Đồ Chơi Tương Tác Phòng (`spore_lantern`, `lightning_conduit`, `frost_spire`, `lava_geyser_vent`, `void_tether_orb`), Đe Rèn Cổ Đại (`daedalus_anvil`), Tế Đàn Khế Ước, và `Bóng Ma Đao Phủ (ashen_executioner)`.
- [ ] Bổ sung 2 cảnh (`ap2-art-gallery-arsenal-18`, `ap2-art-gallery-hazards-and-pacts`) vào `visual-scene-ap2-p4.ts` và đăng ký nhóm `ap2-p4b`.

## Task 3 (`P4B.3`): Visual Gate & Phase Gate `P4B`
- [ ] Chạy `pnpm shots -- --phase ap2-p4b --label after --group ap2-p4b`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p4b`.
