# Ashen Pact 2.0 — Phase P4B: 6 Phước Lành Giao Thoa (`Elemental Duo Boons`) & Đấu Trường Bí Mật 20 Giây (`ap2-p4b`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện tầng sâu nhất của hệ thống Build (**6 Phước Lành Giao Thoa Nguyên Tố — `Elemental Duo Boons`** với xác suất `35%` nâng cấp ô thẻ thứ 3 khi sở hữu đủ cặp nguyên tố) và thử thách kỹ năng tốc độ cao **Đấu Trường Bí Mật 20 Giây (`Secret Skill Arena 20s`)** trong phòng `secret`, kèm đồng bộ mạng 60Hz tất định, song ngữ `vi`/`en`, giao diện thẻ Viền Cầu Vồng Kim Cương, Procedural VFX và 5 cảnh kiểm định thị giác chuẩn **Engine 2.6 (`HARD_ASSERT` + `--verify-freeze`)**.

**Architecture:** Tách toàn bộ dữ liệu và logic mô phỏng mới của Phase P4B sang 3 module gọn độc lập: `packages/shared/src/data/duo-boons.ts` (`< 240` dòng), `packages/shared/src/sim/sim-duo-boons.ts` (`< 680` dòng) và `packages/shared/src/sim/sim-secret-arena.ts` (`< 420` dòng); phần giao diện HUD đếm ngược và VFX sang `apps/client/src/ui/secret-arena-hud.ts` (`< 200` dòng) và `apps/client/src/fx/combat-fx-p4b.ts` (`< 620` dòng); 5 cảnh chụp Engine 2.6 sang `tests/e2e/helpers/visual-scene-ap2-p4b.ts` (`< 580` dòng). Mở rộng `BuffId = BlessingId | DuoBoonId` để tận dụng trọn vẹn luồng `rollPendingBuffChoices`, `selectFloorBuff`, `CoopRoom` `select_buff` và `QuantizedPlayerSnap.duoBoons` đã có sẵn; kết nối vào `sim-combat-damage.ts`, `sim-projectiles.ts`, `sim-tactical-physics.ts` chỉ bằng các lời gọi hook mỏng 1–3 dòng.

**Tech Stack:** TypeScript 5.x, Vitest (TDD `RED → GREEN → REFACTOR`), Phaser 3 Procedural Graphics (`BlendMode.ADD` + deterministic freeze clock), Colyseus 60Hz Deterministic Simulation (`SeededRandom`, `SHOT_FLAG.DYNAMIC_BOUNCE` + `replacedProjectileId`), Playwright Engine 2.6 Visual Verification (`pnpm shots -- ... --verify-freeze`, `evaluateAnimationGates('HARD_ASSERT')`).

**Spec:** `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4 — Section `4.5` 6 Elemental Duo Boons, Section `4.6` Anti-Runaway Math, Section `5.2A` Secret Room 20s Skill Arena, Section `7.1–7.2` 60Hz Dynamic Projectile Sync & Pool Caps) & `master-promt-v3.md` (`Phase P4B` dòng `1072–1105`, Mục `0.3–0.6`, Mục `6–7`).

## Global Constraints

- **Giới hạn kích thước file cứng (`< 1000` dòng):** 100% file `.ts` trong toàn dự án bắt buộc `< 1000` dòng. Tuyệt đối không thêm dòng vào `arena-map.ts` (999) hoặc `combat-fx-spawners.ts` (993); chỉ gắn hook mỏng 1–3 dòng vào `visual-scenes.ts` (954), `sim-projectiles.ts` (905), `sim-combat-damage.ts` (894), `sim-tactical-physics.ts` (880), `network-transport.ts` (866), `world-sim-types.ts` (864), `sim-events.ts` (862), `sim-progression-bot.ts` (843).
- **Tính tất định & Đồng bộ mạng 60Hz 4P:** Tuyệt đối cấm `Math.random()` trong `packages/shared/src/sim/` (chỉ dùng `SeededRandom` / `this.rng`). Mọi đạn sinh mới hoặc bẻ hướng động (`duo_superconduct_rail`, `duo_plasma_overload_star`) bắt buộc đi qua `spawnDeterministicVolley` với `SHOT_FLAG.DYNAMIC_BOUNCE`, phát `bullet_volley_spawned` kèm `replacedProjectileId` từ Server và giữ `awaitingServerRedirectTimer = 0.12` trên Client (`Zero-Rubberband Client Hold`).
- **Trần thực thể & Chống nổ số (`Anti-Runaway Math`):** Tuân thủ `MAX_PLAYER_PROJECTILES = 240`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_CYCLONES_PER_PLAYER = 3`, `scaleBlessingDamage(baseDmg, F) = round(baseDmg * (1 + 0.22 * (F - 1)))`, và giới hạn không đệ quy vô hạn cho `duo_napalm_chain_plague` & `duo_plasma_overload_star`.
- **An toàn Đấu Trường Bí Mật 20 Giây (`Secret Skill Arena 20s`):** Khóa cửa phòng `secret` và tạm khóa mở rương trong lúc đồng hồ `20.0s` đang chạy để nhấn `[E]` gần rương không bị nhầm với lật Bia Chắn; khi thắng (`< 20.0s`) rương chắc chắn `100%` lên `legendary` + thưởng `+40 Gold` riêng cho từng người chơi (`instanced`); khi hết `20.0s` quái thử thách còn sống phải biến mất an toàn (không kích hoạt nổ cảm tử / `handleEnemyKilled`, xóa sạch đạn địch còn bay) và trả lại rương `Rare/Epic` gốc mở bình thường.
- **Bảo toàn chuẩn thị giác Golden Room v0.2.0 & Engine 2.6 `HARD_ASSERT`:** `vignetteStrength = 0.0`, không sương mù, đạn địch `#E84545` lõi trắng viền `INK_DARK` `1.5u` luôn nổi bật nhất; mọi cảnh strip có `F1 = windup_hold` (`stepCount: 0`), đúng 1 `apex` tại `heroFrameIndex`, `apexEvent` thật từ `WorldSim`, chỉ dùng Whitelist Input API, `externalStateMutations === 0`, `nonNumericAlertOverlapCount === 0`, `minActorContainmentRatio === 1.0`, `diffPixels === 0`.
- **Song ngữ Việt – Anh (`packages/shared/src/i18n/vi.json` & `en.json`):** Toàn bộ 6 Duo Boons và thông báo HUD Đấu Trường Bí Mật 20s phải đồng bộ 100% tập khóa lá giữa `vi.json` và `en.json`, không rò rỉ khóa thô.

## Review Focus

1. **Chọn thẻ Duo Boon đẩy nhầm `DuoBoonId` vào `p.blessingIds` hoặc bị chặn bởi kiểm tra `!FLOOR_BUFFS[buffId]`:** Nếu `applyBuffEffectsImpl` đẩy `DuoBoonId` vào `p.blessingIds` thay vì `p.duoBoonIds`, các chỗ đọc `BLESSINGS[id]` sẽ trả `undefined` và `p.duoBoonIds` trên gói tin `QuantizedPlayerSnap.duoBoons` luôn rỗng; hoặc `selectFloorBuffImpl` từ chối chọn trực tiếp `DuoBoonId` vì không nằm trong `FLOOR_BUFFS` -> **Test ghim tại Task 1 (`ap2-p4b-duo-boons.test.ts`):** xác nhận chọn `DuoBoonId` ghi đúng vào `p.duoBoonIds`, giữ `p.blessingIds` không chứa `DuoBoonId`, đồng bộ qua `encodeWorldSnapshot` -> `PredictedClient`, và không bao giờ rút trùng Duo Boon đã sở hữu.
2. **`duo_napalm_chain_plague` hoặc `duo_plasma_overload_star` gây vòng lặp đệ quy vô hạn trong cùng 1 tick:** Nếu vụ nổ dây chuyền khi quái dính `napalmPlagueTimer` chết lại kích nổ chính xác chết đó lần 2, hoặc đòn đánh điện-lửa của `duo_plasma_overload_star` tự kích hoạt `overload` sinh tiếp `Plasma Star` mới không giới hạn -> **Test ghim tại Task 1 (`ap2-p4b-duo-boons.test.ts`):** đặt 5 quái máu thấp đứng sát nhau dính `napalmPlagueTimer`, hạ 1 con và xác nhận mỗi con chỉ phát nổ đúng 1 lần (`napalmPlagueDetonated = true`), không treo stack; xác nhận đạn `weaponId === 'duo_plasma_overload_star'` không tự sinh thêm `Plasma Star` mới và có `ICD = 0.35s`.
3. **`duo_cryo_shatter_spires` làm kẹt cứng người chơi cận chiến tại chỗ hoặc làm khựng cú lướt `Dash-Kick`:** Khi chém cận chiến kích hoạt `Shatter` sát người quái, nếu 4 Cột Băng Nhọn (`blocksMovement: true`) đóng đè lên hitbox người chơi thì người chơi bị kẹt, hoặc khi `Dash-Kick` vào cột băng mà `resolvePropMovementCollision` chặn đứng trước khi kích nổ -> **Test ghim tại Task 1 (`ap2-p4b-duo-boons.test.ts`):** xác nhận 4 Cột Băng đẩy lệch an toàn khỏi vòng tròn `player.radius + spire.radius + 6`, chặn đạn địch, và khi người chơi `Dash-Kick` xuyên qua cột băng thì cột nổ ngay (`r = 80px`, Chill DMG + đóng băng `1.2s`) mà không làm khựng vận tốc lướt của người chơi.
4. **`duo_superconduct_rail` làm giật lùi đạn (rubberband) giữa `AuthoritativeServer` và `PredictedClient`:** Nếu Client để viên đạn bay thẳng qua vùng `100px` quanh mục tiêu `superconductTimer > 0` trong khi Server bẻ góc, đường đạn sẽ nhảy giật -> **Test ghim tại Task 1 (`ap2-p4b-duo-boons.test.ts`):** chạy cặp `AuthoritativeServer + PredictedClient` (`NetworkTransport`), bắn đạn lệch tâm nhưng cắt vào bán kính `100px` của quái dính `superconductTimer > 0`, xác nhận đạn mang `SHOT_FLAG.DYNAMIC_BOUNCE`, Client neo chờ `Zero-Rubberband` và nhận `replacedProjectileId` khớp 100% ID đạn cũng như trúng đích trên cả hai phía.
5. **Hết giờ `20.0s` trong Đấu Trường Bí Mật làm nổ quái cảm tử sát thương người chơi, hoặc người chơi lỡ mở rương `Rare/Epic` trước khi bấm Tinh Thể bị mất phần thưởng `Legendary`:** Nếu lúc timeout gọi `handleEnemyKilled` thì `spore_bomber` / `coal_golem` phát nổ và rơi vàng miễn phí; còn nếu người chơi mở rương trước rồi mới bấm `secret_challenge_crystal` và thắng nhưng rương đã `opened = true` thì không nhận được súng Huyền Thoại -> **Test ghim tại Task 2 (`ap2-p4b-secret-arena.test.ts`):** kiểm chứng cả 2 nhánh: (a) hết `20.0s` khi còn `spore_bomber` & đạn địch đang bay -> quái và đạn địch biến mất êm ru (`0` sát thương lên người chơi, `0` vàng rơi từ quái), rương `Rare/Epic` gốc mở bình thường; (b) mở rương trước rồi mới kích hoạt Tinh Thể và dọn sạch trong `< 20.0s` -> vẫn rơi thưởng vũ khí `legendary` instanced cho từng người chơi + `+40 Gold`.

---

## File Decomposition Map (Strict `< 1000` Lines Guarantee)

- **Create:**
  - `packages/shared/src/data/duo-boons.ts` (`< 240` lines) — Định nghĩa 6 `DuoBoonDef`, bảng cặp nguyên tố yêu cầu, hàm `isDuoBoonId`, `collectPlayerOwnedElements`, `getEligibleDuoBoonsForPlayer`.
  - `packages/shared/src/sim/sim-duo-boons.ts` (`< 680` lines) — Toàn bộ mô phỏng 6 Duo Boons (`duo_superheated_cyclone`, `duo_cryo_shatter_spires`, `duo_superconduct_rail`, `duo_napalm_chain_plague`, `duo_plasma_overload_star`, `duo_magnetic_bastion_ring`).
  - `packages/shared/src/sim/sim-secret-arena.ts` (`< 420` lines) — Toàn bộ mô phỏng Đấu Trường Kỹ Năng 20 Giây trong phòng `secret`.
  - `apps/client/src/ui/secret-arena-hud.ts` (`< 200` lines) — Giao diện HUD đồng hồ đếm ngược `20.0s` và băng rôn Thăng Hoa Rương Huyền Thoại.
  - `apps/client/src/fx/combat-fx-p4b.ts` (`< 620` lines) — Toàn bộ Procedural Vector VFX cho 6 Duo Boons & Đài Tinh Thể Thử Thách.
  - `tests/e2e/helpers/visual-scene-ap2-p4b.ts` (`< 580` lines) — 5 kịch bản cảnh chụp (1 modal tĩnh + 4 strip Engine 2.6) cho nhóm `ap2-p4b`.
  - `packages/shared/test/ap2-p4b-duo-boons.test.ts`
  - `packages/shared/test/ap2-p4b-secret-arena.test.ts`
  - `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`
- **Modify (Thin Hooks & Type Bridges Only):**
  - `packages/shared/src/data/types.ts` (`238 → ~255` lines)
  - `packages/shared/src/index.ts`
  - `packages/shared/src/i18n/vi.json` & `packages/shared/src/i18n/en.json`
  - `packages/shared/src/protocol/snapshot-codec.ts` (`432 → ~458` lines)
  - `packages/shared/src/protocol/network-transport.ts` (`866 → ~882` lines)
  - `packages/shared/src/sim/world-sim-types.ts` (`864 → ~896` lines)
  - `packages/shared/src/sim/world-sim-events.ts` (`587 → ~602` lines)
  - `packages/shared/src/sim/world-sim.ts` (`534 → ~552` lines)
  - `packages/shared/src/sim/sim-progression-bot.ts` (`843 → ~875` lines)
  - `packages/shared/src/sim/sim-combat-damage.ts` (`894 → ~902` lines)
  - `packages/shared/src/sim/sim-projectiles.ts` (`905 → ~925` lines)
  - `packages/shared/src/sim/sim-tactical-physics.ts` (`880 → ~894` lines)
  - `packages/shared/src/sim/sim-weapon-cadence.ts` (`847 → ~856` lines)
  - `packages/shared/src/sim/sim-secret-and-workshop.ts` (`489 → ~512` lines)
  - `packages/shared/src/sim/sim-dungeon-rooms.ts` (`726 → ~738` lines)
  - `packages/shared/src/sim/interact-target.ts` (`445 → ~465` lines)
  - `apps/client/src/ui/blessing-card-visuals.ts` (`329 → ~485` lines)
  - `apps/client/src/ui/interact-prompt.ts`
  - `apps/client/src/art/texture-baker.ts`
  - `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts` (`691 → ~708` lines)
  - `apps/client/src/scenes/game-scene/room-entities-sync.ts` (`714 → ~740` lines)
  - `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts` (`739 → ~748` lines)
  - `apps/client/src/scenes/game-scene/sim-events.ts` (`862 → ~870` lines)
  - `tests/e2e/helpers/visual-scene-ap2-p4.ts` (`467 → ~475` lines)
  - `tests/e2e/helpers/visual-scenes.ts` (`954 → ~960` lines)
  - `tools/run-shots.ts` (`275 → ~286` lines)

---

### Task 1 (`P4B.1`): TDD Điều Kiện Mở Khóa Duo Boon (`35%` Ô Thẻ Thứ 3) & 6 Phước Lành Giao Thoa Nguyên Tố + Đồng Bộ Mạng 60Hz

**Files:**
- Create: `packages/shared/src/data/duo-boons.ts`
- Create: `packages/shared/src/sim/sim-duo-boons.ts`
- Modify: `packages/shared/src/data/types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Modify: `packages/shared/src/protocol/snapshot-codec.ts`
- Modify: `packages/shared/src/protocol/network-transport.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Test: `packages/shared/test/ap2-p4b-duo-boons.test.ts`

**Interfaces:**
- Consumes: `DuoBoonId`, `ElementType`, `BlessingId` từ `packages/shared/src/data/types.ts`; `BLESSINGS`, `scaleBlessingDamage` từ `packages/shared/src/data/blessings.ts`; `WEAPONS` từ `packages/shared/src/data/weapons.ts`; `SHOT_FLAG` từ `packages/shared/src/protocol/messages.ts`; `isFlippableBarricadeProp` từ `packages/shared/src/sim/sim-tactical-physics.ts`.
- Produces:
  - Trong `packages/shared/src/data/types.ts`:
    - `export type BuffId = BlessingId | DuoBoonId;`
    - `export interface DuoBoonDef { id: DuoBoonId; requiredElements: readonly [ElementType, ElementType]; nameVi: string; nameEn: string; descriptionVi: string; descriptionEn: string; primaryColor: string; secondaryColor: string; reactionId?: ElementalReactionId; }`
  - Trong `packages/shared/src/data/duo-boons.ts` (re-export từ `packages/shared/src/index.ts`):
    - `DUO_BOON_SLOT3_UPGRADE_CHANCE = 0.35`
    - `ALL_DUO_BOON_IDS: readonly DuoBoonId[]` (`6` phần tử theo đúng thứ tự Spec `4.5`: `'duo_superheated_cyclone'`, `'duo_cryo_shatter_spires'`, `'duo_superconduct_rail'`, `'duo_napalm_chain_plague'`, `'duo_plasma_overload_star'`, `'duo_magnetic_bastion_ring'`).
    - `DUO_BOONS: Readonly<Record<DuoBoonId, DuoBoonDef>>` với `requiredElements`:
      - `duo_superheated_cyclone`: `['burn', 'chill']`
      - `duo_cryo_shatter_spires`: `['chill', 'none']` (*Băng + Vật Lý*)
      - `duo_superconduct_rail`: `['chill', 'shock']`
      - `duo_napalm_chain_plague`: `['poison', 'burn']`
      - `duo_plasma_overload_star`: `['burn', 'shock']`
      - `duo_magnetic_bastion_ring`: `['shock', 'none']` (*Sét + Vật Lý*)
    - `DUO_BOON_LIST: readonly DuoBoonDef[]`
    - `isDuoBoonId(id: string): id is DuoBoonId`
    - `collectPlayerOwnedElements(player: Pick<SimPlayerState, 'weaponSlots' | 'blessingIds'>): Set<ElementType>` (thu thập `WEAPONS[id].element`, `WEAPONS[id].finaleElement` nếu có, và `BLESSINGS[id].element` từ các vũ khí đang mang trong `weaponSlots` + các thẻ trong `blessingIds`).
    - `getEligibleDuoBoonsForPlayer(player: Pick<SimPlayerState, 'weaponSlots' | 'blessingIds' | 'duoBoonIds'>): DuoBoonId[]`
  - Trong `world-sim-types.ts` & `snapshot-codec.ts`:
    - Mở rộng `SummonKind` thêm `'superheated_cyclone'`; `SimPlayerState.buffChoices: BuffId[]` & `QuantizedPlayerSnap.buffChoices: BuffId[]`; `hasPlayerDuoBoon(p: Pick<SimPlayerState, 'duoBoonIds'> | null | undefined, id: DuoBoonId): boolean`.
    - Trên `SimEnemyState`: `napalmPlagueTimer?: number`, `napalmPlagueOwnerId?: number`, `napalmPlagueDetonated?: boolean`, `cryoSpireIcdTimer?: number` (đồng bộ `napalm10?: number` trên `QuantizedEnemySnap` trong `snapshot-codec.ts` & `network-transport.ts` để Client vẽ VFX Nhựa Lửa-Độc).
    - Trên `SimPropState`: `cryoShatterSpire?: boolean` (tự động đi qua `snapshot.props` copy).
    - Trên `SimProjectileState` & `BulletVolleySpawnEvent`: `superconductRailRedirected?: boolean`.
    - Trên `SimPlayerState`: `plasmaStarIcdTimer?: number`.
  - Trong `packages/shared/src/sim/sim-duo-boons.ts`:
    - Hằng số: `SUPERHEATED_CYCLONE_SPEED = 140`, `SUPERHEATED_CYCLONE_BASE_DPS = 14`, `SUPERHEATED_CYCLONE_TTL_SEC = 4.0`, `SUPERHEATED_CYCLONE_AURA_RADIUS = 56`, `MAX_CYCLONES_PER_PLAYER = 3`; `CRYO_SHATTER_SPIRE_COUNT = 4`, `CRYO_SHATTER_SPIRE_TTL_SEC = 4.0`, `CRYO_SHATTER_SPIRE_BLAST_RADIUS = 80`, `CRYO_SHATTER_SPIRE_BASE_DMG = 34`; `SUPERCONDUCT_RAIL_RADIUS = 100`; `NAPALM_PLAGUE_SPREAD_RADIUS = 160`, `NAPALM_PLAGUE_BLAST_RADIUS = 110`, `NAPALM_PLAGUE_BASE_DMG = 32`, `NAPALM_PLAGUE_TTL_SEC = 5.0`; `PLASMA_OVERLOAD_STAR_SPEED = 420`, `PLASMA_OVERLOAD_STAR_BOUNCES = 3`, `PLASMA_OVERLOAD_STAR_BASE_DMG = 30`, `PLASMA_OVERLOAD_STAR_ICD_SEC = 0.35`; `MAGNETIC_BASTION_MAX_DIST = 220`, `MAGNETIC_BASTION_BASE_DPS = 28`, `MAGNETIC_BASTION_WIRE_HALF_WIDTH = 14`.
    - `anyPlayerHasDuoBoon(sim: WorldSim, id: DuoBoonId): SimPlayerState | null`
    - `handleDuoBoonOnElementalReaction(sim: WorldSim, enemy: SimEnemyState, reaction: ElementalReactionId, damage: number, primerPlayerId: number, triggerPlayerId: number, sourceWeaponId?: string): void`
    - `handleDuoBoonOnEnemyKilled(sim: WorldSim, enemy: SimEnemyState, killerPlayerId: number): void`
    - `tryDetonateCryoShatterSpireOnKickOrSlide(sim: WorldSim, prop: SimPropState, actorPlayerId: number): boolean`
    - `tryRedirectSuperconductRailServer(sim: WorldSim, b: SimProjectileState): boolean`
    - `tryHoldSuperconductRailClient(sim: WorldSim, b: SimProjectileState): boolean`
    - `tryBouncePlasmaOverloadStarOnWall(sim: WorldSim, b: SimProjectileState, resolvedX: number, resolvedY: number, normalX: number, normalY: number): boolean`
    - `updateDuoBoons(sim: WorldSim, dtSec: number): void`

- [ ] **Step 1: Write the failing TDD unit tests in `packages/shared/test/ap2-p4b-duo-boons.test.ts`**
  - Kiểm định dữ liệu & i18n (`vi`/`en`) cho cả 6 `DUO_BOONS`: đủ khóa `buffs.<duoId>.{name,desc}` không rò rỉ khóa thô; `getEligibleDuoBoonsForPlayer` trả rỗng khi chỉ có 1 nguyên tố, trả đúng `['duo_superheated_cyclone']` khi sở hữu `burn` + `chill` (từ súng hoặc blessing), trả đúng `['duo_magnetic_bastion_ring']` khi cầm 1 vũ khí `none` (vật lý) + 1 blessing/súng `shock`, và loại trừ Duo Boon đã nằm trong `p.duoBoonIds`.
  - Kiểm định xác suất `35%` nâng cấp ô thẻ thứ 3 (`choices[2]`) qua 200 lượt `rollPendingBuffChoices` tất định: tỷ lệ ô `choices[2]` là `DuoBoonId` nằm trong khoảng hợp lý (`25%..45%`), `choices[0]` & `choices[1]` vẫn là `BlessingId`, và khi chọn `selectFloorBuff(duoId)` *(Review Focus #1)* thì `duoId` nằm trong `p.duoBoonIds`, không nằm trong `p.blessingIds`, đồng bộ qua `encodeWorldSnapshot`.
  - Kiểm định `duo_superheated_cyclone`: kích hoạt phản ứng `vaporize` (`burn` + `chill`) sinh summon `'superheated_cyclone'` (`ttlSec = 4.0`, tối đa `3`/người), tự đuổi theo quái sống gần nhất ở `140 px/s` và gây sát thương mỗi `0.25s` (`scaleBlessingDamage(14, F)` DPS) kèm mù hơi nước.
  - Kiểm định `duo_cryo_shatter_spires` *(Review Focus #3)*: kích hoạt phản ứng `shatter` đóng đúng **4 Cột Băng Nhọn** (`glacial_spike`, `cryoShatterSpire === true`, `ttlSec = 4.0`, `blocksEnemyProjectiles = true`) không kẹt đè lên vị trí người chơi và không vượt `MAX_TACTICAL_PROPS_PER_ROOM = 16`; khi người chơi `Dash-Kick` qua cột băng, cột phát nổ ngay (`r = 80px`, `scaleBlessingDamage(34, F)` Chill DMG + đóng băng `1.2s`) mà không làm khựng cú lướt.
  - Kiểm định `duo_superconduct_rail` *(Review Focus #4)* trên cặp `AuthoritativeServer + PredictedClient`: bắn đạn song song lệch tâm đi vào bán kính `100px` quanh mục tiêu đang có `superconductTimer > 0` -> viên đạn có `SHOT_FLAG.DYNAMIC_BOUNCE`, được Server bẻ góc lao thẳng trúng mục tiêu qua `replacedProjectileId`, không giật lùi và trúng đích đồng nhất trên cả Server lẫn Client.
  - Kiểm định `duo_napalm_chain_plague` *(Review Focus #2)*: phản ứng `toxic_blast` phủ `napalmPlagueTimer = 5.0` lên các quái trong `160px`; khi hạ gục mục tiêu dính nhựa, nó phát nổ (`r = 110px`, `scaleBlessingDamage(32, F)`) kích nổ dây chuyền sang đám quái máu thấp kế bên mà không đệ quy vô hạn.
  - Kiểm định `duo_plasma_overload_star` *(Review Focus #2)*: phản ứng `overload` phóng đạn `'duo_plasma_overload_star'` (`420 px/s`, `bounceRemaining = 3`), nảy tường đủ 3 lần xuyên đốt quái trong phòng và không tự sinh đệ quy thêm `Plasma Star`.
  - Kiểm định `duo_magnetic_bastion_ring`: lật `[E]` 2 tấm Bia Chắn cách nhau `<= 220px` (`'flipped'`) tự động giăng lưới hồ quang điện gây `scaleBlessingDamage(28, F)` Shock DMG/s lên quái đi cắt ngang đoạn nối; tấm chắn `'low'` hoặc cách `> 220px` không phát tia.

- [ ] **Step 2: Run Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4b-duo-boons`
  - Expected: FAIL (`duo-boons.ts` và `sim-duo-boons.ts` chưa tồn tại).

- [ ] **Step 3: Implement `duo-boons.ts`, `sim-duo-boons.ts`, 60Hz net sync, i18n (`vi`/`en`) and thin hooks**
  - Hiện thực `packages/shared/src/data/duo-boons.ts`, mở rộng `BuffId = BlessingId | DuoBoonId` trong `types.ts`, xuất qua `packages/shared/src/index.ts`, và thêm đủ khóa song ngữ `buffs.duo_*.{name,desc}` vào `vi.json` & `en.json`.
  - Cập nhật `rollPendingBuffChoicesImpl`, `applyBuffEffectsImpl`, `selectFloorBuffImpl` trong `sim-progression-bot.ts` (hỗ trợ cả bot tự chọn khi `buffChoices` chứa `DuoBoonId`).
  - Hiện thực `packages/shared/src/sim/sim-duo-boons.ts` cho đủ 6 cơ chế Duo Boon và gắn hook mỏng 1–3 dòng vào `sim-combat-damage.ts` (`triggerElementalReactionImpl`, `handleEnemyKilledImpl`), `sim-tactical-physics.ts` (`kickProp`, `resolvePropMovementCollision`, va chạm prop trượt), `sim-weapon-cadence.ts` (gắn `SHOT_FLAG.DYNAMIC_BOUNCE` khi có `duo_superconduct_rail`), `sim-projectiles.ts` (`updateProjectilesImpl`, `stepClientProjectilesCosmeticImpl`), `world-sim.ts` (`updateDuoBoons`), `snapshot-codec.ts` & `network-transport.ts` (`napalm10`).

- [ ] **Step 4: Run Vitest & typecheck to verify GREEN**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4b-duo-boons && pnpm --filter @ashen-pact/shared test -- ap2-p1d-blessings-group1 && pnpm typecheck`
  - Expected: PASS 100%, `0` lỗi TypeScript, mọi file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 1**
  - `git commit -m "feat(shared): implement 6 elemental duo boons, 35% slot-3 unlock and 60Hz sync (P4B.1)"`

---

### Task 2 (`P4B.2`): TDD Đấu Trường Kỹ Năng 20 Giây Trong Phòng Bí Mật (`Secret Skill Arena 20s`)

**Files:**
- Create: `packages/shared/src/sim/sim-secret-arena.ts`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/world-sim-events.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/src/sim/sim-secret-and-workshop.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/interact-target.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/protocol/snapshot-codec.ts`
- Modify: `packages/shared/src/protocol/network-transport.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Test: `packages/shared/test/ap2-p4b-secret-arena.test.ts`

**Interfaces:**
- Consumes: `WorldSim`, `DungeonRoomNode`, `SimNpcState`, `SimChestState`, `SimEnemyState` từ `world-sim-types.ts` & `dungeon-gen.ts`; `WEAPONS` từ `data/weapons.ts`.
- Produces:
  - Mở rộng `SimNpcState['kind']` thêm `'secret_challenge_crystal'`.
  - Mở rộng `DungeonRoomNode` (hoặc trạng thái lưu phòng trên `DungeonRoomNode` trong `dungeon-gen.ts` / `world-sim-types.ts`): `secretTrialAttempted?: boolean`, `secretTrialWon?: boolean`.
  - Mở rộng `SimEnemyState`: `secretTrialEnemy?: boolean`.
  - Mở rộng `WorldSim` & `QuantizedWorldSnapshot`:
    - `secretTrialActive: boolean` (mặc định `false`)
    - `secretTrialTimer: number` (mặc định `0`, bắt đầu ở `20.0`)
    - `secretTrialResult: 'idle' | 'active' | 'victory' | 'expired'` (mặc định `'idle'`)
    - `secretTrialBannerTimer: number` (mặc định `0`)
    - `secretTrialRemainingEnemies: number` (mặc định `0`)
    - Trên `QuantizedWorldSnapshot`: `secretTrialActive?: boolean`, `secretTrialTimer100?: number`, `secretTrialResult?: 'idle' | 'active' | 'victory' | 'expired'`, `secretTrialBanner10?: number`, `secretTrialRemaining?: number`.
  - Mở rộng `SimEvent` (`world-sim-events.ts` & ưu tiên truyền qua `snapshot-codec.ts`):
    - `{ kind: 'secret_trial_started'; roomId: number; durationSec: number; x: number; y: number }`
    - `{ kind: 'secret_trial_resolved'; roomId: number; victory: boolean; bonusGold: number; x: number; y: number }`
  - Trong `packages/shared/src/sim/sim-secret-arena.ts`:
    - `SECRET_ARENA_DURATION_SEC = 20.0`
    - `SECRET_ARENA_VICTORY_GOLD = 40`
    - `SECRET_ARENA_BARRICADE_COUNT = 4`
    - `SECRET_ARENA_BARREL_COUNT = 2`
    - `spawnSecretChallengeCrystal(sim: WorldSim, room: DungeonRoomNode): SimNpcState`
    - `activateSecretChallengeCrystal(sim: WorldSim, crystal: SimNpcState, actor?: SimPlayerState): boolean`
    - `updateSecretSkillArena(sim: WorldSim, dtSec: number): void`
    - `resetSecretSkillArenaState(sim: WorldSim): void`

- [ ] **Step 1: Write the failing TDD unit tests in `packages/shared/test/ap2-p4b-secret-arena.test.ts`**
  - Kiểm định phòng `secret`: sau khi bước vào phòng `secret`, ngoài Rương `Rare/Epic` và 2 cụm vàng (`+30 Gold`), có `SimNpcState` `kind === 'secret_challenge_crystal'` chưa tương tác (`interacted === false`) và `findInteractTarget` nhận diện đúng Tinh Thể khi đứng gần.
  - Kiểm định kích hoạt `[E]` trên `secret_challenge_crystal`: đánh dấu `interacted = true`, khóa cửa phòng `secret`, đặt `sim.secretTrialActive = true`, `sim.secretTrialTimer = 20.0`, triệu hồi đúng **1 đợt quái Tinh Anh** (`enemies.some(e => e.isElite)` và mọi quái đều có `secretTrialEnemy === true`) kèm đúng **4 Bia Chắn lật được** (`moss_table` / `glacial_barricade` / `forge_blast_shield`) + **2 Thùng Nổ** (`explosive_barrel`), không vượt `MAX_TACTICAL_PROPS_PER_ROOM = 16`, và tạm chặn mở rương trong lúc đang giao tranh để không nuốt phím `[E]` lật bàn.
  - Kiểm định chiến thắng trong vòng `< 20.0s` (cả Solo lẫn Co-op 2P): tiêu diệt toàn bộ đợt quái Tinh Anh khi `secretTrialTimer > 0` -> `secretTrialActive = false`, `secretTrialResult = 'victory'`, cửa mở khóa, Rương trong phòng `secret` được **Thăng Hoa lên `rarity === 'legendary'` chắc chắn 100%** (`WEAPONS[chest.droppedWeaponId].rarity === 'legendary'`), mỗi người chơi nhận ngay **`+40 Gold`** (`instanced`), và kiểm chứng luôn nhánh người chơi đã mở rương `Rare/Epic` trước khi bấm Tinh Thể *(Review Focus #5b)* vẫn rơi vũ khí `legendary` instanced ra sàn khi thắng.
  - Kiểm định hết giờ `20.0s` fail-safe *(Review Focus #5a)*: có `spore_bomber` + quái Tinh Anh + đạn địch đang bay khi đồng hồ chạm `0` -> toàn bộ quái `secretTrialEnemy` và đạn địch biến mất sạch sẽ (`0` sát thương nổ lên người chơi, `0` vàng hạ quái miễn phí), `secretTrialResult = 'expired'`, cửa mở khóa, và người chơi mở được rương `Rare/Epic` gốc bình thường.
  - Kiểm định đồng bộ mạng `encodeWorldSnapshot` -> `PredictedClient`: các trường `secretTrialActive`, `secretTrialTimer`, `secretTrialResult`, `secretTrialRemainingEnemies` đồng bộ chính xác sang Client.

- [ ] **Step 2: Run Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4b-secret-arena`
  - Expected: FAIL (`sim-secret-arena.ts` và `'secret_challenge_crystal'` chưa tồn tại).

- [ ] **Step 3: Implement `sim-secret-arena.ts`, interact target, chest/room hooks & 60Hz snapshot sync**
  - Hiện thực `packages/shared/src/sim/sim-secret-arena.ts` và thêm các khóa song ngữ `hud.secretTrial.*` / `interact.secretChallengeCrystal` vào `vi.json` & `en.json`.
  - Gắn `spawnSecretChallengeCrystal` vào `populateSecretRoomContents` (`sim-secret-and-workshop.ts`, đồng thời chặn `openChestImpl` khi `this.secretTrialActive` đang bật).
  - Bổ sung nhánh `'secret_challenge_crystal'` trong `interact-target.ts` và `interactWithNearestImpl` (`sim-progression-bot.ts`), gọi `updateSecretSkillArena` trong `world-sim.ts`, reset trạng thái khi chuyển phòng/tầng trong `sim-dungeon-rooms.ts`, và đồng bộ qua `snapshot-codec.ts` & `network-transport.ts`.

- [ ] **Step 4: Run Vitest & typecheck to verify GREEN**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4b-secret-arena && pnpm --filter @ashen-pact/shared test -- ap2-p2b-secret-salvage && pnpm typecheck`
  - Expected: PASS 100%, `0` lỗi TypeScript, mọi file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 2**
  - `git commit -m "feat(shared): implement 20s secret skill arena challenge and legendary chest ascension (P4B.2)"`

---

### Task 3 (`P4B.3`): Giao Diện Thẻ Duo Boon Viền Kim Cương Đôi, Đồng Hồ Đếm Ngược 20s HUD & Procedural VFX 6 Duo Boons

**Files:**
- Create: `apps/client/src/ui/secret-arena-hud.ts`
- Create: `apps/client/src/fx/combat-fx-p4b.ts`
- Modify: `apps/client/src/ui/blessing-card-visuals.ts`
- Modify: `apps/client/src/ui/interact-prompt.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Test: `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`

**Interfaces:**
- Consumes: `DUO_BOONS`, `isDuoBoonId`, `type DuoBoonId`, `type BuffId` từ `@ashen-pact/shared`; `isVisualFreezeActive`, `getFreezeVisualTimeSec` từ `apps/client/src/fx/visual-freeze-clock.ts`.
- Produces:
  - Trong `apps/client/src/ui/blessing-card-visuals.ts`:
    - Mở rộng `BuffVisualMeta` thêm `isDuoBoon?: boolean`, `secondaryHex?: string`, `secondaryColor?: number`, `requiredElements?: readonly [ElementType, ElementType]`.
    - `resolveLocalizedBuffText` & `getBuffVisualMeta` hỗ trợ đầy đủ cả `BlessingId` lẫn `DuoBoonId` (`badgeText`: `[✦ GIAO THOA · LỬA × BĂNG]` / `[✦ DUO BOON · BURN × CHILL]`).
    - `drawDuoBoonIntersectingEmblems(g: Phaser.GameObjects.Graphics, cx: number, cy: number, elA: ElementType, elB: ElementType, colorA: number, colorB: number): void` — vẽ 2 vòng nguyên tố giao nhau kèm biểu tượng vector riêng cho từng nguyên tố (`burn`, `chill`, `shock`, `poison`, `none`) và tia kim cương hợp nhất ở tâm.
    - Khung thẻ **Viền Cầu Vồng Kim Cương (`Diamond-Rainbow Prismatic Border`)** cho thẻ Duo Boon trong `renderBlessingChoiceCards` (viền kép đa sắc `primaryColor` + `secondaryColor` + `SOLAR_GOLD` kèm 4 đinh tán kim cương ở 4 góc thẻ, và hiển thị huy hiệu Duo Boon trên dãy chip HUD `drawPlayerBlessingChipsHud`).
  - Trong `apps/client/src/ui/secret-arena-hud.ts`:
    - `buildSecretArenaHudViewModel(sim: Pick<WorldSim, 'secretTrialActive' | 'secretTrialTimer' | 'secretTrialResult' | 'secretTrialBannerTimer' | 'secretTrialRemainingEnemies'>, locale: SupportedLocale): SecretArenaHudViewModel | null`
    - `renderSecretArenaCountdownHud(scene: GameScene): void` — thanh đếm ngược `20.0s` sắc nét chính giữa đỉnh màn hình (không đè thanh máu người chơi hay minimap, chữ `Be Vietnam Pro` `>= 13px` ở `1080p`, đổi màu vàng -> cam đỏ dưới `5.0s`, kèm băng rôn `✦ THĂNG HOA RƯƠNG HUYỀN THOẠI! (+40 VÀNG) ✦` khi thắng hoặc thông báo an toàn khi hết giờ).
  - Trong `apps/client/src/fx/combat-fx-p4b.ts`:
    - `renderP4BDuoAndSecretArenaOverlays(scene: GameScene): void`
    - `handleP4BSimEvent(scene: GameScene, ev: SimEvent): void`
    - Vẽ đầy đủ 6 lớp VFX Duo Boons bằng đồng hồ tất định (`getFreezeVisualTimeSec` khi đóng băng):
      1. Lốc Xoáy Nước Sôi (`superheated_cyclone`: vòng xoáy kép hơi nước trắng-lam + lõi lửa cam `BlendMode.ADD`).
      2. 4 Cột Băng Nhọn (`cryoShatterSpire`: hào quang tinh thể băng kim cương quanh `glacial_spike` + vụ nổ mảnh băng `duo_cryo_shatter_spire`).
      3. Từ Trường Siêu Dẫn (`duo_superconduct_rail`: vòng từ trường `r = 100px` nét đứt lam-tím quanh quái `superconductTimer > 0` khi có người sở hữu Duo Boon + tia khóa quỹ đạo).
      4. Nhựa Lửa-Độc (`napalmPlagueTimer > 0`: giọt nhựa hổ phách-lục sôi quanh chân quái + vụ nổ dây chuyền `duo_napalm_chain_plague`).
      5. Quả Cầu Lửa-Điện (`duo_plasma_overload_star`: ngôi sao plasma 6 cánh vàng-tím xoay ngược chiều + tia lửa nảy tường).
      6. Lưới Hồ Quang Điện Bia Chắn (`duo_magnetic_bastion_ring`: tia hồ quang cao thế nối giữa mọi cặp Bia Chắn `'flipped'` trong `220px`, tự hạ alpha `0.50` nếu thuộc đồng đội từ xa, không lấn át đạn địch `#E84545`).
    - Bake texture/vẽ `secret_challenge_crystal` (trụ tinh thể lăng trụ tím-vàng lơ lửng khi chưa kích hoạt, bệ đá tắt sáng sau khi kích hoạt) và prompt `[E]` trong `interact-prompt.ts` & `room-entities-sync.ts`.

- [ ] **Step 1: Write the failing client unit tests in `apps/client/test/ap2-p4b-duo-ui-fx.test.ts`**
  - Kiểm định `getBuffVisualMeta` & `resolveLocalizedBuffText` cho cả 6 `DuoBoonId` ở cả `'vi'` và `'en'`: `isDuoBoon === true`, `requiredElements` khớp 100%, `badgeText` chứa nhãn Giao Thoa / Duo Boon và tên 2 nguyên tố, không rò rỉ `snake_case`.
  - Kiểm định `drawDuoBoonIntersectingEmblems` và `buildSecretArenaHudViewModel` (trạng thái `active` ở `16.4s`, cảnh báo đỏ ở `3.2s`, băng rôn `victory` `+40` Vàng, băng rôn `expired`, và `null` khi `idle`).
  - Kiểm định `handleP4BSimEvent` nhận đúng `duo_cryo_shatter_spire`, `duo_napalm_chain_plague`, `secret_trial_started`, `secret_trial_resolved` và lọc an toàn theo `roomId`.

- [ ] **Step 2: Run client Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/client test -- ap2-p4b-duo-ui-fx`
  - Expected: FAIL (`secret-arena-hud.ts`, `combat-fx-p4b.ts` và meta Duo Boon chưa được cài đặt).

- [ ] **Step 3: Implement Duo Boon Diamond-Rainbow UI, 20s HUD, Crystal prop visual & `combat-fx-p4b.ts`**
  - Cập nhật `apps/client/src/ui/blessing-card-visuals.ts` và bổ sung `duoBoonIds` vào chữ ký `modalKey` + tổng thẻ sở hữu trong `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`.
  - Hiện thực `apps/client/src/ui/secret-arena-hud.ts`, `apps/client/src/fx/combat-fx-p4b.ts`, texture/sync cho `secret_challenge_crystal` trong `texture-baker.ts`, `room-entities-sync.ts`, `interact-prompt.ts`, và gắn hook 1–2 dòng vào `telegraphs-and-overlays.ts` & `sim-events.ts`.

- [ ] **Step 4: Run Vitest, typecheck & lint to verify GREEN**
  - Run: `pnpm --filter @ashen-pact/client test -- ap2-p4b-duo-ui-fx && pnpm --filter @ashen-pact/client test -- ap2-p1d-blessing-ui-fx && pnpm typecheck && pnpm lint`
  - Expected: PASS 100%, `0` lỗi lint/typecheck, mọi file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 3**
  - `git commit -m "feat(client): add duo boon diamond-rainbow cards, 20s secret arena HUD and P4B VFX (P4B.3)"`

---

### Task 4 (`P4B.4`): Xây Dựng 5 Cảnh Chụp & Strip Engine 2.6 Cho Duo Boons & Đấu Trường Bí Mật 20s (`visual-scene-ap2-p4b.ts`)

**Files:**
- Create: `tests/e2e/helpers/visual-scene-ap2-p4b.ts`
- Modify: `tests/e2e/helpers/visual-scene-ap2-p4.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`
- Modify: `tools/run-shots.ts`

**Interfaces:**
- Consumes: `makeScene`, `markPostWarmupStart`, `queueStepInput`, `stepDeterministicFrames`, `lockCameraAndIrisToPlayer`, `type VisualSceneDef` từ `tests/e2e/helpers/visual-scene-helpers.js`; `INPUT_BUTTON` từ `@ashen-pact/shared`.
- Produces:
  - `AP2_P4B_SCENE_IDS` & `AP2_P4B_VISUAL_SCENES` trong `tests/e2e/helpers/visual-scene-ap2-p4b.ts` (được đăng ký vào `VISUAL_SCENES` trong `visual-scenes.ts` và nhóm `'ap2-p4b'` trong `tools/run-shots.ts`):
    1. `ap2-modal-duo-boon-card` — Cảnh tĩnh Modal chọn Phước lành tiếng Việt có ô thẻ thứ 3 là Thẻ Giao Thoa Nguyên Tố (`duo_magnetic_bastion_ring` hoặc `duo_superheated_cyclone`) đang được chọn/hover nổi bật với **Viền Cầu Vồng Kim Cương** và **2 biểu tượng nguyên tố giao nhau**, cùng chip Duo Boon trên HUD.
    2. `ap2-duo-magnetic-bastion-ring` — Strip **8 frames** chuẩn Engine 2.6: `F1 = windup_hold` (`stepCount: 0`, 1 Bia Chắn đã `'flipped'`, người chơi mang `duo_magnetic_bastion_ring` đứng cạnh Bia Chắn thứ 2 đang `'low'` trong khoảng cách `<= 220px`, 2 quái đứng trên đường nối giữa 2 bàn) -> nhấn `INPUT_BUTTON.INTERACT` (`[E]`) qua `queueStepInput` lật bàn thứ 2 -> Lưới Hồ Quang Điện tự động giăng sáng rực giữa 2 tấm Bia Chắn `'flipped'` và đốt quái tại `F5 ★ HERO` (`apexEvent: 'damage_dealt'`).
    3. `ap2-duo-superheated-cyclone` — Strip **8 frames** chuẩn Engine 2.6: `F1 = windup_hold` (`stepCount: 0`, người chơi mang `duo_superheated_cyclone` cầm vũ khí Băng/Lửa, quái đầu đang cháy `burnTimer > 0`, 2 quái khác đứng kế bên) -> bắn qua `queueStepInput(INPUT_BUTTON.FIRE)` kích hoạt phản ứng `vaporize` -> hóa thành **Lốc Xoáy Nước Sôi** tại `F4/F5 ★ HERO` (`apexEvent: 'elemental_reaction'`) tự động cuốn đuổi theo đám quái ở `140 px/s` qua `F5–F8`.
    4. `ap2-duo-plasma-overload-star` — Strip **8 frames** chuẩn Engine 2.6: `F1 = windup_hold` (`stepCount: 0`, người chơi mang `duo_plasma_overload_star` trong hành lang tường hẹp rõ rệt, quái đầu đang dính `burnTimer > 0`) -> bắn đạn Sét qua `queueStepInput(INPUT_BUTTON.FIRE)` kích hoạt `overload` -> sinh **Quả Cầu Lửa-Điện (`Plasma Star`)** lao ở `420 px/s` nảy qua lại giữa 2 bức tường xuyên qua hàng quái (`apex` tại `heroFrameIndex`, `apexEvent: 'projectile_impact'` hoặc `'damage_dealt'`).
    5. `ap2-secret-arena-20s-trial` — Strip **8 frames** chuẩn Engine 2.6: trong phòng `secret`, giai đoạn `setup` (trước `markPostWarmupStart`) kích hoạt thật `secret_challenge_crystal` và dọn tới tên Tinh Anh cuối cùng còn ít máu đứng trước mặt người chơi cạnh Rương `Rare/Epic` và Thùng Nổ/Bia Chắn; `F1 = windup_hold` (`stepCount: 0`, hiển thị rõ **Đồng hồ đếm ngược `20.0s` trên HUD**, Tinh Thể đã kích hoạt, rương gốc và tên Tinh Anh cuối) -> khai hỏa qua `queueStepInput(INPUT_BUTTON.FIRE)` hạ gục Tinh Anh dưới `20.0s` tại `F5 ★ HERO` (`apexEvent: 'secret_trial_resolved'` hoặc `'entity_killed'`) -> Rương Thăng Hoa rực vàng lên bậc **`legendary`** kèm băng rôn `+40 Vàng` ở `F5–F8`.

- [ ] **Step 1: Implement `tests/e2e/helpers/visual-scene-ap2-p4b.ts` and register `'ap2-p4b'` in `visual-scenes.ts` & `tools/run-shots.ts`**
  - Đảm bảo cả 4 cảnh strip tuân thủ tuyệt đối Engine 2.6: `F1` là `stage: 'windup_hold'` với `stepCount: 0`; đúng 1 frame có `stage: 'apex'` trùng `heroFrameIndex`; mọi chuyển động sau `markPostWarmupStart` chỉ đi qua `queueStepInput` + `stepDeterministicFrames` (`externalStateMutations === 0`); khai báo `subjectSelector` và `roiSubjects` khớp tọa độ chủ thể để xuất `-roi-*.png` `1:1 Native Pixel` sắc nét.

- [ ] **Step 2: Run live Engine 2.6 `HARD_ASSERT` + `--verify-freeze` capture on all 5 `ap2-p4b` scenes**
  - Run: `pnpm shots -- --phase ap2-p4b --label after --group ap2-p4b --verify-freeze`
  - Expected: Exit code `0`, cả 5/5 cảnh sinh đủ `.png` (và `-strip.png`, `-roi-*.png`, `-telemetry-summary.md` cho 4 cảnh strip), vượt qua 5/5 cổng định lượng `evaluateAnimationGates('HARD_ASSERT')` với `diffPixels === 0` và `externalMutations === 0`.

- [ ] **Step 3: Run typecheck & lint**
  - Run: `pnpm typecheck && pnpm lint`
  - Expected: PASS 100%, mọi file `.ts` `< 1000` dòng.

- [ ] **Step 4: Commit Task 4**
  - `git add tests/e2e/helpers/visual-scene-ap2-p4b.ts tests/e2e/helpers/visual-scene-ap2-p4.ts tests/e2e/helpers/visual-scenes.ts tools/run-shots.ts docs/screenshots/ap2-p4b`
  - `git commit -m "test(visual): add 5 Engine 2.6 scenes for duo boons and 20s secret arena (P4B.4)"`

---

### Task 5 (`P4B.5`): Visual Gate Độc Lập (`Model: 'pro'`), Whole-Phase Code Review & Phase Gate `P4B` (`ap2-p4b`)

**Files:**
- Create: `docs/screenshots/ap2-p4b/review-1.md`
- Modify: `docs/PHASES.md`
- Modify: `docs/PROGRESS.md`

- [ ] **Step 1: Dispatch Independent `pro` Visual Reviewer (`research`, `Model: 'pro'`)**
  - Đọc trực tiếp toàn bộ ảnh thực tế trong `docs/screenshots/ap2-p4b/before/` và `docs/screenshots/ap2-p4b/after/` (`<scene>.png`, các ảnh cận cảnh `1:1 Native Pixel` `<scene>-roi-*.png`, `<scene>-strip.png`, `<scene>-telemetry-summary.md`, `metrics.json`), trả lời 5 câu hỏi kiểm toán chuyển động Mục `0.4` và chấm điểm Rubric 10 Tiêu Chí Mục `6`.
  - Lưu nguyên văn báo cáo vào `docs/screenshots/ap2-p4b/review-1.md`. Nếu có bất kỳ tiêu chí nào `< 8.0 / 10` hoặc có `blocker` / `major`, thực hiện vòng sửa lỗi -> chạy lại `pnpm shots -- --phase ap2-p4b --label after --group ap2-p4b --verify-freeze` -> chấm lại tới khi đạt `10/10` tiêu chí `>= 8.0 / 10`, `0 blocker`, `0 major`.

- [ ] **Step 2: Dispatch Whole-Phase `P4B` Senior Code Reviewer (`research`, `Model: 'pro'`)**
  - Kiểm toán toàn bộ diff `ap2-p4a..HEAD`, thực hiện 1 vòng sửa gọn + scoped re-review nếu phát hiện bất kỳ lỗi đồng bộ mạng, logic gameplay hoặc rủi ro hiệu năng nào.

- [ ] **Step 3: Run Full Phase Gate (`verification-before-completion`)**
  - Kiểm toán tĩnh: 100% file `.ts` `< 1000` dòng và `0` `Math.random()` trong `packages/shared/src/sim/`.
  - Run: `pnpm verify` (khôi phục các ảnh legacy `docs/screenshots/phase-0..phase-8` và `polish-p1` bị `pnpm e2e` ghi lại nếu có).
  - Run: `pnpm perf` (GPU thật `1080p High`, VSync Stress `>= 58 FPS`, Uncapped `p95 < 4.5ms` server tick).
  - Expected: Toàn bộ cổng kiểm định PASS `exit 0`.

- [ ] **Step 4: Update Living Progress Docs, Commit & Tag `ap2-p4b`**
  - Cập nhật `docs/PHASES.md`, `docs/PROGRESS.md`, SDD ledger `.superpowers/sdd/2026-10-27-ap2-p4b-duo-boons-secret-arena/progress.md` và `task.md`.
  - `git commit -m "docs(p4b): complete visual gate, phase gate and tag ap2-p4b"`
  - `git tag ap2-p4b`
