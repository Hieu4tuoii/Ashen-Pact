# BẢNG SỐ LIỆU & MỤC TIÊU CÂN BẰNG (BALANCE.md) — ASHEN PACT 2.0 (Phase P5 — v2.0.0 Final)

> Lưu ý: Toàn bộ các chỉ số dưới đây được khai báo dạng dữ liệu có kiểu tĩnh tại `packages/shared/src/data/` (`weapons.ts`, `enemies.ts`, `scaling.ts`, `characters/index.ts`, `blessings.ts`, `weapon-mutators.ts`, `duo-boons.ts`, `ashen-pacts.ts`) và kiểm định tự động trên `WorldSim` 60Hz thực tế, tuyệt đối không hardcode hệ số giả trong mô phỏng.

## 1. Kiến Trúc Cân Bằng Ashen Pact 2.0 & Đường Ống Chống Nổ Số Nhân

### 1.1 Đường Ống Sát Thương 3 Nhóm & Trần Bảo Vệ (`sim-damage-pipeline.ts`)
Mọi đòn đánh của người chơi đi qua phương trình chuẩn hóa 3 nhóm độc lập để ngăn bùng nổ sát thương cấp số nhân khi chồng nhiều Phước Lành Hành Động (`ActionBlessing`), Bản Độ Daedalus (`WeaponMutator`), Phước Lành Giao Thoa (`DuoBoon`) và Di Vật Thức Tỉnh (`AwakenedRelic`):

$$\text{FinalDamage} = \text{round}\Big(D_{\text{base}} \times M_{\text{upgrade}} \times M_{\text{AdditivePool}}(S) \times M_{\text{Crit}} \times M_{\text{EnemyVuln}} \times M_{\text{Reaction}}\Big)$$

1. **Nhóm 1 — Sát Thương Gốc & Cấp Tinh Luyện (`Base × UpgradeMult`):**
   - $M_{\text{upgrade}} = 1 + 0.20 \times \text{upgradeLevel}$ (`Level 0..3` $\implies 1.00\times \to 1.60\times$).
2. **Nhóm 2 — Bể Cộng Gộp Có Trần Mềm & Trần Cứng (`Additive Pool`):**
   - Toàn bộ bonus sát thương cộng thêm (`Finale Shot +50%`, `Overclocked Shot +45%`, `Orange Heat Zone +25%`, `Bounce +35%/lần`, `Khiên Thiết Vệ +15%..+75%`, `Vùng Lam Hỏa +15%`, `Lăng Kính +20%`, Khế Ước & Di Vật) được cộng tuyến tính vào tổng $S$:
     - **Trần Mềm (`Soft Cap = 2.80×` khi $S > 1.80$, hệ số dốc `0.35`):** $M_{\text{AdditivePool}}(S) = 2.80 + 0.35 \times (S - 1.80)$.
     - **Trần Cứng (`Hard Cap = 3.80×`):** `ADDITIVE_POOL_HARD_CAP_MULT = 3.80`.
3. **Nhóm 3 — Suy Yếu Mục Tiêu, Chí Mạng & Phản Ứng (`EnemyVuln × Crit × Reaction`):**
   - **Trần Suy Yếu Mục Tiêu (`M_EnemyVuln <= 1.75×`):** Cộng tuyến tính từ `Đánh Dấu Liệp Ưng (+25%)`, `Siêu Dẫn (+25%..+30%)`, `Mưa Axit Caustic (+25%)`, `Phá Giáp Boss (+40%)`, kẹp cứng tại `ENEMY_VULN_HARD_CAP_MULT = 1.75×`.
   - **Chí Mạng (`M_Crit`):** `×1.50` mặc định.
   - **Phản Ứng Vỡ Băng (`Shatter`):** `×2.00` trên quái thường/Tinh Anh (`SHATTER_REGULAR_MULT`), kẹp tại **`×1.35` trên Boss** (`SHATTER_BOSS_CAP_MULT`).
4. **Quy Tắc Tách Đạn Một Thế Hệ & Bảo Vệ Boss Cuối Game (`One-Split Rule & Boss Safeguards`):**
   - **Quy tắc Tách Đạn 1 Thế Hệ (`MAX_SPLIT_GENERATION = 1`):** Đạn gốc (`splitGeneration = 0`) chỉ được phân tách đúng **1 lần duy nhất** thành đạn con (`splitGeneration = 1`). Nếu đạn con tiếp tục đi qua Lăng Kính/Khiên/Bia Chắn tách đạn, hệ thống **không sinh thêm đạn mới** mà chuyển thành `+20% Additive DMG` + `+1` lần nảy (`MAX_BOUNCE_COUNT = 4`).
   - **Trần Tia Đạn Mỗi Lần Bóp Cò:** `MAX_PELLETS_PER_TRIGGER = 9`.
   - **Trần Đòn Đơn Lên Boss (`Boss Single-Hit Cap = 18.0×`):** `BOSS_SINGLE_HIT_MAX_MULT = 18.0` lần sát thương cơ bản của vũ khí mạnh nhất đang mang (`clampBossPlayerHitDamage`).
   - **Giảm Chấn Đa Proc Cửa Sổ Trượt `3.0s` (`dampenBossMultiProcDamage`):** Trên cửa sổ `180 ticks` (`3.0s`), sau từ `10` hit trở lên vượt ngưỡng `4.5% MaxHP / 3s` (`1.5% MaxHP/s`), phần sát thương dội dư từ chuỗi proc dày đặc được giảm chấn với hệ số `0.12` để đảm bảo Boss Tầng 6 luôn duy trì trận chiến chiến thuật `>= 45.0s` ngay cả trước đội hình full-synergy cuối game.

### 1.2 Hồ Sơ Bot "Người Chơi Trung Bình" Khóa Cứng (`tools/bot-profile.ts`)
- **Chính sách chống gian lận mô phỏng (`Anti-Manipulation Policy`):** Hồ sơ `AVERAGE_PLAYER_BOT_PROFILE` bị đóng băng sâu (`Object.freeze`) với `godMode = false`, không nhân hệ số giả:
  - `aimAccuracy = 70%` (`0.70`), `reactionDelaySec = 0.25s` (`250ms`), `dashDodgeProbability = 65%` (`0.65`).
  - `perfectReloadSuccessRate = 50%` (`0.50` — canh nhịp `[R]` trong Khung Vàng `45%–70%` hoặc Vùng Nhiệt Cam `65%–95%`).
  - `tacticalCoverKickProbability = 40%` (`0.40` — chủ động lật chắn `[E]` và `Dash-Kick`).
  - `bossArmorBreakWindowSec = [3.0s, 6.0s]` — tận dụng Bia Chắn / Đồ Chơi từ **Boss Supply Drop mỗi `18.0s`** để phá Vỏ Giáp Boss ở mốc `66%` và `33%` HP.
  - **Tập seed khóa cứng:** `30` seeds độc lập (`101 .. 3030`) cho mỗi kịch bản; báo cáo đồng thời trung vị **`p50`** và phân vị **`p10 – p90`**.

---

## 2. Chỉ Số Cơ Bản 5 Nhân Vật — Không Thanh Năng Lượng (`characters/index.ts`)

> Thanh Năng lượng (`Energy`) đã được loại bỏ hoàn toàn trong Ashen Pact 2.0. Vũ khí vận hành theo `CLIP_RELOAD` / `HEAT_VENT` / `MELEE_COMBO`, còn kỹ năng nhân vật vận hành thuần theo **Skill Cooldown (s)**.

| ID | Tên nhân vật | Vai trò | HP | Giáp | Delay Hồi Giáp | Tốc chạy (u/s) | Crit cơ bản | Skill Cooldown (Thời lượng) | Vũ khí khởi đầu (Ô 1) |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `vanguard` | **Thiết Vệ** | Tank / Bảo Hộ Tuyến Đầu | 6 | 5 | `3.0s` | 171 (`95%`) | 5% | **`9.0s`** (`4.0s`) | `knight_sword` |
| `ranger` | **Liệp Ưng** | Sát Thương / Đánh Dấu | 5 | 3 | `5.2s` | 189 (`105%`) | 15% | **`7.0s`** (Dấu `6.0s`) | `hunter_crossbow` |
| `elementalist` | **Lam Hỏa** | Khống Chế / Phản Ứng Nguyên Tố | 4 | 2 | `5.2s` | 180 (`100%`) | 8% | **`8.0s`** (`5.0s`) | `apprentice_staff` |
| `druid` | **Mộc Linh** | Hỗ Trợ / Hồi Phục | 5 | 3 | `5.2s` | 180 (`100%`) | 5% | **`12.0s`** (`6.0s`) | `thorn_staff` |
| `engineer` | **Bánh Răng** | Tiện Ích / Trụ Pháo | 6 | 4 | `5.2s` | 180 (`100%`) | 8% | **`10.0s`** (`10.0s`) | `rivet_gun` |

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
| **Biome 1** | `×1.00` | `×1.00` | `×1.00` | `×1.00` (`+1 DMG`) | `×1.50` | Cơ sở (`×1.00`, EHP TB `48`) |
| **Biome 2** | `×1.27` | `×0.91` | `×1.06` | `×1.06` (`+1 DMG`) | `×1.05` | **`+24.1%`** (`×1.24`, EHP TB `89.5`) |
| **Biome 3** | `×1.35` | `×0.87` | `×1.12` | `×1.12` (`+2 DMG`) | `×2.08` | **`+21.9%`** (`×1.51`, EHP TB `123`) |

---

## 4. Cân Bằng 18 Vũ Khí Độc Bản: DPS Thường vs DPS Active `[R]` (`weapons.ts` / Báo cáo P5.2)

- **5 Vũ khí Khởi đầu (`⭐`):** Độ lệch DPS Active `[R]` chỉ **`±1.2%`** (`52.9 – 54.1 DPS`, mục tiêu `< 5.0%`).
- **Toàn bộ 18/18 Vũ khí (`9 CLIP_RELOAD`, `5 HEAT_VENT`, `4 MELEE_COMBO`):** Đều đạt `Active DPS > Normal DPS` trên mô phỏng thực tế `WorldSim` 60Hz.

| # | Vũ khí | Độ hiếm | Nhịp (`Cadence`) | DPS Thường (`WorldSim`) | DPS Active `[R]` (`WorldSim`) | Tăng khi Active `[R]` | Cơ chế Tuyệt Kỹ / Active `[R]` |
|---:|---|---|---|---:|---:|---:|---|
| 1 | **Kiếm Hiệp Sĩ** (`knight_sword`) ⭐ | `common` | `MELEE_COMBO` | `28.4` | **`52.9`** | `+86.3%` | Combo `12 → 14 → 24` + Kiếm Khí Xuyên `240px` & `Parry Deflect` |
| 2 | **Nỏ Săn** (`hunter_crossbow`) ⭐ | `common` | `CLIP_RELOAD` | `34.8` | **`54.1`** | `+55.5%` | Giữ tụ tên xuyên `22 DMG` + `[R]` Rút Tên Ngạnh (`Barbed Rip`) |
| 3 | **Trượng Tập Sự** (`apprentice_staff`) ⭐ | `common` | `HEAT_VENT` | `35.2` | **`53.8`** | `+52.8%` | Cầu Nổ phát thứ 3 (`17 DMG`) + `[R]` Tia Tam Nguyên Tố (`22 DMG`) |
| 4 | **Trượng Gai** (`thorn_staff`) ⭐ | `common` | `CLIP_RELOAD` | `40.2` | **`53.7`** | `+33.6%` | Ghim Gai Ký Sinh + Phát Cuối kéo quái & `[R]` Kích Nổ Gai Độc |
| 5 | **Súng Đinh Tán** (`rivet_gun`) ⭐ | `common` | `CLIP_RELOAD` | `40.6` | **`53.2`** | `+31.0%` | Cắm Đinh Từ Tính + Phát Cuối & `[R]` Phóng Lưới Hồ Quang Điện |
| 6 | **Shotgun Phế Liệu** (`scrap_shotgun`) | `uncommon` | `CLIP_RELOAD` | `46.3` | **`79.4`** | `+71.5%` | `Point-Blank ×1.35` + Phát Cuối Đạn Lửa & `[R]` Vỏ Đạn Nổ Nhiệt |
| 7 | **Tiểu Liên Gió Lốc** (`gale_smg`) | `uncommon` | `HEAT_VENT` | `47.9` | **`67.1`** | `+40.1%` | Spin-Up `6.0→10.5/s` + Lưỡi Gió vùng Cam & `[R]` Xung Lốc Xoáy |
| 8 | **Súng Phóng Lựu Mảnh** (`frag_launcher`) | `uncommon` | `CLIP_RELOAD` | `42.6` | **`53.0`** | `+24.4%` | Giữ-Nhả Kích Nổ Trên Không (`Airburst`) vòng qua khiên chắn |
| 9 | **Súng Điện Từ Tesla** (`tesla_carbine`) | `rare` | `CLIP_RELOAD` | `64.9` | **`77.5`** | `+19.4%` | Nảy tường thông minh (`+35%`) + Phát Cuối Sét Lan 3 mục tiêu & `[R]` `+1` nảy |
| 10 | **Súng Hạt Giống** (`seed_gun`) | `rare` | `CLIP_RELOAD` | `41.0` | **`55.0`** | `+34.1%` | Gieo Mầm Độc + `[R]` Nở Hoa Thu Hoạch (`Harvest Bloom`) |
| 11 | **Trượng Liên Kết** (`tether_staff`) | `rare` | `HEAT_VENT` | `46.7` | **`57.5`** | `+23.1%` | Dây Cắt Sét Cao Thế + `[R]` Thu Dây Gom Quái Nổ Điện Từ |
| 12 | **Súng Tia Hội Tụ** (`focus_laser`) | `rare` | `HEAT_VENT` | `43.2` | **`58.6`** | `+35.6%` | Tia Hội Tụ tăng ST theo nhiệt + `[R]` Pháo Railgun Xuyên Phòng |
| 13 | **Đại Đao Lục Bảo** (`emerald_cleaver`) | `epic` | `MELEE_COMBO` | `56.7` | **`81.9`** | `+44.4%` | Đòn 3 phóng Lưỡi Đao Boomerang khứ hồi + `Parry Deflect` |
| 14 | **Trượng Hư Không** (`void_staff`) | `epic` | `CLIP_RELOAD` | `65.3` | **`113.3`** | `+73.5%` | Cầu Hút Đạn Địch + Giữ-Nhả Sụp Đổ Hư Không (`Implosion`) |
| 15 | **Rìu Chiến Berserker** (`berserker_axe`) | `epic` | `MELEE_COMBO` | `79.1` | **`118.4`** | `+49.7%` | Cuồng Huyết tăng tốc chém + Đòn 3 Bổ Đoạn Đầu Đài phá khiên & Khe Lửa |
| 16 | **Trượng Thái Dương** (`solar_archon_staff`) | `legendary` | `HEAT_VENT` | `114.2` | **`193.3`** | `+69.3%` | 3 Tiểu Thái Dương hội tụ + `[R]` Bùng Nổ Siêu Tân Tinh |
| 17 | **Pháo Dung Nham** (`magma_cannon`) | `legendary` | `CLIP_RELOAD` | `65.0` | **`90.6`** | `+39.4%` | Đá Lăn `Wall-Slam` hàng loạt + Phát Cuối Phun Trào 4 Vòi Mạch Lửa |
| 18 | **Búa Lôi Thần** (`thunder_hammer`) | `legendary` | `MELEE_COMBO` | `100.8` | **`109.4`** | `+8.5%` | Lực đẩy `320` + Đòn 3 Cột Thu Lôi Giáng 3 Cột Sét diện rộng |

---

## 5. Chỉ Số Quái, 3 Boss Phá Giáp 1–2 Bước & Sức Chống Chịu Cuối Game (`enemies.ts`)

### 5.1 Quái Thường Theo 3 Biome
- **Biome 1 — Rừng Cổ Mục Nát:** `goblin_shooter` (`48 HP`, CD `1.32s`), `green_slime` (`40 HP`, CD `1.08s`, tách `mini_slime` `20 HP`), `spore_bomber` (`34 HP`, nổ `2 DMG` — có thể chém/`Dash-Kick` bật ngược), `wild_boar` (`72 HP`, CD `1.82s`), `goblin_shaman` (`44 HP`, CD `2.55s`), `thorn_turret` (`50 HP`, CD `1.88s`).
- **Biome 2 — Hầm Băng Vĩnh Cửu:** `frost_bat` (`44 HP`, bay), `baby_yeti` (`76 HP`, đẩy tảng băng trượt `460 px/s`), `ice_mage` (`58 HP`, khúc xạ 3 tia qua cột lăng kính băng), `ice_golem` (`96 HP`, giáp băng trực diện giảm `75%` — vỡ tức thì khi trúng tảng băng trượt hoặc `Wall-Slam`), `snow_spirit` (`44 HP`, kết tinh thành tảng băng trượt khi chết).
- **Biome 3 — Lò Rèn Dung Nham:** `fire_imp` (`56 HP`), `dwarf_cannon` (`80 HP`, pháo cối cầu vồng vượt chắn thấp), `coal_golem` (`112 HP`, rơi bom than `2.0s` có thể `Dash-Kick`), `welder_drone` (`62 HP`, nổ xung EMP `r=110px` khi bị hạ), `iron_shielder` (`104 HP`, khiên thép trực diện giảm `80%`, dẫn điện hình nón phía sau khi trúng Sét).

### 5.2 Cân Bằng 3 Boss Cuối Màn & Kiểm Toán Boss Tầng 6 Trước Build Full-Synergy (Phase P5.2)

| Biome | Boss | HP Cơ Bản | Thời gian hạ `1P` (`p50`, `p10–p90`) | Thời gian hạ `4P` (`p50`, `p10–p90`) | Lệch `1P ↔ 4P` | Winrate Solo (`30 seeds`) | Max Hit / EHP | One-Shot |
|---:|---|---:|---|---|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc** (`spore_king`) | `5200` | **`84.86s`** (`78.57s–97.99s`) | **`84.17s`** (`76.15s–92.33s`) | **`±0.8%`** | **`93%`** (`80–95%`) | `38%` | `0` (`zeroOneShots`) |
| **Biome 2** | **Băng Hậu Kryssa** (`kryssa_ice_queen`) | `6800` | **`82.3s`** (`59.1s–92.05s`) | **`88.55s`** (`79.54s–98.69s`) | **`±7.6%`** | **`73%`** (`70–90%`) | `21%` | `0` (`zeroOneShots`) |
| **Biome 3** | **Titan Lò Rèn** (`forge_titan`) | `9600` | **`75.34s`** (`34.62s–90.98s`) | **`81.81s`** (`73.68s–89.86s`) | **`±8.6%`** | **`73%`** (`60–85%`) | `30%` | `0` (`zeroOneShots`) |

#### Kiểm Toán Sức Chống Chịu `forge_titan` Trước Build Cuối Game Đầy Đủ Synergy (`+3` VK + `2` Mutators + `6` Blessings + `2` Duo Boons + `2` Relics)
- **Loadout A — Hỏa + Lôi Quá Tải / Siêu Tân Tinh** (`elementalist` / `solar_archon_staff`): **`p50 47.51s`** (`44.44s–50.91s`), Winrate `90%`, Max Hit `262 / 270` (`18×` cap), Max Hit Nhận `21% EHP`.
- **Loadout B — Băng + Lôi Siêu Dẫn / Lăng Kính Nảy** (`ranger` / `hunter_crossbow`): **`p50 50.47s`** (`45.97s–52.56s`), Winrate `70%`, Max Hit `270 / 270`, Max Hit Nhận `19% EHP`.
- **Loadout C — Hỏa + Độc Xung Kích / Lốc Xoáy Napalm** (`vanguard` / `magma_cannon`): **`p50 48.2s`** (`41.94s–50.38s`), Winrate `100%`, Max Hit `370 / 684`, Max Hit Nhận `16% EHP`.

---

## 6. Kết Quả Kiểm Chứng Tự Động 10/10 Chỉ Tiêu (Headless Balance Harness — Phase P5.2 Final)

Báo cáo đầy đủ được sinh tự động tại [`docs/balance-report.md`](./balance-report.md) qua lệnh `pnpm balance` (`tools/balance-harness.ts`, chạy **2.269 lượt mô phỏng** trên `WorldSim` 60Hz với `AVERAGE_PLAYER_BOT_PROFILE`, `godMode = false` và `30 seeds` khóa cứng):

| # | Chỉ tiêu cân bằng (Spec 3.10 & Phase P5) | Mục tiêu thiết kế | Kết quả thực đo (`p50`, `p10 – p90`) | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.6s – 1.5s` | **p50 1.42s** (`0.92s – 2.33s`) | ✅ ĐẠT |
| 2 | **Thời lượng Phòng combat (1–4P)** | `35s – 70s` | **p50 36.77s** (`27.3s – 49.27s`) | ✅ ĐẠT |
| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | `25% – 50% tổng` | **p50 25%** (`0% – 88.75%`) | ✅ ĐẠT |
| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | `60s – 120s` (Lệch `≤ ±20%`) | **B1: 84.86s/84.17s · B2: 82.3s/88.55s · B3: 75.34s/81.81s** | ✅ ĐẠT |
| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | `B1: 80–95%, B2: 70–90%, B3: 60–85%` | **B1: 93% · B2: 73% · B3: 73%** (`zeroOneShots: true`) | ✅ ĐẠT |
| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | `+20% – 25%` mỗi Biome | **Biome 2 `+24.1%` · Biome 3 `+21.9%`** | ✅ ĐẠT |
| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | `4 – 10 đòn` · Lệch `≤ ±15%` | **`4 – 9 đòn` · Lệch `±0.1%`** (`90.0 – 90.1 DPS`) | ✅ ĐẠT |
| 8 | **Độ lệch DPS 5 Vũ khí Khởi đầu & Active `[R]` 18 Vũ khí** | Lệch `< 5.0%` · `Active > Normal` | **Lệch `±1.2%` · `18/18 Active > Normal`** | ✅ ĐẠT |
| 9 | **Độ lệch Tỉ lệ thắng 5 Class (`1P / 2P / 4P × 30 seeds`)** | Lệch `≤ ±6.0%` | **Lệch `±1.9%`** (`95.7% – 99.0%` tổng hợp) | ✅ ĐẠT |
| 10 | **Sức chống chịu Boss Tầng 6 (`forge_titan`) trước Build Full-Synergy** | `avgSec >= 45.0s` (`zeroOneShots: true`) | **Min p50 47.51s** (`47.51s / 50.47s / 48.2s`) | ✅ ĐẠT |
