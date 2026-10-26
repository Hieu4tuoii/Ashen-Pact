# Ashen Pact 2.0 — Phase P3B: Đồ Chơi Tương Tác & Quái Thường Biome 2 + Biome 3 (`ap2-p3b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp Đồ chơi tương tác & Hành vi quái thường cho **Biome 2 (Đỉnh Băng Vĩnh Cửu)** và **Biome 3 (Lõi Dung Nham & Hư Không)** theo Mục 5.2, 5.3 & 7.1 `master-promt-v3.md`: `frost_spire` (Cột Băng Tinh Thể trượt băng tốc độ cao `520 px/s`), `lava_geyser_vent` (Miệng Phun Dung Nham Tức Thời khi đẩy quái vào), `void_tether_orb` (Quả Cầu Hút Chân Không gom quái `160px`), nâng cấp hành vi 10 quái thường Biome 2 & 3, kèm Rig/VFX và cảnh kiểm chứng (`ap2-p3b`).

**Architecture:** Mở rộng `packages/shared/src/sim/sim-biome-mechanics.ts`, `packages/shared/src/sim/sim-enemy-ai.ts`, `apps/client/src/scenes/game-scene/room-builder.ts`, `tests/e2e/helpers/visual-scene-ap2-p3.ts`.

---

## Task 1 (`P3B.1`): Cài Đặt Đồ Chơi Tương Tác Biome 2 (`frost_spire` Trượt Băng `520 px/s`) & Nâng Cấp 5 Quái Thường Biome 2
- [ ] **`frost_spire` (Cột Băng Tinh Thể):** Bắn vỡ hoặc `Dash-Kick` sẽ làm cột băng trượt băng tốc độ cao (`520 px/s`) xuyên dọc cả căn phòng như một quả bowling khổng lồ, hất tung và đóng băng (`Freeze 1.5s`) mọi kẻ địch trên đường trượt trước khi nổ thành 6 mảnh băng tại bức tường đối diện.
- [ ] **Hành vi 5 Quái Thường Biome 2:**
  - `frost_bat`: Lượn theo đàn hình sin, lao bổ để lại vệt sương lạnh làm chậm.
  - `baby_yeti`: Nhặt mảnh băng hoặc lăn tròn thành quả cầu tuyết (`Snowball Roll`) nảy qua lại giữa 2 bức tường trước khi choáng `1.0s` khi đâm cột đá.
  - `ice_elemental`: Dựng một bức tường băng nhỏ chắn đạn phía trước đồng đội và bắn chùm 3 mảnh băng.
  - `snow_wolf`: Săn theo cặp — 1 con vờn trước mặt, con thứ 2 vòng ra góc khuất vồ (`Flank Leap`).
  - `glacial_golem`: Nện búa tạo sóng băng chạy dọc mặt đất về phía người chơi, đẩy trượt người chơi trên mặt băng.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-biome2-mechanics.test.ts`.

## Task 2 (`P3B.2`): Cài Đặt Đồ Chơi Tương Tác Biome 3 (`lava_geyser_vent`, `void_tether_orb`) & Nâng Cấp 5 Quái Thường Biome 3
- [ ] **`lava_geyser_vent` (Miệng Phun Dung Nham Áp Suất):** Bình thường phun theo chu kỳ `4.5s`, nhưng nếu người chơi đẩy lùi một con quái đè lên miệng phun hoặc bắn đạn nổ vào miệng phun, nó kích hoạt **Cột Lửa Phun Trào Tức Thời** (`base 60 DMG Lửa`, hất tung toàn bộ quái đứng trên đó).
- [ ] **`void_tether_orb` (Quả Cầu Hút Chân Không):** Lơ lửng giữa phòng — khi bị bắn trúng sẽ kích hoạt lực hút chân không trong `1.5s`, kéo toàn bộ quái trong bán kính `160px` gom lại một cục để người chơi xả sát thương diện rộng.
- [ ] **Hành vi 5 Quái Thường Biome 3:**
  - `magma_imp`: Nhảy cóc liên tục và để lại đốm than hồng tồn tại `2.5s` tại điểm đáp; khi chết nhảy bổ về phía kẻ địch gần nhất và phát nổ nhỏ (`20 DMG` cho cả quái quanh đó).
  - `flame_beetle`: Bò để lại vệt lửa khóa đường rút lui; tấm lưng giáp cứng giảm `50%` sát thương từ chính diện nhưng nhận `x1.5 DMG` khi bị bắn vào bụng/lưng sau lúc đang quay đầu.
  - `obsidian_guard`: Giương khiên đá đen chặn đạn phía trước và bước đều ép góc; khi bị `Dash-Kick` hoặc `Wall-Slam` sẽ rơi mất khiên và lộ lõi dung nham nhận `x1.5 DMG`.
  - `pyromancer`: Triệu hồi vòng phù văn lửa dưới chân người chơi (nổ sau `1.1s`) và dịch chuyển tức thời (`Blink`) ra xa khi người chơi áp sát.
  - `magma_worm`: Chui ngầm dưới sàn (hiển thị vệt nứt dung nham di chuyển) rồi trồi lên phun vòng đạn 8 hướng; đòn `Wall-Slam` hoặc nổ thùng ngay trên vệt nứt sẽ ép giun trồi lên trong trạng thái choáng `1.5s`.
- [ ] Viết unit test TDD `packages/shared/test/ap2-p3b-biome3-mechanics.test.ts`.

## Task 3 (`P3B.3`): Bake Texture, Rig Cutout 2.0 & VFX Cho Đồ Chơi & Quái Biome 2–3 (`procedural-textures.ts`, `rig-defs-enemies.ts`, `combat-vfx.ts`)
- [ ] Bake texture `frost_spire`, `lava_geyser_vent`, `void_tether_orb`; vẽ telegraph trượt cột băng, cột lửa dung nham và xoáy hút chân không.

## Task 4 (`P3B.4`): Xây Dựng Cảnh Chụp & Strip Kiểm Chứng Đồ Chơi Biome 2 & 3 (`visual-scene-ap2-p3.ts`)
- [ ] Bổ sung 2 strip 8 frame (`ap2-b2-frost-spire-slide`, `ap2-b3-void-orb-geyser`) vào `visual-scene-ap2-p3.ts` và đăng ký nhóm `ap2-p3b`.

## Task 5 (`P3B.5`): Visual Gate & Phase Gate `P3B`
- [ ] Chạy `pnpm shots -- --phase ap2-p3b --label after --group ap2-p3b`, chấm qua Visual Reviewer (`pro` `>= 8.0/10`), chạy `pnpm verify` & `pnpm perf`, commit và tag `ap2-p3b`.
