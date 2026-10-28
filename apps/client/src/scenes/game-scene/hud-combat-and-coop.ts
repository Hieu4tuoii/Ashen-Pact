import {
  BOSS_STAGGER_MAX,
  CHARACTERS,
  clamp,
  type ElementType,
  i18n,
  PLAYER_SLOT_COLORS,
  type SimEnemyState,
  WEAPON_RARITY_COLORS,
  WEAPONS,
} from '@ashen-pact/shared';
import type Phaser from 'phaser';
import { hexToNum, PALETTE } from '../../art/palette.js';
import { TextureBaker } from '../../art/texture-baker.js';
import { isEffectiveDebugUiEnabled } from '../../core/debug-flag.js';
import { drawPlayerBlessingChipsHud } from '../../ui/blessing-card-visuals.js';
import {
  drawCircularCooldown,
  drawKeyChip,
  drawMiniCharacterPortrait,
  drawSegmentedBar,
  drawStyledPanel,
  drawVectorHudIcon,
} from '../../ui/components/hud-primitives.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { clampUiScale, graphicsSettings } from '../../ui/graphics-settings.js';
import {
  computeUiTextResolution,
  createUiTextStyle,
  getBiomeUiAccent,
  UI_THEME,
} from '../../ui/theme.js';
import { type GameScene } from '../GameScene.js';
import { drawPlayerPactAndRelicHudBadges } from './hud-ashen-pact-modal.js';
import {
  drawHudWeaponCadenceBar,
  formatWeaponCadenceHudLabel,
} from './hud-micro-reload-bar.js';
import {
  drawWeaponSlotMutatorGems,
  formatWeaponCardSlotTitle,
} from './hud-pact-and-forge-modals.js';
import { applyHudEdgeAnchors, syncHudDebugVisibility } from './hud-setup-and-pause.js';

export {
  renderViDiacriticsShowcaseImpl,
  shouldShowOffscreenEnemyArrows,
  triggerPlayerHitDirectionIndicatorImpl,
  triggerRoomClearedBannerImpl,
  triggerWaveBannerImpl,
  updateBossHudImpl,
  updateMinimapHudImpl,
  updateOffscreenTeammateArrowsImpl,
  updateTopCenterBannersAndQolImpl,
} from './hud-qol-and-minimap.js';

function buildActivePlayerStatusString(
  p: ReturnType<GameScene['transport']['getSim']>['player'],
  isEn: boolean,
): string {
  let out = '';
  let count = 0;

  const appendChip = (chip: string) => {
    if (count >= 4) return;
    out = count === 0 ? chip : `${out} · ${chip}`;
    count += 1;
  };

  if (p.characterId === 'elementalist') {
    const nextElem: ElementType =
      p.activeImbueElement === 'burn'
        ? 'chill'
        : p.activeImbueElement === 'chill'
          ? 'shock'
          : 'burn';
    appendChip(
      `${i18n.elementShortName(p.activeImbueElement)}→${i18n.elementShortName(nextElem)}`,
    );
  }
  if (p.burnTimer > 0) appendChip(isEn ? 'Burn' : 'Bỏng');
  if (p.chillTimer > 0) appendChip(isEn ? 'Chill' : 'Lạnh');
  if ((p.encasedInIceTimer ?? 0) > 0) appendChip(isEn ? 'Frozen' : 'Đóng Băng');
  if (p.shockTimer > 0) appendChip(isEn ? 'Shock' : 'Điện Giật');
  if (p.poisonTimer > 0) appendChip(isEn ? 'Poison' : 'Trúng Độc');

  return out;
}

export function updateVectorHudImpl(this: GameScene): void {
  const sim = this.transport.getSim();
  const p = sim.player;
  const curLocale = i18n.getLocale();
  const gState = graphicsSettings.getState();
  const targetUiScale = clampUiScale(gState.uiScale);

  if (Math.abs(targetUiScale - this.currentHudUiScale) > 0.001) {
    applyHudEdgeAnchors(this);
  }

  if (curLocale !== this.lastHudLocale) {
    this.lastHudLocale = curLocale;
    this.invalidateAllHudCaches();
  }
  syncHudDebugVisibility(this);

  const hpRatio = clamp(p.hp / Math.max(1, p.maxHp), 0, 1);
  const lowHpAlert = p.hp > 0 && hpRatio <= 0.3;
  const lowHpPulse = lowHpAlert && Math.floor(sim.tick / 10) % 2 === 0;
  const curBiomeKey = sim.inHub ? 0 : sim.currentBiome;
  const statusChipStr = buildActivePlayerStatusString(p, curLocale === 'en');
  const trailQuant = sim.stressTestActive ? 10 : 100;
  const trailHash =
    Math.round(this.trailingHpRatio * trailQuant) * 1000 +
    Math.round(this.trailingArmorRatio * trailQuant);
  const activeWId = p.weaponSlots[p.activeWeaponSlot] ?? p.weaponSlots[0] ?? 'knight_sword';
  const activeWDef = WEAPONS[activeWId] ?? WEAPONS.knight_sword!;
  const cadenceStateHash = `${activeWId}:${p.clipAmmo}:${p.clipMax}:${Math.round(p.weaponHeat)}:${Math.round((p.reloadTimer ?? 0) * 20)}:${p.overclockedNextShot ? 1 : 0}:${Math.round((p.overheatLockTimer ?? 0) * 10)}:${p.meleeComboStep ?? 0}`;
  const blessingsSig = (p.blessingIds ?? []).join(',');
  const pactRelicSig = `${p.activePactId ?? ''}:${(p.awakenedRelicIds ?? []).join(',')}:${Math.ceil(p.pactKeepMorphedTimer ?? 0)}`;
  const topCardHash = `${p.hp}:${p.maxHp}:${p.armor}:${p.maxArmor}:${cadenceStateHash}:${p.characterId}:${p.slot}:${curBiomeKey}:${lowHpPulse ? 1 : 0}:${trailHash}:${statusChipStr}:${blessingsSig}:${pactRelicSig}:${curLocale}`;

  const sceneCache = this as GameScene & {
    lastTopCardHash?: string;
    lastAbilityHudHash?: string;
  };
  if (this.lastHudHp === -1) {
    sceneCache.lastTopCardHash = '';
    sceneCache.lastAbilityHudHash = '';
  }

  if (
    p.hp !== this.lastHudHp ||
    p.armor !== this.lastHudArmor ||
    p.clipAmmo !== this.lastHudEnergy ||
    p.gold !== this.lastHudGold ||
    p.characterId !== this.lastHudCharacterId
  ) {
    this.lastHudHp = p.hp;
    this.lastHudArmor = p.armor;
    this.lastHudEnergy = p.clipAmmo;
    this.lastHudGold = p.gold;
    this.lastHudCharacterId = p.characterId;
  }

  if (
    sceneCache.lastTopCardHash !== topCardHash &&
    (!sim.stressTestActive || sim.tick % 12 === 0 || !sceneCache.lastTopCardHash)
  ) {
    sceneCache.lastTopCardHash = topCardHash;

    const g = this.hudBarsGraphics;
    g.clear();

    const biomeAccent = getBiomeUiAccent(curBiomeKey);
    const slotHex = PLAYER_SLOT_COLORS[p.slot] ?? PALETTE.CYAN_FROST;

    // Main Top-Left Player Status Card
    drawStyledPanel(g, 12, 10, 204, 72, {
      fillColor: UI_THEME.panelBg,
      fillAlpha: 0.85,
      borderColor: lowHpPulse ? UI_THEME.status.hp : UI_THEME.panelBorder,
      borderWidth: lowHpPulse ? 1.8 : 1.4,
      radius: UI_THEME.panelRadius.md,
      accentColor: biomeAccent.accentNum,
      accentSide: 'left',
    });

    // Procedural Class Mini Portrait
    drawMiniCharacterPortrait(g, p.characterId, 34, 36, 15, slotHex);

    // 1. Segmented HP Bar + Heart Vector Icon
    drawVectorHudIcon(g, 'heart', 58, 21, 4.2, UI_THEME.status.hp);
    drawSegmentedBar(g, {
      x: 66,
      y: 17,
      width: 96,
      height: 8,
      current: p.hp,
      max: p.maxHp,
      trailingRatio: this.trailingHpRatio,
      maxSegments: Math.min(10, Math.max(1, p.maxHp)),
      gap: 1.5,
      fillColor: UI_THEME.status.hp,
      fillDarkColor: UI_THEME.status.hpDark,
      trailColor: UI_THEME.status.hpTrail,
      pulseAlert: lowHpPulse,
    });

    // 2. Segmented Armor Bar + Shield Vector Icon
    drawVectorHudIcon(g, 'shield', 58, 34.5, 4.2, UI_THEME.status.armor);
    drawSegmentedBar(g, {
      x: 66,
      y: 30.5,
      width: 96,
      height: 7.5,
      current: p.armor,
      max: Math.max(1, p.maxArmor),
      trailingRatio: this.trailingArmorRatio,
      maxSegments: Math.min(8, Math.max(1, p.maxArmor)),
      gap: 1.5,
      fillColor: UI_THEME.status.armor,
      fillDarkColor: UI_THEME.status.armorDark,
      trailColor: UI_THEME.status.armorTrail,
    });

    // 3. Weapon Cadence Bar (CLIP_RELOAD / HEAT_VENT / MELEE_COMBO) + Vector Icon
    drawVectorHudIcon(
      g,
      activeWDef.cadenceKind === 'MELEE_COMBO' ? 'sword' : 'bolt',
      58,
      48,
      4.2,
      activeWDef.cadenceKind === 'HEAT_VENT' && (p.overheatLockTimer ?? 0) > 0
        ? UI_THEME.status.hp
        : UI_THEME.status.energy,
    );
    drawHudWeaponCadenceBar(g, p, activeWDef, 66, 44, 96, 7.5);

    // 4. Bottom Footer Strip inside Card: Class Name + Gold Coin Pill
    g.fillStyle(UI_THEME.status.goldDark, 0.78);
    g.fillRect(114, 58, 94, 17);
    g.fillStyle(UI_THEME.panelBgDark, 0.92);
    g.fillRect(115, 59, 92, 15);
    drawVectorHudIcon(g, 'coin', 124, 66.5, 4.5, UI_THEME.status.gold);

    const charDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
    const charName = i18n.charName(p.characterId, charDef.nameVi);
    const classStr = `P${p.slot} · ${charName}`;
    if (this.playerClassLabelText && this.playerClassLabelText.text !== classStr) {
      this.playerClassLabelText.setText(classStr);
    }
    const hpStr = `${p.hp}/${p.maxHp}`;
    if (this.hpLabelText.text !== hpStr) {
      this.hpLabelText.setText(hpStr);
    }
    const armorStr = `${p.armor}/${p.maxArmor}`;
    if (this.armorLabelText.text !== armorStr) {
      this.armorLabelText.setText(armorStr);
    }
    const cadenceLabel = formatWeaponCadenceHudLabel(
      p,
      activeWDef,
      curLocale === 'en' ? 'en' : 'vi',
    );
    const energyStr = cadenceLabel.barText;
    if (this.energyLabelText.text !== energyStr) {
      this.energyLabelText.setText(energyStr);
    }

    if (statusChipStr.length > 0) {
      const pillW = Math.min(204, Math.max(76, statusChipStr.length * 5.2 + 18));
      drawStyledPanel(g, 12, 84, pillW, 16, {
        fillColor: UI_THEME.panelBgDark,
        fillAlpha: 0.9,
        borderColor: hexToNum(PALETTE.CYAN_FROST),
        borderWidth: 1,
        radius: 4,
      });
    }
    const chipsY = statusChipStr.length > 0 ? 102 : 85;
    const blessingCount = drawPlayerBlessingChipsHud(this, g, p, 12, chipsY);
    const pactRelicY = blessingCount > 0 ? chipsY + 18 : chipsY;
    drawPlayerPactAndRelicHudBadges(this, g, p, 12, pactRelicY, curLocale === 'en');
  }

  if (this.goldLabelText && (!sim.stressTestActive || sim.tick % 15 === 0)) {
    const goldLabel = curLocale === 'en' ? `${p.gold} Gold` : `${p.gold} Vàng`;
    if (this.goldLabelText.text !== goldLabel) {
      this.goldLabelText.setText(goldLabel);
    }
  }

  // Active status effects / Elementalist imbue chip line below player card
  if (this.statusLineText) {
    if (statusChipStr.length > 0) {
      if (this.statusLineText.text !== statusChipStr) {
        this.statusLineText.setText(statusChipStr);
      }
      if (!this.statusLineText.visible) {
        this.statusLineText.setVisible(true);
      }
    } else if (this.statusLineText.visible) {
      this.statusLineText.setVisible(false);
    }
  }

  // Update Bottom-Right Circular Skill [Space] & Dash [Shift] Cooldown Widgets (dirty-checked at 0.1s resolution)
  if (this.abilityHudGraphics && (!sim.stressTestActive || sim.tick % 12 === 0)) {
    const showHints = gState.showKeyHints;
    const skillCdQuant = Math.ceil(Math.max(0, p.skillCooldownTimer) * 10);
    const skillActQuant = Math.ceil(Math.max(0, p.skillActiveTimer) * 10);
    const dashCdQuant = Math.ceil(Math.max(0, p.dashCooldownTimer) * 10);
    const dashActQuant = Math.ceil(Math.max(0, p.dashTimer) * 10);
    const abilityHash = `${p.characterId}:${skillCdQuant}:${skillActQuant}:${dashCdQuant}:${dashActQuant}:${showHints ? 1 : 0}:${curLocale}`;

    if (sceneCache.lastAbilityHudHash !== abilityHash) {
      sceneCache.lastAbilityHudHash = abilityHash;
      const ag = this.abilityHudGraphics;
      ag.clear();

      const cDef = CHARACTERS[p.characterId] ?? CHARACTERS.vanguard;
      const skillMaxCd = Math.max(0.5, cDef.skill.cooldownSec);
      const skillGeo = drawCircularCooldown(ag, {
        cx: -352,
        cy: -32,
        radius: 16,
        remainingSec: p.skillCooldownTimer,
        totalSec: skillMaxCd,
        activeSec: p.skillActiveTimer,
        accentColor: 0x4ade80,
        iconKind: 'skill',
      });

      const dashGeo = drawCircularCooldown(ag, {
        cx: -308,
        cy: -32,
        radius: 16,
        remainingSec: p.dashCooldownTimer,
        totalSec: 1.2,
        activeSec: p.dashTimer,
        accentColor: 0x38bdf8,
        iconKind: 'dash',
      });

      if (showHints) {
        drawKeyChip(ag, -366, -56, 'Space', { active: skillGeo.isReady || skillGeo.isActive });
        drawKeyChip(ag, -321, -56, 'Shift', { active: dashGeo.isReady || dashGeo.isActive });
      }

      if (this.skillLabelText && this.skillLabelText.visible !== showHints) {
        this.skillLabelText.setVisible(showHints);
      }
      if (this.dashLabelText && this.dashLabelText.visible !== showHints) {
        this.dashLabelText.setVisible(showHints);
      }

      if (this.skillCdText) {
        const skTxt =
          p.skillActiveTimer > 0
            ? `${p.skillActiveTimer.toFixed(1)}s`
            : skillGeo.isReady
              ? curLocale === 'en'
                ? 'RDY'
                : 'SẴN'
              : skillGeo.cooldownText;
        const skCol =
          p.skillActiveTimer > 0
            ? PALETTE.SOLAR_GOLD
            : skillGeo.isReady
              ? PALETTE.LIME_GLOW
              : PALETTE.BONE_WHITE;
        if (this.skillCdText.text !== skTxt) this.skillCdText.setText(skTxt);
        if (this.skillCdText.style.color !== skCol) this.skillCdText.setColor(skCol);
      }
      if (this.dashCdText) {
        const dTxt = dashGeo.isReady
          ? curLocale === 'en'
            ? 'RDY'
            : 'SẴN'
          : dashGeo.cooldownText;
        const dCol = dashGeo.isReady ? PALETTE.CYAN_FROST : PALETTE.BONE_WHITE;
        if (this.dashCdText.text !== dTxt) this.dashCdText.setText(dTxt);
        if (this.dashCdText.style.color !== dCol) this.dashCdText.setColor(dCol);
      }
    }
  }

  // Update statsLineText (kept up to date for debug verification; visible only when ?debug=1)
  const statsTickInterval = sim.stressTestActive ? 60 : 12;
  if (sim.tick % statsTickInterval === 0 || sim.inHub || !this.lastHudStatsText) {
    const dps = sim.stressTestActive ? Math.round(sim.getRollingDps()) : sim.getRollingDps();
    const room = sim.getCurrentRoom();
    const roomLabel = sim.inHub ? i18n.t('ui.hud.hub') : i18n.roomTypeName(room.type);
    const showDebug = isEffectiveDebugUiEnabled(this.coopMode !== 'solo');
    const dpsSegment = showDebug ? ` · DPS ${dps.toFixed(1)}` : '';
    const nextStats = sim.inHub
      ? i18n.t('ui.hud.hubStatsHint', { count: sim.getActivePlayerCount() })
      : `${i18n.t('ui.hud.floor')} ${sim.currentFloor}/${sim.campaignMaxFloors} (${roomLabel})${dpsSegment} · ${i18n.t('ui.hud.gold')} ${p.gold} · ${i18n.t('ui.hud.wave')} ${sim.waveNumber}`;
    const statsCacheKey = `${showDebug ? '1' : '0'}:${nextStats}`;
    if (statsCacheKey !== this.lastHudStatsText) {
      this.lastHudStatsText = statsCacheKey;
      this.statsLineText.setText(nextStats);
    }
  }

  const elemKey = `${p.activeImbueElement}:${curLocale}`;
  if (this.elementBtnText && elemKey !== this.lastHudElement) {
    this.lastHudElement = elemKey;
    this.elementBtnText.setText(
      `${i18n.t('ui.hud.elementBtn')}: ${i18n.elementName(p.activeImbueElement)}`,
    );
  }

  const q = gState.quality;
  const qKey = `${q}:${curLocale}`;
  if (this.qualityBtnText && qKey !== this.lastHudQuality) {
    this.lastHudQuality = qKey;
    const qLabel =
      q === 'high'
        ? i18n.t('ui.settings.qualityHigh')
        : q === 'medium'
          ? i18n.t('ui.settings.qualityMedium')
          : i18n.t('ui.settings.qualityLow');
    this.qualityBtnText.setText(`${i18n.t('ui.hud.qualityBtn')}: ${qLabel}`);
  }

  // Update Bottom-Right 2-slot Weapon Cards (Active Enlarged & Highlighted, Inactive Compact & Dimmed)
  const upgSig = `${p.weaponUpgradeLevels?.[0] ?? 0},${p.weaponUpgradeLevels?.[1] ?? 0}`;
  const mutSig = `${(p.weaponMutators?.[0] ?? []).join('+')}|${(p.weaponMutators?.[1] ?? []).join('+')}`;
  const weaponHash = `${p.activeWeaponSlot}:${p.weaponSlots.join(',')}:${upgSig}:${mutSig}:${cadenceStateHash}:${curLocale}:${gState.showKeyHints ? 1 : 0}`;
  if (weaponHash !== this.lastHudWeaponHash) {
    this.lastHudWeaponHash = weaponHash;
    const invBake = 1 / TextureBaker.getBakeScale();
    const showHints = gState.showKeyHints;

    const activeW = 152;
    const activeH = 44;
    const inactiveW = 116;
    const inactiveH = 38;
    const gap = 6;
    const rightMargin = -12;

    this.weaponSlotBgs.forEach((slotBg, idx) => {
      const wId = p.weaponSlots[idx];
      const wDef = wId ? WEAPONS[wId] : undefined;
      const isSelected = idx === p.activeWeaponSlot && Boolean(wDef);

      const slot0W = p.activeWeaponSlot === 0 ? activeW : inactiveW;
      const slot1W = p.activeWeaponSlot === 1 ? activeW : inactiveW;
      const totalClusterW = slot0W + gap + slot1W;
      const clusterStartX = rightMargin - totalClusterW;

      const cardW = isSelected ? activeW : inactiveW;
      const cardH = isSelected ? activeH : inactiveH;
      const sx = idx === 0 ? clusterStartX : clusterStartX + slot0W + gap;
      const sy = isSelected ? -10 - activeH : -10 - inactiveH;

      const icon = this.weaponIconSprites[idx];
      const nameTxt = this.weaponNameTexts[idx];
      const metaTxt = this.weaponMetaTexts[idx];
      const keyTxt = this.weaponKeyTexts[idx];

      slotBg.clear();
      if (wId && wDef) {
        const rarityHex = WEAPON_RARITY_COLORS[wDef.rarity];
        const rarityNum = hexToNum(rarityHex);
        drawStyledPanel(slotBg, sx, sy, cardW, cardH, {
          fillColor: isSelected ? UI_THEME.panelBgElevated : UI_THEME.panelBgDark,
          fillAlpha: isSelected ? 0.94 : 0.78,
          borderColor: isSelected ? hexToNum(PALETTE.SOLAR_GOLD) : rarityNum,
          borderWidth: isSelected ? 2 : 1.2,
          radius: UI_THEME.panelRadius.md,
          accentColor: rarityNum,
          accentSide: 'left',
        });

        if (showHints) {
          const chip = drawKeyChip(slotBg, sx + cardW - 18, sy + 4, `${idx + 1}`, {
            active: isSelected,
          });
          if (keyTxt) {
            keyTxt.setVisible(true);
            keyTxt.setPosition(sx + cardW - 18 + chip.width * 0.5, sy + 4 + chip.height * 0.5);
            keyTxt.setColor(isSelected ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT);
          }
        } else if (keyTxt) {
          keyTxt.setVisible(false);
        }

        if (icon) {
          icon.setVisible(true);
          icon.setTexture(TextureBaker.getWeaponTextureKey(wId));
          icon.setPosition(sx + 21, sy + cardH * 0.5);
          icon.setScale(invBake * (isSelected ? 0.68 : 0.56));
          icon.setAlpha(isSelected ? 1 : 0.78);
        }
        if (nameTxt) {
          const rawName = i18n.weaponName(wId, wDef.nameVi);
          const upgLv = p.weaponUpgradeLevels?.[idx] ?? 0;
          const displayName = formatWeaponCardSlotTitle(rawName, upgLv, isSelected);
          nameTxt.setText(displayName);
          nameTxt.setPosition(sx + 38, sy + (isSelected ? 13 : 11));
          nameTxt.setColor(isSelected ? rarityHex : PALETTE.SILVER_BRIGHT);
          nameTxt.setAlpha(isSelected ? 1 : 0.85);
        }
        drawWeaponSlotMutatorGems(
          slotBg,
          sx,
          sy,
          cardW,
          cardH,
          p.weaponMutators?.[idx] ?? [],
          p.weaponUpgradeLevels?.[idx] ?? 0,
          isSelected,
        );
        if (metaTxt) {
          metaTxt.setText(
            formatWeaponCadenceHudLabel(p, wDef, curLocale === 'en' ? 'en' : 'vi').cardMetaText,
          );
          metaTxt.setPosition(sx + 38, sy + (isSelected ? 30 : 26));
          metaTxt.setColor(isSelected ? PALETTE.BONE_WHITE : PALETTE.STEEL_LIGHT);
          metaTxt.setAlpha(isSelected ? 1 : 0.8);
        }
      } else {
        drawStyledPanel(slotBg, sx, sy, cardW, cardH, {
          fillColor: UI_THEME.panelBgDark,
          fillAlpha: 0.65,
          borderColor: UI_THEME.panelBorder,
          borderWidth: 1,
          radius: UI_THEME.panelRadius.md,
        });
        if (icon) icon.setVisible(false);
        if (keyTxt) keyTxt.setVisible(false);
        if (nameTxt) {
          nameTxt.setText(curLocale === 'en' ? 'Empty Slot' : 'Ô Trống');
          nameTxt.setPosition(sx + 12, sy + 12);
          nameTxt.setColor(PALETTE.STEEL_LIGHT);
        }
        if (metaTxt) {
          metaTxt.setText(curLocale === 'en' ? '[E] Equip' : '[E] Nhặt');
          metaTxt.setPosition(sx + 12, sy + 26);
          metaTxt.setColor(PALETTE.STEEL_LIGHT);
        }
      }
    });
  }

  if (!sim.stressTestActive) {
    this.updateMinimapHud();
    this.updateBossHud();
    this.updateTopCenterBannersAndQol(1 / 60);
    this.updateCoopTeammateHud();
    this.updateHubInvitePanel();
    this.updateHubCharacterSkillPreview();
    this.updateWeaponComparisonCard();
    this.updateEmoteWheelHud();
    this.updateOffscreenTeammateArrows();
    this.updateModalHud();
  }
}

export function updateCoopTeammateHudImpl(this: GameScene): void {
  const ui = this.uiScene;
  const sim = this.transport.getSim();
  const debug = initGlobalDebugState();
  const remotes = sim.stressTestActive ? [] : sim.simulatedPlayers;
  const telemetry = this.networkTransport?.getTelemetry();
  const localHighPing = (telemetry?.rttMs ?? 0) > 100 ? 1 : 0;
  const resultModalActive =
    (sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed;
  const hash =
    debug.overlayVisible || remotes.length === 0 || resultModalActive
      ? ''
      : remotes
          .map(
            (r) =>
              `${r.id}:${r.slot}:${r.displayName}:${r.characterId}:${r.hp}:${r.maxHp}:${r.armor}:${r.lifeState}:${Math.round(r.reviveProgress * 20)}:${Math.ceil((r as { bleedoutTimer?: number }).bleedoutTimer ?? r.downedTimer)}:${r.ready ? 1 : 0}:${Math.ceil(r.skillCooldownTimer)}:${r.pingMs}`,
          )
          .join('|') + `:${localHighPing}:${i18n.getLocale()}:${this.currentHudUiScale}`;

  if (hash === this.lastCoopHudHash) return;
  this.lastCoopHudHash = hash;

  this.coopHudContainer.removeAll(true);
  if (!hash) return;

  const textRes = computeUiTextResolution(
    typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1,
    ui.cameras?.main?.zoom || 2,
    this.currentHudUiScale || 1,
  );
  const cardW = 198;
  const cardH = 38;
  const startX = 12;
  const startY = 0;

  remotes.forEach((cp, idx) => {
    const cy = startY + idx * (cardH + 5);
    const slotHex = PLAYER_SLOT_COLORS[cp.slot];
    const slotNum = hexToNum(slotHex);
    const playerPing = Math.max(1, Math.round(cp.pingMs || (telemetry?.rttMs ?? 8)));
    const isHighPing = playerPing > 100;
    const skillReady = cp.skillCooldownTimer <= 0;
    const cpBleedout = (cp as { bleedoutTimer?: number }).bleedoutTimer ?? cp.downedTimer;
    const isDowned = cp.lifeState === 'downed' || cpBleedout > 0;

    const bg = ui.add.graphics();
    drawStyledPanel(bg, startX, cy, cardW, cardH, {
      fillColor: isDowned ? 0x2a1218 : UI_THEME.panelBg,
      fillAlpha: 0.84,
      borderColor: isDowned ? UI_THEME.status.hp : slotNum,
      borderWidth: isDowned ? 1.6 : 1.2,
      radius: UI_THEME.panelRadius.sm,
      accentColor: isDowned ? UI_THEME.status.hp : slotNum,
      accentSide: 'left',
    });

    drawMiniCharacterPortrait(bg, cp.characterId, startX + 16, cy + 19, 10.5, slotHex);

    // Segmented Mini HP / Revive bar
    drawSegmentedBar(bg, {
      x: startX + 31,
      y: cy + 20,
      width: 78,
      height: 6,
      current: isDowned ? Math.max(1, Math.round(cp.reviveProgress * 8)) : cp.hp,
      max: isDowned ? 8 : Math.max(1, cp.maxHp),
      maxSegments: 6,
      gap: 1,
      fillColor: isDowned ? 0x4ade80 : UI_THEME.status.hp,
      fillDarkColor: isDowned ? 0x15803d : UI_THEME.status.hpDark,
      pulseAlert: isDowned,
    });

    // Segmented Mini Armor bar
    drawSegmentedBar(bg, {
      x: startX + 31,
      y: cy + 28,
      width: 78,
      height: 4.5,
      current: cp.armor,
      max: Math.max(1, cp.maxArmor),
      maxSegments: 4,
      gap: 1,
      fillColor: UI_THEME.status.armor,
      fillDarkColor: UI_THEME.status.armorDark,
    });

    this.coopHudContainer.add(bg);

    const skillTag = skillReady ? 'KN✓' : `${Math.ceil(cp.skillCooldownTimer)}s`;
    const stateTag = isDowned
      ? cp.reviveProgress > 0.01
        ? `Cứu ${Math.round(cp.reviveProgress * 100)}%`
        : `${i18n.t('ui.hud.downed')} ${Math.ceil(cpBleedout)}s`
      : cp.lifeState === 'ghost'
        ? i18n.t('ui.hud.ghost')
        : `${cp.hp}/${cp.maxHp} · ${skillTag}`;

    const title = ui.add
      .text(
        startX + 31,
        cy + 10,
        `P${cp.slot} ${cp.displayName}`,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 800,
          color: slotHex,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);

    const pingText = ui.add
      .text(
        startX + cardW - 6,
        cy + 10,
        `${isHighPing ? '⚠' : ''}${playerPing}ms`,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 700,
          color: isHighPing ? PALETTE.SOLAR_GOLD : PALETTE.SILVER_BRIGHT,
          resolution: textRes,
        }),
      )
      .setOrigin(1, 0.5);

    const sub = ui.add
      .text(
        startX + 114,
        cy + 25,
        stateTag,
        createUiTextStyle({
          fontPxAt1080p: 13,
          weight: 700,
          color: isDowned
            ? PALETTE.CRIMSON_BRIGHT
            : skillReady
              ? PALETTE.LIME_GLOW
              : PALETTE.BONE_WHITE,
          resolution: textRes,
        }),
      )
      .setOrigin(0, 0.5);

    this.coopHudContainer.add([title, pingText, sub]);
  });
}

export const BOSS_STAGGER_BAR_COLOR = 0xf59e0b; // #F59E0B Amber-Orange
export const BOSS_STAGGER_BAR_HIGHLIGHT = 0xfbbf24; // #FBBF24 Warm Gold

/**
 * Renders the P3B.1 Boss Stagger Bar (`bossStaggerAccum / 100`, #F59E0B / #FBBF24)
 * right beneath the Boss HP bar in the top-center Boss HUD panel.
 */
export function drawBossStaggerBarHud(
  g: Phaser.GameObjects.Graphics,
  boss: SimEnemyState,
  bx: number,
  staggerY: number,
  bw: number,
): void {
  const staggerH = 4.5;
  const accum = clamp(boss.bossStaggerAccum ?? 0, 0, BOSS_STAGGER_MAX);
  const ratio = clamp(accum / BOSS_STAGGER_MAX, 0, 1);
  const onCooldown = (boss.bossStaggerCooldownTimer ?? 0) > 0;

  // Track background & border
  g.fillStyle(UI_THEME.inkDark, 0.92);
  g.fillRect(bx, staggerY, bw, staggerH);
  g.lineStyle(1, onCooldown ? 0x64748b : BOSS_STAGGER_BAR_COLOR, 0.78);
  g.strokeRect(bx, staggerY, bw, staggerH);

  // Orange-gold fill (#F59E0B base + #FBBF24 highlight strip)
  if (ratio > 0) {
    const fillW = Math.max(2, (bw - 2) * ratio);
    g.fillStyle(onCooldown ? 0x94a3b8 : BOSS_STAGGER_BAR_COLOR, 0.95);
    g.fillRect(bx + 1, staggerY + 1, fillW, staggerH - 2);
    g.fillStyle(onCooldown ? 0xcbd5e1 : BOSS_STAGGER_BAR_HIGHLIGHT, 0.95);
    g.fillRect(bx + 1, staggerY + 1, fillW, Math.max(1, (staggerH - 2) * 0.45));
  }

  // 25% / 50% / 75% stagger notch ticks
  for (const notch of [0.25, 0.5, 0.75]) {
    const nx = bx + bw * notch;
    g.lineStyle(1, UI_THEME.inkDark, 0.85);
    g.beginPath();
    g.moveTo(nx, staggerY);
    g.lineTo(nx, staggerY + staggerH);
    g.strokePath();
  }
}
