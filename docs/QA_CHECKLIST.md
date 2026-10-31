# ✅ BÁO CÁO NGHIỆM THU BUG BASH & CHECKLIST QA TOÀN DIỆN (`QA_CHECKLIST.md`) — ASHEN PACT `v2.0.0`

> Tài liệu này ghi lại kết quả rà soát và kiểm định tự động + trực quan toàn bộ 8 nhóm danh mục QA trước khi đóng gói bản phát hành `v2.0.0` (*"Tactical Arena Overhaul"*).

---

## 8.1 Menu, Ô Nhập Liệu HTML & Luồng Vào Game

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Menu chính hiển thị cảnh nền lửa trại động (2 đống lửa trại, hạt tàn lửa, 5 nhân vật + Goblin chạy hoạt ảnh Cutout 2.0 mượt mà, không chồng lấp nhãn) | ✅ PASS | `tests/e2e/phase7.spec.ts` & `tests/e2e/polish-p9b.spec.ts` |
| 2 | Ô nhập **Tên hiển thị** và **IP LAN** bằng HTML `<input>` overlay hỗ trợ gõ tiếng Việt có dấu (IME), dán nhanh `Ctrl+V`, lưu và khôi phục chính xác từ `localStorage` | ✅ PASS | `tests/e2e/polish-p9b.spec.ts`, `tests/e2e/phase4.spec.ts` & `packages/shared/test/phase4-coop.test.ts` |
| 3 | Nút **Chơi Đơn (`Play Solo`)** vào thẳng lượt chơi với `LocalTransport` ở 60Hz, độ trễ `< 1 frame` | ✅ PASS | `tests/e2e/phase0.spec.ts`, `phase1.spec.ts`, `phase3.spec.ts` |
| 4 | Nút **Tạo Phòng LAN** / truy cập từ Host (`/?coop=host` hoặc gốc `http://<IP-LAN>:2567/`) tự động đưa vào Sảnh Doanh Trại (`Hub`) | ✅ PASS | `tests/e2e/phase4.spec.ts` & `tests/e2e/phase8.spec.ts` |
| 5 | Ô nhập **IP LAN thủ công** ở Menu chính kết nối chính xác tới địa chỉ `http://<IP-LAN>:<port>` của Chủ Phòng | ✅ PASS | `tests/e2e/phase4.spec.ts` (`MenuScene` LAN IP input) |
| 6 | Cửa sổ **Cài Đặt 4 Tab (`[O]`: Âm thanh · Hình ảnh · Gameplay · Điều khiển)**, **Credits (`[C]`)**, thanh trượt kéo-thả chuột, nút **Toàn màn hình (`[F11]`)** và chuyển đổi **Ngôn Ngữ (`[L]`: `VI` ↔ `EN`)** mở/đóng mượt mà | ✅ PASS | `tests/e2e/polish-p9b.spec.ts` & `tests/e2e/phase7.spec.ts` |

---

## 8.2 Di Chuyển, Chiến Đấu & Hiệu Ứng `BlendMode.ADD`

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Di chuyển `WASD` có gia tốc/giảm tốc mượt, trượt dọc tường/trụ `2×2` (`resolveCircleCollision` 2 pha) không bị kẹt góc nối giữa 2 ô tường | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` (wall sliding & corner tests) |
| 2 | **Dash (`Shift`) + `Dash-Kick`** cho `0.16s` bất tử (`i-frame`), hồi chiêu `1.85s`, có hiệu ứng bóng mờ `afterimage`, lướt xuyên qua sóng xung kích của Boss và sút trượt Bia Chắn đã lật / Đồ chơi địa hình ở `520–600 px/s` gây `Wall-Slam` & `Chasm Ring-Out` | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` & `phase6-biomes.test.ts` |
| 3 | Đạn va chạm chuẩn xác với tường/trụ (`checkProjectileWallHit`), không xuyên tường đặc; đạn địch có lõi sáng + viền cảnh báo đỏ/cam nổi bật trên mọi nền sàn | ✅ PASS | `packages/shared/test/polish-p10b-fx.test.ts` & `tests/e2e/polish-p10b.spec.ts` |
| 4 | 4 Vũ khí cận chiến (`knight_sword`, `emerald_cleaver`, `berserker_axe`, `thunder_hammer`) vận hành chuỗi Combo 3 đòn (Đòn 3 Kết Liễu diện rộng) và `Parry Deflect 0.18s` phản ngược đạn địch thành đạn đồng minh cường hóa (ẩn `Micro-Bar` dưới chân) | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` & `polish-p10b-fx.test.ts` |
| 5 | Giáp hấp thụ sát thương trước HP, phát sự kiện + âm thanh `armor_broken` khi vỡ giáp, tự hồi lại sau `3.0s` (Thiết Vệ) / `5.2s` (nhân vật khác) không trúng đòn | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts` & `phase1-sim.test.ts` |
| 6 | Toàn bộ quái thường, Tinh Anh (Elite) và 3 Boss đều có vòng triệu hồi `0.8s` khi xuất hiện, hiệu ứng gồng chiêu rung thân + mắt sáng và vùng cảnh báo đỏ (`telegraph` `0.5s–0.8s`) trước khi tấn công | ✅ PASS | `packages/shared/test/polish-p10-cutout.test.ts` & `phase6-biomes.test.ts` |
| 7 | Cảm giác chiến đấu (*Game Feel*): Hit flash trắng `90ms`, Hit-stop `30–50ms`, rung màn hình Perlin theo `trauma^2`, số sát thương bật lên dạng parabol (thường / chí mạng `1.5x !` / nguyên tố), chuỗi chết 4 giai đoạn văng vũ khí | ✅ PASS | `tests/e2e/polish-p10.spec.ts` & `tests/e2e/polish-p10b.spec.ts` |

---

## 8.3 Dungeon 10 Phòng, Phòng Thử Thách & Kiến Trúc 3 Biome

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Sinh tầng thủ tục theo Seed (`generateDungeonFloor`) với **10 phòng/tầng** đảm bảo 100% phòng liên thông từ phòng `Start` tới `Portal`/`Boss` (kiểm chứng BFS trên 100+ seeds) | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` & `polish-p11-balance.test.ts` |
| 2 | Đầy đủ 6 Archetype phòng chiến đấu chiến thuật, 9 Đồ chơi địa hình và các loại phòng: Khởi Đầu (`start`), Chiến Đấu (`combat`), Phòng Thử Thách (`challenge`), Xưởng Rèn Kho Báu (`treasure` với `daedalus_anvil` tầng lẻ / `upgrade_anvil` tầng chẵn), Tế Đàn Khế Ước Tro Tàn (`1/Biome` ở tầng `1, 3, 5`), Thương Nhân (`merchant`), Điện Thờ (`shrine`), Bí Mật (`secret` qua `'cracked_wall'` kèm Đấu Trường Kỹ Năng `20.0s`), Cổng/Boss | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts` & `tests/e2e/polish-p11.spec.ts` |
| 3 | Cơ chế **Đợt Quái Tràn Gối Đầu (`Overlapping Waves`)**: Tự động gọi đợt kế tiếp khi đợt hiện tại còn `≤ 2` quái hoặc sau `14s`; mở cửa + rơi rương khi dọn sạch toàn bộ đợt quái | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts` |
| 4 | Lưu giữ bền vững trạng thái rương, vật phẩm rơi và cửa hàng theo từng `roomId` khi di chuyển qua lại giữa các phòng đã mở | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` (`roomChestsByRoomId` / `roomItemsByRoomId`) |
| 5 | **Cổng Không Gian Shader Xoáy Lốc** (8 cổ tự + lõi vortex shader + hút nhân vật `250ms`) và **Cửa Liên Phòng theo Biome** (Dây leo cổ / Pha lê băng / Cửa sập thép) hoạt động mượt mà | ✅ PASS | `packages/shared/test/polish-p7-portals-doors.test.ts` & `tests/e2e/polish-p7.spec.ts` |
| 6 | **Tầm nhìn trong trẻo không sương mù tối (`ambientRgb >= 0.72`)** và **Kiến trúc 3D Hybrid** (tường `wall_face` `18u`, bóng đổ Đông-Nam, trụ 3 tầng, rễ cây/vết nứt băng/bánh răng động) | ✅ PASS | `tests/e2e/polish-p2.spec.ts`, `polish-p3.spec.ts`, `polish-p4.spec.ts` |
| 7 | Đủ 3 Biome (**Rừng Cổ Mục Nát**, **Hầm Băng Vĩnh Cửu**, **Lò Rèn Dung Nham**) và 3 Boss (**Mục Vương Nấm Độc**, **Băng Hậu Kryssa**, **Titan Lò Rèn**) kèm **Phá Giáp Trực Quan 1–2 Bước (`66%`/`33%` HP)**, **`Boss Supply Drop` (`18.0s`)**, thanh choáng phụ **`bossStaggerAccum`**, **CC Diminishing Returns** và **Soft Enrage `90s`** | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts`, `p5-synergy-boss-soak.test.ts` & `tests/e2e/polish-p11.spec.ts` |

---

## 8.4 Hệ Thống, Nhân Vật, Nguyên Tố, Vật Phẩm & Nhãn Nhắc `[E]`

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Cả 5 nhân vật (**Thiết Vệ**, **Liệp Ưng**, **Lam Hỏa**, **Mộc Linh**, **Bánh Răng**) vận hành 100% thuần Cooldown (`Zero Energy`, xuất phát 1 vũ khí trấn phái ở Ô 1) đúng Nội tại, Kỹ năng chủ động, 2 Nâng cấp chuyên sâu và cơ chế Synergy (Solo & Co-op) | ✅ PASS | `packages/shared/test/phase5-synergy.test.ts` & `tests/e2e/phase5.spec.ts` |
| 2 | Đủ **6 Phản ứng nguyên tố** (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*) với vụ nổ `BlendMode.ADD` riêng biệt và kích hoạt **Đồng Đội Combo (`Hội Tụ Nguyên Tố 3.0s`: nạp đầy băng đạn / xóa `0%` nhiệt + `+20%` tốc chạy & tốc bắn cho cả 2 người)** | ✅ PASS | `packages/shared/test/phase5-synergy.test.ts` & `polish-p10b-fx.test.ts` |
| 3 | Kho **18 Vũ khí độc bản** đủ 5 bậc hiếm chia làm 3 họ nhịp độ chủ động `[R]` (`9 CLIP_RELOAD`, `5 HEAT_VENT`, `4 MELEE_COMBO` + `Holster Auto-Reload 2.0s`) kèm bể build tách riêng từng người chơi (`24` Action Blessings, `10` Daedalus Mutators, `6` Duo Boons, `6` Ashen Pacts → Awakened Relics) & `3-Bucket Damage Pipeline` | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts` & `p5-synergy-boss-soak.test.ts` |
| 4 | **Vòng sáng vật tương tác (`Interactable Glow`)** và **Nhãn nhắc `[E]` duy nhất theo độ ưu tiên (`Single-Pill Priority Prompt`)** bao gồm **Lật Bia Chắn `[E]` (`Micro-Blank r=56px`)**, không chồng chéo chữ; hỗ trợ chọn ô `1`/`2`, đổi nhanh `Q`/lăn chuột, nhấp `X` vứt vũ khí và giữ `X` `0.5s` Phân Rã Vũ Khí thành Vàng | ✅ PASS | `tests/e2e/polish-p5.spec.ts`, `polish-p6.spec.ts`, `polish-p9a.spec.ts` |
| 5 | Câu đố **2 Tấm Áp Lực Co-op** trong phòng Kho Báu mở rương thưởng khi 2 người đứng cùng lúc (hoặc đẩy khối đá `pushBlocks` / đặt vật triệu hồi khi đi Solo) | ✅ PASS | `packages/shared/test/phase6-biomes.test.ts` |

---

## 8.5 Co-op LAN (2–4 Người Chơi) & Cổng Bảo Vệ Debug (`Release Debug Gate`)

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | 4 trình duyệt độc lập kết nối đồng thời qua **địa chỉ IPv4 LAN thực của máy** (không phải `localhost`), vào Hub, chọn 4 nhân vật khác nhau, sẵn sàng và vượt tầng | ✅ PASS | `tests/e2e/phase4.spec.ts` & `tests/e2e/phase8.spec.ts` |
| 2 | Mặc định **chặn chọn trùng nhân vật** ở Hub (Chủ Phòng có nút bật/tắt `Trùng NV`); bảng **Mời Bạn Bè (`[I]`)** mặc định thu gọn thành chip góc phải trên và bung ra khi bấm `[I]` | ✅ PASS | `tests/e2e/polish-p9b.spec.ts` & `packages/shared/test/phase4-coop.test.ts` |
| 3 | Dưới điều kiện mạng **Wi-Fi kém (`80ms ± 20ms`, `2%` loss, lag spike `300ms`)**, chuyển động của người chơi local vẫn mượt mà không giật lùi; băng thông **≤ 24 KB/s/client** | ✅ PASS | `tests/e2e/phase4.spec.ts` |
| 4 | Cơ chế **Gục Ngã (`20s`) → Cứu Dậy (`2.5s` / Mộc Linh `1.25s` hoặc Cây Thiêng tức thì) → Linh Hồn (`Ghost`) → Tự hồi sinh `35% HP` (tối thiểu `2 HP`) khi dọn xong phòng** | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts` & `phase4-coop.test.ts` |
| 5 | **Tự động kết nối lại trong 30 giây (`Reconnect 30s`)** bằng `reconnectToken` giữ nguyên vị trí, nhân vật, vũ khí, máu/giáp và vàng | ✅ PASS | `tests/e2e/phase4.spec.ts` |
| 6 | **Người chơi rời phòng giữa trận / giữa Boss fight:** Tự động dọn sạch tham chiếu hồi sinh (`reviverPlayerId`), khối `ice_prison`, trụ/vùng kỹ năng của người rời đi; kiểm tra thua nếu những người còn lại đều đã gục; cập nhật lại Co-op scaling ở đầu phòng/đợt kế tiếp | ✅ PASS | `packages/shared/test/phase8-soak-release.test.ts` |
| 7 | **Cổng bảo vệ Debug bản phát hành (`Release Debug Gate`):** Mặc định ẩn toàn bộ UI/phím tắt/hooks Debug, đóng băng `window.__GAME_DEBUG__` chỉ-đọc và chặn mọi lệnh `debug_cmd` trên server khi không chạy với `--debug` | ✅ PASS | `packages/shared/test/polish-p1-debug-gate.test.ts`, `tests/e2e/polish-p1.spec.ts` & `tests/e2e/phase8.spec.ts` |

---

## 8.6 Hiệu Năng, Cân Bằng 2.269 Lượt Sim (`10/10`), Soak Test 60Hz & Tương Thích Trình Duyệt

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | **Kiểm định cân bằng 60Hz thực tế (`pnpm balance`):** Chạy `2.269` lượt `WorldSim` trên `30` locked seeds đạt **10/10 chỉ tiêu** (`docs/balance-report.md` & `docs/balance-report.json`, gồm kiểm định Boss Tầng 6 `Min p50 47.51s >= 45.0s`) | ✅ PASS | `packages/shared/test/polish-p11-balance.test.ts`, `p5-synergy-boss-soak.test.ts` & `pnpm balance` |
| 2 | **Soak Test 20 phút thời gian mô phỏng (`72.000` ticks @ 60Hz, 4P Co-op) & 200-Cycle 4P Soak:** Liên tục giao tranh, tung kỹ năng, lật/sút bia chắn, kích nổ phản ứng nguyên tố, qua nhiều tầng và đánh cả 3 Boss — không rò rỉ bộ nhớ, số thực thể nằm trong giới hạn Pool cứng (`240 / 160 / 16 / 8`), thời gian mỗi tick `< 0.25 ms` | ✅ PASS | `packages/shared/test/phase8-soak-release.test.ts` & `p5-synergy-boss-soak.test.ts` |
| 3 | **Stress Test đồ họa 1080p High & Đo lường `pnpm perf`** (4 người chơi + 80 quái + 625 đạn + 48 nguồn sáng động + 230+ hạt particle + decal) giữ vững **~60 FPS** (`frameTime p95 <= 16.9ms`) | ✅ PASS | `tests/e2e/phase2.spec.ts`, `phase6.spec.ts` & `docs/perf-baseline.json` |
| 4 | **Build Production sạch sẽ (`pnpm build`) & Đa trình duyệt:** Tách chunk `vendor-phaser`, `vendor-colyseus` và `index`, **0 lỗi TypeScript / ESLint**, chạy mượt với **0 lỗi/cảnh báo console** trên **Playwright Chromium**, **Microsoft Edge (`msedge`)** và **Google Chrome** | ✅ PASS | `pnpm build` & `tests/e2e/phase8.spec.ts` |

---

## 8.7 Trình Bày `HudScene`, Engine 2.6 Visual Gates, Bản Phát Hành Windows `v2.0.0` & Hoàn Thiện

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Hiển thị trọn vẹn dấu tiếng Việt (`"Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ"`) sắc nét trên `HudScene` độc lập ở cả 1080p và 1440p; đồng bộ 100% 450+ khóa đa ngôn ngữ `vi` / `en` | ✅ PASS | `tests/e2e/polish-p8.spec.ts`, `polish-p9a.spec.ts`, `polish-p9b.spec.ts` |
| 2 | Màn hình Kết thúc lượt chơi 3 tầng hiển thị đầy đủ thống kê đội, tên Phước Lành đã dịch chuẩn, **Bảng thống kê chi tiết từng người chơi**, **4 Danh hiệu MVP** và 2 nút hành động phân cấp (`Chơi lại [Enter]` / `Về Hub [H]`) | ✅ PASS | `tests/e2e/polish-p9b.spec.ts` & `tests/e2e/phase7.spec.ts` |
| 3 | Đóng gói bản phát hành sạch vào `release/AshenPact-v2.0.0-win-x64/` và `release/AshenPact-v2.0.0-win-x64.zip` qua `pnpm package:release` (gồm `AshenPact-Host.exe`, `start-host.bat`, `start-host-debug.bat`, `allow-firewall-port-2567.bat`, `runtime/node.exe`, `server-bundle.cjs`, `client/`, `README.md`, `CREDITS.md`, `RELEASE_NOTES.md`) | ✅ PASS | `tools/package-release.ts`, `packages/shared/test/polish-p12-release-version.test.ts` & `tests/e2e/phase8.spec.ts` |
| 4 | Chạy thực tế bản phát hành `v2.0.0` từ thư mục sạch → Host khởi động in `ASHEN PACT v2.0.0` + IP LAN + Mã QR ASCII ra Console, 2 Client (Chromium + Edge) kết nối qua **IP LAN thực của máy**, vào Hub, khởi hành và vượt trọn chiến dịch Dungeon + hạ Boss; đồng thời đạt 100% PASS toàn bộ danh mục ảnh chuẩn hóa & Engine 2.6 `HARD_ASSERT` 5 Gates | ✅ PASS | `tests/e2e/phase8.spec.ts`, `docs/screenshots/phase-8/` & `docs/screenshots/ap2-p5/` |
