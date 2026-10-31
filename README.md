# 🔥 ASHEN PACT v2.0.0 — Game Hành Động Đấu Trường Chiến Thuật Co-op LAN (1–4 Người)

> **Ashen Pact 2.0 (`v2.0.0` — *"Tactical Arena Overhaul"*)** là tựa game hành động bắn súng đấu trường chiến thuật góc nhìn từ trên xuống (*Top-Down Tactical Action Roguelite Shooter*), hỗ trợ **chơi đơn (Solo)** và **phối hợp mạng nội bộ Wi-Fi / LAN từ 2 đến 4 người chơi** ngay trên trình duyệt mà **không cần cài đặt trên máy bạn bè, không cần kết nối Internet**.
>
> **Điểm đặc biệt:** 100% hình ảnh nhân vật, quái vật, trùm (Boss), **18 vũ khí độc bản** chia làm 3 họ nhịp độ chủ động (`[R]`), 9 đồ chơi địa hình chiến thuật, kiến trúc 3D hybrid, cổng dịch chuyển shader, ánh sáng động và toàn bộ hiệu ứng âm thanh ZzFX / 7 bản nhạc nền đều được **vẽ và tổng hợp trực tiếp bằng mã nguồn (Procedural Vector Art Cutout 2.0 & Web Audio Synth)**.

---

## 🚀 1. Cách Chơi Ngay Bản Phát Hành (Dành Cho Người Chơi Phổ Thông)

### Bước 1: Người làm Chủ Phòng (Host) khởi động game
1. Giải nén file gói phát hành **`AshenPact-v2.0.0-win-x64.zip`** ra một thư mục bất kỳ trên máy tính Windows.
2. Nhấp đúp chuột vào **`AshenPact-Host.exe`** (hoặc chạy file dự phòng **`start-host.bat`**).
3. Một cửa sổ màn hình đen (Console) sẽ hiện lên:
   - Tự động khởi chạy máy chủ game tại cổng `2567` (nếu cổng `2567` đang bận, game tự động chuyển sang cổng kế tiếp `2568`, `2569`...).
   - Tự động mở trình duyệt mặc định của bạn vào thẳng **Sảnh Doanh Trại (Hub)** với quyền **Chủ Phòng (Host)**.
   - In rõ **địa chỉ IP LAN** (ví dụ: `http://192.168.1.25:2567`) và **Mã QR ngay trên màn hình Console** lẫn trên bảng **Mời Bạn Bè (`[I]`)** trong game.

> ⚠️ **Lưu ý quan trọng:** Hãy **giữ cửa sổ đen `AshenPact-Host`** luôn mở trong suốt lúc chơi. Đóng cửa sổ này sẽ tắt máy chủ phòng chơi.

### Bước 2: Bạn bè cùng mạng Wi-Fi / LAN tham gia phòng (Không cần cài đặt!)
Bạn bè của bạn (dùng Laptop hoặc PC khác đang bắt **cùng một mạng Wi-Fi** hoặc cắm chung mạng dây LAN) chỉ cần làm **1 trong 3 cách**:
1. **Cách 1 (Nhanh nhất):** Mở trình duyệt web (*Chrome, Edge, Firefox...*) và gõ đúng địa chỉ hiển thị trên màn hình của Chủ Phòng, ví dụ:
   ```text
   http://192.168.1.25:2567
   ```
   *(Trình duyệt sẽ tự động tải game từ máy Chủ Phòng và đưa thẳng vào Sảnh Doanh Trại chỉ sau 1–2 giây!)*
2. **Cách 2 (Quét mã QR):** Dùng camera điện thoại hoặc thiết bị quét **Mã QR** hiển thị trên bảng **Mời Bạn Bè (`[I]`)** ở góc phải Sảnh Doanh Trại (hoặc trên cửa sổ Console của Chủ Phòng) để lấy đường dẫn vào phòng.
3. **Cách 3 (Nhập IP thủ công tại Menu chính):** Nếu bạn bè đang ở Menu chính của game, chỉ cần nhập địa chỉ IP LAN của Chủ Phòng (ví dụ `192.168.1.25:2567`) vào ô **IP LAN** (hỗ trợ dán nhanh `Ctrl+V`) rồi bấm nút **Vào Phòng LAN**.

---

## 🛡️ 2. Xử Lý Sự Cố Kết Nối Mạng LAN (Windows Firewall & Wi-Fi Công Cộng)

Nếu máy Chủ Phòng đã vào được game nhưng máy của bạn bè báo *không thể truy cập trang web (`ERR_CONNECTION_TIMED_OUT`)*, nguyên nhân hầu như luôn nằm ở 1 trong 2 điều sau:

### 2.1 Mở cổng `2567` trên Tường lửa Windows (Windows Defender Firewall)
Lần đầu chạy `AshenPact-Host.exe`, nếu bảng **Windows Security Alert** hiện lên, hãy tích chọn **cả 2 ô**:
- `[x] Private networks (Mạng riêng tư / gia đình)`
- `[x] Public networks (Mạng công cộng)`
rồi bấm **Allow access (Cho phép truy cập)**.

**Nếu bạn lỡ bấm Cancel hoặc bảng hỏi không hiện lên:**
- **Cách tự động (Khuyên dùng):** Trong thư mục giải nén của game, nhấp chuột phải vào file **`allow-firewall-port-2567.bat`** → chọn **Run as administrator (Chạy với quyền Quản trị viên)**. Script sẽ tự động mở cổng TCP `2567–2576` ngay lập tức.
- **Cách chạy lệnh thủ công:** Mở **Command Prompt (Admin)** hoặc **PowerShell (Admin)** và dán lệnh sau:
  ```bat
  netsh advfirewall firewall add rule name="Ashen Pact Co-op LAN (TCP 2567-2576)" dir=in action=allow protocol=TCP localport=2567-2576 profile=private,public
  ```
- **Chuyển mạng Wi-Fi sang Private Network:** Vào *Windows Settings → Network & internet → Wi-Fi → Nhấp vào tên Wi-Fi đang kết nối → Chọn **Private network*** để Windows không chặn kết nối nội bộ giữa các máy.

### 2.2 Lưu ý khi chơi ở Wi-Fi Quán Cà Phê / Khách Sạn / Trường Học (*AP / Client Isolation*)
- Nhiều bộ phát Wi-Fi công cộng (quán cà phê, thư viện, khách sạn, ký túc xá) bật tính năng bảo mật **AP Isolation (Client Isolation)** — tính năng này **ngăn không cho 2 máy tính cùng bắt 1 Wi-Fi nhìn thấy nhau**.
- **Cách khắc phục cực dễ (Không tốn dung lượng 4G/5G):**
  1. Máy Chủ Phòng (hoặc 1 điện thoại trong nhóm) bật tính năng **Điểm truy cập di động (Mobile Hotspot / Phát Wi-Fi)** trên Windows hoặc điện thoại *(thậm chí không cần bật dữ liệu 4G vì game chạy 100% nội bộ không cần Internet!)*.
  2. Các máy trong nhóm kết nối vào Wi-Fi Hotspot đó.
  3. Chủ Phòng xem lại địa chỉ IP mới trên bảng **Mời Bạn Bè (`[I]`)** (thường có dạng `192.168.137.x:2567` trên Windows Hotspot) và gửi cho cả đội.

---

## 🎮 3. Điều Khiển Trong Game & Tam Giác Chiến Thuật 3 Giây

> **100% Không Thanh Năng Lượng:** Mọi nhân vật xuất phát với **1 vũ khí đặc trưng ở Ô 1** (Ô 2 trống sẵn để nhặt vũ khí mới). Súng bắn tự do theo băng đạn / nhiệt độ / combo cận chiến; vũ khí cất vào túi tự động nạp đầy sau `2.0s` (`Holster Auto-Reload`).

| Phím / Thao tác | Hành động |
|---|---|
| **`W` `A` `S` `D`** hoặc **Phím mũi tên** | Di chuyển 8 hướng (có gia tốc & giảm tốc mượt mà) |
| **Di chuột** | Ngắm bắn (Camera tự động mở rộng tầm nhìn theo hướng tâm ngắm) |
| **Chuột trái (Nhấp / Giữ / Nhả)** | Bắn / Chém **Combo 3 đòn** (Đòn 3 cận chiến kích hoạt Tuyệt Kỹ + **`Parry Deflect 0.18s`** phản đạn địch) / **Giữ-Nhả** kích nổ trên không (*Airburst* / *Implosion* / *Charged Bolt*) |
| **`R`** | **Nạp Đạn Hoàn Hảo (*Khung Vàng `45%–70%`*) / Xả Nhiệt Chiến Thuật (*Vùng Cam `65%–95%`*)** trên thanh `Micro-Bar 32×5px` dưới chân nhân vật để cường hóa phát bắn và tung đòn xả áp đặc trưng |
| **`Space`** hoặc **Chuột phải** | Kích hoạt **Kỹ năng chủ động** của nhân vật (thuần Hồi chiêu, không tốn năng lượng; bấm lại để kích hoạt pha 2 như Xung Phong Khiên / Nổ Trụ) |
| **`Shift`** | **Lướt (`Dash`) + `Dash-Kick`:** Cho **`0.16s` bất tử (`i-frame`)** né đạn (Hồi chiêu `1.85s`). Lướt tông vào **Bia Chắn đã lật** hoặc **Đồ chơi địa hình** sẽ sút văng vật thể trượt ở **`520–600 px/s`**, kích hoạt **Đập Tường (`Wall-Slam`)**, **Đẩy Rơi Vực (`Chasm Ring-Out`)** và **Phá Giáp Boss**! |
| **`E`** | **Ưu tiên 1:** Giữ cứu đồng đội gục (`2.5s`, Mộc Linh `1.25s`) · **Ưu tiên 2:** **Lật Bia Chắn Chiến Thuật (`Micro-Blank r=56px` xóa sạch đạn địch xung quanh)** · **Ưu tiên 3:** Mở rương · Nhặt/Mua đồ · **Đe Rèn Cổ Đại (`Daedalus` / `Cường Hóa`)** · **Tế Đàn Khế Ước Tro Tàn** · **Tinh Thể Khiêu Chiến Bí Mật `20s`** · Chọn tượng ở Hub |
| **`1` · `2`** | Chọn trực tiếp **Ô Vũ Khí 1** / **Ô Vũ Khí 2** (hoặc chọn nhanh Thẻ Phước Lành `1`·`2`·`3` khi qua tầng) |
| **`Q`** hoặc **Con lăn chuột** | Đổi nhanh qua lại giữa 2 ô vũ khí mang theo (vũ khí cất đi tự nạp lại sau `2.0s`) |
| **`X`** | **Nhấp nhanh:** Vứt vũ khí đang cầm ra đất nhường cho đồng đội · **Giữ `0.5s` ngoài giao tranh** cạnh vũ khí rơi trên đất: **Phân Rã Vũ Khí (`Weapon Salvage`)** thành Vàng (`10 / 15 / 22 / 30 / 45G` theo độ hiếm) |
| **`T` (Giữ)** | Mở **Vòng Biểu Cảm (Radial Emote Wheel)** 4 hướng; bấm nhanh `1`·`2`·`3`·`4` khi đang giữ `T` (hoặc rê chuột/nhấp) để phát biểu cảm |
| **`Z`** hoặc **Chuột giữa** | **Phát tín hiệu Ping thông minh** theo ngữ cảnh (*Tập trung đánh quái / Chỉ vị trí rương & vũ khí / Gọi cứu thương / Chỉ hướng di chuyển*) |
| **`Tab`** · **`V`** · **`I`** | Bản đồ tầng phóng to (`Tab`) · Sẵn sàng tại Sảnh Doanh Trại (`V`) · Mở/thu gọn bảng **Mời Bạn Bè Co-op LAN** kèm IP + Mã QR (`I`) |
| **`F11`** · **`Esc`** | Bật/Tắt **Toàn màn hình** (`F11`) · Mở menu **Tạm dừng & Cài đặt 4 tab** (`Esc` / `O`) |

---

## 🦸 4. Năm Nhân Vật & Phối Hợp Kỹ Năng (100% Thuần Cooldown, Không Thanh Năng Lượng)

Tại Sảnh Doanh Trại, hãy đi tới bức tượng của từng nhân vật để xem bảng **Preview Kỹ Năng & Synergy** và bấm **`[E]`** để chọn:

| Nhân vật | Vai trò | HP / Giáp | Hồi chiêu Skill | Vũ khí đầu (Ô 1) | Nội tại (`Passive`) | Kỹ năng chủ động (`[Space]` / Chuột phải) & Synergy Co-op |
|---|---|:---:|:---:|---|---|---|
| 🛡️ **Thiết Vệ** (`vanguard`) | Tank / Bảo hộ tuyến đầu | `6 / 5` | `9.0s` *(4s)* | **Kiếm Hiệp Sĩ** *(Kiếm khí + Phản đạn Đòn 3)* | **Ý Chí Thép:** Giáp tự hồi sớm sau `3.0s` (`5.2s` với nhân vật khác); mỗi viên đạn chặn bằng khiên **nạp lại 1 viên đạn (hoặc `-15%` Nhiệt) và `+15%` ST** cho đòn kế tiếp (tối đa `+75%`). | **Tường Khiên Hồng Ngọc:** Dựng khiên cung `120°` chặn đạn địch và phóng ngược sóng xung kích. **Đạn đồng minh và Trụ Tesla bắn xuyên qua khiên từ phía sau được `+30% sát thương` và `+1 xuyên thấu`.** *(Nâng cấp: Pháo Đài Phản Xạ · Xung Phong Khiên)* |
| 🏹 **Liệp Ưng** (`ranger`) | Sát thương / Đánh dấu | `5 / 3` | `7.0s` *(6s)* | **Nỏ Săn** *(Giữ tụ tên + `[R]` Rút tên ngạnh)* | **Mắt Ưng:** Tăng tối đa `+30%` sát thương ở tầm xa và `+10%` chí mạng (`15%` tổng Crit cơ bản). | **Mũi Tên Săn Mồi:** Lộn nhào về sau (`i-frame`) và bắn tên xuyên thấu **Đánh Dấu** mục tiêu `6s`: **nhận `+25% sát thương từ cả đội`**, bị Trụ Tesla ưu tiên bắn và rơi **Huy Hiệu Săn Mồi** khi chết (nhặt vào nạp đầy đạn cường hóa / xả sạch nhiệt và `-2.0s` hồi chiêu). *(Nâng cấp: Mưa Tên Khóa Góc · Dây Xích Con Mồi)* |
| 🔥 **Lam Hỏa** (`elementalist`) | Khống chế / Nguyên tố | `4 / 2` | `8.0s` *(5s)* | **Trượng Tập Sự** *(Cầu nổ + `[R]` Tia Tam Nguyên)* | **Vòng Xoay Nguyên Tố:** Xoay vòng **Lửa → Băng → Sét** sau mỗi lần tung kỹ năng; đạn thường áp nguyên tố hiện hành. | **Cầu Nguyên Tố:** Tạo vùng nguyên tố tồn tại `5s` trên sàn. **Mọi đạn của đồng đội bay qua vùng nguyên tố đều được tẩm nguyên tố đó**, dễ dàng châm ngòi Đồng Đội Combo. *(Nâng cấp: Hố Đen Nguyên Tố · Song Tinh Cắt Không Gian)* |
| 🌿 **Mộc Linh** (`druid`) | Hỗ trợ / Hồi phục | `5 / 3` | `12.0s` *(6s)* | **Trượng Gai** *(Gai ký sinh + Kéo quái)* | **Hạt Giống Sự Sống:** Quái bị hạ có `15%` rơi hạt mầm tự bay về đồng đội ít máu nhất hồi `+1 HP`; cứu đồng đội nhanh gấp đôi (`1.25s`). | **Cây Thiêng:** Trồng cây thần hồi `1 HP / 2s`, phóng rễ trói chân quái `1.5s` và chặn đạn. **Trồng thẳng lên đồng đội đang gục sẽ hồi sinh tức thì với `2 HP`!** *(Nâng cấp: Rễ Gai Quất Tường · Rừng Thiêng Cộng Sinh)* |
| ⚙️ **Bánh Răng** (`engineer`) | Tiện ích / Trụ pháo | `6 / 4` | `10.0s` *(10s)* | **Súng Đinh Tán** *(Đinh từ tính + `[R]` Lưới điện)* | **Thợ Sửa:** Đồng đội trong 4 ô hồi giáp nhanh hơn `+30%`; bấm `[E]` sửa **Cổ Máy Cổ Đại** trên bản đồ thành Trụ chi viện. | **Trụ Tesla:** Đặt trụ bắn sét dây chuyền. **Đồng đội bắn vào Trụ Tesla sẽ nạp điện tăng tốc bắn; đủ `100%` phát nổ Xung EMP làm choáng quái và xóa sạch đạn địch quanh trụ!** *(Nâng cấp: Trụ Kép Giao Thoa · Quá Tải Lò Phản Ứng)* |

---

## ⚡ 5. Sáu Phản Ứng Nguyên Tố, Phước Lành Giao Thoa (`Duo Boons`) & Đồng Đội Combo

Kết hợp 4 trạng thái nguyên tố (**Cháy 🔥**, **Lạnh/Đóng Băng ❄️**, **Sét ⚡**, **Độc ☠️**) trên mục tiêu sẽ kích nổ **6 Phản Ứng Nguyên Tố**:

1. **💨 HƠI NƯỚC (`Cháy + Lạnh`):** Nổ sát thương hơi nước + tạo đám mây mù làm quái trong vùng bắn trượt.
2. **💎 VỠ BĂNG (`Đóng Băng + Đòn nặng / Cận chiến / Chí mạng / Wall-Slam`):** Phá băng gây **sát thương `×2.0`** (`×1.35` trên Boss) và văng mảnh băng sát thương lan xung quanh.
3. **⚡ SIÊU DẪN (`Sét + Lạnh`):** Phá vỡ toàn bộ Khiên Chắn và làm mục tiêu **nhận thêm `+30% sát thương` từ mọi nguồn** trong `4s`.
4. **🧪 NỔ ĐỘC (`Cháy + Độc`):** Kích nổ Độc thành vụ nổ Lửa diện rộng và phát tán Độc sang quái lân cận.
5. **⛓️ TÊ LIỆT (`Sét + Độc`):** Làm **choáng cứng mục tiêu `1.0s`** và ngắt ngay lập tức đòn gồng chiêu (*telegraph*) của quái Tinh Anh.
6. **💥 QUÁ TẢI (`Cháy + Sét`):** Nổ sóng xung kích điện-nhiệt phá Khiên Chắn và hất văng mạnh toàn bộ quái xung quanh.

- **💎 6 Phước Lành Giao Thoa (`Elemental Duo Boons` — Thẻ Kim Cương Đôi Cầu Vồng):** Khi sở hữu từ 2 nguyên tố tương ứng qua Vũ khí & Phước lành Hành động (trong bể `24` Phước lành 4 họ + `10` Bản độ Búa rèn Daedalus), ô thẻ thứ 3 khi qua tầng có **`35%` cơ hội** mở khóa `Duo Boon` huyền thoại: *Lốc Xoáy Nước Sôi*, *Tứ Trụ Băng Phá*, *Đường Ray Siêu Dẫn*, *Đại Dịch Nhựa Lửa-Độc*, *Tinh Cầu Quá Tải Plasma* và *Vòng Thành Lũy Điện Từ*!
- **🤝 ĐỒNG ĐỘI COMBO (`Hội Tụ Nguyên Tố 3.0s`):** Khi **Người chơi A** gắn nguyên tố nền và **Người chơi B** kích nổ phản ứng nguyên tố, cả hai lập tức nhận **Hội Tụ Nguyên Tố trong `3.0s`**: **nạp đầy Băng đạn / xả sạch Nhiệt về `0%`**, nhận **`+20%` Tốc chạy & `+20%` Tốc bắn**, và cộng điểm **Đồng Đội Combo** xét danh hiệu **MVP Bậc Thầy Nguyên Tố** cuối trận!

---

## 🗺️ 6. Đấu Trường Chiến Thuật, Khế Ước Tro Tàn, Đấu Trường Bí Mật `20s` & Ba Boss

Chiến dịch gồm **3 Màn (Biome) × 2 Tầng = 6 Tầng** với hệ thống địa hình tương tác sâu sắc:
- **6 Archetype Phòng Chiến Thuật (`FlipX/FlipY` & `Prop Jitter`):** `TWIN_BRIDGES` (cầu đôi nhánh chữ Y bắc qua vực sâu `chasm` cho phép sút quái **`Chasm Ring-Out`**), `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`, `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH`, và `CRUMBLING_PILLAR_RING`.
- **Xưởng Rèn Kho Báu, Tế Đàn Khế Ước & Đấu Trường Bí Mật `20s`:**
  - **Xưởng Rèn Kho Báu:** Tầng lẻ (`1, 3, 5`) đặt Rương + **Đe Rèn Daedalus** gắn `Weapon Mutator` (tối đa 2 bản độ/súng); Tầng chẵn (`2, 4, 6`) đặt Rương + **Đe Rèn Cường Hóa** (`+20%` sát thương gốc, tối đa `+3`).
  - **Tế Đàn Khế Ước Tro Tàn (`1 Tế Đàn / Biome` ở Tầng `1, 3, 5`):** Ký 1 trong 6 lời nguyền sinh tử kéo dài suốt cả Biome; ngay khi hạ Boss Tầng Chẵn (`2, 4, 6`), lời nguyền lập tức thanh tẩy thành **Di Vật Tro Tàn Thức Tỉnh (`Awakened Relic`)** xóa sạch hình phạt!
  - **Phòng Bí Mật Động & Đấu Trường Kỹ Năng `20 Giây`:** Dùng `Dash-Kick` vật chắn hoặc thuốc nổ phá tường nứt (`cracked_wall`) để tìm Phòng Bí Mật. Kích hoạt **Tinh Thể Khiêu Chiến `[E]`** và quét sạch đội quân Tinh Anh trong **`<= 20.0s`** để nâng cấp rương thành **`100% Huyền Thoại (Legendary)` + `+40 Vàng`**! *(Nếu hết giờ, quái tự tan biến an toàn không soft-lock và bạn vẫn giữ rương `Rare/Epic` + `+30 Vàng` ban đầu).*

### Ba Màn Chơi, 9 Đồ Chơi Địa Hình & Ba Boss Phá Giáp 1–2 Bước
Cả 3 Boss đều có **Thanh Chấn Động Phụ (`bossStaggerAccum`)**, **Tiếp Tế Đấu Trường (`Boss Supply Drop` mỗi `18.0s`)** thả thêm Bia Chắn & Đồ Chơi, và cơ chế **Phá Giáp Trực Quan 1–2 Bước ở mốc `66%` / `33%` máu** (`6% MaxHP` sát thương chuẩn + Choáng `3.0–4.0s` + nhận `+40%` sát thương):

1. **Màn 1 (Tầng 1–2) — Rừng Cổ Mục Nát (*Overgrown Ruins*):**
   - **Đồ chơi địa hình:** **Bàn Đá Rêu Cổ** (`moss_table` — vỡ tỏa phấn hoa `+1 Giáp`), **Túi Bào Tử Căng Phồng** (`volatile_spore_pod` — sút nổ Độc + Trói `1.2s`), **Trụ Đá Mục** (`rotten_totem_pillar` — đâm/bắn gãy đổ đè dải `160×56px`).
   - **Boss: Mục Vương Nấm Độc (`spore_king`)** — Dựng Vỏ Bào Tử ở `66%` & `33%` HP; **`Dash-Kick` Bàn Đá / Túi Bào Tử đập trúng Mục Vương** (hoặc dụ Boss húc sập Trụ Đá Mục) để phá nát vỏ giáp làm choáng `3.5s`!
2. **Màn 2 (Tầng 3–4) — Hầm Băng Vĩnh Cửu (*Frozen Depths*):**
   - **Đồ chơi địa hình:** **Phiến Băng Cổ Đại** (`glacial_barricade` — sút vỡ đóng 3 Cọc Nhũ Băng), **Khối Băng Trượt** (`sliding_ice_block` — trượt `600 px/s` nảy tường bi-a), **Lăng Kính Pha Lê** (`cryo_prism_pillar` — khúc xạ đạn người chơi thành 3 tia quạt Lạnh `+20%` sát thương).
   - **Boss: Băng Hậu Kryssa (`kryssa_ice_queen`)** — Khúc xạ tia laser, gọi **Phân Thân Gương** *(chỉ bản thật có bóng đổ dưới chân)*, tạo **Bão Tuyết Vĩnh Cửu** gió tuyết chéo giữ tầm nhìn sàn đấu sáng rõ trong trẻo và nhốt người chơi vào Lồng Băng. Khi ả dựng Khiên Băng Hàn, hãy **lật `[E]` Phiến Băng chắn tia laser rồi `Dash-Kick` Phiến Băng / Khối Băng tông vỡ khiên Kryssa**!
3. **Màn 3 (Tầng 5–6) — Lò Rèn Dung Nham (*Molten Forge*):**
   - **Đồ chơi địa hình:** **Tấm Chắn Thép Phản Nhiệt** (`forge_blast_shield` — hấp thụ lửa thành Siêu Nhiệt, sút phóng sóng lửa `88px`), **Búa Máy Cảm Biến** (`pneumatic_press` — dập nghiền quái & giáp Boss sau `0.35s`), **Nồi Nung Xỉ** (`slag_crucible` — đổ thảm dung nham `192px`).
   - **Boss: Titan Lò Rèn (`forge_titan`)** — Nện sóng xung kích, đảo chiều băng chuyền theo nhịp nhà máy và bật Giáp Nhiệt Hạch; **`Dash-Kick` Tấm Chắn Thép / Nồi Nung Xỉ / Bom Than tông thẳng vào Titan** (hoặc dẫn dụ vào Búa Máy / phá đồng bộ 2 Lõi Năng Lượng) để làm quá tải nổ tung giáp!

---

## 🛠️ 7. Hướng Dẫn Dành Cho Lập Trình Viên (Developer Guide)

### Yêu cầu môi trường
- **Hệ điều hành:** Windows 10/11 (64-bit)
- **Node.js:** `v20+` (khuyến nghị `v22` hoặc `v24`)
- **Package Manager:** `pnpm 9+`

### Các lệnh làm việc chính
```bash
# 1. Cài đặt toàn bộ dependencies của monorepo
pnpm install

# 2. Chạy môi trường phát triển (Server Colyseus cổng 2567 --debug + Client Vite cổng 5173)
pnpm dev

# 3. Build production và khởi chạy Host Co-op LAN ngay tại cổng 2567
pnpm host

# 4. Chạy bộ công cụ mô phỏng cân bằng 60Hz thực tế (2.269 lượt sim trên 30 locked seeds -> đạt 10/10 mục tiêu tại docs/balance-report.md)
pnpm balance

# 5. Chụp bộ ảnh chuẩn hóa / dải hoạt ảnh Engine 2.6 (pnpm shots) & đo hiệu năng FPS / Tick / Bandwidth (pnpm perf)
pnpm shots
pnpm perf

# 6. Chạy toàn bộ cổng kiểm định chất lượng (Typecheck + ESLint + Vitest Unit/Soak Tests + Build + Playwright E2E)
pnpm verify

# 7. Đóng gói bản phát hành Windows hoàn chỉnh vào release/AshenPact-v2.0.0-win-x64/ và release/AshenPact-v2.0.0-win-x64.zip
pnpm package:release
```

### Cấu trúc thư mục dự án
```text
├── apps/
│   ├── client/          # Phaser 3 WebGL (GameScene + HudScene), Cutout 2.0, Micro-Bar, Duo/Pact/Anvil Modals, ZzFX & Music Synth
│   └── server/          # Máy chủ Authoritative Colyseus 60Hz (meta.playerId isolation) + Debug Gate + IP LAN / QR ASCII
├── packages/
│   └── shared/          # WorldSim 60Hz mô-đun (<1000 dòng/file), 18 Vũ khí, 24 Blessings, 10 Mutators, 6 Duo Boons, 6 Pacts, 3-Bucket Damage
├── tools/
│   ├── balance-harness.ts         # Kiểm chứng 10/10 chỉ tiêu cân bằng 60Hz (2.269 sims, AVERAGE_PLAYER_BOT_PROFILE)
│   ├── visual-animation-gates.ts  # Engine 2.6 kiểm chứng dải hoạt ảnh qua 5 cổng toán học HARD_ASSERT
│   ├── run-shots.ts               # Chụp ảnh chuẩn hóa & contact sheets
│   ├── run-perf.ts                # Đo lường FPS, Frame Time p95/p99, Server Tick & Bandwidth
│   └── package-release.ts         # Đóng gói AshenPact-Host.exe, batch scripts & gói ZIP phát hành
├── tests/e2e/           # Bộ kiểm thử tự động Playwright E2E & đồng bộ Co-op LAN
└── docs/                # Tài liệu sống (GDD, TECH, ART_GUIDE, BALANCE, QA_CHECKLIST, RELEASE_NOTES)
```

---

## Bật chế độ Debug (Dành cho Nhà phát triển / Kiểm thử)

Ở bản đóng gói phát hành (`release`), toàn bộ giao diện, nút tắt và lệnh Debug đều được ẩn và khóa mặc định để đảm bảo trải nghiệm chuẩn cho người chơi. Khi cần kiểm thử hoặc gỡ lỗi, bạn có thể bật chế độ Debug theo các cách sau:

- **Phím tắt trong game:** Nhấn tổ hợp phím **`Ctrl + Shift + D`** bất kỳ lúc nào để bật/tắt nhanh giao diện Debug (lưu trạng thái vào `localStorage['ashen_pact_debug']` và hiển thị thông báo `"Debug ON"` / `"Debug OFF"`).
- **Tham số URL:** Thêm `?debug=1` vào đường dẫn trình duyệt để bật giao diện Debug, hoặc thêm `?debug=0` để ép tắt giao diện Debug (ngay cả trong môi trường `pnpm dev`).
- **Máy chủ Co-op LAN / Bản đóng gói `.exe`:**
  - Chạy file **`start-host-debug.bat`** trong thư mục phát hành, hoặc
  - Truyền cờ CLI `--debug` khi khởi chạy (`AshenPact-Host.exe --debug`), hoặc
  - Đặt biến môi trường `ASHEN_PACT_DEBUG=1`.
  - *Lưu ý:* Trong chế độ **Co-op LAN**, giao diện Debug và các lệnh/phím tắt Debug (`F1–F9`, `God Mode`, `Skip Waves`...) chỉ hoạt động khi **cả máy chủ lẫn trình duyệt client đều bật Debug**. Nếu máy chủ không bật `--debug`, mọi lệnh Debug gửi lên phòng chơi sẽ bị từ chối (`debug_rejected`) và ghi cảnh báo trên máy chủ.
