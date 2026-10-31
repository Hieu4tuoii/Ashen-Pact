# STYLE GUIDE ĐỒ HỌA PROCEDURAL (ART_GUIDE.md) — ASHEN PACT

## 1. Triết Lý & Quy Tắc Cốt Lõi
- **100% Procedural Vector Art:** Toàn bộ nhân vật, quái, boss, vũ khí, đạn, tilemap, vật thể tương tác và biểu tượng UI đều được sinh bằng code thông qua thư viện `apps/client/src/art/` (được chia mô-đun gồm `texture-baker.ts` + 5 sub-bakers `texture-baker-canvas.ts`, `texture-baker-tiles.ts`, `texture-baker-props.ts`, `texture-baker-surfaces.ts`, `texture-baker-fx.ts`; và `cutout-rig.ts` + `rig-defs.ts` + 14 file định nghĩa rig `rig-defs-heroes-1/2.ts`, `rig-defs-biome1/2/3-*.ts`, `rig-defs-weapons-1/2.ts`).
- **Ngoại lệ duy nhất:** File font vector `Be Vietnam Pro` (giấy phép SIL Open Font License 1.1) đóng gói local trong `apps/client/public/fonts/`.
- **Độ sắc nét theo DPR:** Mọi hình vẽ đều được bake ra texture ở độ phân giải `worldSize * Math.ceil(cameraZoom * devicePixelRatio * 2.5)` (kẹp trong khoảng `4.0x – 8.0x` supersampling khi tạo canvas offscreen) để không bao giờ bị răng cưa hay mờ nhòe ở 1080p và 1440p (kể cả khi phóng đại preview `2.25×` trong `ArtGalleryScene`).
- **Tầm nhìn toàn màn hình trong trẻo (Full-Screen Clear Visibility):**
  - **Không sương mù che màn hình:** Cấm dùng particle sương mù lớn trôi ngang (`fx_ambient_mist`) làm đục màu nền và giảm độ tương phản.
  - **Không giới hạn vòng tầm nhìn tối (No Fog-of-War):** Toàn bộ căn phòng từ tâm ra 4 góc màn hình luôn sáng rõ (`ambientColor` ~0.84–0.90 trung bình kênh, `vignetteStrength = 0.0` mặc định). Ambient không đặt cao hơn vì lightmap blend `MULTIPLY` bị kẹp ở 1.0: cần chừa 10–16% dư địa để vũng sáng nhìn thấy được. Cũng không đặt thấp hơn 0.84 vì `MULTIPLY` nhân trên giá trị sRGB nên L\* sàn tối giảm nhanh hơn tỉ lệ ambient (0.82 chỉ giữ ~83% L\*). Ánh sáng từ chậu lửa ven tường, rương, cổng dịch chuyển, đạn và nguyên tố đóng vai trò tô điểm chiều sâu và dẫn hướng thị giác bằng `BlendMode.ADD`, không phải đèn pin soi bóng tối.
- **Hình ảnh = ngữ nghĩa gameplay:** Thứ trông như hazard (dung nham, độc, băng trơn) phải là surface thật trong sim. Thứ trông như vật cản (cột, bệ, đe, bánh răng lớn) phải nằm trên ô `wall`/`pillar` hoặc gắn vào mặt tường. Decor chỉ có ở client mà nằm trên ô đi được thì phải phẳng: không viền INK, không đổ bóng, `ΔL* ≤ 10`.
- **Surface động luôn thắng decal:** surface sinh giữa trận (boss phase 3 phủ vòng ngoài phòng, kỹ năng, quái để lại sàn) render **trên** mọi decal sàn; decal ở ô vừa thành surface phải ẩn (fade ≤ 200ms). Phòng boss không đặt decal có nghĩa "lối đi" (đá bước chân, lưới sắt, rãnh nhiệt) trong 3 ô ngoài cùng.

---

## 2. Bảng Màu Cố Định (Master Palette — 42 Màu Gốc + Nhóm Màu Môi Trường `ENV`)
Toàn bộ màu sắc bề mặt vật thể bắt buộc lấy từ `PALETTE` trong `apps/client/src/art/palette.ts` (ngoại trừ ánh sáng additive/glow). Từ phiên bản **v0.2.0 (thay đổi convention đã duyệt)**, bảng màu được mở rộng thêm nhóm màu môi trường trầm `ENV` (độ bão hòa HSL `S ≤ 0.35`, riêng B2 `≤ 0.40`) để nền map dịu mắt và tôn nổi nhân vật/đạn địch:

| Nhóm màu | Tên mã màu | Mã Hex | Mục đích sử dụng |
|---|---|---|---|
| **Ink & Outline (4)** | `INK_DARK` | `#141019` | Màu viền (outline) chuẩn cho mọi thực thể |
| | `INK_DEEP` | `#0B090E` | Nền tối sâu, hố thẳm, viền Boss |
| | `SLATE_DARK` | `#241F2E` | Bóng tối kim loại, giáp tối |
| | `SLATE_MID` | `#3B344A` | Đá tối, nền UI phụ |
| **Metals & Neutrals (6)** | `STEEL_DARK` | `#565E75` | Lớp bóng (cel-shade) của thép/giáp |
| | `STEEL_LIGHT` | `#8B97B5` | Màu chính của thép/giáp Thiết Vệ |
| | `SILVER_BRIGHT` | `#C7D2E8` | Rim light / highlight trên kim loại |
| | `BONE_WHITE` | `#F4F1EA` | Màu trắng ngà, răng/xương, mắt, chữ chính |
| | `ASH_GRAY` | `#746F7D` | Đá trung tính, khói tro |
| | `WARM_STONE` | `#9C9286` | Tường cổ, gạch đá |
| **Skin & Leather (5)** | `SKIN_WARM` | `#F2C29B` | Màu da nhân vật sáng |
| | `SKIN_SHADE` | `#D1946B` | Bóng cel trên da |
| | `LEATHER_DARK` | `#4E2F21` | Giày, đai lưng, báng súng tối |
| | `LEATHER_MID` | `#7D4B32` | Áo choàng da, thân nỏ, gỗ |
| | `LEATHER_LIGHT` | `#AD6E4B` | Highlight gỗ/da |
| **Ruby / Fire / P2 (5)** | `RUBY_DARK` | `#6E1423` | Bóng sâu áo choàng Thiết Vệ / Quái lửa |
| | `RUBY_CORE` | `#B82538` | Màu chủ đạo Thiết Vệ / Hồng ngọc |
| | `CRIMSON_BRIGHT` | `#E84545` | Đạn địch, cảnh báo telegraph, định danh **P2** |
| | `FLAME_ORANGE` | `#F97316` | Nguyên tố **Lửa (Cháy)**, dung nham |
| | `SOLAR_GOLD` | `#FACC15` | Viền vàng hoàng gia, chí mạng, định danh **P4** |
| **Emerald / Nature / P3 (6)** | `MOSS_DARK` | `#163024` | Nền tối Biome 1 (Rừng Cổ Mục Nát) |
| | `FOREST_SHADE` | `#1E4E38` | Bóng lá cây, da Goblin vùng tối |
| | `GOBLIN_GREEN` | `#499F54` | Màu chủ đạo da Goblin, áo choàng Liệp Ưng, Mộc Linh & độ hiếm Uncommon |
| | `LIME_GLOW` | `#84CC16` | Nấm phát quang, định danh **P3** |
| | `MINT_LIGHT` | `#A7F3D0` | Highlight lá/hồi máu |
| | `TOXIC_PURPLE` | `#9333EA` | Nguyên tố **Độc**, đầm lầy độc, Mục Vương |
| **Azure / Ice / P1 (6)** | `ABYSS_BLUE` | `#0F1E36` | Nền tối Biome 2 (Hầm Băng Vĩnh Cửu) |
| | `COBALT_SHADE` | `#1D4ED8` | Bóng giáp băng, áo Pháp Sư |
| | `AZURE_CORE` | `#3B82F6` | Định danh **P1**, năng lượng |
| | `CYAN_FROST` | `#22D3EE` | Nguyên tố **Lạnh (Băng)**, pha lê |
| | `ICE_WHITE` | `#CFFAFE` | Highlight băng tuyết |
| | `ELECTRIC_VIOLET` | `#A855F7` | Tia arcane, cổng dịch chuyển |
| **Amber / Lightning / Forge (6)** | `FORGE_DARK` | `#27120B` | Nền tối Biome 3 (Lò Rèn Dung Nham) |
| | `BRONZE_SHADE` | `#92400E` | Đồng thau tối (Bánh Răng) |
| | `BRASS_CORE` | `#D97706` | Màu chủ đạo Bánh Răng / Máy móc |
| | `VOLT_YELLOW` | `#FDE047` | Nguyên tố **Sét**, tia điện Tesla |
| | `MAGMA_RED` | `#DC2626` | Lõi nhiệt, thùng nổ |
| | `COPPER_LIGHT` | `#FDBA74` | Highlight đồng/lửa |
| **Player Ring Accents (4)** | `P1_RING` | `#38BDF8` | Vòng định danh Người chơi 1 (Xanh dương) |
| | `P2_RING` | `#FB7185` | Vòng định danh Người chơi 2 (Đỏ hồng) |
| | `P3_RING` | `#4ADE80` | Vòng định danh Người chơi 3 (Xanh lá) |
| | `P4_RING` | `#FBBF24` | Vòng định danh Người chơi 4 (Vàng) |

### 2.1 Bảng Màu Môi Trường Trầm (`ENV` Palette — v0.2.0)
Giá trị xuất phát, được tinh chỉnh theo ảnh chụp thật trong Visual Gate. L\* sàn ~30–32 (B2 ~44) để viền `INK_DARK` (L\* ≈ 5) không chìm vào nền. Quan hệ so với sàn: `seam` −7, `var` +3.5, `wallTop` +15, `wallFront` −10 ΔL\*.

| Khu vực / Biome | `floor` | `seam` | `var` | `wallTop` | `wallFront` | Điểm nhấn / Ghi chú |
|---|---|---|---|---|---|---|
| **Hub (Khu Đá Cổ)** | `#414B61` | `#343B4C` | `#47546C` | `#64708B` | `#2D3547` | Shadow `#151A24`, lửa chậu ven tường `#F59E42` |
| **B1 Rừng Cổ Mục Nát** | `#3D4F47` | `#303E38` | `#43584E` | `#627468` | `#2B3731` | Rêu tối, rễ cây cổ thụ bò tràn mép tường |
| **B2 Hầm Băng Vĩnh Cửu** | `#446E78` | `#3B5C64` | `#4A7881` | `#6F949E` | `#345462` | Rim băng `#CFE8EE`, vòng Astrolabe chìm |
| **B3 Lò Rèn Dung Nham** | `#53433F` | `#413431` | `#5D4B44` | `#7F6559` | `#3B2D29` | Rãnh nhiệt có nắp lưới sắt, ánh dung nham lộ qua khe (`ADD`) |

---

## 3. Tỉ Lệ Nhân Vật, Độ Dày Nét Outline & Quy Tắc Shading

### 3.1 Tỉ lệ Chibi & Kích thước Thế giới
- **1 Tile chuẩn:** `32 × 32` đơn vị thế giới.
- **Nhân vật người chơi:** Rộng `~32` đơn vị, cao `~40` đơn vị:
  - **Đầu & Mũ/Tóc:** Chiếm **~40% chiều cao** (`16–18` đơn vị), bo tròn rõ nét để dễ nhận diện từ góc nhìn top-down.
  - **Thân & Áo giáp/Áo choàng:** Chiếm **~38% chiều cao** (`14–15` đơn vị), hơi nở phần vai.
  - **Chân:** Chiếm **~22% chiều cao** (`8–9` đơn vị), bước ngắn dứt khoát.
- **Quái thường:** `24 × 28` đến `48 × 48` đơn vị (Elite phóng đại `×1.25` kèm viền phát sáng).
- **Boss:** `96 × 96` đến `160 × 160` đơn vị.

### 3.2 Độ dày nét Outline (World Units)
- **Nhân vật, Quái thường, Vũ khí, Vật phẩm:** `2.5` đơn vị thế giới (màu `INK_DARK` `#141019`, bo đầu nét `lineCap = 'round'`, `lineJoin = 'round'`).
- **Boss & Công trình lớn:** `3.5` đơn vị thế giới (màu `INK_DEEP` `#0B090E`).
- **Chi tiết nội bộ (vết khâu, khe mũ, mắt, hoa văn giáp):** `1.5` đơn vị thế giới.

### 3.3 Quy tắc Ánh sáng, Shading 2 Lớp (Cutout 2.0) & Full-Screen Clear Visibility
- **Hướng sáng toàn cục cố định:** Một key light từ **Trên – Trái (Top-Left)**. Quy ước: `-135°` luôn chỉ **vị trí nguồn sáng** (tọa độ màn hình, y hướng xuống). Rim-light nằm ở mép trên-trái; mọi bóng đổ bake (tường, cột, trụ, decor) đổ về **Dưới – Phải (+45°, Đông–Nam)**, đồng bộ giữa Nhân vật, Quái, Tường 3D, cột/bệ đá và luồng sáng môi trường. Chậu lửa/đuốc/cổng chỉ tạo vũng sáng, **không tạo bóng đổ**.
- **Tô bóng Nhân vật & Quái (Cutout 2.0 — `cutout-rig.ts` & `rig-defs-*.ts`):**
  1. **Lớp Outline ngoài:** Stroke `INK_DARK` dày `2.5` đơn vị (`3.5` cho Boss), bo tròn đầu nét.
  2. **Lớp Base Fill + Soft Gradient:** Tô màu chính từ `PALETTE` kết hợp chuyển sắc mềm nhẹ từ trên-trái xuống dưới-phải.
  3. **Lớp Cel-Shade (Bóng khối):** Vẽ vùng bán nguyệt/vát ở góc **Dưới – Phải** bằng màu tối hơn trong cùng dải màu (hoặc phủ `INK_DARK` với `alpha = 0.24`).
  4. **Lớp Highlight Vật Liệu & Rim Light (`-135°`):** Kim loại có vệt phản quang sắc nét (`SILVER_BRIGHT`), vải/da chuyển sáng êm, pha lê/năng lượng có lõi phát sáng; mép **Trên – Trái** của đầu/vai/giáp luôn có viền rim light mảnh (`alpha = 0.45`) để tách bạch silhouette nhân vật khỏi sàn.
- **Ánh sáng Thế giới Trong Trẻo Không Sương Mù (`lighting-pipeline.ts`):**
  - `brushSprite` bắt buộc đặt `BlendMode.ADD` để các nguồn sáng giao nhau cộng hưởng tự nhiên, không bao giờ ghi đè gây ám màu.
  - **Sáng rõ toàn màn hình nhưng còn dư địa cho ánh sáng:** Nền `lightmapRt` dùng `ambientColor` `~0.84–0.90` trung bình kênh (điểm xuất phát B1 `0xD9E3DD`, B2 `0xD2E0E8`, B3 `0xEBDBD1`, Hub `0xD6DCE8`, giữ ≥ 86% L\* sàn ENV). Vũng sáng ấm của chậu lửa được vẽ thêm bằng sprite `fx_light_radial` blend `ADD` ở depth phía trên lightmap (alpha `0.10–0.18`, `#F59E42`). Tuyệt đối **không** dùng vòng tròn giới hạn tầm nhìn quanh người chơi (`mainPlayerVisionRadius`, `allyVisionRadius`) để làm tối phần còn lại của phòng, và **tắt hẳn vignette đen ở góc màn hình theo mặc định (`vignetteStrength = 0.0`)** (chỉ bật nhịp tim đỏ `lowHpPulse` khi `HP <= 2`).
  - **Bão tuyết Boss 2 (`blizzardVeil`, phase 3 Kryssa):** là dấu hiệu của cơ chế boss nên được giữ, nhưng **không làm tối**: tuyết dày ×3 thổi xiên theo gió, color grade lạnh nhẹ (L\* trung bình giảm ≤ 5%), viền sương giá mỏng ở mép màn hình (alpha ≤ 0.12, màu `#CFE8EE`, không đen), kèm banner + SFX lúc kích hoạt.
  - **Không sương mù (`fx_ambient_mist`):** Loại bỏ hoàn toàn các đám mây mờ kích thước lớn trôi ngang màn hình; chỉ sử dụng các hạt môi trường nhỏ, sắc nét, trong trẻo (đom đóm/lá nhỏ ở B1, bông tuyết tròn 2–4px ở B2, tàn lửa embers ở B3, hạt bụi sáng li ti trong vũng sáng đuốc).

---

## 4. Cấu Trúc Cutout Rig 2.0 & Đường Cong Animation

### 4.1 Thứ tự lớp (Z-Order) trong `CutoutRig`
Mỗi thực thể nhân vật/quái (ở mức đồ họa High/Medium, quái dùng **full rig** thay vì `fastComposite`) gồm các bộ phận độc lập được bake thành texture riêng và lắp ráp theo thứ tự từ dưới lên trên:
1. `playerRing` (Vòng màu định danh P1–P4 mềm dưới chân, chỉ dành cho người chơi)
2. `groundShadow` (Bóng đổ elip mềm có blur nhẹ màu `#0B090E`, `alpha = 0.42`)
3. `backAccessory` (Áo choàng đỏ của Thiết Vệ / Túi tên của Goblin — có **secondary motion dạng spring** trễ pha theo chuyển động)
4. `legLeft` & `legRight` (Hai chân tách rời, pivot đặt tại khớp hông; sinh hạt bụi nhỏ dưới chân khi chạy)
5. `armLeft` (Tay phụ hoặc khiên gắn tay trái, pivot tại vai)
6. `torso` (Thân giáp/áo, pivot tại tâm hông, nghiêng theo `moveDirX`)
7. `head` (Đầu + mũ/tai/mắt, pivot tại cổ; mắt & đầu dõi theo hướng ngắm, **chớp mắt ngẫu nhiên mỗi 3–5s**)
8. `weapon` (Vũ khí **chĩa hẳn về con trỏ chuột** quanh pivot tay cầm, giật lùi có hồi spring khi bắn)
9. `armRight` (Tay cầm vũ khí, pivot tại vai)

### 4.2 Đường cong Easing, Crossfade & Pose Động
- **Crossfade chuyển trạng thái:** Mọi chuyển đổi giữa `idle`, `run`, `attack`, `hurt`, `dash`, `cast`, `downed/revive` đều nội suy mượt trong `0.10–0.15s`, không giật (snap).
- **Idle (Đứng nghỉ):**
  - Nhịp thở chu kỳ `T = 1.6s` (`ω = 2π / 1.6`):
  - `torso.y = baseTorsoY + Math.sin(t * ω) * 1.2`
  - `torso.scaleY = 1 + Math.sin(t * ω) * 0.03`, `torso.scaleX = 1 - Math.sin(t * ω) * 0.02`
  - `head.y = baseHeadY + Math.sin(t * ω - 0.4) * 1.6` (trễ pha 0.4 rad tạo độ mềm tự nhiên)
  - `armLeft/Right.rotation = ±Math.sin(t * ω) * 0.06`
- **Run (Chạy):**
  - Chu kỳ bước chân `T = 0.38s` (`ω = 2π / 0.38`):
  - Hai chân đung đưa ngược pha: `legL.rotation = Math.sin(t * ω) * 0.55`, `legR.rotation = -Math.sin(t * ω) * 0.55`
  - Độ nẩy bước chân (bounce 2 lần mỗi chu kỳ): `bodyBounceY = -Math.abs(Math.sin(t * ω)) * 3.2`
  - Thân nghiêng về hướng chạy: `torso.rotation = moveDirX * 0.14`
  - Squash & Stretch theo nhịp chạm đất: `scaleY = 1 + Math.cos(t * ω * 2) * 0.05`, `scaleX = 1 - Math.cos(t * ω * 2) * 0.04`
- **Pose Chiến Đấu (Attack / Hurt / Dash / Cast):**
  - `attack`: Thân vươn nhẹ theo hướng đòn đánh, tay vũ khí giật recoil rồi hồi bằng spring.
  - `hurt`: Thân giật lùi ngược hướng sát thương + nghiêng đầu + hit-flash trắng ngắn.
  - `dash`: Kéo dãn theo vector lướt (`scaleX/Y`), thân chúi về trước, để lại vệt afterimage.
  - `cast`: Tay phụ giơ cao kèm vòng sáng năng lượng dưới chân.
- **Các hàm Easing chuẩn (`src/art/easing.ts`):**
  - `easeOutBack(x)` cho hiệu ứng bung nảy (spawn, mở rương, giương vũ khí, popup sát thương chí mạng).
  - `easeOutCubic(x)` cho dash, giật lùi (recoil recovery), vòng sóng va chạm.
  - `easeInOutSine(x)` cho chuyển động thở và lơ lửng.

---

## 5. Kiến Trúc Map Chủ Đạo — "Chi Tiết Ven Tường, Tĩnh Lặng Giữa Tâm" & Hiệu Ứng Nguyên Tố

### 5.1 Triết lý bố cục không gian (Hybrid P4 + Style A + Điểm nhấn Biome P1/P2/P3)
1. **Vùng chiến đấu trung tâm (Center Arena — Tĩnh lặng, `distToWall > 2`):**
   - Mặt sàn phẳng mịn liền khối, độ tương phản nội vùng cực thấp (`ΔL* ≤ 6–8`), hoàn toàn **bỏ viền đen từng ô**, bỏ ellipse chữ "C" và bỏ bevel sáng gắt.
   - Mạch gạch mờ dần (`alpha ≤ 0.12`, radial/edge fade-out) khi tiến vào giữa phòng để loại bỏ cảm giác "giấy kẻ ô" và giúp đạn địch (`#E84545`), vòng telegraph cùng nhân vật nổi bật tuyệt đối.
2. **Vùng ven tường (Perimeter — Chi tiết, `distToWall <= 2`):**
   - Dải `1.5–2` ô sát tường sử dụng gạch đá nguyên khối đan xen gạch chia nhỏ (`1×1` và `2×2` theo cụm noise), vết nứt mảnh, sỏi nhỏ và **lưới thoát nước sắt lõm** (khung vuông âm sàn có các thanh song sắt dọc tối màu), đón nhận trực tiếp vũng ánh sáng ấm áp từ các chậu lửa ven tường.
3. **Tường 3D 3 lớp & Đổ bóng sâu (`texture-baker-tiles.ts`):**
   - **Lớp 1 — Top Cap:** Mặt trên tường sáng hơn sàn (`ΔL* +12–18`), có viền ngoài `2–2.5u` và gờ rim-light sắc nét ở cạnh Bắc/Tây (đón key light `-135°`).
   - **Lớp 2 — South Cliff Face:** Mặt đứng của tường cao `cliffH = 12–14u`, tối hơn sàn (`ΔL* −8–12`), có mạch gạch ngang/dọc trầm tĩnh (bỏ hoàn toàn chấm glow lặp lại trên mỗi ô tường).
   - **Lớp 3 — AO Shadow & Cast Shadow:** Bóng đổ mềm `6–8u` (`alpha ~0.35`) dưới chân tường kết hợp bóng đổ chéo về **dưới-phải** (`12–16u`, `alpha ~0.22`) từ góc tường và các trụ cột. Mọi bóng trong phòng cùng một hướng.
4. **Ngân sách mật độ (mỗi phòng):** ≤ 8 decor lớn (tính cả chậu lửa); ≤ 1 decor nhỏ trên 3 ô ven tường; **≥ 40% ô ven tường để trống**; 0 decor nổi trong Center Arena. Mỗi phòng chọn theo seed 2 trong 3 motif ven tường của biome để các phòng không lặp y hệt. Quality Low giữ phần bake tĩnh, tắt animation decor, God-rays, than hồng, bụi sáng; giữ ≤ 2 glow `ADD` chậu lửa trong khung nhìn.
5. **Số chậu lửa theo loại phòng:** start 2 (hai bên cửa vào); combat 4 (góc phòng, có thể bỏ 1 theo seed); rương 2 (hai bên rương); merchant/shrine 2; boss 6–8 bố trí đối xứng; phòng nhỏ ≤ 2.
6. **Ngưỡng đo (`metrics.json`):** sàn ảnh `?lighting=0`: L\* trung bình 28–40 (B2 40–50), `ΔL*` toàn sàn ≤ 14, Center Arena ≤ 8, HSL S ≤ 0.35 (B2 ≤ 0.40), L\* sàn − L\* `INK_DARK` ≥ 22. Ảnh có lighting: 4 góc màn hình (sàn trống cách mọi nguồn sáng ≥ 200u) ≥ 82% L\* của cùng vùng trên ảnh `?lighting=0`, không vùng sàn nào L\* < 15, tâm vũng sáng chậu lửa ≥ `ΔL* +8` so với sàn trống.

### 5.2 Đặc tả hình học cho từng Biome (`apps/client/src/world/biome-architecture.ts`)
Toàn bộ lớp kiến trúc dưới đây được render hoàn toàn ở phía client, giữ nguyên lưới va chạm `32 × 32` tất định của simulation và tuân thủ nguyên tắc "Hình ảnh = ngữ nghĩa gameplay" (mục 1). Các con số là **gợi ý xuất phát**. Mục tiêu thật là bố cục đẹp, nhận ra biome trong 1 giây và không rối; được bỏ hoặc thay chi tiết nếu ảnh chụp cho thấy nó gây rối.
1. **Kiến trúc Phế Tích Chung & Hub (`P4 Dark Storybook Ruin` + `Style A`):**
   - **Bệ đá & Chậu lửa treo (`Hanging Braziers`):** số lượng theo loại phòng (5.1). Bệ trụ đá giật cấp (`stepped stone pedestal` vát 4 cạnh) **đặt trên ô tường/góc tường**, giá đỡ sắt rèn vươn chéo `45°` ra phía trên sàn (vẽ trên nhân vật, không có hitbox) treo chậu lửa/lồng sắt cháy rực (`#F59E42` + lõi `#FFD27A`, hạt than hồng bay lên).
   - **Trụ cột đá rãnh & Bóng đổ dài (`Fluted Columns & Long Cast Shadows`):** cột đá tròn có rãnh hoặc trụ đá gãy **chỉ đặt trên ô `pillar` của sim hoặc dạng nửa cột gắn vào mặt tường**. Mỗi cột đổ một vệt **bóng về dưới-phải dài `40–64u`** (`alpha 0.32 → 0` mờ dần về phía Đông–Nam).
   - **Gờ tường đá vỡ & Hàng rào sắt rèn (`Wrought-Iron Fencing`):** Trên mép tường xen kẽ các đoạn gờ đá cổ bị mẻ với đoạn hàng rào song sắt rèn mũi nhọn (`#241F2E` / highlight `#565E75`) và dây xích treo. Chỉ nằm trên ô tường.
2. **Biome 1 — Rừng Cổ Mục Nát (`P1 Illustrated Organic Diorama`):**
   - **Rễ cây cổ thụ uốn lượn (`Bezier S-Curve Roots`):** Bezier hình chữ S vươn dài `28–56u` từ chân tường và góc phòng. **Phần gốc dày (`10–12u`, viền `INK_DARK` `2.5u`, cel-shade gỗ ấm `#7D4B32` / `#4E2F21`, đốm rêu `#499F54`) nằm trên tường/mặt đứng.** Phần tràn xuống sàn đi được thì thuôn về `2u` và phẳng như decal (không viền INK, không đổ bóng, `ΔL* ≤ 10`).
   - **Cụm nấm phát quang & Dây leo:** Góc tường và chân cột có cụm 3 mũ nấm phát quang (`#84CC16` / `#A7F3D0`, glow nhẹ `alpha ≤ 0.30`) cùng dây leo rủ qua mặt đứng `South Cliff Face`.
   - **Đầm độc tự nhiên & Đá bước chân (`Stepping Stones`):** Các vùng surface độc/nước ở B1 có viền bờ đất/rêu uốn lượn tự nhiên (2 lớp viền đồng tâm) kèm **4–6 phiến đá bước chân hình elip bất đối xứng** (`#627468`, viền `1.5u`) nằm dọc mép đầm, **chỉ trên ô khô ngoài surface** (không gợi ý "lối an toàn" xuyên qua vùng gây sát thương).
3. **Biome 2 — Hầm Băng Vĩnh Cửu (`P2 Floating Abyss Sanctuary`):**
   - **Vòng cổ ngữ băng khắc chìm giữa phòng (`Sunken 3-Ring Ice Astrolabe`):** Chính giữa tâm phòng vẽ decal khắc chìm gồm **3 vòng tròn đồng tâm**, bán kính gợi ý `70u`, `120u`, `165u` (phòng chuẩn 36×22 ô, Center Arena ≈ 960×512). Vòng ngoài ≤ `0.45 × min(rộng, cao)` của Center Arena thực tế, không tràn vào dải ven tường. Chia thành **8 cung bằng các trục mảnh `1.5u`**, lồng **vòng bán nguyệt lệch tâm (`crescent inlay`)** và rune nhỏ tại các giao điểm. Chỉ chênh `ΔL* 5–7` (`alpha 0.16–0.24`) so với sàn `#446E78`: chi tiết **thấy khi để ý, không nổi bật**, và vùng tâm vẫn `ΔL* ≤ 8`.
   - **Tường Đền Băng & Hốc Thác Băng phía Bắc:** Tường Bắc điểm xuyết các hốc vòm đá băng (`arched alcoves`) có dải băng đóng băng đổ dọc xuống và cụm tinh thể pha lê vát cạnh (`#22D3EE` / `#CFFAFE`) kèm bờ tuyết mềm ở góc phòng.
   - **Luồng sáng God-rays:** Phủ 2–3 dải tứ giác ánh sáng song song chiếu xiên từ hướng key light (tường Bắc–Tây) xuống sàn (`rộng 60–100u`, gradient tuyến tính `alpha 0.06 → 0`). Tắt ở Low.
4. **Biome 3 — Lò Rèn Dung Nham (`P3 Octagonal Elemental Conduit`):**
   - **Rãnh nhiệt có nắp lưới sắt ven tường (`Grated Heat Channels`):** **máng đá âm sàn rộng `24–28u`** (gờ bazan vát cạnh `4u` màu `#7F6559` + viền trong `#3B2D29`) dọc dải ven tường và từ lò nhiệt/chậu lửa, **phủ kín bằng lưới sắt rèn** (song sắt `#241F2E`, khe `4–6u`). Ánh dung nham chỉ lộ qua khe lưới (`#F97316` + lõi `#FFD27A`, `ADD`, alpha ≤ 0.35, nhịp thở chậm), nên người chơi đọc ngay là "sàn sắt đi được". Không có cầu, không chạy xuyên Center Arena. Không dùng rãnh dung nham lộ thiên chỉ có ở client.
   - **Dung nham thật (surface `lava` của sim)** dùng bờ rãnh đá vát (5.3). Đây là chỗ duy nhất có dung nham lộ thiên sáng mạnh.
   - **Cơ khí Lò Rèn gắn tường (`Brass Gears & Steam Pipes`):** **Trên mặt tường và ô tường góc phòng** gắn các **bánh răng đồng thau nhiều răng (`8–12 răng`, `#D97706` / `#92400E`) quay chậm** (đứng yên ở Low), đường ống hơi nước có mặt bích tán đinh (`flanged steam pipes`) chạy dọc mặt đứng, xích sắt. Đe rèn chỉ đặt trên ô `pillar`.

### 5.3 Bề mặt Nguyên Tố & Phản Ứng Combo (`texture-baker-surfaces.ts` & `combat-fx.ts`)
- **Bề mặt nguyên tố ăn nhập kiến trúc:** Nước, Dầu, Băng, Dung nham, Đầm độc giảm độ bão hòa nền ~30%, độ tương phản hoa văn bên trong `ΔL* ≤ 10`, có bờ viền/rãnh đá hoặc mép bọt mềm ăn nhập với sàn thay vì mảng màu phẳng cắt vuông.
- **Phản ứng Nguyên Tố & Tia Sáng (`BlendMode.ADD`):** Mọi tia lửa, muzzle flash, đạn sáng, cột sáng độ hiếm (Tím/Cam) và vụ nổ Combo Nguyên Tố (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*) đều vẽ trên lightmap với `BlendMode.ADD`, kèm vòng sóng xung kích (`easeOutCubic`) và chữ combo gộp hiện đại (ví dụ `HƠI NƯỚC ×3` trong cửa sổ `0.4s`).
- **Đạn địch nhận biết bằng hình dạng (bắt buộc):** mọi đạn địch có lõi sáng gần trắng + thân `CRIMSON_BRIGHT` `#E84545` + viền `INK_DARK` `1.5u`, giống nhau ở mọi biome. Không FX/decor/ambient nào (than hồng, tàn lửa, chậu lửa, khe dung nham, pha lê) dùng cùng tổ hợp "lõi trắng + viền tối" ở cỡ 6–14px. Tàn lửa B3 ≤ 4px, không viền, bay lên. Phải phân biệt được cả trên ảnh chuyển xám.

### 5.4 Phòng chuẩn (Golden Room B1 — Khóa tại Phase P4)
Bộ tham chiếu chuẩn đã vượt qua Visual Gate Bước A (Env `9.2/10`, Lighting `9.5/10`, Readability `9.4/10`, Product Feel `9.0/10`) và được khóa tại `docs/screenshots/polish-p4/golden-room/` (`b1-start-room`, `b1-combat`, `b1-combat-low`, `b1-poison-swamp` kèm cặp `-unlit.png`):
- **Bảng màu `ENV_PALETTE` khóa chuẩn (`apps/client/src/art/palette.ts`):**
  - **Hub (`0`):** `floor: '#414B61'`, `seam: '#343B4C'`, `var: '#47546C'`, `wallTop: '#64708B'`, `wallFront: '#2D3547'`, `shadow: '#151A24'`, `rim: '#8B97B5'`, `accent: '#F59E42'`
  - **Biome 1 (`1`):** `floor: '#3D4F47'`, `seam: '#303E38'`, `var: '#43584E'`, `wallTop: '#627468'`, `wallFront: '#2B3731'`, `shadow: '#16201C'`, `rim: '#9C9286'`, `accent: '#84CC16'`
  - **Biome 2 (`2`):** `floor: '#446E78'`, `seam: '#3B5C64'`, `var: '#4A7881'`, `wallTop: '#6F949E'`, `wallFront: '#345462'`, `shadow: '#182A33'`, `rim: '#CFE8EE'`, `accent: '#22D3EE'`
  - **Biome 3 (`3`):** `floor: '#53433F'`, `seam: '#413431'`, `var: '#5D4B44'`, `wallTop: '#7F6559'`, `wallFront: '#3B2D29'`, `shadow: '#1F1614'`, `rim: '#FDBA74'`, `accent: '#F97316'`
- **Sàn 2 vùng theo `distToWall` (Chebyshev distance tới ô `wall`/`pillar`/`cracked_wall` gần nhất):**
  - **Perimeter (`distToWall <= 2`, variants `0..3`):** `distToWall === 1` đan xen gạch đá `1×1` (`variant 0`, mạch `ENV.seam` `1u` ở `alpha = 0.45`), gạch chia `2×2` (`variant 1`, `ENV.var` `alpha = 0.42`), và **lưới thoát nước sắt lõm** (`variant 2`, khung âm `[8,8,16,16]` `ENV.seam` `alpha = 0.52` + 4 thanh sắt dọc `ENV.wallFront` `alpha = 0.48`); `distToWall === 2` dùng gạch chuyển tiếp (`variant 3`, mạch `ENV.seam` `alpha = 0.20`).
  - **Center Arena (`distToWall > 2`, variants `4..7`):** Sàn nguyên khối phẳng mịn (mạch `ENV.seam` cực mờ `alpha = 0.06`, biến thiên cụm 3–4 ô bằng `ENV.var` ở `alpha = 0.00 / 0.20 / 0.40 / 0.60`), đạt `centerDeltaL ≈ 2.42 <= 8.0` và `floorDeltaL ≈ 2.42 <= 14.0`.
- **Tường 3D 3 lớp & Đổ bóng hướng `-135°` (`texture-baker-tiles.ts`):**
  - `Top Cap` (`y = 0..20` khi `!hasS`, màu `ENV.wallTop`, `+15 ΔL*` so với sàn), gờ rim-light `ENV.rim` dày `1.8u` ở cạnh Bắc/Tây (`-135°`), và viền ngoài `INK_DARK` dày `2.2u` chỉ vẽ trên rìa tiếp giáp sàn.
  - `South Cliff Face` cao `cliffH = 12u` (`y = 20..32`, màu `ENV.wallFront`, `−10 ΔL*` so với sàn) có bóng gờ trên `2u` (`ENV.shadow`) và 2 hàng mạch đá ngang/dọc so le.
  - Bóng tiếp xúc `7u` (`alpha = 0.35 → 0`) dưới tường Bắc/Tây + bóng đổ chéo Đông–Nam `14u` (`alpha = 0.22 → 0`) ở góc tường và bóng đổ dài `44u` (`alpha = 0.22 → 0`) từ cột trụ `2×2`.
- **Surface Kiến trúc (`texture-baker-surfaces.ts`):**
  - Nhóm hữu cơ `P1` (`water`, `electrified_water`, `poison_swamp`, `grass`, `burning_grass`, `ice`): bo tròn góc ngoài lộ thiên `r = 9u` để lộ nền `ENV.floor`, kèm bờ cong 2 lớp đồng tâm (`outerBank` `3.2u` + `innerLip` `1.6u`).
  - Nhóm dẫn nhiệt/cơ khí `P3` (`lava`, `oil`, `burning_oil`, `conveyor`, `chasm`, `ash`): gờ đá bazan vát cạnh rộng `4u` (`#7F6559` mặt trên `2.4u` + `#3B2D29` thành trong `1.6u` + viền ngoài `INK_DARK` `1.4u`).
- **Ngân sách mật độ Decor Phòng chuẩn B1 (`biome-architecture.ts`):**
  - Vật thể có khối (`hasVolume = true`: `brazier_pedestal`, `root_base`, `mushroom_cluster`, `cliff_vines`) chỉ đặt trên ô `wall`/`pillar`; decal sàn (`hasVolume = false`: `root_decal_tip` rộng `2u`, `stepping_stone` elip bất đối xứng trên ô sàn khô sát mép nước/đầm độc) không viền `INK_DARK`, tự động ẩn khi ô bị phủ bởi surface động. Đảm bảo `largeDecorCount <= 8`, `smallPerimeterDecorCount <= floor(perimeterTileCount / 3)`, `emptyPerimeterRatio >= 0.40`, `centerArenaSolidDecorCount = 0`.

---

## 6. Typography & Chuỗi Kiểm Chứng Tiếng Việt
- **Font chính:** `Be Vietnam Pro` (Regular 400, SemiBold 600, ExtraBold 800) đóng gói `.woff2` local.
- **Chuỗi kiểm chứng bắt buộc:**
  `"Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ"`
- Toàn bộ chữ lớn trên HUD/Banner đều có stroke viền `#141019` dày `3px` và đổ bóng lệch `(0, 2)` để đọc rõ trên mọi nền sáng/tối.
- **Không cắt dấu:** line-height ≥ 1.3 và padding trên đủ cho dấu chồng (`Ở`, `Ữ`, `Ặ`); chữ nhỏ nhất trên HUD là 13px tại 1080p.
- **Độ nét UI:** text/icon trong `HudScene` (scene overlay tạo ở P3 của Polish v0.2.0) render theo `devicePixelRatio × UI scale`, vì không được zoom theo camera thế giới.
- **Màu panel UI** lấy từ nhóm `ENV` (nền gần `#2D3547`, viền gần `#64708B`, alpha 0.72–0.85) để HUD cùng tông với map.

---

## 7. Ngôn Ngữ Thị Giác Ashen Pact 2.0 (Tactical Props, Cadence Micro-Bar, Duo Boons & Engine 2.6)

Toàn bộ các bất biến của **Golden Room `v0.2.0`** tại Mục 1–6 tiếp tục giữ nguyên hiệu lực 100%. Phiên bản **Ashen Pact 2.0** bổ sung lớp ngôn ngữ thị giác cho hệ thống vật lý địa hình chiến thuật, nhịp súng chủ động `[R]` và giao diện Build chiều sâu:

### 7.1 Bia Chắn Chiến Thuật 3 Trạng Thái, Vực Sâu `Chasm` 3 Lớp & 9 Đồ Chơi Biome (`texture-baker-props.ts`)
1. **Bia Chắn Chiến Thuật 3 Trạng Thái (`moss_table`, `glacial_barricade`, `forge_blast_shield`):**
   - **Trạng thái `'low'` (Nằm phẳng — đi & bắn xuyên qua được):** Giảm tương phản nhẹ, bóng đổ sát sàn (`2–3u`), chưa có gờ chắn sáng phía trước để người chơi đọc ngay là chưa dựng công sự.
   - **Trạng thái `'flipped'` (Đã dựng bằng `[E]` — chặn đạn & chặn di chuyển):** Dựng khối 2.5D rõ nét với mặt đứng tối (`South Face`), **gờ chắn sáng phía trước (`Protective Front Rim` đón key light `-135°`)** và viền `INK_DARK` `2.5u`. Khoảnh khắc lật phát vòng sóng trắng-lam **`Micro-Blank` (`r = 56px`, `0.15s`, `BlendMode.ADD`)** quét tan đạn địch trong tầm; nếu có `table_tech_prism_split`, bia chắn phủ thêm hào quang lăng kính xanh ngọc (`#34D399`).
   - **Trạng thái `'sliding'` (`Dash-Kick` ở `520 px/s`):** Nghiêng nhẹ theo vector vận tốc, kéo theo vệt gió/bụi trượt (`motion wake`) phía sau và nổ vệt nứt chấn động + tia sáng va đập khi kích hoạt **`Wall-Slam`**.
2. **Chiều Sâu Vực Thẳm `Chasm` 3 Lớp & Cầu Đôi Chữ Y (`TWIN_BRIDGES`):**
   - Ô `chasm` ở cả 3 Biome được bake 3 lớp chiều sâu: **(1)** Gờ mép đá/băng/bazan vát cạnh trên cùng, **(2)** Vách đá dựng đứng tối dần theo chiều sâu (`cliff wall`), và **(3)** Đáy vực tối sâu `INK_DEEP` (`#0B090E`) điểm ánh rễ phát quang mờ (B1), sương băng lạnh (B2) hoặc hơi nhiệt đỏ sẫm (B3) ở độ bão hòa thấp để phân biệt tức thì vùng rơi **`Chasm Ring-Out`** với sàn đi được.
   - Bố cục `TWIN_BRIDGES` nối liền sảnh cửa Bắc/Nam bằng nhánh vực chữ Y và 2 mặt cầu 3 ô có gờ lan can đá đứt đoạn, dẫn hướng thị giác rõ ràng qua 2 nút thắt chiến thuật.
3. **Silhouette Nhận Diện Tức Thì Của 9 Đồ Chơi Địa Hình:**
   - **Biome 1:** `moss_table` (bàn phiến đá phủ rêu xanh `#499F54`), `volatile_spore_pod` (nang tròn căng phồng tím-lục `#9333EA` / `#84CC16` nhịp thở), `rotten_totem_pillar` (cột đá khắc totem có vết nứt mục ở chân, khi đổ sập để lại thân cột nằm ngang `160×56px`).
   - **Biome 2:** `glacial_barricade` (phiến băng vát cạnh `#6F949E` / rim `#CFE8EE`, vỡ mọc 3 cọc `glacial_spike`), `sliding_ice_block` (khối băng vuông bo góc phản quang chéo `#CFFAFE`), `cryo_prism_pillar` (trụ pha lê lục giác phát sáng `#22D3EE` khúc xạ tia đạn thành 3 chùm quạt).
   - **Biome 3:** `forge_blast_shield` (khiên thép tán đinh viền đồng `#D97706`, chuyển sang rực cam `#F97316` khi hấp thụ lửa thành Siêu Nhiệt), `pneumatic_press` (khung búa máy cơ khí với vòng cảm biến sàn cảnh báo `0.35s` trước khi dập), `slag_crucible` (nồi gang chứa xỉ nóng chảy `#F97316` / `#FDE047`, đổ tràn thảm dung nham `192px`).

### 7.2 Thanh Nhịp Vũ Khí Dưới Chân Nhân Vật — `Cadence Micro-Bar` (`32×5px`)
Loại bỏ hoàn toàn thanh Energy cũ trên HUD, thay bằng **`Micro-Bar` kích thước `32 × 5px`** (viền `INK_DARK` `1px` sắc nét) neo gọn ngay dưới vòng chân nhân vật để người chơi không bao giờ phải rời mắt khỏi tâm giao tranh:
- **`CLIP_RELOAD` (Khi đang nạp đạn):** Nền xám đá `#241F2E`, đánh dấu rõ **Khung Vàng (`45% – 70%`, màu `SOLAR_GOLD` `#FACC15`)** (tự động giãn rộng trực quan khi có `dash_reload_acrobat`, `mutator_thermal_meltdown` hoặc `relic_perpetual_core`) cùng vạch chạy trắng ngà `#F4F1EA`. Bấm `[R]` trúng Khung Vàng lóe tia sáng vàng kim + chữ nổi gọn và phủ hào quang `Overclocked` cho phát bắn đầu.
- **`HEAT_VENT` (Khi tích nhiệt > 0%):** Chuyển màu mượt từ lam mát (`0%–64%`) sang **Vùng Nhiệt Cam (`65% – 95%`, màu `FLAME_ORANGE` `#F97316`)** và nháy đỏ `CRIMSON_BRIGHT` (`#E84545`) khi khóa quá nhiệt `100%`. Bấm `[R]` trong Vùng Cam bung vòng khói hơi nước trắng-cam xả áp quanh chân.
- **`MELEE_COMBO` (Vũ khí cận chiến):** **Ẩn hoàn toàn `Micro-Bar`** để giữ sàn đấu thoáng sạch; nhịp combo được truyền tải trực tiếp qua vệt chém 3 bước và **ánh chớp trắng-vàng `Parry Deflect` (`0.18s`)** trên lưỡi vũ khí ở Đòn thứ 3.

### 7.3 Thẻ Kim Cương Đôi `Duo Boon`, Modal Khế Ước / Đe Rèn & HUD Tương Tác Mới (`HudScene`)
1. **Thẻ Phước Lành Giao Thoa — `Prismatic Double-Diamond` (*Kim Cương Đôi Cầu Vồng*):**
   - Khung thẻ thứ 3 khi xuất hiện `Duo Boon` mang viền chuyển sắc kép theo cặp màu `primaryColor` / `secondaryColor` của 2 nguyên tố thành phần, đỉnh thẻ gắn biểu tượng **Kim Cương Đôi Lồng Nhau** phát sáng nhẹ kèm **2 Huy Hiệu Nguyên Tố (`Dual Element Badges`)** rõ nét.
2. **Modal Tế Đàn Khế Ước & Banner Di Vật Thức Tỉnh:**
   - **Tế Đàn Khế Ước Tro Tàn (`shrine` Tầng Lẻ):** Khung modal tông đỏ thẫm / tro tàn (`RUBY_DARK` `#6E1423` + viền `CRIMSON_BRIGHT`), chia rõ 2 nửa trên mỗi thẻ: **Lời Nguyền Suốt Biome** (chữ đỏ cam cảnh báo) và **Di Vật Thức Tỉnh Sau Boss** (chữ vàng kim), kèm nút từ chối an toàn.
   - **Banner Thức Tỉnh Di Vật (Ngay khi hạ Boss Tầng Chẵn):** Dải banner hoàng kim (`SOLAR_GOLD` `#FACC15` trên nền `#141019`) trượt mượt trên `HudScene` vinh danh sự kiện xóa bỏ lời nguyền và nhận Di Vật vĩnh viễn.
3. **Modal Đe Rèn Cổ Đại, Vòng Tiến Trình Phân Rã `[X] 0.5s` & HUD Đấu Trường Bí Mật `20.0s`:**
   - **Xưởng Rèn Kho Báu:** Tầng lẻ mở bảng chọn 1 trong các **Bản Độ Daedalus (`daedalus_anvil`, ánh cam lò rèn `#F97316`)** tương thích với vũ khí đang cầm; Tầng chẵn kích hoạt **Đe Cường Hóa (`upgrade_anvil`, ánh lam `#38BDF8`)** nâng cấp `+1` bậc tinh luyện (`+20% Base DMG`).
   - **Chỉ Báo Phân Rã Vũ Khí (`[X] 0.50s`):** Khi giữ `[X]` cạnh vũ khí rơi ngoài giao tranh, hiển thị vòng tròn/thanh tiến trình vàng kim `0.50s` ngay trên vật phẩm kèm số Vàng sẽ nhận được; nhả phím sớm hủy mượt mà không mất súng.
   - **Đồng Hồ Đấu Trường Kỹ Năng Bí Mật (`20.0s`):** Hiển thị hộp đếm ngược `20.0s` sắc nét ở đỉnh `HudScene` kèm số quái thử thách còn lại (chuyển sang nhịp cam/đỏ ở `5.0s` cuối) và thanh phụ **`bossStaggerAccum`** màu vàng hổ phách ngay dưới thanh máu Boss chính.

### 7.4 Chuẩn Kiểm Chứng Dải Hoạt Ảnh Engine 2.6 (`HARD_ASSERT` Contact Sheets)
Mọi hiệu ứng thị giác và chuyển động vật lý mới của Ashen Pact 2.0 đều bắt buộc xuất ra dải ảnh `8` hoặc `12` khung hình (`tools/visual-strip-renderer.ts`) và vượt qua 5 cổng định lượng `HARD_ASSERT` (`tools/visual-animation-gates.ts`): nhân vật và vật thể tương tác nằm gọn `>= 85%` trong vùng ROI, `0` chồng lấn nhãn chữ cảnh báo phi-số (`ĐẬP TƯỜNG!`, `RING-OUT!`, `PHÁ GIÁP!`, `NẠP CHUẨN!`), không đóng băng frame trong pha hành động và khớp chính xác tick đỉnh điểm `Hero Frame`.
