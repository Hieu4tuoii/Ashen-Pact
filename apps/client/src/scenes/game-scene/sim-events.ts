import {
  clamp,
  ELEMENTAL_REACTIONS,
  type ElementType,
  SHOT_FLAG,
  i18n,
  type SimEvent,
  WEAPON_RARITY_COLORS,
} from '@ashen-pact/shared';
import { PALETTE } from '../../art/palette.js';
import { resolveWeaponShootSfx, zzfx } from '../../audio/zzfx.js';
import {
  spawnClassSkillCastVfx,
  spawnClassSummonSpawnedVfx,
  spawnEngineerEmpBlastVfx,
  spawnVanguardShieldShockwaveVfx,
} from '../../fx/combat-fx-classes.js';
import {
  spawnChasmRingOutVfx,
  spawnCoverFlipMicroBlankVfx,
  spawnCrossbowBarbedRipVfx,
  spawnFragLauncherAirburstVfx,
  spawnGaleCycloneVentVfx,
  spawnGaleWindBladeVfx,
  spawnKnightSwordParryDeflectVfx,
  spawnPropDashKickVfx,
  spawnRivetDetonationWebVfx,
  spawnScrapShotgunBlastVfx,
  spawnScrapShotgunShellEjectVfx,
  spawnSeedGunHarvestBloomVfx,
  spawnTacticalVentVfx,
  spawnTetherElectromagneticYankVfx,
  spawnThornBloomVfx,
  spawnThornStaffWhipVfx,
  spawnTotemCollapseLaneVfx,
  spawnTriElementalBeamVfx,
  spawnWallSlamVfx,
  triggerMicroBarFeedbackOnScene,
  handleBatch2WeaponSimEvent,
  handleP1CSimEvent,
  spawnP1DBlessingEventFx,
} from '../../fx/combat-fx-weapons-v2.js';
import { handleP2BSimEvent } from '../../fx/combat-fx-p2b.js';
import { handleP4ASimEvent } from '../../fx/combat-fx-p4a.js';
import { handleP4BSimEvent } from '../../fx/combat-fx-p4b.js';
import { type GameScene, RIG_FOOT_OFFSET_Y } from '../GameScene.js';
import { handleP2AForgeAndSalvageSimEvent } from './hud-pact-and-forge-modals.js';
import { triggerP11WaveBanner } from './p11-drama-hud.js';
import { recordChestOpenedAnim } from './room-entities-sync.js';

export function processSimEventsImpl(this: GameScene, events: SimEvent[]): void {
  if (events.length === 0) return;

  const sim = this.transport.getSim();
  const isStress = sim.stressTestActive;
  const allowStressSfx = !isStress || sim.tick % 8 === 0;
  let playerShotFxTriggered = false;
  let enemyShotSfxTriggered = false;
  let enemyHitCountThisStep = 0;
  let statusFxCountThisStep = 0;
  let enemyHitCritThisStep = false;
  let enemyHitSfxX = this.camFocusX;
  let enemyHitSfxY = this.camFocusY;
  let maxHitStopMs = 0;
  let maxHitStopTrauma = 0;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;
    if (spawnP1DBlessingEventFx(this, ev, sim, isStress, allowStressSfx)) continue;
    if (handleP1CSimEvent(this, ev, sim, isStress, allowStressSfx)) continue;
    if (handleBatch2WeaponSimEvent(this, ev, sim, isStress, allowStressSfx)) continue;
    if (handleP2AForgeAndSalvageSimEvent(this, ev, isStress, allowStressSfx)) continue;
    if (handleP2BSimEvent(this, ev, sim, isStress, allowStressSfx)) continue;
    if (handleP4ASimEvent(this, ev, sim, isStress, allowStressSfx)) continue;
    if (handleP4BSimEvent(this, ev)) continue;
    switch (ev.kind) {
      case 'projectile_spawned': {
        if (ev.team === 'player') {
          let spawnedProj = undefined;
          for (let pi = sim.projectiles.length - 1; pi >= 0; pi--) {
            const b = sim.projectiles[pi]!;
            if (b.id === ev.projectileId) {
              spawnedProj = b;
              break;
            }
          }
          const isFinale = ((spawnedProj?.shotFlags ?? 0) & SHOT_FLAG.FINALE_SHOT) !== 0;

          if (ev.weaponId === 'knight_sword_parry' && !isStress) {
            spawnKnightSwordParryDeflectVfx(this, this.fx, ev.x, ev.y, ev.angle);
            if (allowStressSfx) {
              zzfx.play('bullet_deflect', ev.x, this.camFocusX, ev.y, this.camFocusY);
            }
          } else if (ev.weaponId === 'thorn_staff' && !isStress) {
            spawnThornStaffWhipVfx(this, this.fx, ev.x, ev.y, ev.angle, isFinale);
          } else if (ev.weaponId === 'gale_smg_wind_blade' && !isStress) {
            spawnGaleWindBladeVfx(this, this.fx, ev.x, ev.y, ev.angle);
            if (allowStressSfx) {
              zzfx.play('gale_wind_blade', ev.x, this.camFocusX, ev.y, this.camFocusY);
            }
          } else if (ev.weaponId === 'hunter_crossbow' && !isStress && isFinale) {
            this.fx.spawnShaderDirectional?.(
              ev.x,
              ev.y,
              64,
              ev.angle,
              'fx_sh_falcon_sonic',
              { tint: 0xbae6fd, ttl: 0.2 },
            );
          }
          if (!playerShotFxTriggered) {
            playerShotFxTriggered = true;
            if (ev.weaponId === 'scrap_shotgun' && !isStress) {
              spawnScrapShotgunBlastVfx(this, this.fx, ev.x, ev.y, ev.angle, isFinale);
            }
            const shootSfx = resolveWeaponShootSfx(ev.weaponId);
            const isShotgun = shootSfx === 'shoot_shotgun';
            const isTeammate =
              spawnedProj?.ownerId !== undefined && spawnedProj.ownerId !== sim.player.id;
            if (!isStress || sim.tick % 3 === 0) {
              this.fx.spawnMuzzleFlashAndCasing(
                ev.x,
                ev.y,
                ev.angle,
                isShotgun,
                isTeammate,
                ev.weaponId,
              );
            }
            if (!isStress && isShotgun) {
              this.lighting.spawnTransientLight(ev.x, ev.y, 48, PALETTE.SOLAR_GOLD, 0.36, 0.06);
            }
            if (!isTeammate) {
              this.crosshairPulse = isShotgun ? 0.9 : 0.45;
              this.playerRig?.triggerRecoil(isShotgun ? 6.5 : 4.2);
            }

            if (allowStressSfx) {
              zzfx.play(shootSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
              if (!isTeammate && isShotgun) {
                this.fx.addTrauma(0.08);
              }
            }
          }
        } else if (!enemyShotSfxTriggered && allowStressSfx) {
          enemyShotSfxTriggered = true;
          zzfx.play('shoot_pistol', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'melee_swing': {
        const isTeammate = ev.playerId !== sim.player.id;
        const lungeDx = ev.lungeDx ?? 0;
        const lungeDy = ev.lungeDy ?? 0;
        const lungeDist = Math.hypot(lungeDx, lungeDy);
        if (!isTeammate) {
          this.playerRig?.triggerMeleeSwing(lungeDx, lungeDy);
          this.crosshairPulse = 0.6;
          if (!isStress && lungeDist >= 8 && this.playerRig) {
            this.fx.spawnDashAfterimage?.(
              ev.x - lungeDx,
              ev.y - lungeDy + RIG_FOOT_OFFSET_Y,
              this.playerRig.getFacingSign(),
              sim.player.slot,
              false,
            );
          }
        } else {
          this.coopPlayerRigs.get(ev.playerId)?.rig.triggerMeleeSwing(lungeDx, lungeDy);
          this.simPlayerRigs.get(ev.playerId)?.triggerMeleeSwing(lungeDx, lungeDy);
        }
        const swinger = sim.getAllPlayers
          ? (sim.getAllPlayers().find((pl) => pl.id === ev.playerId) ?? sim.player)
          : sim.player;
        const postComboStep = swinger?.meleeComboStep;
        const executedComboStep =
          postComboStep === 1 ? 0 : postComboStep === 2 ? 1 : postComboStep === 0 ? 2 : 0;
        this.fx.spawnMeleeSlash(ev.x, ev.y, ev.angle, isTeammate, {
          weaponId: ev.weaponId,
          comboStep: executedComboStep,
          rangePx: ev.range,
          lungeDx,
          lungeDy,
        });
        this.lighting.spawnTransientLight(ev.x, ev.y, 92, PALETTE.CYAN_FROST, 0.65, 0.12);
        const swingSfx = resolveWeaponShootSfx(ev.weaponId);
        zzfx.play(swingSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
        if (ev.bulletsDestroyed > 0) {
          if (!isStress) {
            this.fx.spawnFloatingAlert(ev.x + 18, ev.y - 14, ev.bulletsDestroyed > 1 ? `PARRY ×${ev.bulletsDestroyed}!` : 'PARRY!', '#FEF08A');
          }
          zzfx.play('bullet_deflect', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'damage_dealt': {
        if (!isStress || (enemyHitCountThisStep === 0 && sim.tick % 10 === 0)) {
          this.fx.spawnDamagePopup({
            x: ev.x,
            y: ev.y,
            amount: ev.amount,
            isCrit: ev.isCrit,
            targetKind: ev.targetKind,
            hitArmor: ev.hitArmor,
            element: ev.element,
          });
        }
        const hitAngle = Math.atan2(ev.knockbackY, ev.knockbackX);
        const sparkCount = enemyHitCountThisStep === 0 ? (ev.isCrit ? 8 : 5) : 2;
        if (!isStress || enemyHitCountThisStep < 2) {
          this.fx.spawnHitSparks(ev.x, ev.y, hitAngle, {
            isCrit: ev.isCrit,
            element: ev.element,
            count: sparkCount,
          });
        }

        if (ev.targetKind === 'enemy') {
          if (!isStress || enemyHitCountThisStep < 2) {
            const rig = this.enemyRigs.get(ev.targetId);
            rig?.triggerHitFlash(0.12);
          }
          enemyHitCountThisStep += 1;
          if (ev.isCrit) {
            enemyHitCritThisStep = true;
          }
          enemyHitSfxX = ev.x;
          enemyHitSfxY = ev.y;
        } else if (ev.targetId === sim.player.id) {
          this.playerRig?.triggerHitFlash(0.16);
          if (Math.hypot(ev.knockbackX, ev.knockbackY) > 0.01) {
            this.triggerPlayerHitDirectionIndicator(Math.atan2(-ev.knockbackY, -ev.knockbackX));
          } else {
            this.triggerPlayerHitDirectionIndicator(-Math.PI * 0.5);
          }
          zzfx.play('player_hurt', ev.x, this.camFocusX, ev.y, this.camFocusY);
        } else {
          this.coopPlayerRigs.get(ev.targetId)?.rig.triggerHitFlash(0.16);
          this.simPlayerRigs.get(ev.targetId)?.triggerHitFlash(0.16);
          zzfx.play('player_hurt', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'armor_broken': {
        if (!isStress) {
          this.fx.spawnHitSparks(ev.x, ev.y, 0, {
            isCrit: true,
            element: 'shock',
            count: 8,
          });
          this.lighting.spawnTransientLight(ev.x, ev.y, 110, PALETTE.SOLAR_GOLD, 0.9, 0.25);
          const brokenBoss =
            ev.targetKind === 'enemy'
              ? sim.enemies.find((e) => e.id === ev.targetId && e.isBoss)
              : undefined;
          this.fx.spawnShaderDirectional?.(
            ev.x,
            ev.y,
            brokenBoss ? 86 : 56,
            -Math.PI * 0.5,
            'fx_sh_aegis_crest',
            { tint: 0xfef08a, ttl: 0.26 },
          );
          if (brokenBoss) {
            this.fx.spawnExplosionBurst(ev.x, ev.y, 82, PALETTE.SOLAR_GOLD);
          }
        }
        if (allowStressSfx) {
          zzfx.play('armor_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'projectile_impact': {
        if (!isStress || i < 4) {
          this.fx.spawnHitSparks(ev.x, ev.y, ev.angle, {
            isCrit: ev.isCrit,
            hitWall: ev.hitWall,
            blockedByShield: ev.blockedByShield || ev.destroyedByMelee,
            element: ev.element,
            count: 4,
          });
        }
        if ((ev.blockedByShield || ev.destroyedByMelee) && allowStressSfx) {
          zzfx.play('bullet_deflect', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'entity_killed': {
        if (!isStress || statusFxCountThisStep < 1) {
          statusFxCountThisStep += 1;
          this.fx.spawnEnemyDeathBurst(ev.defId, ev.x, ev.y);
          if (
            ev.defId === 'spore_king' ||
            ev.defId === 'kryssa_ice_queen' ||
            ev.defId === 'forge_titan'
          ) {
            this.lighting.spawnTransientLight(ev.x, ev.y, 260, PALETTE.SOLAR_GOLD, 1.0, 0.55);
          }
          if (allowStressSfx) {
            zzfx.play('kill_enemy', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
        }
        break;
      }
      case 'dash_started': {
        this.fx.spawnDashDust(ev.x, ev.y + RIG_FOOT_OFFSET_Y);
        if (ev.playerId === sim.player.id) {
          if (this.playerRig) {
            this.fx.spawnDashAfterimage(
              ev.x,
              ev.y + RIG_FOOT_OFFSET_Y,
              this.playerRig.getFacingSign(),
              sim.player.slot,
              false,
            );
          }
        } else {
          const simRig =
            this.simPlayerRigs.get(ev.playerId) ?? this.coopPlayerRigs.get(ev.playerId)?.rig;
          const spState = sim.simulatedPlayers.find((sp) => sp.id === ev.playerId);
          this.fx.spawnDashAfterimage(
            ev.x,
            ev.y + RIG_FOOT_OFFSET_Y,
            simRig ? simRig.getFacingSign() : ev.dirX >= 0 ? 1 : -1,
            spState ? spState.slot : 2,
            true,
          );
        }
        if (allowStressSfx) {
          zzfx.play('dash', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'enemy_telegraph': {
        if (allowStressSfx) {
          zzfx.play('telegraph', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'explosion': {
        const srcId = ev.sourceDefId ?? '';
        const isSporePod =
          srcId === 'volatile_spore_pod' ||
          srcId === 'caustic_spore_pod' ||
          srcId === 'reload_caustic_pod' ||
          srcId === 'ranger_arrow_volley' ||
          srcId === 'thorn_staff' ||
          srcId.includes('spore') ||
          srcId.includes('poison');
        const isTriStaff = srcId === 'apprentice_staff';
        const isGaleCyclone = srcId === 'gale_smg';
        const isFragLauncher = srcId === 'frag_launcher';
        const isSeedGun = srcId === 'seed_gun';
        const isTetherStaff = srcId === 'tether_staff';
        const isSolarStaff = srcId === 'solar_archon_staff';
        const isMagmaCannon = srcId === 'magma_cannon';
        const isVoidStaff = srcId === 'void_staff';
        const isExecutionerScythe = srcId === 'relic_executioner_scythe';
        const isCryoBlast =
          srcId === 'duo_cryo_shatter_spire' ||
          srcId.includes('frost') ||
          srcId.includes('cryo') ||
          srcId.includes('ice') ||
          srcId.includes('glacial');
        const isThunderBlast =
          srcId === 'dash_thunder_decoy' ||
          srcId === 'tesla_turret_self_destruct' ||
          srcId === 'thunder_hammer' ||
          srcId.includes('thunder') ||
          srcId.includes('shock');
        const isTrueVoid = isVoidStaff || srcId.includes('void');
        const isSolarArcane = isTriStaff || isSolarStaff || srcId === 'knight_sword_parry';
        const colorHex = isExecutionerScythe
          ? PALETTE.CRIMSON_BRIGHT
          : isTrueVoid
            ? PALETTE.TOXIC_PURPLE
            : isSporePod || isSeedGun
              ? PALETTE.LIME_GLOW
              : isGaleCyclone || isCryoBlast
                ? PALETTE.CYAN_FROST
                : isTetherStaff
                  ? PALETTE.ELECTRIC_VIOLET
                  : isThunderBlast
                    ? PALETTE.VOLT_YELLOW
                    : isSolarArcane
                      ? PALETTE.SOLAR_GOLD
                      : PALETTE.FLAME_ORANGE;
        if (!isStress) {
          if (isTriStaff) {
            spawnTriElementalBeamVfx(
              this,
              this.fx,
              sim.player.x,
              sim.player.y,
              ev.x,
              ev.y,
              ev.radius,
            );
          } else if (isGaleCyclone) {
            spawnGaleCycloneVentVfx(this, this.fx, ev.x, ev.y, ev.radius, i18n.getLocale());
          } else if (isFragLauncher) {
            spawnFragLauncherAirburstVfx(
              this,
              this.fx,
              ev.x,
              ev.y,
              ev.radius,
              ev.radius >= 100,
              i18n.getLocale(),
            );
          } else if (isSeedGun) {
            const releasedHealingMist =
              events.some(
                (other) =>
                  (other.kind === 'status_applied' && other.status === 'rooted') ||
                  (other.kind === 'damage_dealt' && other.targetKind === 'enemy'),
              ) ||
              sim.enemies.some(
                (e) => e.hp > 0 && Math.hypot(e.x - ev.x, e.y - ev.y) <= ev.radius + e.radius,
              );
            spawnSeedGunHarvestBloomVfx(
              this,
              this.fx,
              ev.x,
              ev.y,
              ev.radius,
              releasedHealingMist,
              sim.player.x,
              sim.player.y,
              i18n.getLocale(),
            );
          } else if (isTetherStaff) {
            spawnTetherElectromagneticYankVfx(
              this,
              this.fx,
              sim.player.x,
              sim.player.y,
              ev.x,
              ev.y,
              ev.radius,
              i18n.getLocale(),
            );
          }
        }
        const hasDedicatedBatch2SpecialInTick =
          (isSolarStaff &&
            events.some(
              (other) => other.kind === 'solar_supernova' || other.kind === 'solar_converge_burst',
            )) ||
          (isMagmaCannon && events.some((other) => other.kind === 'magma_geyser_eruption')) ||
          (isVoidStaff && events.some((other) => other.kind === 'void_implosion'));
        const handledByDedicatedWeaponVfx =
          !isStress &&
          (isTriStaff ||
            isGaleCyclone ||
            isFragLauncher ||
            isSeedGun ||
            isTetherStaff ||
            hasDedicatedBatch2SpecialInTick ||
            isExecutionerScythe);
        if (!handledByDedicatedWeaponVfx) {
          const isOrdnanceShrapnel =
            srcId === 'explosive_barrel' ||
            srcId === 'coal_bomb' ||
            srcId === 'bullet_ricochet_boom' ||
            srcId === 'mutator_cluster_mortar';
          if (!isStress && this.fx.spawnShaderNova && isOrdnanceShrapnel) {
            this.fx.spawnShaderNova(ev.x, ev.y, ev.radius, 'fx_sh_shrapnel_corona');
            if (srcId !== 'explosive_barrel') {
              this.fx.spawnFloorDecal?.('scorch', ev.x, ev.y, clamp(ev.radius / 96, 0.5, 0.9));
            }
            this.fx.spawnHitSparks?.(ev.x, ev.y, 0, { isCrit: true, element: 'burn', count: 6 });
          } else if (!isStress && this.fx.spawnShaderNova && isSporePod) {
            this.fx.spawnShaderNova(ev.x, ev.y, ev.radius, 'fx_sh_spore_cloud');
            this.fx.spawnFloorDecal?.('splatter', ev.x, ev.y, clamp(ev.radius / 96, 0.5, 0.9));
            this.fx.spawnHitSparks?.(ev.x, ev.y, 0, { element: 'poison', count: 5 });
          } else if (!isStress && this.fx.spawnShaderNova && isThunderBlast) {
            this.fx.spawnShaderNova(ev.x, ev.y, ev.radius, 'fx_sh_anvil_storm');
            this.fx.spawnHitSparks?.(ev.x, ev.y, 0, { isCrit: true, element: 'shock', count: 6 });
          } else {
            this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, colorHex);
          }
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, ev.radius * 1.4, colorHex, 0.68, 0.24);
        if (allowStressSfx) {
          const explosionSfx = isGaleCyclone
            ? 'gale_cyclone_vent'
            : isFragLauncher && ev.radius >= 100
              ? 'frag_airburst'
              : isSeedGun
                ? 'seed_harvest_bloom'
                : isTetherStaff
                  ? 'tether_em_yank'
                  : 'explosion';
          zzfx.play(explosionSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'prop_destroyed': {
        if (ev.propKind === 'rotten_totem_pillar' && !isStress) {
          const fallenAngle =
            sim.props.find((p) => p.id === ev.propId)?.fallAngle ?? sim.player.aimAngle;
          spawnTotemCollapseLaneVfx(this, this.fx, ev.x, ev.y, fallenAngle);
        }
        this.fx.spawnPropBreakBurst(ev.propKind, ev.x, ev.y);
        if (ev.propKind !== 'explosive_barrel' && allowStressSfx) {
          zzfx.play('prop_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'cracked_wall_broken': {
        this.fx.spawnPropBreakBurst('clay_vase', ev.x, ev.y);
        this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.85, 0.4);
        zzfx.play('prop_break', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'status_applied': {
        if (!isStress || (statusFxCountThisStep < 1 && sim.tick % 4 === 0)) {
          statusFxCountThisStep += 1;
          this.fx.spawnStatusBurst(ev.status, ev.x, ev.y);
          if (!isStress) {
            if (ev.status === 'frozen') {
              this.lighting.spawnTransientLight(ev.x, ev.y, 96, PALETTE.CYAN_FROST, 0.9, 0.28);
              zzfx.play('freeze', ev.x, this.camFocusX, ev.y, this.camFocusY);
            } else if (ev.status === 'shatter') {
              this.lighting.spawnTransientLight(ev.x, ev.y, 124, PALETTE.CYAN_FROST, 1.0, 0.34);
              zzfx.play('shatter', ev.x, this.camFocusX, ev.y, this.camFocusY);
            } else if (ev.status === 'burn') {
              this.lighting.spawnTransientLight(ev.x, ev.y, 84, PALETTE.FLAME_ORANGE, 0.78, 0.2);
            } else if (ev.status === 'shock') {
              this.lighting.spawnTransientLight(ev.x, ev.y, 96, PALETTE.VOLT_YELLOW, 0.88, 0.22);
            }
          }
        }
        break;
      }
      case 'chain_lightning': {
        if (!isStress || (statusFxCountThisStep < 1 && sim.tick % 6 === 0)) {
          statusFxCountThisStep += 1;
          this.fx.spawnChainLightningArc(ev.fromX, ev.fromY, ev.toX, ev.toY);
          if (!isStress) {
            this.lighting.spawnTransientLight(
              (ev.fromX + ev.toX) * 0.5,
              (ev.fromY + ev.toY) * 0.5,
              110,
              PALETTE.CYAN_FROST,
              0.92,
              0.22,
            );
            zzfx.play('chain_lightning', ev.toX, this.camFocusX, ev.toY, this.camFocusY);
          }
        }
        break;
      }
      case 'surface_triggered': {
        if (allowStressSfx) {
          if (ev.surface === 'burning_oil' || ev.surface === 'burning_grass') {
            zzfx.play('surface_ignite', ev.x, this.camFocusX, ev.y, this.camFocusY);
          } else if (ev.surface === 'electrified_water') {
            zzfx.play('chain_lightning', ev.x, this.camFocusX, ev.y, this.camFocusY);
          } else if (ev.surface === 'ice') {
            zzfx.play('freeze', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
        }
        break;
      }
      case 'grass_rustle': {
        if (!isStress) {
          this.fx.spawnGrassRustle(ev.x, ev.y);
        }
        break;
      }
      case 'skill_cast': {
        if (ev.playerId === undefined || ev.playerId === sim.player.id) {
          this.playerRig?.triggerCastPose(0.32);
        } else {
          this.coopPlayerRigs.get(ev.playerId)?.rig.triggerCastPose(0.32);
          this.simPlayerRigs.get(ev.playerId)?.triggerCastPose(0.32);
        }
        const caster = sim.getAllPlayers().find((pl) => pl.id === ev.playerId) ?? sim.player;
        if (!isStress) {
          let activeZoneElement: ElementType | undefined =
            caster.activeImbueElement !== 'none' ? caster.activeImbueElement : undefined;
          for (let zi = sim.skillZones.length - 1; zi >= 0; zi--) {
            const z = sim.skillZones[zi]!;
            if (z.ownerPlayerId === caster.id && z.ttlSec > 0) {
              activeZoneElement = z.element;
              break;
            }
          }
          spawnClassSkillCastVfx(
            this,
            this.fx,
            caster.characterId,
            ev.x,
            ev.y,
            ev.angle ?? caster.aimAngle,
            activeZoneElement,
            caster.id !== sim.player.id,
          );
        } else {
          this.lighting.spawnTransientLight(ev.x, ev.y, 115, PALETTE.CRIMSON_BRIGHT, 0.88, 0.26);
        }
        const skillSfxMap = {
          vanguard: 'skill_vanguard',
          ranger: 'skill_ranger',
          elementalist: 'skill_elementalist',
          druid: 'skill_druid',
          engineer: 'skill_engineer',
        } as const;
        const skillSfx = skillSfxMap[caster.characterId] ?? 'skill_cast';
        zzfx.play(skillSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'shield_shockwave': {
        if (!isStress) {
          spawnVanguardShieldShockwaveVfx(
            this,
            this.fx,
            ev.x,
            ev.y,
            ev.angle,
            ev.storedBullets,
          );
        } else {
          this.fx.spawnExplosionBurst(ev.x, ev.y, 90, PALETTE.CRIMSON_BRIGHT);
          this.lighting.spawnTransientLight(ev.x, ev.y, 150, PALETTE.CRIMSON_BRIGHT, 0.95, 0.32);
        }
        zzfx.play('shield_shockwave', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'weapon_swapped': {
        if (ev.playerId === sim.player.id) {
          zzfx.play('weapon_swap');
        }
        break;
      }
      case 'weapon_dropped': {
        this.lighting.spawnTransientLight(
          ev.x,
          ev.y,
          96,
          WEAPON_RARITY_COLORS[ev.rarity],
          0.85,
          0.28,
        );
        if (ev.playerId === sim.player.id) {
          zzfx.play('weapon_swap');
        } else {
          zzfx.play('weapon_swap', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'pickup_collected': {
        if (ev.pickupKind === 'prey_emblem' && !isStress) {
          const isEn = i18n.getLocale() === 'en';
          this.fx.spawnFloatingAlert(
            ev.x,
            ev.y,
            isEn ? '🎯 -2.0s CD & OVERCLOCK!' : '🎯 -2.0s CD & ĐẦY ĐẠN!',
          );
        }
        if (allowStressSfx) {
          zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'shaman_heal': {
        if (!isStress) {
          this.lighting.spawnTransientLight(ev.x, ev.y, 88, PALETTE.GOBLIN_GREEN, 0.85, 0.25);
        }
        break;
      }
      case 'chest_opened': {
        recordChestOpenedAnim(ev.chestId, sim.tick);
        this.fx.spawnChestOpenBurst(
          ev.x,
          ev.y,
          ev.rarity === 'uncommon' ? 'rare' : ev.rarity,
        );
        if (!isStress && (ev.rarity === 'epic' || ev.rarity === 'legendary')) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 68, 'fx_sh_arcane_sigil', {
            tint: ev.rarity === 'legendary' ? 0xfef08a : 0xd8b4fe,
          });
        }
        this.lighting.spawnTransientLight(
          ev.x,
          ev.y,
          130,
          WEAPON_RARITY_COLORS[ev.rarity],
          0.95,
          0.45,
        );
        zzfx.play('chest_open', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'room_cleared': {
        if (
          this.hudBannerTimer <= 0 ||
          (!this.hudBannerTextStr?.includes('KHẾ ƯỚC') &&
            !this.hudBannerTextStr?.includes('PACT PURIFIED'))
        ) {
          this.triggerRoomClearedBanner();
        }
        zzfx.play('door_open');
        break;
      }
      case 'room_entered': {
        this.camFocusX = sim.player.x;
        this.camFocusY = sim.player.y;
        break;
      }
      case 'portal_entered': {
        this.camFocusX = sim.player.x;
        this.camFocusY = sim.player.y;
        zzfx.play('portal_enter');
        this.triggerIrisTransition('close');
        break;
      }
      case 'boss_spawned': {
        this.fx.addTrauma(0.32);
        if (!isStress) {
          const boss = sim.enemies.find((e) => e.id === ev.enemyId);
          if (boss) {
            this.fx.spawnShaderNova?.(boss.x, boss.y, 116, 'fx_sh_geyser_plume');
          }
        }
        zzfx.play('boss_roar');
        break;
      }
      case 'boss_phase_changed': {
        this.fx.addTrauma(0.5);
        if (!isStress) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 124, 'fx_sh_arcane_sigil', {
            tint: 0xfef08a,
          });
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, 240, PALETTE.SOLAR_GOLD, 1.0, 0.55);
        this.fx.spawnFloatingAlert(ev.x, ev.y, `⚡ CHUYỂN PHA ${ev.phase} — BẤT TỬ!`);
        const rec = this as unknown as Record<string, unknown>;
        rec.p11WaveBannerTitleText = { text: `⚡ CHUYỂN PHA ${ev.phase} — BẤT TỬ!` };
        zzfx.play('boss_phase_change', ev.x, this.camFocusX, ev.y, this.camFocusY);
        zzfx.play('boss_roar', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'wave_started': {
        triggerP11WaveBanner(this, ev.waveIndex, ev.wavesTotal, ev.isChallenge);
        if (allowStressSfx) {
          zzfx.play('telegraph');
        }
        break;
      }
      case 'boss_enraged': {
        this.fx.addTrauma(0.35);
        if (!isStress) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 112, 'fx_sh_geyser_plume');
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, 200, PALETTE.CRIMSON_BRIGHT, 0.95, 0.45);
        this.fx.spawnFloatingAlert(ev.x, ev.y, `🔥 CUỒNG NỘ ×${ev.enrageLevel}!`);
        if (allowStressSfx) {
          zzfx.play('boss_roar', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'vengeful_telegraph': {
        this.lighting.spawnTransientLight(ev.x, ev.y, 110, PALETTE.TOXIC_PURPLE, 0.9, 0.45);
        if (allowStressSfx) {
          zzfx.play('telegraph', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'shrine_blessing': {
        if (!isStress) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 84, 'fx_sh_arcane_sigil', {
            tint: 0x67e8f9,
          });
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, 140, PALETTE.CYAN_FROST, 0.95, 0.4);
        zzfx.play('skill_druid', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'item_purchased': {
        zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'player_downed': {
        if (!isStress) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 64, 'fx_sh_nova_void', {
            tint: 0xf43f5e,
          });
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, 110, PALETTE.CRIMSON_BRIGHT, 0.92, 0.35);
        zzfx.play('player_downed', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'player_revived': {
        if (!isStress) {
          this.fx.spawnShaderNova?.(ev.x, ev.y, 82, 'fx_sh_bloom_briar', {
            tint: 0x86efac,
          });
        }
        this.lighting.spawnTransientLight(ev.x, ev.y, 130, PALETTE.LIME_GLOW, 0.95, 0.4);
        zzfx.play('player_revived', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'player_ghost': {
        this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.9, 0.35);
        zzfx.play('telegraph', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'players_teleported_to_room': {
        this.lighting.spawnTransientLight(ev.x, ev.y, 120, PALETTE.CYAN_FROST, 0.9, 0.3);
        this.camFocusX = sim.player.x;
        this.camFocusY = sim.player.y;
        break;
      }
      case 'character_selected': {
        this.lighting.spawnTransientLight(
          sim.player.x,
          sim.player.y,
          110,
          PALETTE.SOLAR_GOLD,
          0.9,
          0.3,
        );
        zzfx.play('weapon_swap', sim.player.x, this.camFocusX, sim.player.y, this.camFocusY);
        break;
      }
      case 'ping_issued': {
        zzfx.play('pickup', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'emote_triggered': {
        zzfx.play('weapon_swap', ev.x, this.camFocusX, ev.y, this.camFocusY);
        break;
      }
      case 'elemental_reaction': {
        if (!isStress || statusFxCountThisStep < 2) {
          statusFxCountThisStep += 1;
          const meta = ELEMENTAL_REACTIONS[ev.reaction];
          this.fx.spawnElementalReactionFx({
            reaction: ev.reaction,
            x: ev.x,
            y: ev.y,
            damage: ev.damage,
            isTeamCombo: ev.isTeamCombo,
          });
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            ev.isTeamCombo ? 165 : 124,
            meta?.colorHex ?? PALETTE.SOLAR_GOLD,
            0.96,
            0.38,
          );
          if (allowStressSfx) {
            const reactionSfxMap = {
              vaporize: 'reaction_vaporize',
              shatter: 'shatter',
              superconduct: 'reaction_superconduct',
              toxic_blast: 'reaction_toxic_blast',
              paralysis: 'reaction_paralysis',
              overload: 'reaction_overload',
            } as const;
            const rSfx = reactionSfxMap[ev.reaction] ?? 'elemental_reaction';
            zzfx.play(rSfx, ev.x, this.camFocusX, ev.y, this.camFocusY);
            if (ev.isTeamCombo) {
              zzfx.play('team_combo', ev.x, this.camFocusX, ev.y, this.camFocusY);
              const isEn = i18n.getLocale() === 'en';
              this.fx.spawnFloatingAlert(
                ev.x,
                ev.y - 14,
                isEn
                  ? '⚡ ELEMENTAL CONVERGENCE! +20% SPD'
                  : '⚡ HỘI TỤ NGUYÊN TỐ! +20% TỐC ĐỘ',
              );
            }
          }
        }
        break;
      }
      case 'summon_spawned': {
        if (!isStress) {
          spawnClassSummonSpawnedVfx(this, this.fx, ev.summonKind, ev.x, ev.y);
        } else {
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            135,
            ev.summonKind === 'sacred_tree' ? PALETTE.LIME_GLOW : PALETTE.VOLT_YELLOW,
            0.92,
            0.35,
          );
        }
        if (allowStressSfx) {
          zzfx.play(
            ev.summonKind === 'sacred_tree' ? 'skill_druid' : 'skill_engineer',
            ev.x,
            this.camFocusX,
            ev.y,
            this.camFocusY,
          );
        }
        break;
      }
      case 'emp_blast': {
        if (!isStress) {
          spawnEngineerEmpBlastVfx(this, this.fx, ev.x, ev.y, ev.radius);
        } else {
          this.fx.spawnExplosionBurst(ev.x, ev.y, ev.radius, PALETTE.VOLT_YELLOW);
          this.lighting.spawnTransientLight(
            ev.x,
            ev.y,
            ev.radius * 2,
            PALETTE.VOLT_YELLOW,
            1.0,
            0.38,
          );
        }
        if (allowStressSfx) {
          zzfx.play('emp_blast', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'hit_stop': {
        maxHitStopMs = Math.max(maxHitStopMs, ev.durationMs);
        maxHitStopTrauma = Math.max(maxHitStopTrauma, ev.trauma);
        break;
      }
      case 'cover_flipped': {
        if (!isStress) {
          spawnCoverFlipMicroBlankVfx(this, this.fx, ev.x, ev.y, ev.radius);
        }
        if (allowStressSfx) {
          zzfx.play('flip_cover', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'prop_kicked': {
        if (!isStress) {
          spawnPropDashKickVfx(this, this.fx, ev.x, ev.y, ev.vx, ev.vy);
        }
        if (allowStressSfx) {
          zzfx.play('swing_heavy', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'wall_slam': {
        if (!isStress) {
          spawnWallSlamVfx(this, this.fx, ev.x, ev.y, i18n.getLocale());
        }
        if (allowStressSfx) {
          zzfx.play('wall_slam', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'ring_out': {
        if (!isStress) {
          spawnChasmRingOutVfx(this, this.fx, ev.x, ev.y, i18n.getLocale());
        }
        if (allowStressSfx) {
          zzfx.play('explosion', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'perfect_reload': {
        if (!isStress) {
          triggerMicroBarFeedbackOnScene(
            this,
            this.fx,
            'perfect_reload',
            ev.x,
            ev.y,
            i18n.getLocale(),
          );
          if (ev.weaponId === 'rivet_gun') {
            spawnRivetDetonationWebVfx(this, this.fx);
          } else if (ev.weaponId === 'scrap_shotgun') {
            spawnScrapShotgunShellEjectVfx(
              this,
              this.fx,
              ev.x,
              ev.y,
              sim.player.aimAngle,
              i18n.getLocale(),
            );
          }
        }
        if (allowStressSfx) {
          zzfx.play('perfect_reload', ev.x, this.camFocusX, ev.y, this.camFocusY);
          if (ev.weaponId === 'scrap_shotgun') {
            zzfx.play('scrap_shell_eject', ev.x, this.camFocusX, ev.y, this.camFocusY);
          }
        }
        break;
      }
      case 'tactical_vent': {
        if (!isStress) {
          spawnTacticalVentVfx(this, this.fx, ev.x, ev.y, i18n.getLocale());
        }
        if (allowStressSfx) {
          zzfx.play('tactical_vent', ev.x, this.camFocusX, ev.y, this.camFocusY);
        }
        break;
      }
      case 'crossbow_rip': {
        const rx = ev.x ?? sim.player.x;
        const ry = ev.y ?? sim.player.y;
        if (!isStress) {
          const targets = ev.targetIds
            .map((id) => sim.enemies.find((e) => e.id === id))
            .filter((e): e is NonNullable<typeof e> => Boolean(e))
            .map((e) => ({ x: e.x, y: e.y }));
          spawnCrossbowBarbedRipVfx(
            this,
            this.fx,
            rx,
            ry,
            targets,
            ev.totalArrows ?? 1,
            i18n.getLocale(),
          );
        }
        if (allowStressSfx) {
          zzfx.play('crossbow_rip', rx, this.camFocusX, ry, this.camFocusY);
        }
        break;
      }
      case 'thorn_bloom': {
        const bx = ev.x ?? sim.player.x;
        const by = ev.y ?? sim.player.y;
        if (!isStress) {
          const targets = ev.targetIds
            .map((id) => sim.enemies.find((e) => e.id === id))
            .filter((e): e is NonNullable<typeof e> => Boolean(e))
            .map((e) => ({ x: e.x, y: e.y }));
          spawnThornBloomVfx(
            this,
            this.fx,
            bx,
            by,
            targets,
            ev.totalThorns ?? 1,
            i18n.getLocale(),
          );
        }
        if (allowStressSfx) {
          zzfx.play('thorn_bloom', bx, this.camFocusX, by, this.camFocusY);
        }
        break;
      }
    }
  }

  if (enemyHitCountThisStep > 0 && allowStressSfx) {
    zzfx.play(
      enemyHitCritThisStep ? 'crit_hit' : 'hit_enemy',
      enemyHitSfxX,
      this.camFocusX,
      enemyHitSfxY,
      this.camFocusY,
    );
  }
  if (maxHitStopMs > 0 && !isStress) {
    this.fx.triggerHitStop(maxHitStopMs);
    this.fx.addTrauma(maxHitStopTrauma);
  }
}
