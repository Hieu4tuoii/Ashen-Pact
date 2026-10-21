# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT (v0.2.0 P11)

> Sinh tự động bởi công cụ Headless Balance Harness (`tools/balance-harness.ts`) với **1795 lượt mô phỏng** trên `WorldSim` (60Hz cố định) sử dụng hồ sơ bot khóa cứng `AVERAGE_PLAYER_BOT_PROFILE` (`tools/bot-profile.ts`: `aimAccuracy = 70%`, `reactionDelaySec = 0.25s`, `dashDodgeProbability = 65%`, `godMode = false`, **30 seeds**).

## 1. Bảng Tổng Hợp Mục Tiêu Cân Bằng Định Lượng (Spec Section 3.10)

| # | Chỉ tiêu cân bằng (Spec 3.10) | Mục tiêu thiết kế | Trung vị `p50` (`p10 – p90`) | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.6s – 1.5s` | **p50 1.2s** (`0.73s – 1.97s`) | ✅ ĐẠT |
| 2 | **Thời lượng Phòng combat (1–4P)** | `35s – 70s` | **p50 36.28s** (`29.23s – 44.69s`) | ✅ ĐẠT |
| 3 | **HP + Giáp mất mỗi phòng (Biome 1 Solo)** | `25% – 50% tổng` | **p50 44.4%** (`11.1% – 78.91%`) | ✅ ĐẠT |
| 4 | **Thời lượng đánh Boss B1 / B2 / B3 (1P vs 4P)** | `60s – 120s` (Lệch `≤ ±20%`) | **B1: 79.84s/64.7s · B2: 73.54s/63.61s · B3: 72.24s/68.21s** | ✅ ĐẠT |
| 5 | **Tỉ lệ thắng Boss Solo & Không One-Shot** | `B1: 80–95%, B2: 70–90%, B3: 60–85%` | **B1: 87% · B2: 87% · B3: 73%** (Zero One-Shot: `true`) | ✅ ĐẠT |
| 6 | **Độ khó tăng giữa các Biome (Đo thật WorldSim)** | `+20% – 25%` mỗi Biome | **Biome 2 `+22.7%` · Biome 3 `+20%`** | ✅ ĐẠT |
| 7 | **Chịu đòn cơ bản & Độ lệch DPS 3 NV sát thương** | `6 – 10 đòn` · Lệch `≤ ±15%` | **`6 – 10 đòn` · Lệch `±9.2%`** | ✅ ĐẠT |

---

## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)

| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường (p50) | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 |
|---|---|---:|---:|---:|---:|---:|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | 8 / 6 | **10 đòn** | **0.73s** | **36.1 DPS** | **50%** | **97% Thắng** (104.45s) |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | 5 / 4 | **7 đòn** | **0.88s** | **65.8 DPS** | **59.6%** | **87% Thắng** (79.84s) |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | 5 / 3 | **6 đòn** | **1.23s** | **75.8 DPS** | **52.5%** | **87% Thắng** (81.38s) |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | 6 / 4 | **9 đòn** | **1.36s** | **33.3 DPS** | **50%** | **80% Thắng** (85.38s) |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | 6 / 5 | **9 đòn** | **1.4s** | **66.6 DPS** | **59.9%** | **97% Thắng** (70.9s) |

---

## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)

| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |
|---|---:|---:|---:|---:|---:|
| **Thiết Vệ** (`vanguard`) | 36.6 DPS | 43 DPS | 36.4 DPS | 35.8 DPS | 45.3 DPS |
| **Liệp Ưng** (`ranger`) | 48.7 DPS | 66.3 DPS | 54.7 DPS | 49.2 DPS | 70.1 DPS |
| **Lam Hỏa** (`elementalist`) | 74.5 DPS | 100.9 DPS | 74.5 DPS | 94.5 DPS | 107.8 DPS |
| **Mộc Linh** (`druid`) | 32.8 DPS | 37.4 DPS | 32.7 DPS | 29.1 DPS | 39.9 DPS |
| **Bánh Răng** (`engineer`) | 46.6 DPS | 66.5 DPS | 109.6 DPS | 86.5 DPS | 91.4 DPS |

---

## 4. Thống Kê Co-op Scaling (1–4 Người Chơi) & 3 Boss Cuối Màn

| Số người chơi | Thời lượng Phòng combat `p50` (`p10–p90`) | HP+Giáp mất TB | Tỉ lệ gục / phòng | Thời lượng hạ Boss B1 `p50` (`p10–p90`) | Lệch so với 1P |
|---:|---|---:|---:|---|---:|
| **1P** | **37.59s** (`29.86s–58.38s`) | **44.4%** | **0.07** | **79.84s** (`67.84s–89.37s`) | **±0%** |
| **2P** | **34.83s** (`28.6s–46.1s`) | **50%** | **0.23** | **67.43s** (`59.36s–82s`) | **±15.5%** |
| **3P** | **36.13s** (`29.25s–47.25s`) | **58.9%** | **0.23** | **73.42s** (`60.26s–78.64s`) | **±8%** |
| **4P** | **37.85s** (`29.8s–42.33s`) | **55.25%** | **0.13** | **64.7s** (`57.12s–78.54s`) | **±19%** |

### Bảng Cân Bằng 3 Boss Cuối Màn (Biome 1, Biome 2, Biome 3)

| Biome | Boss | 1P `p50` (`p10–p90`) | 4P `p50` (`p10–p90`) | Lệch 1P↔4P | Tỉ lệ thắng Solo | Max Hit / EHP | Trạng thái |
|---:|---|---|---|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc (Biome 1)** (`spore_king`) | **79.84s** (`67.84s–89.37s`) | **64.7s** (`57.12s–78.54s`) | **±19%** | **87%** | `30%` | ✅ ĐẠT |
| **Biome 2** | **Băng Hậu Kryssa (Biome 2)** (`kryssa_ice_queen`) | **73.54s** (`65.13s–85.18s`) | **63.61s** (`59.63s–67.18s`) | **±13.5%** | **87%** | `21%` | ✅ ĐẠT |
| **Biome 3** | **Titan Lò Rèn (Biome 3)** (`forge_titan`) | **72.24s** (`63.35s–83.38s`) | **68.21s** (`59.48s–87.94s`) | **±5.6%** | **73%** | `19%` | ✅ ĐẠT |

---

## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)

| Đội hình Co-op | Số người | Thời gian hạ Boss (p50) | Phản ứng Nguyên tố | Đồng Đội Combo (+15 NL) | Kết quả |
|---|---:|---:|---:|---:|:---:|
| **2P Khiên Lửa (Thiết Vệ + Lam Hỏa)** | 2P | **76.72s** | **134** | **85** | ✅ THẮNG |
| **2P Săn Độc (Liệp Ưng + Mộc Linh)** | 2P | **64.33s** | **93** | **90** | ✅ THẮNG |
| **2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)** | 2P | **66.1s** | **176** | **78** | ✅ THẮNG |
| **4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)** | 4P | **80.8s** | **317** | **277** | ✅ THẮNG |
| **4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)** | 4P | **75.17s** | **362** | **323** | ✅ THẮNG |

---

## 6. Độ Khó Tăng Dần Qua 3 Biome (Đo Thực Tế Trên WorldSim)

| Biome | Tên Biome | EHP Quái TB | Thời gian dọn phòng | HP+Giáp mất TB | Chỉ số độ khó | Tăng so với Biome trước |
|---:|---|---:|---:|---:|---:|---:|
| **Biome 1** | Biome 1 — Rừng Cổ Mục Nát | `26.3` | `50s` | `32.2%` | `×1.00` | Cơ sở (Baseline) |
| **Biome 2** | Biome 2 — Hầm Băng Vĩnh Cửu | `49.6` | `30.9s` | `53.1%` | `×1.23` | **+22.7%** |
| **Biome 3** | Biome 3 — Lò Rèn Dung Nham | `77.2` | `33.6s` | `83.7%` | `×1.47` | **+20.0%** |

## 7. Kết Luận Kiểm Chứng: ✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG SPEC 3.10
