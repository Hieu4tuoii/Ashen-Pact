import {
  clamp,
  i18n,
  type InteractTargetResult,
} from '@ashen-pact/shared';
import Phaser from 'phaser';
import { ENV_PALETTE, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { zzfx } from '../../audio/zzfx.js';
import { resetClientFreezeRandom } from '../../core/visual-query.js';
import { resolveInteractableVisualGlowSpec } from '../../fx/lighting-config.js';
import {
  computeDoorMotePose,
  computePortalEnergyRayPose,
  computePortalSpiralParticlePose,
  createDoorAnimState,
  createPortalAnimState,
  DOOR_BARRIER_PIPELINE_KEY,
  DOOR_COMBAT_LOCKUP_DURATION_SEC,
  DOOR_UNLOCK_DISSOLVE_DURATION_SEC,
  type DoorAnimState,
  type DoorAnimStepResult,
  type DoorShaderSprite,
  type DoorVisualState,
  ensurePortalAndDoorPipelinesRegistered,
  PORTAL_VORTEX_PIPELINE_KEY,
  type PortalAnimStepResult,
  type PortalDoorParticlePose,
  type PortalShaderSprite,
  type PortalVisualState,
  type ResolveDoorVisualStateParams,
  type ResolvePortalVisualStateParams,
  resolveDoorVisualState,
  resolvePortalVisualState,
  stepDoorAnimState,
  stepPortalAnimState,
  triggerDoorCombatLockupState,
  triggerDoorUnlockDissolveState,
  triggerPortalActivationBurstState,
  triggerPortalEnterSequenceState,
} from '../../fx/portal-door-shaders.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import { resolveDoorLabelState } from './interact-prompt.js';

export interface PortalVisualGroup {
  pedestalBaseSprite: Phaser.GameObjects.Sprite;
  pedestalRunesSprite: Phaser.GameObjects.Sprite;
  vortexSprite: Phaser.GameObjects.Sprite;
  vortexCoreSprite: Phaser.GameObjects.Sprite;
  spiralParticles: Phaser.GameObjects.Image[];
  energyRays: Phaser.GameObjects.Image[];
  burstGraphics: Phaser.GameObjects.Graphics;
  glowSprite: Phaser.GameObjects.Image;
  playerTransformApplied: boolean;
}

export interface DoorVisualEntry {
  sprite: Phaser.GameObjects.Sprite;
  frameSprite: Phaser.GameObjects.Sprite;
  openArchSprite: Phaser.GameObjects.Sprite;
  barrierSprite: Phaser.GameObjects.Sprite;
  moteSprites: Phaser.GameObjects.Image[];
  glowSprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  animState: DoorAnimState;
  cachedRoomLabel: string;
  cachedLocale: string;
  cachedTargetRoomType: string;
}

const portalAnimParamsScratch = {
  dtSec: 0,
  roomKey: '',
  portalActive: false,
  inHub: false,
};
const portalAnimStepScratch = {} as PortalAnimStepResult;
const portalVisParamsScratch: ResolvePortalVisualStateParams = {
  inHub: false,
  hubReady: false,
  portalActive: false,
  roomType: 'start',
  quality: 'high',
  elapsedSec: 1.0,
  burstProgress: 0,
};
const portalVisScratch = {} as PortalVisualState;

const doorAnimParamsScratch = {
  dtSec: 0,
  locked: false,
};
const doorAnimStepScratch = {} as DoorAnimStepResult;
const doorVisParamsScratch: ResolveDoorVisualStateParams = {
  dir: 'N',
  locked: false,
  biome: 1,
  inHub: false,
  quality: 'high',
  lockupProgress: 1,
  dissolveProgress: 0,
  elapsedSec: 1.0,
};
const doorVisScratch = {} as DoorVisualState;
const particlePoseScratch: PortalDoorParticlePose = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  alpha: 1,
};

function getOrCreatePortalVisualGroup(scene: GameScene, x: number, y: number): PortalVisualGroup {
  if (scene.portalVisualGroup) {
    return scene.portalVisualGroup;
  }

  const pedestalBaseSprite = scene.add.sprite(x, y, 'portal_pedestal_base');
  pedestalBaseSprite.setDepth(18.6);

  const pedestalRunesSprite = scene.add.sprite(x, y, 'portal_pedestal_runes');
  pedestalRunesSprite.setDepth(18.8);
  pedestalRunesSprite.setBlendMode(Phaser.BlendModes.ADD);

  const vortexSprite = scene.add.sprite(x, y, 'portal_vortex_disc');
  vortexSprite.setDepth(19.1);
  (vortexSprite as PortalShaderSprite).__portalUniforms = {
    time: 0,
    spinSpeed: 2.6,
    activity: 1,
    pulse: 0.5,
    burstProgress: 0,
    outerRgb: [0.66, 0.33, 0.97],
    coreRgb: [0.13, 0.83, 0.93],
    rimRgb: [0.81, 0.98, 1.0],
  };

  const vortexCoreSprite = scene.add.sprite(x, y, 'portal_vortex_core');
  vortexCoreSprite.setDepth(19.2);
  vortexCoreSprite.setBlendMode(Phaser.BlendModes.ADD);

  const spiralParticles: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 12; i++) {
    const sp = scene.add.image(x, y, 'portal_particle_mote');
    sp.setDepth(19.4);
    sp.setBlendMode(Phaser.BlendModes.ADD);
    sp.setVisible(false);
    spiralParticles.push(sp);
  }

  const energyRays: Phaser.GameObjects.Image[] = [];
  for (let i = 0; i < 4; i++) {
    const ray = scene.add.image(x, y, 'portal_energy_ray');
    ray.setDepth(19.5);
    ray.setBlendMode(Phaser.BlendModes.ADD);
    ray.setVisible(false);
    energyRays.push(ray);
  }

  const burstGraphics = scene.add.graphics();
  burstGraphics.setDepth(35.4);
  burstGraphics.setBlendMode(Phaser.BlendModes.ADD);

  const glowSprite = scene.add.image(x, y, 'fx_light_radial');
  glowSprite.setDepth(35);
  glowSprite.setBlendMode(Phaser.BlendModes.ADD);

  const group: PortalVisualGroup = {
    pedestalBaseSprite,
    pedestalRunesSprite,
    vortexSprite,
    vortexCoreSprite,
    spiralParticles,
    energyRays,
    burstGraphics,
    glowSprite,
    playerTransformApplied: false,
  };
  scene.portalVisualGroup = group;
  scene.portalSprite = vortexSprite;
  scene.portalGlowSprite = glowSprite;
  return group;
}

function setPortalVisualGroupVisible(group: PortalVisualGroup, visible: boolean): void {
  group.pedestalBaseSprite.setVisible(visible);
  group.pedestalRunesSprite.setVisible(visible);
  group.vortexSprite.setVisible(visible);
  if (!visible) {
    group.vortexCoreSprite.setVisible(false);
    for (let i = 0; i < group.spiralParticles.length; i++) {
      group.spiralParticles[i]!.setVisible(false);
    }
    for (let i = 0; i < group.energyRays.length; i++) {
      group.energyRays[i]!.setVisible(false);
    }
    group.burstGraphics.clear();
    group.glowSprite.setVisible(false);
  }
}

export function syncPortalVisualsImpl(this: GameScene, animDtSec: number): void {
  const sim = this.transport.getSim();
  const invBake = 1 / TextureBaker.getBakeScale();
  const lightingEnabled = this.lighting?.isLightmapVisible() ?? true;
  const quality = graphicsSettings.getState().quality;

  if (animDtSec > 0) {
    this.portalDoorAnimClockSec += animDtSec;
  }
  const animTimeSec = this.portalDoorAnimClockSec;

  const initialRoomKey = sim.inHub ? 'hub' : `${sim.currentFloor}_${sim.currentRoomId}`;

  const shouldCommit = this.portalAnimState.pendingPortalCommit;
  portalAnimParamsScratch.dtSec = animDtSec;
  portalAnimParamsScratch.roomKey = initialRoomKey;
  portalAnimParamsScratch.portalActive = sim.portalActive;
  portalAnimParamsScratch.inHub = sim.inHub;
  const animStep = stepPortalAnimState(
    this.portalAnimState,
    portalAnimParamsScratch,
    portalAnimStepScratch,
  );
  const isBursting = animStep.burstProgress > 0 && animStep.burstProgress < 1;

  if (animStep.enterCompleted) {
    this.portalAnimState.pendingPortalCommit = false;
    if (this.playerRig) {
      this.playerRig.container.setScale(1, 1);
      this.playerRig.container.setRotation(0);
      this.playerRig.container.setAlpha(1);
    }
    if (this.portalVisualGroup) {
      this.portalVisualGroup.playerTransformApplied = false;
    }
    this.triggerIrisTransition('close');
    if (shouldCommit) {
      if (sim.inHub) {
        sim.player.ready = true;
        if (sim.areAllPlayersReady() || sim.player.slot === 1) {
          sim.startDungeonRunFromHub();
        }
      } else {
        sim.enterPortal();
      }
      this.syncArenaTilesWithMapRevision();
      this.processSimEvents(this.transport.consumeEvents());
      this.portalAnimState.lastRoomKey = sim.inHub
        ? 'hub'
        : `${sim.currentFloor}_${sim.currentRoomId}`;
      this.portalAnimState.wasPortalActive = sim.portalActive;
    }
    this.lastRunState = '';
  }

  const currentRoom = sim.getCurrentRoom();
  const hubReady = sim.inHub ? sim.areAllPlayersReady() : false;
  portalVisParamsScratch.inHub = sim.inHub;
  portalVisParamsScratch.hubReady = hubReady;
  portalVisParamsScratch.portalActive = sim.portalActive || animStep.enterActive;
  portalVisParamsScratch.roomType = currentRoom.type;
  portalVisParamsScratch.quality = quality;
  portalVisParamsScratch.elapsedSec = animTimeSec;
  portalVisParamsScratch.burstProgress = isBursting ? animStep.burstProgress : 0;
  const portalVis = resolvePortalVisualState(portalVisParamsScratch, portalVisScratch);

  if (animStep.burstTriggered) {
    zzfx.play('door_open');
    this.lighting?.spawnTransientLight(
      sim.portalX,
      sim.portalY,
      210,
      portalVis.coreColorHex,
      1.0,
      0.45,
    );
  }

  if (!portalVis.visible && !animStep.enterActive) {
    if (this.portalVisualGroup) {
      if (this.portalVisualGroup.playerTransformApplied && this.playerRig) {
        this.playerRig.container.setScale(1, 1);
        this.playerRig.container.setRotation(0);
        this.playerRig.container.setAlpha(1);
        this.portalVisualGroup.playerTransformApplied = false;
      }
      setPortalVisualGroupVisible(this.portalVisualGroup, false);
    }
    this.portalLabel?.setVisible(false);
    return;
  }

  const px = animStep.enterActive ? this.portalAnimState.enterTargetX : sim.portalX;
  const py = animStep.enterActive ? this.portalAnimState.enterTargetY : sim.portalY;
  const group = getOrCreatePortalVisualGroup(this, px, py);

  group.pedestalBaseSprite.setPosition(px, py);
  group.pedestalBaseSprite.setScale(invBake);
  group.pedestalBaseSprite.setTint(portalVis.mode === 'dungeon_inactive' ? 0x9ca3af : 0xffffff);
  group.pedestalBaseSprite.setVisible(true);

  group.pedestalRunesSprite.setPosition(px, py);
  group.pedestalRunesSprite.setScale(invBake);
  group.pedestalRunesSprite.setTint(portalVis.runeTintNum);
  group.pedestalRunesSprite.setAlpha(portalVis.runeAlpha);
  group.pedestalRunesSprite.setVisible(true);

  group.vortexSprite.setPosition(px, py);
  group.vortexSprite.setScale(invBake * portalVis.vortexScale);
  group.vortexSprite.setVisible(true);

  const webglOk =
    portalVis.useShader && ensurePortalAndDoorPipelinesRegistered(this.game, Phaser);
  if (webglOk) {
    const uniforms = (group.vortexSprite as PortalShaderSprite).__portalUniforms!;
    uniforms.time = animTimeSec;
    uniforms.spinSpeed = portalVis.spinSpeedRadPerSec;
    uniforms.activity = portalVis.activityLevel;
    uniforms.pulse = portalVis.pulseIntensity;
    uniforms.burstProgress = portalVis.burstProgress;
    uniforms.outerRgb = portalVis.outerRgb;
    uniforms.coreRgb = portalVis.coreRgb;
    uniforms.rimRgb = portalVis.rimRgb;

    if (group.vortexSprite.pipeline?.name !== PORTAL_VORTEX_PIPELINE_KEY) {
      group.vortexSprite.setPipeline(PORTAL_VORTEX_PIPELINE_KEY);
    }
    group.vortexSprite.setTint(0xffffff);
    group.vortexSprite.setAlpha(portalVis.vortexAlpha);
    group.vortexSprite.setRotation(0);
    group.vortexCoreSprite.setVisible(false);
  } else {
    if (group.vortexSprite.pipeline?.name === PORTAL_VORTEX_PIPELINE_KEY) {
      group.vortexSprite.resetPipeline();
    }
    group.vortexSprite.setTint(portalVis.outerColorNum);
    group.vortexSprite.setAlpha(portalVis.vortexAlpha);
    group.vortexSprite.setRotation(animTimeSec * portalVis.spinSpeedRadPerSec);

    if (portalVis.mode !== 'dungeon_inactive') {
      group.vortexCoreSprite.setPosition(px, py);
      group.vortexCoreSprite.setScale(invBake * (0.9 + 0.08 * portalVis.pulseIntensity));
      group.vortexCoreSprite.setTint(portalVis.coreColorNum);
      group.vortexCoreSprite.setAlpha(0.88);
      group.vortexCoreSprite.setRotation(animTimeSec * portalVis.coreSpinSpeedRadPerSec);
      group.vortexCoreSprite.setVisible(true);
    } else {
      group.vortexCoreSprite.setVisible(false);
    }
  }

  for (let i = 0; i < group.spiralParticles.length; i++) {
    const sp = group.spiralParticles[i]!;
    if (i < portalVis.particleCount) {
      const pose = computePortalSpiralParticlePose(
        i,
        portalVis.particleCount,
        animTimeSec,
        portalVis.spinSpeedRadPerSec,
        px,
        py,
        particlePoseScratch,
      );
      sp.setPosition(pose.x, pose.y);
      sp.setScale(invBake * pose.scaleX, invBake * pose.scaleY);
      sp.setRotation(pose.rotation);
      sp.setTint(i % 2 === 0 ? portalVis.coreColorNum : portalVis.rimColorNum);
      sp.setAlpha(pose.alpha);
      sp.setVisible(true);
    } else {
      sp.setVisible(false);
    }
  }

  for (let i = 0; i < group.energyRays.length; i++) {
    const ray = group.energyRays[i]!;
    if (i < portalVis.rayCount) {
      const pose = computePortalEnergyRayPose(
        i,
        portalVis.rayCount,
        animTimeSec,
        px,
        py,
        particlePoseScratch,
      );
      ray.setPosition(pose.x, pose.y);
      ray.setScale(invBake * pose.scaleX, invBake * pose.scaleY);
      ray.setTint(i % 2 === 0 ? portalVis.coreColorNum : portalVis.outerColorNum);
      ray.setAlpha(pose.alpha);
      ray.setVisible(true);
    } else {
      ray.setVisible(false);
    }
  }

  group.burstGraphics.clear();
  if (isBursting) {
    const bp = animStep.burstProgress;
    const fade = animStep.shockwaveAlpha;
    const ringR = animStep.shockwaveRadius;
    group.burstGraphics.lineStyle(4.5 * fade + 1.2, portalVis.coreColorNum, fade);
    group.burstGraphics.strokeCircle(px, py, ringR);
    group.burstGraphics.lineStyle(2.2, 0xffffff, animStep.flashAlpha);
    group.burstGraphics.strokeCircle(px, py, ringR * 0.72);

    for (let rIdx = 0; rIdx < 8; rIdx++) {
      const ang = (rIdx * Math.PI) / 4 + bp * 0.6;
      const rInner = 14 + bp * 24;
      const rOuter = 28 + bp * 64;
      group.burstGraphics.lineStyle(2.2, portalVis.rimColorNum, fade * 0.8);
      group.burstGraphics.lineBetween(
        px + Math.cos(ang) * rInner,
        py + Math.sin(ang) * rInner,
        px + Math.cos(ang) * rOuter,
        py + Math.sin(ang) * rOuter,
      );
    }
  }

  if (animStep.enterActive) {
    const ep = animStep.enterProgress;
    const flashA = animStep.enterFlashAlpha;
    const suctionR = 38 * (1 - ep * 0.65);
    group.burstGraphics.lineStyle(3.5, portalVis.coreColorNum, flashA * 0.9);
    group.burstGraphics.strokeCircle(px, py, suctionR);
    group.burstGraphics.fillStyle(0xffffff, flashA * 0.48);
    group.burstGraphics.fillCircle(px, py, 14 + (1 - ep) * 10);

    if (this.playerRig) {
      this.playerRig.container.setPosition(
        animStep.playerX,
        animStep.playerY + RIG_FOOT_OFFSET_Y,
      );
      this.playerRig.container.setScale(animStep.playerScaleX, animStep.playerScaleY);
      this.playerRig.container.setRotation(animStep.playerRotationRad);
      this.playerRig.container.setAlpha(animStep.playerAlpha);
      group.playerTransformApplied = true;
    }
  } else if (group.playerTransformApplied && this.playerRig) {
    this.playerRig.container.setScale(1, 1);
    this.playerRig.container.setRotation(0);
    this.playerRig.container.setAlpha(1);
    group.playerTransformApplied = false;
  }

  const pGlow = resolveInteractableVisualGlowSpec({
    kind: 'portal',
    active: sim.portalActive || animStep.enterActive,
    inHub: sim.inHub,
    hubReady,
    roomType: currentRoom.type,
    elapsedSec: animTimeSec,
  });
  if (lightingEnabled && pGlow.glowAlpha > 0) {
    const burstBoost = isBursting
      ? 1 + 0.35 * Math.sin(animStep.burstProgress * Math.PI)
      : 1;
    group.glowSprite.setPosition(px, py);
    group.glowSprite.setDisplaySize(
      pGlow.glowRadiusX * 2 * burstBoost,
      pGlow.glowRadiusY * 2 * burstBoost,
    );
    group.glowSprite.setTint(pGlow.colorNum);
    group.glowSprite.setAlpha(clamp(pGlow.glowAlpha * burstBoost, 0, 0.48));
    group.glowSprite.setVisible(true);
  } else {
    group.glowSprite.setVisible(false);
  }

  this.portalLabel?.setVisible(false);
}

export function syncDoorVisualsImpl(
  this: GameScene,
  animDtSec: number,
  target: InteractTargetResult | null,
): void {
  const sim = this.transport.getSim();
  const textRes = TextureBaker.getBakeScale();
  const invBake = 1 / textRes;
  const lightingEnabled = this.lighting?.isLightmapVisible() ?? true;
  const quality = graphicsSettings.getState().quality;
  const animTimeSec = this.portalDoorAnimClockSec;
  const locale = i18n.getLocale();

  const currentDoorRoomKey = sim.inHub ? 'hub' : `${sim.currentFloor}_${sim.currentRoomId}`;
  const isNewCombatRoomTransition =
    !sim.inHub &&
    this.lastDoorRoomKey !== '' &&
    this.lastDoorRoomKey !== 'hub' &&
    this.lastDoorRoomKey !== currentDoorRoomKey;
  this.lastDoorRoomKey = currentDoorRoomKey;

  const view = this.cameras.main.worldView;
  const hasView = view && view.width > 0;
  const bossActive = sim.getActiveBoss() !== null;
  const safeTopY = hasView ? view.y + (bossActive ? 122 : 82) : 82;
  const safeBottomY = hasView ? view.y + view.height - 66 : 474;
  const safeLeftX = hasView ? view.x + 18 : 18;
  const safeRightX = hasView ? view.x + view.width - 18 : 942;

  let playLockupSfx = false;
  this.activeDoorKeys.clear();
  for (let i = 0; i < sim.doors.length; i++) {
    const door = sim.doors[i]!;
    const key = `${sim.currentFloor}_${sim.currentRoomId}_${door.dir}`;
    this.activeDoorKeys.add(key);

    let entry = this.doorSprites.get(key);
    if (!entry) {
      const animState = createDoorAnimState(door.locked);
      if (isNewCombatRoomTransition && door.locked) {
        triggerDoorCombatLockupState(animState);
      }

      doorVisParamsScratch.dir = door.dir;
      doorVisParamsScratch.locked = door.locked;
      doorVisParamsScratch.biome = sim.currentBiome;
      doorVisParamsScratch.inHub = sim.inHub;
      doorVisParamsScratch.quality = quality;
      doorVisParamsScratch.lockupProgress = door.locked ? 1 : 0;
      doorVisParamsScratch.dissolveProgress = door.locked ? 0 : 1;
      doorVisParamsScratch.elapsedSec = animTimeSec;
      const initVis = resolveDoorVisualState(doorVisParamsScratch, doorVisScratch);

      const openArchSprite = this.add.sprite(door.x, door.y, initVis.openArchTextureKey);
      openArchSprite.setScale(invBake);
      openArchSprite.setDepth(15.8);

      const frameSprite = this.add.sprite(door.x, door.y, initVis.frameTextureKey);
      frameSprite.setScale(invBake);
      frameSprite.setDepth(16.0);

      const barrierSprite = this.add.sprite(door.x, door.y, initVis.barrierTextureKey);
      barrierSprite.setScale(invBake);
      barrierSprite.setDepth(16.2);
      (barrierSprite as DoorShaderSprite).__doorUniforms = {
        time: 0,
        lockupProgress: door.locked ? 1 : 0,
        dissolveProgress: 0,
        isVertical: initVis.isVertical ? 1.0 : 0.0,
        primaryRgb: [0.86, 0.15, 0.15],
        rimRgb: [0.98, 0.75, 0.14],
      };

      const moteSprites: Phaser.GameObjects.Image[] = [];
      for (let m = 0; m < 4; m++) {
        const ms = this.add.image(door.x, door.y, 'door_unlock_spark');
        ms.setDepth(16.5);
        ms.setBlendMode(Phaser.BlendModes.ADD);
        ms.setVisible(false);
        moteSprites.push(ms);
      }

      const glowSprite = this.add.image(door.x, door.y, 'fx_light_radial');
      glowSprite.setDepth(35);
      glowSprite.setBlendMode(Phaser.BlendModes.ADD);

      const cachedRoomLabel = i18n.roomTypeName(door.targetRoomType);
      const originX = door.dir === 'E' ? 1 : door.dir === 'W' ? 0 : 0.5;
      const label = this.add
        .text(door.x, door.y, '', {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10px',
          fontStyle: '800',
          color: PALETTE.LIME_GLOW,
          stroke: PALETTE.INK_DEEP,
          strokeThickness: 3,
          resolution: textRes,
        })
        .setOrigin(originX, 0.5)
        .setDepth(45);

      entry = {
        sprite: frameSprite,
        frameSprite,
        openArchSprite,
        barrierSprite,
        moteSprites,
        glowSprite,
        label,
        animState,
        cachedRoomLabel,
        cachedLocale: locale,
        cachedTargetRoomType: door.targetRoomType,
      };
      this.doorSprites.set(key, entry);
    } else if (
      entry.cachedLocale !== locale ||
      entry.cachedTargetRoomType !== door.targetRoomType
    ) {
      entry.cachedRoomLabel = i18n.roomTypeName(door.targetRoomType);
      entry.cachedLocale = locale;
      entry.cachedTargetRoomType = door.targetRoomType;
    }

    const isActiveInteractDoor = target?.kind === 'door' && target.door.dir === door.dir;
    const doorLabelState = resolveDoorLabelState(
      door,
      sim.player.x,
      sim.player.y,
      entry.cachedRoomLabel,
      isActiveInteractDoor,
    );

    doorAnimParamsScratch.dtSec = animDtSec;
    doorAnimParamsScratch.locked = door.locked;
    const doorStep = stepDoorAnimState(
      entry.animState,
      doorAnimParamsScratch,
      doorAnimStepScratch,
    );
    if (doorStep.emitLockupSound) {
      playLockupSfx = true;
      this.lighting?.spawnTransientLight(door.x, door.y, 96, PALETTE.CRIMSON_BRIGHT, 0.8, 0.28);
    }
    if (doorStep.emitUnlockSparks) {
      this.lighting?.spawnTransientLight(
        door.x,
        door.y,
        110,
        ENV_PALETTE[sim.inHub ? 0 : sim.currentBiome].accent,
        0.85,
        0.35,
      );
    }

    doorVisParamsScratch.dir = door.dir;
    doorVisParamsScratch.locked = door.locked;
    doorVisParamsScratch.biome = sim.currentBiome;
    doorVisParamsScratch.inHub = sim.inHub;
    doorVisParamsScratch.quality = quality;
    doorVisParamsScratch.lockupProgress = doorStep.lockupProgress;
    doorVisParamsScratch.dissolveProgress = doorStep.dissolveProgress;
    doorVisParamsScratch.elapsedSec = animTimeSec;
    const doorVis = resolveDoorVisualState(doorVisParamsScratch, doorVisScratch);

    if (entry.frameSprite.texture.key !== doorVis.frameTextureKey) {
      entry.frameSprite.setTexture(doorVis.frameTextureKey);
    }
    entry.frameSprite.setPosition(door.x, door.y);
    entry.frameSprite.setScale(invBake);
    entry.frameSprite.setRotation(doorVis.frameRotationRad);

    if (entry.openArchSprite.texture.key !== doorVis.openArchTextureKey) {
      entry.openArchSprite.setTexture(doorVis.openArchTextureKey);
    }
    entry.openArchSprite.setPosition(door.x, door.y);
    entry.openArchSprite.setScale(invBake);
    entry.openArchSprite.setRotation(0);
    entry.openArchSprite.setTint(doorVis.openArchTintNum);
    const openArchAlpha = doorStep.dissolveActive
      ? doorVis.openArchAlpha * doorStep.dissolveProgress
      : doorVis.openArchAlpha;
    entry.openArchSprite.setAlpha(openArchAlpha);
    entry.openArchSprite.setVisible(doorVis.openArchVisible);

    if (entry.barrierSprite.texture.key !== doorVis.barrierTextureKey) {
      entry.barrierSprite.setTexture(doorVis.barrierTextureKey);
    }
    entry.barrierSprite.setPosition(door.x, door.y);
    entry.barrierSprite.setScale(invBake);
    entry.barrierSprite.setRotation(doorVis.barrierRotationRad);
    entry.barrierSprite.setVisible(doorVis.barrierVisible);

    if (doorVis.barrierVisible) {
      const webglOk =
        doorVis.useShader && ensurePortalAndDoorPipelinesRegistered(this.game, Phaser);
      if (webglOk) {
        const uniforms = (entry.barrierSprite as DoorShaderSprite).__doorUniforms!;
        uniforms.time = animTimeSec;
        uniforms.lockupProgress = doorVis.lockupProgress;
        uniforms.dissolveProgress = doorVis.dissolveProgress;
        uniforms.isVertical = doorVis.isVertical ? 1.0 : 0.0;

        if (entry.barrierSprite.pipeline?.name !== DOOR_BARRIER_PIPELINE_KEY) {
          entry.barrierSprite.setPipeline(DOOR_BARRIER_PIPELINE_KEY);
        }
        entry.barrierSprite.setTint(0xffffff);
        entry.barrierSprite.setAlpha(1);
      } else {
        if (entry.barrierSprite.pipeline?.name === DOOR_BARRIER_PIPELINE_KEY) {
          entry.barrierSprite.resetPipeline();
        }
        entry.barrierSprite.setTint(0xdc2626);
        entry.barrierSprite.setAlpha(doorVis.barrierAlpha);
      }
    }

    const activeMoteCount = quality === 'low' ? 0 : quality === 'medium' ? 2 : 4;
    for (let m = 0; m < entry.moteSprites.length; m++) {
      const ms = entry.moteSprites[m]!;
      if (m < activeMoteCount) {
        const pose = computeDoorMotePose(
          m,
          doorVis.orientation,
          door.x,
          door.y,
          door.locked,
          doorStep.dissolveActive,
          doorStep.dissolveProgress,
          animTimeSec,
          particlePoseScratch,
        );
        const moteTex =
          door.locked || doorStep.dissolveActive ? 'door_unlock_spark' : 'fx_sparkle_mote';
        if (ms.texture.key !== moteTex) {
          ms.setTexture(moteTex);
        }
        ms.setPosition(pose.x, pose.y);
        ms.setScale(invBake * pose.scaleX, invBake * pose.scaleY);
        ms.setRotation(pose.rotation);
        const moteTint = doorStep.dissolveActive
          ? m % 2 === 0
            ? 0xfacc15
            : doorVis.openArchTintNum
          : door.locked
            ? m < 2
              ? 0xfacc15
              : doorVis.lampColorNum
            : doorVis.openArchTintNum;
        ms.setTint(moteTint);
        ms.setAlpha(pose.alpha);
        ms.setVisible(true);
      } else {
        ms.setVisible(false);
      }
    }

    const doorGlowSpec = resolveInteractableVisualGlowSpec({
      kind: 'door',
      locked: door.locked,
      biome: sim.currentBiome,
      inHub: sim.inHub,
    });
    if (lightingEnabled && doorGlowSpec.glowAlpha > 0) {
      const dissolveBoost = doorStep.dissolveActive
        ? 0.08 * Math.sin(doorStep.dissolveProgress * Math.PI)
        : 0;
      entry.glowSprite.setPosition(door.x, door.y);
      entry.glowSprite.setDisplaySize(
        doorGlowSpec.glowRadiusX * 2,
        doorGlowSpec.glowRadiusY * 2,
      );
      entry.glowSprite.setTint(doorGlowSpec.colorNum);
      entry.glowSprite.setAlpha(clamp(doorGlowSpec.glowAlpha + dissolveBoost, 0, 0.42));
      entry.glowSprite.setVisible(true);
    } else {
      entry.glowSprite.setVisible(false);
    }

    if (doorLabelState.visible) {
      if (entry.label.text !== doorLabelState.text) {
        entry.label.setText(doorLabelState.text);
      }
      if (entry.label.style.color !== doorLabelState.colorHex) {
        entry.label.setColor(doorLabelState.colorHex);
      }
      const originX =
        doorLabelState.mode === 'lock_icon_only'
          ? 0.5
          : door.dir === 'E'
            ? 1
            : door.dir === 'W'
              ? 0
              : 0.5;
      entry.label.setOrigin(originX, 0.5);
      entry.label.setAlpha(doorLabelState.alpha);
      entry.label.setVisible(true);
      const rawLabelX =
        door.dir === 'W' ? door.x + 26 : door.dir === 'E' ? door.x - 26 : door.x;
      const rawLabelY =
        door.dir === 'N'
          ? door.y + 32
          : door.dir === 'S'
            ? door.y - 28
            : door.y - 44;
      entry.label.setPosition(
        clamp(rawLabelX, safeLeftX, safeRightX),
        clamp(rawLabelY, safeTopY, safeBottomY),
      );
    } else {
      entry.label.setVisible(false);
    }
  }

  if (playLockupSfx) {
    zzfx.play('door_lock');
  }

  for (const [key, entry] of this.doorSprites.entries()) {
    if (!this.activeDoorKeys.has(key)) {
      destroyDoorVisualEntry(entry);
      this.doorSprites.delete(key);
    }
  }
}

function destroyDoorVisualEntry(entry: DoorVisualEntry): void {
  entry.frameSprite.destroy();
  entry.openArchSprite.destroy();
  entry.barrierSprite.destroy();
  for (let i = 0; i < entry.moteSprites.length; i++) {
    entry.moteSprites[i]!.destroy();
  }
  entry.glowSprite.destroy();
  entry.label.destroy();
}

export function triggerPortalActivationBurstImpl(this: GameScene): void {
  triggerPortalActivationBurstState(this.portalAnimState);
}

export function triggerPortalEnterSequenceImpl(
  this: GameScene,
  commitOnComplete = false,
): void {
  const sim = this.transport.getSim();
  if (commitOnComplete) {
    zzfx.play('portal_enter');
  }
  triggerPortalEnterSequenceState(
    this.portalAnimState,
    sim.player.x,
    sim.player.y,
    sim.portalX,
    sim.portalY,
    commitOnComplete,
  );
  this.lighting?.spawnTransientLight(
    sim.portalX,
    sim.portalY,
    200,
    PALETTE.ELECTRIC_VIOLET,
    0.95,
    0.4,
  );
}

export function triggerDoorUnlockTransitionImpl(this: GameScene): void {
  for (const entry of this.doorSprites.values()) {
    triggerDoorUnlockDissolveState(entry.animState);
  }
}

export function triggerDoorCombatLockupImpl(this: GameScene): void {
  for (const entry of this.doorSprites.values()) {
    triggerDoorCombatLockupState(entry.animState);
  }
}

export function resetPortalAndDoorTestStateImpl(this: GameScene): void {
  resetClientFreezeRandom();
  const sim = this.transport.getSim();
  this.portalDoorAnimClockSec = 0;
  this.portalAnimState = createPortalAnimState();
  const roomKey = sim.inHub ? 'hub' : `${sim.currentFloor}_${sim.currentRoomId}`;
  this.portalAnimState.lastRoomKey = roomKey;
  this.portalAnimState.wasPortalActive = sim.portalActive;
  this.lastDoorRoomKey = roomKey;
  if (this.portalVisualGroup?.playerTransformApplied && this.playerRig) {
    this.playerRig.container.setScale(1, 1);
    this.playerRig.container.setRotation(0);
    this.playerRig.container.setAlpha(1);
    this.portalVisualGroup.playerTransformApplied = false;
  }
  for (const entry of this.doorSprites.values()) {
    entry.animState.wasLocked = true;
    entry.animState.lockupActive = false;
    entry.animState.lockupTimerSec = DOOR_COMBAT_LOCKUP_DURATION_SEC;
    entry.animState.dissolveActive = false;
    entry.animState.dissolveTimerSec = DOOR_UNLOCK_DISSOLVE_DURATION_SEC;
    entry.animState.pendingUnlockSparks = false;
    entry.animState.pendingLockupSound = false;
  }
  this.lastRunState = '';
}

export function destroyPortalAndDoorVisualsImpl(this: GameScene): void {
  if (this.portalVisualGroup) {
    this.portalVisualGroup.pedestalBaseSprite.destroy();
    this.portalVisualGroup.pedestalRunesSprite.destroy();
    this.portalVisualGroup.vortexSprite.destroy();
    this.portalVisualGroup.vortexCoreSprite.destroy();
    for (let i = 0; i < this.portalVisualGroup.spiralParticles.length; i++) {
      this.portalVisualGroup.spiralParticles[i]!.destroy();
    }
    for (let i = 0; i < this.portalVisualGroup.energyRays.length; i++) {
      this.portalVisualGroup.energyRays[i]!.destroy();
    }
    this.portalVisualGroup.burstGraphics.destroy();
    this.portalVisualGroup.glowSprite.destroy();
    this.portalVisualGroup = undefined;
  }
  this.portalSprite = undefined;
  this.portalGlowSprite = undefined;
  this.lastDoorRoomKey = '';
  for (const entry of this.doorSprites.values()) {
    destroyDoorVisualEntry(entry);
  }
  this.doorSprites.clear();
}
