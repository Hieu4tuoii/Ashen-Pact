# Cutout 2.0 VFX Overhaul (Phase 4: Class Skills, 6 Cutout Summons, Peripheral Status & 6 Elemental Reactions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade all `5` hero class skills, `6` summon entities, `downed`/`icePrison`/`bastion_prism` tactical overlays, `4` peripheral shoulder status badges, `item_life_seed`, and all `6` elemental reactions to crisp, silhouette-preserving Cutout 2.0 art with `1:1` `(x, y)` hitbox honesty.

**Architecture:** Render all `5` class skills and `WorldSim` collision zones (`downed` `r = 64px`, `bastion_prism` `r = 33..44px`, `Arcanist` zones) `1:1` at `(x, y)` via Phase 1's routers and `depth 15.0/16.0/26.4/26.6/30.3/30.4` split depth layers. Replace primitive `depth 38` summon shapes with `8` pooled Cutout sprites (`summon_*` in `fx_cutout_kit_512`) at `depth 28.4–28.6` (`< 30.0` P1), replace full-body rainbow `applyStatusTint` with `64`-slot `statusRimPool` `2f` shoulder attachments (`depth 28.2`) + `status_badge_9x9` (`depth 48.0`), and route the `6` elemental reactions to their dedicated `256×64` `4f` mini-strips + `0.40s` `HUD Reaction Banner`.

**Tech Stack:** TypeScript, Phaser 3 (`WebGL1` / `Canvas2D`), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-15-cutout-vfx-and-ice-mirror-overhaul-design.md` (Sections 4.2–4.4, 5.1, 5.4 `C.4–C.5`, 6.3, 6.5, 6.7, 6.9)

## Global Constraints

- Every `WorldSim` spatial zone (`downed` `r = 64px`, `vanguard_bastion_prism` `shieldR`, `Arcanist` `skillZones`, `sacred_tree` / `life_blossom` aura pulses) MUST render `1:1` circular at `(x, y)` (`0.0 px` foot offset).
- Summons MUST render at `depth 28.4–28.6` (with `depth 19.0` ground shadows), strictly below local P1 (`30.0`) and Bosses (`30.6`).
- Engineer turret range ring MUST stay `0.00` alpha in steady state (shown `0.65s` on P1 placement only, `0.00` for allies).
- Zero full-body rainbow `applyStatusTint` on enemies/players, zero `Math.random()` in `shock` status rendering, and zero world-space floating reaction name popups (all reaction text coalesces into the `0.40s` `HUD Reaction Banner`).

## Review Focus

1. **`downed` (`r = 64px`), `vanguard_bastion_prism`, or `Arcanist` skill zones drifting to `(x, y + 12)` or `2.12:1` squash:** All three are circular `WorldSim` hitboxes centered at `(x, y)` and must render `1:1` circular at `(x, y)`, whereas `icePrison` (visual root cage) splits rear (`15.0`) / front (`30.3`) around the actor (pinned in Task 1 Step 1).
2. **Steady-state turret range circle clutter or `depth 38` summons occluding local P1:** Summon sprites must pool from `fx_cutout_kit_512` at `depth 28.4` (base), `28.5` (body), and `28.6` (`360°` rotating recoiling head for `tesla_turret` & `holo_decoy_turret`), with `electric_cutter` drawn via `fillTaperedLightningBolt` at `depth 26.6` and turret range alpha `=== 0` after `0.65s` (and always `0` for allies) (pinned in Task 1 Step 1).
3. **Full-body `applyStatusTint` erasing enemy silhouettes or non-deterministic `shock` jitter:** `statusRimPool` (`depth 28.2`) attaches `2f` shoulder sprites (`burn`, `chill`, `shock`, `poison`), `frozen` adds `status_freeze_cuff` at `(e.x, e.y + 12)` (`depth 28.3`), and `shock` corner index uses deterministic `((enemy.id * 31 + Math.floor(tick / 7)) & 3)` (pinned in Task 2 Step 1).
4. **Hidden 2nd elemental status on uninjured (`hp === maxHp`) enemies:** When an enemy carries `>= 2` active status elements while `hp === maxHp` (HP bar hidden), `status_badge_9x9` (`depth 48.0`) must anchor at fallback `(e.x, e.y - r_e - 10)` so players can still read reaction primers (pinned in Task 2 Step 1).
5. **Indistinguishable elemental reactions or floating reaction text clutter:** All `6` `ElementalReactionId`s must map `1:1` to their `256×64` `4f` mini-strips (`fx_react_*`), aggregate into the `0.40s` `HUD Reaction Banner` (`×N`), and trigger P1's `Team Combo` double foot-ellipse (`depth 15.0`) when `isTeamCombo === true` (pinned in Task 2 Step 1).

---

## File Structure

- **Modify:** `apps/client/src/fx/combat-fx-classes.ts`, `apps/client/src/fx/combat-fx-blessings-p1d.ts`, `apps/client/src/fx/combat-fx-p4a.ts`, `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`, `apps/client/src/scenes/game-scene/room-entities-sync.ts` — `5` class skills, `downed` `1:1` `r = 64px` 4-bracket ring, `vanguard_bastion_prism` `6` faceted plates (`depth 26.4` rear / `30.4` front), split `icePrison` (`15.0` / `30.3`), `6` Cutout summon sprite pool (`depth 28.4–28.6` + `19.0` shadow), `electric_cutter` (`depth 26.6`), and `item_life_seed` (`18×20px` at `depth 22.0`).
- **Modify:** `apps/client/src/scenes/game-scene/entity-sync.ts`, `apps/client/src/fx/combat-fx-spawners.ts`, `apps/client/src/fx/combat-fx-pools.ts`, `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts` — `64`-slot `statusRimPool` (`depth 28.2`), `status_freeze_cuff` (`28.3`), 2nd-element `status_badge_9x9` (`depth 48.0` with full-HP fallback), `6` elemental reaction mini-strips (`fx_react_*`), `0.40s` `HUD Reaction Banner`, and `Team Combo` foot ellipse.
- **Modify Tests:** `apps/client/test/commercial-class-and-interaction-vfx.test.ts`, `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`, `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`, `apps/client/test/topdown-shader-vfx-spawners.test.ts`.

---

### Task 1: `5` Class Skills, `(x, y)` `1:1` Tactical Overlays (`downed`, `bastion_prism`, `icePrison`) & `6` Cutout Summons (`depth 28.4–28.6`)

**Files:**
- Modify: `apps/client/src/fx/combat-fx-classes.ts`
- Modify: `apps/client/src/fx/combat-fx-blessings-p1d.ts`
- Modify: `apps/client/src/fx/combat-fx-p4a.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Test: `apps/client/test/commercial-class-and-interaction-vfx.test.ts`, `apps/client/test/ap2-p1d-blessing-ui-fx.test.ts`

**Interfaces:**
- Consumes: `routeCutoutBurstByRadius`, `routeCutoutDirectionalByReach`, `resolveAllyFxProfile` (`Plan 1 Task 4`); `fillTaperedArcRibbon`, `fillTaperedLightningBolt` (`Plan 1 Task 3`); `CUTOUT_KIT_ATLAS_KEY` (`summon_*`, `item_life_seed`) (`Plan 1 Task 2`).
- Produces:
  - `export interface PooledSummonVisual { summonId: number; shadow: Phaser.GameObjects.Sprite; base: Phaser.GameObjects.Sprite; head?: Phaser.GameObjects.Sprite; spawnAgeSec: number; aimAngleRad: number; recoilPx: number; }`
  - `export function syncSummonCutoutVisuals(scene: GameScene, summons: readonly SimSummonState[], localPlayerId: number, dtSec: number): void`
  - `export function renderDownedReviveBrackets(groundGfx: Phaser.GameObjects.Graphics, x: number, y: number, radiusPx: number, reviveProgress01: number): void`
  - `export function renderBastionPrismPlates(rearGfx: Phaser.GameObjects.Graphics, frontGfx: Phaser.GameObjects.Graphics, x: number, y: number, shieldRadiusPx: number, phaseRad: number, alpha: number): void`

- [ ] **Step 1: Write failing tests in `commercial-class-and-interaction-vfx.test.ts` and `ap2-p1d-blessing-ui-fx.test.ts`**

```ts
it('renders downed (r=64) and bastion_prism (r=38) circularly 1:1 at (x, y) and splits icePrison across depths 15.0 and 30.3', () => {
  const gfx = createRecordingGraphicsMock();
  renderDownedReviveBrackets(gfx as never, 250, 300, 64, 0.5);
  const radii = gfx.fillTriangleCalls.map((t) => Math.hypot(t.x0 - 250, t.y0 - 300));
  expect(Math.max(...radii)).toBeGreaterThan(62);
  expect(Math.max(...radii)).toBeLessThanOrEqual(66.5);

  const rear = createRecordingGraphicsMock();
  const front = createRecordingGraphicsMock();
  renderBastionPrismPlates(rear as never, front as never, 400, 400, 38, 0, 1.0);
  expect(rear.fillTriangleCalls.length).toBeGreaterThan(0);
  expect(front.fillTriangleCalls.length).toBeGreaterThan(0);
});

it('syncs all 6 Cutout summons at depth 28.4..28.6 (< 30.0 P1) with 0.00 steady-state/ally turret range ring', () => {
  const harness = createSummonSyncHarness({ localPlayerId: 1 });
  syncSummonCutoutVisuals(harness.scene, [
    createMockSummon({ id: 10, kind: 'tesla_turret', ownerPlayerId: 1, x: 200, y: 200 }),
    createMockSummon({ id: 11, kind: 'holo_decoy_turret', ownerPlayerId: 2, x: 280, y: 200 }),
  ], 1, 1.0); // age 1.0s > 0.65s placement cue
  const v1 = harness.getVisual(10)!;
  expect(v1.shadow.depth).toBe(19);
  expect(v1.base.depth).toBeCloseTo(28.4, 2);
  expect(v1.head?.depth).toBeCloseTo(28.6, 2);
  expect(harness.turretRangeRingsDrawn).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/commercial-class-and-interaction-vfx.test.ts test/ap2-p1d-blessing-ui-fx.test.ts`
Expected: FAIL (`syncSummonCutoutVisuals`, `renderDownedReviveBrackets`, `renderBastionPrismPlates` undefined; summons still drawn on `telegraphGraphics` at `depth 38`).

- [ ] **Step 3: Implement `5` class skills, `1:1` `(x, y)` overlays, `6` Cutout summons (`depth 28.4–28.6`), `electric_cutter`, and `item_life_seed`**

- **`5` Class Skills (`combat-fx-classes.ts`):**
  - *Vanguard* (`shield_shockwave` / `aegis`): `routeCutoutDirectionalByReach(..., 'fx_sh_aegis_crest')` + `vanguard_bastion_prism` rendered as `6` orbiting Cutout shield plates at `1:1` `shieldR` (`33..44px`) around `(p.x, p.y)`, splitting rear `3` plates (`sin < 0`) to `depth 26.4` and front `3` plates (`sin >= 0`) to `depth 30.4`.
  - *Ranger* (`falcon` / `sonic`): `routeCutoutDirectionalByReach(..., 'fx_sh_falcon_sonic')` + pointed `fillTaperedArcRibbon` slipstream (`depth 26.6`).
  - *Arcanist* (`skillZones`): `1:1` circular sunken rune astrolabe at `(z.x, z.y)` (`depth 15.0` base + `depth 26.6` `4` element-coded perimeter crescents; twin-zone link via `fillTaperedQuadraticBezier`).
  - *Engineer* (`emp_blast` / turret deploy): `emp_blast` routes `1:1` via `routeCutoutBurstByRadius(..., 'fx_sh_nova_thunder')`; turret placement shows `4` dashed corner brackets at `auraRadius` for `0.65s` on P1 deploy only (`0.00` alpha after `0.65s` and always `0.00` for allies).
  - *Druid* (`sacred_tree` / `nature` pulse): `1:1` `(x, y)` jade root crescents (`depth 15.0` + `depth 26.6`).
- **`downed` & `icePrison` (`telegraphs-and-overlays.ts`):**
  - Render `downed` (`r = 64px`) as `4` `1:1` Cutout arc brackets centered at `(downed.x, downed.y)` on `groundHazardGraphics` (`depth 16.0`), filling clockwise with `reviveProgress`.
  - Split `icePrison` around `(target.x, target.y + 12)`: rear ice spires at `depth 15.0`, front jagged frost bars at `depth 30.3`.
- **`6` Cutout Summons & `item_life_seed` (`combat-fx-blessings-p1d.ts`, `combat-fx-p4a.ts`, `room-entities-sync.ts`):**
  - Pool `PooledSummonVisual` sprites from `fx_cutout_kit_512` (`1 / 3` scale): `summon_sacred_tree` (`depth 28.5` + `depth 15.0` root stamp), `summon_tesla_base` (`28.4`) + `360°` recoiling `summon_tesla_head` (`28.6`) (`ancient_turret` uses warm brass tint on the turret pair), `summon_holo_base` (`28.4`) + `summon_holo_head` (`28.6`, `alpha = 0.82`), `summon_thunder_decoy` (`28.5`), `summon_life_blossom` (`28.5`), `summon_wall_tether_pylon` (`28.5`). Render `electric_cutter` fence links via `fillTaperedLightningBolt` on `underActorGraphics` (`depth 26.6`).
  - Render `pickup.kind === 'life_seed'` using `item_life_seed` (`18×20px`, `depth 22.0`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/commercial-class-and-interaction-vfx.test.ts test/ap2-p1d-blessing-ui-fx.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/fx/combat-fx-classes.ts apps/client/src/fx/combat-fx-blessings-p1d.ts apps/client/src/fx/combat-fx-p4a.ts apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts apps/client/src/scenes/game-scene/room-entities-sync.ts apps/client/test/commercial-class-and-interaction-vfx.test.ts apps/client/test/ap2-p1d-blessing-ui-fx.test.ts
git commit -m "feat(vfx): upgrade 5 class skills, 1:1 tactical zones, and 6 Cutout summons"
```

---

### Task 2: `4` Peripheral Shoulder Status Attachments (`statusRimPool` `depth 28.2`) & `6` Elemental Reaction Mini-Strips + `HUD Reaction Banner`

**Files:**
- Modify: `apps/client/src/scenes/game-scene/entity-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts`
- Modify: `apps/client/src/fx/combat-fx-pools.ts`
- Modify: `apps/client/src/fx/combat-fx-spawners.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-combat-and-coop.ts`
- Test: `apps/client/test/polish-p10b-fx-elemental-ambient.test.ts`, `apps/client/test/topdown-shader-vfx-spawners.test.ts`

**Interfaces:**
- Consumes: `CUTOUT_KIT_ATLAS_KEY` (`status_burn_2f`, `status_chill_2f`, `status_shock_2f`, `status_poison_2f`, `status_freeze_cuff`, `status_badge_*_9x9`), `ELEMENTAL_REACTION_STRIP_KEYS` (`Plan 1 Task 2`); `coalesceElementalReaction` (`apps/client/src/fx/combat-fx-spawners.ts`).
- Produces:
  - `export function computeDeterministicShockCornerIndex(enemyId: number, simTick: number): 0 | 1 | 2 | 3`
  - `export function resolveSecondaryStatusBadgeAnchor(enemyX: number, enemyY: number, enemyRadius: number, hp: number, maxHp: number, hpBarLeftX: number, hpBarY: number): { x: number; y: number }`
  - `export function resolveReactionMiniStripKey(reaction: ElementalReactionId): ElementalReactionStripKey`

- [ ] **Step 1: Write failing tests in `polish-p10b-fx-elemental-ambient.test.ts` and `topdown-shader-vfx-spawners.test.ts`**

```ts
it('replaces full-body rainbow status tint with depth 28.2 shoulder attachments, deterministic shock corner hash, and full-HP 2nd-element badge fallback', () => {
  expect(computeDeterministicShockCornerIndex(12, 70)).toBe(((12 * 31 + 10) & 3));
  expect(computeDeterministicShockCornerIndex(12, 73)).toBe(((12 * 31 + 10) & 3));

  const fullHpAnchor = resolveSecondaryStatusBadgeAnchor(300, 200, 16, 100, 100, 280, 172);
  expect(fullHpAnchor).toEqual({ x: 300, y: 200 - 16 - 10 });
  const hurtAnchor = resolveSecondaryStatusBadgeAnchor(300, 200, 16, 60, 100, 280, 172);
  expect(hurtAnchor.x).toBeLessThan(280);
});

it('maps all 6 elemental reactions to dedicated 256x64 4f mini-strips and coalesces text into the 0.40s HUD Reaction Banner with zero world text spam', () => {
  expect(resolveReactionMiniStripKey('overload')).toBe('fx_react_overload_star');
  expect(resolveReactionMiniStripKey('shatter')).toBe('fx_react_shatter_pane');
  expect(resolveReactionMiniStripKey('vaporize')).toBe('fx_react_vapor_puff');
  expect(resolveReactionMiniStripKey('superconduct')).toBe('fx_react_superconduct_cross');
  expect(resolveReactionMiniStripKey('corrosive_blast')).toBe('fx_react_toxic_glob');
  expect(resolveReactionMiniStripKey('paralysis')).toBe('fx_react_paralysis_x');

  const { fx } = createTestCombatFx();
  fx.spawnElementalReactionFx('overload', 240, 240, 55, true);
  expect(fx.particlePool.some((p) => p.active && p.textureKey === 'fx_react_overload_star' && p.frameCount === 4)).toBe(true);
  expect(fx.activeReactionBanner?.count).toBe(1);
  expect(fx.getActiveDamagePopupCount()).toBe(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/polish-p10b-fx-elemental-ambient.test.ts test/topdown-shader-vfx-spawners.test.ts`
Expected: FAIL (`computeDeterministicShockCornerIndex`, `resolveSecondaryStatusBadgeAnchor`, `resolveReactionMiniStripKey` undefined; `overload` still uses `fx_sh_nova_solar` or world popup).

- [ ] **Step 3: Implement `statusRimPool` (`depth 28.2`), `status_badge_9x9` fallback, `6` reaction mini-strips, and `HUD Reaction Banner`**

- **Peripheral Status (`entity-sync.ts`, `combat-fx-pools.ts`, `telegraphs-and-overlays.ts`):**
  - Allocate `64`-slot `statusRimPool` at `depth 28.2` (`BlendMode.NORMAL`, `1 / 3` `fx_cutout_kit_512` scale). Delete full-body rainbow `resolveEnemyStatusTintImpl` / `resolvePlayerStatusTintImpl` (`chill` applies at most `25%` frost tint to lower foot parts only).
  - Primary active status attaches to shoulders: `burn` (paired `12×15px` `status_burn_2f` at `8 Hz`), `chill` (`13×9px` `status_chill_2f`; when `frozen`, add `status_freeze_cuff` `14×8px` at `(e.x, e.y + 12)` `depth 28.3`), `shock` (`15×9px` `status_shock_2f` anchored by `((enemy.id * 31 + Math.floor(sim.tick / 7)) & 3)`), `poison` (`10×10px` `status_poison_2f`).
  - Secondary active element renders as `status_badge_<elem>_9x9` at `depth 48.0`: anchored `7px` left of the enemy HP bar when `hp < maxHp`, or at `(e.x, e.y - r_e - 10)` when `hp === maxHp`.
- **6 Elemental Reactions (`combat-fx-spawners.ts`, `hud-combat-and-coop.ts`):**
  - Map all `6` `ElementalReactionId`s via `resolveReactionMiniStripKey` (`vaporize -> fx_react_vapor_puff`, `shatter -> fx_react_shatter_pane`, `superconduct -> fx_react_superconduct_cross`, `corrosive_blast -> fx_react_toxic_glob`, `paralysis -> fx_react_paralysis_x`, `overload -> fx_react_overload_star`), played at `frameCount = 4`, `ttl = 0.20s`, `depth 42.5` (and paired with `routeCutoutBurstByRadius` perimeter crescent when the reaction carries AoE radius).
  - Remove world-space reaction text popups (`activeWorldReactionPopupSlot`); feed `coalesceElementalReaction` (`windowSec = 0.40`) into the compact top-center `HUD Reaction Banner` (`hud-combat-and-coop.ts`), and stamp a `0.45s` double `2.12:1` foot-ellipse (`depth 15.0`) under P1 when `isTeamCombo === true`.

- [ ] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/polish-p10b-fx-elemental-ambient.test.ts test/topdown-shader-vfx-spawners.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/client/src/scenes/game-scene/entity-sync.ts apps/client/src/scenes/game-scene/telegraphs-and-overlays.ts apps/client/src/fx/combat-fx-pools.ts apps/client/src/fx/combat-fx-spawners.ts apps/client/src/scenes/game-scene/hud-combat-and-coop.ts apps/client/test/polish-p10b-fx-elemental-ambient.test.ts apps/client/test/topdown-shader-vfx-spawners.test.ts
git commit -m "feat(vfx): add peripheral shoulder status badges and 6 dedicated reaction mini-strips"
```
