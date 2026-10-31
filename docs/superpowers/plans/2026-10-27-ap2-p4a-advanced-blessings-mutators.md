# Ashen Pact 2.0 — Phase P4A: 8 Phước Lành Hành Động Nâng Cao & 4 Bản Độ Búa Rèn Mở Rộng (`ap2-p4a`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đủ **24/24 Phước Lành Hành Động** (bổ sung 8 thẻ nâng cao đánh dấu Phase 4 thuộc 4 nhóm `table_tech`, `dash_tech`, `reload_tech`, `bullet_mod`) và **10/10 Bản Độ Búa Rèn (`Daedalus Weapon Mutators #7–#10`)** với đồng bộ mạng 60Hz tất định, song ngữ `vi`/`en`, Procedural VFX chuẩn Golden Room v0.2.0 và 4 cảnh strip kiểm định chuyển động chuẩn **Engine 2.6 (`HARD_ASSERT` + `--verify-freeze`)**.

**Architecture:** Tách toàn bộ logic mô phỏng mới của Phase P4A sang 2 module độc lập `packages/shared/src/sim/sim-blessings-p4a.ts` (`< 700` dòng) và `packages/shared/src/sim/sim-weapon-mutators-p4a.ts` (`< 550` dòng), phần hiệu ứng sang `apps/client/src/fx/combat-fx-p4a.ts` (`< 650` dòng), và 4 cảnh strip sang `tests/e2e/helpers/visual-scene-ap2-p4.ts` (`< 650` dòng). Kết nối vào các file hiện hữu đang sát ngưỡng 1000 dòng (`sim-projectiles.ts` 981 dòng, `sim-enemies-core.ts` 978 dòng, `visual-scenes.ts` 971 dòng, `sim-props-spawning.ts` 967 dòng) chỉ bằng các lời gọi hook mỏng 1–3 dòng; tận dụng cơ chế đồng bộ mạng `sim.summons`, `sim.props`, `bullet_volley_spawned` (`SHOT_FLAG.DYNAMIC_BOUNCE` + `replacedProjectileId`) và `projectiles_destroyed` đã khóa ở `snapshot-codec.ts`.

**Tech Stack:** TypeScript 5.x, Vitest (TDD `RED → GREEN → REFACTOR`), Phaser 3 Procedural Graphics, Colyseus 60Hz Deterministic Simulation (`SeededRandom`), Playwright Engine 2.6 Visual Verification (`pnpm shots -- ... --verify-freeze`, `evaluateAnimationGates('HARD_ASSERT')`).

**Spec:** `docs/superpowers/specs/2026-10-26-ashen-pact-2.0-overhaul-design.md` (Rev 4 — Section 4.1, 4.2 `#5, #6, #11, #12, #17, #18, #23, #24`, Section 4.4 `#7–#10`, Section 4.6 `3-Bucket Damage Pipeline & M_EnemyVuln delta_caustic`) & `master-promt-v3.md` (`Phase P4A` dòng 1034–1069, Mục `0.3–0.6`, Mục `6–7`).

## Global Constraints

- **Giới hạn kích thước file cứng (`< 1000` dòng):** 100% file `.ts` trong toàn dự án bắt buộc `< 1000` dòng. Các file cận trần (`arena-map.ts` 999, `sim-projectiles.ts` 981, `sim-enemies-core.ts` 978, `visual-scenes.ts` 971, `sim-props-spawning.ts` 967, `network-transport.ts` 949, `sim-combat-damage.ts` 947, `sim-skills-mechanics.ts` 944, `sim-tactical-physics.ts` 927) chỉ được gắn hook mỏng 1–3 dòng.
- **Tính tất định & Đồng bộ mạng 60Hz 4P:** Tuyệt đối cấm `Math.random()` trong `packages/shared/src/sim/` (chỉ dùng `SeededRandom` / `this.rng`). Mọi chùm đạn sinh qua `spawnDeterministicVolley` dùng `deterministicId = (((ev.eventId ?? 1) & 0x3fffff) << 6) | (i & 0x3f)`; đạn bẻ hướng động (`bullet_orbit_return`) bắt buộc gắn `SHOT_FLAG.DYNAMIC_BOUNCE`, phát `bullet_volley_spawned` có `replacedProjectileId` từ Server và giữ `awaitingServerRedirectTimer = 0.12` trên Client (`Zero-Rubberband Client Hold`).
- **Trần thực thể & Chống nổ số (`Anti-Runaway Math`):** Tuân thủ `MAX_PLAYER_PROJECTILES = 240`, `MAX_ENEMY_PROJECTILES = 160`, `MAX_TACTICAL_PROPS_PER_ROOM = 16`, `MAX_DEPLOYABLES_PER_PLAYER = 8`, `MAX_PELLETS_PER_TRIGGER = 9`, `splitGeneration: 0 | 1`, `scaleBlessingDamage(baseDmg, F) = round(baseDmg * (1 + 0.22 * (F - 1)))`, và `M_EnemyVuln = min(1.75, 1 + delta_marked(0.25) + delta_superconduct + delta_caustic(0.25) + delta_bossArmorBreak(0.40))`.
- **Kỷ luật Nhóm 3 (`Reload, Vent & Finisher Techs`):** Chỉ kích hoạt khi bấm trúng `Perfect Reload [R]`, `Tactical Vent [R]`, bắn `Finale Shot` (riêng `reload_caustic_pod`), hoặc khi Đòn 3 `MELEE_COMBO` chém trúng ít nhất 1 quái / Parry ít nhất 1 đạn (tuyệt đối cấm kích hoạt khi chém cận chiến vào không khí; tuân thủ `ICD = 1.5s` súng / `2.0s` cận chiến).
- **Bảo toàn chuẩn thị giác Golden Room v0.2.0 & Engine 2.6 `HARD_ASSERT`:** `vignetteStrength = 0.0`, không sương mù, đạn địch `#E84545` lõi trắng viền `INK_DARK` `1.5u` luôn nổi bật nhất; mọi cảnh strip có `F1 = windup_hold` (`stepCount: 0`), đúng 1 `apex` tại `heroFrameIndex`, `apexEvent` thật từ `WorldSim`, chỉ dùng Whitelist Input API, `externalStateMutations === 0`, `nonNumericAlertOverlapCount === 0`, `minActorContainmentRatio === 1.0`, `diffPixels === 0`.
- **Song ngữ Việt – Anh (`packages/shared/src/i18n/vi.json` & `en.json`):** Mọi thẻ Phước lành và Mutator mới phải đồng bộ 100% tập khóa lá giữa `vi.json` và `en.json`, không rò rỉ khóa thô (`buffs.*`).

## Review Focus

1. **`table_tech_magnet_snare` bị vòng lặp đẩy lùi gốc của `flipCoverProp` hất văng ngược ra ngoài:** Trong `sim-tactical-physics.ts:343-359`, `flipCoverProp` hiện gọi `applyFlipCoverTableTechBlessings` trước vòng lặp đẩy lùi `FLIP_COVER_KNOCKBACK_RADIUS`. Nếu kéo 4 quái gom vào mặt trước tấm chắn trước vòng đẩy lùi, chúng sẽ bị đẩy văng đi thay vì nằm gọn trước mặt chắn để `Dash-Kick`, hoặc bị kéo lọt xuống ô `chasm` / tường đặc -> **Test ghim tại Task 1 (`ap2-p4a-blessings-group1-2.test.ts`):** xác nhận quái trong `180px` nằm sát mặt trước tấm chắn (`dist <= prop.radius + enemy.radius + 14`), không lọt vào tường/`chasm`, và bị `stunTimer >= 0.8`.
2. **`bullet_orbit_return` lặp vô hạn hoặc giật lùi (rubberband) trên Client 60Hz:** Nếu viên đạn đã hồi quy (`orbitReturned: true`) khi hết `ttlSec` lại tiếp tục kích hoạt `bullet_orbit_return`, hoặc đạn đặc biệt (`void_staff`, `emerald_cleaver_boomerang`, `dash_phase_blade`, `mutator_boomerang_saw`) bị đảo chiều lần 2, hoặc Client tự xóa đạn `DYNAMIC_BOUNCE` ngay khi `ttlSec <= 0` trước khi gói `replacedProjectileId` từ Server tới -> **Test ghim tại Task 2 (`ap2-p4a-blessings-group3-4.test.ts`):** kiểm thử cả trên `WorldSim` lẫn cặp `AuthoritativeServer + PredictedClient` (`NetworkTransport`), xác nhận đạn chỉ vòng ngược đúng 1 lần (`45% DMG Poison`), tự thu hồi khi chạm chủ nhân và ID đạn khớp 100% giữa Server và Client.
3. **`bullet_wall_tether` vượt trần `MAX_DEPLOYABLES_PER_PLAYER = 8` khi dùng chung với `rivet_gun` (`6` đinh tán) + `engineer_twin_turrets` (`2` trụ):** Tổng thực thể triển khai của 1 người chơi (`summons` của người đó + `magneticRivets` của người đó) vượt quá 8 nếu chỉ kiểm tra riêng lẻ số cọc `<= 2` -> **Test ghim tại Task 2 (`ap2-p4a-blessings-group3-4.test.ts`):** cắm sẵn 6 `magneticRivets` + 2 `tesla_turret`, bắn `Finale Shot` có `bullet_wall_tether` chạm tường và xác nhận thực thể cũ nhất bị thu hồi để tổng deployables của người chơi `<= 8` và tối đa `2` `wall_tether_pylon`.
4. **`reload_caustic_pod` kích hoạt khi chém cận chiến vào không khí hoặc cộng nổ số vượt trần `M_EnemyVuln = 1.75x`:** Người chơi đứng phòng trống vung Đòn 3 kiếm sinh vô hạn nang axit, hoặc `caustic (+0.25)` + `marked (+0.25)` + `superconduct (+0.30)` + `bossArmorBreak (+0.40)` không đi qua nắp `1.75x` -> **Test ghim tại Task 2 (`ap2-p4a-blessings-group3-4.test.ts`):** xác nhận chém Đòn 3 vào không khí sinh `0` `caustic_spore_pod`, bắn/sút vỡ nang áp `causticVulnTimer = 5.0` tăng đúng `+25%` sát thương nhận vào và bị kẹp cứng ở `<= 1.75x` khi cộng dồn mọi debuff.
5. **Mở rộng `getCompatibleWeaponMutators` làm vỡ tương thích `knight_sword` trong bài test `ap2-p2a-daedalus-mutators.test.ts` hoặc `mutator_cluster_mortar` vi phạm `splitGeneration = 1` / `MAX_PELLETS_PER_TRIGGER = 9`:** Nếu Mutator `#9` hoặc `#10` cho phép gắn lên vũ khí `melee` trong Đe Rèn, bể Mutator cận chiến vượt quá 2 làm trượt kiểm định P2A (`expect(p2.mutatorChoices).toContain('mutator_shockwave_edge')`); và nếu `mutator_cluster_mortar` tách 3 mảnh nổ trên mỗi tia của súng đã tách 3 (`mutator_prism_splitter`), tổng mảnh vượt trần -> **Test ghim tại Task 3 (`ap2-p4a-expanded-mutators.test.ts`):** khóa `compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT'], excludedCategories: ['melee']` cho Mutators `#7–#10` đúng theo Spec Rev 4 Section 4.4, giữ nguyên `getCompatibleCoreMutatorsForWeapon` (6 core) song song với `getCompatibleWeaponMutators` (10 all), và kiểm chứng `mutator_cluster_mortar` vượt qua `low`/`flipped` cover + giới hạn mảnh con `splitGeneration = 1`.

---

## File Decomposition Map (Strict `< 1000` Lines Guarantee)

- **Create:**
  - `packages/shared/src/sim/sim-blessings-p4a.ts` (`< 700` lines) — Toàn bộ cơ chế mô phỏng của 8 Phước lành Hành động nâng cao Phase P4A.
  - `packages/shared/src/sim/sim-weapon-mutators-p4a.ts` (`< 500` lines) — Toàn bộ cơ chế mô phỏng của 4 Bản độ Búa Rèn mở rộng `#7–#10`.
  - `apps/client/src/fx/combat-fx-p4a.ts` (`< 600` lines) — Toàn bộ Procedural Vector VFX cho 8 Phước lành & 4 Mutators của Phase P4A.
  - `tests/e2e/helpers/visual-scene-ap2-p4.ts` (`< 550` lines) — 4 kịch bản cảnh strip chuẩn Engine 2.6 cho nhóm `ap2-p4a`.
  - `packages/shared/test/ap2-p4a-blessings-group1-2.test.ts`
  - `packages/shared/test/ap2-p4a-blessings-group3-4.test.ts`
  - `packages/shared/test/ap2-p4a-expanded-mutators.test.ts`
- **Modify (Thin Hooks & Data Definitions Only):**
  - `packages/shared/src/data/blessings.ts` (`431 → ~560` lines)
  - `packages/shared/src/data/weapon-mutators.ts` (`163 → ~185` lines)
  - `packages/shared/src/i18n/vi.json` & `packages/shared/src/i18n/en.json`
  - `packages/shared/src/sim/world-sim-types.ts` (`889 → ~915` lines)
  - `packages/shared/src/sim/sim-blessings.ts` (`581 → ~595` lines)
  - `packages/shared/src/sim/sim-blessings-dash-reload.ts` (`603 → ~620` lines)
  - `packages/shared/src/sim/sim-weapon-mutators.ts` (`540 → ~555` lines)
  - `packages/shared/src/sim/sim-weapon-cadence.ts` (`868 → ~882` lines)
  - `packages/shared/src/sim/sim-player.ts` (`837 → ~845` lines)
  - `packages/shared/src/sim/sim-tactical-physics.ts` (`927 → ~940` lines)
  - `packages/shared/src/sim/sim-combat-damage.ts` (`947 → ~955` lines)
  - `packages/shared/src/sim/sim-skills-mechanics.ts` (`944 → ~956` lines)
  - `packages/shared/src/sim/sim-props-spawning.ts` (`967 → ~974` lines)
  - `packages/shared/src/sim/sim-enemies-core.ts` (`978 → ~984` lines)
  - `packages/shared/src/sim/sim-projectiles.ts` (`981 → ~992` lines)
  - `apps/client/src/art/texture-baker.ts` (`507 → ~512` lines)
  - `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts` (`651 → ~700` lines)
  - `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts` (`798 → ~812` lines)
  - `tests/e2e/helpers/visual-scenes.ts` (`971 → ~976` lines)
  - `tools/run-shots.ts` (`284 → ~294` lines)
  - `packages/shared/test/ap2-p1d-blessings-group1.test.ts` (3 dòng cập nhật tổng số thẻ `BLESSING_LIST` theo `ALL_BLESSING_IDS.length`)

---

### Task 1 (`P4A.1`): TDD 4 Phước Lành Nâng Cao Nhóm 1 (`Barricade`) & Nhóm 2 (`Dash`) + Song Ngữ `vi`/`en`

**Files:**
- Create: `packages/shared/src/sim/sim-blessings-p4a.ts`
- Modify: `packages/shared/src/data/blessings.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/sim-blessings.ts`
- Modify: `packages/shared/src/sim/sim-blessings-dash-reload.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-skills-mechanics.ts`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Modify: `packages/shared/test/ap2-p1d-blessings-group1.test.ts`
- Test: `packages/shared/test/ap2-p4a-blessings-group1-2.test.ts`

**Interfaces:**
- Consumes: `scaleBlessingDamage(baseDmg, globalFloor)` từ `packages/shared/src/data/blessings.ts`; `hasPlayerBlessing(p, id)` từ `world-sim-types.ts`; `SHOT_FLAG` từ `protocol/messages.ts`; `WorldSim` methods (`spawnDeterministicVolley`, `damageEnemy`, `applyElementalHit`, `emitCombatText`, `destroyEnemyProjectilesInRadius` hoặc `events.push({ kind: 'projectiles_destroyed', ids })`).
- Produces:
  - Trong `packages/shared/src/data/blessings.ts`: giữ nguyên 100% `TABLE_TECH_BLESSING_IDS` (4), `DASH_TECH_BLESSING_IDS` (4), `RELOAD_TECH_BLESSING_IDS` (4), `BULLET_MOD_BLESSING_IDS` (4), `CORE_ACTION_BLESSING_IDS` (16), `ALL_PHASE1_BLESSING_IDS` (26); xuất thêm `PHASE4_TABLE_TECH_BLESSING_IDS` (`['table_tech_toxic_shrapnel', 'table_tech_magnet_snare']`), `PHASE4_DASH_TECH_BLESSING_IDS` (`['dash_thunder_decoy', 'dash_phase_blade']`), `PHASE4_ACTION_BLESSING_IDS`, `ALL_ACTION_BLESSING_IDS`, `ALL_BLESSING_IDS`.
  - Trong `world-sim-types.ts`: mở rộng `SummonKind` thêm `'thunder_decoy' | 'wall_tether_pylon' | 'holo_decoy_turret'`; thêm trường tùy chọn trên `SimPlayerState`: `dashPhaseBladeTimer?: number`, `toxicShrapnelIcdTimer?: number`, `holsterSurgeIcdTimer?: number`; trên `SimEnemyState`: `causticVulnTimer?: number`; trên `SimProjectileState` & `BulletVolleySpawnEvent`: `orbitReturned?: boolean`, `clusterMortarLob?: boolean`, `secondaryInfusedElement?: ElementType`.
  - Trong `packages/shared/src/sim/sim-blessings-p4a.ts`:
    - `enforcePlayerDeployableCap(sim: WorldSim, playerId: number): void` (giữ tổng `sim.summons` của `playerId` + `sim.magneticRivets` của `playerId` `<= MAX_DEPLOYABLES_PER_PLAYER` = `8`, thu hồi thực thể cũ nhất trước khi thêm mới).
    - `triggerTableTechToxicShrapnel(sim: WorldSim, owner: SimPlayerState, originX: number, originY: number): void`
    - `triggerTableTechMagnetSnare(sim: WorldSim, owner: SimPlayerState, anchorX: number, anchorY: number, frontAngleRad: number, frontOffsetPx: number): number`
    - `triggerP4ADashStartBlessings(sim: WorldSim, p: SimPlayerState, startX: number, startY: number): void`
    - `tryConsumeDashPhaseBladeOnAttack(sim: WorldSim, p: SimPlayerState, aimAngle: number): boolean`
    - `detonateThunderDecoy(sim: WorldSim, decoy: SimSummonState): void`
    - `resolveEnemyTargetWithThunderDecoy(sim: WorldSim, enemy: SimEnemyState, fallbackPlayer: SimPlayerState | null): { x: number; y: number; player: SimPlayerState | null; isDecoy: boolean }`
    - `updateP4ASummonsAndTethers(sim: WorldSim, dtSec: number): void`
    - `stepP4APlayerBlessingTimers(p: SimPlayerState, dtSec: number): void`

- [ ] **Step 1: Write the failing TDD unit tests in `packages/shared/test/ap2-p4a-blessings-group1-2.test.ts`**
  - Kiểm định dữ liệu & i18n (`vi`/`en`) cho 4 thẻ `table_tech_toxic_shrapnel` (`element: 'poison'`, `blessingGroup: 'table_tech'`), `table_tech_magnet_snare` (`element: 'shock'`, `blessingGroup: 'table_tech'`), `dash_thunder_decoy` (`element: 'shock'`, `blessingGroup: 'dash_tech'`), `dash_phase_blade` (`element: 'none'`, `blessingGroup: 'dash_tech'`), đồng thời `ALL_PHASE1_BLESSING_IDS` giữ nguyên `26`.
  - Kiểm định `table_tech_toxic_shrapnel`: (a) khi tấm chắn/đồ chơi vỡ (`damageProp`) hoặc (b) khi kẻ địch bị `Wall-Slam` / Boss đầy `bossStaggerAccum`, bắn đúng **8 Mũi Gai Độc 360°** (`radialStepRad = Math.PI / 4`, `scaleBlessingDamage(20, sim.currentFloor)` Poison DMG/mũi) và tạo ô `poison_swamp` trên mặt sàn (không ghi đè ô `chasm` hay tường), có `ICD = 0.35s` chống đệ quy vô hạn khi nhiều quái cùng đập tường một tick.
  - Kiểm định `table_tech_magnet_snare` *(Review Focus #1)*: ngay khi nhấn `[E]` Lật Chắn (`flipCoverProp`) — thực thi **SAU** vòng lặp đẩy lùi gốc để không bị đẩy văng ngược — kéo tối đa **4 kẻ địch gần nhất trong `180px`** gom sát mặt trước tấm chắn (`prop.x + cos(aimAngle) * (prop.radius + e.radius + 6)`), kẹp an toàn không lọt vào tường hoặc ô `chasm`, làm Choáng **`0.8s`** (`e.stunTimer >= 0.8`) và áp `shock`; đồng thời kích hoạt gom + choáng `0.8s` khi `Wall-Slam`.
  - Kiểm định `dash_thunder_decoy`: khi bắt đầu Lướt (`Dash`), để lại summon `'thunder_decoy'` (`ttlSec = 1.5s`, tối đa `2` bóng/người, tuân thủ `enforcePlayerDeployableCap` `<= 8`) tại tọa độ bắt đầu lướt; quái trong `220px` bị thu hút chạy/ngắm về phía tượng bóng sét thay vì người chơi; khi hết `1.5s` HOẶC ngay khi đạn địch chạm vào tượng bóng sét (`radius` va chạm), tượng phát nổ gây `scaleBlessingDamage(36, sim.currentFloor)` Shock DMG trong **`r = 88px`** và xóa sạch đạn địch trong `r = 88px` (phát sự kiện `projectiles_destroyed`).
  - Kiểm định `dash_phase_blade`: khi bắt đầu Lướt, gán `p.dashPhaseBladeTimer = 1.2`; phát bắn hoặc nhát chém cận chiến đầu tiên trong `1.2s` tiêu thụ timer về `0` và phóng kèm 1 **Lưỡi Sóng Chấn Động** xuyên quái (`weaponId: 'dash_phase_blade'`, tầm `~180px`, `scaleBlessingDamage(28, sim.currentFloor)` Physical DMG) xóa đạn địch trên đường bay (`destroysEnemyBullets` + `projectiles_destroyed`); phát bắn thứ 2 trong cùng cửa sổ không phóng thêm sóng.

- [ ] **Step 2: Run Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-blessings-group1-2`
  - Expected: FAIL (4 thẻ Phase 4 và `sim-blessings-p4a.ts` chưa tồn tại).

- [ ] **Step 3: Implement data, i18n, `sim-blessings-p4a.ts` (Group 1 & 2) and thin 1–3 line hooks**
  - Bổ sung 4 thẻ vào `packages/shared/src/data/blessings.ts` và khóa `buffs.<id>.{name,desc}` tương ứng vào `packages/shared/src/i18n/vi.json` & `en.json`; cập nhật 3 dòng kiểm tra độ dài tổng `BLESSING_LIST` / `FLOOR_BUFF_LIST` / `Object.keys(FLOOR_BUFFS)` trong `packages/shared/test/ap2-p1d-blessings-group1.test.ts:81-83` sang `ALL_BLESSING_IDS.length`.
  - Hiện thực `packages/shared/src/sim/sim-blessings-p4a.ts` cho 4 thẻ và gắn hook mỏng vào:
    - `sim-tactical-physics.ts` (`flipCoverProp` sau dòng 359 cho `table_tech_magnet_snare`; nơi tấm chắn trượt vỡ đâm tường cho `table_tech_toxic_shrapnel`).
    - `sim-props-spawning.ts` (`damagePropImpl` khi prop chiến thuật/bia chắn vỡ `hp <= 0` cho `table_tech_toxic_shrapnel`).
    - `sim-blessings.ts` (`applyWallSlamTableTechBlessings` gọi `triggerTableTechToxicShrapnel` & `triggerTableTechMagnetSnare`; đảm bảo bể rút thẻ `rollPerPlayerBuffChoices` rút từ toàn bộ `BLESSINGS` hợp lệ).
    - `sim-blessings-dash-reload.ts` (`triggerDashStartBlessings` gọi `triggerP4ADashStartBlessings`; `stepDashTechBlessings` gọi `stepP4APlayerBlessingTimers`).
    - `sim-weapon-cadence.ts` (khi khai hỏa súng hoặc vung đòn cận chiến gọi `tryConsumeDashPhaseBladeOnAttack`).
    - `sim-skills-mechanics.ts` (`updateSkillZonesAndSummonsImpl` xử lý `thunder_decoy` đếm ngược & nổ khi `ttlSec <= 0`, không rơi vào nhánh `tesla_turret`).
    - `sim-enemies-core.ts` (trong chọn mục tiêu quái tầm gần/xa, ưu tiên `thunder_decoy` còn sống trong `220px`).
    - `sim-projectiles.ts` (đạn `'dash_phase_blade'` xóa đạn địch chạm vào; đạn địch `b.team === 'enemy'` chạm `thunder_decoy` kích nổ `detonateThunderDecoy` ngay lập tức).

- [ ] **Step 4: Run focused & regression tests to confirm GREEN and check `< 1000` lines**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-blessings-group1-2 ap2-p1d-blessings`
  - Expected: PASS 100%, mọi file `.ts` đã chạm đều `< 1000` dòng.

- [ ] **Step 5: Commit Task 1**
  - `git commit -m "feat(p4a): implement 4 advanced barricade and dash blessings (P4A.1)"`

---

### Task 2 (`P4A.2`): TDD 4 Phước Lành Nâng Cao Nhóm 3 (`Reload/Vent`) & Nhóm 4 (`Bullet Geometry`) + Đồng Bộ Mạng 60Hz

**Files:**
- Modify: `packages/shared/src/data/blessings.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/sim-blessings-p4a.ts`
- Modify: `packages/shared/src/sim/sim-blessings-dash-reload.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-player.ts`
- Modify: `packages/shared/src/sim/sim-tactical-physics.ts`
- Modify: `packages/shared/src/sim/sim-props-spawning.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-enemies-core.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Test: `packages/shared/test/ap2-p4a-blessings-group3-4.test.ts`

**Interfaces:**
- Consumes: `enforcePlayerDeployableCap`, `sim-blessings-p4a.ts` từ Task 1; `computeEnemyVulnerabilityMultiplier({ marked, superconduct, caustic, bossArmorBreak, extraVulnAdd })` từ `packages/shared/src/sim/sim-damage-pipeline.ts`; `SHOT_FLAG` (`FINALE_SHOT`, `OVERCLOCKED_SHOT`, `DYNAMIC_BOUNCE`).
- Produces:
  - Trong `packages/shared/src/data/blessings.ts`: bổ sung `PHASE4_RELOAD_TECH_BLESSING_IDS` (`['reload_caustic_pod', 'reload_holster_surge']`) và `PHASE4_BULLET_MOD_BLESSING_IDS` (`['bullet_wall_tether', 'bullet_orbit_return']`), nâng tổng `ALL_ACTION_BLESSING_IDS` lên **24** và `ALL_BLESSING_IDS` / `BLESSING_LIST` lên **34** (`24 Action + 10 Skill`).
  - Trong `world-sim-types.ts`: mở rộng `PropKind` thêm `'caustic_spore_pod'` và trên `SimPropState` thêm `causticRollRemainingPx?: number`, `ownerPlayerId?: number`.
  - Trong `packages/shared/src/sim/sim-blessings-p4a.ts`:
    - `triggerReloadCausticPod(sim: WorldSim, p: SimPlayerState): boolean`
    - `detonateCausticSporePod(sim: WorldSim, prop: SimPropState, attackerPlayerId?: number): void`
    - `stepCausticSporePodRoll(sim: WorldSim, dtSec: number): void`
    - `triggerHolsterSurgeOnWeaponSwap(sim: WorldSim, p: SimPlayerState, prevSlot: number, nextSlot: number): boolean`
    - `tryPlantWallTetherPylonOnWallHit(sim: WorldSim, b: SimProjectileState, hitX: number, hitY: number): void`
    - `tryRedirectProjectileOrbitReturnOnExpiry(sim: WorldSim, b: SimProjectileState): boolean`
    - `checkOrbitReturnOwnerCatch(sim: WorldSim, b: SimProjectileState): boolean`

- [ ] **Step 1: Write the failing TDD unit & 60Hz network sync tests in `packages/shared/test/ap2-p4a-blessings-group3-4.test.ts`**
  - Kiểm định đủ **34** thẻ trong `BLESSING_LIST` (`24` Action + `10` Skill) và song ngữ `vi`/`en` đồng bộ 100% tập khóa lá.
  - Kiểm định `reload_caustic_pod` *(Review Focus #4)*:
    - Kích hoạt khi bấm trúng `Perfect Reload [R]`, `Tactical Vent [R]`, Đòn 3 `MELEE_COMBO` trúng quái/Parry đạn (tuyệt đối **không** kích hoạt khi vung Đòn 3 vào không khí!), HOẶC khi bắn `Finale Shot` -> sinh prop `'caustic_spore_pod'` lăn về phía trước đúng **`120px`** (`causticRollRemainingPx = 120`, dừng an toàn trước tường/`chasm`, tuân thủ `MAX_TACTICAL_PROPS_PER_ROOM = 16`).
    - Khi bắn đạn trúng hoặc `Dash-Kick` / `Melee-Kick` vào quả nang (nổ ngay hoặc bay chạm quái/tường nổ): gây mưa axit **`scaleBlessingDamage(38, sim.currentFloor)` Poison DMG** trong `r = 96px`, trải `poison_swamp`, và gán `enemy.causticVulnTimer = 5.0` (cộng `caustic: 0.25` vào `computeEnemyVulnerabilityMultiplier`, tăng `+25%` sát thương nhận vào và bị kẹp cứng ở `<= 1.75x` khi cộng dồn với `marked`, `superconduct`, `bossArmorBreak`).
  - Kiểm định `reload_holster_surge`: khi người chơi có `>= 2` vũ khí và đổi vũ khí bằng `[Q]` (`switchPlayerWeaponSlot`, `prevSlot !== nextSlot`, `ICD = 2.0s`), phóng ngay 1 tia sét xuyên quái trước mặt (`tầm ~260px`, **`scaleBlessingDamage(26, sim.currentFloor)` Shock DMG**) VÀ **nạp đầy ngay lập tức băng đạn / hạ nhiệt về `0%`** cho vũ khí vừa cất ở `prevSlot`; đổi súng liên tục trong vòng `< 2.0s` không kích hoạt lại.
  - Kiểm định `bullet_wall_tether` *(Review Focus #3)*: khi viên đạn mang `SHOT_FLAG.FINALE_SHOT` hoặc `SHOT_FLAG.OVERCLOCKED_SHOT` chạm tường, cắm summon `'wall_tether_pylon'` (`ttlSec = 4.5s`, tối đa **`2` cọc/người**, đồng thời tuân thủ tổng deployables của người chơi `<= MAX_DEPLOYABLES_PER_PLAYER (8)` khi có sẵn 6 `magneticRivets` + 2 `tesla_turret`); khi người chơi có đủ 2 cọc đang hoạt động, tự động căng **Dây Cắt Điện (`scaleBlessingDamage(26, sim.currentFloor)` Shock DMG/s, nhịp `0.25s`)** đốt mọi kẻ địch đi cắt qua đoạn thẳng nối 2 cọc.
  - Kiểm định `bullet_orbit_return` *(Review Focus #2)*:
    - Đạn tầm xa của người chơi sở hữu `bullet_orbit_return` được tự động gắn `SHOT_FLAG.DYNAMIC_BOUNCE`; khi bay hết tầm (`ttlSec <= 0` mà chưa đâm tường, `!b.orbitReturned`, loại trừ đạn đặc biệt không hồi quy như `void_staff`, `emerald_cleaver_boomerang`, `dash_phase_blade`, `mutator_boomerang_saw`), Server phát sự kiện `bullet_volley_spawned` với `replacedProjectileId: b.id`, `orbitReturned: true`, bẻ ngược 180° hướng về tọa độ hiện tại của người chơi, làm mới `hitEntityIds` để đánh trúng lưng quái với **`Math.max(1, Math.round(b.damage * 0.45))` Poison DMG**, tự hủy gọn khi thu về chạm chủ nhân (`dist <= owner.radius + 10`) và không bao giờ đảo chiều lần thứ 2.
    - Bài test mạng 60Hz `LocalLoopbackTransport` / `ColyseusClientTransport` (`Server` + `Client`): chứng minh Client giữ đạn tại cuối tầm (`Zero-Rubberband Client Hold`) và thay thế mượt bằng viên đạn hồi quy có `proj.id` khớp 100% với Server.

- [ ] **Step 2: Run Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-blessings-group3-4`
  - Expected: FAIL.

- [ ] **Step 3: Implement Group 3 & 4 blessings, `caustic` vulnerability wiring, and 60Hz `bullet_orbit_return` net sync**
  - Bổ sung 4 thẻ còn lại vào `packages/shared/src/data/blessings.ts` + `vi.json` & `en.json`.
  - Hiện thực các hàm trong `packages/shared/src/sim/sim-blessings-p4a.ts`:
    - `reload_caustic_pod`: kết nối vào `triggerReloadVentFinisherBlessings` (`sim-blessings-dash-reload.ts`) và nhánh `isFinale` của `sim-weapon-cadence.ts`; thêm `'caustic_spore_pod'` vào `isCircularKickableToyProp` (`sim-tactical-physics.ts`), xử lý lăn `120px` + nổ mưa axit khi bị bắn (`damagePropImpl`) hoặc bị `Dash-Kick` va quái/tường; nối `caustic: (enemy.causticVulnTimer ?? 0) > 0 ? 0.25 : 0` vào `computeEnemyVulnerabilityMultiplier` trong `sim-combat-damage.ts:114` và giảm dần `enemy.causticVulnTimer` theo `dtSec` trong `sim-enemies-core.ts`.
    - `reload_holster_surge`: kết nối 1 dòng vào `switchPlayerWeaponSlotImpl` (`sim-player.ts`) khi đổi sang slot hợp lệ khác `prevSlot`.
    - `bullet_wall_tether`: kết nối 1 dòng khi đạn người chơi chạm tường trong `sim-projectiles.ts`, cập nhật dây cắt điện mỗi `0.25s` trong `updateP4ASummonsAndTethers` (`sim-skills-mechanics.ts` gọi 1 dòng).
    - `bullet_orbit_return`: trong `sim-projectiles.ts` khi `b.ttlSec <= 0` trên Server gọi `tryRedirectProjectileOrbitReturnOnExpiry(this, b)` và trên đường về gọi `checkOrbitReturnOwnerCatch(this, b)`; trong `stepClientProjectilesCosmeticImpl` (`sim-projectiles.ts:694`), nếu đạn có `SHOT_FLAG.DYNAMIC_BOUNCE` và `!b.orbitReturned` chạm `b.ttlSec <= 0`, kích hoạt `Zero-Rubberband Client Hold` (`b.vx = 0; b.vy = 0; b.awaitingServerRedirectTimer = 0.12`) chờ gói `replacedProjectileId` từ Server; sao chép cờ `orbitReturned` trong `spawnDeterministicVolleyImpl`.

- [ ] **Step 4: Run focused & regression tests to confirm GREEN and `< 1000` lines**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-blessings-group3-4 ap2-p4a-blessings-group1-2 ap2-p1d-blessings ap2-damage-pipeline`
  - Expected: PASS 100%, `sim-projectiles.ts` và toàn bộ file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 2**
  - `git commit -m "feat(p4a): implement 4 advanced reload and bullet geometry blessings with 60Hz net sync (P4A.2)"`

---

### Task 3 (`P4A.3`): TDD 4 Bản Độ Búa Rèn Mở Rộng (`Daedalus Weapon Mutators #7–#10`) + Biểu Tượng Modal Đe Rèn

**Files:**
- Create: `packages/shared/src/sim/sim-weapon-mutators-p4a.ts`
- Modify: `packages/shared/src/data/weapon-mutators.ts`
- Modify: `packages/shared/src/sim/sim-weapon-mutators.ts`
- Modify: `packages/shared/src/sim/sim-weapon-cadence.ts`
- Modify: `packages/shared/src/sim/sim-projectiles.ts`
- Modify: `packages/shared/src/sim/sim-combat-damage.ts`
- Modify: `packages/shared/src/sim/sim-skills-mechanics.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts`
- Test: `packages/shared/test/ap2-p4a-expanded-mutators.test.ts`

**Interfaces:**
- Consumes: `enforcePlayerDeployableCap` từ `sim-blessings-p4a.ts`; `hasActiveWeaponMutator(p, mutatorId)` từ `sim-weapon-mutators.ts`; `SHOT_FLAG` (`FINALE_SHOT`, `OVERCLOCKED_SHOT`).
- Produces:
  - Trong `packages/shared/src/data/weapon-mutators.ts`:
    - Cập nhật `WEAPON_MUTATORS` cho `#7 mutator_holo_decoy_gun`, `#8 mutator_cluster_mortar`, `#9 mutator_boomerang_core`, `#10 mutator_elemental_infusion` khớp 100% tên/mô tả song ngữ Spec Rev 4 Section 4.4, với `compatibleCadences: ['CLIP_RELOAD', 'HEAT_VENT']`, `excludedCategories: ['melee']` *(Review Focus #5)*.
    - Giữ nguyên `getCompatibleCoreMutatorsForWeapon(weaponId, alreadyAttached)` (lọc trên `CORE_WEAPON_MUTATOR_IDS` 6 bản độ) và cập nhật `getCompatibleWeaponMutators(weaponId, alreadyAttached)` lọc trên toàn bộ `ALL_WEAPON_MUTATOR_IDS` (10 bản độ); chuyển `activateDaedalusAnvilImpl` trong `sim-weapon-mutators.ts:169` sang gọi `getCompatibleWeaponMutators`.
  - Trong `packages/shared/src/sim/sim-weapon-mutators-p4a.ts`:
    - `triggerP4AMutatorsOnPerfectReloadOrVent(sim: WorldSim, p: SimPlayerState, weaponId: string): void`
    - `updateHoloDecoyTurretSummon(sim: WorldSim, sum: SimSummonState, dtSec: number): void`
    - `resolveElementalInfusionSecondaryElement(p: SimPlayerState, shotFlags: number, isMeleeFinisher?: boolean): ElementType`
    - `triggerClusterMortarSubmunitions(sim: WorldSim, b: SimProjectileState, hitX: number, hitY: number): void`
    - `stepBoomerangCoreSawProjectile(sim: WorldSim, b: SimProjectileState, dtSec: number): boolean`

- [ ] **Step 1: Write the failing TDD unit tests in `packages/shared/test/ap2-p4a-expanded-mutators.test.ts`**
  - Kiểm định `ALL_WEAPON_MUTATOR_IDS` có đủ **10** Mutators, Đe Rèn Cổ Đại (`activateDaedalusAnvilImpl`) rút được các Mutators Phase 4 cho súng `CLIP_RELOAD` / `HEAT_VENT`, đồng thời `knight_sword` (`melee`) vẫn chỉ nhận `[mutator_gravity_singularity, mutator_shockwave_edge]` để bảo toàn tuyệt đối `ap2-p2a-daedalus-mutators.test.ts`.
  - Kiểm định `mutator_holo_decoy_gun`: khi bấm trúng `Perfect Reload [R]` hoặc `Tactical Vent [R]`, để lại summon `'holo_decoy_turret'` (`ttlSec = 3.5s`, tối đa **`1` bóng/người** — nếu đã có thì thay thế bóng cũ, tuân thủ `enforcePlayerDeployableCap <= 8`) tự động bắn đạn phụ họa (**`40% DMG`** vũ khí đang cầm) về phía con trỏ chuột của người chơi (`p.aimWorldX/Y` hoặc `p.aimAngle`).
  - Kiểm định `mutator_cluster_mortar` *(Review Focus #5)*: đạn bắn ra mang cờ `clusterMortarLob: true` bay cầu vồng **vượt qua Bia Chắn (`'low'` và `'flipped'`) mà không bị chặn giữa đường**, và khi chạm đích (quái hoặc tường/cuối tầm) tách thành **3 mảnh nổ phụ** (`~45% DMG` mỗi mảnh, `splitGeneration = 1`, tuân thủ trần `MAX_PELLETS_PER_TRIGGER = 9` và không bao giờ tách tiếp thế hệ thứ 2).
  - Kiểm định `mutator_boomerang_core`: khi bấm trúng `Perfect Reload [R]` hoặc `Tactical Vent [R]`, phóng 1 lưỡi cưa năng lượng xoay (`weaponId: 'mutator_boomerang_saw'`) bay ra xa **`200px`** rồi đảo chiều thu về vị trí hiện tại của người chơi, gây **`scaleBlessingDamage(32, sim.currentFloor)` DMG** xuyên quái trên cả lượt đi và lượt về.
  - Kiểm định `mutator_elemental_infusion`: khi người chơi mang vũ khí nguyên tố A ở ô đang cầm (ví dụ `tesla_carbine` `shock` hoặc `rivet_gun`) và vũ khí nguyên tố B ở ô còn lại (`weaponSlots[1 - activeWeaponSlot]`, ví dụ `focus_laser` `burn` hoặc `seed_gun` `poison`), mỗi phát `Finale Shot` hoặc `Overclocked Shot` (hoặc sau `Tactical Vent [R]` / Đòn 3 cận chiến nếu gắn) nhận thêm `secondaryInfusedElement = B`, áp đồng thời cả hai nguyên tố khi trúng quái để **tự kích nổ Phản Ứng Nguyên Tố (ví dụ `Overload` / `Superconduct` / `Toxic Blast`) chỉ bằng 1 khẩu súng**.

- [ ] **Step 2: Run Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-expanded-mutators`
  - Expected: FAIL.

- [ ] **Step 3: Implement `weapon-mutators.ts`, `sim-weapon-mutators-p4a.ts`, thin hooks, and Daedalus Modal emblems**
  - Cập nhật `packages/shared/src/data/weapon-mutators.ts` & `packages/shared/src/sim/sim-weapon-mutators.ts:169`.
  - Hiện thực `packages/shared/src/sim/sim-weapon-mutators-p4a.ts` và nối hook mỏng 1–2 dòng vào `sim-weapon-cadence.ts` (`Perfect Reload / Tactical Vent` + `secondaryInfusedElement`), `sim-projectiles.ts` (bỏ qua chặn cover cho `b.clusterMortarLob`, nổ 3 mảnh chùm khi chạm đích, cập nhật đường bay khứ hồi `200px` cho `'mutator_boomerang_saw'`), `sim-combat-damage.ts` (áp thêm `b.secondaryInfusedElement` khi trúng quái), và `sim-skills-mechanics.ts` (`updateHoloDecoyTurretSummon`).
  - Trong `apps/client/src/scenes/game-scene/hud-pact-and-forge-modals.ts`: thêm màu sắc đặc trưng vào `MUTATOR_COLOR_TABLE` và hình vẽ vector sắc nét trong `drawWeaponMutatorEmblem` cho 4 Mutators `#7–#10`.

- [ ] **Step 4: Run focused & regression tests across `@ashen-pact/shared` and `@ashen-pact/client`**
  - Run: `pnpm --filter @ashen-pact/shared test -- ap2-p4a-expanded-mutators ap2-p2a-daedalus-mutators ap2-p2a-forge-salvage-ui ap2-p2b-pacts-4-6`
  - Expected: PASS 100%, mọi file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 3**
  - `git commit -m "feat(p4a): implement 4 expanded Daedalus weapon mutators and forge modal emblems (P4A.3)"`

---

### Task 4 (`P4A.4`): Procedural Vector VFX (`combat-fx-p4a.ts`) & 4 Cảnh Chụp Strip Chuẩn Engine 2.6 (`visual-scene-ap2-p4.ts`)

**Files:**
- Create: `apps/client/src/fx/combat-fx-p4a.ts`
- Create: `tests/e2e/helpers/visual-scene-ap2-p4.ts`
- Modify: `apps/client/src/art/texture-baker.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts` (hoặc `room-entities-sync.ts` / `sim-events.ts` nếu cần 1–2 dòng hook VFX)
- Modify: `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts` (bổ sung kiểm tra `ALL_BLESSING_IDS` = 34 thẻ render badge & emblem không lỗi)
- Modify: `tests/e2e/helpers/visual-scenes.ts` (chỉ thêm 3 dòng import + spread `...AP2_P4A_VISUAL_SCENES`)
- Modify: `tools/run-shots.ts` (đăng ký nhóm `'ap2-p4a'`)

**Interfaces:**
- Consumes: `SimSummonState` (`'thunder_decoy' | 'wall_tether_pylon' | 'holo_decoy_turret'`), `SimPropState` (`'caustic_spore_pod'`), `SimProjectileState` (`orbitReturned`, `clusterMortarLob`, `weaponId === 'dash_phase_blade' | 'mutator_boomerang_saw'`) từ Tasks 1–3; `getFreezeVisualTimeSec` & `isVisualFreezeActive` cho đồng hồ thị giác tất định trong `?freeze=1`; Whitelist Input API (`queueStepInput`, `triggerFireWeapon`, `triggerReloadVent`, `triggerInteract`, `triggerDash`) từ `tests/e2e/helpers/visual-scene-helpers.ts`.
- Produces:
  - `drawP4ASummonOverlay(scene: GameScene, g: Phaser.GameObjects.Graphics, sim: WorldSim, sum: SimSummonState): void` và `drawP4AProjectileAndTetherOverlays(scene: GameScene, g: Phaser.GameObjects.Graphics, sim: WorldSim): void` trong `apps/client/src/fx/combat-fx-p4a.ts`:
    - `dash_thunder_decoy`: Tượng Bóng Sét bán trong suốt viền tím-vàng điện quang (`PALETTE.ELECTRIC_VIOLET` + `PALETTE.SOLAR_GOLD` + `INK_DARK`), vòng thu hút đứt nét `r = 88px` và chớp điện tâm tượng.
    - `bullet_wall_tether`: 2 Cọc Điện Cao Thế ghim tường có lõi sứ cách điện & đỉnh cầu phóng điện, nối nhau bằng **Dây Cắt Điện Cao Thế** răng cưa xanh-vàng rực nét nhưng không che khuất đạn địch `#E84545`.
    - `bullet_orbit_return`: Đạn hồi quy có hào quang ngọc lục bảo – tím xoắn 180° kèm mũi tên/vệt cong chỉ rõ quỹ đạo bay ngược về chủ nhân.
    - `mutator_holo_decoy_gun`: Bóng Pháo Ảnh hologram xanh lam ngọc (`#38BDF8`) có chân đế chiếu sáng, nòng súng xoay hướng con trỏ chuột và tia lửa nòng phụ họa.
    - Bổ trợ trực quan cho `dash_phase_blade` (lưỡi trăng khuyết bạc-xanh), `mutator_boomerang_saw` (đĩa cưa năng lượng xoay), `clusterMortarLob` (bóng đổ parabol dưới đất + độ nâng vòm cung), và ánh xạ `'caustic_spore_pod'` trong `TextureBaker.getPropTextureKey` (`texture-baker.ts`) kèm quầng bọt axit lục vàng.
  - `AP2_P4A_VISUAL_SCENES` trong `tests/e2e/helpers/visual-scene-ap2-p4.ts` gồm đúng **4 cảnh strip 8-frame chuẩn Engine 2.6** (`frameCount: 8`, `heroFrameIndex: 4`, `F1 = windup_hold` với `stepCount: 0`, đúng 1 `apex` tại `F5`, `apexEvent` thật từ `WorldSim`, chỉ dùng Whitelist Input API, `0` external mutations, `100%` actor containment):
    1. `ap2-p4a-wall-tether-pylons`: Người chơi mang `bullet_wall_tether` đã cắm Cọc Điện #1 vào tường trên, tại strip bắn phát `Overclocked/Finale Shot` cắm Cọc Điện #2 vào tường đối diện (`F5 ★ HERO`), căng Dây Cắt Điện Cao Thế cắt ngang cụm quái ở giữa hành lang.
    2. `ap2-p4a-orbit-return-bullets`: Người chơi mang `bullet_orbit_return` bắn loạt đạn tầm ngắn vượt qua sau lưng cụm quái; tại `F5 ★ HERO` loạt đạn chạm cực đại tầm bay, vòng ngược 180° (`DYNAMIC_BOUNCE`) chém ngược vào lưng quái với vệt Độc lục bảo.
    3. `ap2-p4a-thunder-decoy-dash`: Người chơi mang `dash_thunder_decoy` kích hoạt `triggerDash` lướt né chùm đạn địch, để lại Tượng Bóng Sét thu hút quái; tại `F5 ★ HERO` đạn địch chạm Tượng Bóng Sét kích nổ xung điện `r = 88px` xóa sạch đạn địch và giật sét cụm quái.
    4. `ap2-p4a-holo-decoy-mutator`: Người chơi cầm súng gắn `mutator_holo_decoy_gun` đang nạp đạn trong Khung Vàng, nhấn `triggerReloadVent` `[R]` rồi di chuyển sang bên để lộ rõ **Bóng Pháo Ảnh Hologram** tại vị trí cũ; tại `F5 ★ HERO` cả Bóng Pháo Ảnh và người chơi đồng loạt nã đạn giao thoa tiêu diệt mục tiêu tại con trỏ.

- [ ] **Step 1: Write unit tests for all 34 Blessing cards + 10 Mutator emblems & P4A VFX helpers**
  - Mở rộng `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts` kiểm tra đủ `ALL_BLESSING_IDS` (`34` thẻ) và hàm vẽ `drawP4ASummonOverlay` / `drawP4AProjectileAndTetherOverlays` không ném lỗi trên mock graphics.

- [ ] **Step 2: Run client Vitest to confirm RED failure**
  - Run: `pnpm --filter @ashen-pact/client test -- ap2-p1d-blessing-ui-fx`
  - Expected: FAIL (`drawP4ASummonOverlay` chưa tồn tại).

- [ ] **Step 3: Implement `combat-fx-p4a.ts`, thin client hooks, and 4 Engine 2.6 strip scenes in `visual-scene-ap2-p4.ts`**
  - Hiện thực `apps/client/src/fx/combat-fx-p4a.ts`, gắn nhánh `else if (sum.kind === 'thunder_decoy' || sum.kind === 'wall_tether_pylon' || sum.kind === 'holo_decoy_turret')` trong `telegraphs-and-overlays.ts:199` (để không rơi vào nhánh vẽ `tesla_turret` mặc định!), gọi `drawP4AProjectileAndTetherOverlays` và ánh xạ `'caustic_spore_pod'` trong `texture-baker.ts`.
  - Hiện thực `tests/e2e/helpers/visual-scene-ap2-p4.ts` và đăng ký nhóm `'ap2-p4a'` vào `tests/e2e/helpers/visual-scenes.ts` + `tools/run-shots.ts`.

- [ ] **Step 4: Run client unit tests & typecheck to confirm GREEN and `< 1000` lines**
  - Run: `pnpm --filter @ashen-pact/client test -- ap2-p1d-blessing-ui-fx && pnpm typecheck`
  - Expected: PASS 100%, `visual-scenes.ts` `< 980` dòng và mọi file `.ts` `< 1000` dòng.

- [ ] **Step 5: Commit Task 4**
  - `git commit -m "feat(p4a): add procedural VFX and 4 Engine 2.6 strip scenes for Phase P4A (P4A.4)"`

---

### Task 5 (`P4A.5`): Visual Gate (Engine 2.6 `HARD_ASSERT` + Independent `pro` Visual Reviewer), Phase Gate `P4A` & Tag `ap2-p4a`

**Files:**
- Create: `docs/screenshots/ap2-p4a/review-1.md` (và `review-N.md` nếu có vòng fix)
- Modify: `docs/PROGRESS.md`
- Modify: `docs/PHASES.md`
- Modify: `.superpowers/sdd/2026-10-27-ap2-p4a-advanced-blessings-mutators/progress.md`

- [ ] **Step 1: Chụp bộ ảnh `before` đối chiếu và bộ ảnh + strip `after` chuẩn Engine 2.6 `HARD_ASSERT` (`--verify-freeze`)**
  - Run: `pnpm shots -- --phase ap2-p4a --label after --group ap2-p4a --verify-freeze`
  - Expected: Toàn bộ 4/4 cảnh strip (`ap2-p4a-wall-tether-pylons`, `ap2-p4a-orbit-return-bullets`, `ap2-p4a-thunder-decoy-dash`, `ap2-p4a-holo-decoy-mutator`) vượt qua `5/5` cổng `evaluateAnimationGates('HARD_ASSERT')`, `diffPixels === 0`, `traceHashMatched === true`, `0` console/WebGL errors.

- [ ] **Step 2: Triệu hồi Independent Visual Reviewer (`research`, `Model: 'pro'`) kiểm định trực quan trên ảnh thực tế**
  - Reviewer đọc trực tiếp các file `.png`, `-roi-1.png`, `-roi-2.png`, `-strip.png`, `-telemetry-summary.md`, `metrics.json`, trả lời 5 câu hỏi `Stage-Based Audit Questions` và chấm điểm Rubric 10 tiêu chí; lưu biên bản tại `docs/screenshots/ap2-p4a/review-1.md`.
  - Nếu có bất kỳ lỗi `blocker` / `major` hoặc tiêu chí liên quan `< 8.0/10`: giao Implementer fix -> chụp lại `--verify-freeze` -> gọi Visual Reviewer mới cho đến khi PASS hoàn toàn.

- [ ] **Step 3: Chạy Whole-Phase Code Review (`Model: 'pro'`) & Phase Gate (`pnpm verify` + `pnpm perf` + kiểm toán `< 1000` dòng)**
  - Run: `pnpm verify` (`typecheck`, `lint`, `test`, `build`, `e2e`) -> PASS 100%.
  - Run: `pnpm perf` -> Server `p95 < 4.5ms`, Client VSync Normal `>= 60 FPS`, VSync Stress `>= 58 FPS`.
  - Quét toàn bộ file `.ts` trong repo xác nhận 100% file `< 1000` dòng và `0` `Math.random()` trong `packages/shared/src/sim/`.

- [ ] **Step 4: Cập nhật tài liệu tiến độ, commit & gắn tag `ap2-p4a`**
  - Cập nhật `docs/PROGRESS.md`, `docs/PHASES.md`, `.superpowers/sdd/2026-10-27-ap2-p4a-advanced-blessings-mutators/progress.md`.
  - `git commit -m "docs(p4a): complete visual gate, phase gate and prepare ap2-p4a"`
  - `git tag ap2-p4a`
