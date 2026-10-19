# BÁO CÁO MÔ PHỎNG CÂN BẰNG TỰ ĐỘNG (BALANCE REPORT) — ASHEN PACT

> Sinh tự động bởi công cụ Headless Balance Harness (`tools/balance-harness.ts`) với **218 lượt mô phỏng** ở tốc độ cao trên `WorldSim` (60Hz cố định).

## 1. Bảng Tổng Hợp 7 Chỉ Tiêu Cân Bằng Định Lượng (Mục 7.4)

| # | Chỉ tiêu cân bằng | Mục tiêu thiết kế | Kết quả thực đo | Trạng thái |
|---:|---|---|---|---|
| 1 | **TTK Quái thường (Biome 1, Vũ khí khởi đầu)** | `0.5s – 1.5s` | **TB 0.89s** (`0.6s – 1.12s`) | ✅ ĐẠT |
| 2 | **Thời lượng 1 Phòng chiến đấu (1–4P)** | `30s – 60s` | **TB 45.1s** | ✅ ĐẠT |
| 3 | **Thời lượng đánh Boss Biome 1 (1P vs 4P)** | `90s – 150s` (Lệch `≤ ±20%`) | **1P: 108.4s · 4P: 109.6s** (Lệch `±1.1%`) | ✅ ĐẠT |
| 4 | **Số đòn chịu được trước khi gục (HP + Giáp)** | `6 – 10 đòn` | **`6.2 – 9.8 đòn`** | ✅ ĐẠT |
| 5 | **Độ lệch DPS Solo 3 NV sát thương & Solo thắng Boss** | Lệch `≤ ±15%` · 5/5 thắng Boss | **Lệch `±5.1%` · 5/5 Solo Thắng (100%)** | ✅ ĐẠT |
| 6 | **Uptime Kỹ năng chủ động trong giao tranh** | `40% – 60%` | **TB 53.1%** | ✅ ĐẠT |
| 7 | **Độ khó tăng giữa các Biome (Biome 1 → 2 → 3)** | `+25%` mỗi Biome | **Biome 2 `+25%` · Biome 3 `+25%`** | ✅ ĐẠT |

---

## 2. Thống Kê Chi Tiết 5 Nhân Vật (Solo & Kỹ Năng)

| Nhân vật | Vai trò | HP / Giáp | Chịu đòn (TB) | TTK Quái thường | DPS Giao tranh | Uptime Kỹ năng | Solo Boss Biome 1 |
|---|---|---:|---:|---:|---:|---:|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | 8 / 6 | **9.8 đòn** | **0.76s** | **39.4 DPS** | **44.6%** | **100% Thắng** (118.2s) |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | 5 / 4 | **6.9 đòn** | **0.6s** | **71.3 DPS** | **55.3%** | **100% Thắng** (108.4s) |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Phản Ứng Nguyên Tố | 5 / 3 | **6.2 đòn** | **0.99s** | **71.6 DPS** | **57.6%** | **100% Thắng** (107.8s) |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | 6 / 4 | **7.7 đòn** | **1.12s** | **33.7 DPS** | **50.1%** | **100% Thắng** (111.5s) |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | 6 / 5 | **8.5 đòn** | **0.98s** | **66.1 DPS** | **58%** | **100% Thắng** (112.9s) |

---

## 3. Thống Kê Co-op Scaling (1–4 Người Chơi)

| Số người chơi | Thời lượng Phòng chiến đấu (TB) | Thời lượng hạ Boss Biome 1 (TB) | Độ lệch thời gian hạ Boss so với 1P |
|---:|---:|---:|---:|
| **1 người (1P)** | **40.2s** | **108.4s** | **±0%** |
| **2 người (2P)** | **43.2s** | **113.3s** | **±4.5%** |
| **3 người (3P)** | **46.5s** | **113.5s** | **±4.7%** |
| **4 người (4P)** | **50.5s** | **109.6s** | **±1.1%** |

---

## 4. Độ Khó Tăng Dần Qua 3 Biome

| Biome | Tên Biome | Chỉ số độ khó chuẩn hóa | Mức tăng so với Biome trước |
|---:|---|---:|---:|
| **Biome 1** | Biome 1 — Rừng Cổ Mục Nát | `×1.00` | Cơ sở (Baseline) |
| **Biome 2** | Biome 2 — Hầm Băng Vĩnh Cửu | `×1.25` | **+25%** |
| **Biome 3** | Biome 3 — Lò Rèn Dung Nham | `×1.56` | **+25%** |

## 5. Kết Luận Kiểm Chứng: ✅ ĐẠT 100% TẤT CẢ MỤC TIÊU CÂN BẰNG (7/7)
