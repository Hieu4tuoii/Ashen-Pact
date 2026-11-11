import {
  findInteractTarget,
  i18n,
  INTERACT_HYSTERESIS,
  PLAYER_SLOT_COLORS,
  WEAPON_RARITY_COLORS,
  WorldSim,
} from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { PALETTE } from '../src/art/palette.js';
import { CHARACTER_THEME_COLORS } from '../src/fx/lighting-config.js';
import {
  createInteractPromptFadeState,
  DOOR_NAME_MAX_DIST,
  HUB_GUIDE_MAX_DIST,
  INTERACT_PROMPT_FADE_SEC,
  resolveDoorLabelState,
  resolveHubGuideVisibility,
  resolveInteractPromptSpec,
  resolvePlayerNameplateSpec,
  stepInteractPromptFadeState,
} from '../src/scenes/game-scene/interact-prompt.js';

function createCleanSim(seed = 'p7-client-prompt-test'): WorldSim {
  const sim = new WorldSim({
    seed,
    spawnInitialWave: false,
    includeTrainingDummy: false,
    includeProps: false,
    autoRespawnWaves: false,
  });
  sim.enemies.length = 0;
  sim.chests.length = 0;
  sim.worldItems.length = 0;
  sim.npcEntities.length = 0;
  sim.props.length = 0;
  sim.doors.length = 0;
  sim.portalActive = false;
  sim.inHub = false;
  sim.player.x = 480;
  sim.player.y = 320;
  sim.player.gold = 200;
  return sim;
}

describe('Phase P7 — Single-Pill [E] Prompt, Fade + Hysteresis, Door Labels, Hub Signs & Nameplates', () => {
  it('resolves single [E] prompt specs across all 7 interactable kinds with rarity/theme colors, [E] keycap chip, and coin icon + price when costGold > 0', () => {
    i18n.setLocale('vi');
    const sim = createCleanSim();

    // 1. Chest (epic rarity)
    const chest = sim.spawnChest(500, 320, 'epic', 'arc_lightning_rifle');
    let target = findInteractTarget(sim, sim.player.id);
    let spec = resolveInteractPromptSpec(sim, target);
    expect(spec).not.toBeNull();
    expect(spec?.kind).toBe('chest');
    expect(spec?.key).toBe(`chest:${chest.id}`);
    expect(spec?.keycapText).toBe('E');
    expect(spec?.colorHex).toBe(WEAPON_RARITY_COLORS.epic);
    expect(spec?.titleText).toContain('Rương');
    expect(spec?.titleText).not.toMatch(/^\[E\]/i);
    expect(spec?.costGold).toBe(0);
    expect(spec?.hasCoinIcon).toBe(false);
    expect(spec?.priceText).toBe('');
    expect(spec?.suppressedByWeaponCard).toBe(false);

    // 2. World Item (free drop vs priced merchant item)
    sim.chests.length = 0;
    const freePotion = sim.spawnWorldItem({
      kind: 'health_potion',
      rarity: 'uncommon',
      nameVi: 'Bình Máu (+3 HP)',
      costGold: 0,
      healAmount: 3,
      x: 505,
      y: 320,
    });
    target = findInteractTarget(sim, sim.player.id);
    spec = resolveInteractPromptSpec(sim, target);
    expect(spec?.kind).toBe('world_item');
    expect(spec?.key).toBe(`world_item:${freePotion.id}`);
    expect(spec?.colorHex).toBe(WEAPON_RARITY_COLORS.uncommon);
    expect(spec?.titleText).toBe('Bình Máu (+3 HP)');
    expect(spec?.costGold).toBe(0);
    expect(spec?.hasCoinIcon).toBe(false);

    sim.worldItems.length = 0;
    const shopPotion = sim.spawnWorldItem({
      kind: 'health_potion',
      rarity: 'rare',
      nameVi: 'Bình Máu Cổ Ngữ (+4 HP)',
      costGold: 25,
      healAmount: 4,
      x: 505,
      y: 320,
    });
    target = findInteractTarget(sim, sim.player.id);
    spec = resolveInteractPromptSpec(sim, target);
    expect(spec?.kind).toBe('world_item');
    expect(spec?.key).toBe(`world_item:${shopPotion.id}`);
    expect(spec?.colorHex).toBe(WEAPON_RARITY_COLORS.rare);
    expect(spec?.costGold).toBe(25);
    expect(spec?.hasCoinIcon).toBe(true);
    expect(spec?.priceText).toBe('25 Xu');

    // 3. Hub Statue
    sim.enterHub();
    const rangerStatue = sim.hubStatues.find((s) => s.characterId === 'ranger')!;
    sim.player.x = rangerStatue.x;
    sim.player.y = rangerStatue.y + 30;
    target = findInteractTarget(sim, sim.player.id);
    spec = resolveInteractPromptSpec(sim, target);
    expect(spec?.kind).toBe('hub_statue');
    expect(spec?.key).toBe('hub_statue:ranger');
    expect(spec?.keycapText).toBe('E');
    expect(spec?.colorHex).toBe(CHARACTER_THEME_COLORS.ranger);
    expect(spec?.titleText).toContain('Liệp Ưng');
    expect(spec?.titleText).not.toMatch(/^\[E\]/i);

    // 4. Ancient Mechanism (Engineer in party)
    const simMech = createCleanSim('p7-mech');
    simMech.selectCharacter(simMech.player.id, 'engineer');
    const mechProp = simMech.spawnProp('ancient_mechanism', 510, 320);
    target = findInteractTarget(simMech, simMech.player.id);
    spec = resolveInteractPromptSpec(simMech, target);
    expect(spec?.kind).toBe('ancient_mechanism');
    expect(spec?.key).toBe(`ancient_mechanism:${mechProp.id}`);
    expect(spec?.colorHex).toBe(PALETTE.SOLAR_GOLD);
    expect(spec?.titleText.length).toBeGreaterThan(0);

    // 5. Ancient Shrine
    const simShrine = createCleanSim('p7-shrine');
    simShrine.npcEntities.push({
      id: 701,
      kind: 'shrine',
      nameVi: 'Điện Thờ Cổ Đại',
      dialogueVi: '',
      x: 510,
      y: 320,
      radius: 20,
      interacted: false,
      costHp: 2,
    });
    target = findInteractTarget(simShrine, simShrine.player.id);
    spec = resolveInteractPromptSpec(simShrine, target);
    expect(spec?.kind).toBe('shrine');
    expect(spec?.key).toBe('shrine:701');
    expect(spec?.colorHex).toBe(PALETTE.CYAN_FROST);
    expect(spec?.titleText).toBe('Điện Thờ Cổ Đại');
    expect(spec?.costGold).toBe(25);
    expect(spec?.hasCoinIcon).toBe(true);
    expect(spec?.priceText).toContain('25 Xu');
    expect(spec?.titleText).not.toMatch(/^\[E\]/i);

    // 6. Active Portal
    const simPortal = createCleanSim('p7-portal');
    simPortal.portalActive = true;
    simPortal.portalX = 515;
    simPortal.portalY = 320;
    target = findInteractTarget(simPortal, simPortal.player.id);
    spec = resolveInteractPromptSpec(simPortal, target);
    expect(spec?.kind).toBe('portal');
    expect(spec?.key).toBe('portal:active');
    expect(spec?.colorHex).toBe(PALETTE.ELECTRIC_VIOLET);
    expect(spec?.titleText).toContain('Cổng');
    expect(spec?.titleText).not.toMatch(/^\[E\]/i);

    // 7. Unlocked Door
    const simDoor = createCleanSim('p7-door');
    const treasureRoom =
      simDoor.dungeon.rooms.find((r) => r.type === 'treasure') ?? simDoor.dungeon.rooms[0]!;
    simDoor.doors.push({
      dir: 'E',
      targetRoomId: treasureRoom.id,
      targetRoomType: treasureRoom.type,
      x: 515,
      y: 320,
      radius: 24,
      locked: false,
      isSecretPassage: false,
    });
    target = findInteractTarget(simDoor, simDoor.player.id);
    spec = resolveInteractPromptSpec(simDoor, target);
    expect(spec?.kind).toBe('door');
    expect(spec?.key).toBe('door:E');
    expect(spec?.titleText).toContain('→');
  });

  it('fades smoothly over 120–150ms (INTERACT_PROMPT_FADE_SEC = 0.135) and retains target with 8u hysteresis at range boundary', () => {
    expect(INTERACT_PROMPT_FADE_SEC).toBeGreaterThanOrEqual(0.12);
    expect(INTERACT_PROMPT_FADE_SEC).toBeLessThanOrEqual(0.15);
    expect(INTERACT_HYSTERESIS).toBe(8);

    const sim = createCleanSim('p7-fade-hysteresis');
    const chest = sim.spawnChest(540, 320, 'legendary', 'solar_archon_staff');

    const fadeState = createInteractPromptFadeState();
    expect(fadeState.alpha).toBe(0);
    expect(fadeState.cachedSpec).toBeNull();
    expect(fadeState.currentTargetKey).toBeNull();

    // Player approaches within 60u (<= 64u chest base range)
    sim.player.x = chest.x - 60;
    sim.player.y = chest.y;
    let target = findInteractTarget(sim, sim.player.id, {
      currentTargetKey: fadeState.currentTargetKey,
      hysteresis: INTERACT_HYSTERESIS,
    });
    let spec = resolveInteractPromptSpec(sim, target);
    expect(spec).not.toBeNull();

    // Step half of fade duration (~67.5ms) -> alpha ~0.5
    stepInteractPromptFadeState(fadeState, spec, INTERACT_PROMPT_FADE_SEC * 0.5);
    expect(fadeState.currentTargetKey).toBe(`chest:${chest.id}`);
    expect(fadeState.alpha).toBeCloseTo(0.5, 2);
    expect(fadeState.cachedSpec?.key).toBe(`chest:${chest.id}`);

    // Step another half of fade duration -> alpha reaches 1.0
    stepInteractPromptFadeState(fadeState, spec, INTERACT_PROMPT_FADE_SEC * 0.5);
    expect(fadeState.alpha).toBe(1);

    // Move player to 70u (outside 64u base range, but inside 64 + 8 = 72u hysteresis band!)
    sim.player.x = chest.x - 70;
    target = findInteractTarget(sim, sim.player.id, {
      currentTargetKey: fadeState.currentTargetKey,
      hysteresis: INTERACT_HYSTERESIS,
    });
    expect(target?.key).toBe(`chest:${chest.id}`);
    spec = resolveInteractPromptSpec(sim, target);
    stepInteractPromptFadeState(fadeState, spec, 0.016);
    expect(fadeState.alpha).toBe(1);
    expect(fadeState.currentTargetKey).toBe(`chest:${chest.id}`);

    // Move player to 75u (outside 72u hysteresis band) -> target becomes null, fade-out begins while retaining cachedSpec
    sim.player.x = chest.x - 75;
    target = findInteractTarget(sim, sim.player.id, {
      currentTargetKey: fadeState.currentTargetKey,
      hysteresis: INTERACT_HYSTERESIS,
    });
    expect(target).toBeNull();
    spec = resolveInteractPromptSpec(sim, target);
    stepInteractPromptFadeState(fadeState, spec, INTERACT_PROMPT_FADE_SEC * 0.5);
    expect(fadeState.currentTargetKey).toBeNull();
    expect(fadeState.alpha).toBeCloseTo(0.5, 2);
    expect(fadeState.cachedSpec?.key).toBe(`chest:${chest.id}`);

    // Finish fade-out -> alpha = 0 and cachedSpec cleared
    stepInteractPromptFadeState(fadeState, null, INTERACT_PROMPT_FADE_SEC * 0.6);
    expect(fadeState.alpha).toBe(0);
    expect(fadeState.cachedSpec).toBeNull();
  });

  it('suppresses the world-space floating pill when a weapon is shown in the Weapon Comparison Card, without suppressing non-weapon pills', () => {
    const sim = createCleanSim('p7-weapon-dedup');
    const weaponItem = sim.spawnWorldItem({
      kind: 'weapon',
      weaponId: 'scrap_shotgun',
      rarity: 'epic',
      nameVi: 'Shotgun Phế Liệu',
      costGold: 42,
      healAmount: 0,
      x: 510,
      y: 320,
    });

    const target = findInteractTarget(sim, sim.player.id);
    expect(target?.key).toBe(`world_item:${weaponItem.id}`);

    const specWithCard = resolveInteractPromptSpec(sim, target, {
      weaponComparisonVisible: true,
    });
    expect(specWithCard?.suppressedByWeaponCard).toBe(true);

    const fadeState = createInteractPromptFadeState();
    stepInteractPromptFadeState(fadeState, specWithCard, 0.1);
    // Hysteresis key is preserved for the weapon card, but world-space pill alpha remains 0
    expect(fadeState.currentTargetKey).toBe(`world_item:${weaponItem.id}`);
    expect(fadeState.alpha).toBe(0);
    expect(fadeState.cachedSpec).toBeNull();

    // Non-weapon world item (merchant health potion) is NEVER suppressed even if weaponComparisonVisible is passed
    sim.worldItems.length = 0;
    sim.spawnWorldItem({
      kind: 'health_potion',
      rarity: 'uncommon',
      nameVi: 'Bình Máu (+4 HP)',
      costGold: 15,
      healAmount: 4,
      x: 510,
      y: 320,
    });
    const potionTarget = findInteractTarget(sim, sim.player.id);
    const potionSpec = resolveInteractPromptSpec(sim, potionTarget, {
      weaponComparisonVisible: true,
    });
    expect(potionSpec?.suppressedByWeaponCard).toBe(false);
    stepInteractPromptFadeState(fadeState, potionSpec, INTERACT_PROMPT_FADE_SEC);
    expect(fadeState.alpha).toBe(1);
    expect(fadeState.cachedSpec?.titleText).toBe('Bình Máu (+4 HP)');
  });

  it('enforces door label states: lock icon only > 120u, room name <= 120u, open door hidden > 120u or when active [E] pill target', () => {
    expect(DOOR_NAME_MAX_DIST).toBe(120);
    const lockedDoor = { x: 480, y: 64, locked: true };
    const openDoor = { x: 480, y: 64, locked: false };

    // 1. Locked door at dist = 200u (> 120u): small lock icon only, no room name
    const lockedFar = resolveDoorLabelState(lockedDoor, 480, 264, 'Kho Báu', false);
    expect(lockedFar.visible).toBe(true);
    expect(lockedFar.mode).toBe('lock_icon_only');
    expect(lockedFar.text).toBe('🔒');

    // 2. Locked door at dist = 95u (<= 120u): lock icon + room name
    const lockedNear = resolveDoorLabelState(lockedDoor, 480, 159, 'Kho Báu', false);
    expect(lockedNear.visible).toBe(true);
    expect(lockedNear.mode).toBe('locked_name');
    expect(lockedNear.text).toBe('🔒 Kho Báu');

    // 3. Open door at dist = 180u (> 120u): completely hidden
    const openFar = resolveDoorLabelState(openDoor, 480, 244, 'Kho Báu', false);
    expect(openFar.visible).toBe(false);
    expect(openFar.mode).toBe('hidden');

    // 4. Open door at dist = 95u (<= 120u, outside [E] range): shows arrow + room name
    const openMid = resolveDoorLabelState(openDoor, 480, 159, 'Kho Báu', false);
    expect(openMid.visible).toBe(true);
    expect(openMid.mode).toBe('open_name');
    expect(openMid.text).toBe('→ Kho Báu');

    // 5. Open door when it IS the active [E] pill target (isActiveInteractDoor = true): hidden to avoid duplicating the [E] pill
    const openActiveTarget = resolveDoorLabelState(openDoor, 480, 110, 'Kho Báu', true);
    expect(openActiveTarget.visible).toBe(false);
    expect(openActiveTarget.mode).toBe('hidden');
  });

  it('shows Hub Guidance Signs only within <= 200u of the local player', () => {
    expect(HUB_GUIDE_MAX_DIST).toBe(200);
    const signX = 450;
    const signY = 210;

    const farSign = resolveHubGuideVisibility(200, 210, signX, signY, false);
    expect(farSign.distance).toBe(250);
    expect(farSign.visible).toBe(false);
    expect(farSign.alpha).toBe(0);

    const edgeSign = resolveHubGuideVisibility(250, 210, signX, signY, false);
    expect(edgeSign.distance).toBe(200);
    expect(edgeSign.visible).toBe(true);
    expect(edgeSign.alpha).toBeGreaterThan(0);

    const nearSign = resolveHubGuideVisibility(380, 210, signX, signY, false);
    expect(nearSign.distance).toBe(70);
    expect(nearSign.visible).toBe(true);
    expect(nearSign.alpha).toBe(1);

    const blockedSign = resolveHubGuideVisibility(380, 210, signX, signY, true);
    expect(blockedSign.visible).toBe(false);
    expect(blockedSign.alpha).toBe(0);
  });

  it('hides local player own nameplate and styles teammate nameplates at 11.5px@1080p, alpha 0.75, slot color, y - 44 above head', () => {
    i18n.setLocale('vi');
    const ownSpec = resolvePlayerNameplateSpec({
      player: {
        id: 1,
        slot: 1,
        displayName: 'Hiệp Sĩ P1',
        lifeState: 'alive',
        reviveProgress: 0,
        downedTimer: 0,
        ready: true,
      },
      localPlayerId: 1,
      x: 480,
      y: 300,
      inHub: true,
    });
    expect(ownSpec.visible).toBe(false);

    const teammateSpec = resolvePlayerNameplateSpec({
      player: {
        id: 2,
        slot: 2,
        displayName: 'Ưng Nhãn P2',
        lifeState: 'alive',
        reviveProgress: 0,
        downedTimer: 0,
        ready: true,
      },
      localPlayerId: 1,
      x: 520,
      y: 300,
      inHub: true,
    });
    expect(teammateSpec.visible).toBe(true);
    expect(teammateSpec.alpha).toBe(0.75);
    expect(teammateSpec.fontSizePxAt1080p).toBe(11.5);
    expect(teammateSpec.worldFontSize).toBe('11.5px');
    expect(teammateSpec.worldScale).toBe(0.5);
    expect(teammateSpec.color).toBe(PLAYER_SLOT_COLORS[2]);
    expect(teammateSpec.y).toBe(300 - 44);
    expect(teammateSpec.text).toBe('[P2] Ưng Nhãn P2 · ✓');

    const downedTeammateSpec = resolvePlayerNameplateSpec({
      player: {
        id: 3,
        slot: 3,
        displayName: 'Lam Hỏa P3',
        lifeState: 'downed',
        reviveProgress: 0.4,
        downedTimer: 8,
        ready: false,
      },
      localPlayerId: 1,
      x: 520,
      y: 300,
      inHub: false,
    });
    expect(downedTeammateSpec.visible).toBe(true);
    expect(downedTeammateSpec.color).toBe(PALETTE.CRIMSON_BRIGHT);
    expect(downedTeammateSpec.text).toContain('40%');
  });

  it('resolves hub_station [E] prompts for coop_board (AZURE_CORE) and codex_desk (SOLAR_GOLD) in VI and EN without leading [E]', () => {
    const sim = createCleanSim('p7-hub-stations');
    sim.enterHub();

    // 1. East Co-op Guild Board at (928, 352) — player approaches at (928, 380)
    sim.player.x = 928;
    sim.player.y = 380;
    const coopTarget = findInteractTarget(sim, sim.player.id);
    expect(coopTarget?.kind).toBe('hub_station');

    i18n.setLocale('vi');
    const coopSpecVi = resolveInteractPromptSpec(sim, coopTarget);
    expect(coopSpecVi).not.toBeNull();
    expect(coopSpecVi?.kind).toBe('hub_station');
    expect(coopSpecVi?.key).toBe('hub_station:coop_board');
    expect(coopSpecVi?.keycapText).toBe('E');
    expect(coopSpecVi?.colorHex).toBe(PALETTE.AZURE_CORE);
    expect(coopSpecVi?.titleText.length).toBeGreaterThan(0);
    expect(coopSpecVi?.titleText).not.toMatch(/^\[E\]/i);

    i18n.setLocale('en');
    const coopSpecEn = resolveInteractPromptSpec(sim, coopTarget);
    expect(coopSpecEn?.kind).toBe('hub_station');
    expect(coopSpecEn?.keycapText).toBe('E');
    expect(coopSpecEn?.colorHex).toBe(PALETTE.AZURE_CORE);
    expect(coopSpecEn?.titleText.length).toBeGreaterThan(0);
    expect(coopSpecEn?.titleText).not.toMatch(/^\[E\]/i);
    expect(coopSpecEn?.titleText).not.toBe(coopSpecVi?.titleText);

    // 2. South-East Chronicler's Codex Desk at (860, 520) — player approaches at (860, 546)
    sim.player.x = 860;
    sim.player.y = 546;
    const codexTarget = findInteractTarget(sim, sim.player.id);
    expect(codexTarget?.kind).toBe('hub_station');

    i18n.setLocale('vi');
    const codexSpecVi = resolveInteractPromptSpec(sim, codexTarget);
    expect(codexSpecVi).not.toBeNull();
    expect(codexSpecVi?.kind).toBe('hub_station');
    expect(codexSpecVi?.key).toBe('hub_station:codex_desk');
    expect(codexSpecVi?.keycapText).toBe('E');
    expect(codexSpecVi?.colorHex).toBe(PALETTE.SOLAR_GOLD);
    expect(codexSpecVi?.titleText.length).toBeGreaterThan(0);
    expect(codexSpecVi?.titleText).not.toMatch(/^\[E\]/i);

    i18n.setLocale('en');
    const codexSpecEn = resolveInteractPromptSpec(sim, codexTarget);
    expect(codexSpecEn?.kind).toBe('hub_station');
    expect(codexSpecEn?.keycapText).toBe('E');
    expect(codexSpecEn?.colorHex).toBe(PALETTE.SOLAR_GOLD);
    expect(codexSpecEn?.titleText.length).toBeGreaterThan(0);
    expect(codexSpecEn?.titleText).not.toMatch(/^\[E\]/i);
    expect(codexSpecEn?.titleText).not.toBe(codexSpecVi?.titleText);

    i18n.setLocale('vi');
  });
});
