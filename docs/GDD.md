# GAME DESIGN DOCUMENT (GDD) — ASHEN PACT 2.0 (Khế Ước Tro Tàn: Đấu Trường Chiến Thuật)

## 1. Tổng Quan Dự Án
- **Tên dự án:** Ashen Pact 2.0 (*Khế Ước Tro Tàn — Tactical Arena Overhaul*)
- **Thể loại:** Top-down Tactical Action Roguelite Shooter vượt ải, Co-op LAN (1–4 người chơi).
- **Nền tảng:** Trình duyệt Web PC (Chrome, Edge, Firefox mới nhất) & Gói phát hành Windows 64-bit tự chạy, điều khiển Bàn phím + Chuột.
- **Mô hình kết nối:** LAN Host-Client (1 người chạy ứng dụng Host phục vụ cả Web tĩnh + Colyseus WebSocket 60Hz trên cùng 1 cổng `2567`, hiển thị IP LAN + mã QR; tối đa 4 người cùng mạng nội bộ vào chơi không cần Internet). Hỗ trợ chơi Solo trực tiếp trên trình duyệt qua `LocalTransport` độ trễ `< 1 frame`.
- **Phong cách nghệ thuật:** 2D Procedural Vector Art nét sắc, tỉ lệ Chibi (đầu ~40% chiều cao), Cutout Rig 2.0 (outline `2.5u` tối đồng nhất, shading 2 lớp cel + soft gradient, highlight theo vật liệu và rim light `-135°`), kiến trúc Map Hybrid **"Chi tiết ven tường, Tĩnh lặng giữa tâm"**, **tầm nhìn toàn màn hình trong trẻo 100% (Full-Screen Clear Visibility — không sương mù hay fog-of-war che khuất)** cùng ngôn ngữ thị giác chiến thuật 2.0 (Bia chắn 3 trạng thái, Micro-Bar nhịp súng dưới chân, Thẻ Kim Cương Đôi Cầu Vồng Duo Boon).
- **Thời lượng 1 lượt chơi (Run):** ~25–35 phút xuyên suốt **3 Biome × 2 Tầng = 6 Tầng** (Tầng lẻ có Tế Đàn Khế Ước & Đe Rèn Daedalus; Tầng chẵn có Đe Cường Hóa & Boss cuối Biome).

---

## 2. Trụ Cột Thiết Kế & Tam Giác Chiến Thuật 3 Giây (`The 3-Second Tactical Triangle`)

**Ashen Pact 2.0** xóa bỏ hoàn toàn lối chơi thụ động *"giữ chuột trái đi lùi vòng tròn quanh phòng trống và canh thanh năng lượng cạn dần"*, thay thế bằng **Tam Giác Chiến Thuật 3 Giây** giàu kỹ năng và tương tác vật lý trực diện:

1. **Nhịp Vũ Khí Chủ Động (`Active Weapon Cadence` — 100% Không Thanh Năng Lượng):**
   - Thanh Năng lượng (`Energy / NL`) và cầu năng lượng bị loại bỏ hoàn toàn. Vũ khí khai hỏa tự do theo cơ chế vật lý riêng; kỹ năng nhân vật vận hành thuần theo Hồi chiêu (`Cooldown`).
   - Vũ khí chia làm 3 họ nhịp độ trên thanh **Micro-Bar `32×5px`** dưới chân nhân vật: **`CLIP_RELOAD`** (`Finale Shot` viên cuối + `[R]` Nạp Đạn Hoàn Hảo trong Khung Vàng `45%–70%`), **`HEAT_VENT`** (bắn cường hóa ở Vùng Nhiệt Cam `65%–95%` + `[R]` Xả Áp Chiến Thuật), và **`MELEE_COMBO`** (Combo 3 đòn với Đòn 3 Tuyệt Kỹ + `Parry Deflect 0.18s` phản đạn địch).
2. **Vật Lý Địa Hình Chiến Thuật (`Tactical Environment Physics`):**
   - **Lật Bia Chắn `[E]` (`Flip Cover`):** Chuyển bàn đá/phiến băng/tấm chắn thép từ trạng thái nằm (`'low'`) sang dựng đứng (`'flipped'`), lập tức phát xung **`Micro-Blank` bán kính `56px` trong `0.15s` xóa sạch đạn địch bay tới** và tạo công sự che đạn vững chắc.
   - **Đá Trượt `Dash-Kick` & Chấn Động `Wall-Slam` / `Chasm Ring-Out`:** Nhấn `Shift` lướt xuyên qua bia chắn đã lật (góc hướng tới `dot >= 0.45`) hoặc đồ chơi địa hình hình tròn để sút văng vật thể thành đạn trượt **`520 px/s`** (`sliding_ice_block`: `600 px/s`), nghiền choáng hàng quái, hất quái đập tường (**`Wall-Slam`** gây sát thương cộng thêm + choáng `0.40s`), hoặc sút quái bộ binh rơi thẳng xuống vực sâu (**`Chasm Ring-Out`** tiêu diệt tức thì quái thường và bắn vọt vàng/vật phẩm an toàn lên mép bờ gần nhất).
3. **Khởi Đầu 1 Vũ Khí Đặc Trưng & Tự Nạp Khi Cất Túi (`1-Weapon Starter & Holster Auto-Reload`):**
   - Mỗi nhân vật bắt đầu hành trình với **duy nhất 1 vũ khí đặc trưng ở Ô 1** (Ô 2 để trống để nhặt ngay vũ khí đầu tiên trong hầm ngục mà không rơi mất vũ khí gốc; 6 vũ khí clone cũ gồm `rusty_pistol`, `dual_pistols`, `venom_smg`, `frost_bow`, `frost_scepter`, `dragon_breath_shotgun` đã bị cắt bỏ).
   - Khi đổi vũ khí (`[Q]` / `1·2`), vũ khí `CLIP_RELOAD` cất trong túi sau **`2.0s` sẽ tự động nạp đầy băng (`Holster Auto-Reload`)**, còn vũ khí `HEAT_VENT` tự động tản nhiệt thụ động.
4. **Build Độc Lập Từng Người Chơi & Không Thẻ Cộng Chỉ Số Phẳng (`Per-Player Build, Zero Flat Stat-Sticks`):**
   - Toàn bộ 6 buff cộng chỉ số phẳng cũ bị loại bỏ. Mỗi người chơi sở hữu kho nâng cấp độc lập (`blessingIds`, `weaponMutators`, `duoBoonIds`, `activePactId`, `awakenedRelicIds`, `gold`), tự do phối hợp 24 Phước Lành Hành Động, 10 Nâng Cấp Kỹ Năng, 10 Bản Độ Daedalus, 6 Duo Boons và 6 Khế Ước Tro Tàn.

---

## 3. Điều Khiển & Cơ Chế Cốt Lõi

### 3.1 Bảng Điều Khiển PC
| Phím / Chuột | Hành động | Chi tiết cơ học Ashen Pact 2.0 |
|---|---|---|
| `W A S D` / Phím mũi tên | Di chuyển 8 hướng | Gia tốc tức thời (`0.06s`), dừng gọn (`0.05s`), camera lookahead `22%` theo con trỏ chuột |
| `Chuột trái (Nhấp / Giữ / Nhả)` | Bắn / Combo Cận chiến / Kích nổ | Khai hỏa theo nhịp vũ khí; hỗ trợ **Giữ-Nhả (`Hold & Release`)** cho `hunter_crossbow`, `frag_launcher` (*Airburst*), `void_staff` (*Implosion*) |
| `R` (`RELOAD_VENT`) | **Nạp Đạn Hoàn Hảo / Xả Áp Chiến Thuật** | Phím chuyên biệt canh nhịp trên **Micro-Bar `32×5px`**: bấm trong **Khung Vàng `45%–70%`** (`CLIP_RELOAD`) để nạp tức thì + nhận `Overclocked Shot (+45% DMG)`, hoặc bấm ở **Vùng Cam `65%–95%`** (`HEAT_VENT`) để xả sạch nhiệt + tung tuyệt kỹ xả áp |
| `Chuột phải / Space` | Kỹ năng nhân vật (`Skill`) | Vận hành 100% theo **Hồi chiêu (`Cooldown`)**, không tốn năng lượng; hỗ trợ tái kích hoạt pha 2 (`vanguard_charge`, `engineer_self_destruct`) |
| `Shift` | **Lướt (`Dash`) + `Dash-Kick`** | Tốc độ `×2.6` trong `0.22s`, `i-frame 0.16s`, hồi chiêu `1.85s`. Lướt hướng vào Bia Chắn đã lật (`dot >= 0.45`) hoặc Đồ Chơi tròn sẽ sút văng vật thể ở `520–600 px/s` |
| `E` | **Cứu đồng đội / Lật Bia Chắn / Tương tác** | Ưu tiên cứng: **1.** Giữ cứu đồng đội gục (`2.5s`, Mộc Linh `1.25s`) → **2.** **Lật Bia Chắn (`'low' → 'flipped'`, phát `Micro-Blank r=56px` xóa đạn địch `0.15s`)** → **3.** Mở rương / Nhặt & mua đồ / Đe Rèn Daedalus & Cường Hóa / Tế Đàn Khế Ước / Tinh Thể Khiêu Chiến / Cổng. *(Nhấn `[E]` lần nữa vào bia chắn đã lật không làm sập chỗ nấp)* |
| `1 / 2` hoặc `Q / Lăn chuột` | Đổi vũ khí | Chuyển đổi giữa 2 ô vũ khí (`MAX_WEAPON_SLOTS = 2`); kích hoạt `Holster Auto-Reload` sau `2.0s` cho vũ khí cất đi |
| `X` (`DROP_WEAPON`) | **Nhấp: Vứt súng · Giữ `0.5s`: Phân Rã** | **Nhấp nhanh:** Thả vũ khí đang cầm xuống đất nhường cho đồng đội (khóa nhặt lại `0.3s`). **Giữ `0.50s` ngoài giao tranh** cạnh vũ khí dưới đất (`<= 48px`): **Phân Rã Vũ Khí (`Weapon Salvage`)** thành Vàng (`10 / 15 / 22 / 30 / 45G` theo độ hiếm) |
| `Z / Chuột giữa` | Ping ngữ cảnh thông minh | Ping mục tiêu nguy hiểm, rương/vật phẩm, gọi cứu thương hoặc chỉ hướng di chuyển |
| `T (Giữ) + Chuột / 1–4` | Vòng Biểu Cảm (`Emote Wheel`) | Mở vòng 4 biểu cảm nhanh nổi trên đầu nhân vật |
| `Tab` · `I` · `V` · `Esc` | Bản đồ · Mời LAN · Sẵn sàng · Tạm dừng | Phóng to Minimap (`Tab`), bật chip IP/QR LAN (`I`), sẵn sàng tại Hub (`V`), mở Menu Pause/Cài đặt (`Esc`) |

### 3.2 Chỉ Số Sinh Tồn & Luật Vật Lý Môi Trường
- **HP & Giáp (`Armor`):** HP (`4–6`) và Giáp (`2–5`) dạng số nguyên nhỏ dễ đọc. Giáp hấp thụ sát thương trước HP và tự hồi với tốc độ `0.65 Giáp/s` sau thời gian chờ `5.2s` không trúng đòn (Thiết Vệ: **`3.0s`**; nhanh hơn `+30%` khi đứng trong bán kính 4 ô quanh Bánh Răng).
- **Công Thức Sát Thương Vật Lý Môi Trường (Tăng tiến theo Tầng toàn cục $F \in \{1..6\}$, $M_{\text{floor}}(F) = 1 + 0.22(F - 1)$):**
  - **Đá Trượt (`Kick-Slide`):** $\text{Dmg}_{\text{KickSlide}}(e) = \text{round}(20 \cdot M_{\text{floor}}(F) + \alpha_{\text{kick}} \cdot e.\text{maxHp})$ với $\alpha_{\text{kick}} \in \{10\% \text{ thường},\ 5\% \text{ Tinh Anh},\ 1.5\% \text{ Boss}\}$, kèm Choáng `1.0s` và `knockback = 260`.
  - **Chấn Động Đập Tường (`Wall-Slam`, khi tốc độ đẩy lùi `>= 120 px/s` va vào tường/cột/bia chắn):** $\text{Dmg}_{\text{WallSlam}}(e) = \text{round}(14 \cdot M_{\text{floor}}(F) + 0.30 \cdot \text{lastHitDmg} + \alpha_{\text{slam}} \cdot e.\text{maxHp})$ với $\alpha_{\text{slam}} \in \{8\%,\ 4\%,\ 1\%\}$, gây Hit-stun `0.40s` (ngắt telegraph) và kích nổ ngay **Vỡ Băng (`Shatter`)** nếu mục tiêu đang đóng băng.
  - **Đồ Chơi Hạng Nặng (`Dmg_Hazard`):** Gây $\text{round}(\text{baseDmg} \cdot M_{\text{floor}}(F) + 20\% \cdot e.\text{maxHp})$ lên quái thường/Tinh Anh, và phá giáp chuẩn **`6% MaxHP`** khi đập trúng Boss đang bật Vỏ Giáp.

---

## 4. Năm Nhân Vật & Hệ Thống Phối Hợp Không Năng Lượng (`characters/index.ts`)

| Nhân vật | Vai trò | HP / Giáp / Delay Hồi Giáp | Tốc chạy / Crit | Vũ khí đầu (Ô 1) | Nội tại (`Passive`) | Kỹ năng chủ động (`Skill` — Thuần Cooldown) & Synergy Co-op |
|---|---|:---:|:---:|---|---|---|
| **Thiết Vệ** (`vanguard`) | Tank / Bảo Hộ Tuyến Đầu | `6 / 5` (`3.0s`) | `171` (`95%`) / `5%` | `knight_sword` | **Ý Chí Thép:** Giáp hồi sớm sau `3.0s`; mỗi viên đạn địch bị khiên chặn **nạp lại 1 viên đạn (hoặc `-15%` Nhiệt) và cộng `+15%` ST** cho đòn kế tiếp (tối đa `+75%`). | **Tường Khiên Hồng Ngọc** (`CD 9s`, tồn tại `4s`): Dựng khiên cung `120°` chặn & tích đạn địch rồi phóng sóng xung kích. Đạn đồng minh và Trụ Tesla bắn xuyên từ phía sau nhận **`+30%` ST & `+1` xuyên thấu**. |
| **Liệp Ưng** (`ranger`) | Sát Thương / Đánh Dấu | `5 / 3` (`5.2s`) | `189` (`105%`) / `15%` | `hunter_crossbow` | **Mắt Ưng:** Tăng tối đa `+30%` ST theo khoảng cách tới mục tiêu (`320px`); `+10%` tỉ lệ chí mạng cơ bản. | **Mũi Tên Săn Mồi** (`CD 7s`, dấu `6s`): Lộn lùi (`i-frame`) + bắn tên xuyên thấu Đánh Dấu mục tiêu (`+25%` ST nhận vào từ cả đội, lộ diện, bị Trụ Tesla ưu tiên). Quái bị đánh dấu khi chết rơi **Huy Hiệu Săn Mồi** (nhặt vào nạp đầy băng đạn `Overclocked` / xả sạch nhiệt và **`-2.0s` hồi chiêu Kỹ năng**). |
| **Lam Hỏa** (`elementalist`) | Khống Chế / Nguyên Tố | `4 / 2` (`5.2s`) | `180` (`100%`) / `8%` | `apprentice_staff` | **Vòng Xoay Nguyên Tố:** Xoay vòng **Lửa → Băng → Sét** sau mỗi lần dùng Kỹ năng; đạn thường áp nguyên tố hiện hành. | **Cầu Nguyên Tố** (`CD 8s`, vùng `5s`): Ném cầu tạo vùng nguyên tố trên sàn. **Mọi đạn đồng minh bay qua vùng đều được tẩm nguyên tố đó**, châm ngòi phản ứng liên hoàn. |
| **Mộc Linh** (`druid`) | Hỗ Trợ / Hồi Phục | `5 / 3` (`5.2s`) | `180` (`100%`) / `5%` | `thorn_staff` | **Hạt Giống Sự Sống:** Hạ quái có `15%` rơi hạt mầm tự bay tới đồng minh thấp máu nhất hồi `+1 HP`; tốc độ cứu đồng đội nhanh gấp đôi (`1.25s`). | **Cây Thiêng** (`CD 12s`, tồn tại `6s`): Trồng cây thần hồi `1 HP / 2s`, phóng rễ trói quái `1.5s`, chặn đạn và khiêu khích. **Trồng thẳng lên đồng đội đang gục sẽ hồi sinh tức thì với `2 HP`.** |
| **Bánh Răng** (`engineer`) | Tiện Ích / Trụ Pháo | `6 / 4` (`5.2s`) | `180` (`100%`) / `8%` | `rivet_gun` | **Thợ Sửa:** Đồng minh trong 4 ô hồi giáp nhanh hơn `+30%`; sửa và kích hoạt Cổ Máy Cổ Đại trên bản đồ thành trụ chi viện. | **Trụ Tesla** (`CD 10s`, tồn tại `10s`): Phóng sét dây chuyền ưu tiên mục tiêu bị đánh dấu. **Đạn đồng minh bắn trúng trụ giúp nạp điện tăng tốc bắn; đủ `100%` phát nổ Xung EMP làm choáng quái và xóa sạch đạn địch quanh trụ.** |

---

## 5. Kho 18 Vũ Khí Độc Bản Theo 3 Họ Nhịp Độ (`weapons.ts`)

Phân bổ độ hiếm: **5 Thường (`common` — Vũ khí khởi đầu)** · **3 Tốt (`uncommon`)** · **4 Hiếm (`rare`)** · **3 Sử Thi (`epic`)** · **3 Huyền Thoại (`legendary`)**, trải trên `9 CLIP_RELOAD`, `5 HEAT_VENT` và `4 MELEE_COMBO`:

| # | ID Vũ khí | Tên hiển thị | Độ hiếm | Họ Nhịp (`Cadence`) | Thông số cốt lõi | Cơ chế Độc Bản & Tuyệt Kỹ `[R]` / Đòn 3 |
|---:|---|---|---|---|---|---|
| 1 | `knight_sword` ⭐ | **Kiếm Hiệp Sĩ** | `common` | `MELEE_COMBO` | Combo `12→14→24`, tầm `56px`, `proc 0.80` | Đòn 1–2 nhào tới `Lunge`; **Đòn 3** phóng **Kiếm Khí Bán Nguyệt `240px`** xuyên quái + **`Parry Deflect 0.18s`** đánh bật tối đa 3 viên đạn địch ngược về `aimAngle` (`760 px/s`). |
| 2 | `hunter_crossbow` ⭐ | **Nỏ Săn** | `common` | `CLIP_RELOAD` | Băng `4`, nạp `0.95s`, `15 DMG` (`22` tụ), `proc 1.00` | **Giữ-Nhả `0.35s`** bắn tên xuyên 2 mục tiêu (`kb=220`), cắm tối đa 4 mũi tên trên thân quái. `Finale Shot` hoặc **`[R]` Perfect Reload** giật rút toàn bộ tên ngạnh (**`Barbed Rip`: `6 DMG × số tên`** + làm chậm `30%`). |
| 3 | `apprentice_staff` ⭐ | **Trượng Tập Sự** | `common` | `HEAT_VENT` | `11 DMG`, `2.6/s`, `+14%` nhiệt/phát, `proc 0.75` | Phát thứ 3 liên tiếp nổ Cầu Lớn (`17 DMG`, `r=56px`). **`[R]` Tactical Vent (`65%–95%`)** xóa đạn sát thân (`r=56px`) và giáng **Tia Tam Nguyên Tố (`22 DMG`, `r=72px`)** tại con trỏ. |
| 4 | `thorn_staff` ⭐ | **Trượng Gai** | `common` | `CLIP_RELOAD` | Băng `5`, nạp `1.00s`, `11 DMG` (`17` cuối), Độc | Quất dây gai xuyên hàng `240px` cắm Gai Ký Sinh (tối đa 5 gai). **Phát thứ 5 (`Finale`)** kéo giật kẻ địch cuối tầm ngược về `90px`; **`[R]` Perfect Reload** kích nổ toàn bộ gai (`7 DMG Độc/gai`). |
| 5 | `rivet_gun` ⭐ | **Súng Đinh Tán** | `common` | `CLIP_RELOAD` | Băng `6`, nạp `0.90s`, `9 DMG` (`15` cuối), `3.4/s` | Cắm tối đa 6 **Đinh Tán Từ Tính** lên quái/tường/bia chắn. `Finale Shot` hoặc **`[R]` Perfect Reload** nối lưới hồ quang điện giữa các đinh trong `180px` gây sát thương Sét liên hoàn. |
| 6 | `scrap_shotgun` | **Shotgun Phế Liệu** | `uncommon` | `CLIP_RELOAD` | Băng `2`, nạp `0.85s`, `5×6` mảnh, `kb=250` | Áp sát `<= 96px` đạt `Point-Blank (×1.35 DMG)` hất quái `Wall-Slam`; viên 2 bắn phế liệu Lửa; **`[R]` Perfect Reload** hất 2 vỏ đạn nổ nhiệt (`16 DMG Lửa` + khựng). |
| 7 | `gale_smg` | **Tiểu Liên Gió Lốc** | `uncommon` | `HEAT_VENT` | `5 DMG`, Spin-up `6.0→10.5/s`, `+3%` nhiệt/phát | Giữ cò tăng tốc bắn & `+15%` tốc chạy; vùng Cam mỗi phát thứ 6 kèm **Lưỡi Gió Xuyên Thấu**; **`[R]` Tactical Vent** nổ Lốc Xoáy (`r=96px`, `24 DMG`) xóa đạn & hất quái đập tường. |
| 8 | `frag_launcher` | **Súng Phóng Lựu Mảnh** | `uncommon` | `CLIP_RELOAD` | Băng `3`, nạp `1.10s`, `22 DMG` Lửa + 5 mảnh | Đạn nảy 1 nhịp; **Giữ-Nhả Kích Nổ Trên Không (`Hold-Release Airburst`)** nổ ngay giữa không trung (`r=104px`) để mảnh đạn vòng ra sau lưng khiên chắn `shielder`. |
| 9 | `tesla_carbine` | **Súng Điện Từ Tesla** | `rare` | `CLIP_RELOAD` | Băng `8`, nạp `1.00s`, `12 DMG` Sét, xuyên 1, nảy 2 | **Nảy Tường Thông Minh (`Smart Ricochet`):** Đạn đã xuyên quái hoặc qua Bia Chắn/Lăng Kính tự bẻ góc tìm quái gần nhất khi chạm tường (`+35%` Additive DMG/nảy); `Finale` giật sét 3 mục tiêu, `[R]` `+1` lần nảy. |
| 10 | `seed_gun` | **Súng Hạt Giống** | `rare` | `CLIP_RELOAD` | Băng `4`, nạp `1.00s`, `13 DMG` Độc, `proc 0.80` | Gieo tối đa 4 Nụ Hoa Sinh Mệnh rỉa độc; `Finale` hoặc **`[R]` Perfect Reload** kích nổ **Nở Hoa Thu Hoạch (`24 DMG Độc` + Trói `1.0s`)**, nếu trúng quái sống sẽ tỏa Sương Hồi Phục (`+1 Giáp` / `+1 HP` có ICD). |
| 11 | `tether_staff` | **Trượng Liên Kết** | `rare` | `HEAT_VENT` | `11 DMG/nhịp` Sét, `22%` nhiệt/s, tầm `280px` | Căng dây cắt sét cao thế từ người cầm tới Đồng Đội, Summon, Bia Chắn hoặc quái đầu tiên; **`[R]` Tactical Vent** thu dây gom quái về điểm neo rồi kích nổ điện từ (`32 DMG Sét`). |
| 12 | `focus_laser` | `Súng Tia Hội Tụ` | `rare` | `HEAT_VENT` | Tia hội tụ `4→11 DMG` mỗi `0.15s`, Lửa, `520px` | Tia laser liên tục tăng sát thương theo nhiệt và khúc xạ 3 tia qua Lăng Kính/Khiên Thiết Vệ; **`[R]` Tactical Vent** bắn **Pháo Railgun xuyên toàn phòng (`46 DMG Lửa`)**. |
| 13 | `emerald_cleaver` | **Đại Đao Lục Bảo** | `epic` | `MELEE_COMBO` | Combo `22→26→32`, cung `135°`, tầm `92px`, Độc | **Đòn 3** phóng thanh Đại Đao xoay tròn như **Boomerang** tới con trỏ (`280px`), `Parry Deflect` đạn địch rồi thu hồi về vị trí hiện tại của người chơi, kéo quái theo đường về. |
| 14 | `void_staff` | **Trượng Hư Không** | `epic` | `CLIP_RELOAD` | Băng `2`, nạp `1.05s`, cầu hút `12 DMG`, nổ `52 DMG` | Phóng **Cầu Hố Đen** hút gom quái và **nuốt đạn địch** trong `r=110px`; **Giữ-Nhả Sụp Đổ Hư Không (`Implosion`)** nổ `52 DMG Độc` (`+6 DMG` mỗi đạn địch đã nuốt, tối đa `+36`). |
| 15 | `berserker_axe` | **Rìu Chiến Berserker** | `epic` | `MELEE_COMBO` | Combo `24→30→52`, cung `140°`, Lửa, `kb=240` | Chém trúng tích Cuồng Huyết tăng tốc chém (tối đa `+35%`, `+15%` khi vỡ giáp); **Đòn 3 Bổ Đoạn Đầu Đài** vọt tới `96px` phá khiên `shielder`, phản đạn và xẻ khe lửa `160px`. |
| 16 | `solar_archon_staff` | **Trượng Thái Dương** | `legendary` | `HEAT_VENT` | `15×3` tia hội tụ, Lửa, `+12%` nhiệt/phát | Duy trì 3 Tiểu Thái Dương xoay hộ thể và bắn 3 tia nắng hội tụ tại con trỏ; **`[R]` Tactical Vent** hội tụ 3 mặt trời nổ **Siêu Tân Tinh (`68 DMG Lửa`, `r=120px`)** + sàn lửa `3.5s`. |
| 17 | `magma_cannon` | **Pháo Dung Nham** | `legendary` | `CLIP_RELOAD` | Băng `3`, nạp `1.25s`, `38 DMG` Lửa, `kb=280` | Bắn tảng đá nham thạch lăn ủi hàng quái đập thẳng vào tường cuối phòng (**`Wall-Slam` hàng loạt**) kèm thảm dung nham; `Finale` & **`[R]`** phun 4 vòi mạch lửa dọc vệt nham thạch. |
| 18 | `thunder_hammer` | **Búa Lôi Thần** | `legendary` | `MELEE_COMBO` | Combo `30→34→54`, cung `165°`, Sét, `kb=320` | Lực đẩy `320` hất quái & thùng nổ xuyên phòng; **Đòn 3** nện Cột Thu Lôi phản 3 viên đạn thành tia sét và giáng **3 cột Lôi Đình (`54 DMG Sét`, `r=110px`)**. |

---

## 6. Hệ Nguyên Tố, 6 Phản Ứng & Đồng Đội Combo (`Hội Tụ Nguyên Tố`)

### 6.1 Bốn Trạng Thái & Sáu Phản Ứng Nguyên Tố
- **4 Trạng thái cơ bản:** **Cháy (`burn`)** (DoT `3.0s` + cháy lan cỏ/dầu), **Lạnh (`chill` → `frozen`)** (giảm tốc, đủ 3 tầng đóng băng `1.5s`; Boss chịu kháng đóng băng giảm dần `0.6s → 0.3s → 0.15s`), **Sét (`shock`)** (giật dây chuyền 2 mục tiêu trong `115px`, điện hóa mặt nước), **Độc (`poison`)** (cộng dồn DoT tối đa 3 tầng trong `4.0s`).
- **6 Phản ứng nguyên tố:**
  1. **Hơi Nước (`vaporize` — Lửa + Băng):** Nổ sát thương hơi nước + tạo màn mù làm quái bắn trượt.
  2. **Vỡ Băng (`shatter` — Đóng Băng + Đòn Nặng / Crit / `Wall-Slam`):** Nhân `×2.0` sát thương trên quái thường/Tinh Anh (`×1.35` trên Boss) và văng mảnh băng trong `85px`.
  3. **Siêu Dẫn (`superconduct` — Sét + Băng):** Phá khiên và khiến mục tiêu nhận `+30%` sát thương (`EnemyVuln`) trong `4.0s`.
  4. **Nổ Độc (`toxic_blast` — Lửa + Độc):** Phát nổ diện rộng gây sát thương Lửa và phát tán Độc sang quái lân cận.
  5. **Tê Liệt (`paralysis` — Sét + Độc):** Làm choáng cứng mục tiêu `1.0s` và ngắt đòn gồng telegraph.
  6. **Quá Tải (`overload` — Lửa + Sét):** Nổ xung kích điện-nhiệt phá khiên và hất văng mạnh quái xung quanh.

### 6.2 Cơ Chế Đồng Đội Combo (`Elemental Convergence 3.0s`)
Khi **Người chơi A** áp nguyên tố mồi và **Người chơi B** kích nổ phản ứng nguyên tố, cả A và B lập tức nhận trạng thái **Hội Tụ Nguyên Tố (`Elemental Convergence` trong `3.0s`)**: **nạp đầy Băng đạn ngay lập tức / xả sạch Nhiệt về `0%`**, nhận **`+20%` Tốc chạy & `+20%` Tốc bắn**, đồng thời cộng điểm **Đồng Đội Combo** trên HUD và bảng vinh danh MVP cuối trận.

---

## 7. Chiều Sâu Build Theo Từng Người Chơi (`Per-Player Build Depth`)

### 7.1 Hai Mươi Tư (24) Phước Lành Hành Động (`blessings.ts` — 4 Họ × 6 Thẻ)
Lưu trữ riêng trong `player.blessingIds`, sát thương tự động nhân hệ số tầng `scaleBlessingDamage(base, F)`:
1. **Họ 1 — Lật Chắn & Phá Địa Hình (`Table Tech` × 6):** `table_tech_rocket` (*Chắn Chiến Hỏa Tiễn*), `table_tech_blank_nova` (*Chắn Chiến Hàn Băng Xung* `r=160px` + Đóng Băng `1.5s`), `table_tech_prism_split` (*Chắn Chiến Lăng Kính* tách 2 tia Sét `+20%`), `table_tech_billiard_master` (*Cao Thủ Bi-a Chiến Trường* nảy 3 lần + `+40% Wall-Slam`), `table_tech_toxic_shrapnel` (*Chắn Chiến Gai Độc Nổ* 8 gai 360°), `table_tech_magnet_snare` (*Chắn Chiến Bẫy Từ Trường* gom 4 quái + choáng `0.8s`).
2. **Họ 2 — Biến Đổi Cú Lướt (`Dash Tech` × 6):** `dash_tidal_ram` (*Cú Lướt Sóng Ngầm* hồi `60%` CD khi `Wall-Slam`), `dash_venom_wake` (*Vệt Lướt Thủy Ngân Độc* nạp `50%` đạn / `-40%` nhiệt), `dash_flame_shackle` (*Xích Lửa Quật Tường*), `dash_reload_acrobat` (*Nhào Lộn Trợ Nạp* mở rộng Khung Vàng `35%–80%`), `dash_thunder_decoy` (*Phân Thân Lôi Ảnh*), `dash_phase_blade` (*Lướt Xuyên Kiếm Khí*).
3. **Họ 3 — Nạp Nhịp, Xả Áp & Đòn Kết (`Reload Tech` × 6):** `reload_tediore_chuck` (*Băng Đạn Quăng Nổ*), `reload_frost_nova` (*Vòng Hàn Khí Thay Đạn*), `reload_magnet_vortex` (*Xung Từ Trường Gom Quái*), `reload_repulsor_shock` (*Xung Chấn Đẩy Lùi Đập Tường*), `reload_caustic_pod` (*Nang Độc Lăn Nảy* `+25%` suy yếu axit), `reload_holster_surge` (*Dòng Điện Đổi Súng* `[Q]`).
4. **Họ 4 — Hình Học Đạn Đạo & Tương Tác Đồng Đội (`Bullet Mod` × 6):** `bullet_split_bounce` (*Đạn Phân Thân Nảy Tường*), `bullet_ricochet_boom` (*Đạn Nảy Nổ Địa Chấn*), `bullet_heavy_pinball` (*Đạn Bi Sắt Đẩy Lùi* quái dội tường va nhau cùng choáng), `bullet_coop_arc_relay` (*Trạm Tiếp Sóng Đồng Minh*), `bullet_wall_tether` (*Đạn Ghim Tường Giăng Dây*), `bullet_orbit_return` (*Quỹ Đạo Hồi Quy* vòng 180° trả về).

### 7.2 Mười (10) Nâng Cấp Kỹ Năng Nhân Vật (`SKILL_UPGRADE_BLESSING_IDS`)
- **Thiết Vệ:** `vanguard_bastion_prism` (*Pháo Đài Phản Xạ* phản đạn Lửa & tách đôi đạn đồng minh) · `vanguard_charge` (*Xung Phong Khiên* húc quái `Wall-Slam`).
- **Liệp Ưng:** `ranger_arrow_volley` (*Mưa Tên Khóa Góc* 5 tên quạt nổ đánh dấu) · `ranger_prey_chain` (*Dây Xích Con Mồi* chia sẻ `35%` sát thương & kéo dây chuyền).
- **Lam Hỏa:** `elementalist_vortex` (*Hố Đen Nguyên Tố* hút quái & vật lăn) · `elementalist_twin_orbit` (*Song Tinh Cắt Không Gian* nối tia cắt phản ứng `24 DMG/s`).
- **Mộc Linh:** `druid_poison_roots` (*Rễ Gai Quất Tường* mỗi `1.8s` quật quái `Wall-Slam`) · `druid_sacred_grove` (*Rừng Thiêng Cộng Sinh* 2 cây + đạn qua tán cây `+1` Smart Bounce).
- **Bánh Răng:** `engineer_twin_turrets` (*Trụ Kép Giao Thoa* căng hàng rào laser Sét làm chậm `50%`) · `engineer_self_destruct` (*Quá Tải Lò Phản Ứng* biến trụ thành Robot Cảm Tử nổ `45 DMG`).

### 7.3 Mười (10) Bản Độ Búa Rèn Daedalus (`weapon-mutators.ts`)
Gắn tại **Đe Rèn Daedalus (`daedalus_anvil`)** trong Xưởng Rèn Kho Báu ở các Tầng Lẻ (`1, 3, 5`), tối đa **2 Bản Độ / ô vũ khí** (`MAX_MUTATORS_PER_WEAPON_SLOT = 2`):
- **6 Core Mutators:** `mutator_finale_jolt` (*Nòng Nổ Phản Lực* chùm 3 tia + lùi an toàn `48px`), `mutator_gravity_singularity` (*Cực Điểm Hấp Dẫn* gom quái `1.8s`), `mutator_shockwave_edge` (*Lưỡi Đao Sóng Xung Kích* cho cận chiến), `mutator_chain_harpoon` (*Móc Xích Kéo Ngược* kéo quái `Wall-Slam`), `mutator_prism_splitter` (*Thấu Kính Phân Nhánh* tách 3 tia, kẹp trần 9 viên), `mutator_thermal_meltdown` (*Lõi Nhiệt Nóng Chảy* `+25%` khung `[R]` & xuyên khiên trực diện).
- **4 Phase-4 Mutators:** `mutator_holo_decoy_gun` (*Bóng Pháo Ảnh Phản Xạ*), `mutator_cluster_mortar` (*Cối Chùm Cầu Vồng* vượt bia chắn), `mutator_boomerang_core` (*Lõi Cưa Hồi Quy*), `mutator_elemental_infusion` (*Lõi Truyền Nguyên Tố Kép* từ vũ khí ô phụ).

### 7.4 Sáu (06) Phước Lành Giao Thoa Nguyên Tố (`duo-boons.ts`)
Khi người chơi sở hữu đủ cặp nguyên tố yêu cầu (từ vũ khí + phước lành đang mang), ô thẻ thứ 3 khi qua tầng có **`35%` xác suất (`DUO_BOON_SLOT3_UPGRADE_CHANCE = 0.35`)** thăng hoa thành Thẻ **Kim Cương Đôi Cầu Vồng (`Duo Boon`)**:
- `duo_superheated_cyclone` (*Lửa + Băng* — Lốc Xoáy Nước Sôi tự đuổi quái `140 px/s`), `duo_cryo_shatter_spires` (*Băng + Vật lý* — Tứ Trụ Băng Phá chặn đạn & nổ khi `Dash-Kick`), `duo_superconduct_rail` (*Băng + Sét* — Đường Ray Siêu Dẫn bẻ cong quỹ đạo đạn tầm xa hút vào mục tiêu), `duo_napalm_chain_plague` (*Độc + Lửa* — Đại Dịch Nhựa Lửa-Độc nổ dây chuyền khi hạ quái), `duo_plasma_overload_star` (*Lửa + Sét* — Tinh Cầu Quá Tải Plasma xuyên quái nảy tường 3 lần), `duo_magnetic_bastion_ring` (*Sét + Vật lý* — Vòng Thành Lũy Điện Từ giăng hồ quang điện giữa mọi cặp Bia Chắn Đã Lật trong `220px`).

### 7.5 Sáu (06) Khế Ước Tro Tàn → Sáu (06) Di Vật Thức Tỉnh (`ashen-pacts.ts`)
Xuất hiện đúng **1 Tế Đàn / Biome ở các Tầng Lẻ (`1, 3, 5`)**. Mỗi người chơi tự chọn ký hoặc bỏ qua; lời nguyền kéo dài suốt 2 tầng của Biome (kể cả trận Boss) và **lập tức chuyển hóa thành Di Vật Thức Tỉnh ngay khi hạ Boss Tầng Chẵn (`2, 4, 6`), xóa bỏ hình phạt**:
1. `pact_soul_chain` (*Xiềng Xích Linh Hồn* — cách quá `260px` rút 1 Giáp/2.5s) → **`relic_blood_oath_tether`** (*Dây Cắt Huyết Thệ* — căng tia laser Lửa-Sét `22 DMG/s` nối đồng đội/mục tiêu).
2. `pact_shattered_glass` (*Thân Xác Thủy Tinh* — `-50%` Max Giáp, `+20%` tốc chạy) → **`relic_black_crystal_heart`** (*Trái Tim Pha Lê Đen* — trả lại Max Giáp, phát đầu sau `[R]`/Đòn 3 nhận `+65%` Additive DMG & xuyên khiên).
3. `pact_searing_trigger` (*Cò Súng Nóng Bỏng* — bấm trượt `[R]` hoặc quá nhiệt `100%` mất 1 Giáp & khóa cò `+0.4s`) → **`relic_perpetual_core`** (*Lõi Động Cơ Vĩnh Cửu* — `+25%` Khung Vàng `[R]` & phóng 3 Tên Lửa Tro Tàn mỗi lần `[R]` chuẩn).
4. `pact_volatile_arsenal` (*Loạn Đao Hoán Vũ* — súng biến hình ngẫu nhiên sau mỗi đợt quái / mỗi `20s` phòng Boss) → **`relic_master_forge_seal`** (*Ấn Rèn Bậc Thầy* — khôi phục súng gốc, tặng `+1` Cấp Cường Hóa `+20% Base DMG` & `+1` Bản Độ Daedalus miễn phí).
5. `pact_ashen_hunted` (*Tử Thần Truy Sát* — Bóng Ma Đao Phủ bất tử truy đuổi trong mọi phòng combat/Boss) → **`relic_executioner_scythe`** (*Lưỡi Hái Đao Phủ* — dùng Skill hoặc `Wall-Slam` gọi Đao Phủ chém chữ thập `45 DMG` kết liễu ngay quái thường `<= 20% HP`).
6. `pact_ricochet_vow` (*Đạn Đạo Phản Chiếu* — bắn thẳng `-35%` ST, đạn nảy / `Wall-Slam` `+70%` ST & `+1` nảy) → **`relic_ancient_geometry_eye`** (*Con Mắt Hình Học Cổ Đại* — giảm phạt còn `-10%`, tặng vĩnh viễn `+1` Smart Bounce, `+55%` ST đạn nảy & `+35% Wall-Slam`).

---

## 8. Sáu Archetype Phòng, Ba Quy Luật Biome & Kinh Tế Tầng

### 8.1 Sáu (06) Archetype Phòng Chiến Thuật (`36×22` Ô, Lật Đối Xứng & `Prop Jitter`)
Mọi phòng giao tranh áp dụng biến đổi `FlipX / FlipY`, dịch vị trí vật thể `±1..2` ô theo `roomSeed` và bảo toàn sảnh cửa `3×3`:
1. **`TWIN_BRIDGES`:** Vực thẳm `chasm` cắt dọc phòng (tự rẽ nhánh chữ Y quanh cửa Bắc/Nam), buộc giao tranh dồn qua 2 cây cầu rộng 3 ô — sân khấu của `Dash-Kick` và **`Chasm Ring-Out`**.
2. **`GAUNTLET_CHOKEPOINT`:** 4 tường chữ L tạo hành lang chữ thập hẹp `160–220px`, tối ưu cho đạn nảy `Ricochet` và `Wall-Slam`.
3. **`CENTRAL_BASTION`:** Công sự hộp ở tâm phòng bao quanh bởi 4 Bia Chắn và Đồ Chơi Biome.
4. **`CROSSFIRE_CONVEYORS`:** Hai làn băng chuyền / dòng chảy ngược chiều (`110 px/s`) cuốn người, quái và đồ chơi đang trượt.
5. **`PRISM_LABYRINTH`:** 5 bức tường chắn so le dạng bàn cờ cắt tầm nhìn thẳng, kết hợp trụ khúc xạ / trụ sập / búa máy.
6. **`CRUMBLING_PILLAR_RING`:** Vòng lục giác 6 cột đá `2×2` có thể bắn gãy hoặc đâm sập làm mở rộng dần không gian đấu trường.

### 8.2 Ba Biome, Quy Luật Sinh Tồn (`Biome Laws`) & 9 Đồ Chơi Địa Hình
1. **Biome 1 — Rừng Cổ Mục Nát (*Overgrown Ruins*):**
   - *Quy luật:* Đứng trong Cỏ Rậm (`tall_grass`) thực hiện `Dash` hoặc `Perfect Reload [R]` bung phấn hoa `+25%` tốc chạy `2.0s`; lửa cháy lan `320 px/s`.
   - *3 Đồ chơi:* **`moss_table`** (Bia chắn `60 HP`, vỡ tỏa phấn hoa `+1 Giáp` `r=72px`), **`volatile_spore_pod`** (sút trượt `520 px/s` nổ Độc + Trói `1.2s`), **`rotten_totem_pillar`** (cột mục đổ sập theo hướng lực `160×56px` + Choáng `1.5s`).
2. **Biome 2 — Hầm Băng Vĩnh Cửu (*Frozen Depths*):**
   - *Quy luật:* Sàn băng (`ice`) tăng `+50%` lực đẩy lùi và cự ly đá trượt; mọi cú `Wall-Slam` tỏa `+1 Chill` (`r=64px`).
   - *3 Đồ chơi:* **`glacial_barricade`** (Bia chắn `65 HP`, sút vỡ đóng 3 Cọc Nhũ Băng chặn đạn + Đóng Băng `1.5s`), **`sliding_ice_block`** (sút trượt `600 px/s`, nảy tường bi-a 1 lần), **`cryo_prism_pillar`** (khúc xạ đạn gốc thành **3 tia quạt Lạnh `+20%` Additive DMG**).
3. **Biome 3 — Lò Rèn Dung Nham (*Molten Forge*):**
   - *Quy luật:* Băng chuyền đảo chiều đồng bộ mỗi `8.0s` (đèn nháy báo trước `1.2s`); súng `HEAT_VENT` tăng nhiệt `+15%` nhưng xung `[R]` rộng `r=110px`.
   - *3 Đồ chơi:* **`forge_blast_shield`** (Bia chắn thép `85 HP` hấp thụ đạn lửa thành Siêu Nhiệt, khi `Dash-Kick` phóng sóng lửa rộng `88px`), **`pneumatic_press`** (Búa máy dập sau `0.35s` nghiền quái & phá giáp Boss, `0` sát thương lên người chơi), **`slag_crucible`** (đổ tràn thảm dung nham dài `192px`).

### 8.3 Đồ Thị Phòng, Kinh Tế Vàng Cá Nhân & Đấu Trường Bí Mật 20 Giây
- **Đồ thị tầng động:** Tầng lẻ (`1, 3, 5`) có `Tế Đàn Khế Ước` + Xưởng Rèn `Đe Daedalus` + `Cổng`; Tầng chẵn (`2, 4, 6`) thay Tế Đàn bằng phòng `Combat`, Xưởng Rèn đặt `Đe Cường Hóa (+20% Base DMG, tối đa +3)` + `Phòng Boss` (thức tỉnh Di Vật).
- **Phòng Bí Mật Động & Đấu Trường Kỹ Năng 20 Giây (`Secret Skill Arena 20s`):** Gắn ngẫu nhiên sau tường nứt (`cracked_wall`, luôn có sẵn vật chắn gần đó để `Dash-Kick` hoặc dùng nổ/đòn nặng phá tường). Bên trong có 1 Rương `Rare/Epic`, `+30G` tinh thể vàng cá nhân và **Tinh Thể Khiêu Chiến Bí Mật (`[E]`)**:
  - Kích hoạt khóa cửa trong **`20.0s`**, triệu hồi 4 Bia Chắn + 2 Thùng Nổ cùng `4–8` quái (gồm `2–3` Tinh Anh).
  - **Dọn sạch trong `<= 20.0s`:** Rương lập tức thăng hoa thành **`100% Huyền Thoại (Legendary)`** (rơi riêng cho từng người chơi) kèm thưởng nóng **`+40G`/người**!
  - **Hết `20.0s` chưa dọn xong:** Quái thử thách và đạn địch tự động tan biến an toàn (`0` nổ tử vong, **không bao giờ soft-lock**), người chơi vẫn mở được rương `Rare/Epic` gốc và giữ `+30G` an ủi.
- **Kinh tế Vàng cá nhân (`Instanced Gold`):**
  - **Phân Rã Vũ Khí (`Giữ [X] 0.50s` ngoài giao tranh):** Nhận **`10 / 15 / 22 / 30 / 45 Vàng`** (`Common → Legendary`).
  - **Thưởng Phòng Hoàn Hảo (`Flawless Room Bonus`):** **`+10 Vàng`** cho mỗi người chơi dọn xong phòng `combat`, `portal` hoặc `boss` mà không mất Giáp hay HP.
  - **Thương Nhân Hắc Ám (`Cost = round(base × (1 + 0.10 × (globalFloor - 1)))`):** Bình Máu Cổ Ngữ (`+3 HP, +2 Giáp`): `32G` · Giáp Cổ Ngữ (`+2 Max Giáp`): `32G` · Vũ Khí: `55G` · Thẻ Phước Lành Hành Động: `68G` · Đá Tinh Luyện Vũ Khí (`+1 Cấp = +20% Base DMG`): `75G`.

---

## 9. AI Quái Đón Đầu & Ba Boss Phá Giáp Trực Quan (`1–2 Bước`)

### 9.1 AI Ngắm Đón Đầu Có Giới Hạn (`Bounded Predictive Lead Aiming`) & 12 Tương Tác Địa Hình
- **Ngắm đón đầu công bằng:** Xạ thủ và Boss dự đoán vị trí di chuyển của người chơi (`leadFactor = 0.35` quái thường, `0.65` Tinh Anh/Boss), kẹp trần góc đón tối đa **`±28°` (`0.49 rad`)** và chiếu rõ **tia chỉ ngắm laser đỏ cam trong `0.35s` cuối** trước khi khai hỏa.
- **12 tương tác địa hình nổi bật:** `goblin_shooter` nấp sau bàn đá; `wild_boar` húc `410 px/s` tự đâm sập `rotten_totem_pillar` nếu người chơi lướt né; `spore_bomber` lúc gồng nổ có thể bị `Dash-Kick` sút ngược vào bầy địch; `goblin_shaman` cắm cọc totem bị phá sẽ làm choáng bầy quái nối dây; `snow_spirit` chết kết tinh thành `sliding_ice_block`; `baby_yeti` đẩy tảng băng `460 px/s` có thể sút phản đòn; `ice_mage` bắn khúc xạ qua `cryo_prism_pillar`; `ice_golem` vỡ giáp băng tức thì khi dính tảng băng trượt / `Wall-Slam`; `coal_golem` chết rơi bom than `2.0s` sút được; `iron_shielder` trúng Sét vào khiên dẫn điện giật quái phía sau; `dwarf_cannon` bắn cối cầu vồng vượt bia chắn; `welder_drone` rơi nổ xung EMP `r=110px`.

### 9.2 Ba Boss Cuối Màn: Phá Giáp 1–2 Bước, Tiếp Tế `18s` & Thanh `bossStaggerAccum`
- **Hệ thống Boss chung:** Kháng khống chế giảm dần (`CC DR`), Cuồng Nộ Mềm sau `90s`, **Tiếp Tế Đấu Trường (`Boss Supply Drop` mỗi `18.0s`** và mỗi khi chuyển Phase giúp phòng Boss luôn đủ Bia Chắn & Đồ Chơi), cùng **Thanh Chấn Động Phụ (`bossStaggerAccum: 0..100`)** — tích đầy `100` từ lực đẩy lùi và cú sút vật thể sẽ kích nổ `WALL-SLAM` ngay trên thân Boss!
- **Phá Giáp Trực Quan 1–2 Bước ở mốc `66%` & `33%` HP (`6% MaxHP` sát thương chuẩn + Choáng `3.0–4.0s` + `+40% EnemyVuln`):**
  1. **Mục Vương Nấm Độc (`spore_king` — Biome 1, `5200 HP`):** Dựng Vỏ Bào Tử giảm `70%` ST đạn thường → **`Dash-Kick` Bàn Đá / Túi Bào Tử tông trúng Mục Vương** (hoặc dụ húc sập Trụ Đá Mục) để phá vỡ vỏ giáp ngay lập tức (`Choáng 3.5s`).
  2. **Băng Hậu Kryssa (`kryssa_ice_queen` — Biome 2, `6800 HP`):** Dựng Khiên Băng Hàn & quét tia laser (kèm Phân Thân Gương P2 chỉ bản thật có bóng đổ & Bão Tuyết P3 giữ nguyên tầm nhìn sáng rõ) → **Lật `[E]` Phiến Băng Cổ Đại chắn tia laser rồi `Dash-Kick` Phiến Băng / Khối Băng Trượt đâm vỡ khiên Kryssa** (`Choáng 3.0s`).
  3. **Titan Lò Rèn (`forge_titan` — Biome 3, `9600 HP`):** Bật Giáp Nhiệt Hạch, đảo chiều băng chuyền và thả Lõi Năng Lượng / Bom Than → **`Dash-Kick` Tấm Chắn Thép / Nồi Nung Xỉ / Bom Than tông thẳng vào Titan** (hoặc dẫn dụ vào khung **Búa Máy `pneumatic_press`** / phá đồng bộ 2 Lõi Năng Lượng) để làm quá tải nổ giáp (`Choáng 4.0–4.5s`).
