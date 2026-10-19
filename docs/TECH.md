# KIẾN TRÚC KỸ THUẬT (TECH.md) — ASHEN PACT

## 1. Cấu Trúc Monorepo (`pnpm` Workspaces)
Dự án sử dụng `pnpm` workspaces với TypeScript `strict: true` trên toàn bộ các package:

```text
/
├─ apps/
│  ├─ client/                # Vite + TypeScript + Phaser 3 (WebGL Renderer)
│  │  ├─ public/fonts/       # Font OFL đóng gói local (Be Vietnam Pro)
│  │  └─ src/
│  │     ├─ art/             # Procedural Vector Art pipeline (palette, primitives, bake, rigs)
│  │     ├─ fx/              # Particle pool, trails, lightmap, custom PostFX shaders
│  │     ├─ scenes/          # BootScene, PreloadScene, MenuScene, GameScene, ArtGalleryScene
│  │     ├─ ui/              # DebugOverlay (F1), HUD, Menus, i18n
│  │     └─ network/         # LocalTransport & NetworkTransport (Colyseus client)
│  └─ server/                # Node.js 20+ + Colyseus + Express static server (cùng cổng 2567)
│     └─ src/
│        ├─ rooms/           # AshenPactRoom (Hello/Game Room, authoritative 60Hz loop)
│        └─ utils/           # LAN IPv4 discovery, port fallback
├─ packages/
│  └─ shared/                # Pure TypeScript (KHÔNG phụ thuộc Phaser/DOM/Node)
│     └─ src/
│        ├─ core/            # Seeded PRNG (Mulberry32), FixedTimestepLoop (60Hz)
│        ├─ math/            # Vec2, Circle-AABB, Circle-Circle, SpatialHashGrid
│        ├─ data/            # Data-driven stats (characters, enemies, weapons, biomes, scaling)
│        ├─ sim/             # Deterministic/Authoritative World Simulation
│        └─ protocol/        # Message types, quantized snapshot/delta schemas, ITransport
├─ tools/                    # Balance harness, SFX generator, Host bundler scripts
├─ tests/e2e/                # Playwright E2E test suite & screenshot verification
└─ docs/                     # Tài liệu sống (GDD, TECH, ART_GUIDE, BALANCE, PHASES, PROGRESS, CREDITS)
```

---

## 2. Nguyên Tắc Tách Biệt Simulation & Rendering

```text
+-------------------------------------------------------------------+
|                        packages/shared                            |
|  FixedTimestepLoop (60Hz = 16.6667ms) + SeededPRNG + Data Tables  |
|  WorldSim: Entities, Movement, SpatialHash, Projectiles, AI, Loot |
+-------------------------------------------------------------------+
                ▲                                   ▲
                | LocalTransport (Solo)             | NetworkTransport (Co-op LAN)
                ▼                                   ▼
+-------------------------------+   +-------------------------------+
|      apps/client (Phaser)     |   |     apps/server (Colyseus)    |
| - Input sampling              |   | - Authoritative 60Hz Sim      |
| - Render interpolation (alpha)|   | - 30Hz Quantized Snapshots    |
| - Procedural Texture Baking   |   | - Static HTTP file serving    |
| - Cutout Rig Transform Anim   |   | - LAN IPv4 + QR Code endpoint |
+-------------------------------+   +-------------------------------+
```

1. **Không dùng Phaser Physics:** Mọi va chạm (`circle vs tile-AABB`, `circle vs circle`) và truy vấn không gian (`SpatialHashGrid` kích thước ô 64×64 đơn vị thế giới) đều chạy thuần trong `packages/shared`.
2. **Fixed Timestep 60Hz & Render Interpolation:**
   - Simulation tiến thêm từng bước cố định `DT = 1000 / 60 ≈ 16.6667ms`.
   - Mỗi entity lưu trạng thái `prevPos` và `currPos`.
   - Ở tầng render (màn hình 60Hz/120Hz/144Hz), vị trí hiển thị được nội suy tuyến tính theo hệ số `alpha = accumulator / DT`:
     $$\text{renderPos} = \text{prevPos} + (\text{currPos} - \text{prevPos}) \times \alpha$$
3. **Seeded PRNG (`SeededRandom`):**
   - Sử dụng thuật toán **Mulberry32** kết hợp hàm băm chuỗi FNV-1a để khởi tạo từ số nguyên hoặc chuỗi seed.
   - Cung cấp phương thức `.fork(salt)` để tách luồng ngẫu nhiên độc lập cho Map Gen, Loot, AI và Bullet Spawn mà không làm lệch chuỗi số ngẫu nhiên của các hệ thống khác.

---

## 3. Giao Thức Mạng LAN & Đồng Bộ Hóa

### 3.1 Mô hình Host-Client
- Server Colyseus lắng nghe tại `0.0.0.0:2567` (tự động thử cổng kế tiếp nếu cổng bận).
- Phục vụ trực tiếp bản build tĩnh của `apps/client` và cung cấp API `/api/host-info` trả về danh sách địa chỉ IPv4 LAN hợp lệ (lọc bỏ VirtualBox, WSL, Hyper-V, VPN).
- Client kết nối WebSocket về cùng origin hoặc qua IP LAN nhập thủ công.

### 3.2 Tần số & Lượng tử hóa (Quantization)
- **Client → Server Input (`60Hz`):** Gửi gói tin `PlayerInputPacket`:
  - `seq`: số thứ tự input tăng dần (`uint16`)
  - `tick`: tick hiện tại của client (`uint32`)
  - `moveX`, `moveY`: chuẩn hóa lượng tử hóa `int8` (`-100..100`)
  - `aimAngle`: góc ngắm lượng tử hóa `int16` (`-3142..3142`, tương ứng radian × 1000)
  - `buttons`: bitmask `uint8` (`FIRE = 1`, `SKILL = 2`, `DASH = 4`, `INTERACT = 8`, `SWAP = 16`, `PING = 32`)
- **Server → Client Snapshot/Delta (`30Hz`):**
  - Tọa độ thế giới `(x, y)` lượng tử hóa thành số nguyên `int16` với độ chính xác `0.1` đơn vị (`Math.round(val * 10)`).
  - Góc xoay lượng tử hóa `int16` (`Math.round(rad * 1000)`).
- **Sự kiện Đạn Tất Định (`ProjectileSpawnEvent`):**
  - Thay vì đồng bộ vị trí hàng trăm viên đạn mỗi tick, server phát sự kiện `{ eventId, tick, ownerId, weaponId, originX, originY, angle, seed }`.
  - Client tự chạy mô phỏng quỹ đạo đạn từ `seed` đó; server giữ quyền quyết định va chạm gây sát thương thực tế.

### 3.3 Prediction, Reconciliation & Adaptive Interpolation
- **Local Player:** Áp dụng ngay input vào bản sao simulation phía client; khi nhận snapshot từ server kèm `lastProcessedSeq`, client đối chiếu vị trí và chỉ hòa giải (reconcile) mượt nếu sai lệch vượt ngưỡng.
- **Remote Entities (Đồng đội & Quái):** Đưa vào hàng đợi snapshot và nội suy lùi thời gian với bộ đệm thích ứng `50–100ms` dựa trên `jitter` đo đạc thực tế.

---

## 4. Pipeline Đồ Họa Procedural & Hiệu Năng
1. **DPR-aware Texture Baking (`TextureBaker`):**
   - Mọi bộ phận trong rig của nhân vật, quái, vũ khí, đạn và tile được vẽ bằng `Phaser.GameObjects.Graphics` thông qua pipeline `outlined()` ở hệ số phóng đại `scale = displayScale * Math.min(window.devicePixelRatio, 2.5)`.
   - Sau khi vẽ xong trên offscreen Graphics/Canvas, texture được đóng gói một lần vào Texture Manager và gắn filter `LINEAR`, giúp hình ảnh sắc nét tuyệt đối ở cả 1080p và 1440p mà không tốn chi phí vẽ lại mỗi frame.
2. **Cutout Rig & Parametric Animation (`CutoutRig`):**
   - Mỗi nhân vật/quái là một `Phaser.GameObjects.Container` chứa các `Sprite` bộ phận (`shadow`, `cape/back`, `legL`, `legR`, `torso`, `head`, `armL`, `armR`, `weapon`).
   - Animation tính toán độ lệch `(dx, dy, rotation, scaleX, scaleY)` bằng hàm lượng giác và đường cong easing theo `animTime` riêng của từng entity.

---

## 5. Debug Tools & Kiểm Thử Tự Động
- **Phím `F1`:** Bật/tắt bảng thông số kỹ thuật thời gian thực (FPS, Frame Time, Entity Count, Bullet Count, Draw Calls, Ping, Sim Tick, Seed).
- **`window.__GAME_DEBUG__`:** Đối tượng toàn cục luôn cập nhật trên trình duyệt để bộ kiểm thử Playwright E2E truy vấn trực tiếp FPS, trạng thái scene, danh sách lỗi/cảnh báo console và kết quả kiểm tra hiển thị tiếng Việt.
