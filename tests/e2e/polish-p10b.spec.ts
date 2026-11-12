import { expect, test } from '@playwright/test';

test.describe('Phase P10b — Combat FX (BlendMode.ADD), Elemental Combo FX, Chest Open Arc & Clear Biome Ambient', () => {
  test('verifies zero mist textures, additive combat FX + shell casing shadow, 0.4s coalesced elemental reaction banner, chest loot arc + rarity pillar, and Biome 1/2/3 ambient + depth=60 untinted enemy bullets', async ({
    page,
  }) => {
    test.setTimeout(90000);

    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
      if (msg.type() === 'warning') consoleWarnings.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/?scene=game&testHooks=1');
    await page.waitForFunction(
      () =>
        window.__GAME_DEBUG__?.scene === 'GameScene' &&
        (window.__GAME_DEBUG__?.tick ?? 0) >= 25,
      null,
      { timeout: 15000 },
    );

    // 1. Verify baked FX textures in GameScene (zero fx_ambient_mist, all P10b FX textures present)
    const textureCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            textures: { exists: (key: string) => boolean };
            fx?: {
              ambientPool: Array<{
                sprite: { texture: { key: string }; visible: boolean; blendMode: number };
                kind: string;
                parallaxLayer: number;
                vy: number;
              }>;
            };
          }
        | undefined;
      if (!gs) return null;
      return {
        hasMist: gs.textures.exists('fx_ambient_mist'),
        hasImpactRing: gs.textures.exists('fx_impact_ring'),
        hasShockwaveRing: gs.textures.exists('fx_shockwave_ring'),
        hasSparkTrail: gs.textures.exists('fx_spark_trail'),
        hasMuzzleCore: gs.textures.exists('fx_muzzle_core'),
        hasFirefly: gs.textures.exists('fx_ambient_firefly'),
        hasSnow: gs.textures.exists('fx_ambient_snow'),
        hasEmber: gs.textures.exists('fx_ember_mote'),
      };
    });
    expect(textureCheck).not.toBeNull();
    expect(textureCheck!.hasMist).toBe(false);
    expect(textureCheck!.hasImpactRing).toBe(true);
    expect(textureCheck!.hasShockwaveRing).toBe(true);
    expect(textureCheck!.hasSparkTrail).toBe(true);
    expect(textureCheck!.hasMuzzleCore).toBe(true);
    expect(textureCheck!.hasFirefly).toBe(true);
    expect(textureCheck!.hasSnow).toBe(true);
    expect(textureCheck!.hasEmber).toBe(true);

    // 2. Verify firing weapons & hitting enemies spawns BlendMode.ADD particles (depth > 34) & shell casings with ground shadow
    const combatFxCheck = await page.evaluate(() => {
      window.__GAME_SET_QUALITY__?.('high');
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            fx: {
              spawnMuzzleFlashAndCasing: (
                x: number,
                y: number,
                ang: number,
                shotgun: boolean,
              ) => void;
              spawnHitSparks: (
                x: number,
                y: number,
                ang: number,
                opts: { isCrit: boolean; element: string; count: number },
              ) => void;
              update: (dt: number) => void;
              particlePool: Array<{
                active: boolean;
                textureKey: string;
                blendMode: string;
                hasGroundShadow: boolean;
                sprite: { depth: number; blendMode: number; visible: boolean };
                shadowSprite?: { visible: boolean; depth: number; alpha: number };
              }>;
            };
          }
        | undefined;
      if (!gs) return null;
      gs.fx.spawnMuzzleFlashAndCasing(480, 270, 0, true);
      gs.fx.spawnHitSparks(510, 270, 0, { isCrit: true, element: 'burn', count: 8 });
      gs.fx.update(0.016);

      const active = gs.fx.particlePool.filter((p) => p.active);
      const additiveParticles = active.filter(
        (p) => p.blendMode === 'ADD' && p.sprite.depth > 34 && p.sprite.depth < 60,
      );
      const casing = active.find((p) => p.textureKey === 'fx_shell_casing');
      return {
        activeCount: active.length,
        additiveCount: additiveParticles.length,
        hasMuzzleCore: active.some(
          (p) => p.textureKey === 'fx_sh_muzzle_burst' || p.textureKey === 'fx_muzzle_core',
        ),
        hasImpactRing: active.some(
          (p) => p.textureKey === 'fx_sh_hit_spark' || p.textureKey === 'fx_impact_ring',
        ),
        hasSparkTrail: active.some((p) => p.textureKey === 'fx_spark_trail'),
        casingHasShadow: Boolean(casing?.hasGroundShadow && casing?.shadowSprite?.visible),
        casingShadowDepth: casing?.shadowSprite?.depth ?? 0,
      };
    });
    expect(combatFxCheck).not.toBeNull();
    expect(combatFxCheck!.additiveCount).toBeGreaterThanOrEqual(6);
    expect(combatFxCheck!.hasMuzzleCore).toBe(true);
    expect(combatFxCheck!.hasImpactRing).toBe(true);
    expect(combatFxCheck!.hasSparkTrail).toBe(true);
    expect(combatFxCheck!.casingHasShadow).toBe(true);
    expect(combatFxCheck!.casingShadowDepth).toBe(19);

    // 3. Verify Elemental Reaction coalescing within 0.4s -> "HƠI NƯỚC ×3" & harmonic ring (easeOutCubic)
    const reactionCheck = await page.evaluate(() => {
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            fx: {
              activeReactionBanner: {
                label: string;
                count: number;
                totalDamage: number;
              } | null;
              activeWorldReactionPopupSlot: {
                active: boolean;
                text: { text: string; visible: boolean };
              } | null;
              spawnElementalReactionFx: (params: {
                reaction: 'vaporize';
                x: number;
                y: number;
                damage: number;
                isTeamCombo: boolean;
              }) => void;
              particlePool: Array<{
                active: boolean;
                textureKey: string;
                easeCurve: string;
                blendMode: string;
              }>;
            };
          }
        | undefined;
      if (!gs) return null;
      gs.fx.activeReactionBanner = null;
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 480,
        y: 260,
        damage: 25,
        isTeamCombo: false,
      });
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 484,
        y: 258,
        damage: 30,
        isTeamCombo: false,
      });
      gs.fx.spawnElementalReactionFx({
        reaction: 'vaporize',
        x: 488,
        y: 256,
        damage: 35,
        isTeamCombo: true,
      });

      const shockwaves = gs.fx.particlePool.filter(
        (p) =>
          p.active &&
          (p.textureKey === 'fx_shockwave_ring' || p.textureKey === 'fx_impact_ring'),
      );
      return {
        bannerLabel: gs.fx.activeReactionBanner?.label ?? '',
        bannerCount: gs.fx.activeReactionBanner?.count ?? 0,
        totalDamage: gs.fx.activeReactionBanner?.totalDamage ?? 0,
        worldPopupText: gs.fx.activeWorldReactionPopupSlot?.text.text ?? '',
        shockwaveCount: shockwaves.length,
        allEaseOutCubic:
          shockwaves.length > 0 &&
          shockwaves.every((s) => s.easeCurve === 'easeOutCubic' && s.blendMode === 'ADD'),
      };
    });
    expect(reactionCheck).not.toBeNull();
    expect(reactionCheck!.bannerLabel).toBe('HƠI NƯỚC ×3');
    expect(reactionCheck!.bannerCount).toBe(3);
    expect(reactionCheck!.totalDamage).toBe(90);
    expect(reactionCheck!.worldPopupText).toContain('HƠI NƯỚC ×3');
    expect(reactionCheck!.shockwaveCount).toBeGreaterThan(0);
    expect(reactionCheck!.allEaseOutCubic).toBe(true);

    // 4. Verify Chest Open sets fromX/fromY/droppedAtTick on dropped weapon and spawns fx_rarity_beam
    const chestCheck = await page.evaluate(() => {
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            processSimEvents: (events: unknown[]) => void;
            syncRoomEntities: (dt: number) => void;
            chestSprites: Map<number, { y: number; scaleX: number; scaleY: number }>;
            fx: {
              particlePool: Array<{ active: boolean; textureKey: string; blendMode: string }>;
            };
          }
        | undefined;
      if (!gs) return null;
      sim.inHub = false;
      sim.chests.length = 0;
      sim.worldItems.length = 0;
      const chest = sim.spawnChest(480, 260, 'legendary', 'solar_archon_staff');
      sim.tick += 1;
      gs.syncRoomEntities(0.016);
      const closedScaleY = gs.chestSprites.get(chest.id)?.scaleY ?? 0.25;

      sim.openChest(chest);
      const events = sim.consumeEvents();
      gs.processSimEvents(events);
      sim.tick += 4;
      gs.syncRoomEntities(0.016);

      const drop = sim.worldItems[sim.worldItems.length - 1];
      const chestSprite = gs.chestSprites.get(chest.id);
      const hasRarityBeamParticle = gs.fx.particlePool.some(
        (p) => p.active && p.textureKey === 'fx_rarity_beam' && p.blendMode === 'ADD',
      );
      return {
        fromX: drop?.fromX,
        fromY: drop?.fromY,
        droppedAtTick: drop?.droppedAtTick,
        hasRarityBeamParticle,
        closedScaleY,
        bounceScaleY: chestSprite?.scaleY ?? closedScaleY,
        bounceY: chestSprite?.y ?? 260,
      };
    });
    expect(chestCheck).not.toBeNull();
    expect(chestCheck!.fromX).toBe(480);
    expect(chestCheck!.fromY).toBe(254);
    expect(chestCheck!.droppedAtTick).toBeGreaterThan(0);
    expect(chestCheck!.hasRarityBeamParticle).toBe(true);
    expect(chestCheck!.bounceScaleY).toBeGreaterThan(chestCheck!.closedScaleY);
    expect(chestCheck!.bounceY).toBeLessThan(260);

    // 5. Verify Biome 2 (60-80 2-layer snow) and Biome 3 (rising embers + depth=60 untinted enemy bullets)
    const biome2And3Check = await page.evaluate(() => {
      window.__GAME_SET_QUALITY__?.('high');
      const sim = window.__GAME_TRANSPORT__!.getSim();
      const gs = window.__PHASER_GAME__?.scene.getScene('GameScene') as
        | {
            fx: {
              setBiome: (b: 1 | 2 | 3) => void;
              update: (dt: number) => void;
              ambientPool: Array<{
                kind: string;
                parallaxLayer: number;
                vy: number;
                sprite: { visible: boolean; texture: { key: string }; blendMode: number };
              }>;
            };
            syncProjectilesAndPickups: () => void;
            projectileSprites: Map<
              number,
              {
                sprite: {
                  depth: number;
                  blendMode: number;
                  tintTopLeft: number;
                  alpha: number;
                };
                textureKey: string;
              }
            >;
          }
        | undefined;
      if (!gs) return null;

      // Switch to Biome 2
      sim.advanceToBiome(2);
      gs.fx.setBiome(2);
      gs.fx.update(0.016);
      const b2Visible = gs.fx.ambientPool
        .slice(0, 80)
        .filter((a) => a.sprite.visible);
      const b2Layer0 = b2Visible.filter((a) => a.parallaxLayer === 0).length;
      const b2Layer1 = b2Visible.filter((a) => a.parallaxLayer === 1).length;
      const b2AllSnow = b2Visible.every(
        (a) => a.kind === 'snow' && a.sprite.texture.key === 'fx_ambient_snow',
      );

      // Switch to Biome 3 & spawn enemy projectile with burn element
      sim.advanceToBiome(3);
      gs.fx.setBiome(3);
      gs.fx.update(0.016);
      const b3Visible = gs.fx.ambientPool
        .slice(0, 80)
        .filter((a) => a.sprite.visible);
      const b3AllRisingEmbers = b3Visible.every(
        (a) =>
          a.kind === 'ember' &&
          a.sprite.texture.key === 'fx_ember_mote' &&
          a.vy < 0 &&
          a.sprite.blendMode === 1,
      );

      // Spawn an enemy projectile in Biome 3
      const enemyProjId = 77777;
      sim.projectiles.push({
        id: enemyProjId,
        team: 'enemy',
        ownerId: 999,
        weaponId: 'enemy_fireball',
        x: sim.player.x + 40,
        y: sim.player.y,
        prevX: sim.player.x + 40,
        prevY: sim.player.y,
        vx: -120,
        vy: 0,
        angle: Math.PI,
        radius: 6,
        damage: 2,
        critChance: 0,
        critMultiplier: 1.5,
        knockback: 20,
        ttlSec: 2,
        pierceRemaining: 0,
        bounceRemaining: 0,
        element: 'burn',
        statusChance: 1,
        aoeRadius: 0,
        isLifeSeed: false,
        hitEntityIds: [],
      });
      gs.syncProjectilesAndPickups();
      const projEntry = gs.projectileSprites.get(enemyProjId);

      return {
        b2Count: b2Visible.length,
        b2Layer0,
        b2Layer1,
        b2AllSnow,
        b3Count: b3Visible.length,
        b3AllRisingEmbers,
        enemyProjTex: projEntry?.textureKey,
        enemyProjDepth: projEntry?.sprite.depth,
        enemyProjBlendMode: projEntry?.sprite.blendMode,
        enemyProjTint: projEntry?.sprite.tintTopLeft,
        enemyProjAlpha: projEntry?.sprite.alpha,
      };
    });

    expect(biome2And3Check).not.toBeNull();
    expect(biome2And3Check!.b2Count).toBeGreaterThanOrEqual(60);
    expect(biome2And3Check!.b2Count).toBeLessThanOrEqual(80);
    expect(biome2And3Check!.b2Layer0).toBeGreaterThan(20);
    expect(biome2And3Check!.b2Layer1).toBeGreaterThan(20);
    expect(biome2And3Check!.b2AllSnow).toBe(true);

    expect(biome2And3Check!.b3Count).toBeGreaterThanOrEqual(30);
    expect(biome2And3Check!.b3AllRisingEmbers).toBe(true);

    expect(biome2And3Check!.enemyProjTex).toBe('proj_enemy_orb');
    expect(biome2And3Check!.enemyProjDepth).toBe(60);
    expect(biome2And3Check!.enemyProjBlendMode).toBe(0);
    expect(biome2And3Check!.enemyProjTint).toBe(0xffffff);
    expect(biome2And3Check!.enemyProjAlpha).toBe(1);

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
  });
});
