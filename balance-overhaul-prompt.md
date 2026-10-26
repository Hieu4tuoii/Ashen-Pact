/using-superpowers

# VAI TRÒ & MỤC TIÊU TỔNG THỂ

Bạn là **Principal Game Systems Architect & Combat Balance Designer** của dự án **Ashen Pact** — game 2D Top-Down Action Roguelike Co-op kiểu Soul Knight (TypeScript monorepo: `packages/shared`, `apps/client`, `apps/server`, `tools`).

Trong đợt tinh chỉnh trước (`Polish P11`), để ép bộ giả lập bot (`pnpm balance`) đạt tỷ lệ thắng cao mà không nâng cấp AI né đạn của bot, hệ thống đã bị chèn nhiều **cơ chế giảm độ khó nhân tạo**:
1. Hồi năng lượng tự động liên tục ngay cả khi đang xả đạn + rơi cầu năng lượng 100% mỗi quái.
2. Vàng rơi tràn lan gấp ~6 lần khả năng tiêu thụ của Cửa hàng & Tượng Thần.
3. Lỗi nghiêm trọng ở chế độ **Solo**: `autoRevivePlayer` mặc định `true` khiến người chơi Solo chết được hồi sinh lập tức đầy 100% Máu & Giáp thay vì thua (`defeat`).
4. Chỉ số Giáp khởi điểm cao, hồi giáp nhanh, lướt (`Dash`) hồi quá lẹ (`1.2s` tính từ lúc bấm), và `invulnerableTimer` khi trúng đòn dài tới `0.6s`.
5. Số lượng quái mỗi đợt ít (`5–7` con), tụm lại ở 6 điểm cố định lệch phải phòng.
6. Boss bị gọt máu thấp, đòn bắn tỏa tròn (`radial`) bị khoét **góc trống nhân tạo ~90° ngay trước mặt người chơi**, và mỗi khi diệt quái phụ hoặc chuyển pha thì hệ thống tự động nhét `life_seed` + `energy` thẳng vào tọa độ `(pl.x, pl.y)` của người chơi.
7. Tượng Thần (`Shrine`) vừa cho buff, vừa cộng `+30 maxEnergy`, lại tặng miễn phí vũ khí `Epic/Legendary`; mỗi phòng thường đều rơi rương vũ khí 100%.

**Mục tiêu của nhiệm vụ này:** Khôi phục độ khó chuẩn mực của dòng game Action Roguelike: tài nguyên (Năng lượng, Vàng) có áp lực quản lý thực sự, người chơi phải né đạn chủ động, quái đông và bao vây đa hướng, Boss thực sự nguy hiểm và kịch tính.

Bạn **BẮT BUỘC** sử dụng quy trình **Superpowers** (`using-superpowers`, `writing-plans`, `subagent-driven-development` hoặc `executing-plans`, `test-driven-development`, `verification-before-completion`) để lập kế hoạch và thực thi gói gọn trong **2 Phase (Phase B1 & Phase B2)**.

---

# MỤC 0 — QUY TẮC VẬN HÀNH & QUALITY GATE CỨNG

## 0.1. Quy trình chuẩn cho mỗi Phase
1. **Nghiên cứu & Viết Plan (`writing-plans`):** Đọc đúng các file liên quan của Phase hiện tại, lưu kế hoạch vào `docs/superpowers/plans/YYYY-MM-DD-balance-overhaul.md`.
2. **TDD (`test-driven-development`):** Viết hoặc cập nhật unit test trong `packages/shared/src/sim/*.test.ts` để kiểm chứng hành vi mới trước/song song khi sửa logic.
3. **Thực thi (`subagent-driven-development` / `executing-plans`):** Sửa code gọn, chính xác (surgical changes), giữ nguyên tính tất định (`deterministic RNG` qua `this.rng`).
4. **Kiểm định bắt buộc (`verification-before-completion`):** Cuối mỗi Phase phải chạy và dẫn chứng kết quả PASS 100%:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   ```
   Ở cuối **Phase B2**, chạy thêm bộ cổng kiểm định toàn diện:
   ```bash
   pnpm balance
   pnpm verify
   pnpm perf
   ```
5. **Bàn giao gọn:** Tóm tắt ngắn gọn bằng tiếng Việt các thay đổi và thông số đạt được sau khi hoàn tất.

## 0.2. Nguyên tắc cấm tuyệt đối (Anti-Cheat / Anti-Nerf)
- **CẤM** tạo góc mù nhân tạo trong đòn bắn của Boss/Quái hướng về phía người chơi.
- **CẤM** spawn vật phẩm hồi máu/năng lượng trực tiếp lên tọa độ của người chơi (`x: pl.x, y: pl.y`). Mọi vật phẩm rơi phải xuất hiện tại vị trí thực thể bị tiêu diệt (`enemy.x, enemy.y` hoặc `boss.x, boss.y`).
- **CẤM** hạ thấp độ khó thực tế của game chỉ để chiều lòng con bot ngây thơ trong `tools/balance-simulations.ts`. Thay vào đó, hãy điều chỉnh kỳ vọng/ngưỡng kiểm định trong `tools/balance-simulations.ts` (hoặc cải thiện chiến thuật né cơ bản của bot trong `sim-progression-bot.ts` nếu cần) sao cho phản ánh đúng độ khó mới.

---

# MỤC 1 — ĐẶC TẢ CHI TIẾT CÁC HẠNG MỤC CẦN SỬA

## 1.1. Sửa lỗi Bất tử ở chế độ Solo (`autoRevivePlayer`)
- **Hiện trạng:**
  - `packages/shared/src/sim/world-sim.ts:164`: `this.autoRevivePlayer = options.autoRevivePlayer ?? true;`
  - `apps/client/src/scenes/game-scene/arena-tiles.ts:202-216`: Khi tạo `new LocalTransport({...})` cho chế độ Solo, không truyền `autoRevivePlayer: false`.
  - `packages/shared/src/sim/sim-combat-damage.ts:896-901`: Khi `p.hp <= 0` và `this.autoRevivePlayer` là `true`, nhân vật lập tức được hồi đầy `p.hp = p.maxHp` và `p.armor = p.maxArmor` thay vì chuyển sang trạng thái thua.
- **Yêu cầu sửa:**
  1. Trong `apps/client/src/scenes/game-scene/arena-tiles.ts:202-216`: Truyền rõ `autoRevivePlayer: false` vào `LocalTransport`.
  2. Trong `packages/shared/src/sim/sim-combat-damage.ts:896-901`: Khi `this.inHub === true` thì luôn hồi sinh tại chỗ để test vũ khí ở Sảnh Tập; còn khi ở trong Dungeon (`!this.inHub`) và `this.autoRevivePlayer === false` thì người chơi Solo hết máu phải bị hạ gục và kích hoạt `this.runState = 'defeat'`.
  3. Viết unit test xác nhận: ở chế độ Solo trong hầm ngục (`inHub: false, autoRevivePlayer: false`), khi `p.hp` về `0` và không có `undying_ember`, `world.runState` phải chuyển thành `'defeat'`.

## 1.2. Cân bằng Hệ thống Năng lượng (Energy Economy)
- **Hiện trạng:**
  - `packages/shared/src/sim/sim-player.ts:163-171`: Hồi năng lượng tự động `3.5/s` chạy liên tục mỗi tick kể cả khi đang giữ cò bắn, lại dùng chung biến `this.energyRegenAccum` trên `WorldSim` (`world-sim.ts:130`) cho nhiều người chơi.
  - `packages/shared/src/data/weapons.ts`: Súng cơ bản tiêu thụ quá ít năng lượng, kết hợp với hồi tự động thành ra bắn vĩnh viễn không tụt năng lượng.
  - `packages/shared/src/sim/sim-combat-damage.ts:492-534`, `sim-props-spawning.ts:680-691`, `sim-dungeon-rooms.ts:660-706`: Quái thường rơi 100% `2 × 8 = 16 Energy`, Elite rơi `48 Energy`, thùng gỗ rơi 100% `6 Energy`, quái triệu hồi (`mini_slime`, `kryssa_clone`, `spore_guardian`) cũng rơi đầy đủ năng lượng và vàng.
- **Yêu cầu sửa:**
  1. **Cơ chế hồi năng lượng tự động (`sim-player.ts`, `world-sim-types.ts`, `world-sim.ts`):**
     - Bỏ cơ chế hồi tự động vô điều kiện khi đang giao tranh. Chỉ hồi năng lượng thụ động sau khi người chơi **ngừng tiêu hao năng lượng (không bắn vũ khí tốn energy và không dùng kỹ năng) trong `2.0s`** (chuyển bộ đếm tích lũy và delay timer về từng `SimPlayer` thay vì dùng chung trên `WorldSim`).
     - Tốc độ hồi thụ động khi ngừng bắn: **`1.5 energy/giây`** (với buff `arcane_wellspring`: `2.25 energy/giây`).
     - Vũ khí khởi điểm cấp `Common` (`rusty_pistol`, `knight_sword`) có `energyCost: 0` để làm vũ khí dự phòng khi cạn năng lượng; các vũ khí tầm xa khác giữ hoặc tăng nhẹ `energyCost` (tối thiểu `2` cho súng bắn nhanh, `4–6` cho súng tầm trung/nặng) để việc xả đạn làm tụt thanh năng lượng rõ rệt.
  2. **Rơi cầu năng lượng (`sim-combat-damage.ts`, `sim-props-spawning.ts`, `sim-dungeon-rooms.ts`):**
     - Quái triệu hồi / phân tách (`mini_slime`, `kryssa_clone`, `spore_guardian`): **KHÔNG** rơi năng lượng và vàng (hoặc `mini_slime` chỉ có 25% cơ hội rơi `1` viên `4 Energy`, tuyệt đối không rơi từ `kryssa_clone` và `spore_guardian`).
     - Quái thường: Giảm từ `100% rơi 2 × 8 (16)` xuống **55% cơ hội rơi `1` viên `6 Energy`** (trung bình `~3.3 Energy/quái`).
     - Quái Elite: Rơi **`2` viên × `8 Energy` (`16 Energy`)** thay vì `48 Energy`.
     - Boss khi chết: Rơi **`5` viên × `8 Energy` (`40 Energy`)**.
     - Phá thùng/bình (`sim-props-spawning.ts:680-691`): Giảm từ `100% rơi 6 Energy` xuống **20% cơ hội rơi `5 Energy`**.
     - Mở rương (`sim-dungeon-rooms.ts:686-695`): Giảm xuống **`1` viên `10 Energy`**.

## 1.3. Cân bằng Kinh tế Vàng (Gold Economy & Sink)
- **Hiện trạng:** Một tầng rơi `850–930 Gold` nhưng tổng tiền mua sạch Cửa hàng + Tượng Thần chỉ hết `135–155 Gold`.
- **Yêu cầu sửa:**
  1. **Giảm lượng Vàng rơi (`sim-combat-damage.ts`, `sim-props-spawning.ts`, `sim-dungeon-rooms.ts`):**
     - Quái thường (`sim-combat-damage.ts:554-573`): **60% cơ hội rơi `1–2 Gold`** (trung bình `~0.9 Gold/quái`, thay vì 100% `5 Gold`).
     - Quái triệu hồi (`mini_slime`, `kryssa_clone`, `spore_guardian`): **0 Gold**.
     - Quái Elite: **`6–9 Gold`** (thay vì `15 Gold`).
     - Boss: **`20–25 Gold`** (thay vì `30 Gold`).
     - Phá thùng/bình (`sim-props-spawning.ts:668-679`): **15% cơ hội rơi `1–2 Gold`** (thay vì 100% `4 Gold`).
     - Mở rương (`sim-dungeon-rooms.ts:696-705`): **`6–10 Gold`** (thay vì `20 Gold`).
  2. **Chuẩn hóa giá Cửa hàng & Tượng Thần (`dungeon-gen.ts:416-443`, `sim-dungeon-rooms.ts:433`):**
     - Giá vật phẩm Merchant tăng theo tầng (`floorScale = 1 + (floorNumber - 1) * 0.25`):
       - Bình máu (`hp_potion`): `30 Gold` (tầng 1) → `38` → `45`.
       - Vũ khí (`weapon`): `55 Gold` (`Rare`) / `85 Gold` (`Epic`) nhân `floorScale`.
       - Floor Buff (`buff`): `65 Gold` nhân `floorScale`.
     - Giá Tượng Thần (`Shrine` trong `sim-dungeon-rooms.ts:433`): **`40 Gold`** (hoặc `35 + (floorNumber - 1) * 10`).
     - Mục tiêu: Tổng vàng nhặt được mỗi tầng rơi vào khoảng **`90–140 Gold`**, buộc người chơi chỉ chọn mua được 1–2 món quan trọng thay vì vét sạch shop.

## 1.4. Giảm Giáp, Tốc độ Hồi Giáp, Lướt (Dash) & I-Frame
- **Hiện trạng:**
  - Giáp cao (`Vanguard 6, Engineer 5, Ranger/Druid 4, Elementalist 3`), trễ hồi ngắn (`3.3s–4.0s`), tốc độ hồi `1.0/s`.
  - `DASH_COOLDOWN_SEC = 1.2` tính ngay khi bắt đầu lướt (`0.22s`), thực tế chỉ nghỉ `0.98s` (`0.68s` nếu có `gale_reflex`).
  - `p.invulnerableTimer = 0.6` khi trúng đòn thường (`sim-combat-damage.ts:870`).
- **Yêu cầu sửa:**
  1. **Chỉ số Giáp & Hồi Giáp (`packages/shared/src/data/characters/index.ts`, `sim-player.ts`):**
     - Giảm `armor` khởi điểm của mỗi class đi **1 điểm**:
       - `vanguard`: `5` (HP `6`)
       - `engineer`: `4` (HP `6`)
       - `ranger`: `3` (HP `5`)
       - `druid`: `3` (HP `5`)
       - `elementalist`: `2` (HP `4`)
     - Tăng độ trễ trước khi bắt đầu hồi giáp (`armorRegenDelaySec`):
       - `vanguard`: từ `3.3s` lên **`4.5s`**
       - Các class khác: từ `4.0s` lên **`5.2s`**
     - Giảm tốc độ hồi giáp (`armorRegenPerSec`) của tất cả class từ `1.0` xuống **`0.65` giáp/giây**.
     - Nội tại Engineer (`sim-player.ts:196`): Giảm aura hỗ trợ hồi giáp từ `1.3` (`+30%`) xuống **`1.15` (`+15%`)**.
  2. **Lướt (`world-sim-types.ts:76-79`, `sim-player.ts:237-239`):**
     - Tăng `DASH_COOLDOWN_SEC` từ `1.2` lên **`1.85` giây**.
     - Giảm `DASH_IFRAME_SEC` từ `0.2` xuống **`0.16` giây**.
     - Giảm hiệu quả buff `gale_reflex` (`sim-player.ts:238`) từ `×0.75` (`-25%`) xuống **`×0.82` (`-18%`)**.
  3. **I-Frame sau khi trúng đạn (`sim-combat-damage.ts:870`):**
     - Giảm `p.invulnerableTimer` khi nhận sát thương thường từ `0.6s` xuống **`0.35s`** để đạn chùm/liên thanh vẫn gây nguy hiểm thực sự.

## 1.5. Tăng Số lượng Quái, Nhịp độ Đợt (Wave) & Phân bổ Vị trí Spawn
- **Hiện trạng:**
  - `dungeon-gen.ts:543`: `baseEnemyCount = Math.min(7, 5 + Math.floor((w + floorNumber - 1) / 2))` — quá ít quái.
  - `sim-dungeon-rooms.ts:495-504`: Mảng `offsets` chỉ có 6 điểm cố định tập trung quanh `cx = this.map.width * 0.64, cy = this.map.height * 0.5`, khiến từ con thứ 7 trở đi đè vị trí và người chơi chỉ cần đứng góc trái bắn sang phải.
- **Yêu cầu sửa:**
  1. **Tăng quân số & số đợt (`packages/shared/src/sim/dungeon-gen.ts:535-610`):**
     - Phòng Combat thường: Tăng số lượng quái mỗi wave lên **`7–11` con** (ví dụ: `const baseEnemyCount = Math.min(11, 7 + Math.floor((w + floorNumber) * 0.8));`).
     - Phòng Combat cuối trước Boss hoặc phòng rộng ở tầng 2–3: Cho phép **3 waves** (thay vì luôn chỉ 2 waves).
     - Phòng Elite: Tăng từ `1` lên **`2` Elite** ở tầng 2–3, đi kèm đội hình quái hộ tống đông hơn (`+2` quái thường).
  2. **Phân bổ lại điểm Spawn bao vây 4 góc & rìa phòng (`packages/shared/src/sim/sim-dungeon-rooms.ts:488-535`):**
     - Thay thế 6 điểm `offsets` lệch phải bằng danh sách **10–12 điểm spawn phân bổ quanh chu vi và 4 góc phần tư của căn phòng** (`cx = this.map.width * 0.5, cy = this.map.height * 0.5`), có kiểm tra khoảng cách tối thiểu (`>= 140 px`) tới vị trí hiện tại của người chơi để không spawn đè ngay sát mặt nhưng tạo thế gọng kìm đa hướng.
  3. **Nhịp độ tràn Wave (`packages/shared/src/sim/sim-progression-bot.ts:343-355`):**
     - Gọi đợt tiếp theo khi số quái còn sống `<= Math.max(2, Math.ceil(this.currentWaveTotal * 0.3))` hoặc sau **`9.5s`** (giảm từ `12.0s`).

## 1.6. Đại tu Áp lực Boss (Tăng Máu, Xóa Góc Chết 90°, Xóa Bơm Máu Tự Động)
- **Hiện trạng:**
  - Máu Boss thấp (`spore_king: 3500`, `kryssa_ice_queen: 4450`, `forge_titan: 6850`).
  - Các đòn bắn vòng tròn của cả 3 Boss đều bị cài `angle: angleToPlayer + 0.58..0.74` và `radialStepRad: (Math.PI * 1.48..1.58) / count`, tạo **góc trống an toàn ~90° ngay trước mặt người chơi**.
  - `sim-combat-damage.ts:407-426` và `sim-enemies-core.ts:735-767`: Tự động spawn `life_seed` và `energy` ngay tại tọa độ `(pl.x, pl.y)` của người chơi mỗi khi giết quái phụ hoặc khi Boss chuyển pha.
- **Yêu cầu sửa:**
  1. **Tăng Máu Boss (`packages/shared/src/data/enemies.ts`):**
     - `spore_king` (`enemies.ts:115`): từ `3500` lên **`5200`**.
     - `kryssa_ice_queen` (`enemies.ts:229`): từ `4450` lên **`6800`**.
     - `forge_titan` (`enemies.ts:328`): từ `6850` lên **`9600`**.
  2. **Khôi phục đạn vòng tròn 360° thực sự & tăng áp lực chiêu thức:**
     - `packages/shared/src/sim/sim-enemies-biome1.ts` (`spore_king`, quanh dòng `720-785`):
       - Đổi `radialStepRad` về **`(Math.PI * 2) / count`** (360° kín vòng), xen kẽ góc lệch giữa các nhịp bắn (`angleToPlayer` ở nhịp 1, `angleToPlayer + Math.PI / count` ở nhịp 2) để người chơi phải di chuyển lách qua khe đạn.
       - Giảm nhẹ thời gian nghỉ giữa các kỹ năng của `spore_king` đi ~15%.
     - `packages/shared/src/sim/sim-enemies-biome2.ts` (`kryssa_ice_queen`, quanh dòng `655-680`):
       - Đổi `radialStepRad` về **`(Math.PI * 2) / ringCount`**, tăng nhẹ tốc độ đạn băng và tần suất lao (`ice_charge`).
     - `packages/shared/src/sim/sim-enemies-biome3.ts` (`forge_titan`, quanh dòng `545-595`):
       - Đổi `radialStepRad` về **`(Math.PI * 2) / barrageCount`** và **`(Math.PI * 2) / 8`**, rút ngắn thời gian cảnh báo dậm đất/lava để buộc người chơi phản xạ nhanh.
  3. **Xóa cơ chế bơm máu/năng lượng tự động vào chân người chơi:**
     - Trong `packages/shared/src/sim/sim-combat-damage.ts:407-426`: Xóa việc spawn `life_seed` tại `x: pl.x, y: pl.y` mỗi khi giết quái phụ trong phòng Boss. Thay vào đó, quái phụ trong phòng Boss khi chết chỉ có **25% cơ hội rơi `1` `life_seed` (`amount: 1`) ngay tại vị trí quái chết (`enemy.x, enemy.y`)**, khiến người chơi muốn hồi máu phải mạo hiểm di chuyển ra nhặt.
     - Trong `packages/shared/src/sim/sim-enemies-core.ts:735-767` (`clearBossNearbyProjectiles`): Khi Boss chuyển pha (`phase 2 / phase 3`), **chỉ xóa đạn trong bán kính nhỏ quanh người chơi (`140 px` thay vì `260 px`)** để tránh sát thương oan lúc chuyển trạng thái, và rơi **`1` `life_seed` (`amount: 1`) + `2` viên `energy` (`amount: 8`) xung quanh vị trí của Boss (`boss.x, boss.y`)** thay vì nhét thẳng vào `(pl.x, pl.y)`.

## 1.7. Kiểm soát Rương Vũ khí, Tượng Thần (Shrine), Cận chiến & Bẫy Môi trường
- **Yêu cầu sửa:**
  1. **Tượng Thần (`packages/shared/src/sim/sim-progression-bot.ts:26-49` - `activateShrineImpl`):**
     - Giữ phần ban phước **1 Floor Buff** và hồi giáp hiện tại, nhưng:
       - Giảm lượng cộng thêm `maxEnergy` từ `+30` xuống **`+15`**.
       - **XÓA** việc luôn tặng kèm 1 vũ khí `['epic', 'legendary']` miễn phí ở dòng `38-49`. Tượng Thần là nơi mua Buff, không phải máy in vũ khí Huyền Thoại ở ngay Tầng 1.
  2. **Rương sau phòng Combat (`packages/shared/src/sim/sim-dungeon-rooms.ts:591-594`):**
     - Phòng Combat thường: Chỉ có **45% cơ hội xuất hiện rương vũ khí** sau khi dọn sạch phòng (phòng Elite và Boss giữ 100%).
  3. **Cân bằng `knight_sword` (`packages/shared/src/data/weapons.ts:12-21`):**
     - Giảm `fireRate` từ `2.2` xuống **`1.75`** và `spreadDeg` từ `110` xuống **`85`** để không thể đứng yên quạt kiếm xóa toàn bộ mưa đạn trước mặt.
  4. **Bẫy dung nham/lửa (`packages/shared/src/sim/sim-player.ts:460-474`):**
     - Giảm thời gian chờ kích hoạt bỏng trên bề mặt `lava`/`fire` từ `0.75s` xuống **`0.35s`**.

---

# MỤC 2 — LỘ TRÌNH THỰC THI 2 PHASE

## PHASE B1: Kinh tế Tài nguyên, Sinh tồn Người chơi & Mật độ Quái phòng Combat
**Phạm vi thực hiện:**
1. Sửa lỗi bất tử Solo (`autoRevivePlayer: false` ở `arena-tiles.ts` + điều kiện `inHub` ở `sim-combat-damage.ts`).
2. Triển khai cơ chế hồi năng lượng ngoài giao tranh (`2.0s` delay, `1.5/s` per-player accumulator) và giảm tỷ lệ/số lượng rơi Energy + Gold từ quái, thùng, rương; chặn rơi đồ từ quái triệu hồi (`mini_slime`, `kryssa_clone`, `spore_guardian`).
3. Cập nhật bảng giá Merchant theo tầng (`dungeon-gen.ts`) và giá Shrine (`sim-dungeon-rooms.ts`); xóa tặng vũ khí `Epic/Legendary` miễn phí tại Shrine (`sim-progression-bot.ts`); giảm tỷ lệ xuất hiện rương ở phòng thường xuống `45%`.
4. Cập nhật chỉ số Giáp, trễ hồi giáp, tốc độ hồi giáp (`characters/index.ts`), `DASH_COOLDOWN_SEC = 1.85`, `DASH_IFRAME_SEC = 0.16`, `invulnerableTimer = 0.35`, `knight_sword`, và bẫy `lava/fire` (`0.35s`).
5. Tăng số lượng quái mỗi wave (`7–11`), mở rộng 10–12 điểm spawn bao vây quanh phòng (`sim-dungeon-rooms.ts`), và rút ngắn nhịp tràn wave (`9.5s`).
6. Cập nhật/bổ sung unit test trong `packages/shared/src/sim/*.test.ts` và chạy `pnpm typecheck && pnpm lint && pnpm test`.

## PHASE B2: Đại tu Áp lực Boss & Đồng bộ Balance Harness / Quality Gate
**Phạm vi thực hiện:**
1. Tăng máu 3 Boss (`5200 / 6800 / 9600` trong `enemies.ts`).
2. Khôi phục đạn tỏa tròn 360° thực sự (xóa góc chết nhân tạo 90°) và tăng nhịp độ kỹ năng cho `spore_king` (`sim-enemies-biome1.ts`), `kryssa_ice_queen` (`sim-enemies-biome2.ts`), và `forge_titan` (`sim-enemies-biome3.ts`).
3. Xóa cơ chế tự bơm `life_seed` / `energy` vào tọa độ người chơi (`pl.x, pl.y`) trong `sim-combat-damage.ts` và `sim-enemies-core.ts`.
4. Kiểm tra và nâng cấp nhẹ AI điều khiển bot giả lập trong `sim-progression-bot.ts` (ưu tiên nhặt `life_seed`/cầu năng lượng gần đó và tự đổi sang vũ khí `0 energy` khi cạn năng lượng) + cập nhật ngưỡng kỳ vọng hợp lý trong `tools/balance-simulations.ts` & tài liệu `docs/BALANCE.md`, `docs/balance-report.md` để phản ánh độ khó mới.
5. Chạy toàn bộ cổng kiểm định cuối cùng:
   - `pnpm typecheck`
   - `pnpm lint`
   - `pnpm test`
   - `pnpm balance`
   - `pnpm verify`
   - `pnpm perf`

---

# MỤC 3 — HƯỚNG DẪN BẮT ĐẦU NGAY

1. Kích hoạt quy trình `using-superpowers` -> `writing-plans`.
2. Đọc các file mục tiêu của **Phase B1**, lập kế hoạch thực thi ngắn gọn vào `docs/superpowers/plans/2026-10-22-balance-overhaul.md` (bao gồm cả Phase B1 và Phase B2 trong 1 file plan để tiện theo dõi).
3. Bắt tay thực thi **Phase B1** ngay lập tức, sau đó chuyển tiếp sang **Phase B2** và hoàn tất toàn bộ Quality Gate. Luôn phản hồi bằng **tiếng Việt**.
