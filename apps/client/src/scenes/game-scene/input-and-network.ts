import {
  i18n,
  normalizeRoomCode,
  type QuantizedWorldSnapshot,
  type WifiProfileId,
} from '@ashen-pact/shared';
import { Client as ColyseusClient } from 'colyseus.js';
import Phaser from 'phaser';
import { zzfx } from '../../audio/zzfx.js';
import { isEffectiveDebugUiEnabled, setServerDebugAllowed } from '../../core/debug-flag.js';
import type { CoopRoomConnection } from '../../net/coop-room-connection.js';
import { createPeerHostRoom, joinPeerClientRoom } from '../../net/p2p-coop-client.js';
import { initGlobalDebugState } from '../../ui/debug-overlay.js';
import { graphicsSettings } from '../../ui/graphics-settings.js';
import {
  getKeyCodeForBinding,
  isBindingCodeUsed,
  type KeybindActionId,
  shouldCaptureBrowserKey,
} from '../../ui/keybindings.js';
import { type GameScene } from '../GameScene.js';
import {
  exitToSoloSanctuary,
  resolveSanctuaryWsUrl,
  resolveSavedSanctuaryCharacter,
} from './sanctuary-lobby-ui.js';

interface BoundActionKeyEntry {
  action: KeybindActionId;
  code: string;
  keyCode: number;
  keyObj: Phaser.Input.Keyboard.Key;
  onDown?: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => void;
  onUp?: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => void;
}

interface SceneKeybindRuntime {
  boundEntries: BoundActionKeyEntry[];
  cycleElement: () => void;
  handlers: {
    onDashDown: () => void;
    onSkillDown: () => void;
    onSwapDown: () => void;
    onInteractDown: () => void;
    onPingDown: () => void;
    onDropWeaponDown: () => void;
    onReloadDown: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => void;
    onToggleMapDown: () => void;
    onCoopPanelDown: () => void;
    onEmoteDown: () => void;
    onEmoteUp: () => void;
  };
}

const sceneKeybindRuntimeMap = new WeakMap<GameScene, SceneKeybindRuntime>();

function createSceneKeybindRuntime(scene: GameScene): SceneKeybindRuntime {
  let lastCycleElementAt = -1000;
  let lastAltREvent: KeyboardEvent | undefined;

  const cycleElement = () => {
    if (!isEffectiveDebugUiEnabled(scene.coopMode !== 'solo')) return;
    const now = performance.now();
    if (now - lastCycleElementAt < 60) return;
    lastCycleElementAt = now;
    scene.transport.getSim().cycleImbueElement();
    zzfx.play('weapon_swap');
  };

  return {
    boundEntries: [],
    cycleElement,
    handlers: {
      onDashDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        scene.dashQueued = true;
      },
      onSkillDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        scene.skillQueued = true;
      },
      onSwapDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        scene.wheelSwapQueued = true;
      },
      onInteractDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        if (scene.pauseModalOpen || (scene.settingsModal?.isOpen() ?? false)) return;
        const sim = scene.transport.getSim();
        if (sim.runState === 'victory') {
          const interactBinding = graphicsSettings.getKeybindings().interact;
          if (interactBinding === 'KeyH' || interactBinding === 'KeyM') {
            return;
          }
          scene.interactQueued = true;
          if (sim.currentFloor < 6 && !scene.resultDismissed) {
            scene.resultDismissed = true;
            sim.campaignMaxFloors = 6;
            sim.runState = 'playing';
            if (scene.room && scene.coopMode !== 'solo') {
              scene.room.send('continue_campaign', {});
            }
          }
          return;
        }
        scene.interactQueued = true;
        if (
          scene.room &&
          scene.coopMode !== 'solo' &&
          sim.inHub &&
          sim.portalActive &&
          Math.hypot(sim.player.x - sim.portalX, sim.player.y - sim.portalY) <= 76
        ) {
          sim.player.ready = true;
          scene.room.send('set_ready', { ready: true, autoStartIfAllReady: true });
          if (sim.areAllPlayersReady() || sim.player.slot === 1) {
            scene.room.send('start_run', {});
          }
        }
      },
      onPingDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        const pointer = scene.input.activePointer;
        const wPt = scene.cameras.main.getWorldPoint(pointer.x, pointer.y);
        scene.pingQueued = {
          x: wPt.x - scene.lastShakeX,
          y: wPt.y - scene.lastShakeY,
        };
      },
      onDropWeaponDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        scene.dropWeaponQueued = true;
      },
      onReloadDown: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        if (scene.pauseModalOpen || (scene.settingsModal?.isOpen() ?? false)) return;
        scene.reloadVentQueued = true;
        const domEvent = event ?? keyObj?.originalEvent;
        if ((domEvent?.altKey || keyObj?.altKey) && domEvent !== lastAltREvent) {
          lastAltREvent = domEvent;
          cycleElement();
        }
      },
      onToggleMapDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        if (scene.pauseModalOpen || (scene.settingsModal?.isOpen() ?? false)) return;
        scene.fullMapOpen = !scene.fullMapOpen;
        initGlobalDebugState().fullMapOpen = scene.fullMapOpen;
      },
      onCoopPanelDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        if (scene.pauseModalOpen || (scene.settingsModal?.isOpen() ?? false)) return;
        scene.invitePanelVisible = !scene.invitePanelVisible;
        initGlobalDebugState().invitePanelVisible = scene.invitePanelVisible;
        scene.lastInvitePanelHash = '';
      },
      onEmoteDown: () => {
        if (scene.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) {
          return;
        }
        const sim = scene.transport.getSim();
        if (
          !scene.pauseModalOpen &&
          !(scene.settingsModal?.isOpen() ?? false) &&
          sim.runState === 'playing'
        ) {
          scene.emoteWheelOpen = true;
          initGlobalDebugState().emoteWheelOpen = true;
        }
      },
      onEmoteUp: () => {
        if (scene.emoteWheelOpen) {
          if (scene.emoteWheelHoveredId !== null) {
            scene.queuedEmote = scene.emoteWheelHoveredId;
          }
          scene.emoteWheelOpen = false;
          scene.emoteWheelHoveredId = null;
          initGlobalDebugState().emoteWheelOpen = false;
        }
      },
    },
  };
}

function getOrCreateSceneKeybindRuntime(scene: GameScene): SceneKeybindRuntime {
  let runtime = sceneKeybindRuntimeMap.get(scene);
  if (!runtime) {
    runtime = createSceneKeybindRuntime(scene);
    sceneKeybindRuntimeMap.set(scene, runtime);
  }
  return runtime;
}

/**
 * Hot-swaps all 14 customizable Phaser `Key` bindings on `scene.keys` without destroying
 * shared `KeyboardPlugin.keys` instances (`G`, `V`, etc.) or registering duplicate listeners.
 */
export function syncSceneKeybindings(scene: GameScene): void {
  const kb = scene.input?.keyboard;
  if (!kb) return;

  const runtime = getOrCreateSceneKeybindRuntime(scene);
  const bindings = graphicsSettings.getKeybindings();

  if (scene.emoteWheelOpen) {
    scene.emoteWheelOpen = false;
    scene.emoteWheelHoveredId = null;
    initGlobalDebugState().emoteWheelOpen = false;
  }

  for (const prev of runtime.boundEntries) {
    if (prev.onDown) {
      prev.keyObj.off('down', prev.onDown);
    }
    if (prev.onUp) {
      prev.keyObj.off('up', prev.onUp);
    }
    prev.keyObj.reset?.();
    if (
      shouldCaptureBrowserKey(prev.code) &&
      !isBindingCodeUsed(bindings, prev.code) &&
      typeof (kb as { removeCapture?: unknown }).removeCapture === 'function'
    ) {
      kb.removeCapture(prev.keyCode);
    }
  }
  runtime.boundEntries = [];

  const resolveActionKey = (
    action: KeybindActionId,
    onDown?: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => void,
    onUp?: (keyObj?: Phaser.Input.Keyboard.Key, event?: KeyboardEvent) => void,
  ): Phaser.Input.Keyboard.Key => {
    const code = bindings[action];
    const keyCode = getKeyCodeForBinding(code);
    const capture = shouldCaptureBrowserKey(code);
    const keyObj = kb.addKey(keyCode, capture);
    if (capture && typeof (kb as { addCapture?: unknown }).addCapture === 'function') {
      kb.addCapture(keyCode);
    }
    if (onDown) {
      keyObj.on('down', onDown);
    }
    if (onUp) {
      keyObj.on('up', onUp);
    }
    runtime.boundEntries.push({ action, code, keyCode, keyObj, onDown, onUp });
    return keyObj;
  };

  const kc = Phaser.Input.Keyboard.KeyCodes as Record<string, number | undefined>;
  const existingKeys = scene.keys;

  scene.keys = {
    W: resolveActionKey('moveUp'),
    S: resolveActionKey('moveDown'),
    A: resolveActionKey('moveLeft'),
    D: resolveActionKey('moveRight'),
    SPACE: resolveActionKey('skill', runtime.handlers.onSkillDown),
    SHIFT: resolveActionKey('dash', runtime.handlers.onDashDown),
    E: resolveActionKey('interact', runtime.handlers.onInteractDown),
    Q: resolveActionKey('swapWeapon', runtime.handlers.onSwapDown),
    R: resolveActionKey('reload', runtime.handlers.onReloadDown),
    X: resolveActionKey('dropWeapon', runtime.handlers.onDropWeaponDown),
    TAB: resolveActionKey('toggleMap', runtime.handlers.onToggleMapDown),
    Z: resolveActionKey('ping', runtime.handlers.onPingDown),
    T: resolveActionKey('emote', runtime.handlers.onEmoteDown, runtime.handlers.onEmoteUp),
    I: resolveActionKey('coopPanel', runtime.handlers.onCoopPanelDown),
    G: existingKeys?.G ?? kb.addKey(kc.G ?? 71),
    V: existingKeys?.V ?? kb.addKey(kc.V ?? 86),
    ONE: existingKeys?.ONE ?? kb.addKey(kc.ONE ?? 49),
    TWO: existingKeys?.TWO ?? kb.addKey(kc.TWO ?? 50),
    THREE: existingKeys?.THREE ?? kb.addKey(kc.THREE ?? 51),
    FOUR: existingKeys?.FOUR ?? kb.addKey(kc.FOUR ?? 52),
    F2: existingKeys?.F2 ?? kb.addKey(kc.F2 ?? 113),
    F3: existingKeys?.F3 ?? kb.addKey(kc.F3 ?? 114),
    F4: existingKeys?.F4 ?? kb.addKey(kc.F4 ?? 115),
    F5: existingKeys?.F5 ?? kb.addKey(kc.F5 ?? 116),
    F6: existingKeys?.F6 ?? kb.addKey(kc.F6 ?? 117),
    F7: existingKeys?.F7 ?? kb.addKey(kc.F7 ?? 118),
    F8: existingKeys?.F8 ?? kb.addKey(kc.F8 ?? 119),
    F9: existingKeys?.F9 ?? kb.addKey(kc.F9 ?? 120),
  };
}

export function setupKeyboardBindingsImpl(this: GameScene): void {
  const kb = this.input.keyboard;
  if (!kb) return;

  // Create fresh per-scene keybind runtime and wire all 14 customizable keys
  const runtime = createSceneKeybindRuntime(this);
  sceneKeybindRuntimeMap.set(this, runtime);
  this.keys = undefined;
  syncSceneKeybindings(this);
  const keys = this.keys as GameScene['keys'];
  if (!keys) return;

  kb.on('keydown-ESC', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    zzfx.play('ui_click');
    if (this.settingsModal?.isOpen()) {
      this.settingsModal.close();
      return;
    }
    if (this.pauseModalOpen && this.pauseConfirmExitOpen) {
      this.pauseConfirmExitOpen = false;
      initGlobalDebugState().pauseConfirmExitOpen = false;
      this.rebuildPauseModal();
      return;
    }
    if (this.fullMapOpen) {
      this.fullMapOpen = false;
      initGlobalDebugState().fullMapOpen = false;
      return;
    }
    this.togglePauseModal();
  });

  keys.V.on('down', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyV')) return;
    const sim = this.transport.getSim();
    if (this.room && this.coopMode !== 'solo') {
      if (!sim.player.ready) {
        sim.player.ready = true;
        this.room.send('set_ready', { ready: true, autoStartIfAllReady: true });
      } else if (sim.inHub && (sim.areAllPlayersReady() || sim.player.slot === 1)) {
        this.room.send('start_run', {});
      } else {
        sim.player.ready = false;
        this.room.send('set_ready', { ready: false });
      }
    } else {
      this.readyToggleQueued = true;
      if (sim.inHub) {
        sim.player.ready = true;
        sim.startDungeonRunFromHub();
      }
    }
    this.lastInvitePanelHash = '';
  });

  keys.ONE.on('down', () => {
    if (initGlobalDebugState().rebindingAction !== null) return;
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice0 = lp.buffChoices[0];
    const mutChoice0 = lp.mutatorChoices?.[0];
    const pactChoice0 = lp.pactChoices?.[0];
    if (sim.runState === 'buff_choice' && choice0) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice0 });
      } else {
        sim.selectFloorBuff(choice0, lp.id);
      }
    } else if (sim.runState === 'playing' && pactChoice0) {
      sim.selectAshenPact(pactChoice0, lp.id);
      this.room?.send('select_pact', { pactId: pactChoice0 });
      this.buffHoveredIdx = null;
      this.lastRunState = '';
    } else if (sim.runState === 'playing' && mutChoice0) {
      sim.selectWeaponMutator(mutChoice0, lp.id);
      this.room?.send('select_mutator', { mutatorId: mutChoice0 });
      this.buffHoveredIdx = null;
      this.lastRunState = '';
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 1;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    } else {
      this.queuedWeaponSlot = 0;
    }
  });
  keys.TWO.on('down', () => {
    if (initGlobalDebugState().rebindingAction !== null) return;
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice1 = lp.buffChoices[1];
    const mutChoice1 = lp.mutatorChoices?.[1];
    const pactChoice1 = lp.pactChoices?.[1];
    if (sim.runState === 'buff_choice' && choice1) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice1 });
      } else {
        sim.selectFloorBuff(choice1, lp.id);
      }
    } else if (sim.runState === 'playing' && pactChoice1) {
      sim.selectAshenPact(pactChoice1, lp.id);
      this.room?.send('select_pact', { pactId: pactChoice1 });
      this.buffHoveredIdx = null;
      this.lastRunState = '';
    } else if (sim.runState === 'playing' && mutChoice1) {
      sim.selectWeaponMutator(mutChoice1, lp.id);
      this.room?.send('select_mutator', { mutatorId: mutChoice1 });
      this.buffHoveredIdx = null;
      this.lastRunState = '';
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 2;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    } else {
      this.queuedWeaponSlot = 1;
    }
  });
  keys.THREE.on('down', () => {
    if (initGlobalDebugState().rebindingAction !== null) return;
    const sim = this.transport.getSim();
    const lp = this.transport.getLocalPlayerState();
    const choice2 = lp.buffChoices[2];
    const hasOpenPactChoices = (lp.pactChoices?.length ?? 0) > 0;
    if (sim.runState === 'buff_choice' && choice2) {
      if (this.room && this.coopMode !== 'solo') {
        lp.buffChoices = [];
        this.room.send('select_buff', { buffId: choice2 });
      } else {
        sim.selectFloorBuff(choice2, lp.id);
      }
    } else if (sim.runState === 'playing' && hasOpenPactChoices) {
      sim.selectAshenPact('decline', lp.id);
      this.room?.send('select_pact', { pactId: 'decline' });
      this.buffHoveredIdx = null;
      this.lastRunState = '';
    } else if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 3;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    }
  });
  keys.FOUR.on('down', () => {
    if (initGlobalDebugState().rebindingAction !== null) return;
    if (this.keys?.T.isDown || this.emoteWheelOpen) {
      this.queuedEmote = 4;
      this.emoteWheelOpen = false;
      this.emoteWheelHoveredId = null;
      initGlobalDebugState().emoteWheelOpen = false;
    }
  });

  // F6: Cycle Elemental Imbue (Debug)
  keys.F6.on('down', runtime.cycleElement);

  // G: Cycle Graphics Quality Preset (High -> Medium -> Low -> High)
  keys.G.on('down', () => {
    if (initGlobalDebugState().rebindingAction !== null) return;
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyG')) return;
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    graphicsSettings.cycleQuality();
  });

  // F2: Toggle God Mode
  keys.F2.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    const nextGod = !sim.player.godMode;
    sim.player.godMode = nextGod;
    const debug = initGlobalDebugState();
    debug.godMode = nextGod;
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('set_god_mode', { godMode: nextGod });
    }
  });

  // F3: Spawn fresh sample wave of 3 enemies
  keys.F3.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    this.transport.getSim().spawnSampleWave();
  });

  // F4: Toggle Hitbox & SpatialHashGrid visualization
  keys.F4.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const debug = initGlobalDebugState();
    debug.showHitboxes = !debug.showHitboxes;
    if (!debug.showHitboxes) {
      this.hitboxGraphics.clear();
    }
  });

  // F5: Skip current room waves & unlock doors
  keys.F5.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    sim.skipCurrentRoomWaves();
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('skip_waves', {});
    }
  });

  // F7: Toggle Phase 2 Stress Test (4 players + 80 enemies + 600+ projectiles)
  keys.F7.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    this.setStressTestMode(!sim.stressTestActive);
  });

  // F8: Toggle Phase 3 Bot Auto-Play (auto-clears Floor 1 -> Buff -> Floor 2 + Boss)
  keys.F8.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const sim = this.transport.getSim();
    const nextBot = !sim.botAutoPlayActive;
    sim.botAutoPlayActive = nextBot;
    initGlobalDebugState().botAutoPlayActive = nextBot;
    if (this.room && this.coopMode !== 'solo') {
      this.room.send('set_bot_autoplay', { active: nextBot });
    }
  });

  // F9: Cycle Phase 4 Wi-Fi Network Simulation Profile (off -> good -> normal -> bad)
  keys.F9.on('down', () => {
    if (!isEffectiveDebugUiEnabled(this.coopMode !== 'solo')) return;
    const profiles: WifiProfileId[] = ['off', 'good', 'normal', 'bad'];
    const debug = initGlobalDebugState();
    const idx = (profiles.indexOf(debug.wifiProfile) + 1) % profiles.length;
    const nextProfile = profiles[idx]!;
    debug.wifiProfile = nextProfile;
    this.networkTransport?.setWifiProfile(nextProfile);
  });

  // ENTER: Confirm exit when Pause Exit Confirmation is open, or Replay run when Victory/Defeat modal is active
  kb.on('keydown-ENTER', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (this.pauseModalOpen && this.pauseConfirmExitOpen) {
      zzfx.play('ui_click');
      this.pauseConfirmExitOpen = false;
      initGlobalDebugState().pauseConfirmExitOpen = false;
      this.togglePauseModal(false);
      exitToSoloSanctuary(this);
      return;
    }
    const sim = this.transport.getSim();
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('replay_run', {});
        this.resultDismissed = true;
        this.triggerIrisTransition('close');
        this.invalidateAllHudCaches();
      } else {
        this.scene.restart({ coopMode: 'solo', startInHub: false });
      }
    }
  });

  kb.on('keydown-H', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    const sim = this.transport.getSim();
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModal?.isOpen()) {
      zzfx.play('portal_enter');
      this.togglePauseModal(false);
      sim.enterHub();
      this.triggerIrisTransition();
      return;
    }
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      if (this.room && this.coopMode !== 'solo') {
        this.room.send('return_to_hub', {});
      }
      sim.enterHub();
      this.resultDismissed = true;
      this.triggerIrisTransition();
      this.invalidateAllHudCaches();
    }
  });

  kb.on('keydown-O', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (this.settingsModal?.isOpen()) return;
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen) {
      zzfx.play('ui_click');
      this.settingsModal?.open('settings');
      return;
    }
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyO')) return;
    const sim = this.transport.getSim();
    if (sim.inHub && !this.pauseModalOpen && !this.fullMapOpen) {
      zzfx.play('ui_click');
      this.settingsModal?.open('settings');
    }
  });

  kb.on('keydown-K', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyK')) return;
    const sim = this.transport.getSim();
    if (
      sim.inHub &&
      !this.pauseModalOpen &&
      !this.fullMapOpen &&
      !this.settingsModal?.isOpen()
    ) {
      zzfx.play('ui_click');
      this.settingsModal?.open('controls');
    }
  });

  kb.on('keydown-C', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyC')) return;
    const sim = this.transport.getSim();
    if (
      sim.inHub &&
      !this.pauseModalOpen &&
      !this.fullMapOpen &&
      !this.settingsModal?.isOpen()
    ) {
      zzfx.play('ui_click');
      this.settingsModal?.open('credits');
    }
  });

  kb.on('keydown-L', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    if (isBindingCodeUsed(graphicsSettings.getKeybindings(), 'KeyL')) return;
    const sim = this.transport.getSim();
    if (
      sim.inHub &&
      !this.pauseModalOpen &&
      !this.fullMapOpen &&
      !this.settingsModal?.isOpen()
    ) {
      zzfx.play('ui_click');
      graphicsSettings.toggleLanguage();
      initGlobalDebugState().language = graphicsSettings.getState().language;
      this.invalidateAllHudCaches();
    }
  });

  kb.on('keydown-M', () => {
    if (this.menuActiveInput !== null || initGlobalDebugState().rebindingAction !== null) return;
    const sim = this.transport.getSim();
    if (this.pauseModalOpen && !this.pauseConfirmExitOpen && !this.settingsModal?.isOpen()) {
      zzfx.play('ui_click');
      this.openPauseConfirmExit();
      return;
    }
    if ((sim.runState === 'victory' || sim.runState === 'defeat') && !this.resultDismissed) {
      exitToSoloSanctuary(this);
    }
  });
}

export function getResolvedWsUrlImpl(this: GameScene): string {
  if (this.serverUrl) {
    return resolveSanctuaryWsUrl(this.serverUrl);
  }
  const protocol =
    typeof window !== 'undefined' && window.location?.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsHost = window.location.hostname || 'localhost';
  const locPort = window.location.port;
  const wsPort = locPort && locPort !== '5173' && locPort !== '4173' ? locPort : '2567';
  return `${protocol}//${wsHost}:${wsPort}`;
}

export async function fetchHostLanInfoImpl(this: GameScene): Promise<void> {
  if (this.coopBackend === 'p2p') {
    return;
  }
  const pageProtocol = typeof window !== 'undefined' ? window.location?.protocol : undefined;
  if (pageProtocol === 'https:' && !this.hasCustomServerHostPort && !this.serverUrl) {
    return;
  }
  const epoch = this.sceneSessionEpoch;
  const debug = initGlobalDebugState();
  const applyNoLanServerFallback = () => {
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
    this.lanServerAvailable = false;
    if (
      this.coopMode === 'solo' &&
      !this.hasManualTransportChoice &&
      !this.hasCustomServerHostPort &&
      !this.menuActiveInput
    ) {
      this.preferredCoopTransport = 'p2p';
      debug.preferredCoopTransport = 'p2p';
      this.serverHostPort = '';
      debug.menuServerHostPort = '';
      this.sanctuaryDomInputs?.syncValues(this.displayName, this.serverHostPort);
      this.lastInvitePanelHash = '';
    }
  };

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const abortTimer = controller
    ? globalThis.setTimeout(() => controller.abort(), 1_500)
    : null;
  try {
    const wsUrl = this.getResolvedWsUrl();
    const httpBase = wsUrl.replace(/^ws:/, 'http:').replace(/^wss:/, 'https:');
    const res = await fetch(
      `${httpBase}/api/host-info`,
      controller ? { signal: controller.signal } : undefined,
    );
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
    if (res.ok) {
      this.lanServerAvailable = true;
      const data = (await res.json()) as {
        lanIps?: string[];
        primaryLanIp?: string;
        port?: number;
        debugAllowed?: boolean;
      };
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
      if (typeof data.debugAllowed === 'boolean') {
        setServerDebugAllowed(data.debugAllowed);
      }
      if (data.primaryLanIp) this.primaryLanIp = data.primaryLanIp;
      if (data.lanIps) this.lanIps = data.lanIps;
      if (data.port) this.serverPort = data.port;
      if (
        data.primaryLanIp &&
        !this.menuActiveInput &&
        !this.hasCustomServerHostPort &&
        this.preferredCoopTransport === 'lan'
      ) {
        this.serverHostPort = `${this.primaryLanIp}:${this.serverPort}`;
        debug.menuServerHostPort = this.serverHostPort;
        this.sanctuaryDomInputs?.syncValues(this.displayName, this.serverHostPort);
      }
      debug.lanIps = this.lanIps;
      this.updateHostInviteUrl();
    } else {
      applyNoLanServerFallback();
    }
  } catch {
    applyNoLanServerFallback();
  } finally {
    if (abortTimer !== null) {
      globalThis.clearTimeout(abortTimer);
    }
  }
}

export function updateHostInviteUrlImpl(this: GameScene): void {
  const debug = initGlobalDebugState();
  if (this.coopBackend === 'p2p') {
    const origin =
      typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://localhost';
    const pathname =
      typeof window !== 'undefined' && window.location?.pathname
        ? window.location.pathname
        : '/';
    const roomCode = this.room?.roomId ?? this.requestedRoomId ?? '';
    let url = roomCode
      ? `${origin}${pathname}?join=${encodeURIComponent(roomCode)}&p2p=1`
      : `${origin}${pathname}?coop=host&p2p=1`;
    if (typeof window !== 'undefined' && window.location?.search) {
      const peerSignal = new URLSearchParams(window.location.search).get('peerSignal')?.trim();
      if (peerSignal) {
        url += `&peerSignal=${encodeURIComponent(peerSignal)}`;
      }
    }
    this.hostInviteUrl = url;
    debug.hostInviteUrl = this.hostInviteUrl;
    this.lastInvitePanelHash = '';
    return;
  }
  const ip = this.primaryLanIp || window.location.hostname || '127.0.0.1';
  const roomQuery = this.room ? `?join=${this.room.roomId}` : '?coop=join';
  this.hostInviteUrl = `http://${ip}:${this.serverPort}/${roomQuery}`;
  debug.hostInviteUrl = this.hostInviteUrl;
  this.lastInvitePanelHash = '';
}

export function bindCoopRoomHandlersImpl(this: GameScene, room: CoopRoomConnection): void {
  const boundEpoch = this.sceneSessionEpoch;
  const isStaleSession = () => !this.scene.isActive() || this.sceneSessionEpoch !== boundEpoch;
  const debug = initGlobalDebugState();
  this.room = room;
  debug.serverConnected = true;
  debug.coopBackend = this.coopBackend;
  debug.coopRoomId = room.roomId;
  this.updateHostInviteUrl();

  if (this.networkTransport) {
    this.networkTransport.setOnSendInput((msg) => {
      if (this.room === room && !isStaleSession()) {
        room.send('input', msg);
      }
    });
    this.networkTransport.setOnSendMessage((type, payload) => {
      if (this.room === room && !isStaleSession()) {
        room.send(type, payload);
      }
    });
  }

  room.onMessage(
    'coop_welcome',
    (msg: {
      playerId: number;
      slot: 1 | 2 | 3 | 4;
      seed: number;
      reconnectToken: string;
      isHost: boolean;
      debugAllowed?: boolean;
    }) => {
      if (isStaleSession()) return;
      if (typeof msg.debugAllowed === 'boolean') {
        setServerDebugAllowed(msg.debugAllowed);
      }
      debug.seed = msg.seed;
      debug.playerSlot = msg.slot;
      this.reconnectToken = msg.reconnectToken;
      debug.reconnectToken = msg.reconnectToken;
      try {
        window.sessionStorage?.setItem('ashen_pact_reconnect_token', msg.reconnectToken);
        window.sessionStorage?.setItem('ashen_pact_room_id', room.roomId);
        if (room.reconnectionToken) {
          window.sessionStorage?.setItem('ashen_pact_colyseus_token', room.reconnectionToken);
        }
      } catch {
        // Ignore storage errors
      }
      this.networkTransport?.setLocalIdentity(msg.playerId, msg.slot);
      this.playerRig?.setPlayerSlot(msg.slot);
      this.lastInvitePanelHash = '';
      this.lastCoopHudHash = '';
    },
  );

  room.onMessage<QuantizedWorldSnapshot>('world_snapshot', (snap) => {
    if (isStaleSession()) return;
    this.networkTransport?.receiveSnapshot(snap);
  });

  room.onMessage('pong_check', (payload: { clientTime: number }) => {
    if (isStaleSession()) return;
    const rtt = Math.max(1, Date.now() - payload.clientTime);
    this.networkTransport?.setRttMs(rtt);
    debug.pingMs = rtt;
    room.send('report_ping', { rttMs: rtt });
  });

  room.onMessage('host_disconnected', (msg: { reasonVi?: string }) => {
    if (isStaleSession()) return;
    exitToSoloSanctuary(this, msg.reasonVi ?? 'Phòng Co-op đã đóng do Host ngắt kết nối.');
  });

  const onKicked = (msg: { reasonVi?: string }) => {
    if (isStaleSession()) return;
    exitToSoloSanctuary(this, msg.reasonVi ?? 'Bạn đã bị Host mời rời khỏi phòng.');
  };
  room.onMessage('kicked', onKicked);
  room.onMessage('kicked_by_host', onKicked);

  room.onMessage('join_rejected', (msg: { reasonVi?: string }) => {
    if (isStaleSession()) return;
    exitToSoloSanctuary(
      this,
      msg.reasonVi ??
        'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!',
    );
  });

  room.onMessage('character_select_result', () => {
    if (isStaleSession()) return;
    this.lastInvitePanelHash = '';
  });

  room.onMessage('debug_rejected', (msg: { command?: string; reason?: string }) => {
    if (isStaleSession()) return;
    debug.lastDebugRejected = msg?.command ?? 'unknown';
  });

  room.onLeave((code: number) => {
    if (isStaleSession() || this.intentionalLeave) return;
    // Code 4000 = Host disconnect, 4001 = Kicked, 4002 = Room Full, 4003 = Mid-run Join Rejected
    if (code === 4000 || code === 4001 || code === 4002 || code === 4003) {
      exitToSoloSanctuary(
        this,
        code === 4001
          ? 'Bạn đã bị Host mời rời khỏi phòng.'
          : code === 4002
            ? 'Phòng Co-op đã đủ 4 người chơi.'
            : code === 4003
              ? 'Đội đang chiến đấu — chỉ có thể tham gia ở Sảnh Chờ (Hub) hoặc giữa các tầng!'
              : 'Phòng Co-op đã đóng do Host ngắt kết nối.',
      );
      return;
    }
    debug.serverConnected = false;
    void this.forceCoopReconnect();
  });
}

export async function connectCoopRoomImpl(this: GameScene): Promise<void> {
  const epoch = this.sceneSessionEpoch;
  const debug = initGlobalDebugState();

  if (this.coopBackend !== 'p2p') {
    await this.fetchHostLanInfo();
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      return;
    }
    if (
      !this.lanServerAvailable &&
      this.coopMode === 'join' &&
      !this.serverUrl &&
      !this.hasCustomServerHostPort
    ) {
      const fallbackCode = normalizeRoomCode(this.requestedRoomId ?? '');
      if (fallbackCode) {
        this.coopBackend = 'p2p';
        this.preferredCoopTransport = 'p2p';
        debug.coopBackend = 'p2p';
        debug.preferredCoopTransport = 'p2p';
        this.requestedRoomId = fallbackCode;
      }
    }
  }

  if (this.coopBackend === 'p2p') {
    let storedReconnectToken: string | null = null;
    try {
      storedReconnectToken =
        typeof window !== 'undefined'
          ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
          : null;
    } catch {
      storedReconnectToken = null;
    }
    const savedToken = this.reconnectToken ?? storedReconnectToken;
    const savedChar =
      resolveSavedSanctuaryCharacter(
        typeof window !== 'undefined' ? (window.location?.search ?? '') : '',
      ) ?? undefined;

    try {
      const room =
        this.coopMode === 'host'
          ? await createPeerHostRoom({
              requestedRoomCode: this.requestedRoomId,
              hostDisplayName: this.displayName,
              characterId: savedChar,
              seed: debug.seed || undefined,
            })
          : await joinPeerClientRoom({
              roomCode: this.requestedRoomId ?? '',
              displayName: this.displayName,
              characterId: savedChar,
              reconnectToken: savedToken ?? undefined,
            });

      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
        void room.leave(true).catch(() => {});
        return;
      }

      this.requestedRoomId = room.roomId;
      this.bindCoopRoomHandlers(room);
      room.send('ping_check', { clientTime: Date.now(), rttMs: 8 });

      this.time.addEvent({
        delay: 500,
        loop: true,
        callback: () => {
          if (
            this.room &&
            this.coopMode !== 'solo' &&
            this.scene.isActive() &&
            this.sceneSessionEpoch === epoch
          ) {
            const curRtt = this.networkTransport?.getTelemetry().rttMs ?? debug.pingMs ?? 8;
            this.room.send('ping_check', {
              clientTime: Date.now(),
              rttMs: curRtt,
            });
          }
        },
      });
    } catch (err) {
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
      debug.serverConnected = false;
      this.lastInvitePanelHash = '';
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : i18n.t('ui.sanctuary.roomNotFoundError');
      exitToSoloSanctuary(this, errMsg);
    }
    return;
  }

  try {
    const wsUrl = this.getResolvedWsUrl();
    this.colyseusClient = new ColyseusClient(wsUrl);
    let storedReconnectToken: string | null = null;
    try {
      storedReconnectToken =
        typeof window !== 'undefined'
          ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
          : null;
    } catch {
      storedReconnectToken = null;
    }
    const savedToken = this.reconnectToken ?? storedReconnectToken;
    const joinOpts = {
      name: this.displayName,
      reconnectToken: savedToken ?? undefined,
      seed: debug.seed,
    };

    const room = this.requestedRoomId
      ? await this.colyseusClient.joinById(this.requestedRoomId, joinOpts)
      : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);

    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      void room.leave().catch(() => {});
      return;
    }

    this.bindCoopRoomHandlers(room);
    room.send('ping_check', { clientTime: Date.now(), rttMs: 8 });

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (
          this.room &&
          this.coopMode !== 'solo' &&
          this.scene.isActive() &&
          this.sceneSessionEpoch === epoch
        ) {
          const curRtt = this.networkTransport?.getTelemetry().rttMs ?? debug.pingMs ?? 8;
          this.room.send('ping_check', {
            clientTime: Date.now(),
            rttMs: curRtt,
          });
        }
      },
    });
  } catch {
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
    debug.serverConnected = false;
    this.lastInvitePanelHash = '';
  }
}

export async function forceCoopReconnectImpl(this: GameScene): Promise<boolean> {
  const epoch = this.sceneSessionEpoch;
  const debug = initGlobalDebugState();
  let storedRoomId: string | null = null;
  let storedToken: string | null = null;
  try {
    storedRoomId =
      typeof window !== 'undefined' ? window.sessionStorage?.getItem('ashen_pact_room_id') : null;
    storedToken =
      typeof window !== 'undefined'
        ? window.sessionStorage?.getItem('ashen_pact_reconnect_token')
        : null;
  } catch {
    storedRoomId = null;
    storedToken = null;
  }
  const targetRoomId = this.room?.roomId ?? this.requestedRoomId ?? storedRoomId;
  const savedToken = this.reconnectToken ?? storedToken;

  if (this.coopBackend === 'p2p') {
    if (this.coopMode === 'host' && this.room) {
      debug.serverConnected = true;
      return true;
    }
    if (this.room) {
      const prevRoom = this.room;
      this.intentionalLeave = true;
      this.room = undefined;
      try {
        await prevRoom.leave(false);
      } catch {
        // Ignore leave errors during simulated drop
      }
      this.intentionalLeave = false;
    }
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      return false;
    }
    try {
      const savedChar =
        resolveSavedSanctuaryCharacter(
          typeof window !== 'undefined' ? (window.location?.search ?? '') : '',
        ) ?? undefined;
      const newRoom =
        this.coopMode === 'host'
          ? await createPeerHostRoom({
              requestedRoomCode: targetRoomId ?? undefined,
              hostDisplayName: this.displayName,
              characterId: savedChar,
              seed: debug.seed || undefined,
            })
          : await joinPeerClientRoom({
              roomCode: targetRoomId ?? '',
              displayName: this.displayName,
              characterId: savedChar,
              reconnectToken: savedToken ?? undefined,
            });
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
        void newRoom.leave(true).catch(() => {});
        return false;
      }
      this.requestedRoomId = newRoom.roomId;
      this.bindCoopRoomHandlers(newRoom);
      newRoom.send('ping_check', { clientTime: Date.now(), rttMs: 8 });
      debug.serverConnected = true;
      return true;
    } catch (err) {
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
        return false;
      }
      debug.serverConnected = false;
      const errMsg =
        err instanceof Error && err.message
          ? err.message
          : i18n.t('ui.sanctuary.roomNotFoundError');
      exitToSoloSanctuary(this, errMsg);
      return false;
    }
  }

  if (!this.colyseusClient) {
    this.colyseusClient = new ColyseusClient(this.getResolvedWsUrl());
  }

  if (this.room) {
    const prevRoom = this.room;
    this.intentionalLeave = true;
    this.room = undefined;
    try {
      await prevRoom.leave(false);
    } catch {
      // Ignore leave errors during simulated drop
    }
    this.intentionalLeave = false;
  }
  if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
    return false;
  }

  try {
    const joinOpts = {
      name: this.displayName,
      reconnectToken: savedToken ?? undefined,
    };
    const newRoom = targetRoomId
      ? await this.colyseusClient.joinById(targetRoomId, joinOpts)
      : await this.colyseusClient.joinOrCreate('coop_room', joinOpts);
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      void newRoom.leave().catch(() => {});
      return false;
    }
    this.bindCoopRoomHandlers(newRoom);
    debug.serverConnected = true;
    return true;
  } catch {
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      return false;
    }
    debug.serverConnected = false;
    return false;
  }
}

export async function connectHelloRoomImpl(this: GameScene): Promise<void> {
  const pageProtocol = typeof window !== 'undefined' ? window.location?.protocol : undefined;
  if (pageProtocol === 'https:' && !this.hasCustomServerHostPort && !this.serverUrl) {
    return;
  }
  const epoch = this.sceneSessionEpoch;
  const debug = initGlobalDebugState();
  await this.fetchHostLanInfo();
  if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
    return;
  }
  if (!this.lanServerAvailable && !this.hasCustomServerHostPort && !this.serverUrl) {
    return;
  }
  try {
    const wsHost = window.location.hostname || 'localhost';
    const wsPort = this.serverPort || 2567;
    const client = new ColyseusClient(`ws://${wsHost}:${wsPort}`);
    const room = await client.joinOrCreate('hello_room', {});
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) {
      void room.leave().catch(() => {});
      return;
    }
    this.room = room;
    debug.serverConnected = true;
    this.lastInvitePanelHash = '';

    room.onMessage('hello_welcome', (msg: { seed?: number; debugAllowed?: boolean }) => {
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
      if (typeof msg.debugAllowed === 'boolean') {
        setServerDebugAllowed(msg.debugAllowed);
      }
      if (typeof msg.seed === 'number') {
        debug.seed = msg.seed;
      }
    });

    room.onMessage('pong_check', (payload: { clientTime: number }) => {
      if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
      debug.pingMs = Math.max(1, Date.now() - payload.clientTime);
    });

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        if (this.room === room && this.scene.isActive() && this.sceneSessionEpoch === epoch) {
          this.room.send('ping_check', { clientTime: Date.now() });
        }
      },
    });
  } catch {
    if (!this.scene.isActive() || this.sceneSessionEpoch !== epoch) return;
    debug.serverConnected = false;
    this.lastInvitePanelHash = '';
  }
}
