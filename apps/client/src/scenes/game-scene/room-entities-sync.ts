import {
  CHARACTERS,
  clamp,
  i18n,
  PLAYER_SLOT_COLORS,
  WEAPON_RARITY_COLORS,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../../art/cutout-rig.js';
import { PALETTE } from '../../art/palette.js';
import { MERCHANT_RIG_DEF, RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { getVisualQueryConfig } from '../../core/visual-query.js';
import {
  resolveCurrentInteractHighlightTarget,
  resolveInteractableVisualGlowSpec,
} from '../../fx/lighting-config.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';

export function syncRoomEntitiesImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;
  const lightingEnabled = this.lighting?.isLightmapVisible() ?? true;
  const visualTimeSec = getVisualQueryConfig().freeze
    ? 1.0
    : (this.lighting?.getElapsedSec() ?? 1.0);

  // 0. Hub 5 Character Statues & Natural Hub Guidance Signs (Doanh Trại)
  const previewOpen = initGlobalDebugState().hubPreviewCharacterId !== null;
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
          .text(st.x, st.y - 30, `[E] ${charTxt.name}`, {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '800',
            color: PALETTE.SOLAR_GOLD,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(46);

        const subLabel = this.add
          .text(st.x, st.y + 23, `HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor}`, {
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
          .setDepth(46);

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

      const isSelectedByLocal = sim.player.characterId === st.characterId;
      const isInspecting = Math.hypot(sim.player.x - st.x, sim.player.y - st.y) <= 72;
      entry.label.setColor(isSelectedByLocal ? PALETTE.LIME_GLOW : PALETTE.SOLAR_GOLD);
      const selTag = i18n.getLocale() === 'en' ? 'Selected' : 'Đang Chọn';
      entry.label.setText(
        isSelectedByLocal ? `★ ${charTxt.name} (${selTag})` : `[E] ${charTxt.name}`,
      );
      const nextSub = `HP ${cDef.hp} · ${i18n.t('ui.hud.armor')} ${cDef.armor}`;
      if (entry.subLabel.text !== nextSub) {
        entry.subLabel.setText(nextSub);
      }
      entry.subLabel.setVisible(
        !isInspecting && !(previewOpen && st.y > sim.map.height * 0.5 - 120),
      );
      entry.rig.update(dtSec);
    }

    // Natural Hub Guidance Signs (Statues Arc, Weapon Rack, Training Dummy live DPS)
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
      text: string;
      color: string;
      visible: boolean;
    }[] = [
      {
        x: hubCx - 125,
        y: hubCy - 142,
        text: i18n.t('ui.hubGuide.statuesSign'),
        color: PALETTE.CYAN_FROST,
        visible: !previewOpen,
      },
      {
        x: hubCx - 258,
        y: hubCy - 8,
        text: isEn
          ? '⚔ PRACTICE WEAPON RACK — Press [E] to Test & Compare'
          : '⚔ KỆ VŨ KHÍ THỬ NGHIỆM — Nhấn [E] Nhặt Thử & So Sánh',
        color: PALETTE.SOLAR_GOLD,
        visible: !previewOpen,
      },
      {
        x: dummySignX,
        y: hubCy + 42,
        text: isEn
          ? `🎯 Training Dummy · DPS: ${sim.getRollingDps().toFixed(1)}`
          : `🎯 Bù Nhìn Tập Bắn · DPS: ${sim.getRollingDps().toFixed(1)}`,
        color: PALETTE.LIME_GLOW,
        visible: !dummyBlockedByInvite,
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
        gTxt.setColor(spec.color);
        gTxt.setPosition(spec.x, spec.y);
      }
      gTxt.setVisible(spec.visible);
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
      label.setColor(slotColor);
      label.setPosition(ping.x, ping.y - 26 - Math.sin(visualTimeSec * 9.0) * 3);
    }
  }
  for (const [id, label] of this.pingVisuals.entries()) {
    if (!this.activePingIds.has(id)) {
      label.destroy();
      this.pingVisuals.delete(id);
    }
  }

  // 1. Room Doors (North / South / East / West)
  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const bossActive = sim.getActiveBoss() !== null;
  const safeTopY = hasView ? view.y + (bossActive ? 122 : 82) : 82;
  const safeBottomY = hasView ? view.y + view.height - 66 : 474;
  const safeLeftX = hasView ? view.x + 18 : 18;
  const safeRightX = hasView ? view.x + view.width - 18 : 942;

  this.activeDoorKeys.clear();
  for (let i = 0; i < sim.doors.length; i++) {
    const door = sim.doors[i]!;
    const key = `${sim.currentFloor}_${sim.currentRoomId}_${door.dir}`;
    this.activeDoorKeys.add(key);

    const isOpen = !door.locked;
    const tex = isOpen ? 'door_open' : 'door_locked';
    const targetRoom = sim.dungeon.rooms.find((r) => r.id === door.targetRoomId);
    const roomLabel = targetRoom
      ? i18n.roomTypeName(targetRoom.type)
      : i18n.getLocale() === 'en'
        ? 'Room'
        : 'Phòng';
    const labelStr = isOpen ? `→ ${roomLabel}` : `🔒 ${roomLabel}`;
    const labelColor = isOpen ? PALETTE.LIME_GLOW : PALETTE.CRIMSON_BRIGHT;

    let entry = this.doorSprites.get(key);
    if (!entry) {
      const sprite = this.add.sprite(door.x, door.y, tex);
      sprite.setScale(invBake);
      sprite.setDepth(16);
      if (door.dir === 'E' || door.dir === 'W') {
        sprite.setRotation(Math.PI / 2);
      }

      const glowSprite = this.add.image(door.x, door.y, 'fx_light_radial');
      glowSprite.setDepth(35);
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);

      const originX = door.dir === 'E' ? 1 : door.dir === 'W' ? 0 : 0.5;
      const label = this.add
        .text(door.x, door.y, labelStr, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '800',
          color: labelColor,
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(originX, 0.5)
        .setDepth(45);

      entry = { sprite, glowSprite, label };
      this.doorSprites.set(key, entry);
    } else {
      if (entry.sprite.texture.key !== tex) {
        entry.sprite.setTexture(tex);
      }
      if (entry.label.text !== labelStr) {
        entry.label.setText(labelStr);
        entry.label.setColor(labelColor);
      }
    }

    const doorGlowSpec = resolveInteractableVisualGlowSpec({
      kind: 'door',
      locked: door.locked,
      biome: sim.currentBiome,
      inHub: sim.inHub,
    });
    if (lightingEnabled && doorGlowSpec.glowAlpha > 0) {
      entry.glowSprite.setPosition(door.x, door.y);
      entry.glowSprite.setDisplaySize(doorGlowSpec.glowRadiusX * 2, doorGlowSpec.glowRadiusY * 2);
      entry.glowSprite.setTint(doorGlowSpec.colorNum);
      entry.glowSprite.setAlpha(doorGlowSpec.glowAlpha);
      entry.glowSprite.setVisible(true);
    } else {
      entry.glowSprite.setVisible(false);
    }

    const rawLabelX = door.dir === 'W' ? door.x + 22 : door.dir === 'E' ? door.x - 22 : door.x;
    const rawLabelY =
      door.dir === 'N'
        ? door.y + 30
        : door.dir === 'S'
          ? door.y - 24
          : door.dir === 'E'
            ? Math.max(door.y - 24, hasView ? view.y + 194 : door.y - 24)
            : door.y - 24;
    entry.label.setPosition(
      clamp(rawLabelX, safeLeftX, safeRightX),
      clamp(rawLabelY, safeTopY, safeBottomY),
    );
  }

  for (const [key, entry] of this.doorSprites.entries()) {
    if (!this.activeDoorKeys.has(key)) {
      entry.sprite.destroy();
      entry.glowSprite.destroy();
      entry.label.destroy();
      this.doorSprites.delete(key);
    }
  }

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
    sprite.setPosition(ch.x, ch.y);

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

    if (lightingEnabled && chestGlowSpec.glowAlpha > 0) {
      glowSprite.setPosition(ch.x, ch.y + 2);
      glowSprite.setDisplaySize(chestGlowSpec.glowRadiusX * 2, chestGlowSpec.glowRadiusY * 2);
      glowSprite.setTint(chestGlowSpec.colorNum);
      glowSprite.setAlpha(chestGlowSpec.glowAlpha);
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
  let comparedWeaponItemId = -1;
  let bestWeaponDist = 64;
  if (sim.runState === 'playing' && !this.fullMapOpen) {
    for (let i = 0; i < sim.worldItems.length; i++) {
      const it = sim.worldItems[i]!;
      if (it.pickedUp || it.kind !== 'weapon' || !it.weaponId) continue;
      if (
        it.ownerPlayerId !== undefined &&
        it.ownerPlayerId !== 0 &&
        it.ownerPlayerId !== sim.player.id
      ) {
        continue;
      }
      const d = Math.hypot(sim.player.x - it.x, sim.player.y - it.y);
      if (d <= bestWeaponDist) {
        bestWeaponDist = d;
        comparedWeaponItemId = it.id;
      }
    }
  }

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
        : 'item_health_potion';
    const itemName =
      it.kind === 'weapon' && it.weaponId
        ? i18n.weaponName(it.weaponId, it.nameVi)
        : i18n.getLocale() === 'en'
          ? `Health Potion (+${it.healAmount || 3} HP)`
          : it.nameVi;
    const labelText =
      it.costGold > 0
        ? `[E] ${itemName} · ${it.costGold} ${i18n.t('ui.hud.gold')}`
        : `[E] ${itemName}`;

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
        .text(it.x, it.y - 24, labelText, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '800',
          color: WEAPON_RARITY_COLORS[it.rarity],
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(46);

      entry = { sprite, glowSprite, beamSprite, shopMatSprite, label };
      this.worldItemSprites.set(it.id, entry);
    } else {
      if (entry.sprite.texture.key !== tex) {
        entry.sprite.setTexture(tex);
      }
      if (entry.label.text !== labelText) {
        entry.label.setText(labelText);
      }
    }

    let renderX = it.x;
    let renderY = it.y;
    let arcOffsetY = 0;
    if (it.droppedAtTick !== undefined) {
      const ageSec = Math.max(0, (sim.tick - it.droppedAtTick) / 60);
      if (ageSec < 0.25) {
        const t = clamp(ageSec / 0.25, 0, 1);
        const startX = it.fromX ?? it.x;
        const startY = it.fromY ?? it.y;
        renderX = startX + (it.x - startX) * t;
        renderY = startY + (it.y - startY) * t;
        const bounceY =
          t < 0.72
            ? -Math.sin((t / 0.72) * Math.PI) * 18
            : -Math.sin(((t - 0.72) / 0.28) * Math.PI) * 5;
        arcOffsetY = bounceY;
        entry.sprite.setRotation(Math.sin(t * Math.PI * 2) * 0.28);
      } else {
        entry.sprite.setRotation(0);
        arcOffsetY = Math.sin(visualTimeSec * 4.8 + it.id) * 2.5;
      }
    } else {
      entry.sprite.setRotation(0);
      arcOffsetY = Math.sin(visualTimeSec * 4.8 + it.id) * 2.5;
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
    entry.label.setPosition(renderX, renderY - 24 + arcOffsetY * 0.5);
    const distToPlayer = Math.hypot(sim.player.x - renderX, sim.player.y - renderY);
    entry.label.setVisible(
      distToPlayer <= 72 &&
        !(sim.inHub && previewOpen) &&
        it.id !== comparedWeaponItemId,
    );
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
        const shrineTex = npc.interacted ? 'prop_shrine_statue_used' : 'prop_shrine_statue';
        const sprite = this.add.sprite(npc.x, npc.y, shrineTex);
        sprite.setScale(invBake);
        sprite.setDepth(24);
        const label = this.add
          .text(npc.x, npc.y - 42, i18n.t('ui.hud.shrineActive'), {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '11px',
            fontStyle: '800',
            color: PALETTE.CYAN_FROST,
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
    if (npc.kind === 'shrine') {
      const shrineTex = npc.interacted ? 'prop_shrine_statue_used' : 'prop_shrine_statue';
      if (entry.sprite && entry.sprite.texture.key !== shrineTex) {
        entry.sprite.setTexture(shrineTex);
      }
      const shrineTxt = npc.interacted
        ? i18n.t('ui.hud.shrineUsed')
        : i18n.t('ui.hud.shrineActive');
      if (entry.label.text !== shrineTxt) {
        entry.label.setText(shrineTxt);
        entry.label.setColor(npc.interacted ? PALETTE.ASH_GRAY : PALETTE.CYAN_FROST);
      }
      entry.label.setPosition(npc.x, npc.y - 42);

      const sGlow = resolveInteractableVisualGlowSpec({
        kind: 'shrine',
        interacted: npc.interacted,
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

    const npcDist = Math.hypot(sim.player.x - npc.x, sim.player.y - npc.y);
    entry.label.setVisible(npcDist <= 72);
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

  // 5. Floor Transition Portal (or Hub Departure Portal)
  if (sim.portalActive) {
    if (!this.portalSprite) {
      this.portalSprite = this.add.sprite(sim.portalX, sim.portalY, 'portal_active');
      this.portalSprite.setDepth(19);
    }
    if (!this.portalGlowSprite) {
      this.portalGlowSprite = this.add.image(sim.portalX, sim.portalY, 'fx_light_radial');
      this.portalGlowSprite.setDepth(35);
      this.portalGlowSprite.setBlendMode(Phaser.BlendModes.ADD);
    }
    const portalText = sim.inHub
      ? sim.areAllPlayersReady()
        ? i18n.t('ui.hud.portalHubReady')
        : i18n.t('ui.hud.portalHubWait')
      : i18n.t('ui.hud.portalNextFloor');
    if (!this.portalLabel) {
      this.portalLabel = this.add
        .text(sim.portalX, sim.portalY - 38, portalText, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11px',
          fontStyle: '800',
          color: PALETTE.ELECTRIC_VIOLET,
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3.5,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5)
        .setDepth(46);
    } else if (this.portalLabel.text !== portalText) {
      this.portalLabel.setText(portalText);
    }
    this.portalSprite.setVisible(true);
    this.portalSprite.setPosition(sim.portalX, sim.portalY);
    this.portalSprite.setScale(invBake * (1 + Math.sin(visualTimeSec * 6.0) * 0.06));
    this.portalSprite.setRotation(visualTimeSec * 1.8);

    const pGlow = resolveInteractableVisualGlowSpec({
      kind: 'portal',
      active: true,
      inHub: sim.inHub,
      hubReady: sim.areAllPlayersReady(),
      elapsedSec: visualTimeSec,
    });
    if (lightingEnabled && pGlow.glowAlpha > 0) {
      this.portalGlowSprite.setPosition(sim.portalX, sim.portalY);
      this.portalGlowSprite.setDisplaySize(pGlow.glowRadiusX * 2, pGlow.glowRadiusY * 2);
      this.portalGlowSprite.setTint(pGlow.colorNum);
      this.portalGlowSprite.setAlpha(pGlow.glowAlpha);
      this.portalGlowSprite.setVisible(true);
    } else {
      this.portalGlowSprite.setVisible(false);
    }

    const portalDist = Math.hypot(sim.player.x - sim.portalX, sim.player.y - sim.portalY);
    this.portalLabel.setVisible(
      portalDist <= 72 &&
        !(sim.inHub && initGlobalDebugState().hubPreviewCharacterId !== null),
    );
    this.portalLabel.setPosition(sim.portalX, sim.portalY - 38);
  } else {
    this.portalSprite?.setVisible(false);
    this.portalGlowSprite?.setVisible(false);
    this.portalLabel?.setVisible(false);
  }

  // 6. Current [E] Target Luminous Outline Highlight (viền sáng)
  const hg = this.interactHighlightGraphics;
  if (hg) {
    hg.clear();
    const hasEngineer = sim
      .getAllPlayers()
      .some((pl) => pl.characterId === 'engineer' && pl.lifeState === 'alive');
    const target = resolveCurrentInteractHighlightTarget({
      playerX: sim.player.x,
      playerY: sim.player.y,
      playerId: sim.player.id,
      weaponPickupLockTimer: sim.player.weaponPickupLockTimer ?? 0,
      hasEngineerInParty: hasEngineer,
      inHub: sim.inHub,
      hubReady: sim.areAllPlayersReady(),
      biome: sim.currentBiome,
      hubStatues: sim.hubStatues,
      props: sim.props,
      chests: sim.chests,
      worldItems: sim.worldItems,
      npcEntities: sim.npcEntities,
      portalActive: sim.portalActive,
      portalX: sim.portalX,
      portalY: sim.portalY,
      doors: sim.doors,
    });
    if (target) {
      const pulse = 0.5 + 0.5 * Math.sin(visualTimeSec * 5.2);
      const rx = target.radiusX + pulse * 1.5;
      const ry = target.radiusY + pulse * 1.2;
      const cx = target.x;
      const cy = target.y;
      // Outer colored luminous halo ring
      hg.lineStyle(3.6, target.colorNum, 0.34 + 0.04 * pulse);
      hg.strokeEllipse(cx, cy, rx * 2, ry * 2);
      // Inner crisp ivory-white outline contour (viền sáng)
      hg.lineStyle(1.8, 0xfffdf5, 0.8 + 0.08 * pulse);
      hg.strokeEllipse(cx, cy, (rx - 1.5) * 2, (ry - 1.2) * 2);
      // 4 cardinal accent ticks around the contour
      hg.lineStyle(2.0, target.colorNum, 0.72);
      hg.lineBetween(cx - rx - 4, cy, cx - rx + 2, cy);
      hg.lineBetween(cx + rx - 2, cy, cx + rx + 4, cy);
      hg.lineBetween(cx, cy - ry - 4, cx, cy - ry + 2);
      hg.lineBetween(cx, cy + ry - 2, cx, cy + ry + 4);
    }
  }
}
