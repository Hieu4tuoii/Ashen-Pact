# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT (v0.2.0 P11)

> Sinh tự động bởi công cụ Headless Balance Harness (`tools/balance-harness.ts`) với **1795 lượt mô phỏng** trên `WorldSim` (60Hz cố định) sử dụng hồ sơ bot khóa cứng `AVERAGE_PLAYER_BOT_PROFILE` (`tools/bot-profile.ts`: `aimAccuracy = 70%`, `reactionDelaySec = 0.25s`, `dashDodgeProbability = 65%`, `godMode = false`, **30 seeds**).

## 1. Bảng Tổng Hợp Mục Tiêu Cân Bằng Định Lượng (Spec Section 3.10)

| # | Chỉ tiêu cân bằng (Spec 3.10) | Mục tiêu thiết kế | Trung vị `p50` (`p10 – p90`) | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.6s – 1.5s` | **p50 1.2s** (`0.73s – 1.97s`) | ✅ ĐẠT |
| 2 | **Thời lượng Phòng combat (1–4P)** | `35s – 70s` | **p50 35.87s** (`30.92s – 42.87s`) | ✅ ĐẠT |
| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | `25% – 50% tổng` | **p50 44.4%** (`0% – 100%`) | ✅ ĐẠT |
| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | `60s – 120s` (Lệch `≤ ±20%`) | **B1: 74.57s/81.72s · B2: 79.42s/81.75s · B3: 70.63s/79.57s** | ✅ ĐẠT |
| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | `B1: 80–95%, B2: 70–90%, B3: 60–85%` | **B1: 87% · B2: 73% · B3: 67%** (Zero One-Shot: `true`) | ✅ ĐẠT |
| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | `+20% – 25%` mỗi Biome | **Biome 2 `+20.7%` · Biome 3 `+24.8%`** | ✅ ĐẠT |
| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | `6 – 10 đòn` · Lệch `≤ ±15%` | **`6 – 10 đòn` · Lệch `±14.3%`** | ✅ ĐẠT |

---

## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)

| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường (p50) | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 |
|---|---|---:|---:|---:|---:|---:|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | 8 / 6 | **10 đòn** | **0.73s** | **36.1 DPS** | **50%** | **90% Thắng** (97.87s) |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | 5 / 4 | **7 đòn** | **0.88s** | **65.8 DPS** | **59.6%** | **87% Thắng** (74.57s) |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | 5 / 3 | **6 đòn** | **1.23s** | **75.8 DPS** | **52.5%** | **87% Thắng** (75.05s) |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | 6 / 4 | **9 đòn** | **1.36s** | **33.3 DPS** | **50%** | **90% Thắng** (80.58s) |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | 6 / 5 | **9 đòn** | **1.4s** | **57.4 DPS** | **59.9%** | **93% Thắng** (73.9s) |

---

## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)

| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |
|---|---:|---:|---:|---:|---:|
| **Thiết Vệ** (`vanguard`) | 36.6 DPS | 43 DPS | 36.4 DPS | 35.8 DPS | 45.3 DPS |
| **Liệp Ưng** (`ranger`) | 48.7 DPS | 66.3 DPS | 54.7 DPS | 49.2 DPS | 70.1 DPS |
| **Lam Hỏa** (`elementalist`) | 74.5 DPS | 100.9 DPS | 74.5 DPS | 94.5 DPS | 107.8 DPS |
| **Mộc Linh** (`druid`) | 32.8 DPS | 37.4 DPS | 32.7 DPS | 29.1 DPS | 39.9 DPS |
| **Bánh Răng** (`engineer`) | 46.6 DPS | 60.6 DPS | 91.7 DPS | 68.2 DPS | 75.2 DPS |

---

## 4. Thống Kê Co-op Scaling (1–4 Người Chơi) & 3 Boss Cuối Màn

| Số người chơi | Thời lượng Phòng combat `p50` (`p10–p90`) | HP+Giáp mất TB | Tỉ lệ gục / phòng | Thời lượng hạ Boss B1 `p50` (`p10–p90`) | Lệch so với 1P |
|---:|---|---:|---:|---|---:|
| **1P** | **37.03s** (`31.24s–59.82s`) | **44.4%** | **0.07** | **74.57s** (`63.35s–85.35s`) | **±0%** |
| **2P** | **36.31s** (`32.09s–43.57s`) | **47.1%** | **0.03** | **82.48s** (`78.2s–99.49s`) | **±10.6%** |
| **3P** | **34.94s** (`31.52s–42s`) | **39.3%** | **0.1** | **81.82s** (`72.28s–90.42s`) | **±9.7%** |
| **4P** | **35.12s** (`30.28s–42.08s`) | **53.95%** | **0.07** | **81.72s** (`68.85s–90.06s`) | **±9.6%** |

### Bảng Cân Bằng 3 Boss Cuối Màn (Biome 1, Biome 2, Biome 3)

| Biome | Boss | 1P `p50` (`p10–p90`) | 4P `p50` (`p10–p90`) | Lệch 1P↔4P | Tỉ lệ thắng Solo | Max Hit / EHP | Trạng thái |
|---:|---|---|---|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc (Biome 1)** (`spore_king`) | **74.57s** (`63.35s–85.35s`) | **81.72s** (`68.85s–90.06s`) | **±9.6%** | **87%** | `31%` | ✅ ĐẠT |
| **Biome 2** | **Băng Hậu Kryssa (Biome 2)** (`kryssa_ice_queen`) | **79.42s** (`67.59s–88.26s`) | **81.75s** (`71.04s–89.8s`) | **±2.9%** | **73%** | `15%` | ✅ ĐẠT |
| **Biome 3** | **Titan Lò Rèn (Biome 3)** (`forge_titan`) | **70.63s** (`59.58s–85.43s`) | **79.57s** (`66.95s–88.77s`) | **±12.7%** | **67%** | `31%` | ✅ ĐẠT |

---

## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)

| Đội hình Co-op | Số người | Thời gian hạ Boss (p50) | Phản ứng Nguyên tố | Đồng Đội Combo (+15 NL) | Kết quả |
|---|---:|---:|---:|---:|:---:|
| **2P Khiên Lửa (Thiết Vệ + Lam Hỏa)** | 2P | **109.49s** | **158** | **96** | ✅ THẮNG |
| **2P Săn Độc (Liệp Ưng + Mộc Linh)** | 2P | **78.95s** | **119** | **116** | ✅ THẮNG |
| **2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)** | 2P | **87.63s** | **230** | **111** | ✅ THẮNG |
| **4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)** | 4P | **99.5s** | **392** | **348** | ✅ THẮNG |
| **4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)** | 4P | **98.83s** | **471** | **422** | ✅ THẮNG |

---

## 6. Độ Khó Tăng Dần Qua 3 Biome (Đo Thực Tế Trên WorldSim)

| Biome | Tên Biome | EHP Quái TB | Thời gian dọn phòng | HP+Giáp mất TB | Chỉ số độ khó | Tăng so với Biome trước |
|---:|---|---:|---:|---:|---:|---:|
| **Biome 1** | Biome 1 — Rừng Cổ Mục Nát | `26.3` | `48.7s` | `50%` | `×1.00` | Cơ sở (Baseline) |
| **Biome 2** | Biome 2 — Hầm Băng Vĩnh Cửu | `44` | `42.3s` | `59.3%` | `×1.21` | **+20.7%** |
| **Biome 3** | Biome 3 — Lò Rèn Dung Nham | `85.1` | `35.6s` | `92.1%` | `×1.51` | **+24.8%** |

## 7. Kết Luận Kiểm Chứng: ✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG SPEC 3.10
