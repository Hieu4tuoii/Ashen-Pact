import {
  clamp,
  ENEMIES,
  ENEMY_SPAWN_WARMUP_SEC,
  i18n,
  LocalTransport,
  PLAYER_SLOT_COLORS,
  QUICK_EMOTES_VI,
  type SimEnemyState,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { CutoutRig } from '../../art/cutout-rig.js';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { RIG_DEFS_BY_ID, VANGUARD_RIG_DEF } from '../../art/rig-defs.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';

export function updatePlayerOverheadUiImpl(
  this: GameScene,
  p: ReturnType<LocalTransport['getSim']>['player'],
  x: number,
  y: number,
  nameLabel?: Phaser.GameObjects.Text,
  emoteLabel?: Phaser.GameObjects.Text,
  emoteBg?: Phaser.GameObjects.Graphics,
): void {
  const sim = this.transport.getSim();
  const showName =
    !sim.stressTestActive &&
    (this.coopMode !== 'solo' ||
      sim.inHub ||
      sim.getActivePlayerCount() > 1 ||
      p.lifeState !== 'alive');

  const view = this.cameras.main.worldView;
  const safeTopY = (view && view.width > 0 ? view.y : 0) + 84;
  const placeBelow = y - 26 < safeTopY;
  const nameY = placeBelow ? y + 24 : y - 26;
  const emoteY = placeBelow ? y + 42 : Math.max(safeTopY + 12, y - 44);

  if (nameLabel) {
    if (!showName) {
      nameLabel.setVisible(false);
    } else {
      nameLabel.setVisible(true);
      let statusSuffix = '';
      if (p.lifeState === 'downed') {
        const revPct = Math.round(p.reviveProgress * 100);
        statusSuffix =
          revPct > 0
            ? ` · ${i18n.t('ui.hud.reviving')} ${revPct}%`
            : ` · ${i18n.t('ui.hud.downed')} (${Math.ceil(p.downedTimer)}s) ${i18n.t('ui.hud.holdEToRevive')}`;
      } else if (p.lifeState === 'ghost') {
        statusSuffix = ` · ${i18n.t('ui.hud.ghost')}`;
      } else if (sim.inHub && p.ready) {
        statusSuffix = ' · ✓';
      }
      const labelStr = `[P${p.slot}] ${p.displayName}${statusSuffix}`;
      if (nameLabel.text !== labelStr) {
        nameLabel.setText(labelStr);
      }
      const slotCol =
        p.lifeState === 'downed'
          ? PALETTE.CRIMSON_BRIGHT
          : p.lifeState === 'ghost'
            ? PALETTE.CYAN_FROST
            : PLAYER_SLOT_COLORS[p.slot];
      nameLabel.setColor(slotCol);
      nameLabel.setPosition(x, nameY);
    }
  }

  if (emoteLabel && emoteBg) {
    emoteBg.clear();
    if (p.emoteTimer > 0 && p.emoteId) {
      const emoteStr = `💬 ${i18n.emoteText(p.emoteId) || QUICK_EMOTES_VI[p.emoteId]}`;
      if (emoteLabel.text !== emoteStr) {
        emoteLabel.setText(emoteStr);
      }
      emoteLabel.setVisible(true);
      emoteLabel.setPosition(x, emoteY);
      const bw = Math.max(76, emoteStr.length * 6.5 + 16);
      const bh = 20;
      emoteBg.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
      emoteBg.lineStyle(2, hexToNum(PLAYER_SLOT_COLORS[p.slot]), 1);
      emoteBg.fillRoundedRect(x - bw / 2, emoteY - bh / 2, bw, bh, 6);
      emoteBg.strokeRoundedRect(x - bw / 2, emoteY - bh / 2, bw, bh, 6);
    } else {
      emoteLabel.setVisible(false);
    }
  }
}

export function resolvePlayerStatusTintImpl(this: GameScene): number | null {
  const p = this.transport.getSim().player;
  if (p.burnTimer > 0) return 0xfb923c;
  if (p.chillTimer > 0) return 0x38bdf8;
  if (p.poisonTimer > 0) return 0xc084fc;
  return null;
}

export function resolveEnemyStatusTintImpl(this: GameScene, e: SimEnemyState): number | null {
  if (e.frozenTimer > 0) return 0x7dd3fc;
  if (e.shockTimer > 0) return 0xfde047;
  if (e.burnTimer > 0) return 0xfb923c;
  if (e.chillStacks > 0) return 0x38bdf8;
  if (e.poisonStacks > 0) return 0xc084fc;
  return null;
}

export function syncSimulatedPlayersImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  const textRes = TextureBaker.getBakeScale();
  this.activeSimPlayerIds.clear();
  this.activeCoopPlayerIds.clear();

  if (sim.stressTestActive) {
    // 1. Stress test simulated players
    for (let i = 0; i < sim.simulatedPlayers.length; i++) {
      const sp = sim.simulatedPlayers[i]!;
      this.activeSimPlayerIds.add(sp.id);

      let rig = this.simPlayerRigs.get(sp.id);
      if (!rig) {
        rig = new CutoutRig(this, sp.x, sp.y + RIG_FOOT_OFFSET_Y, VANGUARD_RIG_DEF, {
          playerSlot: sp.slot,
          displayScale: 1,
          initialPhaseOffset: sp.slot * 0.3,
        });
        rig.container.setDepth(29);
        this.simPlayerRigs.set(sp.id, rig);
      }

      const pos = this.transport.getInterpolatedSimPlayerPos(sp, this.entityPosScratch);
      rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
      rig.setAimAngle(sp.aimAngle);
      const spWeaponId = sp.weaponSlots[sp.activeWeaponSlot] ?? 'rusty_pistol';
      rig.setEquippedWeapon(spWeaponId);
      rig.setAnimState('run');
      rig.update(dtSec);
    }
  } else {
    // 2. Co-op LAN teammates (sim.simulatedPlayers when not in stress test)
    for (let i = 0; i < sim.simulatedPlayers.length; i++) {
      const cp = sim.simulatedPlayers[i]!;
      if (cp.id === sim.player.id) continue;
      this.activeCoopPlayerIds.add(cp.id);

      const charRigDef = RIG_DEFS_BY_ID[cp.characterId] ?? VANGUARD_RIG_DEF;
      let entry = this.coopPlayerRigs.get(cp.id);
      if (!entry) {
        const rig = new CutoutRig(this, cp.x, cp.y + RIG_FOOT_OFFSET_Y, charRigDef, {
          playerSlot: cp.slot,
          displayScale: 1,
          initialPhaseOffset: cp.slot * 0.25,
        });
        rig.container.setDepth(29);

        const nameLabel = this.add
          .text(cp.x, cp.y - 26, '', {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10px',
            fontStyle: '800',
            color: PLAYER_SLOT_COLORS[cp.slot],
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(48);

        const emoteBg = this.add.graphics().setDepth(49);
        const emoteLabel = this.add
          .text(cp.x, cp.y - 44, '', {
            fontFamily: '"Be Vietnam Pro", sans-serif',
            fontSize: '10.5px',
            fontStyle: '800',
            color: PALETTE.BONE_WHITE,
            stroke: PALETTE.INK_DEEP,
            strokeThickness: 3,
            resolution: textRes,
          })
          .setOrigin(0.5, 0.5)
          .setDepth(50)
          .setVisible(false);

        entry = { rig, nameLabel, emoteLabel, emoteBg };
        this.coopPlayerRigs.set(cp.id, entry);
      }

      const pos = this.transport.getInterpolatedSimPlayerPos(cp, this.entityPosScratch);

      entry.rig.setRigDef(charRigDef);
      entry.rig.setPlayerSlot(cp.slot);
      entry.rig.setLifeState(cp.lifeState);
      entry.rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
      entry.rig.setAimAngle(cp.aimAngle);
      const cpWeaponId = cp.weaponSlots[cp.activeWeaponSlot] ?? 'rusty_pistol';
      entry.rig.setEquippedWeapon(cpWeaponId);
      const moving = Math.hypot(cp.vx, cp.vy) > 10;
      entry.rig.setAnimState(moving ? 'run' : 'idle');
      entry.rig.update(dtSec);

      this.updatePlayerOverheadUi(
        cp,
        pos.x,
        pos.y,
        entry.nameLabel,
        entry.emoteLabel,
        entry.emoteBg,
      );

      if (
        sim.currentBiome === 2 &&
        !sim.stressTestActive &&
        cp.lifeState === 'alive' &&
        (sim.tick + cp.slot * 23) % 90 === 0
      ) {
        this.fx.spawnFrostBreath(pos.x, pos.y, entry.rig.getFacingSign());
      }
    }
  }

  for (const [id, rig] of this.simPlayerRigs.entries()) {
    if (!this.activeSimPlayerIds.has(id)) {
      rig.destroy();
      this.simPlayerRigs.delete(id);
    }
  }

  for (const [id, entry] of this.coopPlayerRigs.entries()) {
    if (!this.activeCoopPlayerIds.has(id)) {
      entry.rig.destroy();
      entry.nameLabel.destroy();
      entry.emoteLabel.destroy();
      entry.emoteBg.destroy();
      this.coopPlayerRigs.delete(id);
    }
  }
}

export function syncEnemyRigsImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  this.activeEnemyIds.clear();
  const useFastComposite = sim.stressTestActive || sim.enemies.length > 24;
  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const viewLeft = hasView ? view.x - 48 : -9999;
  const viewRight = hasView ? view.x + view.width + 48 : 9999;
  const viewTop = hasView ? view.y - 48 : -9999;
  const viewBottom = hasView ? view.y + view.height + 48 : 9999;

  for (let i = 0; i < sim.enemies.length; i++) {
    const e = sim.enemies[i]!;
    if (e.hp <= 0) continue;
    this.activeEnemyIds.add(e.id);

    let rig = this.enemyRigs.get(e.id);
    if (!rig) {
      const rigDef = RIG_DEFS_BY_ID[e.defId] ?? RIG_DEFS_BY_ID.goblin_shooter!;
      rig = new CutoutRig(this, e.x, e.y + RIG_FOOT_OFFSET_Y, rigDef, {
        displayScale: e.isElite && !e.isBoss ? 1.22 : 1,
        initialPhaseOffset: (e.id % 7) * 0.25,
        fastComposite: useFastComposite,
      });
      rig.container.setDepth(e.defId === 'ice_prison' ? 32 : e.isBoss ? 31 : 28);
      this.enemyRigs.set(e.id, rig);
    }

    // Mirror clones (kryssa_clone) have no ground shadow so observant players can distinguish real vs illusion!
    rig.setShadowVisible(!ENEMIES[e.defId]?.isIllusion);

    if (e.bossBurrowed) {
      rig.container.setVisible(false);
      continue;
    }

    const pos = this.transport.getInterpolatedEnemyPos(e, this.entityPosScratch);
    const inView =
      pos.x >= viewLeft && pos.x <= viewRight && pos.y >= viewTop && pos.y <= viewBottom;
    rig.container.setVisible(inView);
    if (!inView) continue;

    rig.container.setPosition(pos.x, pos.y + RIG_FOOT_OFFSET_Y);
    rig.setAimAngle(e.aimAngle);
    rig.setElementalStatusTint(this.resolveEnemyStatusTint(e));

    if (e.aiState === 'spawning') {
      const spawnProgress = 1 - clamp(e.stateTimer / ENEMY_SPAWN_WARMUP_SEC, 0, 1);
      rig.setSpawnProgress(spawnProgress);
    } else {
      rig.setSpawnProgress(1);
    }

    if (e.aiState === 'telegraph' && e.telegraphDurationSec > 0) {
      const teleProgress = 1 - clamp(e.stateTimer / e.telegraphDurationSec, 0, 1);
      rig.setTelegraphProgress(teleProgress);
    } else {
      rig.setTelegraphProgress(0);
    }

    const moving = e.frozenTimer <= 0 && Math.hypot(e.vx, e.vy) > 10;
    rig.setAnimState(moving ? 'run' : 'idle');
    if (!sim.stressTestActive || (i + sim.tick) % 2 === 0) {
      rig.update(sim.stressTestActive ? dtSec * 2 : dtSec);
    }
  }

  for (const [id, rig] of this.enemyRigs.entries()) {
    if (!this.activeEnemyIds.has(id)) {
      rig.destroy();
      this.enemyRigs.delete(id);
    }
  }
}

export function syncPropsImpl(this: GameScene, dtSec: number): void {
  const sim = this.transport.getSim();
  const invBake = 1 / TextureBaker.getBakeScale();
  this.activePropIds.clear();

  for (let i = 0; i < sim.props.length; i++) {
    const prop = sim.props[i]!;
    if (prop.hp <= 0) continue;
    this.activePropIds.add(prop.id);

    let pv = this.propVisuals.get(prop.id);
    if (!pv) {
      const shadow = this.add.sprite(prop.x, prop.y + 9, 'prop_shadow');
      shadow.setScale(invBake);
      shadow.setDepth(18);

      const sprite = this.add.sprite(prop.x, prop.y, TextureBaker.getPropTextureKey(prop.kind));
      sprite.setScale(invBake);
      sprite.setDepth(22);

      pv = {
        sprite,
        shadow,
        kind: prop.kind,
        lastHp: prop.hp,
        flashTimer: 0,
        isFlashed: false,
      };
      this.propVisuals.set(prop.id, pv);
    }

    if (prop.hp < pv.lastHp || prop.hitFlashTimer > 0) {
      pv.lastHp = prop.hp;
      pv.flashTimer = Math.max(pv.flashTimer, 0.09);
    }

    if (pv.flashTimer > 0) {
      pv.flashTimer = Math.max(0, pv.flashTimer - dtSec);
      if (!pv.isFlashed) {
        pv.sprite.setTintFill(0xf4f1ea);
        pv.isFlashed = true;
      }
    } else if (pv.isFlashed) {
      pv.sprite.clearTint();
      pv.isFlashed = false;
    }
  }

  for (const [id, pv] of this.propVisuals.entries()) {
    if (!this.activePropIds.has(id)) {
      pv.sprite.destroy();
      pv.shadow.destroy();
      this.propVisuals.delete(id);
    }
  }
}

export function syncProjectilesAndPickupsImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const invBake = 1 / TextureBaker.getBakeScale();
  const stressInvBake = 1 / Math.min(2, TextureBaker.getBakeScale());
  const teammateOpacity = graphicsSettings.getState().teammateFxOpacity;
  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const viewLeft = hasView ? view.x - 24 : -9999;
  const viewRight = hasView ? view.x + view.width + 24 : 9999;
  const viewTop = hasView ? view.y - 24 : -9999;
  const viewBottom = hasView ? view.y + view.height + 24 : 9999;

  // 1. Projectiles (object-pooled Sprites)
  const isStress = sim.stressTestActive;
  const projScale = isStress ? stressInvBake : invBake;
  this.activeProjIds.clear();
  for (let i = 0; i < sim.projectiles.length; i++) {
    const b = sim.projectiles[i]!;
    this.activeProjIds.add(b.id);

    let tex = 'proj_player_bolt';
    let tint = 0xffffff;
    if (isStress) {
      if (b.team === 'enemy') {
        tex = 'proj_stress_enemy';
      } else {
        tex = 'proj_stress_player';
        if (b.element === 'burn') tint = 0xfb923c;
        else if (b.element === 'chill') tint = 0x38bdf8;
        else if (b.element === 'shock') tint = 0xfde047;
        else if (b.element === 'poison') tint = 0x4ade80;
        else if (b.weaponId === 'scrap_shotgun') tint = 0xfacc15;
        else tint = 0x7dd3fc;
      }
    } else if (b.team === 'enemy') {
      tex = 'proj_enemy_orb';
      if (b.element === 'chill') tint = 0x7dd3fc;
      else if (b.element === 'burn') tint = 0xfb923c;
      else if (b.element === 'shock') tint = 0xfde047;
    } else if (b.element === 'burn') {
      tex = 'proj_player_burn';
    } else if (b.element === 'chill') {
      tex = 'proj_player_chill';
    } else if (b.element === 'shock') {
      tex = 'proj_player_shock';
    } else if (b.element === 'poison') {
      tex = 'proj_player_poison';
    } else if (b.weaponId === 'scrap_shotgun') {
      tex = 'proj_player_pellet';
    }

    let entry = this.projectileSprites.get(b.id);
    if (!entry) {
      const pooled = this.projectileSpritePool.pop();
      if (pooled) {
        entry = pooled;
        if (entry.textureKey !== tex) {
          entry.textureKey = tex;
          entry.sprite.setTexture(tex);
        }
        entry.sprite.setActive(true);
      } else {
        const sprite = this.add.sprite(b.x, b.y, tex);
        sprite.setDepth(42);
        entry = { sprite, textureKey: tex };
      }
      entry.sprite.setScale(projScale);
      this.projectileSprites.set(b.id, entry);
    } else if (entry.textureKey !== tex) {
      entry.textureKey = tex;
      entry.sprite.setTexture(tex);
      entry.sprite.setScale(projScale);
    }

    const pos = this.transport.getInterpolatedProjectilePos(b, this.entityPosScratch);
    const inView =
      pos.x >= viewLeft && pos.x <= viewRight && pos.y >= viewTop && pos.y <= viewBottom;
    entry.sprite.setVisible(inView);
    if (inView) {
      if (tint === 0xffffff) {
        entry.sprite.clearTint();
      } else {
        entry.sprite.setTint(tint);
      }
      const isTeammateBullet = b.team === 'player' && b.ownerId !== sim.player.id;
      entry.sprite.setAlpha(isTeammateBullet ? teammateOpacity : 1.0);
      entry.sprite.setPosition(pos.x, pos.y);
      entry.sprite.setRotation(b.team === 'enemy' ? 0 : b.angle);
    }
  }

  for (const [id, entry] of this.projectileSprites.entries()) {
    if (!this.activeProjIds.has(id)) {
      entry.sprite.setVisible(false);
      entry.sprite.setActive(false);
      this.projectileSpritePool.push(entry);
      this.projectileSprites.delete(id);
    }
  }

  // 2. Pickups (Energy & Gold, object-pooled Sprites, instanced per player)
  this.activePickupIds.clear();
  for (let i = 0; i < sim.pickups.length; i++) {
    const pk = sim.pickups[i]!;
    if (
      pk.ownerPlayerId !== undefined &&
      pk.ownerPlayerId !== 0 &&
      pk.ownerPlayerId !== sim.player.id
    ) {
      continue;
    }
    this.activePickupIds.add(pk.id);

    let entry = this.pickupSprites.get(pk.id);
    const tex =
      pk.kind === 'energy'
        ? 'fx_pickup_energy'
        : pk.kind === 'life_seed'
          ? 'fx_ambient_leaf'
          : 'fx_pickup_gold';
    if (!entry) {
      const pooled = this.pickupSpritePool.pop();
      if (pooled) {
        entry = pooled;
        if (entry.textureKey !== tex) {
          entry.textureKey = tex;
          entry.sprite.setTexture(tex);
        }
        entry.sprite.setVisible(true);
        entry.sprite.setActive(true);
      } else {
        const sprite = this.add.sprite(pk.x, pk.y, tex);
        sprite.setDepth(25);
        entry = { sprite, textureKey: tex };
      }
      entry.sprite.setScale(invBake * (pk.kind === 'life_seed' ? 1.35 : 1));
      this.pickupSprites.set(pk.id, entry);
    } else if (entry.textureKey !== tex) {
      entry.textureKey = tex;
      entry.sprite.setTexture(tex);
      entry.sprite.setScale(invBake * (pk.kind === 'life_seed' ? 1.35 : 1));
    }

    if (pk.kind === 'life_seed') {
      entry.sprite.setTint(hexToNum(PALETTE.LIME_GLOW));
    } else {
      entry.sprite.clearTint();
    }
    const pos = this.transport.getInterpolatedPickupPos(pk, this.entityPosScratch);
    entry.sprite.setPosition(pos.x, pos.y);
  }

  for (const [id, entry] of this.pickupSprites.entries()) {
    if (!this.activePickupIds.has(id)) {
      entry.sprite.setVisible(false);
      entry.sprite.setActive(false);
      this.pickupSpritePool.push(entry);
      this.pickupSprites.delete(id);
    }
  }
}
