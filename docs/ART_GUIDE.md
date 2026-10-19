# STYLE GUIDE ĐỒ HỌA PROCEDURAL (ART_GUIDE.md) — ASHEN PACT

## 1. Triết Lý & Quy Tắc Cốt Lõi
- **100% Procedural Vector Art:** Toàn bộ nhân vật, quái, boss, vũ khí, đạn, tilemap, vật thể tương tác và biểu tượng UI đều được sinh bằng code thông qua thư viện `apps/client/src/art/`.
- **Ngoại lệ duy nhất:** File font vector `Be Vietnam Pro` (giấy phép SIL Open Font License 1.1) đóng gói local trong `apps/client/public/fonts/`.
- **Độ sắc nét theo DPR:** Mọi hình vẽ đều được bake ra texture ở độ phân giải `worldSize * cameraZoom * devicePixelRatio` (kẹp trong khoảng `2.0x – 4.0x` supersampling khi tạo canvas offscreen) để không bao giờ bị răng cưa hay mờ nhòe ở 1080p và 1440p.

---

## 2. Bảng Màu Cố Định (Master Palette — 42 Màu)
Toàn bộ màu sắc bề mặt vật thể bắt buộc lấy từ `PALETTE` trong `apps/client/src/art/palette.ts` (ngoại trừ ánh sáng additive/glow):

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
| | `GOBLIN_GREEN` | `#3B8EA5` → `#499F54` | Màu chủ đạo da Goblin & Mộc Linh |
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

### 3.3 Quy tắc Ánh sáng & 3 Lớp Tô (Pipeline `outlined()`)
- **Hướng sáng toàn cục cố định:** Từ **Trên – Trái (Top-Left, góc -135°)** chiếu xuống **Dưới – Phải (Bottom-Right)**.
- Mọi hình khối đi qua hàm `outlined(ctx, shapeDef)` đều được vẽ tuần tự 4 bước:
  1. **Lớp Outline ngoài:** Vẽ mở rộng hoặc stroke `INK_DARK` dày `2.5` đơn vị.
  2. **Lớp Base Fill:** Tô phẳng màu chính từ `PALETTE`.
  3. **Lớp Cel-Shade (Bóng khối):** Vẽ vùng bán nguyệt/vát ở góc **Dưới – Phải** bằng màu tối hơn trong cùng dải màu (hoặc phủ `INK_DARK` với `alpha = 0.24`).
  4. **Lớp Rim Light / Highlight:** Vẽ vệt cong mảnh hoặc đốm sáng ở góc **Trên – Trái** bằng màu sáng hơn (hoặc `BONE_WHITE` với `alpha = 0.45`).

---

## 4. Cấu Trúc Cutout Rig & Đường Cong Animation

### 4.1 Thứ tự lớp (Z-Order) trong `CutoutRig`
Mỗi thực thể nhân vật/quái gồm các bộ phận độc lập được bake thành texture riêng và lắp ráp theo thứ tự từ dưới lên trên:
1. `playerRing` (Vòng màu định danh P1–P4 dưới chân, chỉ dành cho người chơi)
2. `groundShadow` (Bóng đổ elip mềm màu `#0B090E`, `alpha = 0.42`)
3. `backAccessory` (Áo choàng đỏ của Thiết Vệ / Túi tên của Goblin)
4. `legLeft` & `legRight` (Hai chân tách rời, pivot đặt tại khớp hông)
5. `armLeft` (Tay phụ hoặc khiên gắn tay trái, pivot tại vai)
6. `torso` (Thân giáp/áo, pivot tại tâm hông)
7. `head` (Đầu + mũ/tai/mắt, pivot tại cổ; mắt dịch chuyển nhẹ theo góc ngắm)
8. `weapon` (Vũ khí xoay theo góc ngắm và giật lùi khi bắn)
9. `armRight` (Tay cầm vũ khí, pivot tại vai)

### 4.2 Đường cong Easing & Tham số Animation
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
- **Các hàm Easing chuẩn (`src/art/easing.ts`):**
  - `easeOutBack(x)` cho hiệu ứng bung nảy (spawn, mở rương, giương vũ khí).
  - `easeOutCubic(x)` cho dash, giật lùi (recoil recovery).
  - `easeInOutSine(x)` cho chuyển động thở và lơ lửng.

---

## 5. Typography & Chuỗi Kiểm Chứng Tiếng Việt
- **Font chính:** `Be Vietnam Pro` (Regular 400, SemiBold 600, ExtraBold 800) đóng gói `.woff2` local.
- **Chuỗi kiểm chứng bắt buộc:**
  `"Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ"`
- Toàn bộ chữ lớn trên HUD/Banner đều có stroke viền `#141019` dày `3px` và đổ bóng lệch `(0, 2)` để đọc rõ trên mọi nền sáng/tối.
