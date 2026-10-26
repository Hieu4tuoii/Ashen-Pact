import { WEAPON_RARITY_COLORS } from '@ashen-pact/shared';
import { describe, expect, it } from 'vitest';
import { ENV_PALETTE, hexToNum } from '../src/art/palette.js';
import {
  CHARACTER_THEME_COLORS,
  getInteractableLightQuota,
  INTERACTABLE_LIGHT_QUOTA,
  type InteractableLightEntry,
  populateInteractableLightsScratch,
  resolveCurrentInteractHighlightTarget,
  resolveInteractableVisualGlowSpec,
} from '../src/fx/lighting-config.js';

describe('Phase P6 — Interactable Lights, Glow Sprites, Rarity Beams & [E] Highlight', () => {
  it('reserves exact interactable light quotas per quality tier (High: 16, Medium: 10, Low: 6)', () => {
    expect(INTERACTABLE_LIGHT_QUOTA).toEqual({
      high: 16,
      medium: 10,
      low: 6,
    });
    expect(getInteractableLightQuota('high')).toBe(16);
    expect(getInteractableLightQuota('medium')).toBe(10);
    expect(getInteractableLightQuota('low')).toBe(6);
  });

  it('reuses InteractableLightEntry objects in scratch array (zero allocation) and prioritizes main interactables ahead of pickups', () => {
    const scratch: InteractableLightEntry[] = [];
    const pickups = Array.from({ length: 30 }, (_, idx) => ({
      id: 1000 + idx,
      kind: (idx % 3 === 0 ? 'gold' : idx % 3 === 1 ? 'prey_emblem' : 'life_seed') as
        | 'gold'
        | 'prey_emblem'
        | 'life_seed',
      prevX: 400 + idx * 4,
      prevY: 260,
      x: 400 + idx * 4,
      y: 260,
      vx: 0,
      vy: 0,
      amount: 5,
      ttlSec: 15,
    }));

    const count1 = populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      inHub: false,
      elapsedSec: 0.5,
      portalActive: true,
      portalX: 650,
      portalY: 335,
      chests: [
        {
          id: 1,
          x: 555,
          y: 205,
          radius: 18,
          rarity: 'epic',
          opened: false,
          droppedWeaponId: 'arc_lightning_rifle',
        },
      ],
      npcEntities: [
        {
          id: 2,
          kind: 'merchant',
          nameVi: 'Thương Nhân',
          dialogueVi: 'Chào!',
          x: 480,
          y: 220,
          radius: 20,
          interacted: false,
          costHp: 0,
        },
        {
          id: 3,
          kind: 'shrine',
          nameVi: 'Điện Thờ',
          dialogueVi: 'Hiến tế.',
          x: 650,
          y: 225,
          radius: 20,
          interacted: false,
          costHp: 2,
        },
      ],
      worldItems: [
        {
          id: 4,
          kind: 'weapon',
          weaponId: 'magma_cannon',
          rarity: 'legendary',
          nameVi: 'Pháo Dung Nham',
          costGold: 0,
          healAmount: 0,
          x: 555,
          y: 280,
          radius: 14,
          pickedUp: false,
        },
      ],
      doors: [
        {
          dir: 'E',
          targetRoomId: 2,
          targetRoomType: 'combat',
          x: 920,
          y: 270,
          radius: 24,
          locked: false,
          isSecretPassage: false,
        },
      ],
      pickups,
    });

    expect(count1).toBe(scratch.length);
    expect(count1).toBe(6 + 30);

    // Main interactables (portal, chest, merchant, shrine, world_item, door) come BEFORE pickups
    // so the 16/10/6 quota never drops a primary interactable when 30+ pickups are on the floor.
    expect(scratch.slice(0, 6).map((e) => e.kind)).toEqual([
      'portal',
      'chest',
      'merchant',
      'shrine',
      'world_item',
      'door',
    ]);
    expect(scratch[6]?.kind).toBe('pickup');

    // Every colored interactable light must clamp alpha <= 0.35 (Spec 3.2)
    for (const entry of scratch) {
      expect(entry.alpha).toBeGreaterThan(0);
      expect(entry.alpha).toBeLessThanOrEqual(0.35);
      if (entry.secondaryAlpha !== undefined) {
        expect(entry.secondaryAlpha).toBeLessThanOrEqual(0.35);
      }
    }

    const firstRef = scratch[0];
    const secondRef = scratch[1];
    const sixthRef = scratch[5];

    // Second call reuses the exact same object instances in scratch
    const count2 = populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      inHub: false,
      elapsedSec: 1.5,
      portalActive: true,
      portalX: 650,
      portalY: 335,
      chests: [
        {
          id: 1,
          x: 555,
          y: 205,
          radius: 18,
          rarity: 'epic',
          opened: false,
          droppedWeaponId: 'arc_lightning_rifle',
        },
      ],
      npcEntities: [
        {
          id: 2,
          kind: 'merchant',
          nameVi: 'Thương Nhân',
          dialogueVi: 'Chào!',
          x: 480,
          y: 220,
          radius: 20,
          interacted: false,
          costHp: 0,
        },
        {
          id: 3,
          kind: 'shrine',
          nameVi: 'Điện Thờ',
          dialogueVi: 'Hiến tế.',
          x: 650,
          y: 225,
          radius: 20,
          interacted: false,
          costHp: 2,
        },
      ],
      worldItems: [
        {
          id: 4,
          kind: 'weapon',
          weaponId: 'magma_cannon',
          rarity: 'legendary',
          nameVi: 'Pháo Dung Nham',
          costGold: 0,
          healAmount: 0,
          x: 555,
          y: 280,
          radius: 14,
          pickedUp: false,
        },
      ],
      doors: [
        {
          dir: 'E',
          targetRoomId: 2,
          targetRoomType: 'combat',
          x: 920,
          y: 270,
          radius: 24,
          locked: false,
          isSecretPassage: false,
        },
      ],
      pickups,
    });

    expect(count2).toBe(count1);
    expect(scratch[0]).toBe(firstRef);
    expect(scratch[1]).toBe(secondRef);
    expect(scratch[5]).toBe(sixthRef);
  });

  it('complies with Spec 3.2 for Closed vs Opened Chests (rarity color, radius 70-90, 2s pulse, rare+ sparkles)', () => {
    const scratch: InteractableLightEntry[] = [];
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      elapsedSec: 0.5, // peak of 2s sin(t * PI) cycle
      chests: [
        {
          id: 10,
          x: 400,
          y: 250,
          radius: 18,
          rarity: 'epic',
          opened: false,
          droppedWeaponId: 'void_staff',
        },
      ],
    });
    expect(scratch).toHaveLength(1);
    const peakRadius = scratch[0]!.radius;
    const peakAlpha = scratch[0]!.alpha;
    expect(scratch[0]!.colorNum).toBe(hexToNum(WEAPON_RARITY_COLORS.epic));
    expect(peakRadius).toBeGreaterThanOrEqual(70);
    expect(peakRadius).toBeLessThanOrEqual(90);
    expect(peakAlpha).toBeLessThanOrEqual(0.35);

    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      elapsedSec: 1.5, // trough of 2s sin(t * PI) cycle
      chests: [
        {
          id: 10,
          x: 400,
          y: 250,
          radius: 18,
          rarity: 'epic',
          opened: false,
          droppedWeaponId: 'void_staff',
        },
      ],
    });
    expect(scratch[0]!.radius).toBeLessThan(peakRadius);
    expect(scratch[0]!.alpha).toBeLessThan(peakAlpha);

    // Opened chest emits 0 light and 0 glow
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      elapsedSec: 0.5,
      chests: [
        {
          id: 10,
          x: 400,
          y: 250,
          radius: 18,
          rarity: 'epic',
          opened: true,
          droppedWeaponId: 'void_staff',
        },
      ],
    });
    expect(scratch).toHaveLength(0);

    const closedCommonGlow = resolveInteractableVisualGlowSpec({
      kind: 'chest',
      rarity: 'common',
      opened: false,
      elapsedSec: 1.0,
    });
    const closedRareGlow = resolveInteractableVisualGlowSpec({
      kind: 'chest',
      rarity: 'rare',
      opened: false,
      elapsedSec: 1.0,
    });
    const openedEpicGlow = resolveInteractableVisualGlowSpec({
      kind: 'chest',
      rarity: 'epic',
      opened: true,
      elapsedSec: 1.0,
    });

    expect(closedCommonGlow.glowAlpha).toBeGreaterThanOrEqual(0.25);
    expect(closedCommonGlow.glowAlpha).toBeLessThanOrEqual(0.4);
    expect(closedCommonGlow.hasSparkles).toBe(false);

    expect(closedRareGlow.glowAlpha).toBeGreaterThanOrEqual(0.25);
    expect(closedRareGlow.glowAlpha).toBeLessThanOrEqual(0.4);
    expect(closedRareGlow.hasSparkles).toBe(true);

    expect(openedEpicGlow.glowAlpha).toBe(0);
    expect(openedEpicGlow.hasSparkles).toBe(false);
  });

  it('complies with Spec 3.2 for World Items (radius 50-70, Soul Knight rarity beams strictly on Epic/Legendary, shop pedestal mat)', () => {
    const scratch: InteractableLightEntry[] = [];
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      elapsedSec: 1.0,
      worldItems: [
        {
          id: 1,
          kind: 'weapon',
          weaponId: 'hunter_crossbow',
          rarity: 'rare',
          nameVi: 'Nỏ Săn',
          costGold: 55,
          healAmount: 0,
          x: 500,
          y: 300,
          radius: 14,
          pickedUp: false,
        },
        {
          id: 2,
          kind: 'weapon',
          weaponId: 'magma_cannon',
          rarity: 'legendary',
          nameVi: 'Pháo Dung Nham',
          costGold: 0,
          healAmount: 0,
          x: 560,
          y: 300,
          radius: 14,
          pickedUp: false,
        },
      ],
    });

    expect(scratch).toHaveLength(2);
    for (const light of scratch) {
      expect(light.radius).toBeGreaterThanOrEqual(50);
      expect(light.radius).toBeLessThanOrEqual(70);
      expect(light.alpha).toBeLessThanOrEqual(0.35);
    }

    const rareShopGlow = resolveInteractableVisualGlowSpec({
      kind: 'world_item',
      rarity: 'rare',
      costGold: 55,
      pickedUp: false,
      elapsedSec: 1.0,
    });
    expect(rareShopGlow.glowAlpha).toBeGreaterThanOrEqual(0.25);
    expect(rareShopGlow.glowAlpha).toBeLessThanOrEqual(0.4);
    expect(rareShopGlow.hasRarityBeam).toBe(false);
    expect(rareShopGlow.hasShopPedestal).toBe(true);

    const epicDropGlow = resolveInteractableVisualGlowSpec({
      kind: 'world_item',
      rarity: 'epic',
      costGold: 0,
      pickedUp: false,
      elapsedSec: 1.0,
    });
    expect(epicDropGlow.hasRarityBeam).toBe(true);
    expect(epicDropGlow.beamColorNum).toBe(0xc084fc);
    expect(epicDropGlow.beamHeight).toBeGreaterThanOrEqual(64);
    expect(epicDropGlow.beamHeight).toBeLessThanOrEqual(96);
    expect(epicDropGlow.beamAlpha).toBeLessThanOrEqual(0.4);
    expect(epicDropGlow.hasShopPedestal).toBe(false);

    const legendaryDropGlow = resolveInteractableVisualGlowSpec({
      kind: 'world_item',
      rarity: 'legendary',
      costGold: 0,
      pickedUp: false,
      elapsedSec: 1.0,
    });
    expect(legendaryDropGlow.hasRarityBeam).toBe(true);
    expect(legendaryDropGlow.beamColorNum).toBe(0xfacc15);
    expect(legendaryDropGlow.beamHeight).toBeGreaterThanOrEqual(64);
    expect(legendaryDropGlow.beamHeight).toBeLessThanOrEqual(96);
  });

  it('emits pickup lights (radius 24-32) ONLY on High quality tier and 0 on Medium/Low', () => {
    const scratch: InteractableLightEntry[] = [];
    const samplePickups = [
      {
        id: 1,
        kind: 'gold' as const,
        prevX: 100,
        prevY: 100,
        x: 100,
        y: 100,
        vx: 0,
        vy: 0,
        amount: 10,
        ttlSec: 10,
      },
      {
        id: 2,
        kind: 'prey_emblem' as const,
        prevX: 120,
        prevY: 100,
        x: 120,
        y: 100,
        vx: 0,
        vy: 0,
        amount: 8,
        ttlSec: 10,
      },
      {
        id: 3,
        kind: 'life_seed' as const,
        prevX: 140,
        prevY: 100,
        x: 140,
        y: 100,
        vx: 0,
        vy: 0,
        amount: 1,
        ttlSec: 10,
      },
    ];

    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      elapsedSec: 1.0,
      pickups: samplePickups,
    });
    expect(scratch).toHaveLength(3);
    expect(scratch.map((s) => s.colorNum)).toEqual([0xfacc15, 0x38bdf8, 0x4ade80]);
    for (const s of scratch) {
      expect(s.radius).toBeGreaterThanOrEqual(24);
      expect(s.radius).toBeLessThanOrEqual(32);
    }

    populateInteractableLightsScratch(scratch, {
      tier: 'medium',
      biome: 1,
      elapsedSec: 1.0,
      pickups: samplePickups,
    });
    expect(scratch).toHaveLength(0);

    populateInteractableLightsScratch(scratch, {
      tier: 'low',
      biome: 1,
      elapsedSec: 1.0,
      pickups: samplePickups,
    });
    expect(scratch).toHaveLength(0);
  });

  it('complies with Spec 3.2 for Portal, Doors (locked crimson vs open biome accent), Merchant, Hub Statues, and Shrine turn-off after use', () => {
    const scratch: InteractableLightEntry[] = [];

    // Active portal + Unused Shrine + Merchant + Locked Door + Open Door
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 2,
      inHub: false,
      elapsedSec: 1.0,
      portalActive: true,
      portalX: 600,
      portalY: 300,
      npcEntities: [
        {
          id: 1,
          kind: 'merchant',
          nameVi: 'Thương Nhân',
          dialogueVi: '',
          x: 400,
          y: 200,
          radius: 20,
          interacted: false,
          costHp: 0,
        },
        {
          id: 2,
          kind: 'shrine',
          nameVi: 'Điện Thờ',
          dialogueVi: '',
          x: 500,
          y: 200,
          radius: 20,
          interacted: false,
          costHp: 2,
        },
      ],
      doors: [
        {
          dir: 'N',
          targetRoomId: 2,
          targetRoomType: 'combat',
          x: 480,
          y: 40,
          radius: 24,
          locked: true,
          isSecretPassage: false,
        },
        {
          dir: 'S',
          targetRoomId: 3,
          targetRoomType: 'treasure',
          x: 480,
          y: 500,
          radius: 24,
          locked: false,
          isSecretPassage: false,
        },
      ],
    });

    const portalLight = scratch.find((e) => e.kind === 'portal')!;
    expect(portalLight.colorNum).toBe(0xa855f7);
    expect(portalLight.secondaryColorNum).toBe(0x22d3ee);
    expect(portalLight.radius).toBeGreaterThanOrEqual(140);
    expect(portalLight.radius).toBeLessThanOrEqual(180);

    const merchantLight = scratch.find((e) => e.kind === 'merchant')!;
    expect(merchantLight.colorNum).toBe(0xf59e42);
    expect(merchantLight.radius).toBeGreaterThanOrEqual(70);
    expect(merchantLight.radius).toBeLessThanOrEqual(100);

    const shrineLight = scratch.find((e) => e.kind === 'shrine')!;
    expect(shrineLight.colorNum).toBe(0x22d3ee);
    expect(shrineLight.radius).toBeGreaterThanOrEqual(70);
    expect(shrineLight.radius).toBeLessThanOrEqual(100);

    const doorLights = scratch.filter((e) => e.kind === 'door');
    expect(doorLights).toHaveLength(2);
    expect(doorLights[0]!.colorNum).toBe(0xdc2626);
    expect(doorLights[0]!.radius).toBeGreaterThanOrEqual(60);
    expect(doorLights[0]!.radius).toBeLessThanOrEqual(80);
    expect(doorLights[1]!.colorNum).toBe(hexToNum(ENV_PALETTE[2].accent));
    expect(doorLights[1]!.radius).toBeGreaterThanOrEqual(60);
    expect(doorLights[1]!.radius).toBeLessThanOrEqual(80);

    // Shrine turns off completely after interacted === true, and inactive portal emits 0 light
    populateInteractableLightsScratch(scratch, {
      tier: 'high',
      biome: 1,
      inHub: true,
      elapsedSec: 1.0,
      portalActive: false,
      npcEntities: [
        {
          id: 2,
          kind: 'shrine',
          nameVi: 'Điện Thờ',
          dialogueVi: '',
          x: 500,
          y: 200,
          radius: 20,
          interacted: true,
          costHp: 2,
        },
      ],
      hubStatues: [
        {
          characterId: 'vanguard',
          nameVi: 'Thiết Vệ',
          titleVi: 'Tank',
          x: 350,
          y: 220,
          radius: 20,
        },
      ],
    });
    expect(scratch.find((e) => e.kind === 'portal')).toBeUndefined();
    expect(scratch.find((e) => e.kind === 'shrine')).toBeUndefined();
    const statueLight = scratch.find((e) => e.kind === 'hub_statue')!;
    expect(statueLight.colorNum).toBe(hexToNum(CHARACTER_THEME_COLORS.vanguard));
    expect(statueLight.radius).toBeGreaterThanOrEqual(70);
    expect(statueLight.radius).toBeLessThanOrEqual(100);

    expect(
      resolveInteractableVisualGlowSpec({ kind: 'shrine', interacted: true }).glowAlpha,
    ).toBe(0);
    expect(
      resolveInteractableVisualGlowSpec({ kind: 'portal', active: false }).glowAlpha,
    ).toBe(0);
  });

  it('resolves the current [E] highlight target within interact range and returns null when far away', () => {
    const chestTarget = resolveCurrentInteractHighlightTarget({
      playerX: 500,
      playerY: 278,
      biome: 1,
      chests: [
        {
          id: 7,
          x: 500,
          y: 250,
          radius: 18,
          rarity: 'legendary',
          opened: false,
          droppedWeaponId: 'solar_archon_staff',
        },
      ],
      worldItems: [
        {
          id: 8,
          kind: 'weapon',
          weaponId: 'hunter_crossbow',
          rarity: 'rare',
          nameVi: 'Nỏ Săn',
          costGold: 0,
          healAmount: 0,
          x: 510,
          y: 260,
          radius: 14,
          pickedUp: false,
        },
      ],
    });
    expect(chestTarget).not.toBeNull();
    expect(chestTarget?.kind).toBe('chest');
    expect(chestTarget?.id).toBe(7);

    const farTarget = resolveCurrentInteractHighlightTarget({
      playerX: 260,
      playerY: 270,
      biome: 1,
      chests: [
        {
          id: 7,
          x: 555,
          y: 205,
          radius: 18,
          rarity: 'epic',
          opened: false,
          droppedWeaponId: 'arc_lightning_rifle',
        },
      ],
      portalActive: true,
      portalX: 650,
      portalY: 335,
    });
    expect(farTarget).toBeNull();
  });
});
