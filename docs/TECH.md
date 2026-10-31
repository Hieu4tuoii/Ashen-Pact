# KIẾN TRÚC KỸ THUẬT (TECH.md) — ASHEN PACT 2.0

## 1. Cấu Trúc Monorepo (`pnpm` Workspaces & Kỷ Luật Mô-đun `< 1000` Dòng / File)
Dự án sử dụng `pnpm` workspaces với TypeScript `strict: true` và **kỷ luật kiến trúc mô-đun `< 1000` dòng mỗi file** trên toàn bộ các package:

```text
/
├─ apps/
│  ├─ client/                # Vite + TypeScript + Phaser 3 (WebGL Renderer: GameScene + HudScene)
│  │  ├─ public/fonts/       # Font OFL đóng gói local (Be Vietnam Pro .woff2)
│  │  └─ src/
│  │     ├─ art/             # Procedural Vector Art pipeline (palette, texture-baker-*, cutout-rig, rig-defs-*)
│  │     ├─ fx/              # Particle pool, trails, lightmap BlendMode.ADD, PostFX shaders
│  │     ├─ world/           # Hybrid 3D biome architecture, 6 tactical archetypes, 3-state props
│  │     ├─ scenes/          # Boot, Preload, Menu, GameScene (game-scene/*), HudScene, ArtGalleryScene
│  │     ├─ ui/              # Cadence Micro-Bar (32×5px), Duo Boon / Pact / Anvil Modals, Debug Gate
│  │     └─ network/         # LocalTransport (Solo) & NetworkTransport (Colyseus LAN)
│  └─ server/                # Node.js 20+ + Colyseus + Express static server (cùng cổng 2567)
│     └─ src/
│        ├─ rooms/           # CoopRoom (authoritative 60Hz loop, session meta.playerId isolation)
│        └─ utils/           # LAN IPv4 discovery, QR generator, port fallback, Release Debug Gate
├─ packages/
│  └─ shared/                # Pure TypeScript (KHÔNG phụ thuộc Phaser/DOM/Node)
│     └─ src/
│        ├─ core/            # Seeded PRNG (Mulberry32 + FNV-1a), FixedTimestepLoop (60Hz)
│        ├─ math/            # Vec2, Circle-AABB, Circle-Circle, SpatialHashGrid (64×64)
│        ├─ data/            # Characters, 18 Weapons, 24 Action Blessings, 10 Mutators, 6 Duo Boons, 6 Pacts
│        ├─ sim/             # Modular WorldSim (<1000 lines/file): Cadence, Tactical Physics, 3-Bucket Damage
│        └─ protocol/        # INPUT_BUTTON (9-bit), SHOT_FLAG, QuantizedWorldSnapshot, ITransport
├─ tools/                    # Balance harness, Engine 2.6 Visual Strip & 5 HARD_ASSERT Gates, Release packager
├─ tests/e2e/                # Playwright E2E test suite & visual/network verification
└─ docs/                     # Tài liệu sống (GDD, TECH, ART_GUIDE, BALANCE, RELEASE_NOTES, QA_CHECKLIST)
```

---

## 2. Nguyên Tắc Tách Biệt Simulation 60Hz & Rendering

```text
+-----------------------------------------------------------------------+
|                            packages/shared                            |
|  FixedTimestepLoop (60Hz = 16.6667ms) + SeededRandom + Data Tables    |
|  WorldSim: Tactical Props, Cadence, 3-Bucket Pipeline, Per-Player Sim |
+-----------------------------------------------------------------------+
                ▲                                       ▲
                | LocalTransport (Solo)                 | NetworkTransport (Co-op LAN)
                ▼                                       ▼
+-------------------------------+       +-------------------------------+
|    apps/client (Phaser 3)     |       |     apps/server (Colyseus)    |
| - GameScene + HudScene        |       | - Authoritative 60Hz WorldSim |
| - Render interpolation (alpha)|       | - 30Hz Quantized Snapshots    |
| - Zero-Rubberband Client Hold |       | - Session -> meta.playerId    |
| - DPR Texture Baker & Rigs    |       | - Static HTTP + LAN IPv4/QR   |
+-------------------------------+       +-------------------------------+
```

1. **Không dùng Phaser Physics:** Mọi va chạm (`circle vs tile-AABB`, `circle vs circle`, `Wall-Slam`, `Chasm Ring-Out`, `Dash-Kick`) và truy vấn không gian (`SpatialHashGrid` ô `64×64`) đều chạy thuần tất định trong `packages/shared`.
2. **Fixed Timestep 60Hz & Render Interpolation:**
   - Simulation tiến từng bước cố định `DT = 1000 / 60 ≈ 16.6667ms`; mỗi thực thể lưu `prevPos` và `currPos`.
   - Tầng render nội suy mượt trên màn hình `60Hz / 120Hz / 144Hz` theo `alpha = accumulator / DT`:
     $$\text{renderPos} = \text{prevPos} + (\text{currPos} - \text{prevPos}) \times \alpha$$
3. **Seeded PRNG (`SeededRandom`) & Kỷ luật `< 1000` Dòng / File:**
   - Sử dụng **Mulberry32** + FNV-1a với `.fork(salt)` và `volleyRng` độc lập để tách luồng ngẫu nhiên cho Map Archetypes, Loot, AI và Bullet Volleys.
   - `WorldSim` được phân tách thành các mô-đun chuyên biệt (`sim-weapon-cadence.ts`, `sim-tactical-physics.ts`, `sim-damage-pipeline.ts`, `sim-blessings*.ts`, `sim-weapon-mutators*.ts`, `sim-duo-boons.ts`, `sim-ashen-pacts*.ts`, `sim-boss-armor-break.ts`, `sim-secret-arena.ts`), đảm bảo mọi file giữ dưới trần `< 1000` dòng, dễ kiểm thử đơn vị và không rò rỉ trạng thái.

---

## 3. Giao Thức Mạng LAN 2.0, Đồng Bộ Đạn Tất Định & Cô Lập Trạng Thái Người Chơi

### 3.1 Mô Hình Host-Client & Cô Lập Phiên Người Chơi (`CoopRoom.ts`)
- Máy chủ Colyseus lắng nghe tại `0.0.0.0:2567` (tự động fallback sang cổng kế tiếp `2568..2576` nếu bận), phục vụ trực tiếp bản build tĩnh của `apps/client` và endpoint `/api/host-info` (lọc bỏ adapter ảo WSL/Hyper-V/VPN).
- **Xác thực `meta.playerId` nghiêm ngặt trên Server (`CoopRoom.ts`):** Mọi gói tin điều khiển và lựa chọn build (`player_input`, `select_character`, `select_buff`, `select_mutator`, `select_pact`, `toggle_ready`) đều ánh xạ `client.sessionId → meta.playerId` từ bảng phiên của Server, tuyệt đối không tin tưởng `playerId` do client tự khai báo và chặn mọi lệnh debug (`debug_rejected`) khi máy chủ không chạy với cờ `--debug`.

### 3.2 Gói Tin Điều Khiển `PlayerInputPacket` (`60Hz` — `messages.ts`)
- `seq`: số thứ tự input tăng dần (`uint16`), `tick`: tick hiện tại (`uint32`).
- `moveX`, `moveY`: vector di chuyển lượng tử hóa (`-100..100`); `aimAngle`: góc ngắm lượng tử hóa `int16` (`-3142..3142` milliradians).
- `buttons`: bitmask 9-bit (`uint16`) định nghĩa trong `INPUT_BUTTON`:
  - `FIRE = 1 << 0` (`1`) — Bắn / Combo 3 đòn / Giữ-Nhả (*Airburst*, *Implosion*, *Charged Bolt*)
  - `SKILL = 1 << 1` (`2`) — Kỹ năng nhân vật thuần Cooldown (hỗ trợ tái kích hoạt pha 2)
  - `DASH = 1 << 2` (`4`) — Lướt `i-frame` + `Dash-Kick` vật chắn / đồ chơi địa hình
  - `INTERACT = 1 << 3` (`8`) — `[E]` Cứu đồng đội → Lật Bia Chắn (`Micro-Blank`) → Tương tác/Nhặt
  - `SWAP = 1 << 4` (`16`) — `[Q]` Đổi vũ khí (`Holster Auto-Reload 2.0s`)
  - `PING = 1 << 5` (`32`) — Ping ngữ cảnh thông minh (`pingWorldX`, `pingWorldY`)
  - `DROP_WEAPON = 1 << 6` (`64`) — `[X]` Nhấp vứt súng / Giữ `0.50s` Phân Rã Vũ Khí (`Weapon Salvage`)
  - `READY = 1 << 7` (`128`) — `[V]` Sẵn sàng tại Sảnh Doanh Trại
  - `RELOAD_VENT = 1 << 8` (`256`) — **`[R]` Nạp Đạn Hoàn Hảo (`CLIP_RELOAD`) / Xả Áp Chiến Thuật (`HEAT_VENT`)**

### 3.3 Định Danh Đạn Tất Định & `Zero-Rubberband Client Hold` (`sim-projectiles.ts`)
Để đồng bộ chính xác hàng trăm viên đạn có khả năng nảy thông minh (`Smart Ricochet`), tách tia qua Lăng Kính/Bia Chắn, bẻ góc từ trường (`duo_superconduct_rail`), quay về (`bullet_orbit_return`) hoặc bị xóa hàng loạt mà không cần truyền tọa độ từng viên đạn mỗi tick:
1. **Định Danh Đạn Tất Định (`Deterministic Projectile ID`):**
   Trong `spawnDeterministicVolleyImpl(ev)`, mỗi tia đạn thứ `i` (`0 <= i < pelletCount`, kẹp cứng `MAX_PELLETS_PER_TRIGGER = 9`) nhận ID tất định từ `ev.eventId`:
   ```ts
   const deterministicId = (((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f);
   ```
   Server và cả 4 máy Client luôn sinh ra cùng một `proj.id` trùng khớp 100% ngay khoảnh khắc khai hỏa.
2. **Cờ Đạn Đạo Động (`SHOT_FLAG`):**
   - `SHOT_FLAG.FINALE_SHOT = 1 << 0` (`1`) — Viên cuối băng đạn (`+50%` Additive DMG & hiệu ứng kết băng).
   - `SHOT_FLAG.OVERCLOCKED_SHOT = 1 << 1` (`2`) — Phát đạn cường hóa sau `Perfect Reload [R]` (`+45%` Additive DMG).
   - `SHOT_FLAG.DYNAMIC_BOUNCE = 1 << 2` (`4`) — Đánh dấu bảo thủ mọi viên đạn có khả năng đổi hướng động trên Server.
3. **Neo Đạn Chờ Đổi Hướng Không Giật Lùi (`Zero-Rubberband Client Hold`):**
   Khi viên đạn mang cờ `SHOT_FLAG.DYNAMIC_BOUNCE` chạm tường, Bia Chắn Lăng Kính, `cryo_prism_pillar`, trường hút `duo_superconduct_rail` hoặc đạt cực tầm `bullet_orbit_return` ở phía Client (`stepClientProjectilesCosmeticImpl`), Client **không tự đoán góc nảy** mà neo đạn tại điểm chạm (`b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12`). Ngay khi nhận sự kiện đổi hướng từ Server (`bullet_volley_spawned` mang `replacedProjectileId: origId`), Client thu hồi viên đạn đang chờ và sinh tức thì tia đạn mới theo đúng vector chuẩn của Server.
4. **Xóa Đạn Hàng Loạt Tức Thời (`projectiles_destroyed`):**
   Khi `Micro-Blank` (lật chắn `[E]`), `Parry Deflect` (Đòn 3 cận chiến), `reload_frost_nova`, `void_staff` hoặc kết thúc `Secret Skill Arena` tiêu hủy đạn địch, Server phát `{ kind: 'projectiles_destroyed', ids: number[] }` ở nhóm ưu tiên cao nhất để Client xóa sạch đạn tương ứng ngay trong frame.

### 3.4 Cô Lập Trạng Thái Từng Người Chơi & Trần Ưu Tiên Sự Kiện (`snapshot-codec.ts`)
- **Snapshot `30Hz` cô lập Build & Nhịp Súng theo từng `QuantizedPlayerSnap`:**
  - *Trạng thái Nhịp Vũ khí (`weaponCadence`):* `clipAmmo`, `clipMax`, `heat10`, `reload100`, `reloadDur100`, `overclock`, `overheat100`, `comboStep`, `vgBonus100`, `conv10` (*Hội Tụ Nguyên Tố*), `salvage100`, `salvageItemId`.
  - *Trạng thái Build Độc Lập:* `blessings` (`BlessingId[]`), `mutators` (`Record<0|1, WeaponMutatorId[]>`), `duoBoons` (`DuoBoonId[]`), `pact` (`AshenPactId | null`), `relics` (`AshenRelicId[]`), `wepLevels` (`Record<0|1, number>`), cùng các danh sách lựa chọn riêng `buffChoices`, `mutatorChoices`, `pactChoices`.
  - *Trạng thái Đấu Trường Kỹ Năng Bí Mật:* `secretTrialActive`, `secretTrialTimer100`, `secretTrialResult`, `secretTrialRemaining`.
- **Trần Ưu Tiên Sự Kiện (`<= 64` Events / Snapshot):** `encodeWorldSnapshot` phân loại các sự kiện thiết yếu (`bullet_volley_spawned`, `projectiles_destroyed`, `pact_signed`, `relic_awakened`, `secret_trial_started`, `secret_trial_resolved`) lên đầu hàng đợi trước các sự kiện trang trí và cắt cứng tối đa **`64` sự kiện mỗi snapshot**, giữ băng thông LAN ổn định (`~7–12 KB/s/client`) kể cả trong giao tranh 4 người cuối game.

---

## 4. Ngân Sách Thực Thể 60Hz & Pipeline Đồ Họa Procedural

### 4.1 Ngân Sách Object Pool Cứng (`world-sim-types.ts`)
- `MAX_PLAYER_PROJECTILES = 240` (`60` viên/người chơi — bảo toàn đầy đủ đường đạn tốc độ cao kết hợp tách tia `mutator_prism_splitter` ở 4P Co-op).
- `MAX_ENEMY_PROJECTILES = 160` (tách biệt hoàn toàn khỏi bể đạn người chơi để đạn đồng minh không bao giờ đẩy mất đạn cảnh báo của Boss/Quái).
- `MAX_TACTICAL_PROPS_PER_ROOM = 16` (Bia Chắn 3 trạng thái, Đồ Chơi Biome & Cọc Nhũ Băng).
- `MAX_DEPLOYABLES_PER_PLAYER = 8` (Đinh Tán Từ Tính `rivet_gun`, Cọc Điện `bullet_wall_tether`, Nụ Hoa `seed_gun`, Phân Thân / Bóng Pháo).
- **Phân cấp thị giác Co-op 4P:** Đạn và FX nổ phụ của đồng đội render với độ đục giảm nhẹ và `0%` rung màn hình trên máy người chơi cục bộ.

### 4.2 DPR-Aware Texture Baking, `CutoutRig` & `HudScene` Tách Biệt
1. **DPR-aware Texture Baking (`TextureBaker`):** Mọi bộ phận nhân vật, quái, 18 vũ khí, tile 3D và 9 đồ chơi địa hình (bao gồm 3 trạng thái `'low'`, `'flipped'`, `'sliding'` của Bia Chắn) đều được bake offscreen một lần ở độ phân giải supersampling theo DPR rồi tái sử dụng qua sprite pool.
2. **Tách Biệt `GameScene` & `HudScene`:** Toàn bộ HUD, thanh Boss 2 tầng (`HP` + `bossStaggerAccum`), đồng hồ `Secret Arena 20.0s` và các Modal (Thẻ Kim Cương Đôi `Duo Boon`, Tế Đàn Khế Ước, Đe Rèn Daedalus) render trên `HudScene` độc lập không bị biến dạng bởi camera zoom hay screen-shake.

---

## 5. Công Cụ Kiểm Định Tự Động & Engine Kiểm Chứng Hoạt Ảnh 2.6 (`HARD_ASSERT` 5 Gates)

1. **Debug Gate & `window.__GAME_DEBUG__`:** Phím `F1` và các công cụ Debug bị khóa chặt mặc định trong bản đóng gói phát hành (`Proxy` chỉ-đọc trên client + kiểm tra `isServerDebugEnabled()` trên `CoopRoom`), chỉ mở khi bật `Ctrl + Shift + D` / `?debug=1` kết hợp `start-host-debug.bat` (`--debug`).
2. **Headless Balance Harness (`tools/balance-harness.ts`):** Chạy `pnpm balance` thực thi **2.269 lượt mô phỏng 60Hz** với `AVERAGE_PLAYER_BOT_PROFILE` khóa cứng kiểm chứng tự động **10/10 chỉ tiêu cân bằng** (bao gồm kiểm toán sức chống chịu Boss Tầng 6 `forge_titan >= 45.0s` trước 3 loadout full-synergy).
3. **Animation & Moment Verification Engine 2.6 (`tools/visual-animation-gates.ts` & `visual-strip-renderer.ts`):**
   Mọi cơ chế chiến đấu, nhịp `[R]` Micro-Bar, `Dash-Kick`, `Wall-Slam`, `Chasm Ring-Out`, Đồ Chơi Biome và Boss Armor Break được chụp thành dải contact-sheet `8–12` khung hình (`windup_hold → trigger → active → apex → settled`) và kiểm định tự động ở chế độ **`HARD_ASSERT`** qua **5 Cổng Toán Học**:
   - **Gate 1 — `gate1ApexEvent`:** Sự kiện đỉnh điểm (`ApexEventSpec`) phải nổ khớp đúng khung `Hero Frame` trong sai số tick cho phép và sạch hoàn toàn trước `F1` (`preF1Clean = true`).
   - **Gate 2 — `gate2StateIntegrityAndVelocity`:** `0` can thiệp sửa tay trạng thái bên ngoài `WorldSim.step()` (`externalMutationCount === 0`) và không có bước dịch chuyển tức thời bất hợp lý (`maxInSimStepWorldPx <= 96px`).
   - **Gate 3 — `gate3StageActivityAndPixelDiff`:** Không có khung hình đóng băng ở giai đoạn hành động; số pixel thay đổi thực trên ROI đạt `>= 120px` (cảnh vật lý chiến đấu) hoặc `>= 24px` (cảnh Micro-Bar UI).
   - **Gate 4 — `gate4AlertOverlapAndContainment`:** `0` chồng lấn chữ cảnh báo phi-số (`nonNumericAlertOverlapCount === 0`) và tỷ lệ bao phủ nhân vật/vật thể chính trong khung ROI đạt `>= 85%` (`0.85`).
   - **Gate 5 — `gate5NetDisplacement`:** Với mọi cảnh vật lý (`dash-kick`, `wall-slam`, `ring-out`, v.v.), độ dịch chuyển ròng trong không gian thế giới của mục tiêu/vật thể bắt buộc đạt `>= 18px`.
