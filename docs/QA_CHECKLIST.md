# ✅ BÁO CÁO NGHIỆM THU BUG BASH & CHECKLIST QA TOÀN DIỆN (`QA_CHECKLIST.md`) — ASHEN PACT `v0.1.0`

> Tài liệu này ghi lại kết quả rà soát và kiểm định tự động + trực quan toàn bộ 7 nhóm danh mục QA trước khi đóng gói bản phát hành `v0.1.0`.

---

## 8.1 Menu & Luồng Vào Game

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Menu chính hiển thị cảnh nền lửa trại động (2 đống lửa trại, hạt tàn lửa, 5 nhân vật + Goblin chạy hoạt ảnh mượt mà, không chồng lấp nhãn) | ✅ PASS | `tests/e2e/phase7.spec.ts` & `docs/screenshots/phase-7/menu-campfire-hub-1080p.png` |
| 2 | Ô nhập **Tên hiển thị** lưu và khôi phục chính xác từ `localStorage`, đồng bộ tên lên trên đầu nhân vật trong Hub và bảng đồng đội | ✅ PASS | `tests/e2e/phase4.spec.ts` & `packages/shared/test/phase4-coop.test.ts` |
| 3 | Nút **Chơi Đơn (`Play Solo`)** vào thẳng lượt chơi với `LocalTransport` ở 60Hz, độ trễ `< 1 frame` | ✅ PASS | `tests/e2e/phase0.spec.ts`, `phase1.spec.ts`, `phase3.spec.ts` |
| 4 | Nút **Tạo Phòng LAN** / truy cập từ Host (`/?coop=host` hoặc gốc `http://<IP-LAN>:2567/`) tự động đưa vào Sảnh Doanh Trại (`Hub`) | ✅ PASS | `tests/e2e/phase4.spec.ts` & `tests/e2e/phase8.spec.ts` |
| 5 | Ô nhập **IP LAN thủ công** ở Menu chính kết nối chính xác tới địa chỉ `http://<IP-LAN>:<port>` của Chủ Phòng | ✅ PASS | `tests/e2e/phase4.spec.ts` (`MenuScene` LAN IP input) |
| 6 | Các cửa sổ **Cài Đặt (`[O]`)**, **Điều Khiển (`[K]`)**, **Credits (`[C]`)** và nút chuyển đổi **Ngôn Ngữ (`[L]`: `VI` ↔ `EN`)** mở/đóng mượt mà bằng chuột và phím tắt | ✅ PASS | `tests/e2e/phase7.spec.ts` (`menu-campfire-settings.png`, `menu-settings-en-1080p.png`) |

---

## 8.2 Di Chuyển & Chiến Đấu

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Di chuyển `WASD` có gia tốc/giảm tốc mượt, trượt dọc tường/trụ `2×2` (`resolveCircleCollision` 2 pha) không bị kẹt góc nối giữa 2 ô tường | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` (wall sliding & corner tests) |
| 2 | **Dash (`Shift`)** cho `0.2s` bất tử (`i-frame`), hồi chiêu `1.2s`, có hiệu ứng bóng mờ `afterimage` và lướt xuyên qua sóng xung kích của Boss | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` & `phase6-biomes.test.ts` |
| 3 | Đạn va chạm chuẩn xác với tường/trụ (`checkProjectileWallHit`), không xuyên tường đặc; đạn có thuộc tính `bounce` nảy lại đúng góc pháp tuyến | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` & `phase3-sim.test.ts` |
| 4 | Vũ khí cận chiến (`knight_sword`, `jade_guandao`, `berserker_axe`, `thunder_hammer`) chém tan đạn thường của địch trong vùng quạt | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` (`melee_swing` destroys enemy bullets) |
| 5 | Giáp hấp thụ sát thương trước HP, phát sự kiện + âm thanh `armor_broken` khi vỡ giáp, tự hồi lại sau `2.0s` (Thiết Vệ) / `3.0s` (nhân vật khác) không trúng đòn | ✅ PASS | `packages/shared/test/phase1-sim.test.ts` & `phase7-ui-audio.test.ts` |
| 6 | Toàn bộ quái thường, Tinh Anh (Elite) và 3 Boss đều có vòng triệu hồi `0.8s` khi xuất hiện và vùng cảnh báo đỏ (`telegraph` `0.5s–0.8s`) trước khi tấn công, không spawn đè lên người chơi | ✅ PASS | `packages/shared/test/phase1-sim.test.ts`, `phase3-sim.test.ts`, `phase6-biomes.test.ts` |
| 7 | Cảm giác chiến đấu (*Game Feel*): Hit flash trắng `90ms`, Hit-stop `30–50ms`, rung màn hình Perlin theo `trauma^2`, số sát thương bật lên dạng rẻ quạt, mảnh vỡ rig khi quái chết | ✅ PASS | `tests/e2e/phase1.spec.ts` & `docs/screenshots/phase-1/combat-shotgun-feel-1080p.png` |

---

## 8.3 Dungeon & Tầng (3 Biome × 2 Tầng)

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Sinh tầng thủ tục theo Seed (`generateDungeonFloor`) đảm bảo 100% phòng liên thông từ phòng `Start` tới `Portal`/`Boss` (kiểm chứng BFS trên 100+ seeds) | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` (100 seeds BFS connectivity) |
| 2 | Đầy đủ các loại phòng: Khởi Đầu (`start`), Chiến Đấu (`combat`), Kho Báu (`treasure`), Thương Nhân (`merchant`), Điện Thờ (`shrine`), Bí Mật (`secret` qua tường nứt `'cracked_wall'`), Cổng/Boss | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` & `tests/e2e/phase3.spec.ts` |
| 3 | Vào phòng chiến đấu/Boss: cửa tự động khóa (`door_locked`), dịch chuyển đồng đội còn ở ngoài vào trong phòng (`players_teleported_to_room`), mở cửa + rơi rương khi dọn sạch toàn bộ đợt quái | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` & `phase4-coop.test.ts` |
| 4 | Lưu giữ bền vững trạng thái rương, vật phẩm rơi và cửa hàng theo từng `roomId` khi di chuyển qua lại giữa các phòng đã mở | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` (`roomChestsByRoomId` / `roomItemsByRoomId`) |
| 5 | **Minimap** góc phải trên + **Fog of War** (`hidden` → `discovered` → `visited` → `cleared`) và bản đồ lớn khi bấm `Tab` | ✅ PASS | `tests/e2e/phase3.spec.ts` (`minimap-tab-expanded-1080p.png`) |
| 6 | Bảng chọn **1 trong 3 Buff Giữa Các Tầng** hoạt động đầy đủ hiệu lực cho cả buff chung lẫn 10 nâng cấp kỹ năng riêng của 5 nhân vật | ✅ PASS | `packages/shared/test/phase3-sim.test.ts` & `phase5-synergy.test.ts` |
| 7 | Đủ 3 Biome (**Rừng Cổ Mục Nát**, **Hầm Băng Vĩnh Cửu**, **Lò Rèn Dung Nham**) và 3 Boss 3 Phase (**Mục Vương Nấm Độc**, **Băng Hậu Kryssa**, **Titan Lò Rèn**) kèm cơ chế mặt đất đặc thù (nước, dầu, cỏ, đầm độc, băng trơn, vực thẳm, dung nham, băng chuyền) | ✅ PASS | `packages/shared/test/phase6-biomes.test.ts` & `tests/e2e/phase6.spec.ts` |

---

## 8.4 Hệ Thống, Nhân Vật, Nguyên Tố & Vật Phẩm

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Cả 5 nhân vật (**Thiết Vệ**, **Liệp Ưng**, **Lam Hỏa**, **Mộc Linh**, **Bánh Răng**) hoạt động đúng Nội tại, Kỹ năng chủ động, 2 Nâng cấp và cơ chế Synergy (kể cả khi đi Solo lẫn Co-op) | ✅ PASS | `packages/shared/test/phase5-synergy.test.ts` & `tests/e2e/phase5.spec.ts` |
| 2 | Đủ **6 Phản ứng nguyên tố** (*Hơi Nước, Vỡ Băng, Siêu Dẫn, Nổ Độc, Tê Liệt, Quá Tải*) tiêu thụ trạng thái chuẩn xác và kích hoạt **Đồng Đội Combo (`+15 Năng lượng` cho cả 2 người)** | ✅ PASS | `packages/shared/test/phase5-synergy.test.ts` |
| 3 | Kho **24 Vũ khí** đủ 5 bậc hiếm, bao gồm 2 vũ khí Co-op (**Súng Hạt Giống** nở Hoa Sinh Mệnh hồi máu và **Trượng Liên Kết** nối tia điện-nhiệt giữa đồng đội) | ✅ PASS | `packages/shared/test/phase6-biomes.test.ts` |
| 4 | **Bảng so sánh vũ khí dưới đất** hiển thị DPS ước tính + chênh lệch `▲/▼` + mẹo nhặt lần đầu; hỗ trợ đổi 2 ô vũ khí (`Q`/lăn chuột) và vứt vũ khí cho đồng đội (`X`) | ✅ PASS | `tests/e2e/phase7.spec.ts` (`hud-weapon-compare-1080p.png`) |
| 5 | Câu đố **2 Tấm Áp Lực Co-op** trong phòng Kho Báu mở rương thưởng khi 2 người đứng cùng lúc (hoặc đẩy khối đá `pushBlocks` / đặt vật triệu hồi khi đi Solo) | ✅ PASS | `packages/shared/test/phase6-biomes.test.ts` |

---

## 8.5 Co-op LAN (2–4 Người Chơi)

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | 4 trình duyệt độc lập kết nối đồng thời qua **địa chỉ IPv4 LAN thực của máy** (không phải `localhost`), vào Hub, chọn 4 nhân vật khác nhau, sẵn sàng và vượt tầng | ✅ PASS | `tests/e2e/phase4.spec.ts` & `tests/e2e/phase8.spec.ts` |
| 2 | Mặc định **chặn chọn trùng nhân vật** ở Hub (Chủ Phòng có nút bật/tắt `Trùng NV`); chặn người chơi mới tham gia giữa lúc đội đang chiến đấu trong hầm ngục | ✅ PASS | `packages/shared/test/phase4-coop.test.ts` & `apps/server/src/rooms/CoopRoom.ts` |
| 3 | Dưới điều kiện mạng **Wi-Fi kém (`80ms ± 20ms`, `2%` loss, lag spike `300ms`)**, chuyển động của người chơi local vẫn mượt mà không giật lùi; băng thông **≤ 24 KB/s/client** | ✅ PASS | `tests/e2e/phase4.spec.ts` |
| 4 | Cơ chế **Gục Ngã (`20s`) → Cứu Dậy (`2.5s` / Mộc Linh `1.25s` hoặc Cây Thiêng tức thì) → Linh Hồn (`Ghost`) → Tự hồi sinh `50% HP` khi dọn xong phòng** | ✅ PASS | `packages/shared/test/phase4-coop.test.ts` & `tests/e2e/phase4.spec.ts` |
| 5 | **Tự động kết nối lại trong 30 giây (`Reconnect 30s`)** bằng `reconnectToken` giữ nguyên vị trí, nhân vật, vũ khí, máu/giáp và vàng | ✅ PASS | `tests/e2e/phase4.spec.ts` |
| 6 | **Người chơi rời phòng giữa trận / giữa Boss fight:** Tự động dọn sạch tham chiếu hồi sinh (`reviverPlayerId`), khối `ice_prison`, trụ/vùng kỹ năng của người rời đi; kiểm tra thua nếu những người còn lại đều đã gục; cập nhật lại Co-op scaling (HP & số lượng quái) ngay ở đầu phòng/đợt kế tiếp | ✅ PASS | `packages/shared/test/phase8-soak-release.test.ts` |
| 7 | **Chủ Phòng (Host) ngắt kết nối hoặc Kick người chơi:** Toàn bộ Client nhận thông báo tiếng Việt rõ ràng và quay về `MenuScene` an toàn | ✅ PASS | `tests/e2e/phase4.spec.ts` (`menu-host-disconnect-1080p.png`) |

---

## 8.6 Hiệu Năng, Soak Test 20 Phút & Tương Thích Trình Duyệt

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | **Soak Test 20 phút thời gian mô phỏng (`72.000` ticks @ 60Hz, 4P Co-op):** Liên tục giao tranh, tung kỹ năng, kích nổ phản ứng nguyên tố, qua nhiều tầng và đánh cả 3 Boss — không rò rỉ bộ nhớ, số thực thể nằm trong giới hạn Pool, thời gian mỗi tick `< 0.25 ms` không suy giảm | ✅ PASS | `packages/shared/test/phase8-soak-release.test.ts` |
| 2 | **Stress Test đồ họa 1080p High** (4 người chơi + 80 quái + 625 đạn + 48 nguồn sáng động + 230+ hạt particle + decal tại cả Biome 1 và Biome 3) giữ vững **~60 FPS** (`frameTime <= 17.5ms`) | ✅ PASS | `tests/e2e/phase2.spec.ts` & `tests/e2e/phase6.spec.ts` |
| 3 | **Build Production sạch sẽ (`pnpm build`):** Tách chunk `vendor-phaser`, `vendor-colyseus` và `index`, **0 cảnh báo kích thước chunk**, **0 lỗi TypeScript / ESLint** | ✅ PASS | `apps/client/vite.config.ts` & `pnpm build` |
| 4 | **Tương thích đa trình duyệt:** Chạy mượt mà với 0 lỗi/cảnh báo console trên **Playwright Chromium**, **Microsoft Edge (`msedge`)** và **Google Chrome (`chrome`)** | ✅ PASS | `tests/e2e/phase8.spec.ts` |

---

## 8.7 Trình Bày, Bản Phát Hành Windows & Hoàn Thiện

| # | Hạng mục kiểm tra | Trạng thái | Phương pháp & Bằng chứng kiểm chứng |
|---:|---|:---:|---|
| 1 | Hiển thị trọn vẹn dấu tiếng Việt (`"Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ"`) sắc nét ở cả 1080p và 1440p; đồng bộ 100% 450+ khóa đa ngôn ngữ `vi` / `en` | ✅ PASS | `tests/e2e/phase0.spec.ts`, `phase7.spec.ts` & `packages/shared/test/phase7-ui-audio.test.ts` |
| 2 | Màn hình Kết thúc lượt chơi hiển thị đầy đủ thống kê đội, **Bảng thống kê chi tiết từng người chơi** và **4 Danh hiệu MVP** | ✅ PASS | `tests/e2e/phase7.spec.ts` (`victory-mvp-awards.png`) |
| 3 | Đóng gói bản phát hành sạch vào `release/AshenPact-v0.1.0-win-x64/` và `release/AshenPact-v0.1.0-win-x64.zip` qua `pnpm package:release` (gồm `AshenPact-Host.exe`, `start-host.bat`, `allow-firewall-port-2567.bat`, `runtime/node.exe`, `server-bundle.cjs`, `client/`, `README.md`, `CREDITS.md`, `RELEASE_NOTES.md`) | ✅ PASS | `tools/package-release.ts` & `tests/e2e/phase8.spec.ts` |
| 4 | Chạy thực tế bản phát hành từ thư mục sạch không có `node_modules` / source code → Host khởi động in IP LAN + Mã QR ASCII ra Console, Client kết nối qua **IP LAN thực của máy**, vào Hub, khởi hành và vượt trọn 1 tầng Dungeon + hạ Boss | ✅ PASS | `tests/e2e/phase8.spec.ts` & `docs/screenshots/phase-8/` |
