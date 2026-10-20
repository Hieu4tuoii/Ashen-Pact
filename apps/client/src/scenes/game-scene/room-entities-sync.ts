import {
  CHARACTERS,
  clamp,
  i18n,
  PLAYER_SLOT_COLORS,
  WEAPON_RARITY_COLORS,
} from '@ashen-pact/shared';
import { CutoutRig } from '../../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { MERCHANT_RIG_DEF, RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';

export function syncRoomEntitiesImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;

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

        entry = { rig, label, subLabel };
        this.hubStatueRigs.set(st.characterId, entry);
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
      label.setPosition(ping.x, ping.y - 26 - Math.sin(sim.tick * 0.15) * 3);
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

      entry = { sprite, label };
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
  }

  for (const [id, sprite] of this.chestSprites.entries()) {
    if (!this.activeChestIds.has(id)) {
      sprite.destroy();
      this.chestSprites.delete(id);
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
      const glow = this.add.graphics();
      glow.setDepth(35);
      glow.setBlendMode(Phaser.BlendModes.ADD);
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

      entry = { sprite, glow, label };
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
        arcOffsetY = Math.sin(sim.tick * 0.08 + it.id) * 2.5;
      }
    } else {
      entry.sprite.setRotation(0);
      arcOffsetY = Math.sin(sim.tick * 0.08 + it.id) * 2.5;
    }

    const glowColor = hexToNum(WEAPON_RARITY_COLORS[it.rarity]);
    const pulse = 0.75 + Math.sin(sim.tick * 0.1 + it.id) * 0.25;
    entry.glow.clear();
    entry.glow.fillStyle(glowColor, 0.22 * pulse);
    entry.glow.fillEllipse(renderX, renderY + 6, 26, 11);
    entry.glow.lineStyle(1.4, glowColor, 0.45 * pulse);
    entry.glow.strokeEllipse(renderX, renderY + 6, 24, 9);
    entry.glow.fillStyle(glowColor, 0.14 * pulse);
    entry.glow.fillCircle(renderX, renderY + arcOffsetY, 14);
    entry.sprite.setPosition(renderX, renderY + arcOffsetY);
    entry.label.setPosition(renderX, renderY - 24 + arcOffsetY * 0.5);
    entry.label.setVisible(!(sim.inHub && previewOpen) && it.id !== comparedWeaponItemId);
  }

  for (const [id, entry] of this.worldItemSprites.entries()) {
    if (!this.activeWorldItemIds.has(id)) {
      entry.sprite.destroy();
      entry.label.destroy();
      entry.glow.destroy();
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
        entry = { rig, label };
      } else {
        const sprite = this.add.sprite(npc.x, npc.y, 'prop_shrine_statue');
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
        entry = { sprite, label };
      }
      this.npcVisuals.set(npc.id, entry);
    }

    if (entry.rig) {
      entry.rig.update(dtSec);
      if (npc.kind === 'merchant') {
        const mTxt = i18n.t('ui.hud.merchantName');
        if (entry.label.text !== mTxt) entry.label.setText(mTxt);
      }
    }
    if (npc.kind === 'shrine') {
      const shrineTxt = npc.interacted
        ? i18n.t('ui.hud.shrineUsed')
        : i18n.t('ui.hud.shrineActive');
      if (entry.label.text !== shrineTxt) {
        entry.label.setText(shrineTxt);
        entry.label.setColor(npc.interacted ? PALETTE.ASH_GRAY : PALETTE.CYAN_FROST);
      }
      entry.label.setPosition(npc.x, npc.y - 42);
    }
  }

  for (const [id, entry] of this.npcVisuals.entries()) {
    if (!this.activeNpcIds.has(id)) {
      entry.rig?.destroy();
      entry.sprite?.destroy();
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
    this.portalSprite.setScale(invBake * (1 + Math.sin(sim.tick * 0.1) * 0.06));
    this.portalSprite.setRotation(sim.tick * 0.03);

    this.portalLabel.setVisible(
      !(sim.inHub && initGlobalDebugState().hubPreviewCharacterId !== null),
    );
    this.portalLabel.setPosition(sim.portalX, sim.portalY - 38);
  } else {
    this.portalSprite?.setVisible(false);
    this.portalLabel?.setVisible(false);
  }
}
