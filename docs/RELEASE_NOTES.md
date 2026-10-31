# 📜 GHI CHÚ PHÁT HÀNH (RELEASE NOTES) — ASHEN PACT

---

## 🔥 What's New in Ashen Pact `v2.0.0` — *"Tactical Arena Overhaul"*

- **Phiên bản đại tu kiến trúc & lối chơi:** `v2.0.0` (*"Tactical Arena Overhaul" — Complete Combat Cadence, Tactical Environment Physics, Bespoke Arsenal, Per-Player Synergy Depth & 60Hz Deterministic Architecture Overhaul*, `Phases P0A → P5`)
- **Nền tảng phát hành:** Windows 10/11 64-bit *(gói phát hành ổn định hiện hành `AshenPact-v0.2.1-win-x64` — chuẩn bị nâng phiên bản đóng gói đồng bộ sang `v2.0.0`)* & Web Browser (Chromium / Chrome / Edge / Firefox)
- **Chế độ chơi:** Chơi đơn (*Solo*) & Phối hợp mạng nội bộ (*Co-op LAN / Wi-Fi 2–4 người chơi*, `60Hz Authoritative WorldSim`)

Bản đại tu **`Ashen Pact v2.0.0` ("Tactical Arena Overhaul")** tái thiết toàn diện vòng lặp chiến đấu 3 giây, vật lý địa hình đấu trường, kho vũ khí độc bản, chiều sâu build riêng từng người chơi và kiến trúc mạng tất định 60Hz qua **7 giai đoạn kỹ thuật (`P0A → P5`)**:

### 1. Vòng Lặp Chiến Đấu Cốt Lõi Mới — Tam Giác Chiến Thuật 3 Giây & `Zero Energy`
- **Xóa bỏ hoàn toàn thanh Năng Lượng (`100% Zero Energy`):** Vũ khí không còn tiêu hao năng lượng khi bắn; kỹ năng chủ động `[Q / Chuột Phải]` của cả 5 nhân vật vận hành thuần túy theo **Hồi Chiêu (`Cooldown`)**, giải phóng người chơi khỏi tình trạng cạn mana đứng chờ giữa giao tranh.
- **Khởi đầu 1 Vũ Khí Trấn Phái & `Holster Auto-Reload` (`2.0s`):** Mỗi nhân vật xuất trận với duy nhất **1 vũ khí trấn phái ở Ô 1** (Ô 2 để trống sẵn sàng nhặt vũ khí mới; xóa vĩnh viễn khẩu `rusty_pistol` thừa và 5 vũ khí bản sao cũ). Cất vũ khí `CLIP_RELOAD` vào ô phụ đủ **`2.0s`** sẽ tự động nạp đầy băng đạn (`Holster Auto-Reload`), còn vũ khí `HEAT_VENT` tự nguội ngầm khi cất đi.
- **3 Họ Nhịp Vũ Khí Chủ Động (`Active Weapon Cadences`) & Thanh `Micro-Bar` `32×5px` dưới chân:**
  - **`CLIP_RELOAD` (9 vũ khí):** Phát đạn cuối băng kích hoạt **`Finale Shot`** cường hóa; bấm **`[R]`** đúng **Khung Vàng (`45%–70%`)** để **`Perfect Reload`** (nạp tức thì + buff đòn kế tiếp; bấm sai khung bị kẹt cò `Jam 0.35s`).
  - **`HEAT_VENT` (5 vũ khí):** Duy trì nhiệt trong **Vùng Cam (`65%–95%`)** để nhận sát thương/tốc bắn cộng thêm; bấm **`[R]`** trong Vùng Cam để **`Tactical Vent`** xả xung nhiệt chiến thuật ra xung quanh thay vì để quá nhiệt `100%` (`Overheat Lockout`).
  - **`MELEE_COMBO` (4 vũ khí):** Chuỗi chém nhịp 3 đòn với **Đòn Kết Liễu thứ 3 (`3rd-Hit Finisher`)** diện rộng và cửa sổ **`Parry Deflect` (`0.18s` đầu đòn vung)** phản xạ ngược đạn địch thành đạn đồng minh gây sát thương cường hóa (ẩn sạch `Micro-Bar` dưới chân khi cầm cận chiến).

### 2. Vật Lý Đấu Trường Chiến Thuật, 6 Archetype Phòng, 3 Quy Luật Biome & 9 Đồ Chơi Địa Hình
- **Lật Bia Chắn & Sút Trượt Đấu Trường (`Flip Cover & Dash-Kick`):**
  - **`Flip Cover [E]`:** Dựng bia chắn từ trạng thái `'low'` sang `'flipped'`, phát xung **`Micro-Blank` (`r = 56px`, `0.15s`)** quét sạch đạn địch lân cận và tạo lá chắn che đạn thật (`60 / 65 / 85 HP` theo Biome).
  - **`Dash-Kick [Shift]`:** Lướt thẳng vào bia chắn đã lật hoặc đồ chơi địa hình để sút trượt (`'sliding'`) ở vận tốc **`520–600 px/s`**, hất văng quái trên đường bay, gây **`Wall-Slam`** (sát thương va đập + làm choáng khi ép quái vào tường/trụ) hoặc phá vỡ tường nứt `cracked_wall`.
  - **`Chasm Ring-Out`:** Đẩy hoặc sút quái thường không bay rơi xuống vực sâu **`chasm`** để tiêu diệt tức thì (vật phẩm/vàng rơi ra tự động bay về ô sàn an toàn gần nhất, không bao giờ mất loot).
- **6 Archetype Phòng Chiến Đấu Chiến Thuật:** `TWIN_BRIDGES` (cầu đôi nhánh chữ Y bắc qua vực thẳm `chasm`), `GAUNTLET_CHOKEPOINT`, `CENTRAL_BASTION`, `CROSSFIRE_CONVEYORS`, `PRISM_LABYRINTH` và `CRUMBLING_PILLAR_RING`.
- **3 Quy Luật Biome & 9 Đồ Chơi Địa Hình Tương Tác (`Biome Toys`):**
  - **Biome 1 (*Rừng Cổ Mục Nát*):** `moss_table`, `volatile_spore_pod` (bào tử nổ dây chuyền khi trúng đạn/va chạm), `rotten_totem_pillar`.
  - **Biome 2 (*Hầm Băng Vĩnh Cửu*):** `glacial_barricade`, `sliding_ice_block` (`600 px/s`), `cryo_prism_pillar` (**Lăng Kính Băng** khúc xạ tia/đạn người chơi thành **3 tia** với **`+20%` sát thương**).
  - **Biome 3 (*Lò Rèn Dung Nham*):** `forge_blast_shield` (hấp thụ đạn lửa để hóa khiên **Superheated** rực đỏ trước khi sút trượt), `pneumatic_press`, `slag_crucible`.

### 3. 18 Vũ Khí Độc Bản, 5 Nhân Vật Cooldown & Giao Thoa Đồng Đội `Elemental Convergence`
- **Tinh lọc còn 18 Vũ Khí Độc Bản (`5 Common Starters`, `3 Uncommon`, `4 Rare`, `3 Epic`, `3 Legendary`):** Loại bỏ hoàn toàn 6 vũ khí trùng lặp cơ chế, nâng cấp từng vũ khí thành một lối chơi riêng biệt — từ `hunter_crossbow` (*Giữ-Thả xuyên tâm + `[R]` Giật Gai Barbed Rip*), `frag_launcher` (*Giữ-Thả kích nổ trên không Airburst*), `void_staff` (*Hút đạn địch + Giữ-Thả Hố Đen Implosion*), 4 vũ khí cận chiến (`knight_sword`, `emerald_cleaver`, `berserker_axe`, `thunder_hammer`) có `Parry Deflect`, tới `solar_archon_staff` (*Tia hội tụ mặt trời + `[R]` Siêu Tân Tinh Supernova*) và `magma_cannon` (*Tảng dung nham lăn + Finale phun trào*).
- **5 Nhân Vật Cân Bằng Lại Theo HP/Giáp & Cooldown:** Thiết Vệ (`6 HP / 5 Giáp`, CD `9s`, trễ hồi giáp `3.0s`), Liệp Ưng (`5 HP / 3 Giáp`, CD `7s`), Lam Hỏa (`4 HP / 2 Giáp`, CD `8s`), Mộc Linh (`5 HP / 3 Giáp`, CD `12s`) và Bánh Răng (`6 HP / 4 Giáp`, CD `10s`).
- **6 Phản Ứng Nguyên Tố & Thưởng Phối Hợp `Elemental Convergence` (`3.0s`):** Khi người chơi A gắn ấn nguyên tố và người chơi B kích nổ phản ứng, cả hai nhận ngay **`3.0s` Giao Thoa Nguyên Tố** — nạp đầy băng đạn / xóa `0%` nhiệt tức thì kèm **`+20%` tốc chạy & tốc bắn** và điểm `Team Combo`.

### 4. Chiều Sâu Build Riêng Từng Người Chơi (`Zero Flat Stat-Sticks`)
Xóa bỏ 6 buff cộng chỉ số phẳng nhàm chán cũ và tách toàn bộ tiến trình nâng cấp thành **trạng thái riêng biệt cho từng người chơi (`per-player instanced`)**:
- **`24` Phước Lành Hành Động (`Action Blessings` — 4 họ × 6):** *Table Tech* (cường hóa lật bàn & `Micro-Blank`), *Dash Tech* (biến hóa lướt & `Dash-Kick`), *Reload Tech* (đột biến `Perfect Reload` & `Tactical Vent`) và *Bullet Mod* (biến đổi nảy tường, xuyên thấu, hội tụ đạn).
- **`10` Nâng Cấp Kỹ Năng Nhân Vật (`Character Skill Upgrades`):** `2` nâng cấp chuyên sâu cho mỗi lớp nhân vật.
- **`10` Đột Biến Vũ Khí Daedalus (`Daedalus Weapon Mutators`):** Phòng Kho Báu / Xưởng Rèn phân nhánh rõ theo tầng — Tầng lẻ (`1, 3, 5`) đặt **`daedalus_anvil`** cho phép khảm tối đa **`2` Mutators / ô vũ khí** làm thay đổi hình học và hành vi đạn; Tầng chẵn (`2, 4, 6`) đặt **`upgrade_anvil`** cường hóa cấp vũ khí (`+1 → +3`, mỗi cấp `+20% Base DMG`).
- **`6` Phước Lành Giao Thoa Kép (`Elemental Duo Boons`):** Thẻ **Kim Cương Đôi Cầu Vồng (`Prismatic Double-Diamond`)** xuất hiện với tỉ lệ **`35%` ở ô thẻ thứ 3** khi người chơi sở hữu cặp nguyên tố tương ứng (`duo_superheated_cyclone`, `duo_cryo_shatter_spires`, `duo_superconduct_rail`, `duo_napalm_chain_plague`, `duo_plasma_overload_star`, `duo_magnetic_bastion_ring`).
- **`6` Khế Ước Tro Tàn (`Ashen Pacts`) → `6` Thánh Vật Thức Tỉnh (`Awakened Relics`):** Mỗi Biome có **1 Tế Đàn Khế Ước** ở Tầng lẻ (`1, 3, 5`) để từng người chơi tự chọn ký lời nguyền đánh đổi mạo hiểm (`pact_soul_chain`, `pact_shattered_glass`, `pact_searing_trigger`, `pact_volatile_arsenal`, `pact_ashen_hunted`, `pact_ricochet_vow`). Ngay khi hạ gục Boss Tầng chẵn (`2, 4, 6`), lời nguyền được thanh tẩy hoàn toàn và thăng hoa thành **Thánh Vật Thức Tỉnh** giữ trọn quyền năng nâng cấp mà không còn bất kỳ hình phạt nào!

### 5. Kinh Tế Chiến Thuật, Phòng Bí Mật Động & Đấu Trường Bí Mật `20.0s`
- **Phá Tường Nứt & Đấu Trường Kỹ Năng Bí Mật (`20.0s Secret Skill Arena`):** Dùng bia chắn sút trượt, đạn nổ hoặc đòn hạng nặng phá tường nứt `cracked_wall` để mở Phòng Bí Mật. Kích hoạt pha lê thử thách và quét sạch đợt tinh anh trong **`<= 20.0s`** sẽ nâng cấp rương bí mật lên **`100% Huyền Thoại (Legendary)`** (rơi riêng cho từng người chơi) kèm **`+40 Vàng`**. Nếu hết giờ, quái và đạn thử thách tự động tan biến an toàn (`0` sát thương nổ hậu kỳ, `0` soft-lock) và người chơi vẫn nhận trọn rương cơ bản (`Rare / Epic`) cùng `+30 Vàng` tinh thể.
- **Phân Rã Vũ Khí (`Giữ [X] 0.50s`):** Nhấp nhanh `[X]` để ném chia sẻ vũ khí cho đồng đội; giữ `[X]` trong **`0.50s`** ngoài giao tranh cạnh vũ khí rơi trên sàn để phân rã thành **`10 / 15 / 22 / 30 / 45 Vàng`** theo bậc hiếm.
- **Thưởng Dọn Phòng Hoàn Hảo (`Flawless Room Bonus`):** Nhận thêm **`+10 Vàng`** mỗi khi dọn sạch phòng giao tranh mà không chịu bất kỳ sát thương nào (`!tookDamageInCurrentRoom`).

### 6. AI Quái Chiến Thuật & Đại Tu 3 Boss (`Visual Armor Break` & `Supply Drop`)
- **AI Đón Đầu Có Giới Hạn & Tương Tác Địa Hình:** Quái xạ thủ sử dụng **`Bounded Predictive Lead Aiming (±28°)`** kèm tia ngắm cảnh báo **`0.35s`** trước khi khai hỏa, đồng thời phối hợp 12 hành vi tương tác địa hình (ẩn nấp sau bia chắn, né vực `chasm`, kích hoạt bẫy môi trường).
- **Đại Tu 3 Boss (`spore_king`, `kryssa_ice_queen`, `forge_titan`):**
  - **`1–2 Step Visual Armor Break`:** Phá vỡ trực quan từng lớp giáp thân thể Boss tại ngưỡng **`66%`** và **`33%` HP**, thay đổi hình thái chiến đấu và mở lộ điểm yếu.
  - **`Boss Supply Drop` mỗi `18.0s`:** Thả tiếp tế bia chắn / đồ chơi địa hình chiến thuật xuống đấu trường mỗi `18.0s` để người chơi luôn có công cụ `Flip Cover`, `Micro-Blank` và `Dash-Kick` phản công Boss.
  - **Thanh Choáng Phụ `bossStaggerAccum`:** Tích lũy từ `Wall-Slam`, bia chắn sút trượt, `Parry Deflect` và đòn Kết Liễu để mở cửa sổ chế ngự Boss.

### 7. Kiến Trúc Mạng Tất Định 60Hz, `3-Bucket Damage Pipeline`, Cân Bằng `10/10` & Engine 2.6
- **Đồng Bộ Mạng 60Hz Không Giật Lùi (`Zero-Rubberband Networking`):** Mở rộng bitmask input 9-bit (`RELOAD_VENT = 1 << 8`), sinh **ID Đạn Tất Định** khớp giữa Client/Server, cờ **`SHOT_FLAG.DYNAMIC_BOUNCE`** kết hợp **`Zero-Rubberband Client Hold` (`0.12s`)** + `projectile_redirect` / `projectiles_destroyed`, cô lập tuyệt đối trạng thái build từng người chơi trong `QuantizedPlayerSnap` kèm xác thực `meta.playerId` tại `CoopRoom`, giới hạn ưu tiên `<= 64` sự kiện/snapshot và ngân sách pool thực thể cứng (`240 / 160 / 16 / 8`), giữ kỷ luật kiến trúc mô-đun `< 1000` dòng/file.
- **Pipeline Sát Thương 3 Nhóm Có Trần (`3-Bucket Damage Pipeline`):** Ngăn lạm phát cấp số nhân cuối trận bằng trần mềm `2.80x` → trần cứng `3.80x`, trần suy yếu mục tiêu `M_EnemyVuln <= 1.75x`, trần đơn đòn lên Boss `18.0x`, giảm chấn đa tia lên Boss `dampenBossMultiProcDamage`, quy tắc `One-Split Rule` và `MAX_PELLETS_PER_TRIGGER = 9`.
- **Kiểm Định Cân Bằng Định Lượng `10/10` (`2.269` lượt mô phỏng 60Hz trên 30 locked seeds):** Đạt **10/10 chỉ tiêu PASS** với `AVERAGE_PLAYER_BOT_PROFILE` (`godMode = false`) — Starter TTK `p50 1.42s`, phòng giao tranh 1–4P `p50 36.77s`, độ lệch Boss 1P vs 4P chỉ `±0.8% → ±8.6%`, `zeroOneShots: true`, `18/18` vũ khí đều có `Active DPS > Normal DPS`, độ lệch tỉ lệ thắng 5 nhân vật chỉ `±1.9%` (`95.7%–99.0%`), và Boss cuối Tầng 6 `forge_titan` trụ vững **`Min p50 47.51s`** (`>= 45.0s`) trước tổ hợp full-synergy cuối trận.
- **Engine Kiểm Định Hoạt Ảnh & Khoảnh Khắc `2.6` (`HARD_ASSERT` 5 Gates):** Tự động kết xuất Contact Sheets và kiểm định cứng 5 cổng chất lượng thị giác (`Rig Continuity`, `Pose Separation`, `VFX Readability`, `Terrain Depth`, `UI Zero-Overlap`).

---

# 📜 LỊCH SỬ PHÁT HÀNH — ASHEN PACT `v0.2.1` ("Polish & Depth")

- **Phiên bản:** `v0.2.1` (*"Polish & Depth" — Comprehensive Visual, Architectural, UI/UX & Combat Balance Overhaul*)
- **Nền tảng phát hành:** Windows 10/11 64-bit (`AshenPact-v0.2.1-win-x64`) & Web Browser (Chromium / Chrome / Edge / Firefox)
- **Chế độ chơi:** Chơi đơn (*Solo*) & Phối hợp mạng nội bộ (*Co-op LAN / Wi-Fi 2–4 người chơi*)

---

## 🚀 1. Điểm Mới Nổi Bật Trong Bản Cập Nhật `v0.2.1` ("Polish & Depth")

Bản cập nhật lớn **`v0.2.1` ("Polish & Depth")** nâng cấp toàn diện **12 hạng mục cốt lõi (Phases P0 → P12)** từ hệ thống ánh sáng, kiến trúc chiều sâu 3D giả lập, cổng dịch chuyển shader, giao diện `HudScene` tách biệt, hoạt ảnh nhân vật/quái vật `Cutout 2.0`, hiệu ứng chiến đấu `BlendMode.ADD` cho tới độ sâu chiến thuật và cân bằng thực chiến 60Hz:

### 1.0 Cập Nhật Mới Trong `v0.2.1` (Cân Bằng B1/B2, Chiến Dịch 6 Tầng, Thưởng NL Boss, Chống Kẹt Quái & Câu Đố Đẩy Thùng)
- **Chiến dịch 6 Tầng xuyên suốt 3 Biome & Cân bằng B1/B2:** Mở cổng không gian ở các tầng lẻ (`1, 3, 5`) và sau khi hạ Boss ở các tầng chẵn (`2, 4`), hoàn thành trọn vẹn chiến dịch sau khi hạ Titan Lò Rèn ở Tầng 6; tinh chỉnh nhịp độ sinh tồn, kinh tế và cân bằng Boss (`Phase B1 & B2`).
- **Chống kẹt quái tuyệt đối trong trụ đá `2×2` và vật cản:** Gộp các ô tường/trụ liền kề trong `resolveCircleCollision` để xóa bỏ khe kẹt giữa trụ `2×2`, kiểm tra và đẩy vị trí spawn/di chuyển của quái ra ngoài mọi vật cản (`props`, `ancient_mechanism`, `chests`) kèm vòng tìm kiếm 8 hướng dự phòng.
- **Thưởng lớn Năng lượng mỗi khi Boss chuyển giai đoạn (`Phase 1 → 2 → 3`):** Hồi ngay tối thiểu `70% Max NL` (`>= 130 NL`), xóa thời gian chờ hồi năng lượng và tăng tốc độ hồi năng lượng tự nhiên (`3.5 NL/s`, thời gian chờ tối đa `1.0s`) trong suốt trận đánh Boss.
- **Đẩy khối đá câu đố 2 Tấm Áp Lực mượt mà (Solo & Co-op LAN):** Dời chậu lửa trang trí khỏi đường đẩy trong phòng Kho Báu, hỗ trợ lực hút dẫn hướng tự động giúp đẩy thẳng khối đá từ mọi góc và khóa cố định trên tấm áp lực, đồng bộ thời gian thực qua `NetworkTransport`.

### 1.1 Tầm Nhìn Trong Trẻo & Ánh Sáng Không Sương Mù Đen (`Phase P3`)
- **Loại bỏ hoàn toàn lớp sương mù tối gây mỏi mắt:** Nâng nền ánh sáng môi trường (`ambientRgb`) ở tất cả các Biome và Sảnh Doanh Trại lên mức sáng rõ (`~0.84–0.90`), tắt hoàn toàn `vignetteStrength = 0.0`, xóa hạt sương mù `fx_ambient_mist`, bổ sung vũng sáng ấm `BlendMode.ADD` (`+8 ΔL*`) cho chậu lửa và tắt hoàn toàn lớp phủ tối toàn màn hình trong **Bão Tuyết Phase 3 của Băng Hậu Kryssa**, thay bằng hiệu ứng hạt gió tuyết chéo tốc độ cao và tinh thể băng ở rìa màn hình để người chơi luôn nhìn rõ 100% đạn và cảnh báo trên sàn.

### 1.2 Kiến Trúc Chiều Sâu 3D Hybrid & Bản Sắc 3 Biome (`Phase P4 & P5`)
- **Chiều sâu 2.5D / 3D Hybrid rõ nét:** Mặt sàn phân vùng *"Chi tiết ven tường, Tĩnh lặng giữa tâm"* (`ΔL* <= 8` ở vùng chiến đấu trung tâm), tường 3 lớp (`Top Cap` + `South Cliff Face 12–14u` + `AO/Cast Shadow` hướng `+45°`), trụ đá có rãnh đổ bóng dài và viền kiến trúc cho các ô mặt đất nguyên tố (đầm độc bờ rêu + đá bước chân ở B1, băng trơn vát cạnh ở B2, kênh dung nham âm sàn ở B3).
- **Bản sắc kiến trúc động riêng cho từng khu vực:**
  - **Sảnh Doanh Trại (Hub):** Sàn lát đá cổ ấm áp (`ENV_PALETTE[0]`), chậu lửa treo giá sắt `45°`, đống lửa trại trung tâm, kệ vũ khí đôi tự động bổ sung và bệ đá cổ đặt 5 tượng anh hùng.
  - **Biome 1 (Rừng Cổ Mục Nát):** Rễ cây Bezier leo chân tường, cụm nấm phát quang chân cột, đom đóm bay lượn và bụi lá rơi.
  - **Biome 2 (Hầm Băng Vĩnh Cửu):** Vòng cổ ngữ băng khắc chìm 3 tầng (*Sunken Astrolabe*), hốc thác băng tường Bắc, pha lê vát cạnh phản quang, 2–3 dải tia sáng *God-rays* và bông tuyết tròn 2 lớp thị sai.
  - **Biome 3 (Lò Rèn Dung Nham):** Rãnh nhiệt ven tường phủ nắp lưới sắt rèn lộ ánh magma nhịp thở, bánh răng đồng thau `8–12` răng quay chậm, đường ống hơi nước tán đinh và tàn lửa nhỏ (`<= 4px`) bay lên.

### 1.3 Vòng Sáng Vật Tương Tác & Nhãn Nhắc `[E]` Duy Nhất (`Phase P6 & P7`)
- **Vòng sáng dẫn đường tự nhiên (`Interactable Glow`):** Rương kho báu, vũ khí rơi (tô màu theo 5 bậc hiếm kèm cột sáng thẳng đứng *Soul Knight* cho đồ Tím/Cam), Tượng Anh Hùng, Thương Nhân, Điện Thờ và Máy Cổ Đại đều có nguồn sáng + hào quang `BlendMode.ADD` và hạt lấp lánh nhận diện ngay từ xa.
- **Nhãn tương tác `[E]` duy nhất có độ ưu tiên (`Single-Pill Priority Prompt`):** Xóa bỏ hoàn toàn tình trạng chữ chồng chéo trên đầu vật thể; dùng chung hàm `findInteractTarget` giữa Sim và UI để chỉ hiển thị **1 khung nhắc `[E]` duy nhất** cho mục tiêu ưu tiên cao nhất trong tầm với hiệu ứng fade `120–150ms` và trễ `8u` (*hysteresis*).

### 1.4 Cổng Không Gian Shader Xoáy Lốc & Cửa Liên Phòng Theo Biome (`Phase P8`)
- **Cổng Dịch Chuyển Không Gian (`Procedural Vortex Portal`):** Dựng từ 5 lớp đồ họa động (bệ đá 8 cổ tự sáng dần khi dọn phòng, vòng cổng xoay ngược chiều, lõi xoáy lốc WebGL fragment shader / Canvas2D fallback ở mức `Low`, tia năng lượng và hạt hút vào tâm) kèm chuỗi hiệu ứng bùng sáng kích hoạt (`0.72s`) và hút nhân vật (`0.30s`) khi bước qua.
- **Cửa Liên Phòng cơ khí theo từng Biome:** Cổng rễ cây kết ấn lục giác (Biome 1), cổng rào băng pha lê (Biome 2) và cửa chắn tia nhiệt cơ khí (Biome 3) với hiệu ứng dựng rào chắn (`250ms`) khi khóa phòng và tan biến (`380ms`) khi mở khóa.

### 1.5 Kiến Trúc `HudScene` Độc Lập & Giao Diện Chuẩn Hóa (`Phase P3, P9a & P9b`)
- **Tách riêng `HudScene` khỏi camera thế giới:** Toàn bộ HUD và Modal chạy trên `HudScene` độc lập kèm camera Uniform Zoom không méo hình ở mọi tỷ lệ màn hình (`1080p`, `1440p`, `21:9 Ultrawide`, `5:4`) và không chịu ảnh hưởng của rung màn hình hay PostFX của `GameScene`.
- **Thiết kế HUD hiện đại, thoáng mắt:** Hệ thống token `UI_THEME` đồng bộ bảng màu `ENV_PALETTE`, xóa bỏ 2 dải đen đặc trên/dưới màn hình; neo gọn 4 cụm HUD với chân dung nhân vật mini vẽ bằng code, 3 thanh chỉ số chia đốt có vạch máu tụt trễ, 2 thẻ vũ khí + đồng hồ hồi chiêu kỹ năng/Dash dạng vòng tròn, gộp thông báo phản ứng nguyên tố trong cửa sổ `0.4s` (`"⚡ HƠI NƯỚC ×3"`), mũi tên chỉ quái ngoài màn hình, cung đỏ báo hướng sát thương và thanh máu Boss chia phase `66%`/`33%`.
- **Hệ thống Modal & Sảnh Chờ tinh gọn:**
  - **Cài Đặt 4 Tab (`Âm thanh · Hình ảnh · Gameplay · Điều khiển`)** với tiêu đề đơn ngữ chuẩn, bật/tắt Toàn màn hình (`[F11]` kèm Toast), chỉnh `UI Scale (80%–130%)`, `Key Hints` và Ngôn ngữ `VI / EN`.
  - **Ô nhập chữ HTML `<input>` thật tại Menu chính:** Cho phép chọn chữ, xóa `Backspace`/`Delete` và dán nhanh `Ctrl+V` địa chỉ IP LAN.
  - **Bảng Mời Bạn Bè thu gọn thành Chip (`[I]`):** Mặc định thu gọn gọn gàng ở góc phải trên (`"📡 Mời bạn · 2/4 [I]"`) để không che khuất Sảnh Doanh Trại; bấm `[I]` hoặc nhấp chuột để bung mã QR + danh sách IP LAN + nút `"Đuổi"` không bao giờ đè chữ.
  - **Menu Tạm Dừng (`[Esc]`) & Màn Hình Kết Thúc:** Menu Pause 4 nút rõ ràng có hộp thoại xác nhận trước khi thoát về Menu chính; màn hình Chiến Thắng/Thất Bại 3 tầng vinh danh 4 danh hiệu MVP với 2 nút hành động phân cấp (`Chơi lại [Enter]` và `Về Hub [H]`).

### 1.6 Cutout 2.0: Đổ Bóng 2 Lớp, Viền Sáng `-135°`, Quái Full Rig & Hoạt Ảnh Tham Số (`Phase P10a`)
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

## 📊 3. Kết Quả Kiểm Định Chất Lượng & Hiệu Năng (`v0.2.1`)

- **Cân bằng định lượng (`pnpm balance`):** Đạt **8/8 chỉ tiêu cân bằng** qua **1.795 lượt mô phỏng 60Hz thực tế trên 30 locked seeds** (TTK quái khởi đầu `1.18s`; phòng chiến đấu TB `36.3s`; cả 3 Boss đạt `55.6s – 66.2s` ở 1P–4P với độ lệch 1P vs 4P `≤ 9.2%`; tỉ lệ thắng Solo hoàn thành chiến dịch đạt `53.3% – 66.7%` cho cả 5 nhân vật; không có buff hay vũ khí nào vượt ngưỡng thống trị).
- **Soak Test 20 phút (`72.000` ticks @ 60Hz):** 4 người chơi Co-op giao tranh liên tục qua 3 Biome và 3 Boss — không rò rỉ bộ nhớ, thời gian xử lý mỗi tick giữ vững `< 0.25 ms/tick`.
- **Hiệu năng Render & Đa trình duyệt (`pnpm perf`):** Giữ vững **60 FPS** (`frameTime p95 <= 16.9ms`) ở 1080p High kể cả trong Stress Test; băng thông mạng thực tế chỉ `~7.7 KB/s/client`; tương thích hoàn hảo với **0 lỗi/cảnh báo console** trên **Chromium**, **Google Chrome** và **Microsoft Edge**.
