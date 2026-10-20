# BÁO CÁO CHUẨN ĐỐI CHIẾU THỊ GIÁC & HIỆU NĂNG (POLISH BASELINE — PHASE P0 / v0.1.0)

**Dự án:** Ashen Pact — Khế Ước Tro Tàn  
**Phiên bản lấy mẫu:** `v0.1.0` (Pre-Polish Baseline, nhánh `polish/v0.2.0`)  
**Dữ liệu nguồn:**
- Bộ ảnh chụp chuẩn 58 cảnh + unlit + grayscale + strip: `docs/screenshots/polish-p0/baseline/`
- Số đo trắc quang tự động: `docs/screenshots/polish-p0/baseline/metrics.json`
- Báo cáo hiệu năng GPU phần cứng: `docs/perf-baseline.json`
- Báo cáo đánh giá thị giác độc lập (`pro` model): `docs/screenshots/polish-p0/review-baseline.md`

---

## 1. TỔNG QUAN ĐIỀU HÀNH & KIỂM CHỨNG ĐỘ TẤT ĐỊNH (`--verify-freeze`)

Phase P0 thiết lập hệ thống đo lường thị giác tự động (`pnpm shots`), công cụ trắc quang CIE $L^*$ / bão hòa HSL $S$ (`tools/visual-metrics.ts`), công cụ benchmark GPU phần cứng (`pnpm perf`), và chụp toàn bộ **58 cảnh chuẩn (scenes)** của phiên bản `v0.1.0` trước khi can thiệp mỹ thuật.

### 1.1. Kết quả kiểm chứng tính tất định (`pnpm shots -- --phase p0 --label baseline --verify-freeze`)
- **Tổng số cảnh kiểm tra:** **58 / 58 cảnh** (gồm 9 nhóm: Menu, Hub, Biome 1, Biome 2, Biome 3, Bosses, Co-op & Stress 4P, Modals & Typography tiếng Việt, Art Gallery, và các biến thể độ phân giải `1440p`, `2560×1080 ultrawide`, `1280×1024 5:4`, đồ họa `Low`, ngôn ngữ `EN`).
- **Sai lệch điểm ảnh giữa 2 lần chụp độc lập (Pass 1 vs Pass 2):**
  - **57 / 58 cảnh:** `0` pixel khác biệt (`diffRatio = 0.0000%`).
  - **1 / 58 cảnh (`coop-4p-combat`):** `106 / 2,073,600` pixel khác biệt (`diffRatio = 0.0000511` hay **`0.0051%`**, thấp hơn ngưỡng cho phép `< 0.5%` tới **98 lần**).
- **Lỗi / Cảnh báo Console:** `0` console error, `0` console warning trong suốt toàn bộ quá trình chụp 116 lượt.
- **Tệp phụ trợ tự động sinh:**
  - 9 ảnh unlit (`?lighting=0`) tách riêng chất liệu mặt sàn khỏi lightmap: `hub-solo-unlit.png`, `b1-start-room-unlit.png`, `b1-combat-unlit.png`, `b1-combat-low-unlit.png`, `b2-start-room-unlit.png`, `b2-combat-unlit.png`, `b3-start-room-unlit.png`, `b3-combat-unlit.png`, `boss-b2-blizzard-unlit.png`.
  - Ảnh kiểm tra sắc độ chuyển xám: `b3-combat-grayscale.png`.
  - 2 dải ảnh chuyển động 8 khung hình liên tiếp (`5 frames/bước`): `b1-portal-active-strip.png`, `gallery-characters-strip.png`.

### 1.2. Tóm tắt hiện trạng thị giác Baseline `v0.1.0`
Đánh giá độc lập từ Visual Reviewer (`review-baseline.md`) kết hợp số đo trắc quang `metrics.json` xác nhận phiên bản `v0.1.0` đang ở mức **khung sườn kỹ thuật (engineering prototype)** với điểm trung bình **2.44 / 10**:
1. **Tầm nhìn bị bóp nghẹt & lỗi lightmap:** Vòng tầm nhìn hẹp `mainPlayerVisionRadius = 310` cùng `vignetteStrength = 0.18–0.38` dìm 4 góc màn hình mất từ **52% đến 65%** độ sáng (`cornerRetentionRatio` chỉ đạt `35.5%–47.6%`, `minLitFloorL = 0.00`). `brushSprite` thiếu `BlendMode.ADD` khiến lightmap ghi đè làm sàn băng B2 biến sang màu vàng xanh lá bẩn; chậu lửa không tạo được vũng sáng ấm (`brazierLightPoolDeltaL <= 0`).
2. **Mặt sàn "giấy kẻ ô" tương phản cực gắt:** Mỗi ô gạch $32\times32$ đều vẽ viền đen `INK_DARK` và bevel sáng lặp lại, đẩy $\Delta L^*$ toàn sàn lên **53.5–72.6** (mục tiêu $\le 14$) và vùng trung tâm giao chiến lên **54.5–72.6** (mục tiêu $\le 8$).
3. **Độ dễ đọc & nhận diện đạn kém:** Nhân vật thiếu rim-light góc trên-trái (`-135°`); đạn địch ở B3 thiếu cấu trúc lõi trắng + viền tối nên hòa lẫn vào hạt `fx_spark` khi kiểm tra trên `b3-combat-grayscale.png`.
4. **UI/HUD lộ công cụ debug & méo khung hình:** Camera áp dụng zoom không đồng đều gây méo hình ở tỷ lệ `5:4` (`1280×1024`) và `21:9` (`2560×1080`); HUD lộ phím debug `F1–F7`, mâu thuẫn vẽ 4 ô vũ khí so với giới hạn 2 ô; nhãn `[E]` hiện từ xa đè chồng lên nhau.

---

## 2. CHUẨN HIỆU NĂNG GPU PHẦN CỨNG (`docs/perf-baseline.json`)

Benchmark thực thi trên trình duyệt Chromium có giao diện (headed GPU D3D11) tại độ phân giải `1920×1080`, mức đồ họa `High`, gồm 2 chế độ: **Uncapped Frame-Time** (`--disable-gpu-vsync --disable-frame-rate-limit`) và **VSync 60Hz thực tế** (`5s warmup + 20s đo`).

- **GPU Vendor:** `Google Inc. (AMD)`
- **GPU Renderer (`UNMASKED_RENDERER_WEBGL`):** `ANGLE (AMD, AMD Radeon(TM) Graphics (0x0000164C) Direct3D11 vs_5_0 ps_5_0, D3D11)`
- **Hardware Accelerated:** `true`

| Chế độ đo & Kịch bản | Số mẫu (Frames) | Mean (ms) | p50 (ms) | p95 Baseline (ms) | p99 (ms) | FPS tương đương / thực tế | Bộ nhớ Heap Đầu -> Cuối (MB) | Ngưỡng trần P12 (+15% p95 / Spec) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| **Uncapped — Normal Combat** (`1080p High`) | 2,708 | 7.386 | **7.200** | **8.700** | 10.293 | **135.39 FPS** | 119.30 $\rightarrow$ 144.46 (+25.15) | `p95 <= 10.005 ms` (Spec trần `11.0 ms`) |
| **Uncapped — Stress Combat** (`4P + 80E + 600B`) | 1,719 | 11.639 | **11.400** | **13.500** | 16.246 | **85.92 FPS** | 129.96 $\rightarrow$ 149.24 (+19.29) | `p95 <= 15.525 ms` (Spec trần `15.0 ms`) |
| **VSync 60Hz — Normal Combat** (`1080p High`) | ~1,201 | 16.653 | 16.667 | 17.000 | — | **60.05 FPS** | — | **$\ge 60.0$ FPS** |
| **VSync 60Hz — Stress Combat** (`4P + 80E + 600B`) | ~1,184 | 16.892 | 16.667 | 17.000 | — | **59.20 FPS** | — | **$\ge 58.0$ FPS** |

> **Ngân sách hiệu năng cho toàn đợt Polish v0.2.0:** Mọi cải tiến shader, lightmap, particle và rig ở các Phase P1–P12 phải giữ vững **VSync Normal $\ge 60$ FPS**, **VSync Stress $\ge 58$ FPS**, và không làm `p95Ms` Uncapped vượt quá ngưỡng trần Spec (`<= 11.0 ms` Normal, `<= 15.0 ms` Stress) hoặc lệch quá `+15%` so với baseline phần cứng.

---

## 3. BẢNG SỐ ĐO TRẮC QUANG BASELINE (`metrics.json` — UNLIT vs LIT)

Số đo trắc quang tự động trên các vùng lấy mẫu chuẩn (`floor_all`, `center_arena`, 4 góc `corner_tl/tr/bl/br`, và `brazier_pool`) đối chiếu trực tiếp với mục tiêu thiết kế tại Mục 3.5 của Spec (`INK_DARK #141019` có $L^* = 5.325$):

### 3.1. Bảng tổng hợp thông số Unlit (`?lighting=0`) và Full Lit

| Scene ID | Unlit Floor Mean $L^*$ | Unlit Floor $\Delta L^*$ (`p95-p5`) | Unlit Center $\Delta L^*$ | Unlit Floor Mean $S$ | Contrast vs `INK_DARK` (Unlit) | Lit Floor Mean $L^*$ | Lit Floor $\Delta L^*$ | Lit Center $\Delta L^*$ | Lit Floor Mean $S$ | Min Lit Floor $L^*$ | Corner Retention Ratio | Brazier Pool $\Delta L^*$ |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `hub-solo` | 20.16 | 72.22 | 70.22 | 0.320 | +14.84 | 15.87 | 76.15 | 73.81 | 0.493 | 0.96 | **62.3%** (`0.623`) | **-3.43** |
| `b1-start-room` | 21.16 | 53.51 | 53.51 | 0.362 | +15.83 | 14.47 | 44.58 | 46.10 | 0.678 | 0.00 | **47.4%** (`0.474`) | **+0.07** |
| `b1-combat` | 21.95 | 53.51 | 57.27 | 0.362 | +16.62 | 14.74 | 44.84 | 49.33 | 0.638 | 0.00 | **47.4%** (`0.474`) | **-0.27** |
| `b2-start-room` | 24.37 | 72.61 | 71.27 | 0.569 | +19.05 | 15.82 | 59.67 | 59.36 | 0.658 | 0.00 | **44.9%** (`0.449`) | **-3.23** |
| `b2-combat` | 25.30 | 72.61 | 72.57 | 0.578 | +19.98 | 16.47 | 59.81 | 59.81 | 0.658 | 0.00 | **47.6%** (`0.476`) | **-4.43** |
| `b3-start-room` | 17.30 | 34.70 | 32.18 | 0.444 | +11.98 | 10.64 | 26.67 | 24.20 | 0.803 | 0.00 | **44.4%** (`0.444`) | **-1.41** |
| `b3-combat` | 18.50 | 42.61 | 54.53 | 0.457 | +13.17 | 12.00 | 43.97 | 41.85 | 0.809 | 0.00 | **35.5%** (`0.355`) | **-3.53** |
| `boss-b2-blizzard` | 29.15 | 72.61 | 69.50 | 0.596 | +23.83 | 17.46 | 62.00 | 64.62 | 0.787 | 0.10 | **39.3%** (`0.393`) | **-9.00** |
| `b1-combat-low` | 21.72 | 53.51 | 55.76 | 0.365 | +16.39 | 17.11 | 39.24 | 46.13 | 0.422 | 0.00 | **92.5%** (`0.925`) | **-1.31** |
| **Mục tiêu Spec 3.5** | **22–38** | **$\le 14.0$** | **$\le 8.0–10.0$** | **$\le 0.30–0.35$** | **$\ge +16.0–22.0$** | **20–34** | **$\le 18.0$** | **$\le 12.0$** | **$\le 0.35$** | **$\ge 15.0$** | **$\ge 72\%–82\%$** | **$+6.0 \le \Delta L^* \le +14.0$** |

### 3.2. Chi tiết độ sáng 4 góc phòng (`corner_tl`, `corner_tr`, `corner_bl`, `corner_br` Mean $L^*$)

| Scene ID | `corner_tl` (Unlit $\rightarrow$ Lit) | `corner_tr` (Unlit $\rightarrow$ Lit) | `corner_bl` (Unlit $\rightarrow$ Lit) | `corner_br` (Unlit $\rightarrow$ Lit) | Nhận xét trắc quang |
|---|---|---|---|---|---|
| `hub-solo` | $20.17 \rightarrow 8.26$ | $20.35 \rightarrow 9.27$ | $17.33 \rightarrow 16.44$ | $9.90 \rightarrow 8.23$ | Góc trên tối sầm xuống $L^* \approx 8–9$ |
| `b1-start-room` | $19.96 \rightarrow 9.76$ | $18.91 \rightarrow 7.07$ | $19.89 \rightarrow 11.61$ | $20.58 \rightarrow 9.18$ | Mất hơn $52\%$ độ sáng ở cả 4 góc |
| `b1-combat` | $20.01 \rightarrow 9.90$ | $25.57 \rightarrow 12.77$ | $19.91 \rightarrow 9.81$ | $21.16 \rightarrow 8.58$ | Góc dưới-phải sụt xuống $L^* = 8.58$ |
| `b2-start-room` | $19.72 \rightarrow 9.07$ | $16.32 \rightarrow 5.23$ | $19.65 \rightarrow 9.65$ | $20.54 \rightarrow 10.28$ | Góc trên-phải $L^* = 5.23$ (tối hơn `INK_DARK`) |
| `b2-combat` | $19.47 \rightarrow 8.85$ | $14.92 \rightarrow 6.15$ | $19.27 \rightarrow 10.12$ | $20.08 \rightarrow 9.95$ | Ám màu xanh bẩn (`meanS` vọt lên `0.74–0.88`) |
| `b3-start-room` | $12.42 \rightarrow 5.59$ | $17.72 \rightarrow 9.86$ | $12.10 \rightarrow 4.98$ | $12.58 \rightarrow 3.91$ | 2 góc dưới đen hơn viền nhân vật (`contrast < 0`) |
| `b3-combat` | $12.24 \rightarrow 4.49$ | $16.39 \rightarrow 5.98$ | $11.95 \rightarrow 4.25$ | $12.83 \rightarrow 4.24$ | 3/4 góc tối hơn `INK_DARK` ($L^* = 4.24–4.49$) |
| `boss-b2-blizzard` | $75.40 \rightarrow 38.78$ | $44.89 \rightarrow 15.39$ | $75.45 \rightarrow 25.33$ | $20.44 \rightarrow 5.42$ | Blizzard veil + vignette dìm góc BR xuống $5.42$ |

---

## 4. ĐIỂM SỐ RUBRIC ĐỘC LẬP & TOP 15 VẤN ĐỀ THỊ GIÁC NGHIÊM TRỌNG NHẤT

### 4.1. Bảng điểm Rubric 9 tiêu chí (Independent Visual Reviewer — `review-baseline.md`)

| STT | Tiêu chí Rubric (Mục 6 Spec) | Điểm Baseline | Đánh giá tóm tắt | Phase giải quyết chính |
|:---:|---|:---:|---|---|
| 1 | **Môi trường (Environment & Biomes)** | **3 / 10** | Sàn "giấy kẻ ô" $\Delta L^* > 50$; thiếu phân vùng ven tường/giữa tâm; Hub dùng tile B1; B2/B3 lẫn nấm B1 | P4, P5 |
| 2 | **Ánh sáng & Tầm nhìn trong trẻo (Lighting & Visibility)** | **2 / 10** | Vòng tầm nhìn `310u` + vignette làm tối đen 4 góc (`35.5%–47.6%`); lỗi `brushSprite` thiếu `ADD` làm sàn B2 ám xanh bẩn; đuốc không có vũng sáng | P3, P6 |
| 3 | **Độ dễ đọc (Readability & Silhouette)** | **3 / 10** | Sàn tối ($L^* \approx 17–25$) nuốt viền `INK_DARK`; nhân vật thiếu rim-light `-135°`; đạn địch B3 lẫn với `fx_spark` trên ảnh xám | P3, P4, P10a, P10b |
| 4 | **Vật thể tương tác (Interactables & Prompts)** | **2 / 10** | Vật thể ở xa tối đen dưới lightmap; nhãn `[E]` luôn hiện từ xa đè chồng lên nhau; rương báu không có prompt `[E]` | P6, P7 |
| 5 | **Portal / Cửa qua phòng (Portals & Doors)** | **2 / 10** | Portal là hình tròn 2D đỏ-xanh xoay đơn điệu; cửa phòng chỉ là lỗ đen khoét tường kèm icon khóa nhỏ, thiếu vòm đá & màn chắn | P8 |
| 6 | **UI / HUD (User Interface & Modern HUD)** | **2 / 10** | Camera méo hình ở `5:4` và `21:9`; lộ phím/nút debug `F1–F7` và chuỗi test tiếng Việt; HUD vẽ 4 ô vũ khí mâu thuẫn tooltip 2 ô | P1, P2, P3, P9a, P9b |
| 7 | **Nhân vật & Animation (Characters & Rigs)** | **3 / 10** | Shading 1 lớp phẳng, thiếu rim-light `-135°`; chạy bộ chỉ nhún sin, thiếu nghiêng thân/spring áo choàng/pose `hurt`/`dash`; quái dùng fast composite | P10a |
| 8 | **FX & Phản ứng nguyên tố (Combat FX & Juice)** | **3 / 10** | Thiếu `BlendMode.ADD`; mây `fx_ambient_mist` làm đục màn hình; hạt `fx_spark` B3 gây nhầm với đạn; popup sát thương đè chồng | P3, P10b |
| 9 | **Tổng thể "Cảm giác sản phẩm" (Product Feel)** | **2 / 10** | Mang nặng tính chất prototype kỹ thuật, chưa đạt chuẩn mỹ thuật thương mại đồng bộ | P1–P12 |
| **TB** | **ĐIỂM TRUNG BÌNH TOÀN DIỆN** | **2.44 / 10** | **Chuẩn đối chiếu gốc (Ground Truth Baseline)** | **P1–P12** |

---

### 4.2. Bảng xếp hạng Top 15 vấn đề thị giác theo mức độ nghiêm trọng

| Hạng | Tên lỗi & Hiện tượng thị giác | Mức độ | File ảnh minh chứng (`docs/screenshots/polish-p0/baseline/`) | Tọa độ / Vị trí trên ảnh | Phase xử lý | Tác động cốt lõi |
|:---:|---|:---:|---|---|:---:|---|
| **1** | **Camera zoom không đồng đều gây méo hình ở tỷ lệ khác 16:9** | **Blocker** | [b1-combat-1280x1024.png](screenshots/polish-p0/baseline/b1-combat-1280x1024.png), [b1-combat-ultrawide.png](screenshots/polish-p0/baseline/b1-combat-ultrawide.png) | Toàn khung hình (`1280×1024` & `2560×1080`) | **P3** | `setZoom(w/960, h/540)` làm co kéo biến dạng toàn bộ thế giới, nhân vật và HUD |
| **2** | **Bóng tối che khuất 4 góc màn hình (Fog-of-War / Vignette)** | **Blocker** | [b3-combat.png](screenshots/polish-p0/baseline/b3-combat.png), [b1-start-room.png](screenshots/polish-p0/baseline/b1-start-room.png), [b2-start-room.png](screenshots/polish-p0/baseline/b2-start-room.png) | 4 góc màn hình (`cornerRetentionRatio` 35.5%–47.6%) | **P3** | Vòng tầm nhìn `310u` và vignette biến góc phòng thành hố đen ($L^* < 5$), nuốt chửng quái và đạn |
| **3** | **Lỗi lightmap blend ghi đè làm sàn băng B2 ám màu xanh lá bẩn** | **Blocker** | [b2-start-room.png](screenshots/polish-p0/baseline/b2-start-room.png), [b2-combat.png](screenshots/polish-p0/baseline/b2-combat.png), [boss-b2.png](screenshots/polish-p0/baseline/boss-b2.png) | Nửa trái và giữa sàn `[x: 100..960, y: 150..950]` | **P3** | `brushSprite` thiếu `BlendMode.ADD` khiến các nguồn sáng ghi đè làm sai lệch hoàn toàn màu sàn băng |
| **4** | **Sàn nhà là lưới ô vuông tương phản cao ("giấy kẻ ô")** | **Blocker** | [b1-start-room.png](screenshots/polish-p0/baseline/b1-start-room.png), [b2-start-room.png](screenshots/polish-p0/baseline/b2-start-room.png), [b3-start-room.png](screenshots/polish-p0/baseline/b3-start-room.png) | Toàn bộ mặt sàn `[x: 100..1820, y: 150..950]` ($\Delta L^* = 53.5\text{–}72.6$) | **P4** | Viền đen `INK_DARK` và bevel sáng trên từng ô $32\times32$ gây nhiễu thị giác nặng ở vùng giao chiến trung tâm |
| **5** | **Đạn địch và tàn lửa ambient B3 trùng hình dạng trên ảnh xám** | **Blocker** | [b3-combat.png](screenshots/polish-p0/baseline/b3-combat.png), [b3-combat-grayscale.png](screenshots/polish-p0/baseline/b3-combat-grayscale.png) | Vùng giao chiến `[x: 800..1200, y: 350..650]` | **P10b** | Đạn địch thiếu lõi trắng + viền tối `1.5u`, không thể phân biệt với hạt `fx_spark` và đốm sáng sàn |
| **6** | **Lộ toàn bộ hàng phím và nút Debug trên HUD & Menu chính** | **Major** | [menu.png](screenshots/polish-p0/baseline/menu.png), [b1-start-room.png](screenshots/polish-p0/baseline/b1-start-room.png), [hub-solo.png](screenshots/polish-p0/baseline/hub-solo.png) | Đỉnh HUD `[x: 20..1900, y: 15..120]`, đáy Menu `[x: 100..1820, y: 830..950]` | **P1** | Lộ hướng dẫn `F1–F7`, nút `Art Gallery`, `Ng.Tố`, `DPS`, nút `Đổi Hoạt Ảnh` và chuỗi test dấu tiếng Việt |
| **7** | **Xung đột hiển thị 4 ô vũ khí trên HUD vs Tooltip giới hạn 2 ô** | **Major** | [b1-start-room.png](screenshots/polish-p0/baseline/b1-start-room.png), [hub-near-rack.png](screenshots/polish-p0/baseline/hub-near-rack.png), [b1-weapon-ground-near.png](screenshots/polish-p0/baseline/b1-weapon-ground-near.png) | Đáy màn hình `[x: 150..1700, y: 890..980]` | **P2** | HUD vẽ 4 ô vũ khí `[1]..[4]` trong khi tooltip so sánh ghi rõ chỉ mang tối đa 2 vũ khí |
| **8** | **Vật thể tương tác ở xa tối đen dưới lightmap; nhãn `[E]` hiện từ xa đè nhau** | **Major** | [b1-dark-interactables.png](screenshots/polish-p0/baseline/b1-dark-interactables.png), [b1-merchant.png](screenshots/polish-p0/baseline/b1-merchant.png), [hub-near-rack.png](screenshots/polish-p0/baseline/hub-near-rack.png) | Khu vực vật thể xa `[x: 1200..1500, y: 300..750]` & tâm shop `[x: 900..1200, y: 460..540]` | **P6, P7** | Vật thể thiếu đèn/glow ADD riêng; toàn bộ nhãn chữ luôn hiện ở mọi khoảng cách gây đè chữ nát vụn |
| **9** | **Rương kho báu hoàn toàn không có nhãn prompt tương tác** | **Major** | [b1-chest-closed-far.png](screenshots/polish-p0/baseline/b1-chest-closed-far.png), [b1-chest-near.png](screenshots/polish-p0/baseline/b1-chest-near.png) | Tọa độ rương `[x: 900..1000, y: 450..520]` | **P7** | Đứng sát rương vẫn không có prompt `[E] Mở Rương` hay viền highlight |
| **10** | **Cửa phòng chỉ là lỗ đen khoét tường; Portal tầng là hình tròn 2D phẳng** | **Major** | [b1-door-locked.png](screenshots/polish-p0/baseline/b1-door-locked.png), [b1-portal-active.png](screenshots/polish-p0/baseline/b1-portal-active.png), [b1-portal-active-strip.png](screenshots/polish-p0/baseline/b1-portal-active-strip.png) | Mép tường phải `[x: 1780..1820, y: 460..540]`, tâm portal `[x: 1040..1120, y: 460..540]` | **P8** | Cửa thiếu vòm đá và màn chắn năng lượng; portal chỉ xoay góc 2D đơn sơ, thiếu shader xoáy cực & hạt hút |
| **11** | **Bão tuyết Boss 2 Kryssa làm tối đen u ám toàn màn hình** | **Major** | [boss-b2-blizzard.png](screenshots/polish-p0/baseline/boss-b2-blizzard.png) | Toàn khung cảnh (`ambient 0x3e5672`, `vignette 0.38`) | **P3** | Phase 3 của Boss 2 dìm tối màn hình thay vì thể hiện bão tuyết dày sắc nét và sương giá mép màn hình |
| **12** | **Surface nguyên tố cắt khối chữ nhật phẳng lì, thiếu bờ viền tự nhiên** | **Major** | [b1-poison-swamp.png](screenshots/polish-p0/baseline/b1-poison-swamp.png), [b3-lava-surface.png](screenshots/polish-p0/baseline/b3-lava-surface.png) | Vùng surface `[x: 770..1400, y: 360..810]` | **P4** | Đầm độc B1 và dung nham/băng chuyền B3 dán chữ nhật vuông góc, không có bờ rêu cong hay kênh đá âm sàn |
| **13** | **Hub thiếu bản sắc kiến trúc (dùng gạch B1) và bị bảng LAN QR che khuất** | **Major** | [hub-solo.png](screenshots/polish-p0/baseline/hub-solo.png), [hub-near-statue.png](screenshots/polish-p0/baseline/hub-near-statue.png) | Toàn mặt sàn Hub & nửa phải màn hình `[x: 700..980, y: 340..870]` | **P4, P9b** | Hub dùng lại tile xanh lá B1 thay vì đá cổ `#414B61`; bảng Doanh Trại LAN mở to chiếm nửa phải màn hình |
| **14** | **Nameplate đồng đội to bản đè trực tiếp lên đầu nhân vật** | **Major** | [coop-4p-combat.png](screenshots/polish-p0/baseline/coop-4p-combat.png), [hub-coop-2p.png](screenshots/polish-p0/baseline/hub-coop-2p.png) | Khu vực đội hình `[x: 650..1000, y: 450..550]` | **P7** | Nhãn tên người chơi in đậm cỡ lớn đè lên thân/đầu nhân vật và chồng chéo nhau trong giao chiến 4P |
| **15** | **Vũng sáng chậu lửa/đuốc không hiển thị trên mặt sàn ($\Delta L^* \le 0$)** | **Minor** | [b1-start-room.png](screenshots/polish-p0/baseline/b1-start-room.png), [b2-start-room.png](screenshots/polish-p0/baseline/b2-start-room.png), [b3-start-room.png](screenshots/polish-p0/baseline/b3-start-room.png) | Vùng `brazier_pool` `[x: 380..450, y: 260..330]` (`brazierLightPoolDeltaL = -4.43..+0.07`) | **P3, P5** | Lightmap MULTIPLY bị kẹp 1.0 và thiếu lớp glow ấm `BlendMode.ADD` phía trên, khiến đuốc không tỏa vũng sáng |
