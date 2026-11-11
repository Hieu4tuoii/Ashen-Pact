# Ashen Sanctuary Interactive Lobby Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the static `MenuScene` and boot directly into an atmospheric 5-Wing interactive Sanctuary Lobby (*Soul Knight* Living Room × *Enter the Gungeon* Breach) inside `GameScene` (`WorldSim.inHub === true`), supporting walk-up & click character selection, North Dungeon Gate solo/co-op entry, East Co-op LAN Guild Drawer (with Name/IP `<input>` + Host/Join/Roster/QR), West Armory & DPS Range, and South-East Codex/Settings Lectern.

**Architecture:** Extend `@ashen-pact/shared` `WorldSim.enterHub` with deterministic 5-Wing coordinates (`36×22` map, `surfaces` all `'none'`) and interactive `SimHubStation` (`'coop_board' | 'codex_desk'`) targets integrated into `findInteractTarget` and `SnapshotCodec`. In `@ashen-pact/client`, add a procedural `SanctuaryVisualLayer` (ceremonial carpets, sunken bonfire hearth + embers, class lounge rugs, embodied astral hero crests, weapon stands, guild table, codex lectern), upgrade `updateHubInvitePanelImpl` + `MenuDomInputOverlay` into a unified Solo/Co-op Guild Drawer, retire `MenuScene.ts`, route all boot/disconnect/exit paths to Solo Sanctuary, and migrate the E2E/visual suites.

**Tech Stack:** TypeScript (strict ESM monorepo), deterministic 60Hz `WorldSim` (`@ashen-pact/shared`), Phaser 3 + procedural Canvas/Graphics (`@ashen-pact/client`), Colyseus LAN (`@ashen-pact/server`), Vitest, Playwright, ESLint.

**Spec:** `docs/superpowers/specs/2026-11-11-sanctuary-lobby-design.md`

## Global Constraints

- `apps/client/src/scenes/MenuScene.ts` MUST be deleted and removed from `apps/client/src/main.ts`; zero active source imports of `MenuScene` may remain.
- `WorldSim.enterHub()` MUST keep `sim.map.cols === 36`, `sim.map.rows === 22`, and every cell of `sim.map.surfaces` equal to `'none'` (pinned by `m1-room-topology-sim.test.ts` and `map-overhaul-e2e.test.ts` `T2-F7-04`). All Sanctuary carpets, rugs, bullseyes, and hearth rings render on `SanctuaryVisualLayer` in `@ashen-pact/client`.
- `INTERACT_PRIORITY_ORDER` and `INTERACT_RANGE_OFFSETS` in `packages/shared/src/sim/interact-target.ts` MUST remain byte-identical to their existing values (`polish-p7-interact-target.test.ts`); add `'hub_station'` to `InteractTargetKind` and `InteractTargetResult` just like `'daedalus_anvil'`.
- Default URL `/` (plus `/?test=1`, `/?debug=1`, `/?scene=menu`, and unprivileged `/?scene=gallery`) MUST start `GameScene` with `{ coopMode: 'solo', startInHub: true }`. Explicit `/?scene=game` (when `hub !== '1'`) or `/?biome=2|3` (when shortcuts are allowed) MUST start `{ coopMode: 'solo', startInHub: false }` so combat test harnesses remain intact.
- While an HTML `<input>` (`menu-name-input` or `menu-ip-input`) is focused (`menuActiveInput !== null`), Phaser keyboard capture/enabled state MUST be suspended so typing spaces or `WASD`/`E`/`I`/`O`/`K`/`C`/`L` never moves the player or triggers hotkeys, and DOM inputs MUST be hidden (`display: none`) whenever the Solo Co-op Drawer is closed or `inHub === false`.
- Always pass `--no-file-parallelism` when running multiple Vitest files in `@ashen-pact/shared` to avoid uVM worker memory exhaustion.
- Version string `'v2.0.0 · LAN'` MUST appear on the Sanctuary Lobby header plaque (`sanctuary-lobby-ui.ts`), with zero `'0.1.0'` or `'0.2.1'` strings anywhere in active source files.

## Review Focus

1. **Phaser keyboard capture vs. HTML `<input>` typing in `GameScene`** — Focusing `menu-name-input` in the Sanctuary Co-op Drawer and typing `"Chiến Thần WASD E I O"` with spaces must insert every character into `menuDisplayName` without moving `sim.player` or toggling modals/panels (pinned in Task 3 & Task 4).
2. **Solo active walk-in vs. test teleport near North Portal** — Teleporting `sim.player` within `24u` of `(portalX, portalY)` with `moveX = 0, moveY = 0` must NOT auto-start a dungeon run, whereas actively walking (`moveX !== 0 || moveY !== 0`) within `<= 24u` of the North Portal after `>= 45` hub ticks in Solo mode transitions cleanly into Floor 1 (pinned in Task 3).
3. **`INTERACT_PRIORITY_ORDER` & `sim.map.surfaces` regression safety** — Adding `SimHubStation` (`coop_board`, `codex_desk`) and 5-Wing Sanctuary coordinates must keep `INTERACT_PRIORITY_ORDER`, `INTERACT_RANGE_OFFSETS`, `sim.map.cols === 36`, `sim.map.rows === 22`, and `sim.map.surfaces.every(s => s === 'none')` 100% green (pinned in Task 1).
4. **Non-overlapping 5-Wing interactable spacing** — Every `hubStatue`, `hubStation`, `worldItem` (weapon rack), `Training Dummy`, and `portal` in `enterHub()` must sit on a walkable interior tile (`!isSolidTile`) with pairwise spacing preventing accidental target stealing at `INTERACT_RANGE = 64` (pinned in Task 1).
5. **Deterministic `'vanguard'` hero on automated test URLs** — Persisting `ashen_pact_character` in `localStorage` for human sessions must NOT override `'vanguard'` when `freeze=1`, `test=1`, or `testHooks=1` is present in `window.location.search` (pinned in Task 3).

---

### Task 1: Shared Simulation 5-Wing Sanctuary Layout, `SimHubStation`, Snapshot Sync & i18n (`@ashen-pact/shared`)

**Files:**
- Modify: `packages/shared/src/sim/world-sim-types.ts`
- Modify: `packages/shared/src/sim/world-sim-events.ts`
- Modify: `packages/shared/src/sim/world-sim.ts`
- Modify: `packages/shared/src/sim/sim-coop-hub.ts`
- Modify: `packages/shared/src/sim/sim-dungeon-rooms.ts`
- Modify: `packages/shared/src/sim/interact-target.ts`
- Modify: `packages/shared/src/sim/sim-progression-bot.ts`
- Modify: `packages/shared/src/protocol/snapshot-codec.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/i18n/vi.json`
- Modify: `packages/shared/src/i18n/en.json`
- Create: `packages/shared/test/sanctuary-lobby-sim.test.ts`

**Interfaces:**
- Consumes: `WorldSim`, `ArenaMap.clearInteriorForHub()`, `CHARACTERS`, `WEAPONS`
- Produces (exported from `@ashen-pact/shared`):
  - `export type HubStationId = 'coop_board' | 'codex_desk';`
  - `export interface SimHubStation { id: HubStationId; nameVi: string; x: number; y: number; radius: number; }`
  - `WorldSim.hubStations: SimHubStation[]`
  - `SimEvent` union member: `{ kind: 'hub_station_interacted'; playerId: number; stationId: HubStationId; x: number; y: number }`
  - `InteractTargetKind` union member `'hub_station'` and `InteractTargetResult` member `{ kind: 'hub_station'; key: string; x: number; y: number; distance: number; station: SimHubStation }`
  - `QuantizedWorldSnapshot.hubStations?: SimHubStation[]`
  - `i18n` keys under `ui.sanctuary.*` (`title`, `subtitle`, `coopWingSign`, `codexWingSign`, `coopStationPrompt`, `codexStationPrompt`, `embodiedBadge`, `soloCoopChip`, `soloCoopTitle`, `leaveCoopBtn`, `returnSanctuaryConfirmTitle`, `returnSanctuaryConfirmBody`, `pauseReturnSanctuary`)

- [ ] **Step 1: Write failing unit tests in `packages/shared/test/sanctuary-lobby-sim.test.ts`**

Assert:
1. `new WorldSim({ seed: 1337, startInHub: true })` sets `sim.inHub === true`, `sim.map.cols === 36`, `sim.map.rows === 22`, and `sim.map.surfaces.every((s) => s === 'none') === true`.
2. 5-Wing Sanctuary coordinates:
   - North Portal: `sim.portalActive === true`, `sim.portalX === 576`, `sim.portalY === 122`.
   - 5 `hubStatues` (`vanguard` at `(388, 224)`, `ranger` at `(452, 160)`, `elementalist` at `(700, 160)`, `druid` at `(388, 316)`, `engineer` at `(764, 224)`), all on non-solid tiles with pairwise distance `>= 88` and distance to `(portalX, portalY)` `>= 125`.
   - 2 `hubStations`: `{ id: 'coop_board', x: 928, y: 352, radius: 26 }` and `{ id: 'codex_desk', x: 860, y: 520, radius: 24 }`, both on non-solid tiles.
   - West Training Dummy at `(236, 236)` and 4 `isHubRackItem` weapons at `(206, 404)`, `(326, 404)`, `(206, 488)`, `(326, 488)`.
   - P1 spawns at `(576, 412)` facing `-Math.PI * 0.5` with `findInteractTarget(sim, sim.player.id) === null` at initial spawn (clean unoccluded arrival).
3. `findInteractTarget` & `interactWithNearest`:
   - Moving `sim.player` to `(928, 382)` returns `{ kind: 'hub_station', key: 'hub_station:coop_board' }`; `sim.interactWithNearest(sim.player)` returns `true` and emits `{ kind: 'hub_station_interacted', playerId: sim.player.id, stationId: 'coop_board' }`.
   - Moving `sim.player` to `(860, 548)` returns `{ kind: 'hub_station', key: 'hub_station:codex_desk' }` and emits `stationId: 'codex_desk'`.
   - `INTERACT_PRIORITY_ORDER` and `INTERACT_RANGE_OFFSETS` remain unchanged.
4. `startDungeonRunFromHub()` clears `sim.hubStations` (`length === 0`) and `sim.hubStatues` (`length === 0`) and sets `sim.inHub === false`.
5. `SnapshotCodec.encodeSnapshot` / `applySnapshotToSim` round-trips `hubStations` when `inHub === true`.

- [ ] **Step 2: Run test to verify RED failure**

Run: `pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/sanctuary-lobby-sim.test.ts`
Expected: FAIL (`hubStations` undefined and old `portalY = cy + 142` coordinates).

- [ ] **Step 3: Implement 5-Wing Sanctuary simulation, `SimHubStation` interaction, snapshot codec & i18n**

1. Add `HubStationId` and `SimHubStation` in `world-sim-types.ts`, re-export from `world-sim.ts` & `index.ts`, add `hub_station_interacted` to `SimEvent` in `world-sim-events.ts`, and add `public hubStations: SimHubStation[] = []` on `WorldSim` (cleared in `enterHubImpl`, `startDungeonRunFromHubImpl`, and `enterRoomImpl` in `sim-dungeon-rooms.ts`).
2. Update `enterHubImpl` (and `addCoopPlayerImpl` spawn offsets `{ 1: [0, 60], 2: [-64, 34], 3: [64, 34], 4: [0, 110] }` relative to `(cx=576, cy=352)` when `this.inHub` is true) in `sim-coop-hub.ts` with exact Spec §4.1 coordinates, props (`torch_brazier` at `(576, 352)`, `(476, 128)`, `(676, 128)`, `(236, 156)`, `(884, 276)`; `glow_mushroom` at `(330, 316)`, `(920, 536)`), dummy `(236, 236)`, `2×2` weapon rack, North portal `(576, 122)`, 5 `hubStatues`, 2 `hubStations`, and `p.aimAngle = -Math.PI * 0.5`.
3. Update `interact-target.ts` (`'hub_station'` resolved when `sim.inHub` within `INTERACT_RANGE + 8` + hysteresis after `shrine`/NPCs and before `portal`, keeping `INTERACT_PRIORITY_ORDER` and `INTERACT_RANGE_OFFSETS` untouched) and `sim-progression-bot.ts` (`interactWithNearestImpl` `case 'hub_station':`).
4. Add `hubStations?: SimHubStation[]` to `QuantizedWorldSnapshot` in `snapshot-codec.ts`.
5. Add `ui.sanctuary.*` and updated `ui.hubGuide.*` strings in `vi.json` and `en.json`.

- [ ] **Step 4: Build and verify `@ashen-pact/shared` tests, typecheck & lint**

Run:
```bash
pnpm --filter @ashen-pact/shared typecheck
pnpm --filter @ashen-pact/shared build
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/sanctuary-lobby-sim.test.ts test/polish-p7-interact-target.test.ts test/m1-room-topology-sim.test.ts test/ap2-p0a-purge-arsenal.test.ts test/phase4-coop.test.ts
npx eslint packages/shared/src/sim/world-sim-types.ts packages/shared/src/sim/world-sim-events.ts packages/shared/src/sim/world-sim.ts packages/shared/src/sim/sim-coop-hub.ts packages/shared/src/sim/sim-dungeon-rooms.ts packages/shared/src/sim/interact-target.ts packages/shared/src/sim/sim-progression-bot.ts packages/shared/src/protocol/snapshot-codec.ts packages/shared/src/index.ts
```
Expected: All exit `0`.

- [ ] **Step 5: Commit Task 1**

```bash
git add packages/shared/
git commit -m "feat(shared): build 5-wing Sanctuary Lobby layout and interactive hub stations"
```

---

### Task 2: Handcrafted `SanctuaryVisualLayer`, Embodied Hero Lounge Rigs, Click-to-Select & Station Prompts/Lights (`@ashen-pact/client`)

**Files:**
- Create: `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`
- Modify: `apps/client/src/scenes/game-scene/interact-prompt.ts`
- Modify: `apps/client/src/fx/lighting-config.ts`
- Modify: `apps/client/src/scenes/game-scene/room-entities-sync.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Create: `apps/client/test/sanctuary-architecture.test.ts`
- Modify: `apps/client/test/polish-p7-interact-prompt.test.ts`

**Interfaces:**
- Consumes: `HubStationId`, `SimHubStation`, `WorldSim.hubStations`, `InteractTargetResult` (`kind: 'hub_station'`), `i18n` `ui.sanctuary.*`
- Produces:
  - `buildSanctuaryArchitectureSpec(mapWidth: number, mapHeight: number)` in `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`
  - `resolveHeroStationVisualState(characterId: CharacterId, activeCharacterIds: readonly CharacterId[], allowDuplicates: boolean): { embodied: boolean; rigAlpha: number; showActiveBadge: boolean }` in `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`
  - `SanctuaryVisualLayer` class (`sync(sim: WorldSim, dtSec: number, visualTimeSec: number): void`, `destroy(): void`) attached as `GameScene.sanctuaryLayer?: SanctuaryVisualLayer`
  - `resolveInteractPromptSpec` support for `kind === 'hub_station'` (`'coop_board'` -> `PALETTE.AZURE_CORE`, `'codex_desk'` -> `PALETTE.SOLAR_GOLD`)

- [ ] **Step 1: Write failing client unit tests in `apps/client/test/sanctuary-architecture.test.ts` and `apps/client/test/polish-p7-interact-prompt.test.ts`**

Assert:
1. `buildSanctuaryArchitectureSpec(1152, 704)` returns 6 distinct architectural zones (`north_gate`, `central_hearth`, `hero_lounge`, `east_coop`, `west_armory`, `southeast_codex`), 5 `heroRugs` matching the 5 `CharacterId`s and `CHARACTER_THEME_COLORS`, 4 `rackStands` at `(206/326, 404/488)`, `coopStation` at `(928, 352)`, `codexStation` at `(860, 520)`, and `hearth` at `(576, 352)`.
2. `resolveHeroStationVisualState('vanguard', ['vanguard'], false)` returns `{ embodied: true, rigAlpha: 0.38, showActiveBadge: true }`, while `'ranger'` returns `{ embodied: false, rigAlpha: 1, showActiveBadge: false }`.
3. In `polish-p7-interact-prompt.test.ts`: moving `sim.player` near `coop_board` `(928, 380)` and `codex_desk` `(860, 546)` in `sim.enterHub()` produces `spec.kind === 'hub_station'`, `spec.keycapText === 'E'`, non-empty localized `titleText` in VI & EN without leading `[E]`, and `PALETTE.AZURE_CORE` / `PALETTE.SOLAR_GOLD` colors.

- [ ] **Step 2: Run client tests to verify RED failure**

Run: `pnpm --filter @ashen-pact/client exec vitest run test/sanctuary-architecture.test.ts test/polish-p7-interact-prompt.test.ts`
Expected: FAIL (`sanctuary-architecture.js` missing and `hub_station` unhandled in `resolveInteractPromptSpec`).

- [ ] **Step 3: Implement `SanctuaryVisualLayer`, station `[E]` prompts/lights, embodied hero lounge rigs & click-to-select**

1. Create `apps/client/src/scenes/game-scene/sanctuary-architecture.ts`:
   - `buildSanctuaryArchitectureSpec` & `resolveHeroStationVisualState`.
   - `SanctuaryVisualLayer`: static floor architecture `Phaser.GameObjects.Graphics` (`depth: 6`, redrawn only when `inHub` toggles or locale/map size changes) + dynamic bonfire/candle/rune shimmer `Phaser.GameObjects.Graphics` (`depth: 33`, animated smoothly via `visualTimeSec` with rising embers around `(576, 352)`, azure beacon pulse at `(928, 352)`, and warm candle glow at `(860, 520)`). Draws:
     - North crimson-and-gold ceremonial carpet runner (`x = 532..620, y = 122..352`), stepped stone portal dais at `(576, 122)`, carved threshold runes.
     - Central sunken stone hearth ring (`r = 46`) with inlaid brass 8-point astrolabe, 3 curved warm timber benches, and roaring multi-layered hearth flames + rising embers.
     - 5 bespoke class rugs/pedestals under `(388, 224)`, `(452, 160)`, `(700, 160)`, `(388, 316)`, `(764, 224)` with class border trim & sigil geometry.
     - East azure-and-brass guild runner (`x = 626..928, y = 330..374`) + ornate **Co-op Guild Table** (map scroll, twin LAN beacon crystals, guild banner arch) at `(928, 352)`.
     - West slate walkway + concentric painted bullseye range rings at `(236, 236)` + 4 dark-iron & oak **Weapon Display Pedestals** at `(206/326, 404/488)`.
     - South-East **Chronicler's Lectern** (carved wood desk, open gold-leaf tome, warm taper candle) at `(860, 520)`.
2. Update `interact-prompt.ts` (`case 'hub_station':`) and `lighting-config.ts` (warm azure light for `coop_board`, warm gold light for `codex_desk` in `populateInteractableLightsScratch`).
3. Update `room-entities-sync.ts`:
   - Sync embodied state on each `hubStatueRig`: `entry.rig.container.setAlpha(state.rigAlpha)`; show `entry.subLabel` (`"★ Đang hóa thân"` / `"★ Active"`) when `state.showActiveBadge` is true, and show character name `entry.label` subtly above unselected lounging heroes when within `240u`.
   - Update Hub natural guidance signs (`guideSpecs`) to the 5-Wing coordinates (North Expedition Gate `(576, 174)`, Hero Lounge `(576, 228)`, West Weapon Rack `(266, 368)`, West Dummy DPS `(236, 192)`, East Co-op Guild `(928, 304)`, South-East Codex/Settings `(860, 480)`).
   - Add clean world-space pointer click support in `GameScene` / `arena-tiles.ts` when `sim.inHub && !modalOpen`: clicking within `30u` of any `hubStatue` in Solo Hub selects that character (`sim.selectCharacter(sim.player.id, st.characterId)` + `zzfx.play('ui_click')` + `localStorage.setItem('ashen_pact_character', st.characterId)`); clicking within `34u` of `coop_board` toggles `invitePanelVisible`; clicking within `32u` of `codex_desk` opens `settingsModal.open('settings')`.
4. Instantiate `this.sanctuaryLayer = new SanctuaryVisualLayer(this)` in `arena-tiles.ts` (`createImpl`), update in `GameScene.ts` update loop, and clean up on `SHUTDOWN`.

- [ ] **Step 4: Run client unit tests, typecheck & lint**

Run:
```bash
pnpm --filter @ashen-pact/client typecheck
pnpm --filter @ashen-pact/client exec vitest run test/sanctuary-architecture.test.ts test/polish-p7-interact-prompt.test.ts test/polish-p6-interactable-lights.test.ts test/round3-lighting-architecture-minimap.test.ts
npx eslint apps/client/src/scenes/game-scene/sanctuary-architecture.ts apps/client/src/scenes/game-scene/interact-prompt.ts apps/client/src/fx/lighting-config.ts apps/client/src/scenes/game-scene/room-entities-sync.ts apps/client/src/scenes/game-scene/arena-tiles.ts apps/client/src/scenes/GameScene.ts
```
Expected: All exit `0`.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/client/
git commit -m "feat(client): add 5-wing SanctuaryVisualLayer, embodied hero lounge rigs, and station prompts"
```

---

### Task 3: Unified Sanctuary Co-op Guild Drawer, Sanctuary Utility HUD, & `MenuScene` Retirement (`@ashen-pact/client`)

**Files:**
- Create: `apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts`
- Delete: `apps/client/src/scenes/MenuScene.ts`
- Modify: `apps/client/src/main.ts`
- Modify: `apps/client/src/scenes/PreloadScene.ts`
- Modify: `apps/client/src/scenes/ArtGalleryScene.ts`
- Modify: `apps/client/src/scenes/GameScene.ts`
- Modify: `apps/client/src/scenes/game-scene/arena-tiles.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-hub-and-cards.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-setup-and-pause.ts`
- Modify: `apps/client/src/scenes/game-scene/hud-modals-and-debug.ts`
- Modify: `apps/client/src/scenes/game-scene/input-and-network.ts`
- Modify: `apps/client/src/scenes/game-scene/sim-events.ts`
- Modify: `apps/client/src/ui/menu-dom-inputs.ts`
- Modify: `apps/client/src/ui/html-input-overlay.ts`
- Modify: `apps/client/test/polish-p9b-menus-modals-settings.test.ts`
- Modify: `packages/shared/test/polish-p12-release-version.test.ts`

**Interfaces:**
- Consumes: `WorldSim.hubStations`, `SimEvent` (`hub_station_interacted`), `SanctuaryVisualLayer`
- Produces:
  - `GameSceneInitData`: `{ coopMode?: 'solo' | 'host' | 'join'; startInHub?: boolean; roomId?: string; displayName?: string; serverUrl?: string; disconnectReason?: string }`
  - `resolveBootGameSceneInitData(search: string, allowSceneShortcuts: boolean): { targetScene: 'GameScene' | 'ArtGalleryScene'; initData?: GameSceneInitData }` in `sanctuary-lobby-ui.ts`
  - `computeSanctuaryCoopInputBounds(uiScale: number, padX: number, padY: number): Record<MenuInputFieldId, MenuInputBoxBounds>` in `sanctuary-lobby-ui.ts`
  - `MenuDomInputOverlay` methods `setBounds(bounds: Record<MenuInputFieldId, MenuInputBoxBounds>): void` and `setVisible(visible: boolean): void`

- [ ] **Step 1: Write failing unit tests in `apps/client/test/polish-p9b-menus-modals-settings.test.ts` and `packages/shared/test/polish-p12-release-version.test.ts`**

Assert:
1. `resolveBootGameSceneInitData('', false)` -> `{ targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } }`.
2. `resolveBootGameSceneInitData('?test=1', true)` and `resolveBootGameSceneInitData('?scene=menu', false)` and `resolveBootGameSceneInitData('?scene=gallery', false)` -> `{ targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } }`.
3. `resolveBootGameSceneInitData('?scene=gallery', true)` -> `{ targetScene: 'ArtGalleryScene' }`.
4. `resolveBootGameSceneInitData('?scene=game&testHooks=1', true)` -> `{ targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: false } }`.
5. `resolveBootGameSceneInitData('?scene=game&hub=1&testHooks=1', true)` -> `{ targetScene: 'GameScene', initData: { coopMode: 'solo', startInHub: true } }`.
6. `computeSanctuaryCoopInputBounds(1, 0, 0)` places `'name'` and `'ip'` input boxes strictly inside the right-hand Co-op Drawer (`cx > 650`, non-overlapping `cy`), and `computeMenuInputOverlayRect('ip', { left: 0, top: 0, width: 1920, height: 1080 }, customBounds.ip)` maps accurately onto 1080p CSS pixels.
7. In `packages/shared/test/polish-p12-release-version.test.ts`: assert `apps/client/src/scenes/MenuScene.ts` does NOT exist (`fs.existsSync(...) === false`) and `apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts` contains `'v2.0.0 · LAN'` and zero `'0.1.0'` / `'0.2.1'`.

- [ ] **Step 2: Run unit tests to verify RED failure**

Run:
```bash
pnpm --filter @ashen-pact/client exec vitest run test/polish-p9b-menus-modals-settings.test.ts
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/polish-p12-release-version.test.ts
```
Expected: FAIL (`sanctuary-lobby-ui.js` missing and `MenuScene.ts` still exists).

- [ ] **Step 3: Implement `sanctuary-lobby-ui.ts`, Unified Co-op Guild Drawer + DOM Input Suspension, Sanctuary Utility Bar & `MenuScene` Retirement**

1. Extend `MenuDomInputOverlay` (`menu-dom-inputs.ts` & `html-input-overlay.ts`) with optional `bounds` constructor arg (defaulting to `MENU_INPUT_BOUNDS`), `setBounds(nextBounds)`, and `setVisible(visible)` (sets `wrapperEl.style.display = visible ? 'block' : 'none'` and blurs active input when hidden).
2. Create `apps/client/src/scenes/game-scene/sanctuary-lobby-ui.ts`:
   - `resolveBootGameSceneInitData(search, allowSceneShortcuts)`.
   - `shouldRestoreSavedCharacter(search)`: returns `false` when `freeze`, `test`, or `testHooks` query param is truthy so automated tests always start on `'vanguard'`, otherwise reads `localStorage.getItem('ashen_pact_character')`.
   - `computeSanctuaryCoopInputBounds(uiScale, padX, padY)`: computes 960×540 design-space bounds matching the Solo Co-op Drawer's Name & IP boxes inside `hudTopRightContainer` (`WORLD_VIEW_WIDTH + padX` anchor).
   - `updateSanctuaryOverlayHudImpl(this: GameScene, dtSec: number)`:
     - Renders inside `hudTopCenterContainer` when `sim.inHub && !this.fullMapOpen`:
       - Elegant Sanctuary Plaque (`"ASHEN PACT · ĐẠI SẢNH TRO TÀN"` / `"ASHEN PACT · ASHEN SANCTUARY"` + `'v2.0.0 · LAN'` badge, gently compacting/fading alpha to `0.86` after 4s) + compact utility pill row (`⚙ [O]`, `⌨ [K]`, `★ [C]`, `🌐 [L]`, plus `?debug=1` `[🎨 Gallery]` & `[🏃 Anim]`, and `?debug=1` bottom Vietnamese diacritics verification chip).
       - If `this.disconnectReason` is non-null: ruby-bordered notice banner (`⚠ ${this.disconnectReason}`) with click-to-dismiss / 10s auto-clear.
     - Syncs `this.sanctuaryDomInputs` visibility (`sim.inHub && this.coopMode === 'solo' && this.invitePanelVisible && !modalOpen`) and Phaser keyboard suspension: when `this.menuActiveInput !== null`, disables Phaser keyboard capture/input (`this.input.keyboard.enabled = false`) and zeroes player movement; when `null`, re-enables `this.input.keyboard.enabled = true`.
   - `switchSanctuaryCoopMode(scene, nextMode)`: saves `ashen_pact_name` to `localStorage`, leaves any active Colyseus room cleanly (`intentionalLeave = true`), and calls `scene.scene.restart({ coopMode: nextMode, startInHub: true, displayName: scene.displayName, serverUrl: scene.serverHostPort })`.
3. Upgrade `updateHubInvitePanelImpl` in `hud-hub-and-cards.ts`:
   - When `!this.invitePanelVisible`: compact top-right chip (`"📡 Phòng Co-op [I]"` in Solo; `"📡 Mời bạn · N/4 [I]"` in Co-op).
   - When `this.invitePanelVisible && this.coopMode === 'solo'`: draws **Sanctuary Co-op LAN Guild Card** (`pw = 304, ph = 212`, `px = -12 - pw, py = 144`) with Collapse `[I]`, Name field + `↻` preset cycler, LAN `IP:Port` field, **`📡 Tạo Phòng LAN`** button, and **`🔗 Vào Phòng LAN`** button.
   - When `this.invitePanelVisible && this.coopMode !== 'solo'`: existing QR + Copy Link + Duplicate Hero + Ready `[V]` + P1..P4 Roster (with Kick) + Emote bar, plus a compact **`🚪 Rời Phòng`** pill at top-right next to `Ẩn [I]` calling `switchSanctuaryCoopMode(this, 'solo')`.
4. Wire `GameScene.ts`, `arena-tiles.ts`, `input-and-network.ts`, `sim-events.ts`, `hud-setup-and-pause.ts`, `hud-modals-and-debug.ts`, `PreloadScene.ts`, `ArtGalleryScene.ts`, and `main.ts`:
   - Delete `apps/client/src/scenes/MenuScene.ts` and remove from `apps/client/src/main.ts`.
   - In `arena-tiles.ts` (`createImpl`): if `this.coopMode === 'solo'` and `this.startInHub` (default `true` unless `initData.startInHub === false`), call `this.transport.getSim().enterHub()`, restore saved hero if `shouldRestoreSavedCharacter(window.location.search)` is true, and auto-fetch `/api/host-info` to populate `this.serverHostPort` & `debug.menuServerHostPort`; also connect `HelloRoom` in Solo mode (`connectHelloRoom`) just as before so `debug.serverConnected` turns `true` when the LAN server is running!
   - In `GameScene.ts`: add Solo active walk-into-portal check (`sim.inHub && this.coopMode === 'solo' && sim.portalActive && this.hubTicksElapsed >= 45 && (moveX !== 0 || moveY !== 0) && Math.hypot(sim.player.x - sim.portalX, sim.player.y - sim.portalY) <= 24` -> `sim.enterPortal()` + `triggerIrisTransition()`).
   - In `input-and-network.ts` & `sim-events.ts`:
     - Handle `hub_station_interacted` (`'coop_board'` -> `this.invitePanelVisible = true`; `'codex_desk'` -> `this.settingsModal?.open('settings')`).
     - Enable Sanctuary hotkeys when `sim.inHub && !this.pauseModalOpen && !this.menuActiveInput`: `[O]` opens `'settings'`, `[K]` opens `'controls'`, `[C]` opens `'credits'`, `[L]` toggles language (`graphicsSettings.toggleLanguage()` + `invalidateAllHudCaches()`).
     - Replace every `this.scene.start('MenuScene', ...)` in `input-and-network.ts`, `hud-setup-and-pause.ts`, and `ArtGalleryScene.ts` with `this.scene.start('GameScene', { coopMode: 'solo', startInHub: true, disconnectReason })` (updating Pause Exit labels from `"Về Menu Chính"` to `"Về Sảnh Chờ Đơn"` / `"Return to Sanctuary"` while keeping button coordinates `(960, 754)`, Cancel `(784, 644)`, Confirm `(1136, 644)` identical!).

- [ ] **Step 4: Run shared + client builds, typecheck, lint & unit suites**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism test/polish-p12-release-version.test.ts test/sanctuary-lobby-sim.test.ts
pnpm --filter @ashen-pact/client exec vitest run
```
Expected: Zero TypeScript/ESLint errors, build succeeds, all client & shared unit tests pass, and `MenuScene.ts` is gone.

- [ ] **Step 5: Commit Task 3**

```bash
git add -A apps/client/ packages/shared/test/polish-p12-release-version.test.ts
git commit -m "feat(client): replace MenuScene with interactive Sanctuary Lobby and Co-op Guild Drawer"
```

---

### Task 4: E2E & Visual Harness Migration and Full Sanctuary Verification (`tests/e2e/`)

**Files:**
- Modify: `tests/e2e/phase0.spec.ts`
- Modify: `tests/e2e/phase1.spec.ts`
- Modify: `tests/e2e/phase2.spec.ts`
- Modify: `tests/e2e/phase3.spec.ts`
- Modify: `tests/e2e/phase4.spec.ts`
- Modify: `tests/e2e/phase7.spec.ts`
- Modify: `tests/e2e/phase8.spec.ts`
- Modify: `tests/e2e/polish-p9b.spec.ts`
- Modify: `tests/e2e/helpers/visual-scene-helpers.ts`
- Modify: `tests/e2e/helpers/visual-scenes.ts`

**Interfaces:**
- Consumes: Direct Sanctuary boot on `/`, `/?scene=game` direct combat shortcut, `[data-testid="menu-name-input"]` & `[data-testid="menu-ip-input"]` inside the Sanctuary Co-op Drawer (`[I]`), `hubStatues` & `hubStations`, Sanctuary disconnect/exit transitions.
- Produces: Updated Playwright E2E and visual scene suites with zero stale `'MenuScene'` expectations.

- [ ] **Step 1: Update E2E specs and visual scene helpers from `MenuScene` to Sanctuary Lobby**

1. `tests/e2e/phase0.spec.ts`: `goto('/')` -> wait for `scene === 'GameScene' && inHub === true && serverConnected === true` -> verify Vietnamese font faces, 60 FPS, zero errors/warnings -> enter Floor 1 via `sim.enterPortal()` -> verify resize `2560×1440` -> `1920×1080` and `F1` Debug Overlay.
2. `tests/e2e/phase1.spec.ts` & `tests/e2e/phase2.spec.ts`: navigate via `/?scene=game` so the Tactical Sandbox room (initial enemy wave, dummy, and 6 interactive surfaces) loads directly into `GameScene` (`inHub === false`).
3. `tests/e2e/phase3.spec.ts`: `goto('/')` -> wait for `scene === 'GameScene' && inHub === true` -> enter Floor 1 Dungeon via `sim.enterPortal()` (`inHub === false`) -> run full Floor 1–2 room & boss tour.
4. `tests/e2e/phase4.spec.ts`: on Host disconnect (`page1.close()`), verify `page2`, `page3`, `page4` transition cleanly to Solo Sanctuary (`scene === 'GameScene' && inHub === true && coopMode === 'solo'`) without console errors.
5. `tests/e2e/phase7.spec.ts`: `goto('/')` -> verify `scene === 'GameScene' && inHub === true && musicTheme === 'menu_hub'` -> test `[L]` language toggle, `[O]` Settings, `[K]` Controls, `[C]` Credits right in the Sanctuary -> test hero lounge statue preview & click/interact selection -> enter North Expedition Portal and capture Iris sweep -> continue combat HUD checks.
6. `tests/e2e/phase8.spec.ts`: in default release mode (`noDebugBaseUrl`), verify `/?scene=menu` and unprivileged `/?scene=gallery` both land in `scene === 'GameScene' && inHub === true` with debug UI hidden.
7. `tests/e2e/polish-p9b.spec.ts`: `goto('/?test=1')` -> wait for `scene === 'GameScene' && inHub === true` -> press `[I]` to open Sanctuary Co-op Guild Drawer -> verify `[data-testid="menu-name-input"]` & `[data-testid="menu-ip-input"]` typing, Backspace/Delete, clipboard paste, and verify typing `"Chiến "` with spaces/letters does NOT move `playerX`/`playerY` -> close drawer, test 4-Tab Settings `[O]`, test 2P Co-op Roster without Kick overlap, test Buff/Victory/Defeat modals, and verify Pause -> Exit (`[M]` -> Confirm `(1136, 644)`) returns to Solo Sanctuary (`scene === 'GameScene' && inHub === true`).
8. `tests/e2e/helpers/visual-scene-helpers.ts` & `tests/e2e/helpers/visual-scenes.ts`: narrow `expectedScene` to `'GameScene' | 'ArtGalleryScene'` and update legacy `menu*` scene entries to Sanctuary Lobby (`GameScene` with `inHub === true`).

- [ ] **Step 2: Run full project verification (`typecheck`, `lint`, `test`, `build`, `e2e`)**

Run:
```bash
pnpm typecheck
pnpm lint
pnpm --filter @ashen-pact/shared exec vitest run --no-file-parallelism
pnpm --filter @ashen-pact/client exec vitest run
pnpm build
pnpm e2e
```
Expected: 100% green across TypeScript, ESLint, shared + client Vitest suites, production build, and Playwright E2E specs!

- [ ] **Step 3: Commit Task 4**

```bash
git add tests/e2e/
git commit -m "test(e2e): migrate Playwright and visual suites from MenuScene to Sanctuary Lobby"
```
