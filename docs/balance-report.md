# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT 2.0 (Phase P5 — v2.0.0 Final)

> Sinh tự động bởi công cụ Headless Balance Harness (`tools/balance-harness.ts`) với **2269 lượt mô phỏng** trên `WorldSim` (60Hz cố định) sử dụng hồ sơ bot khóa cứng `AVERAGE_PLAYER_BOT_PROFILE` (`tools/bot-profile.ts`: `aimAccuracy = 70%`, `reactionDelaySec = 0.25s`, `dashDodgeProbability = 65%`, `godMode = false`, **30 seeds**).

## 1. Bảng Tổng Hợp Mục Tiêu Cân Bằng Định Lượng (Spec Section 3.10)

| # | Chỉ tiêu cân bằng (Spec 3.10) | Mục tiêu thiết kế | Trung vị `p50` (`p10 – p90`) | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.6s – 1.5s` | **p50 1.42s** (`0.92s – 2.33s`) | ✅ ĐẠT |
| 2 | **Thời lượng Phòng combat (1–4P)** | `35s – 70s` | **p50 36.77s** (`27.3s – 49.27s`) | ✅ ĐẠT |
| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | `25% – 50% tổng` | **p50 25%** (`0% – 88.75%`) | ✅ ĐẠT |
| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | `60s – 120s` (Lệch `≤ ±20%`) | **B1: 84.86s/84.17s · B2: 82.3s/88.55s · B3: 75.34s/81.81s** | ✅ ĐẠT |
| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | `B1: 80–95%, B2: 70–90%, B3: 60–85%` | **B1: 93% · B2: 73% · B3: 73%** (Zero One-Shot: `true`) | ✅ ĐẠT |
| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | `+20% – 25%` mỗi Biome | **Biome 2 `+24.1%` · Biome 3 `+21.9%`** | ✅ ĐẠT |
| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | `4 – 10 đòn` · Lệch `≤ ±15%` | **`4 – 9 đòn` · Lệch `±0.1%`** | ✅ ĐẠT |
| 8 | **Độ lệch DPS 5 Vũ khí Khởi đầu & Active `[R]` 18 Vũ khí** | Lệch `< 5.0%` · `Active > Normal` | **Lệch `±1.2%` · 18/18 `Active > Normal`** | ✅ ĐẠT |
| 9 | **Độ lệch Tỉ lệ thắng 5 Class (1P / 2P / 4P × 30 seeds)** | Lệch `≤ ±6.0%` | **Lệch `±1.9%`** | ✅ ĐẠT |
| 10 | **Boss Tầng 6 (`forge_titan`) trước Build Cuối Game Đầy Đủ Synergy (`Mutators + Blessings + Duo Boons + Relics`)** | `avgSec >= 45.0s` (`zeroOneShots: true`) | **Min p50 47.51s** (`47.51s / 50.47s / 48.2s`) | ✅ ĐẠT |

---

## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)

| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường (p50) | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 |
|---|---|---:|---:|---:|---:|---:|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | 6 / 5 | **9 đòn** | **1.23s** | **51.5 DPS** | **50%** | **97% Thắng** (117.12s) |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | 5 / 3 | **6 đòn** | **1.42s** | **90 DPS** | **59.6%** | **93% Thắng** (84.86s) |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | 4 / 2 | **4 đòn** | **1.17s** | **90 DPS** | **52.5%** | **97% Thắng** (83.65s) |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | 5 / 3 | **8 đòn** | **1.77s** | **62.5 DPS** | **50%** | **87% Thắng** (108.02s) |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | 6 / 4 | **9 đòn** | **1.85s** | **90.1 DPS** | **59.9%** | **93% Thắng** (105.15s) |

---

## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)

| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |
|---|---:|---:|---:|---:|---:|
| **Thiết Vệ** (`vanguard`) | 51.8 DPS | 61.9 DPS | 76.8 DPS | 68.8 DPS | 52.5 DPS |
| **Liệp Ưng** (`ranger`) | 66.9 DPS | 90.3 DPS | 110.2 DPS | 86.3 DPS | 76.4 DPS |
| **Lam Hỏa** (`elementalist`) | 82.1 DPS | 131.7 DPS | 90.4 DPS | 151.5 DPS | 114.8 DPS |
| **Mộc Linh** (`druid`) | 45.8 DPS | 54.6 DPS | 67.9 DPS | 57 DPS | 44.7 DPS |
| **Bánh Răng** (`engineer`) | 66.6 DPS | 113.2 DPS | 121.9 DPS | 146.2 DPS | 96.4 DPS |

---

## 4. Thống Kê Co-op Scaling (1–4 Người Chơi) & 3 Boss Cuối Màn

| Số người chơi | Thời lượng Phòng combat `p50` (`p10–p90`) | HP+Giáp mất TB | Tỉ lệ gục / phòng | Thời lượng hạ Boss B1 `p50` (`p10–p90`) | Lệch so với 1P |
|---:|---|---:|---:|---|---:|
| **1P** | **34.04s** (`26.45s–52.59s`) | **25%** | **0.03** | **84.86s** (`78.57s–97.99s`) | **±0%** |
| **2P** | **35.08s** (`28.08s–47.9s`) | **46.45%** | **0.13** | **71.35s** (`65.42s–79.06s`) | **±15.9%** |
| **3P** | **38.13s** (`27.26s–49.22s`) | **29.2%** | **0.27** | **78.72s** (`71.34s–85.9s`) | **±7.2%** |
| **4P** | **37.89s** (`30.58s–47.8s`) | **31.3%** | **0.13** | **84.17s** (`76.15s–92.33s`) | **±0.8%** |

### Bảng Cân Bằng 3 Boss Cuối Màn (Biome 1, Biome 2, Biome 3)

| Biome | Boss | 1P `p50` (`p10–p90`) | 4P `p50` (`p10–p90`) | Lệch 1P↔4P | Tỉ lệ thắng Solo | Max Hit / EHP | Trạng thái |
|---:|---|---|---|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc (Biome 1)** (`spore_king`) | **84.86s** (`78.57s–97.99s`) | **84.17s** (`76.15s–92.33s`) | **±0.8%** | **93%** | `38%` | ✅ ĐẠT |
| **Biome 2** | **Băng Hậu Kryssa (Biome 2)** (`kryssa_ice_queen`) | **82.3s** (`59.1s–92.05s`) | **88.55s** (`79.54s–98.69s`) | **±7.6%** | **73%** | `21%` | ✅ ĐẠT |
| **Biome 3** | **Titan Lò Rèn (Biome 3)** (`forge_titan`) | **75.34s** (`34.62s–90.98s`) | **81.81s** (`73.68s–89.86s`) | **±8.6%** | **73%** | `30%` | ✅ ĐẠT |

---

## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)

| Đội hình Co-op | Số người | Thời gian hạ Boss (p50) | Phản ứng Nguyên tố | Đồng Đội Combo (+15 NL) | Kết quả |
|---|---:|---:|---:|---:|:---:|
| **2P Khiên Lửa (Thiết Vệ + Lam Hỏa)** | 2P | **86.78s** | **165** | **126** | ✅ THẮNG |
| **2P Săn Độc (Liệp Ưng + Mộc Linh)** | 2P | **93.52s** | **51** | **33** | ✅ THẮNG |
| **2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)** | 2P | **81.21s** | **177** | **99** | ✅ THẮNG |
| **4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)** | 4P | **94.9s** | **239** | **214** | ✅ THẮNG |
| **4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)** | 4P | **101.45s** | **361** | **336** | ✅ THẮNG |

---

## 6. Độ Khó Tăng Dần Qua 3 Biome (Đo Thực Tế Trên WorldSim)

| Biome | Tên Biome | EHP Quái TB | Thời gian dọn phòng | HP+Giáp mất TB | Chỉ số độ khó | Tăng so với Biome trước |
|---:|---|---:|---:|---:|---:|---:|
| **Biome 1** | Biome 1 — Rừng Cổ Mục Nát | `48` | `36.8s` | `31.3%` | `×1.00` | Cơ sở (Baseline) |
| **Biome 2** | Biome 2 — Hầm Băng Vĩnh Cửu | `89.5` | `28.4s` | `46.7%` | `×1.24` | **+24.1%** |
| **Biome 3** | Biome 3 — Lò Rèn Dung Nham | `123` | `36.6s` | `82.4%` | `×1.51` | **+21.9%** |

---

## 7. Cân Bằng 18 Vũ Khí Độc Bản: DPS Thường vs DPS Active `[R]` / Tuyệt Kỹ (Spec 3.3)

> Độ lệch DPS giữa **5 Vũ khí Khởi đầu** (`knight_sword`, `hunter_crossbow`, `apprentice_staff`, `thorn_staff`, `rivet_gun`): **`±1.2%`** (Mục tiêu `< 5.0%` — ✅ ĐẠT).

| # | Vũ khí | Độ hiếm | Nhịp (`Cadence`) | DPS Thường (Target) | DPS Active `[R]` (Target) | Tăng khi Active `[R]` | Trạng thái |
|---:|---|---|---|---:|---:|---:|:---:|
| 1 | **Kiếm Hiệp Sĩ** (`knight_sword`) ⭐ | `common` | `MELEE_COMBO` | **28.4 DPS** (`~31`) | **52.9 DPS** (`~41`) | **+86.3%** | ✅ ĐẠT |
| 2 | **Nỏ Săn** (`hunter_crossbow`) ⭐ | `common` | `CLIP_RELOAD` | **34.8 DPS** (`~30`) | **54.1 DPS** (`~41`) | **+55.5%** | ✅ ĐẠT |
| 3 | **Trượng Tập Sự** (`apprentice_staff`) ⭐ | `common` | `HEAT_VENT` | **35.2 DPS** (`~30`) | **53.8 DPS** (`~40`) | **+52.8%** | ✅ ĐẠT |
| 4 | **Trượng Gai** (`thorn_staff`) ⭐ | `common` | `CLIP_RELOAD` | **40.2 DPS** (`~29`) | **53.7 DPS** (`~40`) | **+33.6%** | ✅ ĐẠT |
| 5 | **Súng Đinh Tán** (`rivet_gun`) ⭐ | `common` | `CLIP_RELOAD` | **40.6 DPS** (`~31`) | **53.2 DPS** (`~41`) | **+31%** | ✅ ĐẠT |
| 6 | **Shotgun Phế Liệu** (`scrap_shotgun`) | `uncommon` | `CLIP_RELOAD` | **46.3 DPS** (`~41`) | **79.4 DPS** (`~53`) | **+71.5%** | ✅ ĐẠT |
| 7 | **Tiểu Liên Gió Lốc** (`gale_smg`) | `uncommon` | `HEAT_VENT` | **47.9 DPS** (`~40`) | **67.1 DPS** (`~52`) | **+40.1%** | ✅ ĐẠT |
| 8 | **Súng Phóng Lựu Mảnh** (`frag_launcher`) | `uncommon` | `CLIP_RELOAD` | **42.6 DPS** (`~42`) | **53 DPS** (`~54`) | **+24.4%** | ✅ ĐẠT |
| 9 | **Súng Điện Từ Tesla** (`tesla_carbine`) | `rare` | `CLIP_RELOAD` | **64.9 DPS** (`~51`) | **77.5 DPS** (`~68`) | **+19.4%** | ✅ ĐẠT |
| 10 | **Súng Hạt Giống** (`seed_gun`) | `rare` | `CLIP_RELOAD` | **41 DPS** (`~48`) | **55 DPS** (`~64`) | **+34.1%** | ✅ ĐẠT |
| 11 | **Trượng Liên Kết** (`tether_staff`) | `rare` | `HEAT_VENT` | **46.7 DPS** (`~49`) | **57.5 DPS** (`~66`) | **+23.1%** | ✅ ĐẠT |
| 12 | **Súng Tia Hội Tụ** (`focus_laser`) | `rare` | `HEAT_VENT` | **43.2 DPS** (`~52`) | **58.6 DPS** (`~68`) | **+35.6%** | ✅ ĐẠT |
| 13 | **Đại Đao Lục Bảo** (`emerald_cleaver`) | `epic` | `MELEE_COMBO` | **56.7 DPS** (`~64`) | **81.9 DPS** (`~84`) | **+44.4%** | ✅ ĐẠT |
| 14 | **Trượng Hư Không** (`void_staff`) | `epic` | `CLIP_RELOAD` | **65.3 DPS** (`~65`) | **113.3 DPS** (`~83`) | **+73.5%** | ✅ ĐẠT |
| 15 | **Rìu Chiến Berserker** (`berserker_axe`) | `epic` | `MELEE_COMBO` | **79.1 DPS** (`~68`) | **118.4 DPS** (`~88`) | **+49.7%** | ✅ ĐẠT |
| 16 | **Trượng Thái Dương** (`solar_archon_staff`) | `legendary` | `HEAT_VENT` | **114.2 DPS** (`~82`) | **193.3 DPS** (`~108`) | **+69.3%** | ✅ ĐẠT |
| 17 | **Pháo Dung Nham** (`magma_cannon`) | `legendary` | `CLIP_RELOAD` | **65 DPS** (`~79`) | **90.6 DPS** (`~104`) | **+39.4%** | ✅ ĐẠT |
| 18 | **Búa Lôi Thần** (`thunder_hammer`) | `legendary` | `MELEE_COMBO` | **100.8 DPS** (`~81`) | **109.4 DPS** (`~106`) | **+8.5%** | ✅ ĐẠT |

---

## 8. Thống Kê 5 Class Qua 1P / 2P / 4P (30 Seeds / Chế Độ — Human-Like Bot Profile)

> Độ lệch Tỉ lệ thắng (`Winrate Spread`) giữa 5 Class: **`±1.9%`** (Mục tiêu `≤ ±6.0%` — ✅ ĐẠT).

| Nhân vật (Class) | Vai trò | Số lượt / Mode | Winrate `1P` (`p50` TG) | Winrate `2P` (`p50` TG) | Winrate `4P` (`p50` TG) | Winrate Tổng Hợp |
|---|---|---:|---|---|---|---:|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | `30` (`Σ=90`) | **97%** (`117.12s`) | **100%** (`86.07s`) | **100%** (`98.45s`) | **99%** |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | `30` (`Σ=90`) | **93%** (`84.86s`) | **97%** (`91.48s`) | **100%** (`84.17s`) | **96.7%** |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | `30` (`Σ=90`) | **97%** (`83.65s`) | **100%** (`83.39s`) | **100%** (`93.12s`) | **99%** |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | `30` (`Σ=90`) | **87%** (`108.02s`) | **100%** (`90.87s`) | **100%** (`94.17s`) | **95.7%** |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | `30` (`Σ=90`) | **93%** (`105.15s`) | **100%** (`82.73s`) | **100%** (`89.87s`) | **97.7%** |

---

## 9. Kiểm Toán Sức Chống Chịu Boss Tầng 6 (`forge_titan`) Trước Build Cuối Game Đầy Đủ Synergy (Phase P5)

| Loadout Synergy Cuối Game (`+3` VK + `2` Mutators + `6` Blessings + `2` Duo Boons + `2` Relics) | Class / Vũ khí chính | `p50` (`p10–p90`) | Winrate | Max Hit / Cap (`18x`) | Max Hit Nhận / EHP | Trạng thái |
|---|---|---|---:|---:|---:|:---:|
| **Loadout A — Hỏa + Lôi Quá Tải / Siêu Tân Tinh** | `elementalist` / `solar_archon_staff` | **47.51s** (`44.44s–50.91s`) | **90%** | `262 / 270` | `21%` | ✅ ĐẠT |
| **Loadout B — Băng + Lôi Siêu Dẫn / Lăng Kính Nảy** | `ranger` / `hunter_crossbow` | **50.47s** (`45.97s–52.56s`) | **70%** | `270 / 270` | `19%` | ✅ ĐẠT |
| **Loadout C — Hỏa + Độc Xung Kích / Lốc Xoáy Napalm** | `vanguard` / `magma_cannon` | **48.2s** (`41.94s–50.38s`) | **100%** | `370 / 684` | `16%` | ✅ ĐẠT |

## 10. Kết Luận Kiểm Chứng: ✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG SPEC 3.10 & PHASE P5
