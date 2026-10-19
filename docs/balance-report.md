# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT

> Sinh tự động bởi công cụ Headless Balance Harness (`tools/balance-harness.ts`) với **291 lượt mô phỏng** ở tốc độ cao trên `WorldSim` (60Hz cố định).

## 1. Bảng Tổng Hợp 7 Chỉ Tiêu Cân Bằng Định Lượng (Mục 7.4)

| # | Chỉ tiêu cân bằng | Mục tiêu thiết kế | Kết quả thực đo | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.5s – 1.5s` | **TB 0.89s** (`0.59s – 1.12s`) | ✅ ĐẠT |
| 2 | **Thời lượng 1 Phòng chiến đấu (1–4P)** | `30s – 60s` | **TB 47s** | ✅ ĐẠT |
| 3 | **Thời lượng đánh Boss 3 Biome (1P vs 4P)** | `90s – 150s` (Lệch `≤ ±20%`) | **1P: 101.3s · 4P: 111.6s** (Lệch `±10.2%`) | ✅ ĐẠT |
| 4 | **Số đòn chịu được trước khi gục (HP + Giáp)** | `6 – 10 đòn` | **`6 – 10 đòn`** | ✅ ĐẠT |
| 5 | **Độ lệch DPS Solo 3 NV sát thương & Solo thắng Boss** | Lệch `≤ ±15%` · 5/5 thắng Boss | **Lệch `±10.6%` · 5/5 Solo Thắng (100%)** | ✅ ĐẠT |
| 6 | **Uptime Kỹ năng chủ động trong giao tranh** | `40% – 60%` | **TB 52.9%** | ✅ ĐẠT |
| 7 | **Độ khó tăng giữa các Biome (Biome 1 → 2 → 3)** | `+25%` mỗi Biome | **Biome 2 `+25%` · Biome 3 `+25%`** | ✅ ĐẠT |

---

## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)

| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (WorldSim) | TTK Quái thường | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 (Cùng HP) |
|---|---|---:|---:|---:|---:|---:|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | 8 / 6 | **10 đòn** | **0.76s** | **42.5 DPS** | **44.4%** | **100% Thắng** (132.6s) |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | 5 / 4 | **7 đòn** | **0.59s** | **75.1 DPS** | **55.1%** | **100% Thắng** (101.3s) |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | 5 / 3 | **6 đòn** | **0.99s** | **80.7 DPS** | **57.4%** | **100% Thắng** (104.1s) |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | 6 / 4 | **9 đòn** | **1.12s** | **33.7 DPS** | **50%** | **100% Thắng** (122.1s) |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | 6 / 5 | **9 đòn** | **0.98s** | **66.1 DPS** | **57.8%** | **100% Thắng** (99.1s) |

---

## 3. Ma Trận Nhân Vật × Vũ Khí (Character × Weapon DPS Matrix)

| Nhân vật | Kiếm Hiệp Sĩ (`knight_sword`) | Nỏ Săn (`hunter_crossbow`) | Trượng Tập Sự (`apprentice_staff`) | Shotgun (`scrap_shotgun`) | Súng Tesla (`tesla_carbine`) |
|---|---:|---:|---:|---:|---:|
| **Thiết Vệ** (`vanguard`) | 42.6 DPS | 49 DPS | 38 DPS | 35.8 DPS | 49.5 DPS |
| **Liệp Ưng** (`ranger`) | 53.2 DPS | 75.2 DPS | 53.9 DPS | 49.2 DPS | 75.8 DPS |
| **Lam Hỏa** (`elementalist`) | 80.5 DPS | 112.1 DPS | 81.9 DPS | 97.8 DPS | 117.1 DPS |
| **Mộc Linh** (`druid`) | 37.7 DPS | 42.4 DPS | 32.9 DPS | 28.8 DPS | 44.2 DPS |
| **Bánh Răng** (`engineer`) | 53.2 DPS | 66.4 DPS | 113 DPS | 85.8 DPS | 92.5 DPS |

---

## 4. Thống Kê Co-op Scaling (1–4 Người Chơi) & 3 Boss Cuối Màn

| Số người chơi | Thời lượng Phòng chiến đấu (TB) | Thời lượng hạ Boss Biome 1 (TB) | Độ lệch thời gian hạ Boss so với 1P |
|---:|---:|---:|---:|
| **1 người (1P)** | **42.6s** | **101.3s** | **±0%** |
| **2 người (2P)** | **46.7s** | **121.1s** | **±19.5%** |
| **3 người (3P)** | **48.3s** | **97.1s** | **±4.1%** |
| **4 người (4P)** | **50.2s** | **111.6s** | **±10.2%** |

### Bảng Cân Bằng 3 Boss Cuối Màn (Biome 1, Biome 2, Biome 3)

| Biome | Boss | Thời gian hạ 1P | Thời gian hạ 4P | Độ lệch 1P vs 4P | Tỉ lệ thắng | Trạng thái |
|---:|---|---:|---:|---:|---:|:---:|
| **Biome 1** | **Mục Vương Nấm Độc (Biome 1)** (`spore_king`) | **101.3s** | **111.6s** | **±10.2%** | **100%** | ✅ ĐẠT |
| **Biome 2** | **Băng Hậu Kryssa (Biome 2)** (`kryssa_ice_queen`) | **112.7s** | **99.2s** | **±12%** | **100%** | ✅ ĐẠT |
| **Biome 3** | **Titan Lò Rèn (Biome 3)** (`forge_titan`) | **105.1s** | **124.3s** | **±18.3%** | **100%** | ✅ ĐẠT |

---

## 5. Mô Phỏng Đội Hình Phối Hợp Co-op 2P & 4P (Synergy & Đồng Đội Combo)

| Đội hình Co-op | Số người | Thời gian hạ Boss | Phản ứng Nguyên tố | Đồng Đội Combo (+15 Năng lượng) | Kết quả |
|---|---:|---:|---:|---:|:---:|
| **2P Khiên Lửa (Thiết Vệ + Lam Hỏa)** | 2P | **109.7s** | **355** | **159** | ✅ THẮNG |
| **2P Săn Độc (Liệp Ưng + Mộc Linh)** | 2P | **146.7s** | **186** | **79** | ✅ THẮNG |
| **2P Công Nghệ Nguyên Tố (Lam Hỏa + Bánh Răng)** | 2P | **85.1s** | **392** | **207** | ✅ THẮNG |
| **4P Đội Hình Chuẩn (Thiết Vệ + Liệp Ưng + Lam Hỏa + Mộc Linh)** | 4P | **124.1s** | **707** | **410** | ✅ THẮNG |
| **4P Đội Hình Phản Ứng Đa Tầng (Thiết Vệ + Lam Hỏa + Mộc Linh + Bánh Răng)** | 4P | **142.7s** | **930** | **587** | ✅ THẮNG |

---

## 6. Độ Khó Tăng Dần Qua 3 Biome

| Biome | Tên Biome | Chỉ số độ khó chuẩn hóa | Mức tăng so với Biome trước |
|---:|---|---:|---:|
| **Biome 1** | Biome 1 — Rừng Cổ Mục Nát | `×1.00` | Cơ sở (Baseline) |
| **Biome 2** | Biome 2 — Hầm Băng Vĩnh Cửu | `×1.25` | **+25%** |
| **Biome 3** | Biome 3 — Lò Rèn Dung Nham | `×1.56` | **+25%** |

## 7. Kết Luận Kiểm Chứng: ✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG (7/7)
