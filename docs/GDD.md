# GAME DESIGN DOCUMENT (GDD) — ASHEN PACT (Khế Ước Tro Tàn)

## 1. Tổng Quan Dự Án
- **Tên dự án:** Ashen Pact (*Khế Ước Tro Tàn*)
- **Thể loại:** Top-down Action Roguelite Shooter vượt ải, Co-op LAN (1–4 người chơi).
- **Nền tảng:** Trình duyệt Web PC (Chrome, Edge, Firefox mới nhất), điều khiển Bàn phím + Chuột.
- **Mô hình kết nối:** LAN Host-Client (1 người chạy ứng dụng Host phục vụ cả Web tĩnh + Colyseus WebSocket trên cùng 1 cổng `2567`, hiển thị IP LAN + mã QR; tối đa 4 người cùng mạng nội bộ vào chơi không cần Internet). Hỗ trợ chơi Solo trực tiếp trên trình duyệt qua `LocalTransport`.
- **Phong cách nghệ thuật:** 2D Procedural Vector Art nét sắc, tỉ lệ Chibi (đầu ~40% chiều cao), Cutout Rig 2.0 (outline `2.5u` tối đồng nhất, shading 2 lớp cel + soft gradient, highlight theo vật liệu và rim light `-135°`), kiến trúc Map Hybrid **"Chi tiết ven tường, Tĩnh lặng giữa tâm"**, ánh sáng động ấm áp với **tầm nhìn toàn màn hình trong trẻo 100% (Full-Screen Clear Visibility — không sương mù hay fog-of-war che khuất)** và hiệu ứng nguyên tố "juicy".
- **Thời lượng 1 lượt chơi (Run):** ~25–35 phút qua 3 Biome × 2 Tầng/Biome (Tầng 2 mỗi Biome kết thúc bằng Boss).

---

## 2. Trụ Cột Thiết Kế (Design Pillars)
1. **Feel trước, Content sau:** Phản hồi điều khiển tức thời (< 1 frame), di chuyển có gia tốc/giảm tốc gọn, bắn đạn có giật lùi (recoil), muzzle flash, vỏ đạn, hit flash, hit-stop (30–60ms), screen shake dạng trauma, knockback và âm thanh ZzFX biến thiên pitch.
2. **Co-op có ý nghĩa:** Kỹ năng giữa 5 nhân vật tương tác trực tiếp (bắn xuyên khiên Thiết Vệ cường hóa đạn, bắn qua Cầu Nguyên Tố của Lam Hỏa tẩm nguyên tố, nạp điện cho Trụ Tesla của Bánh Răng phát nổ EMP, dồn sát thương mục tiêu bị Liệp Ưng đánh dấu, Mộc Linh trói chân & hồi sinh tức thì).
3. **Dễ đọc giữa hỗn loạn (Readability):** Đạn địch luôn nổi bật (lõi sáng, bão hòa cao, viền tối đậm + glow), đạn đồng minh phân biệt rõ và có tùy chọn giảm độ đậm (mặc định 70%), mọi đòn nguy hiểm đều có telegraph đỏ rõ ràng từ 0.4–1.0s.
4. **Đẹp & Mượt:** Duy trì 60 FPS ổn định nhờ bake procedural vector art ra texture theo DPR + object pooling triệt để.

---

## 3. Điều Khiển & Cơ Chế Cốt Lõi

### 3.1 Bảng điều khiển (PC)
| Phím / Chuột | Hành động | Chi tiết kỹ thuật |
|---|---|---|
| `W A S D` | Di chuyển 8 hướng / tự do | Gia tốc nhanh (0.06s đạt tốc độ tối đa), dừng gọn (0.05s), không trượt khó chịu |
| `Chuột` | Ngắm bắn | Camera lookahead 22% về hướng con trỏ chuột; nhân vật lật mặt & mắt nhìn theo hướng ngắm |
| `Chuột trái (Giữ)` | Bắn / Tấn công | Tự động lặp theo tốc bắn của vũ khí đang cầm |
| `Chuột phải / Space` | Kỹ năng nhân vật (Skill) | Kích hoạt kỹ năng chủ động (hoặc tái kích hoạt với kỹ năng 2 pha) |
| `Shift` | Dash / Lộn | Tốc độ ×2.6 trong 0.22s, i-frame 0.20s, hồi chiêu 1.2s, để lại vệt afterimage |
| `E` | Tương tác / Nhặt / Hồi sinh | Nhấn để mở rương/nhặt/mua đồ (chọn đối tượng gần nhất trong nhóm ưu tiên cao nhất có ứng viên trong bán kính `INTERACT_RANGE = 64` qua `findInteractTarget`); giữ 2.5s (Mộc Linh 1.25s) để hồi sinh đồng đội |
| `1 / 2` hoặc `Q / Lăn chuột` | Đổi vũ khí | Chuyển đổi trực tiếp hoặc xoay vòng giữa 2 ô vũ khí mang theo (`MAX_WEAPON_SLOTS = 2`) |
| `X` | Thả vũ khí | Thả vũ khí đang cầm xuống đất để nhường cho đồng đội (`spawnDroppedWeapon`) |
| `Tab` | Bản đồ lớn | Mở rộng minimap và trạng thái khám phá phòng |
| `Z / Chuột giữa` | Ping ngữ cảnh | Ping vị trí ("Đi đây"), quái ("Tập trung mục tiêu"), hoặc vật phẩm/bình máu |
| `T (Giữ) + Chuột / 1–4` | Vòng Emote nhanh | Mở vòng biểu cảm vector (4 lựa chọn) nổi trên đầu nhân vật, tách biệt hoàn toàn với phím số đổi vũ khí |
| `Esc` | Menu tạm dừng / Cài đặt | Không làm dừng simulation khi đang ở chế độ Co-op LAN |

### 3.2 Chỉ số người chơi & Trang bị (Kiểu Soul Knight)
- **HP:** Số nguyên nhỏ (5–8 tùy nhân vật). Khi về 0 chuyển sang trạng thái **Gục (Downed)** (co-op) hoặc thua cuộc (solo, trừ khi có bùa hồi sinh).
- **Giáp (Armor):** Số nguyên nhỏ (3–6 tùy nhân vật). Hấp thụ sát thương trước HP. Tự động hồi sau **3.0s** không nhận sát thương (Thiết Vệ: **2.0s**), tốc độ hồi **1 điểm / 1.0s** (+30% khi đứng trong bán kính 4 ô quanh Bánh Răng).
- **Năng lượng (Energy):** 150–260 tùy nhân vật. Vũ khí tiêu tốn 0–18 năng lượng mỗi phát; vũ khí khởi đầu tiêu tốn 0 năng lượng.
- **Tỉ lệ chí mạng (Crit Chance) & Sát thương chí mạng (Crit Multiplier):** Mặc định ×1.5 sát thương khi chí mạng (Vỡ Băng: ×3.0).
- **Giới hạn 2 Ô Vũ Khí (`MAX_WEAPON_SLOTS = 2`) & Rơi Vũ Khí:**
  - Mỗi nhân vật mang tối đa **2 vũ khí**. Loadout khởi đầu gồm `[starterWeaponId, 'rusty_pistol']` (ví dụ Thiết Vệ khởi đầu với `[knight_sword, rusty_pistol]`).
  - Khi cả 2 ô đã đầy mà người chơi nhặt hoặc mua vũ khí mới, vũ khí đang cầm trên tay sẽ **văng ra đất tại vị trí món vừa nhặt** thành `worldItem` dùng chung (`costGold = 0`) qua `spawnDroppedWeapon` thay vì biến mất, áp dụng khóa nhặt lại `0.3s` (`18` ticks) cho người vừa thả để tránh nhặt đúp ngoài ý muốn và cho phép đổi lại hoặc nhường cho đồng đội.

---

## 4. Năm Nhân Vật & Hệ Thống Synergy

| Nhân vật | Vai trò | HP / Giáp / NL / Tốc độ | Vũ khí đầu | Nội tại (Passive) | Kỹ năng chủ động (Skill) | 2 Nâng cấp Skill (Buff Pool) |
|---|---|---|---|---|---|---|
| **Thiết Vệ** (*Vanguard*) | Tank / Bảo hộ | 8 / 6 / 150 / 95% | Kiếm Hiệp Sĩ (chém tan đạn thường) | **Ý Chí Thép:** Giáp hồi sau 2s; chặn đạn bằng khiên hồi +1 NL/viên | **Tường Khiên Hồng Ngọc** (CD 9s, 4s): Khiên cung 120° chặn & tích trữ đạn địch, hết giờ/bấm lại phóng ngược sóng xung kích. Đạn đồng minh bắn xuyên từ sau nhận +30% DMG & xuyên 1 mục tiêu | 1. *Pháo Đài* (khiên 360° bán kính nhỏ hơn)<br>2. *Xung Phong* (tái kích hoạt lao tới hất văng quái) |
| **Liệp Ưng** (*Ranger*) | DPS / Đánh dấu | 5 / 4 / 200 / 105% | Nỏ Săn | **Mắt Ưng:** Tăng tối đa +30% DMG theo khoảng cách; +10% Crit | **Mũi Tên Săn Mồi** (CD 7s): Lộn lùi (i-frame) + bắn tên xuyên thấu, đánh dấu quái 6s (+25% DMG từ mọi nguồn, lộ diện rõ nét, chết rơi cầu NL) | 1. *Mưa Tên* (bắn chùm 5 mũi tên)<br>2. *Chuỗi Con Mồi* (30% DMG lan sang các mục tiêu bị đánh dấu khác) |
| **Lam Hỏa** (*Elementalist*) | Khống chế / Nguyên tố | 5 / 3 / 260 / 100% | Trượng Tập Sự (đạn mang nguyên tố hiện hành) | **Vòng Xoay Nguyên Tố:** Xoay vòng Lửa → Băng → Sét sau mỗi lần dùng Skill; đạn thường áp nguyên tố hiện tại | **Cầu Nguyên Tố** (CD 8s): Tạo vùng nguyên tố 5s (Lửa cháy sàn / Băng làm chậm + Lạnh / Sét giật lan). Đạn đồng minh bay qua vùng được tẩm nguyên tố đó | 1. *Hố Đen Nguyên Tố* (hút quái vào tâm vùng)<br>2. *Song Nguyên Tố* (chứa 2 nguyên tố, nổ phản ứng ngay) |
| **Mộc Linh** (*Druid*) | Hỗ trợ / Hồi phục | 6 / 4 / 200 / 100% | Trượng Gai (đạn gây Độc nhẹ) | **Hạt Giống Sự Sống:** Hạ quái có 15% rơi hạt hồi 1 HP bay tới đồng minh thấp máu nhất; hồi sinh nhanh ×2 | **Cây Thiêng** (CD 12s, 6s): Trồng cây hồi 1 HP/2s (tối đa 3 HP), trói chân quái 1.5s, chặn đạn & khiêu khích quái. Trồng lên đồng đội đang gục → hồi sinh tức thì với 2 HP (CD ×2) | 1. *Rễ Gai Độc* (rễ gây DMG + Độc)<br>2. *Rừng Thiêng* (trồng 2 cây nhỏ hơn) |
| **Bánh Răng** (*Engineer*) | Tiện ích / Trụ pháo | 6 / 5 / 180 / 100% | Súng Đinh Tán | **Thợ Sửa:** Đồng minh trong 4 ô hồi giáp nhanh +30%; sửa & kích hoạt máy móc trên map | **Trụ Tesla** (CD 10s, tồn tại 10s): Phóng sét dây chuyền ưu tiên mục tiêu bị đánh dấu. Đạn đồng minh bắn vào trụ sẽ nạp điện tăng tốc bắn; đủ 100% phát nổ **Xung EMP** làm choáng quái & xóa đạn địch | 1. *Trụ Kép* (đặt tối đa 2 trụ)<br>2. *Tự Hủy* (hết thời gian trụ phát nổ lớn) |

---

## 5. Hệ Nguyên Tố & Phản Ứng

### 5.1 Bốn Trạng Thái Nguyên Tố
1. **Cháy (Burn):** Sát thương theo thời gian (DoT), bắt lửa sang bề mặt cỏ và dầu.
2. **Lạnh (Chill / Freeze):** Giảm 30% tốc độ di chuyển & tấn công; đủ 3 tầng chuyển thành **Đóng Băng** 1.5s (Boss không bị đứng yên hoàn toàn nhưng bị giảm tốc mạnh và vẫn kích hoạt được Vỡ Băng).
3. **Sét (Shock):** Phóng tia điện lan sang quái lân cận; chạm mặt nước sẽ điện hóa toàn bộ vũng nước.
4. **Độc (Poison):** Sát thương theo thời gian cộng dồn (tối đa 5 tầng), ngăn mục tiêu hồi máu.

### 5.2 Sáu Phản Ứng Nguyên Tố
- **Cháy + Lạnh = Hơi Nước (Vaporize):** Nổ sát thương + tạo đám mây mù làm quái bắn trượt (tăng độ lệch đạn địch).
- **Đóng Băng + Đòn nặng (Cận chiến / Nổ / Crit) = Vỡ Băng (Shatter):** Gây **×300%** sát thương đòn kích hoạt + văng mảnh băng.
- **Sét + Lạnh = Siêu Dẫn (Superconduct):** Phá giáp quái, khiến mục tiêu nhận **+30% sát thương** từ mọi nguồn trong 4s.
- **Cháy + Độc = Nổ Độc (Toxic Blast):** Phát nổ diện rộng gây sát thương Lửa + lan 1 tầng Độc.
- **Sét + Độc = Tê Liệt (Paralysis):** Làm choáng mục tiêu trong **1.0s**.
- **Cháy + Sét = Quá Tải (Overload):** Vụ nổ xung kích gây sát thương cao và hất văng quái xung quanh.
- **Cơ chế Đồng Đội Combo (Team Combo):** Khi trạng thái gốc do người chơi A áp lên và nguyên tố kích hoạt do người chơi B tạo ra, cả A và B nhận **+15 Năng lượng**, tăng bộ đếm **Team Combo** trên HUD và vinh danh cuối trận.

---

## 6. Cấu Trúc Lượt Chơi, Vũ Khí & Thế Giới

### 6.1 Doanh Trại (Hub) & Cấu trúc Tầng
- **Hub (Doanh Trại):** Có lửa trại ấm áp ở trung tâm, 5 bục tượng nhân vật (tương tác `E` để đổi nhân vật & xem preview kỹ năng), giá vũ khí thử nghiệm tự động bổ sung (`isHubRackItem` không bao giờ trống kệ), hình nộm tập bắn có bảng đo **DPS thời gian thực**, bảng thông tin **Mời bạn bè LAN (IP + QR)** và Cổng Xuất Phát (kích hoạt khi mọi người trong phòng đều Sẵn Sàng).
- **Cấu trúc mỗi Tầng (Floor):** 7–10 phòng nối bằng hành lang trên lưới:
  1. Phòng Bắt Đầu (An toàn)
  2. 3–5 Phòng Chiến Đấu (2–4 đợt quái, khóa cửa khi vào, dịch chuyển đồng đội bên ngoài vào phòng)
  3. 1 Phòng Rương (Rương vũ khí instanced cho từng người)
  4. 1 Phòng Thương Nhân (Mua vũ khí/bình máu/vật phẩm bằng xu)
  5. 1 Phòng Tượng Thần (Hiến xu nhận phước lành/buff)
  6. 0–1 Phòng Bí Mật (Phá tường nứt để vào)
  7. Phòng Cổng Dịch Chuyển (Tầng 1) hoặc Phòng Boss (Tầng 2)
- **Tương tác Co-op trên Map:** Một số phòng có **2 tấm áp lực** cần 2 người đứng cùng lúc để mở rương thưởng (khi chơi Solo có sẵn khối đá/thùng để đẩy lên tấm thứ hai).

### 6.2 Kho Vũ Khí (~24 Vũ Khí, 5 Độ Hiếm)
- Độ hiếm: **Trắng (Common)**, **Xanh Lá (Uncommon)**, **Xanh Dương (Rare)**, **Tím (Epic)**, **Cam (Legendary)**.
- Phân nhóm:
  - **Vũ khí khởi đầu (5):** Kiếm Hiệp Sĩ, Nỏ Săn, Trượng Tập Sự, Trượng Gai, Súng Đinh Tán.
  - **Súng lục & SMG (4):** Súng Lục Rỉ Sét, Súng Lục Đôi, Tiểu Liên Gió Lốc, Tiểu Liên Bọ Cạp (Độc).
  - **Shotgun & Súng trường (4):** Shotgun Phế Liệu, Shotgun Hỏa Long (Cháy), Súng Trường Xung Kích, Súng Bắn Tỉa Chim Ưng.
  - **Cung, Trượng & Laser (5):** Cung Băng Giá (Lạnh), Trượng Sấm Sét (Sét), Trượng Hư Không, Súng Tia Hội Tụ (Laser), Súng Lăng Kính.
  - **Phóng lựu & Cận chiến (4):** Súng Phóng Lựu Mảnh, Pháo Dung Nham, Rìu Chiến Berserker (chém tan đạn), Búa Lôi Thần (nện sóng Sét).
  - **Vũ khí Co-op đặc biệt (2):**
    1. **Súng Hạt Giống (Seed Launcher):** Đạn ghim xuống đất nảy mầm thành hoa phát sáng, hồi máu cho đồng đội đứng gần hoặc nổ phấn độc khi quái dẫm phải.
    2. **Trượng Liên Kết (Tether Staff):** Tạo tia năng lượng nối giữa người cầm và đồng đội gần nhất (solo: nối với bóng ma/trụ hoặc mục tiêu neo), đốt cháy mọi kẻ địch đi cắt ngang tia.

### 6.3 Ba Biome, Quái & Boss
1. **Biome 1 — Rừng Cổ Mục Nát (Overgrown Ruins):**
   - *Kiến trúc & Bề mặt:* Đá cổ rêu phong (`#3D4F47`), rễ cây cổ thụ uốn lượn bò tràn qua mép tường (phần trên sàn phẳng như decal, không cản đường), cụm nấm phát quang góc phòng; bề mặt cỏ, nước, đầm độc bo viền tự nhiên kèm đá bước chân dọc mép (chỉ trên ô khô).
   - *Quái (6):* Goblin Xạ Thủ, Slime (tách đôi), Nấm Nổ, Lợn Rừng (lao húc), Pháp Sư Goblin (hồi máu/triệu hồi), Cây Gai (tháp cố định).
   - *Boss:* **Mục Vương Nấm Độc** (P1: vòng bào tử + gọi nấm; P2: độn thổ trồi lên dưới chân người chơi; P3: mây độc thu hẹp mép phòng; 3–4 người: thêm 2 Nấm Hộ Vệ tạo khiên bất tử cho boss).
2. **Biome 2 — Hầm Băng Vĩnh Cửu (Frozen Depths):**
   - *Kiến trúc & Bề mặt:* Đá teal dịu (`#446E78`) kết hợp mặt tường băng xanh nhạt (`#6F949E`, rim `#CFE8EE`), vòng cổ ngữ băng (Astrolabe) khắc chìm mờ giữa tâm phòng, cụm tinh thể pha lê góc phòng và luồng sáng God-rays chiếu xiên từ hướng key light (trên-trái) cực dịu; bề mặt băng trơn, nước đóng băng, vực thẳm.
   - *Quái (5):* Dơi Băng, Yeti Con, Pháp Sư Băng, Golem Băng (khiên chắn mặt trước), Tinh Linh Tuyết.
   - *Boss:* **Băng Hậu Kryssa** (Cột pha lê phản xạ tia laser; P2: phân thân gương — chỉ bản thật có bóng đổ dưới chân; P3: cuồng phong băng giá — tuyết dày thổi xiên, color grade lạnh nhẹ và viền sương giá mỏng ở mép màn hình [nhưng **không** làm tối màn hình hay thu hẹp bán kính tầm nhìn] + đóng băng 1 người chơi cần đồng đội bắn vỡ băng cứu).
3. **Biome 3 — Lò Rèn Dung Nham (Molten Forge):**
   - *Kiến trúc & Bề mặt:* Đá bazan ấm sẫm (`#53433F`) viền đồng thau, bánh răng cơ khí & ống dẫn hơi nước gắn trên tường, rãnh nhiệt ven tường có nắp lưới sắt (đi qua được, ánh dung nham chỉ lộ qua khe lưới); dung nham lộ thiên chỉ có ở surface `lava` thật của sim; bề mặt dung nham, băng chuyền, thùng nổ, máy móc hỏng (Bánh Răng sửa được).
   - *Quái (5):* Tiểu Quỷ Lửa, Người Lùn Pháo Thủ, Golem Than (chết để lại sàn cháy), Drone Hàn, Khiên Thủ Sắt.
   - *Boss:* **Titan Lò Rèn** (Búa nện sóng xung kích + đảo chiều băng chuyền; P2: lộ 2 lõi năng lượng hai bên cần bắn vỡ đồng thời trong 3s [solo 6s] để làm choáng; P3: quá nhiệt phun lửa quét vòng tròn).

---

## 7. Đề Xuất Bổ Sung Nhỏ (Phục Vụ Trực Tiếp Trải Nghiệm)
1. **Hệ thống 2 ô vũ khí (`MAX_WEAPON_SLOTS = 2`), phím thả vũ khí (`X`) và gộp prompt `[E]` vào thẻ so sánh nhanh:** Hỗ trợ trao đổi vũ khí mượt mà giữa đồng đội (nhặt vũ khí mới khi đầy sẽ tự thả vũ khí đang cầm ra đất) và chỉ hiển thị 1 prompt `[E]` duy nhất cho đối tượng tương tác gần nhất theo thứ tự ưu tiên.
2. **Tầm nhìn toàn màn hình trong trẻo (Full-Screen Clear Visibility):** Loại bỏ hoàn toàn lớp sương mù trôi che màn hình (`fx_ambient_mist`), bỏ giới hạn vòng tròn tầm nhìn tối quanh người chơi (`mainPlayerVisionRadius` / `allyVisionRadius`), bỏ phần làm tối của bão tuyết Boss 2 (`blizzardVeil`) và tắt vignette làm tối 4 góc màn hình theo mặc định (`vignetteStrength = 0.0`). Mọi góc phòng đều sáng rõ (`ambientColor` ~0.84–0.90, chừa dư địa cho ánh sáng), trong khi các chậu lửa ven tường, rương, cổng và đạn vẫn rực rỡ nhờ đèn cộng (`BlendMode.ADD`). Đạn địch luôn phân biệt được bằng hình dạng (lõi trắng + thân đỏ + viền tối) ở mọi biome.
3. **Ký hiệu hình học kèm màu cho phản ứng nguyên tố & trạng thái:** Giúp người chơi dễ phân biệt trạng thái ngay cả khi hiệu ứng ánh sáng dày đặc, đồng thời gộp các chữ phản ứng nguyên tố trùng nhau trong `0.4s` (ví dụ `HƠI NƯỚC ×3`).
4. **Nút chuyển nhanh nhân vật/quái/trạng thái/màu P1–P4 và nền Biome trong `ArtGallery` (chỉ mở khi bật chế độ Debug):** Giúp kiểm thử trực quan và chụp screenshot tự động qua Playwright chính xác ở mọi độ phân giải.
