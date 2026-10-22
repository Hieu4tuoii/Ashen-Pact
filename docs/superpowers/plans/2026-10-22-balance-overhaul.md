# Combat & Economy Balance Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task across **Phase B1** and **Phase B2**. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đại tu toàn diện độ khó chiến đấu, kinh tế năng lượng/vàng trong trận, sinh tồn của người chơi, mật độ/vị trí xuất hiện quái, nhịp độ tràn đợt, và trận đánh Boss theo đúng đặc tả trong `balance-overhaul-prompt.md`.

**Architecture:**
- Thực thi tuần tự qua 2 Phase (**Phase B1**: Core Survival, Economy & Room Pacing; **Phase B2**: Boss Overhaul & Balance Simulation Calibration).
- Mọi thay đổi logic mô phỏng nằm trong `@dungeon-delvers/shared` (`packages/shared/src/sim/*`, `packages/shared/src/data/*`), kết nối client tại `apps/client/src/scenes/game-scene/arena-tiles.ts`, và công cụ kiểm định cân bằng tại `tools/balance-*`.
- Mỗi Phase đều trải qua TDD, Code Review qua Subagent, kiểm định chất lượng (`typecheck`, `lint`, `test`), chụp ảnh thực tế (`pnpm shots`) kèm đánh giá độc lập qua Subagent Visual Reviewer (chỉ đọc ảnh & `metrics.json`), và gắn thẻ Git (`polish-b1`, `polish-b2`).

**Tech Stack:** TypeScript, Vitest, Phaser 3, Playwright (`tools/run-shots.ts`), Node CLI harness (`tools/balance-harness.ts`).

---

## Phase B1: Nền tảng Sinh tồn, Kinh tế & Nhịp độ Phòng (Core Survival, Economy & Room Pacing)

### Task B1.1: Sửa lỗi bất tử (`autoRevivePlayer`) trong chế độ Chơi Đơn (Solo)

**Files:**
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts:200-217`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts:893-907`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Viết bài test tái hiện lỗi Solo tự hồi sinh và kiểm tra Hub vẫn tự hồi sinh**
  - Trong `packages/shared/test/balance-overhaul-b1.test.ts`, kiểm tra:
    1. `new WorldSim(seed, 'vanguard', { startInHub: false, autoRevivePlayer: false })`: khi người chơi nhận sát thương đến `hp <= 0` ở chế độ Solo (1 người chơi), `sim.runState` phải chuyển sang `'defeat'`, người chơi không được hồi lại đầy máu.
    2. `new WorldSim(seed, 'vanguard', { startInHub: true, autoRevivePlayer: false })`: khi đang ở Hub (`sim.inHub === true`), nếu `hp <= 0` thì người chơi vẫn tự hồi sinh đầy máu/giáp để thử vũ khí.
- [ ] **Step 2: Sửa `arena-tiles.ts` và `sim-combat-damage.ts`**
  - Tại `apps/client/src/scenes/game-scene/arena-tiles.ts:202`: truyền `autoRevivePlayer: false` vào `new LocalTransport({...})`.
  - Tại `packages/shared/src/sim/sim-combat-damage.ts:896`: đổi `if (this.autoRevivePlayer)` thành `if (this.inHub || this.autoRevivePlayer)`.

---

### Task B1.2: Thiết kế lại Kinh tế Năng lượng (Energy Economy)

**Files:**
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/sim-coop-hub.ts`
- Modify: `packages/shared/src/sim/sim-player.ts`
- Modify: `packages/shared/src/sim/sim-skills-mechanics.ts`
- Modify: `packages/shared/src/data/weapons.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Thêm trạng thái trễ hồi năng lượng theo từng người chơi (`energyRegenDelayTimer`, `energyRegenAccum`)**
  - Trong `SimPlayerState` (`world-sim-types.ts`) và hàm khởi tạo người chơi (`sim-coop-hub.ts`), thêm:
    - `energyRegenDelayTimer: number` (khởi tạo `0`)
    - `energyRegenAccum: number` (khởi tạo `0`)
  - Khi người chơi tiêu hao năng lượng để bắn vũ khí (`cost > 0` tại `sim-player.ts`) hoặc kích hoạt kỹ năng tiêu tốn năng lượng (`sim-skills-mechanics.ts`), đặt `p.energyRegenDelayTimer = 2.0` và `p.energyRegenAccum = 0`.
  - Trong `sim-player.ts`: giảm `p.energyRegenDelayTimer = Math.max(0, p.energyRegenDelayTimer - dtSec)`. Chỉ khi `p.energyRegenDelayTimer <= 0` và `p.energy < p.maxEnergy`, tích lũy `p.energyRegenAccum += dtSec * 1.5 * (this.activeBuffIds.includes('arcane_wellspring') ? 1.5 : 1.0)` (tức `1.5 Energy/s` cơ bản, `2.25 Energy/s` khi có `arcane_wellspring`).
- [ ] **Step 2: Điều chỉnh `energyCost` vũ khí trong `packages/shared/src/data/weapons.ts`**
  - Đặt `rusty_pistol.energyCost = 0` (làm vũ khí dự phòng khi cạn năng lượng; giữ nguyên các vũ khí khởi điểm cấp Common ở `0` và `scrap_shotgun` ở `3` để tương thích các bài test cốt lõi).
  - Tăng nhẹ `energyCost` cho súng bắn nhanh (`gale_smg: 2`, `venom_smg: 2`) và súng tầm trung/nặng (`frost_burst_rifle: 4`, `void_sniper: 6`, `magma_launcher: 6`, `storm_crossbow: 4`, ` starfire_cannon: 6`, `chronos_rifle: 4`, `glacier_railgun: 6`, `solar_archon_staff: 5`, v.v. bảo đảm các súng tầm trung/nặng rơi vào khoảng `4–6`).
- [ ] **Step 3: Chuẩn hóa lượng rơi hạt năng lượng (Energy Orbs)**
  - Trong `sim-combat-damage.ts`:
    - Quái triệu hồi/phân tách: `kryssa_clone` và `spore_guardian` rơi **0 Energy**; `mini_slime` có **25% cơ hội rơi 1 hạt `4 Energy`**.
    - Quái thường: **55% cơ hội (`this.rng.chance(0.55)`) rơi `1` hạt `6 Energy`**.
    - Quái Tinh anh (Elite): rơi **`2` hạt × `8 Energy` (`16 Energy`)**.
    - Boss khi bị tiêu diệt: rơi **`5` hạt × `8 Energy` (`40 Energy`)**.
  - Trong `sim-props-spawning.ts`:
    - Phá thùng gỗ / bình gốm (`destructible prop`): **20% cơ hội (`this.rng.chance(0.2)`) rơi `1` hạt `5 Energy`**.
  - Trong `sim-dungeon-rooms.ts`:
    - Mở rương: rơi **`1` hạt `10 Energy`** (giảm từ `15`).

---

### Task B1.3: Thiết kế lại Kinh tế Vàng (Gold Economy) & Giá Cửa hàng / Tượng thần

**Files:**
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/dungeon-gen.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Chuẩn hóa lượng rơi Vàng (Gold Drops)**
  - Trong `sim-combat-damage.ts`:
    - Quái triệu hồi (`mini_slime`, `kryssa_clone`, `spore_guardian`): **0 Gold**.
    - Quái thường: **60% cơ hội (`this.rng.chance(0.6)`) rơi `1–2 Gold`** (`this.rng.nextInt(1, 2)`).
    - Quái Tinh anh (Elite): rơi **`6–9 Gold`** (chia thành 2–3 hạt có tổng chính xác trong đoạn `6–9 Gold`).
    - Boss: rơi **`20–25 Gold`** (chia thành 5 hạt có tổng chính xác trong đoạn `20–25 Gold`).
  - Trong `sim-props-spawning.ts`:
    - Phá vật cản (`destructible prop`): **15% cơ hội (`this.rng.chance(0.15)`) rơi `1–2 Gold`**.
  - Trong `sim-dungeon-rooms.ts`:
    - Mở rương: rơi **`6–10 Gold`** (tổng giá trị các hạt vàng từ rương nằm trong đoạn `6–10 Gold`).
- [ ] **Step 2: Tăng giá Cửa hàng (Merchant) và Tượng thần (Shrine)**
  - Trong `dungeon-gen.ts` và `sim-dungeon-rooms.ts`, với `floorScale = 1 + (localFloor - 1) * 0.25`:
    - Bình máu (`health_potion`): `Math.round(30 * floorScale)` Gold.
    - Vũ khí (`weapon`): `Math.round((shopRarity === 'epic' ? 85 : 55) * floorScale)` Gold.
    - Nâng cấp Giáp / Buff (`armor_upgrade`): `Math.round(65 * floorScale)` Gold.
  - Trong `sim-dungeon-rooms.ts` và `sim-progression-bot.ts`:
    - Tăng phí cầu nguyện Tượng thần (Shrine) từ `25 Gold` lên **`40 Gold`** (cập nhật chuỗi hội thoại tiếng Việt từ `25 Xu` thành `40 Xu`).

---

### Task B1.4: Cân bằng Sinh tồn, Giáp, Lướt (Dash), I-Frame, `knight_sword` & Vũng Lửa

**Files:**
- Modify: `packages/shared/src/data/characters/index.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/sim-player.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/data/weapons.ts`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Cập nhật chỉ số Giáp, Máu và Hồi giáp trong `packages/shared/src/data/characters/index.ts` & `sim-player.ts`**
  - Cập nhật `CHARACTERS`:
    - `vanguard`: `hp: 6`, `armor: 5`, `armorRegenDelaySec: 4.5`, `armorRegenPerSec: 0.65`
    - `engineer`: `hp: 6`, `armor: 4`, `armorRegenDelaySec: 5.2`, `armorRegenPerSec: 0.65`
    - `ranger`: `hp: 5`, `armor: 3`, `armorRegenDelaySec: 5.2`, `armorRegenPerSec: 0.65`
    - `druid`: `hp: 5`, `armor: 3`, `armorRegenDelaySec: 5.2`, `armorRegenPerSec: 0.65`
    - `elementalist`: `hp: 4`, `armor: 2`, `armorRegenDelaySec: 5.2`, `armorRegenPerSec: 0.65`
  - Tại `sim-player.ts:196`: giảm hệ số nội tại hồi giáp của Kỹ sư (`engineer`) từ `1.3` xuống **`1.15`**.
- [ ] **Step 2: Điều chỉnh Dash, I-Frame, `knight_sword` và Sàn Lửa**
  - Tại `world-sim-types.ts:77-78`: đặt `DASH_IFRAME_SEC = 0.16` và `DASH_COOLDOWN_SEC = 1.85`.
  - Tại `sim-player.ts:238`: đổi hệ số giảm hồi chiêu lướt của buff `gale_reflex` từ `0.75` thành **`0.82`**.
  - Tại `sim-combat-damage.ts:870`: giảm i-frame sau khi nhận sát thương trực tiếp từ `0.6s` xuống **`0.35s`** (`p.invulnerableTimer = isDotTick ? Math.max(p.invulnerableTimer, 0.3) : 0.35`).
  - Tại `packages/shared/src/data/weapons.ts:12-16`: chỉnh `knight_sword` sang `fireRate: 1.75` (từ `2.2`) và `spreadDeg: 85` (từ `110`).
  - Tại `sim-player.ts:465`: giảm ngưỡng tích nhiệt của `burning_oil`, `burning_grass`, `lava` từ `0.75s` xuống **`0.35s`**.

---

### Task B1.5: Tăng Mật độ Quái, Đa dạng Vị trí Spawn & Nhịp độ Tràn Đợt (Wave Cadence)

**Files:**
- Modify: `packages/shared/src/sim/dungeon-gen.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Tăng số lượng quái và số đợt trong `dungeon-gen.ts`**
  - Đặt `baseEnemyCount = Math.min(11, 7 + Math.floor((w + floorNumber) * 0.8))` (từ `7` đến `11` quái mỗi đợt).
  - Phòng chiến đấu thường có **2–3 đợt** ở tầng 1 và **3 đợt** ở các phòng/tầng tiếp theo.
  - Ở các tầng sâu (tầng 2–3), đợt cuối của phòng Tinh anh (`isChallenge`) hoặc phòng Cổng (`portal`) có thể xuất hiện **2 Tinh anh** đi kèm **`+2` quái thường hộ tống**.
- [ ] **Step 2: Phân bổ 10–12 điểm spawn bao quanh chu vi và 4 góc phòng trong `sim-dungeon-rooms.ts`**
  - Thay thế 6 điểm lệch phải quanh `width * 0.64` bằng **10–12 điểm spawn** phân bổ quanh chu vi và 4 góc phòng lấy tâm `(this.map.width * 0.5, this.map.height * 0.5)`.
  - Khi chọn vị trí spawn cho từng quái, ưu tiên lọc các điểm cách mọi người chơi còn sống tối thiểu **`140 px`** (nếu tất cả đều gần hơn 140 px thì chọn điểm xa người chơi nhất) và gọi `this.map.resolveCircleCollision` để không kẹt tường/cột.
- [ ] **Step 3: Đẩy nhanh nhịp tràn đợt kế tiếp trong `sim-progression-bot.ts`**
  - Kích hoạt đợt quái kế tiếp khi số quái còn sống của đợt hiện tại `<= Math.max(2, Math.ceil(waveTotal * 0.3))` **hoặc** khi `this.waveElapsedSec >= 9.5` (giảm từ `12.0s`).

---

### Task B1.6: Thu hẹp Thưởng Tượng thần (Shrine) & Tỷ lệ Rương Phòng Thường

**Files:**
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Test: `packages/shared/test/balance-overhaul-b1.test.ts`

- [ ] **Step 1: Thu hẹp phần thưởng Tượng thần trong `sim-progression-bot.ts` và `sim-dungeon-rooms.ts`**
  - Giảm lượng tăng năng lượng tối đa khi cầu nguyện Tượng thần từ `+30` xuống **`+15`** (`p.maxEnergy += 15`).
  - **Xóa bỏ hoàn toàn** việc rơi thêm vũ khí miễn phí cấp `epic` / `legendary` tại Tượng thần (`sim-progression-bot.ts:38-50`). Cập nhật lại `dialogueVi` của Tượng thần cho khớp.
- [ ] **Step 2: Giảm tỷ lệ xuất hiện Rương ở phòng chiến đấu thường trong `sim-dungeon-rooms.ts`**
  - Trong `onRoomClearedImpl`: phòng chiến đấu thường (`room.type === 'combat' && !room.isChallenge`) chỉ có **45% cơ hội (`this.rng.chance(0.45)`)** xuất hiện rương vũ khí.
  - Phòng Tinh anh/Thử thách (`room.isChallenge`) và phòng Boss giữ nguyên **100%** xuất hiện rương.

---

## Phase B2: Đại tu Trận đánh Boss & Hiệu chuẩn Mô phỏng Cân bằng (Boss Overhaul & Balance Calibration)

### Task B2.1: Đại tu Máu Boss, Đạn Tỏa 360° & Xóa Bơm Máu/Năng lượng Tự động

**Files:**
- Modify: `packages/shared/src/data/enemies.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome1.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome2.ts`
- Modify: `packages/shared/src/sim/sim-enemies-biome3.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts`
- Test: `packages/shared/test/balance-overhaul-b2.test.ts`

- [ ] **Step 1: Tăng máu 3 Boss trong `packages/shared/src/data/enemies.ts`**
  - `spore_king`: `hp: 5200` (từ `3500`)
  - `kryssa_ice_queen`: `hp: 6800` (từ `4450`)
  - `forge_titan`: `hp: 9600` (từ `6850`)
- [ ] **Step 2: Khôi phục đạn tỏa tròn 360° thực sự và tăng nhịp kỹ năng cho 3 Boss**
  - `spore_king` (`sim-enemies-biome1.ts`):
    - Đổi mọi công thức `(Math.PI * 1.5) / (count - 1)` sang **`(Math.PI * 2) / count`** (cho cả vòng 8 viên ở `stateTimer <= 0.6` và vòng `ringCount` viên ở `stateTimer <= 0`).
    - Xoay lệch góc khởi đầu giữa các nhịp bắn (`angleToPlayer` ở nhịp chẵn, `angleToPlayer + Math.PI / count` ở nhịp lẻ).
    - Giảm ~15% thời gian nghỉ (`cooldown`) giữa các đợt tung chiêu.
  - `kryssa_ice_queen` (`sim-enemies-biome2.ts`):
    - Đổi vòng đạn băng sang **`(Math.PI * 2) / ringCount`** với góc xoay lệch luân phiên giữa các lần bắn.
    - Tăng nhẹ tốc độ đạn băng và giảm ~15% thời gian chờ giữa các nhịp lướt/bắn.
  - `forge_titan` (`sim-enemies-biome3.ts`):
    - Đổi dải đạn nện búa (`barrageCount`) và quét lửa (`8` viên) sang **`(Math.PI * 2) / count`** với góc lệch luân phiên.
    - Giảm ~15% thời gian telegraph/nghỉ giữa các đòn.
- [ ] **Step 3: Xóa bỏ cơ chế bơm tự động hạt sinh mệnh & năng lượng vào tọa độ người chơi `(pl.x, pl.y)`**
  - Trong `sim-combat-damage.ts`:
    - Khi tiêu diệt quái phụ trong phòng Boss hoặc phá `forge_energy_core`, **tuyệt đối không** sinh vật phẩm ở `(pl.x, pl.y)`.
    - Quái phụ trong phòng Boss chỉ có **25% cơ hội (`this.rng.chance(0.25)`) rơi `1` `life_seed` (`amount: 1`)** ngay tại vị trí quái chết `(enemy.x, enemy.y)`.
    - Phá `forge_energy_core` rơi `1` `life_seed` (`amount: 2`) và `1` `energy` (`amount: 12`) ngay tại vị trí `(enemy.x, enemy.y)`.
  - Trong `sim-enemies-core.ts` (`clearBossNearbyProjectiles`):
    - Giảm bán kính xóa đạn khi Boss chuyển pha xuống **`140 px`** quanh mỗi người chơi còn sống (thay vì xóa toàn bộ 380 px quanh Boss).
    - Không đặt vật phẩm vào `(pl.x, pl.y)`; chỉ văng **`1` `life_seed` (`amount: 1`)** và **`2` hạt `energy` (`amount: 8`)** xung quanh vị trí của Boss `(boss.x, boss.y)` với vận tốc tỏa ra ngoài.

---

### Task B2.2: Cải thiện Chiến thuật Bot, Hiệu chuẩn `tools/balance-*` & Cập nhật Tài liệu

**Files:**
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `tools/bot-profile.ts`
- Modify: `tools/balance-simulations.ts`
- Modify: `tools/balance-harness.ts`
- Modify: `docs/BALANCE.md`
- Modify: `docs/balance-report.md`

- [ ] **Step 1: Cải thiện hành vi chiến thuật hợp lệ của Bot (`sim-progression-bot.ts`)**
  - Khi người chơi/bot thiếu máu hoặc thiếu năng lượng, chủ động di chuyển về phía `life_seed` / `energy` orb gần đó (trong khi vẫn né đạn và vũng nguy hiểm).
  - Khi vũ khí chính hết năng lượng (`p.energy < weapon.energyCost`), bot chủ động chuyển sang vũ khí dự phòng có `energyCost === 0` (`rusty_pistol` / vũ khí cận chiến) hoặc vũ khí đủ năng lượng trong túi đồ.
  - Không vi phạm các hằng số bất biến của `AVERAGE_PLAYER_BOT_PROFILE`.
- [ ] **Step 2: Hiệu chuẩn ngưỡng kiểm định trong `tools/balance-simulations.ts` & `tools/balance-harness.ts`**
  - Cập nhật các ngưỡng kỳ vọng trong `tools/balance-simulations.ts` và `tools/balance-harness.ts` để phản ánh độ khó mới chân thực (không nerf game để chiều lòng bot), đảm bảo `pnpm balance` và `pnpm verify` PASS 100%.
  - Cập nhật báo cáo và bảng thông số trong `docs/BALANCE.md` và `docs/balance-report.md`.
