# 📜 GHI CHÚ PHÁT HÀNH (RELEASE NOTES) — ASHEN PACT `v0.2.0` ("Polish & Depth")

- **Phiên bản:** `v0.2.0` (*"Polish & Depth" — Comprehensive Visual, Architectural, UI/UX & Combat Balance Overhaul*)
- **Nền tảng phát hành:** Windows 10/11 64-bit (`AshenPact-v0.2.0-win-x64`) & Web Browser (Chromium / Chrome / Edge / Firefox)
- **Chế độ chơi:** Chơi đơn (*Solo*) & Phối hợp mạng nội bộ (*Co-op LAN / Wi-Fi 2–4 người chơi*)

---

## 🚀 1. Điểm Mới Nổi Bật Trong Bản Cập Nhật `v0.2.0` ("Polish & Depth")

Bản cập nhật lớn **`v0.2.0` ("Polish & Depth")** nâng cấp toàn diện **12 hạng mục cốt lõi (Phases P0 → P12)** từ hệ thống ánh sáng, kiến trúc chiều sâu 3D giả lập, cổng dịch chuyển shader, giao diện `HudScene` tách biệt, hoạt ảnh nhân vật/quái vật `Cutout 2.0`, hiệu ứng chiến đấu `BlendMode.ADD` cho tới độ sâu chiến thuật và cân bằng thực chiến 60Hz:

### 1.1 Tầm Nhìn Trong Trẻo & Ánh Sáng Không Sương Mù Đen (`Phase P2`)
- **Loại bỏ hoàn toàn lớp sương mù tối gây mỏi mắt:** Nâng nền ánh sáng môi trường (`ambientRgb`) ở tất cả các Biome và Sảnh Doanh Trại lên mức sáng rõ (`>= 0.72` mỗi kênh RGB), thu nhỏ `vignetteStrength` (`<= 0.16`) và tắt hoàn toàn lớp phủ tối toàn màn hình trong **Bão Tuyết Phase 3 của Băng Hậu Kryssa**, thay bằng hiệu ứng hạt gió tuyết chéo tốc độ cao và tinh thể băng ở rìa màn hình để người chơi luôn nhìn rõ 100% đạn và cảnh báo trên sàn.

### 1.2 Kiến Trúc Chiều Sâu 3D Hybrid & Bản Sắc 3 Biome (`Phase P3 & P4`)
- **Chiều sâu 2.5D / 3D Hybrid rõ nét:** Tường có mặt đứng phía nam (`wall_face` cao `18u` có gờ đá, vết nứt và chân tường tối), bóng đổ sàn hướng Đông-Nam (`ao_mask`), trụ `2×2` đúc khối 3 tầng (`đế + thân + mũ trụ`) và viền phát sáng động cho các ô mặt đất nguy hiểm (dung nham, đầm độc, nước nhiễm điện).
- **Bản sắc kiến trúc động riêng cho từng khu vực:**
  - **Sảnh Doanh Trại (Hub):** Sàn lát đá ấm áp, thảm đỏ dẫn tới Cổng Không Gian, cờ hiệu phe phái đung đưa, đống lửa trại trung tâm, giá vũ khí, đe rèn và bệ đá cổ đặt 5 tượng anh hùng.
  - **Biome 1 (Rừng Cổ Mục Nát):** Rễ cây leo tường, bào tử phát quang, đom đóm bay lượn và bụi lá rơi.
  - **Biome 2 (Hầm Băng Vĩnh Cửu):** Tường băng vát cạnh phản광, vết nứt băng sâu dưới sàn, cột pha lê khúc xạ và bông tuyết lơ lửng.
  - **Biome 3 (Lò Rèn Dung Nham):** Tường thép đinh tán lộ khe dung nham rực đỏ, bánh răng cơ khí xoay tròn, đường ống đồng hồ áp suất và tàn lửa bốc lên từ kênh magma.

### 1.3 Vòng Sáng Vật Tương Tác & Nhãn Nhắc `[E]` Duy Nhất (`Phase P5 & P6`)
- **Vòng sáng dẫn đường tự nhiên (`Interactable Glow`):** Rương kho báu, vũ khí rơi (tô màu theo 5 bậc hiếm kèm cột sáng thẳng đứng cho đồ Tím/Cam), Tượng Anh Hùng, Thương Nhân, Điện Thờ và Máy Cổ Đại đều có hào quang dưới chân và hạt lấp lánh thu hút ánh nhìn.
- **Nhãn tương tác `[E]` duy nhất có độ ưu tiên (`Single-Pill Priority Prompt`):** Xóa bỏ hoàn toàn tình trạng chữ chồng chéo trên đầu vật thể; chỉ hiển thị **1 khung nhắc `[E]` duy nhất** cho mục tiêu ưu tiên cao nhất trong tầm `64u` (`Cứu đồng đội > Rương > Vũ khí > NPC/Điện thờ > Tượng Hub > Cổng`) với hiệu ứng phóng mở mượt mà.

### 1.4 Cổng Không Gian ShaderXoáy Lốc & Cửa Liên Phòng Theo Biome (`Phase P7`)
- **Cổng Dịch Chuyển Không Gian (`Procedural Vortex Portal`):** Dựng từ 5 lớp đồ họa động (bệ đá 8 cổ tự sáng dần khi dọn phòng, vòng cổng xoay ngược chiều, lõi xoáy lốc WebGL fragment shader / Canvas2D fallback, tia sét năng lượng và hạt hút vào tâm) kèm chuỗi hiệu ứng thu nhỏ hút nhân vật (`250ms`) khi bước qua.
- **Cửa Liên Phòng cơ khí theo từng Biome:** Cổng dây leo đá cổ (Biome 1), cổng rào pha lê băng (Biome 2) và cửa sập thép đinh tán cảnh báo vàng-đen (Biome 3) với hiệu ứng đóng sập rung chấn khi khóa phòng và nổ sáng khi mở khóa.

### 1.5 Kiến Trúc `HudScene` Độc Lập & Giao Diện Chuẩn Hóa (`Phase P8, P9a & P9b`)
- **Tách riêng `HudScene` khỏi camera thế giới:** Toàn bộ HUD và Modal chạy trên `HudScene` độc lập không chịu ảnh hưởng của rung màn hình (`camera shake`), xoay nghiêng hay PostFX của `GameScene`.
- **Thiết kế HUD hiện đại, thoáng mắt:** Bỏ 2 dải đen đặc chắn trên/dưới màn hình; neo gọn 4 cụm HUD ra sát mép màn hình với chân dung nhân vật động, 3 thanh chỉ số phân đoạn có vạch máu tụt trễ (`trailing damage bar`), đồng hồ hồi chiêu kỹ năng/Dash dạng vòng tròn, thẻ so sánh vũ khí dưới đất (`▲/▼ DPS`), Vòng Biểu Cảm 4 hướng (`[T]`) và thanh máu Boss 3 Phase kèm huy hiệu kỹ năng.
- **Hệ thống Modal & Sảnh Chờ tinh gọn:**
  - **Cài Đặt 4 Tab (`Âm thanh · Hình ảnh · Gameplay · Điều khiển`)** hỗ trợ thanh trượt Kéo-Thả chuột trực tiếp, bật/tắt Toàn màn hình (`[F11]`), chỉnh `UI Scale (80%–120%)` và Ngôn ngữ `VI / EN`.
  - **Ô nhập chữ HTML chuẩn tại Menu chính:** Cho phép gõ tiếng Việt có dấu (IME/Telex/VNI) và dán nhanh `Ctrl+V` địa chỉ IP LAN.
  - **Bảng Mời Bạn Bè thu gọn thành Chip (`[I]`):** Mặc định thu gọn gọn gàng ở góc phải trên để không che khuất Sảnh Doanh Trại; bấm `[I]` hoặc nhấp chuột để bung mã QR + danh sách IP LAN.
  - **Menu Tạm Dừng (`[Esc]`) & Màn Hình Kết Thúc:** Menu Pause 4 nút rõ ràng có hộp thoại xác nhận trước khi thoát; màn hình Chiến Thắng/Thất Bại 3 tầng vinh danh 4 danh hiệu MVP kèm tên tiếng Việt/Anh chuẩn của mọi Phước Lành.

### 1.6 Cutout 2.0: Đổóng 2 Lớp, Viền Sáng `-135°`, Quái Đủ Bộ Phận & Hoạt Ảnh Tham Số (`Phase P10`)
- **Đổ bóng 2 lớp & Ánh sáng góc `-135°`:** Toàn bộ 5 nhân vật, 16 quái, 3 Boss và 24 vũ khí được nâng cấp lên pipeline đổ bóng 2 lớp (midtone + core shadow), viền sáng rim-light hướng Tây-Bắc (`-135°`) và viền ngoài tự co giãn theo kích thước bộ phận.
- **100% Quái vật có đủ bộ phận cơ thể (`>= 4 parts`) và tư thế cầm vũ khí chuẩn:** Nấm Độc, Phù Thủy Đầm Lầy, Bọ Cạp Băng, Golem Đá Lửa... đều có tay/chân/vũ khí/vương miện tách rời; vũ khí 2 tay nằm ngang tự nhiên không đâm xuyên đầu nhân vật.
- **Hoạt ảnh tham số giàu sức sống:** Chu kỳ chạy nghiêng người + vung tay chân lệch pha + hạt bụi bước chân (`footstep dust`), nhịp giật lùi vũ khí theo đường cong `outBack`, lắc lư quán tính phụ kiện (áo choàng, râu, lá mầm), hiệu ứng gồng chiêu rung thân + mắt phát sáng của quái, cùng chuỗi 4 giai đoạn gục ngã khi chết (`Knockback -> Nảy thân -> Văng vũ khí -> Tan biến`).

### 1.7 Hiệu Ứng Chiến Đấu & Nguyên Tố Rực Sáng (`BlendMode.ADD` — `Phase P10b`)
- **Đạn địch nổi bật tuyệt đối:** Mọi viên đạn của quái và Boss đều có lõi trắng sáng + vòng hào quang cảnh báo đỏ/cam giúp người chơi dễ dàng đọc quỹ đạo né đạn giữa giao tranh đông đúc.
- **Vệt chém cận chiến 3 lớp & Vụ nổ nguyên tố `ADD`:** Vệt kiếm/đại đao 3 lớp kèm tia lửa khi chém tan đạn địch; tia lửa va chạm định hướng; chữ số sát thương nảy parabol phân biệt rõ đòn thường, chí mạng (`1.5x` kèm dấu `!`) và sát thương nguyên tố; 6 vụ nổ phản ứng nguyên tố có hình học riêng biệt với hòa trộn cộng sáng `BlendMode.ADD`.

### 1.8 Chiều Sâu Lối Chơi, Phòng Thử Thách & Cân Bằng Thực Chiến 60Hz (`Phase P11`)
- **Công cụ kiểm định cân bằng `WorldSim` 60Hz trung thực (`pnpm balance`):** Chạy **1.795 lượt mô phỏng thực tế** trên 30 seed cố định với Bot AI có thời gian phản xạ thực (`150ms`), độ lệch ngắm bắn và né vùng cảnh báo hợp lý — chấm dứt hoàn toàn việc ước lượng DPS lý thuyết trên giấy.
- **Nhịp độ chiến đấu mới kịch tính:**
  - **Đợt quái tràn gối đầu (`Overlapping Waves`):** Tự động gọi đợt tiếp theo khi đợt hiện tại chỉ còn `≤ 2` quái hoặc sau `14 giây`, giữ nhịp giao tranh liên tục không bị ngắt quãng.
  - **Phòng Thử Thách (`Challenge Room`):** Mỗi tầng có 10 phòng bao gồm 1 Phòng Thử Thách với đài kích hoạt `[E]` — vượt qua 2 đợt quái tinh anh chồng lấp sẽ mở khóa rương thưởng cam kết vũ khí **Sử Thi (`epic`)** hoặc **Huyền Thoại (`legendary`)**.
  - **Cơ chế Boss công bằng & sâu sắc:** Bổ sung **Kháng Khống Chế Tăng Dần (`CC Diminishing Returns`: `100% -> 50% -> 25% -> Miễn nhiễm 4s`)**, **Khiên Chuyển Pha `1.2s` (`Phase Transition Invulnerability + Roar`)** ở mốc `66%` / `33%` máu, và **Cuồng Nộ Mềm (`Soft Enrage` sau `90s`: `+25%` tốc chạy & tốc bắn)**.
  - **Tinh chỉnh kinh tế & hồi phục:** Thời gian chờ hồi giáp `3.3s` (Thiết Vệ) / `4.0s` (nhân vật khác); hồi sinh đồng đội sau khi dọn phòng ở mức `35% HP` (tối thiểu `2 HP`); giá cửa hàng điều chỉnh tạo quyết định mua sắm có sức nặng; làm rõ vai trò tốc bắn/sát thương của 24 vũ khí (Nỏ Săn vs Cung Độc, Súng Phun Lửa vs Đại Bác Dung Nham).

### 1.9 Cổng Bảo Vệ Debug Bản Phát Hành (`Release Debug Gate` — `Phase P1`)
- Mặc định ẩn và khóa toàn bộ giao diện, phím tắt (`F1–F9`, `G`, `R`), nút `[Art Gallery]` và hooks Debug trong bản đóng gói phát hành; đóng băng `window.__GAME_DEBUG__` bằng `Proxy` chỉ-đọc và chặn mọi lệnh `debug_cmd` trên máy chủ Colyseus trừ khi Chủ Phòng chủ động bật `--debug` / `start-host-debug.bat` và người chơi mở bằng `Ctrl + Shift + D` hoặc `?debug=1`.

---

## 🌟 2. Nền Tảng Cốt Lõi Từ Phiên Bản `v0.1.0`

- **Simulation 60Hz tất định & Co-op LAN 1–4 người chơi:** `LocalTransport` (Solo `< 1 frame`) và `NetworkTransport` (Colyseus WebSocket với Client-Side Prediction, nội suy thực thể thích ứng, băng thông `≤ 24 KB/s/client`, tự động phát hiện IP LAN, sinh Mã QR ASCII/UI và tự động kết nối lại trong `30s`).
- **5 Nhân vật & Co-op Synergy:** Thiết Vệ (`vanguard`), Liệp Ưng (`ranger`), Lam Hỏa (`elementalist`), Mộc Linh (`druid`), Bánh Răng (`engineer`) cùng 6 Phản Ứng Nguyên Tố (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*) và thưởng **Đồng Đội Combo (`+15 NL`)**.
- **Chiến dịch 3 Biome × 2 Tầng, 24 Vũ khí, 16 Quái Thường/Elite & 3 Boss 3 Phase:** Mục Vương Nấm Độc (`spore_king`), Băng Hậu Kryssa (`kryssa_ice_queen`), Titan Lò Rèn (`forge_titan`) cùng câu đố 2 Tấm Áp Lực Co-op, Thương Nhân, Điện Thờ và Phòng Bí Mật.
- **100% Procedural Vector Art & Web Audio:** 47 SFX không gian 2D (`ZzfxSynth`), 7 bản nhạc nền 2 lớp *Khám Phá / Chiến Đấu* (`ProceduralMusicSynth`) và 450+ khóa đa ngôn ngữ `VI / EN` dùng font `Be Vietnam Pro` đóng gói offline.

---

## 📊 3. Kết Quả Kiểm Định Chất Lượng & Hiệu Năng (`v0.2.0`)

- **Cân bằng định lượng (`pnpm balance`):** Đạt **8/8 chỉ tiêu cân bằng** qua **1.795 lượt mô phỏng 60Hz thực tế trên 30 locked seeds** (TTK quái khởi đầu `1.18s`; phòng chiến đấu TB `36.3s`; cả 3 Boss đạt `55.6s – 66.2s` ở 1P–4P với độ lệch 1P vs 4P `≤ 9.2%`; tỉ lệ thắng Solo hoàn thành chiến dịch đạt `53.3% – 66.7%` cho cả 5 nhân vật; không có buff hay vũ khí nào vượt ngưỡng thống trị).
- **Soak Test 20 phút (`72.000` ticks @ 60Hz):** 4 người chơi Co-op giao tranh liên tục qua 3 Biome và 3 Boss — không rò rỉ bộ nhớ, thời gian xử lý mỗi tick giữ vững `< 0.25 ms/tick`.
- **Hiệu năng Render & Đa trình duyệt (`pnpm perf`):** Giữ vững **60 FPS** (`frameTime p95 <= 16.9ms`) ở 1080p High kể cả trong Stress Test; băng thông mạng thực tế chỉ `~7.7 KB/s/client`; tương thích hoàn hảo với **0 lỗi/cảnh báo console** trên **Chromium**, **Google Chrome** và **Microsoft Edge**.
