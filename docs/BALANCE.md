# BẢNG SỐ LIỆU & MỤC TIÊU CÂN BẰNG (BALANCE.md) — ASHEN PACT 2.0 (Phase P3C)

> Lưu ý: Toàn bộ các chỉ số dưới đây được khai báo dạng dữ liệu có kiểu tĩnh tại `packages/shared/src/data/` (`weapons.ts`, `enemies.ts`, `scaling.ts`, `characters.ts`) và tuyệt đối không hardcode hệ số giả trong logic mô phỏng.

## 1. Kiến Trúc Cân Bằng Ashen Pact 2.0 & Hồ Sơ Bot Khóa Cứng (Spec Rev 4 — Phase P3C)

### 1.1 Đường Ống Sát Thương 3 Nhóm (`3-Bucket Damage Pipeline` — `sim-damage-pipeline.ts`)
Mọi đòn đánh của người chơi đi qua công thức chuẩn hóa 3 nhóm độc lập để ngăn bùng nổ sát thương cấp số nhân khi chồng nhiều Blessing, Đe Daedalus (`WeaponMutator`) và Khế Ước Tro Tàn (`AshenPact`):
1. **Nhóm 1 — Sát thương gốc & Cấp cường hóa (`Base × UpgradeMult`):** Sát thương cơ bản của vũ khí nhân với hệ số cường hóa Đe Nâng Cấp (`+20%` mỗi cấp).
2. **Nhóm 2 — Bể Cộng Gộp (`Additive Pool`):** Toàn bộ bonus sát thương cộng thêm (Phát Cuối `Finale Shot +50%`, `Perfect Reload Overclocked +45%`, `Tactical Vent Empowered +90%`, vùng nhiệt Cam `Orange Zone +25%`, Khiên Thiết Vệ, Blessing, Hắc Tinh) được **cộng tuyến tính vào cùng một bể** có trần bảo vệ.
3. **Nhóm 3 — Hệ Số Dễ Tổn Thương Mục Tiêu & Chí Mạng (`Target Vulnerability × CritMult`):** Nhân độc lập với trạng thái suy yếu trên mục tiêu (`Boss Armor Break +40%`, `Siêu Dẫn +30%`, `Đánh Dấu Liệp Ưng`) và hệ số chí mạng (`×1.5`). Tỉ lệ kích hoạt hiệu ứng đòn đánh được chuẩn hóa theo `procCoefficient` của từng vũ khí và giới hạn số tia đạn mỗi lần bóp cò (`clampPelletsPerTrigger`).

### 1.2 Hồ Sơ Bot "Người Chơi Trung Bình" Khóa Cứng (`Human-Like Bot Profile` — `tools/bot-profile.ts`)
- **Chính sách chống gian lận mô phỏng (`Anti-Manipulation Policy`):** Hồ sơ `AVERAGE_PLAYER_BOT_PROFILE` được đóng băng sâu (`Object.freeze`) với `godMode = false`, không nhân hệ số giả (`encounterScale`, `roomFactor` bị cấm bằng unit test):
  - **Độ chính xác ngắm (`aimAccuracy`):** `70%` (`0.70`).
  - **Độ trễ phản xạ (`reactionDelaySec`):** `250ms` (`0.25s`) trước khi né telegraph / vòng xung kích / đạn địch.
  - **Xác suất Dash né telegraph (`dashDodgeProbability`):** `65%` (`0.65`).
  - **Nhịp Nạp Đạn Hoàn Hảo / Xả Nhiệt Chiến Thuật `[R]` (`perfectReloadSuccessRate`):** `50%` (`0.50`) — gieo xác suất đúng 1 lần mỗi chu kỳ nạp đạn (`45% – 70%` Golden Window) hoặc chu kỳ vùng nhiệt Cam (`65% – 95%` Orange Heat Zone).
  - **Lật Chắn Chiến Thuật `[E]` + Đá Trượt (`tacticalCoverKickProbability`):** `40%` (`0.40`) — tận dụng bàn đá/lá chắn gần đó để cản đạn và `Dash-Kick` hất văng vào cụm quái.
  - **Phá Giáp Boss 1–2 Bước (`bossArmorBreakWindowSec`):** `[3.0s, 6.0s]` (`180 – 360 ticks @ 60Hz`) — khi Boss bật Vỏ Giáp ở ngưỡng Phase 2 (`66% HP`) và Phase 3 (`33% HP`), bot di chuyển tới vật cản / đồ chơi địa hình gần nhất (được tiếp tế định kỳ qua **Boss Supply Drop mỗi `18s`**), lật chắn `[E]` nếu cần và `Dash-Kick` phá vỡ giáp Boss (gây `6% MaxHP` sát thương chuẩn, choáng `3.0s – 4.0s` và nhận `+40%` sát thương).
  - **Tập seed cố định:** `30` seeds độc lập (`101 .. 3030`) cho mỗi cấu hình; báo cáo đồng thời trung vị **`p50`** và khoảng phân vị **`p10 – p90`**.

---

## 2. Chỉ Số Cơ Bản 5 Nhân Vật (`characters.ts`)

| ID | Tên nhân vật | Vai trò | HP | Giáp | Năng lượng | Hồi Giáp Delay | Tốc chạy (u/s) | Crit cơ bản | Vũ khí khởi đầu |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `vanguard` | **Thiết Vệ** | Tank / Bảo Hộ Tuyến Đầu | 6 | 5 | 150 | `3.0s` | 171 (`95%`) | 5% | `knight_sword` |
| `ranger` | **Liệp Ưng** | Sát Thương / Đánh Dấu | 5 | 3 | 200 | `5.2s` | 189 (`105%`) | 15% | `hunter_crossbow` |
| `elementalist` | **Lam Hỏa** | Khống Chế / Phản Ứng Nguyên Tố | 4 | 2 | 260 | `5.2s` | 180 (`100%`) | 8% | `apprentice_staff` |
| `druid` | **Mộc Linh** | Hỗ Trợ / Hồi Phục | 5 | 3 | 200 | `5.2s` | 180 (`100%`) | 5% | `thorn_staff` |
| `engineer` | **Bánh Răng** | Tiện Ích / Trụ Pháo | 6 | 4 | 180 | `5.2s` | 180 (`100%`) | 8% | `rivet_gun` |

---

## 3. Hệ Số Scaling Theo Số Người Chơi & Biome (`scaling.ts`)

### 3.1 Co-op Scaling (1–4 Người Chơi)

| Số người chơi | Hệ số HP Quái (`enemyHpMultiplier`) | Số lượng Quái / Đợt (`waveCountMultiplier`) | Tỉ lệ Elite (`eliteChance`) | Hệ số HP Boss (`bossHpMultiplier`) | Tốc bắn Quái (`enemyFireRateBonus`) |
|---:|---:|---:|---:|---:|---:|
| **1P** | `×1.00` | `×1.00` | `10%` | `×1.00` | `+0%` |
| **2P** | `×1.90` | `×1.52` | `15%` | `×1.92` | `+8%` |
| **3P** | `×2.50` | `×1.85` | `20%` | `×2.95` | `+16%` |
| **4P** | `×2.90` | `×2.15` | `25%` | `×3.85` | `+24%` |

### 3.2 Biome Scaling (`BIOME_SCALING`)

| Biome | Hệ số HP Quái (`hpMultiplier`) | Hệ số Cooldown Địch (`cooldownScale`) | Tốc đạn Địch | Hệ số HP Elite | Hệ số EHP Boss (`bossHpScale`) | Bước tăng độ khó thực đo (`WorldSim`) |
|---:|---:|---:|---:|---:|---:|---:|
| **Biome 1** | `×1.00` | `×1.00` | `×1.00` | `×1.00` (`+1 DMG`) | `×1.50` | Cơ sở (`×1.00`) |
| **Biome 2** | `×1.27` | `×0.91` | `×1.06` | `×1.06` (`+1 DMG`) | `×1.05` | **`+24.1%`** (`×1.24`) |
| **Biome 3** | `×1.35` | `×0.87` | `×1.12` | `×1.12` (`+2 DMG`) | `×2.08` | **`+21.9%`** (`×1.51`) |

---

## 4. Cân Bằng 18 Vũ Khí Độc Bản: Nhịp Bắn & DPS Thường vs Active `[R]` (`weapons.ts` / Spec 3.3)

- **5 Vũ khí Khởi đầu (`⭐`):** Độ lệch DPS Active `[R]` chỉ **`±1.2%`** (`52.9 – 54.1 DPS`, mục tiêu `< 5.0%`).
- **Toàn bộ 18/18 Vũ khí:** Đều có `activeDps > normalDps` rõ rệt khi người chơi làm chủ nhịp `CLIP_RELOAD` (`[R]` Golden Window + `Finale Shot`), `HEAT_VENT` (`Orange Zone` + `[R]` Tactical Vent) hoặc `MELEE_COMBO` (Đòn 3 Tuyệt Kỹ + `Parry Deflect`).

| # | Vũ khí | Độ hiếm | Nhịp (`Cadence`) | DPS Thường | DPS Active `[R]` | Tăng khi Active `[R]` | Cơ chế Tuyệt Kỹ / Active `[R]` |
|---:|---|---|---|---:|---:|---:|---|
| 1 | **Kiếm Hiệp Sĩ** (`knight_sword`) ⭐ | `common` | `MELEE_COMBO` | `28.4` | **`52.9`** | `+86.3%` | Combo `12 → 14 → 24` + Kiếm Khí Xuyên `240px` & Phản Đạn (`Parry Deflect`) |
| 2 | **Nỏ Săn** (`hunter_crossbow`) ⭐ | `common` | `CLIP_RELOAD` | `34.8` | **`54.1`** | `+55.5%` | Giữ tụ tên xuyên `22 DMG` + `[R]` Rút Tên Ngạnh (`Barbed Rip`) |
| 3 | **Trượng Tập Sự** (`apprentice_staff`) ⭐ | `common` | `HEAT_VENT` | `35.2` | **`53.8`** | `+52.8%` | Cầu Nổ phát thứ 3 (`17 DMG`) + `[R]` Tia Tam Nguyên Tố (`22 DMG`) & Phát Cường Hóa |
| 4 | **Trượng Gai** (`thorn_staff`) ⭐ | `common` | `CLIP_RELOAD` | `40.2` | **`53.7`** | `+33.6%` | Ghim Gai Ký Sinh + Phát Cuối & `[R]` Kích Nổ Gai Độc |
| 5 | **Súng Đinh Tán** (`rivet_gun`) ⭐ | `common` | `CLIP_RELOAD` | `40.6` | **`53.2`** | `+31.0%` | Cắm Đinh Từ Tính + Phát Cuối & `[R]` Phóng Lưới Điện |
| 6 | **Shotgun Phế Liệu** (`scrap_shotgun`) | `uncommon` | `CLIP_RELOAD` | `46.3` | **`79.4`** | `+71.5%` | Phát Cuối Đạn Lửa + `[R]` Vỏ Đạn Nổ Nhiệt |
| 7 | **Tiểu Liên Gió Lốc** (`gale_smg`) | `uncommon` | `HEAT_VENT` | `47.9` | **`67.1`** | `+40.1%` | Tăng tốc Spin-Up + Lưỡi Gió vùng Cam & `[R]` Xung Gió |
| 8 | **Súng Phóng Lựu Mảnh** (`frag_launcher`) | `uncommon` | `CLIP_RELOAD` | `42.6` | **`53.0`** | `+24.4%` | Giữ-Thả Kích Nổ Trên Không (`Airburst`) vòng qua khiên chắn |
| 9 | **Súng Điện Từ Tesla** (`tesla_carbine`) | `rare` | `CLIP_RELOAD` | `64.9` | **`77.5`** | `+19.4%` | Nảy tường thông minh (`+35%`) + Phát Cuối Sét Lan 3 mục tiêu & `[R]` `+1` lần nảy |
| 10 | **Súng Hạt Giống** (`seed_gun`) | `rare` | `CLIP_RELOAD` | `41.0` | **`55.0`** | `+34.1%` | Gieo Mầm Độc + `[R]` Nở Hoa Thu Hoạch (`Harvest Bloom`) |
| 11 | **Trượng Liên Kết** (`tether_staff`) | `rare` | `HEAT_VENT` | `46.7` | **`57.5`** | `+23.1%` | Tia Khóa Mục Tiêu + `[R]` Xung Quá Tải Liên Kết |
| 12 | **Súng Tia Hội Tụ** (`focus_laser`) | `rare` | `HEAT_VENT` | `43.2` | **`58.6`** | `+35.6%` | Tia Hội Tụ tăng sát thương theo nhiệt + `[R]` Phát Bắn Railgun |
| 13 | **Đại Đao Lục Bảo** (`emerald_cleaver`) | `epic` | `MELEE_COMBO` | `56.7` | **`81.9`** | `+44.4%` | Đòn 3 phóng Lưỡi Đao Boomerang khứ hồi + Phản Đạn |
| 14 | **Trượng Hư Không** (`void_staff`) | `epic` | `CLIP_RELOAD` | `65.3` | **`113.3`** | `+73.5%` | Cầu Hút Đạn Địch + Giữ-Thả Sụp Đổ Hư Không (`Implosion`) |
| 15 | **Rìu Chiến Berserker** (`berserker_axe`) | `epic` | `MELEE_COMBO` | `79.1` | **`118.4`** | `+49.7%` | Cuồng Huyết tăng tốc chém + Đòn 3 Bổ Đoạn Đầu Đài phá khiên & Khe Lửa |
| 16 | **Trượng Thái Dương** (`solar_archon_staff`) | `legendary` | `HEAT_VENT` | `114.2` | **`193.3`** | `+69.3%` | Đạn Hội Tụ Tiểu Thái Dương + `[R]` Bùng Nổ Siêu Tân Tinh |
| 17 | **Pháo Dung Nham** (`magma_cannon`) | `legendary` | `CLIP_RELOAD` | `65.0` | **`90.6`** | `+39.4%` | Đá Lăn Vệt Dung Nham + Phát Cuối Phun Trào Mạch Lửa |
| 18 | **Búa Lôi Thần** (`thunder_hammer`) | `legendary` | `MELEE_COMBO` | `100.8` | **`109.4`** | `+8.5%` | Tia Sét Kèm Đòn Đập + Đòn 3 Giáng Sét Lôi Thần diện rộng |

---

## 5. Chỉ Số Quái & 3 Boss Phá Giáp 1–2 Bước (`enemies.ts`)

### 5.1 Quái Thường Theo 3 Biome
- **Biome 1 — Rừng Cổ Mục Nát:** `goblin_shooter` (`48 HP`, CD `1.32s`), `green_slime` (`40 HP`, CD `1.08s`, tách `mini_slime` `20 HP`), `spore_bomber` (`34 HP`, nổ `2 DMG` — có thể chém/đá bật ngược), `wild_boar` (`72 HP`, CD `1.82s`), `goblin_shaman` (`44 HP`, CD `2.55s`), `thorn_turret` (`50 HP`, CD `1.88s`).
- **Biome 2 — Hầm Băng Vĩnh Cửu:** `frost_bat` (`44 HP`, bay), `baby_yeti` (`76 HP`, đẩy tảng băng trượt `460 px/s`), `ice_mage` (`58 HP`, khúc xạ 3 tia qua cột lăng kính băng), `ice_golem` (`96 HP`, giáp băng trực diện giảm `75%` — vỡ tức thì khi trúng tảng băng trượt hoặc va tường), `snow_spirit` (`44 HP`, kết tinh thành tảng băng trượt khi nổ).
- **Biome 3 — Lò Rèn Dung Nham:** `fire_imp` (`56 HP`), `dwarf_cannon` (`80 HP`, pháo cối cầu vồng vượt chắn thấp), `coal_golem` (`112 HP`, rơi bom than `2.0s` có thể `Dash-Kick` `560 px/s`), `welder_drone` (`62 HP`, nổ xung EMP `r=110px` khi bị hạ), `iron_shielder` (`104 HP`, khiên thép trực diện giảm `80%`, dẫn điện hình nón phía sau khi trúng Sét).

### 5.2 Cân Bằng 3 Boss Cuối Màn (`1–2 Step Boss Armor Break` & `Supply Drop 18s`)

| Biome | Boss | HP Cơ Bản (`enemies.ts`) | Thời gian hạ `1P` (`p50`) | Thời gian hạ `4P` (`p50`) | Lệch `1P ↔ 4P` | Winrate Solo (`30 seeds`) | Max Hit / EHP | One-Shot |
|---:|---|---:|---:|---:|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc** (`spore_king`) | `5200` | **`83.42s`** | **`76.77s`** | **`±8.0%`** | **`90%`** (`80–95%`) | `38%` | `0` (`zeroOneShots`) |
| **Biome 2** | **Băng Hậu Kryssa** (`kryssa_ice_queen`) | `6800` | **`77.78s`** | **`77.47s`** | **`±0.4%`** | **`90%`** (`70–90%`) | `21%` | `0` (`zeroOneShots`) |
| **Biome 3** | **Titan Lò Rèn** (`forge_titan`) | `9600` | **`74.41s`** | **`75.89s`** | **`±2.0%`** | **`77%`** (`60–85%`) | `30%` | `0` (`zeroOneShots`) |

---

## 6. Kết Quả Kiểm Chứng Tự Động 9 Chỉ Tiêu (Headless Balance Harness — Phase P3C)

Báo cáo đầy đủ được sinh tự động tại [`docs/balance-report.md`](./balance-report.md) qua lệnh `pnpm balance` (`tools/balance-harness.ts`, chạy **2.239 lượt mô phỏng** trên `WorldSim` 60Hz với `godMode = false` và `30 seeds` khóa cứng):

| # | Chỉ tiêu cân bằng (Spec 3.10 & Phase P3C) | Mục tiêu thiết kế | Kết quả thực đo (`p50`, `p10 – p90`) | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.6s – 1.5s` | **p50 1.42s** (`0.92s – 2.33s`) | ✅ ĐẠT |
| 2 | **Thời lượng Phòng combat (1–4P)** | `35s – 70s` | **p50 36.77s** (`27.3s – 49.27s`) | ✅ ĐẠT |
| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | `25% – 50% tổng` | **p50 25%** (`0% – 88.75%`) | ✅ ĐẠT |
| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | `60s – 120s` (Lệch `≤ ±20%`) | **B1: 83.42s/76.77s · B2: 77.78s/77.47s · B3: 74.41s/75.89s** | ✅ ĐẠT |
| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | `B1: 80–95%, B2: 70–90%, B3: 60–85%` | **B1: 90% · B2: 90% · B3: 77%** (`zeroOneShots: true`) | ✅ ĐẠT |
| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | `+20% – 25%` mỗi Biome | **Biome 2 `+24.1%` · Biome 3 `+21.9%`** | ✅ ĐẠT |
| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | `4 – 10 đòn` · Lệch `≤ ±15%` | **`4 – 9 đòn` · Lệch `±0.1%`** (`5/5` Class Solo Boss PASS) | ✅ ĐẠT |
| 8 | **Độ lệch DPS 5 Vũ khí Khởi đầu & Active `[R]` 18 Vũ khí** | Lệch `< 5.0%` · `Active > Normal` | **Lệch `±1.2%` · `18/18 Active > Normal`** | ✅ ĐẠT |
| 9 | **Độ lệch Tỉ lệ thắng 5 Class (`1P / 2P / 4P × 30 seeds`)** | Lệch `≤ ±6.0%` | **Lệch `±3.8%`** (`93.3% – 99.0%` tổng hợp) | ✅ ĐẠT |
