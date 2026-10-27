import {
  CHARACTERS,
  clamp,
  findInteractTarget,
  i18n,
  INTERACT_HYSTERESIS,
  PLAYER_SLOT_COLORS,
  WEAPON_RARITY_COLORS,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../../art/cutout-rig.js';
import { PALETTE } from '../../art/palette.js';
import { MERCHANT_RIG_DEF, RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { getFreezeVisualTimeSec } from '../../core/visual-query.js';
import { computeChestOpenBounce, computeWorldItemArcPose } from '../../fx/combat-fx.js';
import {
  drawEnemyBatch1Indicators,
  drawEnemyEmbeddedArrows,
  drawEnemyParasiticThorns,
  drawSeedGunLifeBlossom,
  drawTetherStaffBeams,
  syncBatch1WeaponRoomEntities,
} from '../../fx/combat-fx-weapons-v2.js';
import { resolveInteractableVisualGlowSpec } from '../../fx/lighting-config.js';

export {
  drawEnemyBatch1Indicators,
  drawEnemyEmbeddedArrows,
  drawEnemyParasiticThorns,
  drawSeedGunLifeBlossom,
  drawTetherStaffBeams,
  syncBatch1WeaponRoomEntities,
};
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import { drawWorldWeaponSalvageRing } from './hud-pact-and-forge-modals.js';
import {
  resolveHubGuideVisibility,
  resolveInteractPromptSpec,
  syncWorldInteractPromptPill,
} from './interact-prompt.js';

const chestOpenedAtTickById = new Map<number, number>();
const prevChestOpenedById = new Map<number, boolean>();

export function recordChestOpenedAnim(chestId: number, simTick: number): void {
  chestOpenedAtTickById.set(chestId, simTick);
  prevChestOpenedById.set(chestId, true);
}

export function syncRoomEntitiesImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  syncBatch1WeaponRoomEntities(this, sim);
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;
  const lightingEnabled = this.lighting?.isLightmapVisible() ?? true;
  const visualTimeSec = getFreezeVisualTimeSec(this.lighting?.getElapsedSec() ?? 1.0); //
  // freeze clock via getFreezeVisualTimeSec
  void dtSec;

  const debug = initGlobalDebugState();
  const target = sim.stressTestActive
    ? null
    : findInteractTarget(sim, sim.player.id, {
        currentTargetKey: this.interactPromptState.currentTargetKey,
        hysteresis: INTERACT_HYSTERESIS,
      });
  this.currentInteractTarget = target;

  // 0. Hub 5 Character Statues & Natural Hub Guidance Signs (Doanh Trại)
  const previewOpen =
    sim.inHub &&
    !this.fullMapOpen &&
    !debug.overlayVisible &&
    target?.kind === 'hub_statue';
  debug.hubPreviewCharacterId = previewOpen ? target.statue.characterId : null;

  const modalOrMapOpen =
    this.fullMapOpen ||
    this.pauseModalOpen ||
    (this.settingsModal?.isOpen() ?? false) ||
    debug.overlayVisible;
  const weaponComparisonVisible =
    sim.runState === 'playing' &&
    !modalOrMapOpen &&
    !previewOpen &&
    target?.kind === 'world_item' &&
    target.item.kind === 'weapon' &&
    Boolean(target.item.weaponId);
  debug.weaponComparisonVisible = weaponComparisonVisible;
  debug.comparedWeaponId =
    weaponComparisonVisible && target?.kind === 'world_item'
      ? (target.item.weaponId ?? null)
      : null;

  if (sim.inHub && sim.hubStatues.length > 0) {
    for (let i = 0; i < sim.hubStatues.length; i++) {
      const st = sim.hubStatues[i]!;
      const cDef = CHARACTERS[st.characterId];
      const charTxt = i18n.getCharacterText(st.characterId);
      const rigDef = RIG_DEFS_BY_ID[st.characterId] ?? VANGUARD_RIG_DEF;
      let entry = this.hubStatueRigs.get(st.characterId);
      if (!entry) {
        const rig = new CutoutRig(this, st.x, st.y + RIG_FOOT_OFFSET_Y, rigDef, {
          displayScale: 1.12,
          initialPhaseOffset: i * 0.35,
        });
        rig.container.setDepth(24);
        rig.setEquippedWeapon(cDef.starterWeaponId);

        const glowSprite = this.add.image(st.x, st.y + 4, 'fx_light_radial');
        glowSprite.setDepth(35);
        glowSprite.setBlendMode(Phaser.BlendModes.ADD);

        const label = this.add
          .text(st.x, st.y - 30, charTxt.name, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '800',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46)
          .setVisible(false);

        const subLabel = this.add
          .text(st.x, st.y + 23, '', {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '8.5px',
            fontStyle: '700',
            color: PALETTE.SILVER_BRIGHT,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 2.5,
            align: 'center',
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46)
          .setVisible(false);

        entry = { rig, glowSprite, label, subLabel };
        this.hubStatueRigs.set(st.characterId, entry);
      }

      const glowSpec = resolveInteractableVisualGlowSpec({
        kind: 'hub_statue',
        characterId: st.characterId,
      });
      if (lightingEnabled && glowSpec.glowAlpha > 0) {
        entry.glowSprite.setPosition(st.x, st.y + 4);
        entry.glowSprite.setDisplaySize(glowSpec.glowRadiusX * 2, glowSpec.glowRadiusY * 2);
        entry.glowSprite.setTint(glowSpec.colorNum);
        entry.glowSprite.setAlpha(glowSpec.glowAlpha);
        entry.glowSprite.setVisible(true);
      } else {
        entry.glowSprite.setVisible(false);
      }

      entry.label.setVisible(false);
      entry.subLabel.setVisible(false);
      entry.rig.update(dtSec);
    }

    // Natural Hub Guidance Signs (Statues Arc, Weapon Rack, Training Dummy live DPS) — visible only within <= 200u
    const isEn = i18n.getLocale() === 'en';
    const hubCx = sim.map.width * 0.5;
    const hubCy = sim.map.height * 0.5;
    const camScrollX = this.cameras.main.worldView?.x ?? 0;
    const dummySignX = hubCx + 95;
    const dummyBlockedByInvite =
      this.invitePanelVisible && !this.fullMapOpen && dummySignX - camScrollX > 560;
    const guideSpecs: {
      x: number;
      y: number;
      anchorX: number;
      anchorY: number;
      text: string;
      color: string;
      blocked: boolean;
    }[] = [
      {
        x: hubCx - 125,
        y: hubCy - 60,
        anchorX: hubCx - 125,
        anchorY: hubCy - 125,
        text: i18n.t('ui.hubGuide.statuesSign'),
        color: PALETTE.CYAN_FROST,
        blocked: previewOpen,
      },
      {
        x: hubCx - 258,
        y: hubCy + 22,
        anchorX: hubCx - 258,
        anchorY: hubCy + 22,
        text: isEn
          ? '⚔ PRACTICE WEAPON RACK — Press [E] to Test & Compare'
          : '⚔ KỆ VŨ KHÍ THỬ NGHIỆM — Nhấn [E] Nhặt Thử & So Sánh',
        color: PALETTE.SOLAR_GOLD,
        blocked: previewOpen,
      },
      {
        x: dummySignX,
        y: hubCy + 42,
        anchorX: dummySignX,
        anchorY: hubCy + 42,
        text: isEn
          ? `🎯 Training Dummy · DPS: ${sim.getRollingDps().toFixed(1)}`
          : `🎯 Bù Nhìn Tập Bắn · DPS: ${sim.getRollingDps().toFixed(1)}`,
        color: PALETTE.LIME_GLOW,
        blocked: dummyBlockedByInvite,
      },
    ];

    for (let gIdx = 0; gIdx < guideSpecs.length; gIdx++) {
      const spec = guideSpecs[gIdx]!;
      let gTxt = this.hubGuideTexts[gIdx];
      if (!gTxt) {
        gTxt = this.add
          .text(spec.x, spec.y, spec.text, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '9.5px',
            fontStyle: '800',
            color: spec.color,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(45);
        this.hubGuideTexts[gIdx] = gTxt;
      } else {
        if (gTxt.text !== spec.text) gTxt.setText(spec.text);
        if (gTxt.style.color !== spec.color) gTxt.setColor(spec.color);
        gTxt.setPosition(spec.x, spec.y);
      }
      const guideVis = resolveHubGuideVisibility(
        sim.player.x,
        sim.player.y,
        spec.anchorX,
        spec.anchorY,
        spec.blocked,
      );
      gTxt.setAlpha(guideVis.alpha);
      gTxt.setVisible(guideVis.visible);
    }
  } else {
    if (this.hubStatueRigs.size > 0) {
      for (const entry of this.hubStatueRigs.values()) {
        entry.rig.destroy();
        entry.glowSprite.destroy();
        entry.label.destroy();
        entry.subLabel.destroy();
      }
      this.hubStatueRigs.clear();
    }
    if (this.hubGuideTexts.length > 0) {
      for (const gTxt of this.hubGuideTexts) {
        gTxt.destroy();
      }
      this.hubGuideTexts = [];
    }
  }

  // 0b. Contextual Ping Labels
  this.activePingIds.clear();
  for (let i = 0; i < sim.pings.length; i++) {
    const ping = sim.pings[i]!;
    this.activePingIds.add(ping.id);
    let label = this.pingVisuals.get(ping.id);
    const slotColor = PLAYER_SLOT_COLORS[ping.playerSlot];
    const prefixIcon =
      ping.kind === 'enemy'
        ? '⚔'
        : ping.kind === 'revive'
          ? '✚'
          : ping.kind === 'loot'
            ? '★'
            : '▼';
    const txt = `[P${ping.playerSlot}] ${prefixIcon} ${ping.labelVi}`;
    if (!label) {
      label = this.add
        .text(ping.x, ping.y - 26, txt, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '800',
          color: slotColor,
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(55);
      this.pingVisuals.set(ping.id, label);
    } else {
      if (label.text !== txt) label.setText(txt);
      if (label.style.color !== slotColor) label.setColor(slotColor);
      label.setPosition(ping.x, ping.y - 26 - Math.sin(visualTimeSec * 9.0) * 3);
    }
  }
  for (const [id, label] of this.pingVisuals.entries()) {
    if (!this.activePingIds.has(id)) {
      label.destroy();
      this.pingVisuals.delete(id);
    }
  }

  // 1. Floor / Hub Portal & Room Doors (North / South / East / West)
  this.syncPortalVisuals(dtSec);
  this.syncDoorVisuals(dtSec, target);

  // 2. Treasure / Reward Chests (5 Rarities; opening spawns instanced drops in Co-op)
  this.activeChestIds.clear();
  for (let i = 0; i < sim.chests.length; i++) {
    const ch = sim.chests[i]!;
    this.activeChestIds.add(ch.id);
    const tex = TextureBaker.getChestTextureKey(ch.rarity, ch.opened);
    let sprite = this.chestSprites.get(ch.id);
    if (!sprite) {
      sprite = this.add.sprite(ch.x, ch.y, tex);
      sprite.setScale(invBake);
      sprite.setDepth(23);
      this.chestSprites.set(ch.id, sprite);
    } else if (sprite.texture.key !== tex) {
      sprite.setTexture(tex);
    }

    const wasOpened = prevChestOpenedById.get(ch.id);
    if (ch.opened && wasOpened === false && !chestOpenedAtTickById.has(ch.id)) {
      chestOpenedAtTickById.set(ch.id, sim.tick);
    }
    prevChestOpenedById.set(ch.id, ch.opened);

    const openedAtTick = ch.opened ? chestOpenedAtTickById.get(ch.id) : undefined;
    const openAgeSec =
      openedAtTick !== undefined && sim.tick >= openedAtTick
        ? (sim.tick - openedAtTick) / 60
        : 999;
    const bounce = computeChestOpenBounce(openAgeSec);
    sprite.setPosition(ch.x, ch.y + bounce.offsetY);
    sprite.setScale(invBake * bounce.scaleX, invBake * bounce.scaleY);

    let glowSprite = this.chestGlowSprites.get(ch.id);
    if (!glowSprite) {
      glowSprite = this.add.image(ch.x, ch.y + 2, 'fx_light_radial');
      glowSprite.setDepth(35);
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);
      this.chestGlowSprites.set(ch.id, glowSprite);
    }

    const chestGlowSpec = resolveInteractableVisualGlowSpec({
      kind: 'chest',
      rarity: ch.rarity,
      opened: ch.opened,
      elapsedSec: visualTimeSec,
      id: ch.id,
    });

    const burstGlowRatio = openAgeSec < 0.38 ? 1 - openAgeSec / 0.38 : 0;
    const effectiveGlowAlpha = Math.max(chestGlowSpec.glowAlpha, burstGlowRatio * 0.72);
    if (lightingEnabled && effectiveGlowAlpha > 0) {
      glowSprite.setPosition(ch.x, ch.y + 2 - burstGlowRatio * 10);
      glowSprite.setDisplaySize(
        chestGlowSpec.glowRadiusX * 2 * (1 + burstGlowRatio * 0.35),
        chestGlowSpec.glowRadiusY * 2 * (1 + burstGlowRatio * 0.85),
      );
      glowSprite.setTint(chestGlowSpec.colorNum);
      glowSprite.setAlpha(effectiveGlowAlpha);
      glowSprite.setVisible(true);
    } else {
      glowSprite.setVisible(false);
    }

    let sparkles = this.chestSparkleSprites.get(ch.id);
    if (lightingEnabled && chestGlowSpec.hasSparkles) {
      if (!sparkles) {
        sparkles = [];
        for (let s = 0; s < 4; s++) {
          const sp = this.add.image(ch.x, ch.y, 'fx_sparkle_mote');
          sp.setDepth(35.3);
          sp.setBlendMode(Phaser.BlendModes.ADD);
          sparkles.push(sp);
        }
        this.chestSparkleSprites.set(ch.id, sparkles);
      }
      for (let s = 0; s < sparkles.length; s++) {
        const sp = sparkles[s]!;
        const phase = (visualTimeSec * 0.65 + s * 0.25 + ch.id * 0.17) % 1;
        const offsetX = Math.sin(s * 1.8 + ch.id + phase * Math.PI * 2) * 14 + (s - 1.5) * 6;
        const offsetY = 4 - phase * 24;
        const twinkle = Math.sin(phase * Math.PI);
        sp.setPosition(ch.x + offsetX, ch.y + offsetY);
        sp.setScale(invBake * (0.45 + 0.35 * twinkle));
        sp.setTint(s % 2 === 0 ? chestGlowSpec.colorNum : 0xffffff);
        sp.setAlpha(clamp(twinkle * 0.38, 0, 0.38));
        sp.setVisible(true);
      }
    } else if (sparkles) {
      for (let s = 0; s < sparkles.length; s++) {
        sparkles[s]!.setVisible(false);
      }
    }
  }

  for (const [id, sprite] of this.chestSprites.entries()) {
    if (!this.activeChestIds.has(id)) {
      sprite.destroy();
      this.chestSprites.delete(id);
      chestOpenedAtTickById.delete(id);
      prevChestOpenedById.delete(id);
      const glow = this.chestGlowSprites.get(id);
      if (glow) {
        glow.destroy();
        this.chestGlowSprites.delete(id);
      }
      const sparkles = this.chestSparkleSprites.get(id);
      if (sparkles) {
        for (const sp of sparkles) sp.destroy();
        this.chestSparkleSprites.delete(id);
      }
    }
  }

  // 3. World Items (Dropped Weapons & Merchant Shop Items, instanced per player unless shared)
  let activeWorldItemRenderX: number | null = null;
  let activeWorldItemRenderY: number | null = null;

  this.activeWorldItemIds.clear();
  for (let i = 0; i < sim.worldItems.length; i++) {
    const it = sim.worldItems[i]!;
    if (it.pickedUp) continue;
    if (
      it.ownerPlayerId !== undefined &&
      it.ownerPlayerId !== 0 &&
      it.ownerPlayerId !== sim.player.id
    ) {
      continue;
    }
    this.activeWorldItemIds.add(it.id);
    const tex =
      it.kind === 'weapon' && it.weaponId
        ? TextureBaker.getWeaponTextureKey(it.weaponId)
        : it.kind === 'blessing_scroll'
          ? 'item_blessing_scroll'
          : it.kind === 'weapon_upgrade'
            ? 'item_weapon_upgrade'
            : 'item_health_potion';

    let entry = this.worldItemSprites.get(it.id);
    if (!entry) {
      const shopMatSprite = this.add.image(it.x, it.y + 7, 'item_shop_pedestal');
      shopMatSprite.setScale(invBake);
      shopMatSprite.setDepth(22.5);
      shopMatSprite.setVisible(false);

      const glowSprite = this.add.image(it.x, it.y + 4, 'fx_light_radial');
      glowSprite.setDepth(35);
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);

      const beamSprite = this.add.image(it.x, it.y + 6, 'fx_rarity_beam');
      beamSprite.setOrigin(0.5, 0.92);
      beamSprite.setDepth(35.2);
      beamSprite.setBlendMode(Phaser.BlendModes.ADD);
      beamSprite.setVisible(false);

      const sprite = this.add.sprite(it.x, it.y, tex);
      sprite.setScale(invBake * 0.95);
      sprite.setDepth(32);

      const label = this.add
        .text(it.x, it.y - 24, '', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '800',
          color: WEAPON_RARITY_COLORS[it.rarity],
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(46)
        .setVisible(false);

      entry = { sprite, glowSprite, beamSprite, shopMatSprite, label };
      this.worldItemSprites.set(it.id, entry);
    } else if (entry.sprite.texture.key !== tex) {
      entry.sprite.setTexture(tex);
    }

    let renderX = it.x;
    let renderY = it.y;
    let arcOffsetY = 0;
    const idlePhaseRad = visualTimeSec * 4.8 + it.id;
    if (it.droppedAtTick !== undefined) {
      const ageSec = Math.max(0, (sim.tick - it.droppedAtTick) / 60);
      const pose = computeWorldItemArcPose(
        ageSec,
        it.fromX ?? it.x,
        it.fromY ?? it.y,
        it.x,
        it.y,
        idlePhaseRad,
      );
      renderX = pose.x;
      renderY = pose.y - pose.arcOffsetY;
      arcOffsetY = pose.arcOffsetY;
      entry.sprite.setRotation(pose.rotationRad);
    } else {
      entry.sprite.setRotation(0);
      arcOffsetY = Math.sin(idlePhaseRad) * 2.5;
    }

    const itemGlowSpec = resolveInteractableVisualGlowSpec({
      kind: 'world_item',
      rarity: it.rarity,
      pickedUp: it.pickedUp,
      costGold: it.costGold,
      elapsedSec: visualTimeSec,
      id: it.id,
    });

    if (itemGlowSpec.hasShopPedestal) {
      entry.shopMatSprite.setPosition(renderX, renderY + 7);
      entry.shopMatSprite.setVisible(true);
    } else {
      entry.shopMatSprite.setVisible(false);
    }

    if (lightingEnabled && itemGlowSpec.glowAlpha > 0) {
      entry.glowSprite.setPosition(renderX, renderY + 4 + arcOffsetY * 0.4);
      entry.glowSprite.setDisplaySize(
        itemGlowSpec.glowRadiusX * 2,
        itemGlowSpec.glowRadiusY * 2,
      );
      entry.glowSprite.setTint(itemGlowSpec.colorNum);
      entry.glowSprite.setAlpha(itemGlowSpec.glowAlpha);
      entry.glowSprite.setVisible(true);
    } else {
      entry.glowSprite.setVisible(false);
    }

    if (lightingEnabled && itemGlowSpec.hasRarityBeam) {
      entry.beamSprite.setPosition(renderX, renderY + 6);
      entry.beamSprite.setDisplaySize(itemGlowSpec.beamWidth, itemGlowSpec.beamHeight);
      entry.beamSprite.setTint(itemGlowSpec.beamColorNum);
      entry.beamSprite.setAlpha(itemGlowSpec.beamAlpha);
      entry.beamSprite.setVisible(true);
    } else {
      entry.beamSprite.setVisible(false);
    }

    entry.sprite.setPosition(renderX, renderY + arcOffsetY);
    entry.label.setVisible(false);
    if (target?.kind === 'world_item' && target.item.id === it.id) {
      activeWorldItemRenderX = renderX;
      activeWorldItemRenderY = renderY + arcOffsetY;
    }
  }

  for (const [id, entry] of this.worldItemSprites.entries()) {
    if (!this.activeWorldItemIds.has(id)) {
      entry.sprite.destroy();
      entry.glowSprite.destroy();
      entry.beamSprite.destroy();
      entry.shopMatSprite.destroy();
      entry.label.destroy();
      this.worldItemSprites.delete(id);
    }
  }

  // 4. NPCs (Merchant & Ancient Shrine)
  this.activeNpcIds.clear();
  for (let i = 0; i < sim.npcEntities.length; i++) {
    const npc = sim.npcEntities[i]!;
    this.activeNpcIds.add(npc.id);

    let entry = this.npcVisuals.get(npc.id);
    if (!entry) {
      const glowSprite = this.add.image(npc.x, npc.y + 4, 'fx_light_radial');
      glowSprite.setDepth(35);
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);

      if (npc.kind === 'merchant') {
        const rig = new CutoutRig(this, npc.x, npc.y + RIG_FOOT_OFFSET_Y, MERCHANT_RIG_DEF, {
          displayScale: 1.08,
        });
        rig.container.setDepth(27);
        const label = this.add
          .text(npc.x, npc.y - 38, i18n.t('ui.hud.merchantName'), {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '11px',
            fontStyle: '800',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46);
        entry = { rig, glowSprite, label };
      } else {
        const npcTex =
          npc.kind === 'daedalus_anvil'
            ? 'prop_daedalus_anvil'
            : npc.kind === 'upgrade_anvil'
              ? 'prop_upgrade_anvil'
              : npc.interacted
                ? 'prop_shrine_statue_used'
                : 'prop_shrine_statue';
        const sprite = this.add.sprite(npc.x, npc.y, npcTex);
        sprite.setScale(invBake);
        sprite.setDepth(24);
        const label = this.add
          .text(npc.x, npc.y - 36, i18n.t('ui.hud.shrineActive'), {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '11px',
            fontStyle: '800',
            color: npc.kind === 'daedalus_anvil' ? PALETTE.SOLAR_GOLD : PALETTE.CYAN_FROST,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46);
        entry = { sprite, glowSprite, label };
      }
      this.npcVisuals.set(npc.id, entry);
    }

    if (entry.rig) {
      entry.rig.update(dtSec);
      if (npc.kind === 'merchant') {
        const mTxt = i18n.t('ui.hud.merchantName');
        if (entry.label.text !== mTxt) entry.label.setText(mTxt);
        const mGlow = resolveInteractableVisualGlowSpec({
          kind: 'merchant',
          elapsedSec: visualTimeSec,
        });
        if (lightingEnabled && mGlow.glowAlpha > 0) {
          entry.glowSprite.setPosition(npc.x, npc.y + 6);
          entry.glowSprite.setDisplaySize(mGlow.glowRadiusX * 2, mGlow.glowRadiusY * 2);
          entry.glowSprite.setTint(mGlow.colorNum);
          entry.glowSprite.setAlpha(mGlow.glowAlpha);
          entry.glowSprite.setVisible(true);
        } else {
          entry.glowSprite.setVisible(false);
        }
      }
    }
    if (
      npc.kind === 'shrine' ||
      npc.kind === 'daedalus_anvil' ||
      npc.kind === 'upgrade_anvil'
    ) {
      const usedByLocal =
        npc.interacted || (npc.usedByPlayerIds?.includes(sim.player.id) ?? false);
      const npcTex =
        npc.kind === 'daedalus_anvil'
          ? 'prop_daedalus_anvil'
          : npc.kind === 'upgrade_anvil'
            ? 'prop_upgrade_anvil'
            : usedByLocal
              ? 'prop_shrine_statue_used'
              : 'prop_shrine_statue';
      if (entry.sprite) {
        if (entry.sprite.texture.key !== npcTex) {
          entry.sprite.setTexture(npcTex);
        }
        entry.sprite.setAlpha(usedByLocal ? 0.65 : 1);
      }

      const sGlow = resolveInteractableVisualGlowSpec({
        kind: npc.kind,
        interacted: usedByLocal,
        elapsedSec: visualTimeSec,
        id: npc.id,
      });
      if (lightingEnabled && sGlow.glowAlpha > 0) {
        entry.glowSprite.setPosition(npc.x, npc.y + 2);
        entry.glowSprite.setDisplaySize(sGlow.glowRadiusX * 2, sGlow.glowRadiusY * 2);
        entry.glowSprite.setTint(sGlow.colorNum);
        entry.glowSprite.setAlpha(sGlow.glowAlpha);
        entry.glowSprite.setVisible(true);
      } else {
        entry.glowSprite.setVisible(false);
      }
    }

    if (
      (npc.kind === 'daedalus_anvil' || npc.kind === 'upgrade_anvil') &&
      target?.kind !== npc.kind &&
      !(npc.usedByPlayerIds?.includes(sim.player.id) ?? false)
    ) {
      const isEn = i18n.getLocale() === 'en';
      const anvilTitle =
        npc.kind === 'daedalus_anvil'
          ? isEn
            ? 'Ancient Daedalus Anvil'
            : 'Đe Rèn Cổ Đại'
          : isEn
            ? 'Upgrade Anvil (+1)'
            : 'Đe Nâng Cấp (+1)';
      if (entry.label.text !== anvilTitle) entry.label.setText(anvilTitle);
      entry.label.setVisible(true);
    } else {
      entry.label.setVisible(false);
    }
  }

  for (const [id, entry] of this.npcVisuals.entries()) {
    if (!this.activeNpcIds.has(id)) {
      entry.rig?.destroy();
      entry.sprite?.destroy();
      entry.glowSprite.destroy();
      entry.label.destroy();
      this.npcVisuals.delete(id);
    }
  }

  // 6. Current [E] Target Luminous Outline Highlight (viền sáng) & Single Rounded-Pill [E] Prompt
  const promptSpec = resolveInteractPromptSpec(sim, target, {
    weaponComparisonVisible,
  });
  if (
    promptSpec &&
    promptSpec.kind === 'world_item' &&
    activeWorldItemRenderX !== null &&
    activeWorldItemRenderY !== null
  ) {
    promptSpec.targetX = activeWorldItemRenderX;
    promptSpec.targetY = activeWorldItemRenderY;
    promptSpec.x = activeWorldItemRenderX;
    promptSpec.y = activeWorldItemRenderY - 26;
  }

  const hg = this.interactHighlightGraphics;
  if (hg) {
    hg.clear();
    if (promptSpec) {
      const pulse = 0.5 + 0.5 * Math.sin(visualTimeSec * 5.2);
      const rx = promptSpec.highlightRadiusX + pulse * 1.5;
      const ry = promptSpec.highlightRadiusY + pulse * 1.2;
      const cx = promptSpec.targetX;
      const cy = promptSpec.targetY;
      // Outer colored luminous halo ring
      hg.lineStyle(3.6, promptSpec.colorNum, 0.34 + 0.04 * pulse);
      hg.strokeEllipse(cx, cy, rx * 2, ry * 2);
      // Inner crisp ivory-white outline contour (viền sáng)
      hg.lineStyle(1.8, 0xfffdf5, 0.8 + 0.08 * pulse);
      hg.strokeEllipse(cx, cy, (rx - 1.5) * 2, (ry - 1.2) * 2);
      // 4 cardinal accent ticks around the contour
      hg.lineStyle(2.0, promptSpec.colorNum, 0.72);
      hg.lineBetween(cx - rx - 4, cy, cx - rx + 2, cy);
      hg.lineBetween(cx + rx - 2, cy, cx + rx + 4, cy);
      hg.lineBetween(cx, cy - ry - 4, cx, cy - ry + 2);
      hg.lineBetween(cx, cy + ry - 2, cx, cy + ry + 4);
    }
    drawWorldWeaponSalvageRing(hg, sim, sim.player, visualTimeSec);
  }

  syncWorldInteractPromptPill(this, dtSec, promptSpec, debug.overlayVisible);
}
