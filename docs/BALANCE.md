# BẢNG SỐ LIỆU & MỤC TIÊU CÂN BẰNG (BALANCE.md) — ASHEN PACT

> Lưu ý: Toàn bộ các chỉ số dưới đây được khai báo dạng data có kiểu tĩnh tại `packages/shared/src/data/` và tuyệt đối không hardcode trong logic simulation.

## 1. Mục Tiêu Cân Bằng Định Lượng (Balance Targets)

| Chỉ tiêu | Giá trị mục tiêu | Phương pháp kiểm chứng |
|---|---|---|
| **TTK Quái thường (Biome 1, Solo, Vũ khí khởi đầu)** | **0.5s – 1.5s** | Balance Harness (`tools/balance-harness`) |
| **Thời gian dọn 1 Phòng chiến đấu** | **30s – 60s** | Balance Harness & E2E Bot |
| **Thời gian hạ Boss (TTK Boss)** | **90s – 150s** | Balance Harness (1–4 người) |
| **Độ lệch thời gian hạ Boss giữa 1 và 4 người** | **≤ ±20%** | So sánh kết quả mô phỏng 1P vs 4P |
| **Khả năng chịu đòn của Người chơi ở Biome 1** | **6 – 10 đòn** trước khi gục | `(HP + Armor) / EnemyDamage` |
| **Độ lệch DPS Solo giữa 3 nhân vật thiên sát thương** | **≤ ±15%** | Liệp Ưng, Lam Hỏa, Bánh Răng |
| **Tỉ lệ thời gian hoạt động kỹ năng (Skill Uptime)** | **40% – 60%** | `Duration / Cooldown` hoặc chu kỳ hiệu lực |
| **Độ khó tăng dần qua từng Biome** | **+25% mỗi Biome** | Biome 2 = ×1.25 Biome 1; Biome 3 = ×1.25 Biome 2 |

---

## 2. Chỉ Số Cơ Bản 5 Nhân Vật

| ID | Tên nhân vật | HP | Giáp | Năng lượng | Hồi Giáp (Delay / Rate) | Tốc độ chạy (u/s) | Crit cơ bản | Vũ khí khởi đầu |
|---|---|---:|---:|---:|---|---:|---:|---|
| `vanguard` | **Thiết Vệ** | 8 | 6 | 150 | 2.0s / 1.0s | 171 (`95%`) | 5% | `knight_sword` |
| `ranger` | **Liệp Ưng** | 5 | 4 | 200 | 3.0s / 1.0s | 189 (`105%`) | 15% | `hunter_crossbow` |
| `elementalist` | **Lam Hỏa** | 5 | 3 | 260 | 3.0s / 1.0s | 180 (`100%`) | 8% | `apprentice_staff` |
| `druid` | **Mộc Linh** | 6 | 4 | 200 | 3.0s / 1.0s | 180 (`100%`) | 5% | `thorn_staff` |
| `engineer` | **Bánh Răng** | 6 | 5 | 180 | 3.0s / 1.0s | 180 (`100%`) | 8% | `rivet_gun` |

*(Tốc độ chạy chuẩn `100%` = `180` đơn vị thế giới / giây = `5.625` ô / giây).*

---

## 3. Hệ Số Scaling Theo Số Người Chơi (Co-op Scaling)

| Số người chơi | Hệ số HP Quái | Số lượng Quái / Đợt | Tỉ lệ xuất hiện Elite | Hệ số HP Boss | Tốc bắn Quái | Cơ chế Boss bổ sung |
|---:|---:|---:|---:|---:|---:|---|
| **1 người** | `×1.00` | `×1.00` | `10%` | `×1.00` | `+0%` | Cơ bản |
| **2 người** | `×1.40` | `×1.35` | `15%` | `×1.90` | `+8%` | Tốc độ pattern nhanh hơn `+10%` |
| **3 người** | `×1.80` | `×1.70` | `20%` | `×2.80` | `+16%` | Thêm đệ tử hộ vệ & pattern phụ |
| **4 người** | `×2.20` | `×2.00` | `25%` | `×3.70` | `+24%` | Thêm pattern phụ & đổi mục tiêu liên tục |

---

## 4. Chỉ Số Baseline Vũ Khí Mẫu & Khởi Đầu

| ID | Tên vũ khí | Độ hiếm | Loại | Sát thương | Tốc bắn (phát/s) | Năng lượng | Tốc đạn (u/s) | Độ tản (°) | Crit | Nguyên tố / Đặc biệt |
|---|---|---|---|---:|---:|---:|---:|---:|---:|---|
| `knight_sword` | Kiếm Hiệp Sĩ | Trắng | Cận chiến | 14 | 2.2 | 0 | — (Tầm 44) | 110° | 10% | Chém tan đạn thường |
| `hunter_crossbow` | Nỏ Săn | Trắng | Cung/Nỏ | 16 | 1.8 | 0 | 560 | 1.5° | 18% | Xuyên 1 mục tiêu khi chí mạng |
| `apprentice_staff` | Trượng Tập Sự | Trắng | Trượng | 11 | 2.4 | 0 | 440 | 3.0° | 8% | Áp nguyên tố hiện tại của Lam Hỏa |
| `thorn_staff` | Trượng Gai | Trắng | Trượng | 9 | 2.6 | 0 | 460 | 4.0° | 5% | 35% gây Độc nhẹ (3 DMG/s × 3s) |
| `rivet_gun` | Súng Đinh Tán | Trắng | Súng lục | 10 | 3.0 | 0 | 500 | 3.5° | 10% | Đẩy lùi nhẹ |
| `rusty_pistol` | Súng Lục Rỉ Sét | Trắng | Súng lục | 9 | 3.2 | 1 | 520 | 4.0° | 8% | Cân bằng cơ bản |
| `scrap_shotgun` | Shotgun Phế Liệu | Xanh lá | Shotgun | 5 × 5 | 1.1 | 3 | 460 | 18.0° | 6% | Knockback cao ở tầm gần |
| `gale_smg` | Tiểu Liên Gió Lốc | Xanh lá | SMG | 5 | 7.5 | 1 | 540 | 9.0° | 5% | Tốc bắn cao, áp chế |

---

## 5. Chỉ Số Baseline Quái & Boss (Biome 1–3)

### 5.1 Biome 1 — Rừng Cổ Mục Nát
- **Goblin Xạ Thủ (`goblin_shooter`):** HP `24`, Tốc độ `115`, Sát thương `1`, Bắn chùm 3 viên cách 15°, Telegraph `0.5s`. (TTK với vũ khí khởi đầu ~28 DPS ≈ `0.85s`).
- **Slime Xanh (`green_slime`):** HP `20`, Tốc độ `105`, Sát thương `1`, Khi chết tách thành 2 Slime Nhỏ (`HP 8`).
- **Nấm Nổ (`spore_bomber`):** HP `18`, Tốc độ `145`, Sát thương nổ `2` + để lại mây Độc `3s`, Telegraph phồng người `0.6s`.
- **Lợn Rừng (`wild_boar`):** HP `36`, Tốc độ `130` (Lao húc `380`), Sát thương `2`, Telegraph dậm chân đỏ `0.7s`.
- **Pháp Sư Goblin (`goblin_shaman`):** HP `28`, Tốc độ `95`, Sát thương `1`, Hồi `6 HP` cho quái quanh đó mỗi `4s`.
- **Cây Gai (`thorn_turret`):** HP `32`, Cố định, Sát thương `1`, Bắn 6 gai tròn mỗi `2.8s`.
- **Boss Mục Vương Nấm Độc (`boss_mycelium_king`):** HP cơ bản `2400` (1P), Sát thương `2`, 3 Phase (`100%`, `66%`, `33%`).

### 5.2 Hệ số nhân cho Biome 2 & Biome 3
- **Biome 2 (Hầm Băng Vĩnh Cửu):** HP quái trung bình `×1.30`, Sát thương `1–3`, Boss **Băng Hậu Kryssa** HP cơ bản `3000`.
- **Biome 3 (Lò Rèn Dung Nham):** HP quái trung bình `×1.65`, Sát thương `2–4`, Boss **Titan Lò Rèn** HP cơ bản `3800`.

---

## 6. Hệ Thống 6 Phản Ứng Nguyên Tố & Đồng Đội Combo (Phase 5)

| Mã phản ứng | Tên Tiếng Việt | Công thức kết hợp | Hiệu ứng & Sát thương chuẩn |
|---|---|---|---|
| `vaporize` | **HƠI NƯỚC** | `Lửa` + `Băng` | Nổ hơi nước gây `×2.0` sát thương đòn kích hoạt + tạo mù hơi nước `3.0s` (quái bắn lệch góc `~30°`). |
| `shatter` | **VỠ BĂNG** | `Đóng Băng` + `Đòn Nặng/Chí Mạng` | Phá băng gây `×3.0` sát thương chí mạng + văng mảnh băng AoE (`85u`) gây `110%` sát thương Băng. |
| `superconduct` | **SIÊU DẪN** | `Sét` + `Băng` | Phá toàn bộ Khiên Chắn của mục tiêu và giảm `30%` phòng thủ (nhận `+30%` sát thương từ mọi nguồn) trong `6.0s`. |
| `toxic_blast` | **NỔ ĐỘC** | `Lửa` + `Độc` | Kích nổ mây độc AoE (`115u`), gây sát thương Lửa diện rộng và phát tán `5.0s` Độc cho mọi quái xung quanh. |
| `paralysis` | **TÊ LIỆT** | `Sét` + `Độc` | Xung điện thần kinh làm choáng cứng (`Stun`) mục tiêu trong `1.2s` + sát thương Sét cộng thêm. |
| `overload` | **QUÁ TẢI** | `Lửa` + `Sét` | Nổ xung kích điện-nhiệt AoE (`110u`), phá Khiên Chắn và hất văng mạnh (`Knockback 280`) mọi quái trong vùng. |

- **Đồng Đội Combo (`Team Combo`):** Khi Người chơi A áp nguyên tố nền (`primerPlayerId`) và Người chơi B (`triggerPlayerId !== primerPlayerId`) kích nổ bất kỳ phản ứng nào trong 6 phản ứng trên, cả A và B lập tức được hồi **+15 Năng lượng**, tăng bộ đếm `Đồng Đội Combo` của tổ đội và phát hiệu ứng chữ nổi + âm thanh riêng.

---

## 7. Kết Quả Kiểm Chứng Tự Động (Headless Balance Harness — Phase 5)

Báo cáo chi tiết được sinh tự động tại [`docs/balance-report.md`](./balance-report.md) qua lệnh `pnpm balance` (`tools/balance-harness.ts`, chạy **218 lượt mô phỏng** ở tốc độ cao trên `WorldSim` 60Hz):

- **TTK Quái thường (Vũ khí khởi đầu):** Trung bình **0.89s** (`0.60s – 1.12s`) — **✅ ĐẠT** (`0.5s – 1.5s`).
- **Thời lượng 1 Phòng chiến đấu (1–4P):** Trung bình **45.1s** (`1P: 40.2s`, `2P: 43.2s`, `3P: 46.5s`, `4P: 50.5s`) — **✅ ĐẠT** (`30s – 60s`).
- **Thời lượng hạ Boss Biome 1 (1P vs 4P):** `1P: 108.4s`, `2P: 113.3s`, `3P: 113.5s`, `4P: 109.6s` (Lệch 1P vs 4P: **±1.1%**) — **✅ ĐẠT** (`90s – 150s`, lệch `≤ ±20%`).
- **Số đòn chịu được trước khi gục:** **6.2 – 9.8 đòn** — **✅ ĐẠT** (`6 – 10 đòn`).
- **Độ lệch DPS Solo 3 NV sát thương (`ranger`, `elementalist`, `engineer`):** **±5.1%** (`71.3`, `71.6`, `66.1 DPS`) & **5/5 Nhân vật Solo thắng Boss Biome 1 (100%)** — **✅ ĐẠT** (`≤ ±15%`).
- **Uptime Kỹ năng chủ động trong giao tranh:** Trung bình **53.1%** (`44.6% – 58.0%`) — **✅ ĐẠT** (`40% – 60%`).
- **Độ khó tăng giữa các Biome (Biome 1 → 2 → 3):** **+25%** mỗi Biome — **✅ ĐẠT**.

