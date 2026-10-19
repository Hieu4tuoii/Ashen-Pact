# 🔥 ASHEN PACT (`v0.1.0`) — Game Co-op Vượt Ải Mạng LAN (1–4 Người)

> **Ashen Pact** là tựa game hành động bắn súng vượt ải góc nhìn từ trên xuống (*Top-Down Action Roguelite Shooter*) lấy cảm hứng từ *Soul Knight*, hỗ trợ **chơi đơn (Solo)** và **phối hợp mạng nội bộ Wi-Fi / LAN từ 2 đến 4 người chơi** ngay trên trình duyệt mà **không cần cài đặt trên máy bạn bè, không cần kết nối Internet**.
>
> **Điểm đặc biệt:** 100% hình ảnh nhân vật, quái vật, trùm (Boss), 24 vũ khí, hiệu ứng ánh sáng động và toàn bộ 47 hiệu ứng âm thanh / 7 bản nhạc nền đều được **vẽ và tổng hợp trực tiếp bằng mã nguồn (Procedural Vector Art & Web Audio Synth)**.

---

## 🚀 1. Cách Chơi Ngay Bản Phát Hành (Dành Cho Người Chơi Phổ Thông)

### Bước 1: Người làm Chủ Phòng (Host) khởi động game
1. Giải nén file **`AshenPact-v0.1.0-win-x64.zip`** ra một thư mục bất kỳ trên máy tính Windows.
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
3. **Cách 3 (Nhập IP thủ công tại Menu chính):** Nếu bạn bè đang ở Menu chính của game, chỉ cần nhập địa chỉ IP LAN của Chủ Phòng (ví dụ `192.168.1.25:2567`) vào ô **IP LAN** rồi bấm nút **Vào Phòng LAN**.

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

## 🎮 3. Điều Khiển Trong Game (Bàn Phím & Chuột)

| Phím / Thao tác | Hành động |
|---|---|
| **`W` `A` `S` `D`** hoặc **Phím mũi tên** | Di chuyển 8 hướng (có gia tốc & giảm tốc mượt mà) |
| **Di chuột** | Ngắm bắn (Camera tự động mở rộng tầm nhìn theo hướng tâm ngắm) |
| **Chuột trái (Giữ hoặc Nhấp)** | Bắn / Tấn công bằng vũ khí đang cầm |
| **`Space`** hoặc **Chuột phải** | Kích hoạt **Kỹ năng chủ động** của nhân vật |
| **`Shift`** | **Lướt (Dash)** — Cho **0.2 giây bất tử (`i-frame`)** để né đạn & sóng xung kích (Hồi chiêu `1.2s`) |
| **`E`** | **Tương tác:** Chọn tượng nhân vật ở Doanh Trại · Mở rương · Nhặt vũ khí · Mua đồ Thương Nhân · Dâng lễ Điện Thờ · Sửa máy cổ đại · **Giữ `[E]` để cứu đồng đội gục ngã** |
| **`Q`** hoặc **Con lăn chuột** | Đổi qua lại giữa 2 ô vũ khí mang theo |
| **`X`** | **Vứt vũ khí đang cầm ra đất** để nhường cho đồng đội |
| **`Tab`** | Bật / Tắt bản đồ tầng phóng to (Minimap) |
| **`Z`** hoặc **Chuột giữa** | **Phát tín hiệu Ping thông minh** theo ngữ cảnh (*Tập trung đánh quái / Chỉ vị trí rương & vũ khí / Gọi cứu thương / Chỉ hướng di chuyển*) |
| **`1` · `2` · `3` · `4`** | Biểu cảm nhanh (Emote): `👍 Tuyệt vời!` · `⚡ Sẵn sàng!` · `🆘 Cứu với!` · `🔥 Tập trung!` |
| **`V`** | Bật / Tắt trạng thái **Sẵn Sàng** tại Sảnh Doanh Trại |
| **`I`** | Bật / Tắt bảng **Mời Bạn Bè Co-op LAN** (IP LAN + Mã QR + Sao chép link + Kick) |
| **`Esc`** | Mở menu **Tạm dừng (Pause)** / Cài đặt âm thanh & đồ họa / Hướng dẫn điều khiển *(Lưu ý: Chơi Co-op LAN không làm dừng thời gian của đồng đội)* |

---

## 🦸 4. Năm Nhân Vật & Phối Hợp Kỹ Năng (Co-op Synergy)

Tại Sảnh Doanh Trại, hãy đi tới bức tượng của từng nhân vật để xem bảng **Preview Kỹ Năng & Synergy** và bấm **`[E]`** để chọn:

| Nhân vật | Vai trò | HP / Giáp / NL | Vũ khí đầu | Nội tại (Passive) | Kỹ năng chủ động (`[Space]` / Chuột phải) & Synergy Co-op |
|---|---|:---:|---|---|---|
| 🛡️ **Thiết Vệ** (`vanguard`) | Tank / Bảo hộ tuyến đầu | `8 / 6 / 150` | Kiếm Hiệp Sĩ *(chém tan đạn)* | **Ý Chí Thép:** Giáp tự hồi sớm sau `2s`; mỗi viên đạn chặn bằng khiên hồi `+1 NL`. | **Tường Khiên Hồng Ngọc:** Dựng khiên chắn 120° chặn mọi đạn địch và phóng ngược sóng xung kích. **Đạn đồng minh (và Trụ Tesla) bắn xuyên qua khiên từ phía sau được `+30% sát thương` và `+1 xuyên thấu`.** *(Nâng cấp: Pháo Đài 360° · Xung Phong làm choáng)* |
| 🏹 **Liệp Ưng** (`ranger`) | Sát thương / Đánh dấu | `5 / 4 / 200` | Nỏ Săn | **Mắt Ưng:** Tăng tối đa `+30%` sát thương ở tầm xa và `+10%` chí mạng. | **Mũi Tên Săn Mồi:** Lộn nhào về sau (`i-frame`) và bắn tên xuyên thấu **Đánh Dấu** mục tiêu `6s`: **nhận `+25% sát thương từ cả đội`**, lộ diện xuyên sương mù, bị Trụ Tesla ưu tiên bắn và rơi thêm năng lượng khi chết. *(Nâng cấp: Mưa Tên · Chuỗi Con Mồi)* |
| 🔥 **Lam Hỏa** (`elementalist`) | Khống chế / Nguyên tố | `5 / 3 / 260` | Trượng Tập Sự | **Vòng Xoay Nguyên Tố:** Xoay vòng **Lửa → Băng → Sét** sau mỗi lần tung kỹ năng; đạn thường áp nguyên tố hiện hành. | **Cầu Nguyên Tố:** Tạo vùng nguyên tố tồn tại `5s` trên sàn. **Mọi đạn của đồng đội bay qua vùng nguyên tố đều được tẩm nguyên tố đó**, giúp kích nổ phản ứng liên hoàn. *(Nâng cấp: Hố Đen Nguyên Tố · Song Nguyên Tố)* |
| 🌿 **Mộc Linh** (`druid`) | Hỗ trợ / Hồi phục | `6 / 4 / 200` | Trượng Gai *(Độc)* | **Hạt Giống Sự Sống:** Quái bị hạ có `15%` rơi hạt mầm tự bay về đồng đội ít máu nhất hồi `+1 HP`; cứu đồng đội nhanh gấp đôi (`1.25s`). | **Cây Thiêng Cổ Thụ:** Trồng cây thần hồi máu theo nhịp cho cả đội, phóng rễ trói chân quái `1.5s` và chặn đạn. **Trồng thẳng lên đồng đội đang gục sẽ hồi sinh tức thì với `2 HP`!** *(Nâng cấp: Rễ Gai Độc · Rừng Thiêng)* |
| ⚙️ **Bánh Răng** (`engineer`) | Tiện ích / Trụ pháo | `6 / 5 / 180` | Súng Đinh Tán | **Thợ Sửa:** Đồng đội trong 4 ô hồi giáp nhanh hơn `+30%`; bấm `[E]` sửa **Cổ Máy Cổ Đại** trên bản đồ thành Trụ chi viện. | **Trụ Pháo Tesla:** Đặt trụ bắn sét dây chuyền. **Đồng đội bắn vào Trụ Tesla sẽ nạp điện tăng tốc bắn; đủ `100%` phát nổ Xung EMP làm choáng quái và xóa sạch đạn địch quanh trụ!** *(Nâng cấp: Trụ Kép · Tự Hủy)* |

---

## ⚡ 5. Sáu Phản Ứng Nguyên Tố & Đồng Đội Combo

Kết hợp 4 trạng thái nguyên tố (**Cháy 🔥**, **Lạnh/Đóng Băng ❄️**, **Sét ⚡**, **Độc ☠️**) trên mục tiêu sẽ kích nổ **6 Phản Ứng Nguyên Tố**:

1. **💨 HƠI NƯỚC (`Cháy + Lạnh`):** Nổ sát thương gấp đôi (`×2.0`) + tạo đám mây hơi nước làm mù khiến quái bắn lệch hướng trong `3s`.
2. **💎 VỠ BĂNG (`Đóng Băng + Đòn nặng / Cận chiến / Chí mạng`):** Phá băng gây **sát thương chí mạng `×3.0`** và văng mảnh băng sát thương lan xung quanh.
3. **⚡ SIÊU DẪN (`Sét + Lạnh`):** Phá vỡ toàn bộ Khiên Chắn và làm mục tiêu **nhận thêm `+30% sát thương` từ mọi nguồn** trong `6s`.
4. **🧪 NỔ ĐỘC (`Cháy + Độc`):** Kích nổ toàn bộ cộng dồn Độc thành vụ nổ diện rộng và phát tán Độc sang quái lân cận.
5. **⛓️ TÊ LIỆT (`Sét + Độc`):** Làm **choáng cứng mục tiêu `1.0s`** và ngắt ngay lập tức đòn gồng chiêu (*telegraph*) của quái Tinh Anh / Boss.
6. **💥 QUÁ TẢI (`Cháy + Sét`):** Nổ sóng xung kích điện-nhiệt phá Khiên Chắn và hất văng mạnh toàn bộ quái xung quanh.

> 🤝 **ĐỒNG ĐỘI COMBO (`Team Combo`):** Khi **Người chơi A** gắn nguyên tố nền và **Người chơi B** kích nổ phản ứng nguyên tố, hệ thống lập tức thưởng **`+15 Năng lượng` cho cả hai người** và cộng điểm **Đồng Đội Combo** để xét danh hiệu **MVP Bậc Thầy Nguyên Tố** cuối trận!

---

## 🗺️ 6. Ba Màn Chơi (Biomes) & Ba Boss Cuối Màn

Một chiến dịch hoàn chỉnh gồm **3 Màn (Biome) × 2 Tầng = 6 Tầng**, kèm các phòng Chiến Đấu, Kho Báu (với câu đố **2 Tấm Áp Lực Co-op**), Thương Nhân Hắc Ám, Điện Thờ Cổ Đại và Phòng Bí Mật (phá tường nứt):

1. **Màn 1 (Tầng 1–2) — Rừng Cổ Mục Nát (*Overgrown Ruins*):**
   - **Địa hình:** Cỏ cháy lan, hồ nước dẫn điện, đầm lầy độc, thùng thuốc nổ dây chuyền.
   - **Boss: Mục Vương Nấm Độc (`spore_king`)** — Bắn vòng bào tử xoay tròn, độn thổ trồi lên dưới chân người chơi (P2), bao phủ viền phòng bằng sương độc (P3). Ở chế độ 3–4 người, triệu hồi thêm **2 Nấm Hộ Vệ** tạo khiên bảo vệ Boss đòi hỏi cả đội chia nhau tiêu diệt.
2. **Màn 2 (Tầng 3–4) — Hầm Băng Vĩnh Cửu (*Frozen Depths*):**
   - **Địa hình:** Sàn băng trơn trượt quán tính, hồ nước đóng băng, vực thẳm và 4 cột pha lê phản xạ tia laser.
   - **Boss: Băng Hậu Kryssa (`kryssa_ice_queen`)** — Bắn tia laser khúc xạ qua cột pha lê (P1), tạo **Phân Thân Gương** *(mẹo: chỉ bản thật mới có bóng đổ dưới chân!)* (P2), gọi **Bão Tuyết** thu hẹp tầm nhìn và nhốt người chơi vào **Lồng Băng Vĩnh Cửu** (đồng đội phải bắn vỡ lồng băng để giải cứu!).
3. **Màn 3 (Tầng 5–6) — Lò Rèn Dung Nham (*Molten Forge*):**
   - **Địa hình:** Kênh dung nham nóng chảy, băng chuyền cơ khí đẩy thực thể, máy móc cổ đại có thể sửa chữa.
   - **Boss: Titan Lò Rèn (`forge_titan`)** — Nện đại chùy tạo **Vòng Sóng Xung Kích** lan rộng (dùng `Shift` lướt xuyên qua bằng i-frame) và đảo chiều băng chuyền (P1); lộ **2 Lõi Năng Lượng** hai bên sườn ở P2 *(cả đội phải phối hợp phá hủy cả 2 lõi trong vòng `3 giây` để làm Titan quá tải choáng cứng `4.5s` và nhận `×1.5` sát thương!)*; quá nhiệt quét lửa 360° ở P3.

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

# 2. Chạy môi trường phát triển (Server Colyseus cổng 2567 + Client Vite cổng 5173)
pnpm dev

# 3. Build production và khởi chạy Host Co-op LAN ngay tại cổng 2567
pnpm host

# 4. Chạy bộ công cụ mô phỏng cân bằng tự động (291 lượt sim -> xuất docs/balance-report.md)
pnpm balance

# 5. Chạy toàn bộ cổng kiểm định chất lượng (Typecheck + ESLint + Vitest Unit/Soak Tests + Build + Playwright E2E)
pnpm verify

# 6. Đóng gói bản phát hành Windows hoàn chỉnh vào release/AshenPact-v0.1.0-win-x64/ và file .zip
pnpm package:release
```

### Cấu trúc thư mục dự án
```text
├── apps/
│   ├── client/          # Giao diện Phaser 3 WebGL, Procedural Vector Art Baker, Lighting/PostFX, ZzFX & Music Synth
│   └── server/          # Máy chủ Authoritative Colyseus 60Hz + phục vụ tĩnh & khám phá IP LAN / QR ASCII
├── packages/
│   └── shared/          # Simulation 60Hz thuần TypeScript, vật lý Spatial Hash, dữ liệu cân bằng, giao thức mạng & i18n
├── tools/
│   ├── balance-harness.ts   # Công cụ kiểm chứng cân bằng tự động tốc độ cao
│   └── package-release.ts   # Công cụ đóng gói AshenPact-Host.exe, batch scripts & gói ZIP phát hành
├── tests/e2e/           # Bộ kiểm thử tự động Playwright E2E từ Phase 0 đến Phase 8
└── docs/                # Tài liệu thiết kế (GDD, TECH, ART_GUIDE, BALANCE, QA_CHECKLIST, RELEASE_NOTES, PROGRESS)
```
