# Ashen Sanctuary Interactive Lobby (Replacing Static `MenuScene`) — Design Spec

**Date:** 2026-11-11  
**Status:** Approved (User opted for direct autonomous execution via `subagent-driven-development`)  
**Selected Approach:** 5-Wing Living Sanctuary Hall (*Soul Knight* Living Room × *Enter the Gungeon* Breach) inside `GameScene` (`WorldSim.inHub === true`)

---

## 1. Intent & Why

Previously, launching *Ashen Pact* loaded a static 2D menu screen (`apps/client/src/scenes/MenuScene.ts`) where clicking **Play Solo** dropped players straight into Floor 1 combat without letting Solo players choose a hero, test weapons, or experience a sense of place — while `WorldSim.inHub` was a sparse `36×22` stone rectangle reachable only in LAN Co-op or via debug URLs.

To match the charm, tactile discovery, and spatial clarity of *Soul Knight*'s Living Room and *Enter the Gungeon*'s Breach, `MenuScene` is **completely retired**. Finishing `PreloadScene` now drops the player directly into **Đại Sảnh Tro Tàn (Ashen Sanctuary)** — an atmospheric, handcrafted 5-Wing top-down hall where character selection, entering the Solo Dungeon, opening or joining a LAN Co-op room, testing weapons/DPS, and adjusting system settings all happen organically inside the game world.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Delete `MenuScene.ts`** and unregister it from Phaser's scene graph (`apps/client/src/main.ts`).
- **Boot directly into the Living Sanctuary (`GameScene` with `coopMode: 'solo'`, `startInHub: true`)** on `/`, `/?test=1`, `/?debug=1`, legacy `/?scene=menu`, and unprivileged `/?scene=gallery`, while preserving direct combat shortcut `/?scene=game` (without `hub=1`) and `/?biome=2|3` for tactical/combat test harnesses.
- **Organize the `36×22` (`1152×704`u, center `(576, 352)`) Sanctuary into 5 distinct architectural wings** while keeping `sim.map.cols === 36`, `sim.map.rows === 22`, and `sim.map.surfaces` all `'none'`:
  1. **North Wing — Cổng Viễn Chinh Hầm Ngục (`(576, 122)`)**: Stepped stone dais, twin `torch_brazier` pillars `(476, 128)` & `(676, 128)`, crimson-gold ceremonial carpet runner from the hearth, and Expedition Portal supporting `[E]` interact, `[V]` Co-op Ready, and Solo active walk-in (`distance <= 24` after 45 grace ticks when `moveX !== 0 || moveY !== 0`).
  2. **Center — Lửa Trại Hội Hiệp Ước & 5 Khu Anh Hùng (`(576, 352)`)**: Sunken stone hearth with inlaid brass astrolabe, camp benches, dynamic flickering bonfire + rising golden embers, and **5 Living Hero Stations** (`vanguard` `(388, 224)`, `ranger` `(452, 160)`, `elementalist` `(700, 160)`, `druid` `(388, 316)`, `engineer` `(764, 224)`) with class-themed rugs, `[E]` walk-up selection, direct mouse click-to-select in Solo Sanctuary, and translucent Astral Crest rendering (`alpha = 0.38`) on whichever hero is currently embodied by a player.
  3. **East Wing — Khu Phòng Co-op LAN (`coop_board` at `(928, 352)`)**: Azure-brass guild runner, procedural Co-op Guild Table & Banner Arch, and `[E]` / click / `[I]` access to the **Unified Co-op Room Drawer** supporting Solo Display Name + `↻` preset cycle + LAN `IP:Port` HTML `<input>` fields (`data-testid="menu-name-input"`, `data-testid="menu-ip-input"`), **Host LAN**, **Join LAN IP**, and (when connected) the 4-player Roster, ISO QR Code, Copy Link, Duplicate Hero toggle, Kick, Emotes, and **Leave Co-op Room**.
  4. **West Wing — Xưởng Vũ Khí & Trường Tập Bắn (`x = 206..326, y = 236..488`)**: Concentric target lane around Training Dummy `(236, 236)` with live rolling DPS sign, plus `2×2` ornate Weapon Rack Stands at `(206, 404)`, `(326, 404)`, `(206, 488)`, `(326, 488)`.
  5. **South-East Wing — Bàn Cổ Thư & Cài Đặt (`codex_desk` at `(860, 520)`)**: Candlelit Chronicler's Lectern opening the 4-Tab Settings/Controls modal on `[E]`, paired with a minimalist Sanctuary top utility pill bar (`⚙ [O]`, `⌨ [K]`, `★ [C]`, `🌐 [L]`, plus `?debug=1` `[Art Gallery]`, `[Đổi Hoạt Ảnh]`, and Vietnamese diacritics footer).
- **Route all exits/disconnects back to Solo Sanctuary**: Host disconnect, kick, full/mid-run join rejection, Pause Confirm Exit (`[M]` -> `[Enter]`), Victory/Defeat exit, and `ArtGalleryScene` return cleanly to `GameScene` (`{ coopMode: 'solo', startInHub: true, disconnectReason }`) with a styled ruby-gold toast banner when `disconnectReason` is provided.

### Non-Goals
- Adding meta-progression currency shops or permanent stat trees not in Ashen Pact v2.0.0.
- Changing combat room generation, weapon/enemy/boss balance, or `CoopRoom` authoritative combat tick rules.

### Anti-Goals
- Mutating `INTERACT_PRIORITY_ORDER` or `INTERACT_RANGE_OFFSETS` constants in `interact-target.ts` (pinned by `polish-p7-interact-target.test.ts`).
- Writing non-`'none'` surfaces onto `sim.map.surfaces` during `enterHub()` (pinned by `map-overhaul-e2e.test.ts` `T2-F7-04`).
- Leaving DOM `<input>` overlays active or visible when the Co-op Drawer is collapsed or during Dungeon combat, where they could intercept WASD/mouse input.

---

## 3. Approaches Considered

1. **Approach 1 (Selected): Unified `GameScene` Sanctuary (`WorldSim.inHub` + Procedural `SanctuaryVisualLayer` + Unified Co-op Guild Drawer)**
   - *Pros:* Zero duplicate physics/rig/HUD code; Solo and Co-op share the exact same living Sanctuary space, lighting pipeline, `CutoutRig` animations, weapon rack testing, and `[E]` prompt hysteresis; transitioning from Solo to Host/Join or from Sanctuary into Floor 1 uses `GameScene`'s native Iris transition.
   - *Cons:* Requires migrating E2E tests that previously waited for `scene === 'MenuScene'` on `/` (cleanly handled in Task 4).
2. **Approach 2: Separate `LobbyScene` Phaser Scene Disconnected from `WorldSim`**
   - *Pros:* Isolates lobby rendering from `GameScene`.
   - *Cons:* Duplicates player movement, weapon testing, dummy DPS, lighting, and Co-op snapshot sync across two scenes, and causes jarring scene reloads between Solo walk-around and Co-op Hub. Rejected.
3. **Approach 3: Keep `MenuScene` as an Overlay Over `GameScene`**
   - *Pros:* Fewer E2E changes.
   - *Cons:* Directly violates the user's explicit request to remove the menu page and build a true *Soul Knight* / *Enter the Gungeon* interactive lobby. Rejected.

---

## 4. Technical Design

### 4.1 Shared Simulation (`@ashen-pact/shared`)

- **`world-sim-types.ts` & `world-sim-events.ts`:**
  - `export type HubStationId = 'coop_board' | 'codex_desk';`
  - `export interface SimHubStation { id: HubStationId; nameVi: string; x: number; y: number; radius: number; }`
  - Add `public hubStations: SimHubStation[] = [];` on `WorldSim`, cleared in `enterRoom` / `startDungeonRunFromHub` and populated in `enterHubImpl`.
  - Add `{ kind: 'hub_station_interacted'; playerId: number; stationId: HubStationId; x: number; y: number }` to `SimEvent`.
- **5-Wing Coordinates in `enterHubImpl` (`36×22` = `1152×704`, `cx = 576`, `cy = 352`):**
  - **North Expedition Portal:** `portalActive = true`, `portalX = 576`, `portalY = 122`; flanking `torch_brazier` props at `(476, 128)` and `(676, 128)`.
  - **Central Hearth & Spawns:** central `torch_brazier` at `(576, 352)`; player spawn positions `[ [576, 412], [512, 386], [640, 386], [576, 462] ]` with `p.aimAngle = -Math.PI * 0.5`.
  - **5 Hero Lounge Stations (`hubStatues`, `radius: 24`, pairwise distance >= 90u, portal distance >= 129u):**
    - `vanguard`: `(388, 224)`
    - `ranger`: `(452, 160)`
    - `elementalist`: `(700, 160)`
    - `druid`: `(388, 316)`
    - `engineer`: `(764, 224)`
  - **West Armory & Shooting Range:** Training Dummy at `(236, 236)` + `torch_brazier` at `(236, 156)` + `glow_mushroom` at `(330, 316)`; 4 `isHubRackItem: true` weapons (`hunter_crossbow`, `apprentice_staff`, `tesla_carbine`, `scrap_shotgun`) at `(206, 404)`, `(326, 404)`, `(206, 488)`, `(326, 488)`.
  - **East Co-op Guild Wing:** `SimHubStation` `{ id: 'coop_board', nameVi: 'Bàn Hội Co-op LAN', x: 928, y: 352, radius: 26 }` + `torch_brazier` at `(884, 276)`.
  - **South-East Chronicler's Wing:** `SimHubStation` `{ id: 'codex_desk', nameVi: 'Bàn Cổ Thư & Cài Đặt', x: 860, y: 520, radius: 24 }` + `glow_mushroom` at `(920, 536)`.
- **Interaction Resolution (`interact-target.ts` & `sim-progression-bot.ts`):**
  - Extend `InteractTargetKind` with `'hub_station'` and `InteractTargetResult` with `{ kind: 'hub_station'; key: string; x: number; y: number; distance: number; station: SimHubStation }` without modifying `INTERACT_PRIORITY_ORDER` or `INTERACT_RANGE_OFFSETS`.
  - In `findInteractTarget`, when `sim.inHub === true`, evaluate `sim.hubStations` within `INTERACT_RANGE + 8` (`72u` + hysteresis `8u`) right after `world_item` and before `portal`.
  - In `interactWithNearestImpl`, `case 'hub_station':` pushes `hub_station_interacted` event and returns `true`.
- **`snapshot-codec.ts`:** Include optional `hubStations?: SimHubStation[]` in `QuantizedWorldSnapshot` and restore it when `snap.inHub` is true.

### 4.2 Sanctuary Visual Layer & Living Hero Lounge (`@ashen-pact/client`)

- **`sanctuary-architecture.ts` (`SanctuaryVisualLayer`):**
  - Renders purely on `GameScene` world graphics/containers below entities (`depth: 5..16`) and dynamic hearth flame/embers (`depth: 32..36`) only while `sim.inHub === true`, leaving `sim.map.surfaces` untouched (`'none'`).
  - Draws: North crimson-gold ceremonial carpet & stepped portal dais; Central sunken hearth ring, brass astrolabe runes, wooden benches, flickering flames & rising embers (respecting `getFreezeVisualTimeSec` when `?freeze=1`); 5 bespoke class rugs/pedestals under each hero station; East azure-brass runner & Co-op Guild Table/Banner; West target bullseye lane & `2×2` weapon display stands; South-East candlelit Chronicler's Lectern & open tome.
- **Embodied Hero & Click-to-Select (`room-entities-sync.ts`):**
  - When a hero station's `characterId` is currently equipped by an active player (`allPlayers.some(p => p.characterId === st.characterId)`), its station `CutoutRig` renders as a calm translucent **Astral Soul Crest** (`alpha = 0.38`) with a crisp mini-pill badge (`"★ Đang chọn"` / `"★ Active"`) so there is never an uncanny duplicate body next to the player. Unselected heroes breathe at full opacity (`alpha = 1.0`).
  - Clicking a lounging hero station in Solo Sanctuary (`pointerdown` within `28u` in world space when no modal is open) calls `sim.selectCharacter(sim.player.id, st.characterId)` + `zzfx.play('ui_click')` and saves `ashen_pact_character` to `localStorage` (restored only when neither `freeze`, `test`, nor `testHooks` URL params are active, preserving deterministic `'vanguard'` default in automated tests).

### 4.3 Unified Co-op Guild Drawer, Utility Bar & Scene Routing (`@ashen-pact/client`)

- **`MenuDomInputOverlay` (`menu-dom-inputs.ts` & `html-input-overlay.ts`):**
  - Accept custom `bounds` and `setVisible(visible: boolean)` (`display: none` + `blur()` when hidden).
  - Mounted in `GameScene` and visible **only** when `sim.inHub && this.coopMode === 'solo' && this.invitePanelVisible && !modalOpen`.
  - Updates `debug.menuDisplayName`, `debug.menuServerHostPort`, and `debug.menuActiveInput` seamlessly.
- **`updateHubInvitePanelImpl` (`hud-hub-and-cards.ts`) + `sanctuary-lobby-ui.ts`:**
  - **Collapsed chip (`!invitePanelVisible`):** Top-right chip (`"📡 Phòng Co-op [I]"` in Solo; `"📡 Mời bạn · N/4 [I]"` in Co-op).
  - **Expanded in Solo (`coopMode === 'solo'`):** Renders the **Sanctuary Co-op LAN Guild Card** (`pw = 304, ph = 216` inside `hudTopRightContainer`) with editable Name box + `↻` preset cycler, editable `IP:Port` box (auto-populated via `/api/host-info`), **`📡 Tạo Phòng LAN`** button (`coopMode: 'host'`), and **`🔗 Vào Phòng LAN`** button (`coopMode: 'join'`).
  - **Expanded in Co-op (`coopMode !== 'solo'`):** Renders QR + Copy Invite Link + Duplicate Hero toggle + Ready `[V]` + 4-Slot Roster (with Kick) + Emote bar + **`🚪 Rời Phòng`** button returning to Solo Sanctuary.
- **Sanctuary Utility Pill Strip & Arrival/Disconnect Banners (`sanctuary-lobby-ui.ts`):**
  - Top-center arrival title plaque (`"ASHEN PACT — ĐẠI SẢNH TRO TÀN"` + `'v2.0.0 · LAN'` badge) visible on Sanctuary entry and gently fading to a compact header pill, plus ruby-gold `disconnectReason` notice banner when returning from a closed/kicked Co-op room.
  - Compact Sanctuary utility pills (`⚙ [O]`, `⌨ [K]`, `★ [C]`, `🌐 [L]`, and `?debug=1` `[Art Gallery]` + `[Đổi Hoạt Ảnh]` + `VIETNAMESE_VERIFICATION_STRING` debug footer).
- **Routing (`PreloadScene.ts`, `GameScene.ts`, `ArtGalleryScene.ts`, `input-and-network.ts`, `hud-setup-and-pause.ts`):**
  - Delete `MenuScene.ts`.
  - `PreloadScene`: `/` -> `GameScene` `{ coopMode: 'solo', startInHub: true }`; `/?scene=game` (without `hub=1`) or `/?biome=2|3` -> `GameScene` `{ coopMode: 'solo', startInHub: false }`; `/?coop=host|join` or `/?join=...` -> `GameScene` `{ coopMode, roomId, displayName, serverUrl, startInHub: true }`.
  - All former `this.scene.start('MenuScene', ...)` call sites transition to `this.scene.start('GameScene', { coopMode: 'solo', startInHub: true, disconnectReason })`.
