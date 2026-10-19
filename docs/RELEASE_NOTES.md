# 📜 GHI CHÚ PHÁT HÀNH (RELEASE NOTES) — ASHEN PACT `v0.1.0`

- **Phiên bản:** `v0.1.0` (*First Complete Vertical Slice & Co-op LAN Release*)
- **Nền tảng phát hành:** Windows 10/11 64-bit (`AshenPact-v0.1.0-win-x64`) & Web Browser (Chromium / Chrome / Edge / Firefox)
- **Chế độ chơi:** Chơi đơn (*Solo*) & Phối hợp mạng nội bộ (*Co-op LAN / Wi-Fi 2–4 người chơi*)

---

## 🌟 1. Tổng Kết Các Tính Năng Chính Trong Bản Phát Hành `v0.1.0`

### 1.1 Kiến Trúc Simulation 60Hz & Co-op Mạng LAN Một Chạm (`Phase 0, 1, 4, 8`)
- **Tách biệt hoàn toàn Simulation và Rendering:** Toàn bộ logic chiến đấu, va chạm hình học (`Circle vs Circle`, `Circle vs AABB`, lưới `SpatialHashGrid 64×64`), AI quái vật, đạn đạo và nguyên tố chạy tất định ở **60Hz cố định** trong `@ashen-pact/shared`.
- **Chơi đơn & Co-op LAN đồng nhất:** Chế độ Solo dùng `LocalTransport` (độ trễ `< 1 frame`), chế độ Co-op LAN dùng `NetworkTransport` kết nối tới máy chủ Colyseus authoritative chạy ngay trên máy Chủ Phòng (`AshenPact-Host.exe` hoặc `start-host.bat`).
- **Mạng Wi-Fi mượt mà & Tiết kiệm băng thông:**
  - Dự đoán chuyển động & lướt phía Client (*Client-Side Prediction & Smooth Reconciliation*), nội suy thực thể thích ứng `50–100ms` (*Adaptive Interpolation*), và đồng bộ loạt đạn tất định theo `seed` (*Deterministic Bullet Volley*) giữ băng thông **≤ 24 KB/s/client** (ngay cả khi 4 người chiến đấu cùng lúc).
  - Tự động phát hiện địa chỉ IPv4 LAN hợp lệ (lọc bỏ adapter ảo WSL/VPN/Docker), sinh **Mã QR chuẩn ISO/IEC 18004** ngay trên màn hình Console lẫn bảng **Mời Bạn Bè (`[I]`)** trong Sảnh Doanh Trại, hỗ trợ **tự động kết nối lại trong 30 giây (`Reconnect 30s`)** khi rớt mạng tạm thời.

### 1.2 Đồ Họa 2D Procedural Vector, Ánh Sáng Động & Game Feel (`Phase 0, 1, 2`)
- **100% Procedural Vector Art:** Mọi thực thể được dựng từ các bộ phận tách rời (`CutoutRig` 8 bộ phận) với viền tối đồng nhất `#141019` (`2.5u`), đổ bóng cel-shading và điểm sáng rim-light, được bake ở độ phân giải cao theo DPR (`TextureBaker` 4x–8x) giúp hình ảnh sắc nét tuyệt đối ở cả 1080p và 1440p.
- **Ánh sáng động & Post-FX Shader:** Hệ thống `LightingPipeline` (`RenderTexture` hòa trộn `MULTIPLY` ở `depth = 34` giúp các tín hiệu cảnh báo đỏ `telegraph` và đạn địch luôn sáng rõ 100%) kết hợp `BiomePostFxPipeline` (Bloom 4-tap, Vignette, nhịp đập viền đỏ khi máu thấp, Chromatic Aberration khi chấn động và Color Grading riêng cho từng Biome).
- **Trải nghiệm chiến đấu "Đã Tay" (Juicy Game Feel):** Hit-stop `30–50ms`, rung màn hình Perlin theo `trauma^2`, giật lùi vũ khí khi bắn, vệt chém cận chiến phá đạn, mảnh vỡ rig văng ra khi quái chết, bóng mờ `afterimage` khi Dash và 120 vệt decal bền trên mặt đất.

### 1.3 Năm Nhân Vật Độc Đáo, 6 Phản Ứng Nguyên Tố & Đồng Đội Combo (`Phase 5`)
- **5 Nhân vật với lối chơi và vai trò riêng biệt:**
  1. **Thiết Vệ (`vanguard`):** Đỡ đòn tuyến đầu với **Tường Khiên Hồng Ngọc** chặn đạn phản kích và cường hóa **`+30% sát thương` + `+1 xuyên thấu`** cho đạn đồng đội bắn xuyên qua khiên.
  2. **Liệp Ưng (`ranger`):** Xạ thủ tầm xa với **Mũi Tên Săn Mồi** lộn nhào bắn tên **Đánh Dấu** khiến mục tiêu nhận **`+25% sát thương` từ toàn đội** và bị Trụ Tesla ưu tiên khóa mục tiêu.
  3. **Lam Hỏa (`elementalist`):** Pháp sư xoay vòng **Lửa → Băng → Sét**, ném **Cầu Nguyên Tố** tạo vùng tẩm nguyên tố cho mọi viên đạn đồng đội bay ngang qua.
  4. **Mộc Linh (`druid`):** Hỗ trợ hồi phục với **Cây Thiêng Cổ Thụ** hồi máu diện rộng, trói chân quái và **hồi sinh tức thì đồng đội đang gục ngã**.
  5. **Bánh Răng (`engineer`):** Kỹ sư công nghệ sửa chữa **Cổ Máy Cổ Đại** trên bản đồ và đặt **Trụ Pháo Tesla** — khi đồng đội bắn nạp đủ `100%` điện tích vào trụ sẽ kích nổ **Xung EMP** làm choáng quái và xóa sạch đạn địch xung quanh.
- **6 Phản ứng nguyên tố & Đồng Đội Combo:** **Hơi Nước** (*Cháy + Lạnh*), **Vỡ Băng** (*Đóng Băng + Đòn nặng*), **Siêu Dẫn** (*Sét + Lạnh*), **Nổ Độc** (*Cháy + Độc*), **Tê Liệt** (*Sét + Độc*), **Quá Tải** (*Cháy + Sét*). Khi 2 người chơi khác nhau phối hợp tạo phản ứng sẽ kích hoạt **⚡ Đồng Đội Combo (`+15 Năng lượng` cho cả hai)**.

### 1.4 Chiến Dịch 3 Biome (6 Tầng), 24 Vũ Khí, 16 Quái Thường/Elite & 3 Boss (`Phase 3, 6`)
- **Sinh tầng thủ tục theo Seed (`generateDungeonFloor`):** Đảm bảo liên thông 100% qua kiểm chứng BFS, bao gồm Phòng Khởi Đầu, Phòng Chiến Đấu, Phòng Kho Báu (với câu đố **2 Tấm Áp Lực Co-op**), Thương Nhân Hắc Ám, Điện Thờ Cổ Đại, Phòng Bí Mật (phá tường nứt `'cracked_wall'`) và Phòng Cổng / Boss.
- **24 Vũ khí trải đều 5 bậc hiếm (`Trắng → Xanh lá → Xanh dương → Tím → Cam`):** Gồm cả 2 vũ khí Co-op đặc biệt là **Súng Hạt Giống (`seed_gun`)** nở Hoa Sinh Mệnh hồi máu/giáp cho đồng đội và **Trượng Liên Kết (`tether_staff`)** nối tia điện-nhiệt giữa 2 người chơi.
- **3 Biome & 3 Boss 3 Phase có cơ chế Co-op riêng:**
  - **Biome 1 — Rừng Cổ Mục Nát:** Boss **Mục Vương Nấm Độc (`spore_king`)** kèm cơ chế **2 Nấm Hộ Vệ** tạo khiên ở tổ đội 3–4 người.
  - **Biome 2 — Hầm Băng Vĩnh Cửu:** Boss **Băng Hậu Kryssa (`kryssa_ice_queen`)** với 4 cột pha lê khúc xạ laser, phân thân gương không bóng đổ và **Lồng Băng Vĩnh Cửu (`ice_prison`)** cần đồng đội bắn vỡ để cứu.
  - **Biome 3 — Lò Rèn Dung Nham:** Boss **Titan Lò Rèn (`forge_titan`)** với sóng xung kích búa nện đảo chiều băng chuyền và **2 Lõi Năng Lượng (`forge_energy_core`)** cần cả đội phá hủy đồng thời trong `3 giây` để gây quá tải làm choáng Boss.

### 1.5 Giao Diện Đa Ngôn Ngữ (`VI` / `EN`), Vinh Danh MVP & Âm Thanh Động (`Phase 7`)
- **Giao diện hoàn thiện:** Menu chính động bên đống lửa trại 5 nhân vật, HUD vector có thanh máu phụ tụt trễ, bảng so sánh vũ khí dưới đất kèm DPS ước tính, biển hướng dẫn tự nhiên ở Doanh Trại, chuyển cảnh **Iris Transition**, bảng thống kê chi tiết từng người chơi và **4 danh hiệu MVP** cuối trận (*Chiến Thần Sát Thương, Kẻ Săn Quái, Bậc Thầy Nguyên Tố, Thần Y Cứu Trợ*).
- **Đa ngôn ngữ `vi` / `en`:** 450+ khóa ngôn ngữ đồng bộ 100% giữa Tiếng Việt và Tiếng Anh, chuyển đổi tức thì tại Menu và Cài đặt.
- **Âm thanh tổng hợp 100%:** 47 preset SFX định vị 2D (`ZzfxSynth`) và 7 bản nhạc nền động 2 lớp *Khám Phá / Chiến Đấu* (`ProceduralMusicSynth`).

---

## 📊 2. Kết Quả Kiểm Định Chất Lượng & Hiệu Năng (`Phase 8`)

- **Cân bằng định lượng (`pnpm balance`):** Đạt **7/7 chỉ tiêu mục 7.4** qua **291 lượt mô phỏng tự động** (TTK quái khởi đầu TB `0.89s`; phòng chiến đấu TB `47s`; cả 3 Boss đạt `99.2s – 112.7s` với độ lệch 1P vs 4P `≤ ±12%`; 5/5 nhân vật Solo thắng Boss 100%).
- **Soak Test 20 phút (`72.000` ticks @ 60Hz):** Chạy liên tục 4 người chơi Co-op qua nhiều tầng, đánh cả 3 Boss và kích nổ hàng nghìn phản ứng nguyên tố — không rò rỉ bộ nhớ, thời gian xử lý mỗi tick giữ vững `< 0.25 ms/tick`.
- **Hiệu năng Render & Đa trình duyệt:** Giữ vững **~60 FPS** ở 1080p High ngay cả trong bài Stress Test (4 người chơi + 80 quái + 600+ đạn + 48 nguồn sáng động); tương thích tốt trên **Chromium**, **Google Chrome**, **Microsoft Edge** và **Firefox**.

---

## 🔮 3. Đề Xuất Lộ Trình Mở Rộng Tiếp Theo (`v0.2.0+` Roadmap)

1. **Chế Độ Vô Tận (*Endless / Boss Rush Mode*):**
   - Sau khi hạ Titan Lò Rèn ở Tầng 6, mở cổng Không Gian Hỗn Mang cho phép tổ đội lặp vòng qua các tầng độ khó tăng dần (*Loop 1, Loop 2...*) hoặc chế độ **Đấu Trường Boss Liên Hoàn (*Boss Rush*)** có bảng xếp hạng kỷ lục thời gian lưu cục bộ.
2. **Hệ Thống Chế Tạo & Nâng Cấp Vũ Khí Tại Doanh Trại (*Blacksmith & Weapon Forging*):**
   - Thu thập *Mảnh Tinh Thể Nguyên Tố* và *Bản Vẽ Cổ* rơi từ Boss để mở khóa vĩnh viễn vũ khí tại Lò Rèn Doanh Trại hoặc ghép 2 vũ khí cùng loại thành vũ khí Huyền Thoại lai tạo (*Fusion Weapons*).
3. **Màn 4 (*Biome 4 — Điện Thờ Hư Không / Void Sanctum*) & Nhân Vật Thứ 6 (*Ảo Ảnh Sư / Chronomancer*):**
   - Bổ sung Biome 4 với cơ chế cổng dịch chuyển không gian và vùng làm chậm thời gian, cùng nhân vật thứ 6 chuyên tạo bóng phân thân co-op và tua ngược vị trí/máu cho đồng đội.
4. **Tiến Trình Mở Khóa Dài Hạn (*Meta-Progression & Cosmetics*):**
   - Bổ sung cây thiên phú Doanh Trại (*Camp Upgrades*), trang phục màu sắc (*Palettes/Skins* vẽ bằng code) mở khóa qua thành tựu (*Achievements*) mà vẫn giữ sự cân bằng cho người chơi mới tham gia LAN.
5. **Hỗ Trợ Tay Cầm (*Gamepad / DualSense / Xbox Controller*) & Chơi Qua Internet (*WebRTC / Relay Room Code*):**
   - Hoàn thiện điều khiển 2 cần analog (*Twin-Stick Gamepad*) kèm rung phản hồi (*Haptic Vibration*) và tùy chọn tạo mã phòng 6 ký tự qua cổng chuyển tiếp nhẹ cho các nhóm bạn ở xa không cùng mạng LAN.
