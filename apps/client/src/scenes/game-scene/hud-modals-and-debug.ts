import {
  type BuffId,
  CHARACTERS,
  FLOOR_BUFFS,
  i18n,
  PLAYER_SLOT_COLORS,
  WEAPONS,
} from '@ashen-pact/shared';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { musicManager } from '../../audio/music-synth.js';
import { zzfx } from '../../audio/zzfx.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import { type GameScene } from '../GameScene.js';

export function updateModalHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  if (sim.runState === 'playing' || sim.runState === 'buff_choice') {
    this.resultDismissed = false;
  }
  const statsSig =
    sim.runState === 'victory' || sim.runState === 'defeat'
      ? `${sim.runStats.kills}:${Math.round(sim.runStats.damageDealt)}:${sim.runStats.teamCombos}:${sim
          .getAllPlayers()
          .map(
            (pl) =>
              `${pl.id}:${Math.round(pl.statsDamageDealt ?? 0)}:${pl.statsKills ?? 0}:${pl.statsRevives ?? 0}`,
          )
          .join('|')}`
      : '';
  const modalKey = `${sim.runState}:${sim.pendingBuffChoices.join(',')}:${this.resultDismissed}:${i18n.getLocale()}:${statsSig}`;
  if (modalKey === this.lastRunState) return;
  const prevRunState = this.lastRunState.split(':')[0];
  this.lastRunState = modalKey;

  if (sim.runState === 'victory' && prevRunState !== 'victory') {
    zzfx.play('ui_victory');
  } else if (sim.runState === 'defeat' && prevRunState !== 'defeat') {
    zzfx.play('ui_defeat');
  }

  this.modalContainer.removeAll(true);
  const textRes = Math.min(TextureBaker.getBakeScale(), 3);

  if (sim.runState === 'buff_choice') {
    const bg = ui.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.92);
    bg.lineStyle(3, hexToNum(PALETTE.SOLAR_GOLD), 1);
    bg.fillRoundedRect(140, 110, 680, 310, 12);
    bg.strokeRoundedRect(140, 110, 680, 310, 12);
    this.modalContainer.add(bg);

    const header = ui.add
      .text(480, 132, i18n.t('modal.buffChoiceTitle'), {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '15px',
        fontStyle: '800',
        color: PALETTE.SOLAR_GOLD,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 3.5,
        resolution: textRes,
      })
      .setOrigin(0.5, 0);
    this.modalContainer.add(header);

    sim.pendingBuffChoices.forEach((buffId: BuffId, idx: number) => {
      const bDef = FLOOR_BUFFS[buffId];
      if (!bDef) return;
      const buffTxt = i18n.getBuffText(buffId, bDef.nameVi, bDef.descriptionVi);
      const cardX = 166 + idx * 214;
      const cardY = 172;
      const cardW = 200;
      const cardH = 216;

      const cardG = ui.add.graphics();
      cardG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.96);
      cardG.lineStyle(2.5, hexToNum(PALETTE.CYAN_FROST), 1);
      cardG.fillRoundedRect(cardX, cardY, cardW, cardH, 9);
      cardG.strokeRoundedRect(cardX, cardY, cardW, cardH, 9);
      this.modalContainer.add(cardG);

      const title = ui.add
        .text(cardX + cardW / 2, cardY + 22, `[${idx + 1}] ${buffTxt.name}`, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '13px',
          fontStyle: '800',
          color: PALETTE.SOLAR_GOLD,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3,
          align: 'center',
          wordWrap: { width: cardW - 20 },
          resolution: textRes,
        })
        .setOrigin(0.5, 0);
      this.modalContainer.add(title);

      const desc = ui.add
        .text(cardX + cardW / 2, cardY + 74, buffTxt.desc, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '11px',
          fontStyle: '600',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          align: 'center',
          wordWrap: { width: cardW - 24 },
          resolution: textRes,
        })
        .setOrigin(0.5, 0);
      this.modalContainer.add(desc);

      const hit = ui.add
        .rectangle(cardX + cardW / 2, cardY + cardH / 2, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        sim.selectFloorBuff(buffId);
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('select_buff', { buffId });
        }
        zzfx.play('skill_cast');
      });
      this.modalContainer.add(hit);
    });
  } else if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
    const isWin = sim.runState === 'victory';
    const biomeName = i18n.biomeName(sim.currentBiome);
    const px = 110;
    const py = 74;
    const pw = 740;
    const ph = 398;

    const bg = ui.add.graphics();
    bg.fillStyle(hexToNum(PALETTE.INK_DARK), 0.78);
    bg.fillRect(-480, -270, 1920, 1080);
    bg.fillStyle(hexToNum(PALETTE.INK_DEEP), 0.96);
    bg.lineStyle(3, hexToNum(isWin ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT), 1);
    bg.fillRoundedRect(px, py, pw, ph, 12);
    bg.strokeRoundedRect(px, py, pw, ph, 12);
    this.modalContainer.add(bg);

    const header = ui.add
      .text(
        480,
        py + 12,
        isWin
          ? i18n.t('modal.victoryTitle', { biome: biomeName.toUpperCase() })
          : i18n.t('modal.defeatTitle', { biome: biomeName.toUpperCase() }),
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '15px',
          fontStyle: '800',
          color: isWin ? PALETTE.SOLAR_GOLD : PALETTE.CRIMSON_BRIGHT,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 3.5,
          resolution: textRes,
        },
      )
      .setOrigin(0.5, 0);
    this.modalContainer.add(header);

    const buffNames =
      sim.activeBuffIds.length > 0
        ? sim.activeBuffIds
            .map((b: BuffId) => {
              const def = FLOOR_BUFFS[b];
              return def ? i18n.getBuffText(b, def.nameVi, def.descriptionVi).name : b;
            })
            .join(', ')
        : i18n.t('ui.result.none');
    const activeWDef = WEAPONS[sim.getActiveWeaponId()] ?? WEAPONS.rusty_pistol!;
    const totalGoldEarned = Math.max(sim.runStats.goldEarned, sim.player.gold);
    const totalSec = Math.max(1, Math.round(sim.runStats.ticksElapsed / 60));
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const timeStr = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;
    const summaryLines = [
      i18n.t('ui.result.floorReached', {
        floor: sim.currentFloor,
        biome: biomeName,
      }),
      i18n.t('ui.result.timeElapsed', { time: timeStr }),
      i18n.t('ui.result.roomsCleared', { count: sim.runStats.roomsCleared }),
      i18n.t('ui.result.enemiesKilled', {
        kills: sim.runStats.kills,
        elites: sim.runStats.elitesKilled,
      }),
      i18n.t('ui.result.totalDamage', {
        dmg: Math.round(sim.runStats.damageDealt),
      }),
      i18n.t('ui.result.elementalReactions', {
        reactions: sim.runStats.elementalReactions,
        combos: sim.runStats.teamCombos,
      }),
      i18n.t('ui.result.goldCollected', {
        gold: sim.player.gold,
        totalGold: totalGoldEarned,
      }),
      i18n.t('ui.result.activeWeapon', {
        weapon: i18n.weaponName(activeWDef.id, activeWDef.nameVi),
      }),
      i18n.t('ui.result.blessings', { buffs: buffNames }),
    ].join('\n');

    const body = ui.add
      .text(px + 18, py + 36, summaryLines, {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '8.8px',
        fontStyle: '700',
        color: PALETTE.BONE_WHITE,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.2,
        lineSpacing: 1,
        wordWrap: { width: 348 },
        resolution: textRes,
      })
      .setOrigin(0, 0);
    this.modalContainer.add(body);

    // Left Column Bottom: Per-Player Performance Breakdown Table
    const playerHeader = ui.add.text(
      px + 18,
      py + 196,
      `📊 ${i18n.t('ui.result.playerStatsHeader')}`,
      {
        fontFamily: '"Be Vietnam Pro", sans-serif',
        fontSize: '9.8px',
        fontStyle: '800',
        color: PALETTE.CYAN_FROST,
        stroke: PALETTE.INK_DARK,
        strokeThickness: 2.6,
        resolution: textRes,
      },
    );
    this.modalContainer.add(playerHeader);

    const allPlayers = sim.getAllPlayers().slice(0, 4);
    allPlayers.forEach((pl, idx) => {
      const ry = py + 214 + idx * 33;
      const rw = 348;
      const rh = 30;
      const slotColor = PLAYER_SLOT_COLORS[pl.slot] ?? PALETTE.CYAN_FROST;

      const rowG = ui.add.graphics();
      rowG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.92);
      rowG.lineStyle(1.5, hexToNum(slotColor), 0.9);
      rowG.fillRoundedRect(px + 18, ry, rw, rh, 5);
      rowG.strokeRoundedRect(px + 18, ry, rw, rh, 5);
      this.modalContainer.add(rowG);

      const cDef = CHARACTERS[pl.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(pl.characterId, cDef.nameVi);
      const pNameTxt = ui.add.text(
        px + 25,
        ry + 3,
        `[P${pl.slot}] ${pl.displayName} (${charName})`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '8.6px',
          fontStyle: '800',
          color: slotColor,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.2,
          resolution: textRes,
        },
      );
      const pStatsTxt = ui.add.text(
        px + 25,
        ry + 15,
        i18n.t('ui.result.playerRowFormat', {
          dmg: Math.round(pl.statsDamageDealt ?? 0),
          taken: Math.round(pl.statsDamageTaken ?? 0),
          kills: pl.statsKills ?? 0,
          revives: pl.statsRevives ?? 0,
          elem: pl.statsElementalReactions ?? 0,
          combo: pl.statsTeamCombos ?? 0,
        }),
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '8px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        },
      );
      this.modalContainer.add([pNameTxt, pStatsTxt]);
    });

    // Right Column: 4 MVP Award Cards (Danh Hiệu MVP Đội Hình)
    const mvpHeader = ui.add.text(px + 380, py + 38, `🏆 ${i18n.t('mvp.sectionTitle')}`, {
      fontFamily: '"Be Vietnam Pro", sans-serif',
      fontSize: '10.8px',
      fontStyle: '800',
      color: PALETTE.SOLAR_GOLD,
      stroke: PALETTE.INK_DARK,
      strokeThickness: 3,
      resolution: textRes,
    });
    this.modalContainer.add(mvpHeader);

    const mvpAwards = sim.computeMvpAwards();
    mvpAwards.forEach((award, idx) => {
      const ay = py + 60 + idx * 62;
      const aw = 342;
      const ah = 56;
      const cardG = ui.add.graphics();
      cardG.fillStyle(hexToNum(PALETTE.SLATE_DARK), 0.94);
      cardG.lineStyle(2, hexToNum(award.colorHex), 0.95);
      cardG.fillRoundedRect(px + 380, ay, aw, ah, 7);
      cardG.strokeRoundedRect(px + 380, ay, aw, ah, 7);
      this.modalContainer.add(cardG);

      const cDef = CHARACTERS[award.characterId] ?? CHARACTERS.vanguard;
      const charName = i18n.charName(award.characterId, cDef.nameVi);
      const titleTxt = ui.add.text(
        px + 390,
        ay + 6,
        `★ ${i18n.t(award.titleKey)} — [P${award.playerSlot}] ${award.displayName}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9.8px',
          fontStyle: '800',
          color: award.colorHex,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.5,
          resolution: textRes,
        },
      );
      const descParams: Record<string, string | number> =
        award.category === 'medic'
          ? { revives: award.value, taken: award.secondaryValue }
          : award.category === 'elemental'
            ? { reactions: award.value, combos: award.secondaryValue }
            : { val: award.value };
      const subTxt = ui.add.text(
        px + 390,
        ay + 26,
        `${charName} · ${i18n.t(award.descKey, descParams)}`,
        {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '9px',
          fontStyle: '700',
          color: PALETTE.BONE_WHITE,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2,
          resolution: textRes,
        },
      );
      this.modalContainer.add([titleTxt, subTxt]);
    });

    // Bottom Action Buttons: [Enter] Chơi Lại, [H] Về Doanh Trại, [M] Menu Chính, Đóng Bảng
    const makeModalBtn = (
      bx: number,
      by: number,
      bw: number,
      label: string,
      borderHex: string,
      onClick: () => void,
    ) => {
      const btnG = ui.add.graphics();
      btnG.fillStyle(hexToNum(PALETTE.SLATE_MID), 0.96);
      btnG.lineStyle(2, hexToNum(borderHex), 1);
      btnG.fillRoundedRect(bx, by, bw, 34, 7);
      btnG.strokeRoundedRect(bx, by, bw, 34, 7);
      this.modalContainer.add(btnG);

      const txt = ui.add
        .text(bx + bw / 2, by + 17, label, {
          fontFamily: '"Be Vietnam Pro", sans-serif',
          fontSize: '10.5px',
          fontStyle: '800',
          color: borderHex,
          stroke: PALETTE.INK_DARK,
          strokeThickness: 2.8,
          resolution: textRes,
        })
        .setOrigin(0.5, 0.5);
      this.modalContainer.add(txt);

      const hit = ui.add
        .rectangle(bx + bw / 2, by + 17, bw, 34, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      hit.on('pointerover', () => zzfx.play('ui_hover'));
      hit.on('pointerdown', () => {
        zzfx.play('ui_click');
        onClick();
      });
      this.modalContainer.add(hit);
    };

    const btnY = py + ph - 44;
    makeModalBtn(130, btnY, 182, i18n.t('modal.btnReplay'), PALETTE.LIME_GLOW, () => {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('replay_run', {});
        this.resultDismissed = true;
        this.triggerIrisTransition('close');
        this.invalidateAllHudCaches();
      } else {
        this.scene.restart();
      }
    });
    makeModalBtn(320, btnY, 172, i18n.t('modal.btnReturnHub'), PALETTE.CYAN_FROST, () => {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('return_to_hub', {});
      }
      sim.enterHub();
      this.resultDismissed = true;
      this.triggerIrisTransition('close');
      this.invalidateAllHudCaches();
    });
    makeModalBtn(500, btnY, 162, i18n.t('modal.btnMainMenu'), PALETTE.SOLAR_GOLD, () => {
      this.scene.start('MenuScene');
    });
    makeModalBtn(670, btnY, 160, i18n.t('modal.btnDismiss'), PALETTE.SILVER_BRIGHT, () => {
      this.resultDismissed = true;
      if (isWin && sim.currentFloor < 6) {
        sim.campaignMaxFloors = 6;
        sim.runState = 'playing';
        if (this.room && this.coopMode !== 'solo') {
          this.room.send('continue_campaign', {});
        }
      }
    });
  }
}

export function updateDebugStateImpl(this: GameScene, playerRenderX: number, playerRenderY: number): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const debug = initGlobalDebugState();

  debug.playerX = Math.round(playerRenderX * 100) / 100;
  debug.playerY = Math.round(playerRenderY * 100) / 100;
  debug.playerVx = Math.round(p.vx * 100) / 100;
  debug.playerVy = Math.round(p.vy * 100) / 100;
  debug.playerHp = p.hp;
  debug.playerMaxHp = p.maxHp;
  debug.playerArmor = p.armor;
  debug.playerMaxArmor = p.maxArmor;
  debug.playerEnergy = p.energy;
  debug.playerMaxEnergy = p.maxEnergy;
  debug.playerSlot = p.slot;
  debug.activeWeaponId = sim.getActiveWeaponId();
  debug.activeWeaponSlot = p.activeWeaponSlot;
  debug.godMode = p.godMode;
  debug.damagePopupCount = this.fx.getActiveDamagePopupCount();
  debug.totalDamagePopupsSpawned = this.fx.totalDamagePopupsSpawned;
  debug.totalSparksSpawned = this.fx.totalSparksSpawned;
  debug.totalHitStopsTriggered = this.fx.totalHitStopsTriggered;
  debug.totalShakesTriggered = this.fx.totalShakesTriggered;
  debug.sfxPlayedCount = zzfx.getPlayedCount();
  debug.lastSfxId = zzfx.getLastPlayedId();
  debug.rollingDps = sim.getRollingDps();
  debug.cameraCenterX = Math.round(this.cameras.main.midPoint.x * 100) / 100;
  debug.cameraCenterY = Math.round(this.cameras.main.midPoint.y * 100) / 100;
  debug.animState = this.playerRig?.getAnimState() ?? 'idle';

  // Phase 2 telemetry
  debug.activeLightCount = this.lighting.getActiveLightCount();
  debug.decalCount = this.fx.getActiveDecalCount();
  debug.particleCount = this.fx.getActiveParticleCount();
  debug.afterimageCount = this.fx.getActiveAfterimageCount();
  debug.ambientParticleCount = this.fx.getActiveAmbientCount();
  debug.propCount = this.propVisuals.size;
  let destructibleCount = 0;
  for (let i = 0; i < sim.props.length; i++) {
    const pr = sim.props[i]!;
    if (pr.destructible && pr.hp > 0) destructibleCount += 1;
  }
  debug.destructiblePropCount = destructibleCount;
  debug.activeImbueElement = p.activeImbueElement;
  debug.stressTestActive = sim.stressTestActive;

  // Phase 3 telemetry
  const currentRoom = sim.getCurrentRoom();
  const boss = sim.getActiveBoss();
  debug.biome = sim.currentBiome;
  debug.currentBiome = sim.currentBiome;
  debug.currentFloor = sim.currentFloor;
  debug.currentRoomId = sim.currentRoomId;
  debug.currentRoomType = sim.inHub ? 'hub' : currentRoom.type;
  debug.totalRooms = sim.dungeon.rooms.length;
  debug.playerGold = p.gold;
  debug.runState = sim.runState;
  debug.bossActive = boss !== null;
  debug.bossDefId = boss ? boss.defId : null;
  debug.bossPhase = boss ? boss.bossPhase : 0;
  debug.bossHp = boss ? boss.hp : 0;
  debug.bossMaxHp = boss ? boss.maxHp : 0;
  debug.fullMapOpen = this.fullMapOpen;
  debug.botAutoPlayActive = sim.botAutoPlayActive;
  debug.activeBuffs = sim.activeBuffIds;

  // Phase 4 Co-op & Network telemetry
  debug.coopMode = this.coopMode;
  debug.coopPlayerCount = sim.getActivePlayerCount();
  debug.inHub = sim.inHub;
  if (this.networkTransport) {
    const tel = this.networkTransport.getTelemetry();
    debug.rttMs = tel.rttMs;
    debug.jitterMs = tel.jitterMs;
    debug.bandwidthKBps = Math.round((tel.bytesInPerSec / 1024) * 10) / 10;
    debug.interpolationDelayMs = tel.interpolationDelayMs;
    debug.wifiProfile = tel.wifiProfile;
  } else {
    debug.rttMs = debug.pingMs;
    debug.jitterMs = 0;
    debug.bandwidthKBps = 0;
    debug.interpolationDelayMs = 0;
  }

  // Phase 5 telemetry
  debug.playerCharacterId = p.characterId;
  debug.teamComboCount = sim.teamComboCount;
  debug.elementalReactions = sim.runStats.elementalReactions;
  debug.activeSummonCount = sim.summons.length;
  debug.activeSkillZoneCount = sim.skillZones.length;

  // Phase 6 telemetry
  debug.blizzardVeilActive = this.lighting.isBlizzardVeilActive();
  debug.conveyorDirection = sim.map.conveyorDirection;
  debug.pressurePlatesSolved = sim.coopPuzzleCompleted;
  debug.pressurePlateCount = sim.pressurePlates.length;
  debug.shockwaveRingCount = sim.shockwaveRings.length;
  debug.tetherBeamCount = sim.tetherBeams.length;

  // Phase 7 UI/UX & Audio telemetry
  debug.language = graphicsSettings.getState().language;
  debug.pauseModalOpen = this.pauseModalOpen;
  debug.settingsModalOpen = this.settingsModal?.getActiveModal() === 'settings';
  debug.controlsModalOpen = this.settingsModal?.getActiveModal() === 'controls';
  debug.creditsModalOpen = this.settingsModal?.getActiveModal() === 'credits';
  debug.emoteWheelOpen = this.emoteWheelOpen;
  debug.irisTransitionProgress = Math.round(this.irisTransitionProgress * 100) / 100;
  debug.trailingHpRatio = Math.round(this.trailingHpRatio * 1000) / 1000;
  debug.trailingArmorRatio = Math.round(this.trailingArmorRatio * 1000) / 1000;
  debug.musicTheme = musicManager.getCurrentTheme();
  debug.musicCombatMix = musicManager.getCombatMix();
  debug.mvpAwardsCount = sim.computeMvpAwards().length;

  const activeEnemyCount = this.activeEnemyIds.size;
  const totalEntities = 1 + sim.simulatedPlayers.length + activeEnemyCount + sim.summons.length;

  this.debugOverlay?.update({
    entityCount: totalEntities,
    bulletCount: sim.projectiles.length,
    tick: sim.tick,
  });
}
