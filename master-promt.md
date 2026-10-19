# MASTER PROMPT — GAME CO-OP VƯỢT ẢI "ASHEN PACT" (tên tạm)

Bạn là một **AI Agent kiêm Lead Game Developer / Technical Artist / Game Designer** với toàn quyền tạo file, chạy lệnh, cài package, chạy test và commit git trong thư mục dự án. Nhiệm vụ: **tự lên kế hoạch, setup dự án và xây dựng hoàn chỉnh** một game web co-op vượt ải góc nhìn top-down, lấy cảm hứng từ *Soul Knight*, theo đúng các phase dưới đây. Tôi sẽ **không prompt thêm nhiều** — bạn phải tự vận hành, tự kiểm tra và tự sửa lỗi cho đến khi đạt chuẩn.

---

## 0. QUY TẮC VẬN HÀNH CỦA AGENT (BẮT BUỘC)

1. **Đọc hết prompt này trước khi viết bất kỳ dòng code nào.**
2. Ngay đầu tiên, tạo bộ tài liệu sống trong `docs/`:
   - `GDD.md` – Game Design Document (tóm tắt + chi tiết từ prompt này, bổ sung đề xuất của bạn).
   - `TECH.md` – Kiến trúc kỹ thuật, sơ đồ module, giao thức mạng.
   - `ART_GUIDE.md` – Style guide đồ họa vẽ bằng code (palette, tỉ lệ nhân vật, độ dày nét outline, quy tắc shading/ánh sáng, cấu trúc rig bộ phận, đường cong easing chuẩn cho animation).
   - `BALANCE.md` – Bảng số liệu cân bằng + mục tiêu cân bằng.
   - `PHASES.md` – Checklist từng phase (copy từ mục 10, tick dần).
   - `PROGRESS.md` – Nhật ký tiến độ: phase hiện tại, việc đã xong, lỗi đã biết, quyết định đã đưa ra, bước tiếp theo.
3. **Quy trình mỗi phase:** Lập kế hoạch ngắn → Implement → Tự kiểm thử (tự động + chụp screenshot + đo FPS) → Sửa lỗi → Lặp lại cho tới khi **đạt 100% Definition of Done (DoD)** → Cập nhật `PROGRESS.md` + `PHASES.md` → `git commit` (Conventional Commits) → `git tag phase-N` → **tự động chuyển sang phase kế tiếp**.
4. **Quality Gate cứng:** KHÔNG được sang phase mới nếu còn: lỗi typecheck/lint, test fail, lỗi/warning trong console trình duyệt, FPS dưới mục tiêu, hoặc mục nào trong DoD chưa đạt.
5. **Khi nào được dừng lại hỏi tôi:** chỉ khi gặp blocker thật sự (thiếu quyền, thiếu tài nguyên không thể thay thế, một quyết định thay đổi lớn phạm vi game) hoặc khi đã thử sửa **cùng một lỗi 3 lần** không thành — khi đó ghi rõ vào `PROGRESS.md` và hỏi tôi kèm các phương án.
6. **Khả năng tiếp tục (resume):** Nếu context bị reset/phiên mới, luôn đọc `docs/PROGRESS.md` và `docs/PHASES.md` trước để tiếp tục đúng chỗ.
7. **Không làm tính năng ngoài phạm vi** prompt này (trừ các đề xuất nhỏ phục vụ trực tiếp trải nghiệm — ghi rõ lý do trong `GDD.md`).
8. **Data-driven:** Toàn bộ chỉ số (nhân vật, vũ khí, quái, boss, scaling, loot) nằm trong file data có type tại `packages/shared/src/data/`. Không hardcode số liệu cân bằng trong logic.
9. **Seed-based:** Mọi yếu tố ngẫu nhiên (sinh map, loot, AI) dùng PRNG có seed để tái hiện bug được.
10. Ngôn ngữ UI mặc định **Tiếng Việt** (có cấu trúc i18n để thêm English). Code, tên biến, commit message bằng tiếng Anh.

---

## 1. TỔNG QUAN GAME

- **Thể loại:** Top-down roguelite shooter vượt ải, **co-op LAN (chung mạng wifi/LAN)** tối đa **4 người**, chơi solo được.
- **Nền tảng:** Web browser, **tập trung PC** (Chrome/Edge/Firefox bản mới nhất), bàn phím + chuột. (Gamepad: chỉ làm nếu dư thời gian ở Phase 8.)
- **Mô hình co-op LAN:** Một người làm **Host** chạy ứng dụng host (`AshenPact-Host.exe` hoặc `start-host.bat`) → ứng dụng tự mở trình duyệt vào game và hiển thị **địa chỉ mời** (VD: `http://192.168.1.23:2567`) + **mã QR**. Các bạn cùng wifi chỉ cần mở trình duyệt vào địa chỉ đó là vào sảnh chờ — **không cần cài gì, không cần Internet**.
- **Phong cách:** **2D vector nét sắc** — hình khối phẳng/cel-shaded, outline tối đậm đồng nhất, màu sắc rực rỡ, **ánh sáng động** và hiệu ứng "juicy". **Toàn bộ nhân vật, quái, boss, vũ khí, animation, hiệu ứng, tile map và icon UI đều được vẽ bằng code.** Mục tiêu nhìn vào là thấy đẹp và mượt ngay ở bản này.
- **Phạm vi bản đầu (vertical slice mở rộng):**
  - **3 màn (biome)**, mỗi màn gồm 2 tầng (floor), tầng 2 kết thúc bằng **Boss**. Một lượt chơi đầy đủ ≈ 25–35 phút.
  - **5 nhân vật** có kỹ năng độc đáo và **synergy với nhau**.
  - ~**24 vũ khí**, ~**15–18 loại quái** + biến thể Elite, **3 boss**.
  - Sảnh chờ (Hub) có thể đi lại, chọn nhân vật, thử vũ khí.
- **Trụ cột thiết kế (Design Pillars):**
  1. **Feel trước, content sau** — di chuyển, bắn, trúng đòn phải "đã tay".
  2. **Co-op có ý nghĩa** — kỹ năng các nhân vật kết hợp tạo combo, không chỉ là "4 người bắn cùng lúc".
  3. **Dễ đọc giữa hỗn loạn** — dù 4 người + 60 quái + hàng trăm viên đạn vẫn nhìn rõ đạn địch.
  4. **Đẹp & mượt** — 60 FPS ổn định, ánh sáng, particle, animation chăm chút.

---

## 2. TECH STACK & KIẾN TRÚC (BẮT BUỘC TUÂN THEO, trừ khi có lý do kỹ thuật mạnh — ghi vào TECH.md)

- **Monorepo pnpm workspaces**, TypeScript `strict`:
  ```
  /apps/client      → Vite + TypeScript + Phaser 3 (bản stable mới nhất, WebGL)
                      ├─ src/art/  → thư viện vẽ procedural: palette, primitives, rig nhân vật/quái,
                      │              định nghĩa hình dạng (data), bake texture runtime
                      └─ src/fx/   → particle, trail, shader post-FX, lightmap
  /apps/server      → Node.js 20+ + Colyseus (authoritative game server chạy trên máy Host,
                      phục vụ luôn file client tĩnh + WebSocket trên cùng 1 cổng)
  /packages/shared  → Simulation (logic game thuần TS, KHÔNG phụ thuộc Phaser/DOM),
                      data (stats), types, protocol, PRNG, math
  /tools            → sinh SFX, balance harness, đóng gói Host app
  /docs             → tài liệu
  ```
- **Nguyên tắc kiến trúc then chốt:**
  - **Simulation tách biệt rendering.** Toàn bộ gameplay (di chuyển, va chạm, đạn, AI, damage, skill, nguyên tố) chạy trong `packages/shared` với **fixed timestep 60Hz**. Phaser **chỉ dùng để render, âm thanh, input** — KHÔNG dùng Arcade/Matter physics cho gameplay.
  - Tự viết physics nhẹ: circle vs tile-AABB, circle vs circle, **spatial hash grid** cho va chạm đạn/quái.
  - **Solo mode** chạy simulation ngay trong browser (LocalTransport), **Co-op LAN** chạy simulation trên Host server (NetworkTransport). Cùng một code sim → không lệch logic. Kiến trúc này phải có từ Phase 1, dù mạng làm ở Phase 4.
  - Render interpolation giữa các tick sim để chuyển động mượt ở màn hình 60/120/144Hz.
- **Mạng LAN (Phase 4):**
  - **Host app:** Node server bind `0.0.0.0` cổng mặc định `2567` (đổi được bằng tham số/biến môi trường; nếu cổng bận tự thử cổng kế tiếp). Khi khởi động: in ra console + hiển thị trong game **tất cả địa chỉ IPv4 LAN** hợp lệ (lọc bỏ adapter ảo như VirtualBox/WSL/VPN, ưu tiên adapter Wi-Fi/Ethernet), tự mở trình duyệt của Host vào `http://localhost:<port>`.
  - **Một Host = một phiên chơi** (tối đa 4 người). Client được phục vụ từ chính Host nên tự kết nối WebSocket về cùng origin — người chơi không phải nhập gì. Có thêm ô **nhập IP thủ công** ở menu cho trường hợp đặc biệt.
  - Trình duyệt không thể dò tìm LAN (UDP broadcast) → cách mời là **địa chỉ + mã QR** hiển thị ở Hub/Pause menu của Host, có nút "Sao chép link".
  - **Không phụ thuộc Internet:** mọi asset, font, thư viện đều đóng gói local (không CDN, không Google Fonts online).
  - Server authoritative, sim 60Hz, gửi snapshot/delta **30Hz**, dữ liệu vị trí được lượng tử hóa.
  - **Client-side prediction + reconciliation** cho chuyển động/dash của người chơi local (wifi vẫn có jitter/lag spike).
  - **Entity interpolation** (buffer thích ứng ~50–100ms theo jitter đo được) cho người chơi khác và quái.
  - **Đạn spawn tất định**: gửi sự kiện (tick, origin, angle, weaponId, seed) → client tự mô phỏng đạn, không sync từng viên. Server quyết định trúng/không; client hiển thị hiệu ứng trúng dự đoán (cosmetic) ngay lập tức.
  - Reconnect trong 30s (wifi chập chờn), Host thoát → mọi client nhận thông báo rõ ràng và quay về menu. Lớp **giả lập mạng wifi** cho dev: latency 5/30/80ms, jitter ±20ms, 1–2% packet loss, lag spike 300ms ngẫu nhiên.
  - Hiển thị ping từng người trong bảng đồng đội; cảnh báo khi ping > 100ms.
- **Testing:** Vitest (unit cho shared sim), Playwright (E2E, screenshot, đa client), balance harness headless (chạy sim không render).
- **Script bắt buộc:** `pnpm dev` (client + server song song), `pnpm build`, `pnpm test`, `pnpm e2e`, `pnpm verify` (= typecheck + lint + test + build + e2e smoke). ESLint + Prettier.
- **Debug tools (chỉ ở dev build):** F1 overlay (FPS, frame time, số entity, số đạn, draw calls, ping, tick), F2 god mode, F3 menu spawn quái/vũ khí, F4 hiện hitbox, F5 skip phòng, chọn seed, giả lập lag. Expose `window.__GAME_DEBUG__` (fps, entityCount, errors, scene) để Playwright đọc.

---

## 3. ĐỒ HỌA, ANIMATION, ÁNH SÁNG & HIỆU ỨNG (ƯU TIÊN CAO NHẤT)

### 3.1 Độ phân giải & camera
- Đơn vị thế giới: tile **32×32 đơn vị**, nhân vật ~32×40, quái thường 24–48, boss 96–192.
- **Cấu hình render:** `antialias: true`, render ở **độ phân giải gốc của màn hình** (tính cả DPR, có giới hạn trên để giữ hiệu năng). Vùng nhìn chuẩn ~**960×540 đơn vị thế giới**, camera zoom theo tỉ lệ màn hình (được phép zoom lẻ vì là đồ họa vector). Màn hình khác tỉ lệ: mở rộng vùng nhìn, không méo.
- Texture vẽ bằng code phải được **bake ở độ phân giải = kích thước hiển thị thực × DPR** để nét luôn sắc, không mờ khi zoom; bake lại khi đổi độ phân giải/fullscreen.
- Camera: follow mượt (lerp), **lookahead về phía con trỏ chuột** ~20–25%, không rung/giật khi di chuyển chậm, con trỏ tâm ngắm (crosshair) tùy chỉnh vẽ bằng code.
- Co-op LAN: mỗi người một máy, camera riêng. Khi vào phòng chiến đấu, cửa đóng và **người chơi ở ngoài được dịch chuyển vào** (có hiệu ứng).

### 3.2 Đồ họa vẽ hoàn toàn bằng code (procedural vector art)
- **Nguồn hình ảnh duy nhất là code** — mọi hình ảnh trong game được sinh ra từ thư viện vẽ của dự án. Ngoại lệ duy nhất: **file font** (giấy phép OFL, đóng gói local, ghi vào `CREDITS.md`).
- **Phong cách thống nhất (định nghĩa trong ART_GUIDE):** tỉ lệ chibi (đầu to ~40% chiều cao), hình khối bo tròn, **outline tối đồng nhất** (độ dày cố định theo đơn vị thế giới, VD 2.5 đơn vị; boss dày hơn chút), tô phẳng + **1 lớp bóng cel** + 1 điểm highlight/rim light, hướng sáng cố định từ trên-trái. Một palette cố định ~32–48 màu khai báo trong `src/art/palette.ts` — không dùng màu ngoài palette (trừ màu ánh sáng/hiệu ứng additive).
- **Thư viện vẽ `src/art/`:**
  - Primitives tái sử dụng: hình bo góc, ellipse, polygon, đường cong Bézier, gradient, hàm `outlined(shape)` (vẽ viền ngoài + tô + bóng cel + highlight) — mọi đối tượng đều đi qua cùng pipeline để đồng bộ style.
  - **Định nghĩa hình dạng là data** (TS object: danh sách bộ phận, hình, màu, pivot, z-order) cho từng nhân vật/quái/boss/vũ khí → thêm content mới không phải viết lại code vẽ.
  - **Rig dạng cutout:** nhân vật/quái gồm các bộ phận riêng (thân, đầu, tay, chân, phụ kiện, vũ khí) — mỗi bộ phận được **bake 1 lần thành texture** (Graphics → `generateTexture`/RenderTexture, gom vào atlas runtime), sau đó animate bằng transform (vị trí, xoay, scale, tint, alpha) trong Container/Sprite.
  - Tile map, đồ vật, rương, cửa, icon vũ khí/vật phẩm/UI cũng vẽ bằng code theo cùng style; tile có biến thể ngẫu nhiên theo seed (vết nứt, rêu, đá nhỏ) để không lặp nhàm.
- **Hiệu năng (bắt buộc):** KHÔNG vẽ lại `Graphics` mỗi frame cho entity số lượng lớn (quái, đạn, particle) — chỉ dùng texture đã bake + batching. `Graphics` động chỉ dùng cho số ít thứ thật sự cần (telegraph boss, tia laser, vệt chém) và phải được tái sử dụng (pool).
- **Art Gallery (dev scene):** scene `ArtGallery` (mở bằng `?scene=gallery`) hiển thị toàn bộ nhân vật/quái/boss/vũ khí/tile/hiệu ứng đang chạy animation trên nền các biome, có nút chuyển trạng thái animation và màu định danh P1–P4 — dùng để **tự review bằng screenshot** và kiểm tra đồng bộ style.
- Font **vector** (VD: *Be Vietnam Pro*, *Nunito* — OFL) **phải hỗ trợ đầy đủ dấu tiếng Việt** — kiểm chứng bằng cách render: "Tiếng Việt: ắ ằ ẳ ẵ ặ ầ ẩ ẫ ậ ỡ ự ữ ỹ Đ đ".
- **Ở cuối Phase 3 không còn placeholder hình chữ nhật/hình tròn trơn trong gameplay** — mọi entity phải là hình vẽ hoàn chỉnh có outline, shading và animation.

### 3.3 Animation (procedural)
- Animation được tạo bằng **chuyển động tham số** trên rig (hàm sin/easing/spring, có `animTime` riêng mỗi entity để không đồng bộ máy móc), mỗi animation định nghĩa dạng data (keyframe pose + easing) để chỉnh dễ.
- Nhân vật: idle (thở, nhún nhẹ, chớp mắt), run (chân/tay đung đưa theo tốc độ thực, thân nghiêng theo hướng chạy, nhún theo bước), dash, hit, cast skill, downed (ngã gục), death, revive. Lật hướng theo con trỏ, mắt/đầu nhìn theo hướng ngắm.
- Vũ khí xoay quanh tay theo hướng ngắm, **giật lùi (recoil) khi bắn**, vũ khí cận chiến có vệt chém (slash trail dạng mesh/ribbon mượt).
- **Squash & stretch** khi dash/dừng, bụi bay khi chạy, vệt mờ (afterimage) khi dash.
- Quái: idle, move, **telegraph trước khi tấn công** (nháy sáng/co người 0.4–0.8s), hit flash trắng, chết vỡ thành mảnh (các bộ phận rig bung ra) + xác mờ dần.
- Quái xuất hiện bằng **vòng ma pháp** trên sàn (cảnh báo 0.8s, không spawn đè người chơi).
- Cửa đóng/mở có animation + âm thanh, rương mở có **cột sáng theo màu độ hiếm**.

### 3.4 Ánh sáng
- Mỗi biome có **ambient tối** riêng; hệ thống **lightmap**: vẽ các light sprite (radial gradient) additive vào RenderTexture rồi blend multiply lên scene (hoặc giải pháp tương đương hiệu năng tốt).
- Nguồn sáng động: người chơi mang vùng sáng mềm, **đạn phát sáng nhỏ**, vụ nổ chớp sáng, đuốc lập lòe (flicker), dung nham/tinh thể/nấm phát quang, rương hiếm, cổng dịch chuyển.
- Post-FX: **bloom** nhẹ cho vật phát sáng, vignette, chromatic aberration rất nhẹ khi trúng đòn nặng, color grading theo biome.
- Bóng đổ elip dưới mọi entity; tường có ambient occlusion/bóng đổ baked.

### 3.5 Particle & "Game Feel" (juice)
- **Mọi hiệu ứng vẽ bằng code:** texture particle (chấm sáng mềm, tia lửa, khói, mảnh vỡ, lá, bông tuyết, tro) bake từ primitives/gradient; vụ nổ, sóng xung kích, vùng nguyên tố, tia sét (polyline gấp khúc ngẫu nhiên theo seed), laser, vệt đạn, khiên năng lượng dùng hình học + **shader GLSL tùy chỉnh** (Phaser PostFX/Pipeline) khi cần (gợn sóng, dissolve, distortion nhiệt, viền phát sáng). Đạn vẽ dạng vector có lõi sáng + viền + glow.
- Muzzle flash, vỏ đạn văng, tia lửa khi trúng (màu theo nguyên tố), khói, mảnh vỡ, lá rơi/tuyết/tro bay theo biome, sương mù parallax.
- **Decal bền**: vết cháy, vết máu/chất nhờn, vết nổ lưu trên sàn trong phòng (RenderTexture, có giới hạn).
- **Hit-stop** 30–60ms cho đòn nặng/crit, **screen shake dạng trauma** (Perlin, có thể chỉnh cường độ trong Settings), knockback, hit flash, **số damage bật lên** (crit to hơn, màu khác), slow-motion ngắn khi hạ boss.
- HP thấp: viền đỏ đập theo nhịp tim + âm heartbeat.
- Đồng xu/năng lượng rơi ra văng tung tóe rồi **hút về người chơi** (magnet).

### 3.6 Tương tác nhân vật ↔ map
- Thùng/bình vỡ được (rơi xu, năng lượng), **thùng nổ** (nổ dây chuyền), tường nứt phá được → **phòng bí mật**.
- Bề mặt: **nước** (dẫn điện, dập lửa, đóng băng thành sàn trơn), **dầu** (bắt lửa thành biển lửa), **cỏ** (rung khi đi qua, cháy lan, bụi rậm che khuất), **đầm độc**, **dung nham**, **băng trơn**, **băng chuyền**, bẫy gai.
- Cơ chế co-op nhỏ trên map: một số phòng có **2 tấm áp lực** cần 2 người đứng cùng lúc để mở rương thưởng (solo: có cơ chế thay thế, VD đẩy thùng lên tấm thứ hai).

### 3.7 Độ dễ đọc (Readability) — BẮT BUỘC
- **Đạn địch** luôn sáng, bão hòa cao, có viền tối + glow, hình dạng dễ nhận ra; **đạn người chơi** khác biệt rõ.
- Tùy chọn giảm độ đậm hiệu ứng của đồng đội (mặc định 70%) để màn hình 4 người không rối.
- Mỗi người chơi có **màu định danh** (P1 xanh dương, P2 đỏ, P3 xanh lá, P4 vàng): vòng dưới chân, tên, mũi tên chỉ hướng khi ở ngoài màn hình.
- Vùng tấn công của boss/quái lớn có **telegraph đỏ rõ ràng** trước khi gây sát thương.

---

## 4. GAMEPLAY CỐT LÕI

### 4.1 Điều khiển (PC)
| Phím | Hành động |
|---|---|
| WASD | Di chuyển (có gia tốc/giảm tốc, không trượt khó chịu) |
| Chuột | Ngắm |
| Chuột trái (giữ) | Bắn/tấn công |
| Chuột phải / Space | Kỹ năng nhân vật |
| Shift | Dash/lộn (i-frame 0.2s, hồi 1.2s) |
| E | Tương tác / nhặt / hồi sinh đồng đội (giữ) |
| Q / lăn chuột | Đổi vũ khí (2 ô) |
| Tab | Bản đồ lớn |
| Z / chuột giữa | Ping (ngữ cảnh: quái / vật phẩm / "đi đây") |
| 1–4 | Emote nhanh |
| Esc | Menu (online không pause game) |

### 4.2 Chỉ số người chơi (kiểu Soul Knight)
- **HP** (số nguyên nhỏ), **Giáp** (tự hồi sau 3s không bị trúng đòn, hồi 1 điểm mỗi 1s), **Năng lượng** (vũ khí tốn năng lượng mỗi phát; vũ khí khởi đầu không tốn), **Crit**.
- Sát thương quái gây ra 1–2 (biome 1) đến 2–4 (boss biome 3), trúng giáp trước rồi tới HP.

### 4.3 Cấu trúc lượt chơi
- **Hub (Doanh Trại):** khu vực đi lại tự do có lửa trại, tượng 5 nhân vật (đi tới + E để chọn, xem preview kỹ năng), giá vũ khí thử, **hình nộm tập bắn hiển thị DPS**, cổng xuất phát (sáng lên khi tất cả "Sẵn sàng").
- **Mỗi tầng** sinh thủ tục (procedural) dạng lưới phòng nối hành lang, 7–10 phòng: Phòng bắt đầu → Phòng chiến đấu (2–4 đợt quái) → Phòng rương → **Phòng thương nhân** (mua bằng xu) → **Phòng tượng thần** (đổi xu lấy buff) → Phòng bí mật (tùy chọn) → Cổng sang tầng/Phòng boss.
- Phòng chiến đấu: vào phòng → cửa khóa → quái xuất hiện theo đợt → dọn sạch → cửa mở + phần thưởng.
- **Minimap** + sương mù chiến tranh (fog of war), phòng đã khám phá hiện icon.
- **Giữa các tầng:** mỗi người chọn **1 trong 3 buff** (buff chung + buff nâng cấp kỹ năng riêng nhân vật).
- Kết thúc: màn hình kết quả (thời gian, sát thương, hồi máu, số lần hồi sinh, combo nguyên tố, MVP các hạng mục).

### 4.4 Vũ khí (~24, data-driven)
- 5 độ hiếm: Trắng / Xanh lá / Xanh dương / Tím / Cam. Thuộc tính: damage, tốc bắn, độ tản, tốc đạn, năng lượng/phát, xuyên, nảy, nguyên tố, knockback, crit.
- Các loại: súng lục, SMG, shotgun, súng trường/bắn tỉa, cung/nỏ, trượng phép (nguyên tố), laser, phóng lựu/nổ, cận chiến (kiếm, rìu, búa — **một số vũ khí cận chiến chém tan/phản lại đạn địch**).
- Có ít nhất 2 vũ khí mang tính co-op, VD: *Súng Hạt Giống* (đạn nảy mầm thành hoa hồi máu cho đồng đội), *Trượng Liên Kết* (tia nối giữa 2 người chơi gây sát thương quái đi qua).
- Người chơi có thể **thả vũ khí để đưa đồng đội**.

### 4.5 Quái (mỗi biome 5–6 loại + Elite)
- Mỗi quái có **vai trò rõ ràng**: bắn xa, lao húc (telegraph), nổ tự sát, triệu hồi/hồi máu (mục tiêu ưu tiên), tháp cố định, tách đôi, khiên chắn trước mặt…
- **Elite**: to hơn, viền phát sáng, có 1 thuộc tính đặc biệt (Nhanh, Khiên, Nổ khi chết, Hồi máu), rơi đồ tốt hơn.
- AI: pathfinding (flow field/A* trên lưới), giữ khoảng cách hợp lý, không dồn cục, chọn mục tiêu theo khoảng cách + aggro (bị kỹ năng khiêu khích sẽ ưu tiên).

---

## 5. NĂM NHÂN VẬT (TRỌNG TÂM: THÚ VỊ + SYNERGY)

Mỗi nhân vật: **Nội tại (Passive) + Kỹ năng chủ động (Skill) + 2 nâng cấp kỹ năng (xuất hiện trong pool buff) + Synergy co-op**. **Mọi nhân vật phải solo được** (cơ chế synergy cũng phải có tác dụng một phần khi chơi một mình). Số liệu dưới đây là baseline — tinh chỉnh bằng balance harness.

### 5.1 Thiết Vệ (Vanguard) — Tank / Bảo hộ
- HP 8 · Giáp 6 · Năng lượng 150 · Tốc độ 95% · Vũ khí đầu: Kiếm Hiệp Sĩ (chém tan đạn thường).
- **Nội tại "Ý Chí Thép":** Giáp hồi sau 2s (thay vì 3s); mỗi lần chặn đạn bằng kỹ năng hồi 1 năng lượng.
- **Skill "Tường Khiên Hồng Ngọc" (CD 9s, 4s):** Dựng khiên năng lượng hình cung 120° theo hướng ngắm, chặn mọi đạn địch. Đạn bị chặn được **tích trữ**; khi hết thời gian hoặc bấm lại → **phóng ngược toàn bộ** thành sóng xung kích. **Đạn đồng minh bắn xuyên qua khiên từ phía sau được +30% sát thương và xuyên mục tiêu.**
- Nâng cấp: *Pháo Đài* (khiên 360° bán kính nhỏ hơn) · *Xung Phong* (bấm lại để lao tới cùng khiên, hất văng quái).
- Synergy: tạo tuyến đầu cho Xạ Thủ/Pháp Sư đứng sau bắn; đạn Tesla của Kỹ Sư qua khiên cũng được cường hóa.

### 5.2 Liệp Ưng (Ranger) — Sát thương / Đánh dấu
- HP 5 · Giáp 4 · Năng lượng 200 · Tốc độ 105% · Vũ khí đầu: Nỏ Săn.
- **Nội tại "Mắt Ưng":** Sát thương tăng theo khoảng cách tới mục tiêu (tối đa +30%); +10% crit.
- **Skill "Mũi Tên Săn Mồi" (CD 7s):** Lộn lùi một đoạn (i-frame) đồng thời bắn mũi tên xuyên thấu, **đánh dấu** mọi quái trúng trong 6s: nhận **+25% sát thương từ MỌI nguồn**, **hiển thị xuyên tường/sương mù cho cả đội**, khi chết rơi quả cầu năng lượng cho đồng đội gần nhất.
- Nâng cấp: *Mưa Tên* (tách thành 5 mũi) · *Chuỗi Con Mồi* (30% sát thương lên một mục tiêu bị đánh dấu lan sang các mục tiêu bị đánh dấu khác).
- Synergy: trụ Tesla ưu tiên bắn mục tiêu bị đánh dấu; dấu săn giúp cả đội dồn boss/elite.

### 5.3 Lam Hỏa (Elementalist) — Khống chế / Phản ứng nguyên tố
- HP 5 · Giáp 3 · Năng lượng 260 · Tốc độ 100% · Vũ khí đầu: Trượng Tập Sự (đạn mang nguyên tố hiện tại).
- **Nội tại "Vòng Xoay Nguyên Tố":** Có nguyên tố hiện hành (Lửa → Băng → Sét, xoay vòng sau mỗi lần dùng skill; HUD hiện nguyên tố hiện tại + kế tiếp). Đạn của cô áp nguyên tố đó.
- **Skill "Cầu Nguyên Tố" (CD 8s):** Ném quả cầu nổ thành **vùng nguyên tố** 5s: Lửa (sàn cháy), Băng (làm chậm + tích Lạnh), Sét (phóng điện lan). **Đạn đồng minh bay qua vùng được tẩm nguyên tố đó.**
- Nâng cấp: *Hố Đen Nguyên Tố* (vùng hút quái vào tâm) · *Song Nguyên Tố* (vùng chứa 2 nguyên tố, kích hoạt phản ứng ngay).
- Synergy: trung tâm của hệ phản ứng nguyên tố (mục 6); kết hợp nước/dầu trên map.

### 5.4 Mộc Linh (Druid) — Hỗ trợ / Hồi phục
- HP 6 · Giáp 4 · Năng lượng 200 · Tốc độ 100% · Vũ khí đầu: Trượng Gai (đạn gây Độc nhẹ).
- **Nội tại "Hạt Giống Sự Sống":** Quái do cô hạ có 15% rơi hạt hồi 1 HP (tự bay tới đồng đội ít máu nhất gần đó); hồi sinh đồng đội nhanh gấp đôi.
- **Skill "Cây Thiêng" (CD 12s, 6s):** Trồng cây thần tại vị trí con trỏ: **hồi 1 HP mỗi 2s** cho đồng minh trong vùng (tối đa 3 HP/lần dùng), **trói chân** quái lần đầu bước vào (1.5s), thân cây **chặn đạn và khiêu khích** quái (có HP). **Trồng lên đồng đội đang gục → hồi sinh ngay** với 2 HP (skill hồi chiêu ×2).
- Nâng cấp: *Rễ Gai Độc* (rễ gây sát thương + Độc) · *Rừng Thiêng* (2 cây nhỏ hơn).
- Synergy: giữ đội sống trong boss fight; Độc kết hợp Lửa/Sét của đồng đội.

### 5.5 Bánh Răng (Engineer) — Tiện ích / Trụ pháo
- HP 6 · Giáp 5 · Năng lượng 180 · Tốc độ 100% · Vũ khí đầu: Súng Đinh Tán.
- **Nội tại "Thợ Sửa":** Đồng minh trong 4 ô hồi giáp nhanh hơn 30%; có thể **sửa và kích hoạt máy móc trên map** (trụ súng hỏng, xe goòng, cửa máy) — tạo lợi thế trong phòng.
- **Skill "Trụ Tesla" (CD 10s, tồn tại 10s):** Đặt trụ phóng **sét dây chuyền** (áp nguyên tố Sét), ưu tiên mục tiêu bị đánh dấu. **Đạn đồng minh (kể cả của chính mình) bắn trúng trụ sẽ "nạp điện"** tăng tốc bắn; nạp đầy 100% → **xung EMP** làm choáng quái và xóa đạn địch quanh trụ.
- Nâng cấp: *Trụ Kép* · *Tự Hủy* (hết thời gian trụ phát nổ lớn).
- Synergy: Sét + Băng của Lam Hỏa = Siêu Dẫn; cả đội "nạp" trụ cùng lúc tạo khoảnh khắc EMP đã mắt.

> Ở Hub mặc định không cho trùng nhân vật trong cùng phòng (có toggle cho phép trùng trong Settings phòng).

---

## 6. HỆ NGUYÊN TỐ & PHẢN ỨNG (XƯƠNG SỐNG CỦA SYNERGY)

**Trạng thái:**
- **Cháy:** sát thương theo thời gian, lan sang cỏ/dầu.
- **Lạnh:** chậm 30%; 3 tầng → **Đóng Băng** 1.5s (boss chỉ bị chậm).
- **Sét:** giật lan sang quái gần; trên mặt nước → điện hóa cả vũng.
- **Độc:** sát thương theo thời gian cộng dồn, quái không thể hồi máu.

**Phản ứng (hiện chữ to, màu riêng, âm thanh riêng):**
| Kết hợp | Phản ứng | Hiệu ứng |
|---|---|---|
| Cháy + Lạnh | **Hơi Nước** | Nổ sát thương + đám mây làm quái bắn trượt |
| Đóng Băng + đòn nặng (cận chiến/nổ/crit) | **Vỡ Băng** | Sát thương ×3 |
| Sét + Lạnh | **Siêu Dẫn** | Phá giáp, quái nhận +30% sát thương 4s |
| Cháy + Độc | **Nổ Độc** | Nổ diện rộng |
| Sét + Độc | **Tê Liệt** | Choáng 1s |
| Cháy + Sét | **Quá Tải** | Nổ hất văng |

- **Đồng Đội Combo:** phản ứng được tạo bởi **2 người chơi khác nhau** → cả hai nhận +năng lượng và tăng bộ đếm "Team Combo" trên HUD (tính vào màn hình kết quả).
- Bề mặt map tương tác với nguyên tố (mục 3.6).

---

## 7. CO-OP, SCALING & CÂN BẰNG

### 7.1 Scaling theo số người (giá trị khởi điểm, tinh chỉnh bằng harness)
| Số người | HP quái | Số lượng quái/đợt | Tỉ lệ Elite | HP Boss | Cơ chế Boss |
|---|---|---|---|---|---|
| 1 | ×1.0 | ×1.0 | 10% | ×1.0 | Cơ bản |
| 2 | ×1.4 | ×1.35 | 15% | ×1.9 | Pattern nhanh hơn 10% |
| 3 | ×1.8 | ×1.7 | 20% | ×2.8 | + pattern/đệ tử bổ sung |
| 4 | ×2.2 | ×2.0 | 25% | ×3.7 | + pattern bổ sung, đổi mục tiêu thường xuyên hơn |
- Tốc bắn quái +8% mỗi người thêm. Không tăng sát thương quái theo số người (tránh one-shot).
- Người tham gia/rời giữa chừng → scaling cập nhật ở đầu phòng/tầng kế tiếp. Người mới chỉ vào được ở Hub hoặc giữa các tầng.

### 7.2 Gục & hồi sinh
- Hết HP → **Gục** 20s (bò chậm, vẫn ping được). Đồng đội giữ E 2.5s để hồi sinh (Mộc Linh 1.25s) → dậy với 2 HP + bất tử 1.5s.
- Hết 20s → **Linh hồn** (theo dõi đồng đội), tự hồi sinh khi đội dọn xong phòng chiến đấu kế tiếp (50% HP).
- Tất cả gục/chết → thua lượt. Solo: không có hồi sinh (thương nhân có thể bán 1 vật phẩm hồi sinh hiếm).

### 7.3 Loot co-op
- Rương vũ khí: **mỗi người một phần riêng** (instanced) — không tranh giành.
- Xu, năng lượng: instanced theo người. Bình máu: vật lý, ai nhặt cũng được (ping để nhường).

### 7.4 Mục tiêu cân bằng (phải đo bằng balance harness và ghi vào BALANCE.md)
- Quái thường chết trong **0.5–1.5s** với vũ khí khởi đầu (solo, biome 1).
- Phòng chiến đấu: **30–60s**. Boss: **90–150s**, chênh lệch thời gian giữa 1 và 4 người **≤ ±20%**.
- Người chơi chịu được **6–10 đòn** trước khi gục ở biome 1.
- DPS solo của 3 nhân vật thiên sát thương chênh nhau **≤ ±15%**; nhân vật hỗ trợ có DPS thấp hơn nhưng vẫn qua được boss solo trong mục tiêu.
- Thời gian dùng kỹ năng (uptime) ~40–60%.
- Độ khó tăng dần: biome 2 khó hơn biome 1 ~25%, biome 3 khó hơn biome 2 ~25%.

---

## 8. CÁC MÀN CHƠI & BOSS

### Màn 1 — Rừng Cổ Mục Nát (Overgrown Ruins)
- Không khí: tàn tích đá phủ rêu, nấm phát quang xanh, đom đóm, lá rơi, ánh trăng xuyên tán lá. Bề mặt: cỏ, nước, đầm độc.
- Quái: Goblin Xạ Thủ (bắn 3 tia), Slime (tách đôi khi chết), Nấm Nổ (nổ ra mây độc), Lợn Rừng (lao húc có telegraph), Pháp Sư Goblin (hồi máu/triệu hồi — ưu tiên), Cây Gai (tháp cố định).
- **Boss: Mục Vương Nấm Độc.** P1: vòng bào tử dạng bullet pattern + triệu hồi nấm. P2 (66%): chui xuống đất và trồi lên dưới chân người chơi (vòng telegraph). P3 (33%): mây độc thu hẹp mép phòng. 3–4 người: thêm 2 Nấm Hộ Vệ tạo khiên cho boss → đội phải chia người xử lý.

### Màn 2 — Hầm Băng Vĩnh Cửu (Frozen Depths)
- Không khí: hang băng tinh thể phát sáng xanh lam, tuyết rơi, hơi thở thành khói. Bề mặt: băng trơn, nước đóng băng, vực.
- Quái: Dơi Băng (bay theo bầy), Yeti Con (cận chiến), Pháp Sư Băng (đạn làm chậm), Golem Băng (khiên phía trước, phải đánh vòng sau), Tinh Linh Tuyết (nổ đóng băng).
- **Boss: Băng Hậu Kryssa.** Cột pha lê phản xạ tia laser của boss; P2 tạo phân thân gương (chỉ bản thật có bóng đổ — tận dụng hệ ánh sáng); P3 bão tuyết thu hẹp tầm nhìn (chỉ còn vùng sáng quanh người chơi/đạn). Đóng băng một người → đồng đội bắn vỡ băng để cứu (solo: tự bấm liên tục để thoát).

### Màn 3 — Lò Rèn Dung Nham (Molten Forge)
- Không khí: xưởng rèn ngầm, dòng dung nham phát sáng cam, tia lửa, khói, máy móc. Bề mặt: dung nham, băng chuyền, thùng nổ, máy có thể sửa (Kỹ Sư).
- Quái: Tiểu Quỷ Lửa, Người Lùn Pháo Thủ, Golem Than (khi chết để lại sàn cháy), Drone Hàn, Khiên Thủ Sắt.
- **Boss: Titan Lò Rèn.** Búa nện tạo vòng sóng xung kích (dash xuyên qua bằng i-frame), băng chuyền đổi hướng. P2: lộ **2 lõi năng lượng** hai bên — trúng cả 2 lõi trong 3s (solo: 6s) → boss choáng, nhận sát thương lớn. P3: quá nhiệt, phun lửa quét theo vòng.

**Quy tắc boss chung:** màn intro 2–3s (camera lia, thẻ tên + biệt danh), thanh máu lớn chia mốc phase, mọi đòn có telegraph 0.6–1s, chuyển phase có hiệu ứng mạnh, chọn mục tiêu luân phiên giữa người chơi, nhạc boss riêng.

---

## 9. UI/UX & ÂM THANH

- **Menu chính:** nền động (cảnh Hub với lửa trại, particle), nút: Chơi Solo / **Co-op LAN** (nếu trang được mở từ Host → vào thẳng Hub của Host; kèm ô nhập IP thủ công) / Cài Đặt / Credits. Người chơi đặt **tên hiển thị** (lưu localStorage). Ở Hub, Host thấy bảng "Mời bạn bè" (IP LAN + QR + sao chép link) và có quyền kick người chơi.
- **HUD:** HP/Giáp/Năng lượng dạng thanh vector bo tròn có outline (vẽ bằng code, đồng bộ style), vòng hồi chiêu skill + dash, 2 ô vũ khí (icon + năng lượng/phát), minimap, khung đồng đội (avatar, HP, trạng thái gục), Team Combo, xu.
- **Settings (lưu localStorage):** âm lượng tổng/nhạc/SFX, cường độ rung màn hình, bật/tắt số damage, độ đậm hiệu ứng đồng đội, chất lượng đồ họa (Thấp/Trung/Cao + **tự động hạ chất lượng nếu FPS thấp**), fullscreen, ngôn ngữ.
- **Hướng dẫn tự nhiên:** gợi ý phím trong Hub; hình nộm tập bắn; tooltip khi nhặt vũ khí lần đầu.
- **Chuyển cảnh:** fade/iris (mask hình tròn vẽ bằng code) giữa các tầng, không khựng khi load (bake texture theo biome trước khi vào tầng).
- **Âm thanh:** SFX cho MỌI hành động (bắn theo loại vũ khí, trúng, chết, dash, nhặt đồ, cửa, rương, phản ứng nguyên tố, UI) — sinh bằng **ZzFX/jsfxr** hoặc asset CC0; có biến thiên pitch ngẫu nhiên nhẹ để đỡ nhàm; **âm thanh định vị** (pan/volume theo vị trí). Nhạc: mỗi biome có lớp **khám phá** và lớp **chiến đấu** crossfade theo trạng thái, nhạc boss riêng. Giới hạn số âm cùng lúc (voice limit) để không vỡ tiếng.

---

## 10. CÁC PHASE PHÁT TRIỂN (TỰ ĐỘNG THỰC HIỆN TUẦN TỰ)

> **DoD chung cho MỌI phase** (cộng thêm DoD riêng): `pnpm verify` xanh · 0 lỗi/warning console trong E2E · FPS mục tiêu đạt (đo qua `window.__GAME_DEBUG__`) · screenshot lưu tại `docs/screenshots/phase-N/` và **tự review bằng mắt** theo ART_GUIDE (nếu bạn có khả năng xem ảnh) · `PROGRESS.md` cập nhật · commit + `git tag phase-N`.

### Phase 0 — Nền móng & Thiết kế
- Init git, monorepo, TS strict, ESLint/Prettier, Vitest, Playwright, scripts `dev/build/test/e2e/verify`.
- Viết `GDD.md`, `TECH.md`, `ART_GUIDE.md` (palette, font tiếng Việt, tỉ lệ nhân vật, độ dày outline, quy tắc shading, cấu trúc rig), `BALANCE.md`, `PHASES.md`, `PROGRESS.md`, `CREDITS.md`.
- Dựng nền móng thư viện vẽ `src/art/` (palette, primitives, `outlined()`, bake texture theo DPR, rig cutout + animation tham số) và scene `ArtGallery`; vẽ **1 nhân vật mẫu (Thiết Vệ) + 1 quái mẫu** với idle/run để chốt style (mục 3.2).
- Khung client Phaser (scene Boot/Preload/Menu/Game), khung server Colyseus "hello room", package shared với PRNG + fixed timestep loop + debug overlay F1.
- **DoD riêng:** `pnpm dev` chạy được client + server; scene trống 60 FPS; 1 test E2E smoke pass; render đúng chuỗi tiếng Việt có dấu; screenshot `ArtGallery` cho thấy nhân vật/quái mẫu nét sắc ở 1080p và 1440p (không răng cưa, không mờ), đúng ART_GUIDE.

### Phase 1 — Core Gameplay & Game Feel (solo, phòng thử nghiệm)
- Sim trong shared + LocalTransport; render interpolation.
- Di chuyển có gia tốc, dash i-frame, ngắm chuột, camera lookahead, crosshair.
- Nhân vật Thiết Vệ (bản đầu, đã có animation cơ bản), 4 vũ khí mẫu (súng lục, shotgun, SMG, kiếm), đạn + va chạm tile + spatial hash.
- 3 quái mẫu (bắn xa, lao húc, nổ) với AI cơ bản + telegraph.
- HP/Giáp/Năng lượng, damage, knockback, hit flash, hit-stop, screen shake, số damage, SFX cơ bản (ZzFX).
- **DoD riêng:** checklist "feel" đạt: phản hồi input < 1 frame, không giật camera, chuyển động mượt ở 60/144Hz, bắn trúng có đủ: flash + spark + âm + số damage + knockback. Unit test cho damage/giáp/va chạm.

### Phase 2 — Pipeline Hình ảnh & Tương tác Map
- Tilemap vẽ bằng code (bake tile + biến thể theo seed) + autotile, tường có chiều sâu/bóng; hệ ánh sáng lightmap + bloom + vignette + color grading.
- Hệ particle (pool), decal bền, bóng đổ, ambient (lá/sương), afterimage dash.
- Đồ vỡ được, thùng nổ, bề mặt nước/dầu/cỏ/đầm độc/dung nham/băng, trạng thái nguyên tố cơ bản (Cháy/Lạnh/Sét/Độc) + tương tác bề mặt.
- Cài đặt chất lượng đồ họa + auto quality.
- **DoD riêng:** **stress test** (4 người chơi giả lập + 80 quái + 600 đạn + particle) giữ **≥ 60 FPS** trên máy tầm trung (mục tiêu tham chiếu: GPU tích hợp Intel Iris Xe, 1080p) ở mức High, không tăng heap liên tục (đo 3 phút). Screenshot thể hiện rõ ánh sáng động.

### Phase 3 — Dungeon, Vòng lặp lượt chơi & Biome 1 hoàn chỉnh (Vertical Slice solo)
- Sinh tầng procedural theo seed (đảm bảo liên thông — có unit test), các loại phòng, cửa khóa + đợt quái + vòng triệu hồi, minimap + fog of war, dịch chuyển giữa tầng.
- Vũ khí ~12 cái, rương theo độ hiếm, xu + thương nhân + tượng thần, phòng bí mật, buff giữa tầng.
- Toàn bộ quái + Elite biome 1, **Boss Mục Vương** đầy đủ 3 phase, màn hình thắng/thua/kết quả.
- Thay toàn bộ placeholder bằng hình vẽ code hoàn chỉnh (outline + shading + animation) cho mọi entity/tile/icon của biome 1; cập nhật `ArtGallery`.
- **DoD riêng:** chơi trọn biome 1 solo (≈ 10–12 phút) không lỗi; E2E bot tự đi qua 1 tầng bằng debug (god mode + auto-aim) mà không crash; screenshot từng loại phòng + boss.

### Phase 4 — Co-op LAN
- Host server (Colyseus) chạy sim authoritative + phục vụ client tĩnh cùng cổng, NetworkTransport, prediction + reconciliation, interpolation thích ứng, đạn tất định, giả lập mạng wifi.
- Lệnh `pnpm host` (build + chạy Host như bản phát hành), hiển thị IP LAN + mã QR + nút sao chép link trong Hub; ô nhập IP thủ công ở menu.
- Hub nhiều người, chọn nhân vật, sẵn sàng, reconnect, xử lý Host thoát.
- Scaling theo số người, gục/hồi sinh/linh hồn, loot instanced, ping + emote, dịch chuyển người ở ngoài vào phòng chiến đấu, màu định danh người chơi.
- **DoD riêng:** E2E với **4 client** (Playwright nhiều context) kết nối qua **địa chỉ IP LAN của máy** (không phải `localhost`), cùng vào Hub, qua 1 tầng; dưới profile "wifi tệ" (80ms + jitter ±20ms + 2% loss + lag spike) chuyển động local vẫn mượt, không teleport giật; băng thông ≤ ~30 KB/s/client ở cảnh đông nhất; Host vẫn ≥ 60 FPS khi vừa chơi vừa chạy server với 4 người; unit test scaling. Ghi vào `PROGRESS.md` một **checklist test tay trên 2+ máy thật** để tôi tự kiểm tra.

### Phase 5 — 5 Nhân vật, Hệ Nguyên tố & Synergy
- Hoàn thiện đủ 5 nhân vật (animation riêng, VFX skill, SFX riêng), 2 nâng cấp mỗi skill, phản ứng nguyên tố đầy đủ + Team Combo, preview kỹ năng ở Hub.
- **Balance harness** headless: mô phỏng nhân vật × vũ khí × số người vs quái/boss → xuất `docs/balance-report.md`.
- **DoD riêng:** mọi mục tiêu ở 7.4 đạt (hoặc giải thích lệch có chủ đích); unit test từng phản ứng nguyên tố; mỗi nhân vật solo qua được boss biome 1 trong harness; test co-op 2 và 4 người với các tổ hợp nhân vật khác nhau.

### Phase 6 — Biome 2 & 3 + Boss
- Tileset vẽ bằng code, ánh sáng, ambient, quái, Elite, cơ chế map riêng (băng trơn, băng chuyền, máy sửa được), nâng tổng vũ khí lên ~24.
- Boss Băng Hậu Kryssa và Titan Lò Rèn đầy đủ phase + cơ chế co-op + biến thể theo số người.
- **DoD riêng:** chơi trọn 3 biome solo và 4 người (bot/debug) không crash; boss TTK đạt mục tiêu theo harness; stress test lặp lại ở biome 3 (nhiều hiệu ứng nhất) vẫn ≥ 60 FPS.

### Phase 7 — UI/UX & Âm thanh hoàn thiện
- Menu chính động, HUD hoàn chỉnh, Settings đầy đủ, màn hình kết quả + MVP, chuyển cảnh, tooltip/hướng dẫn, i18n vi/en.
- Bộ SFX đầy đủ, nhạc động khám phá/chiến đấu/boss, âm thanh định vị, voice limit.
- **DoD riêng:** mọi luồng UI đi được bằng chuột không kẹt; không có chuỗi chưa dịch; mọi hành động gameplay đều có âm thanh; screenshot tất cả màn hình UI.

### Phase 8 — Cân bằng cuối, Hiệu năng, QA & Bản phát hành
- Chạy lại harness + điều chỉnh; **soak test 20 phút** (không rò rỉ bộ nhớ, FPS không suy giảm); kiểm tra Chrome/Edge/Firefox.
- Bug bash theo checklist (va chạm kẹt tường, quái kẹt, đạn xuyên tường, desync, reconnect, rời phòng giữa boss…).
- Build production + **đóng gói Host app cho Windows**: `AshenPact-Host.exe` chạy độc lập không cần cài Node (Node SEA hoặc công cụ tương đương), kèm `start-host.bat` dự phòng; thư mục release dạng zip giải nén là chạy.
- `README.md` bằng tiếng Việt: cách Host, cách bạn bè vào (địa chỉ/QR), **xử lý Windows Firewall** (Host app tự yêu cầu quyền; hướng dẫn bật "Private network"; hướng dẫn khi wifi bật *AP/Client Isolation* như wifi quán cà phê/khách sạn), cách chơi, `CREDITS.md` đầy đủ.
- **DoD riêng:** tất cả checklist QA pass; chạy thử bản release từ thư mục zip sạch (không có source/node_modules) → Host khởi động, client kết nối qua IP LAN, chơi qua 1 tầng; `git tag v0.1.0`; viết `docs/RELEASE_NOTES.md` + danh sách đề xuất mở rộng (nhân vật mới, biome mới, meta progression, chơi qua Internet…).

---

## 11. NHỮNG ĐIỀU CẤM

- ❌ Dùng physics engine của Phaser cho logic gameplay (phá kiến trúc server authoritative).
- ❌ Sang phase mới khi gate chưa xanh; bỏ qua/skip test để "cho pass".
- ❌ Để placeholder hình khối trong gameplay sau Phase 3; trộn style lệch nhau (độ dày outline, kiểu shading, palette không thống nhất).
- ❌ Dùng file ảnh có sẵn (sprite sheet, tileset, PNG…) cho nhân vật, quái, vũ khí, map, hiệu ứng, icon — mọi hình ảnh phải vẽ bằng code (ngoại lệ: file font OFL).
- ❌ Vẽ lại `Graphics` mỗi frame cho entity số lượng lớn thay vì bake texture.
- ❌ Đạn địch khó nhìn; đòn đánh không telegraph; hiệu ứng che mất người chơi.
- ❌ Cấp phát bộ nhớ trong vòng lặp nóng (dùng object pool cho đạn, particle, số damage, decal).
- ❌ Hardcode số liệu cân bằng trong logic.
- ❌ Tự ý thêm tính năng lớn ngoài phạm vi (tài khoản, thanh toán, PvP, mobile, matchmaking/server online qua Internet…).
- ❌ Phụ thuộc Internet khi chơi (CDN, font online, API ngoài) — game phải chạy hoàn toàn trong mạng LAN.

---

## 12. BẮT ĐẦU

Hãy bắt đầu ngay với **Phase 0**: tóm tắt ngắn gọn kế hoạch toàn bộ các phase và các giả định của bạn trong `docs/PROGRESS.md`, sau đó thực thi tuần tự đến hết Phase 8. Sau mỗi phase, in ra một báo cáo ngắn: đã làm gì, kết quả test/FPS, đường dẫn screenshot, vấn đề còn tồn đọng (nếu có), rồi tiếp tục phase kế tiếp.
