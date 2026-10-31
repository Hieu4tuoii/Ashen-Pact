import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const SCENE_GROUPS: Readonly<Record<string, readonly string[]>> = {
  p9a: [
    'b1-combat',
    'b1-combat-1440p',
    'b1-combat-ultrawide',
    'b1-combat-4p',
    'b1-combat-downed',
    'b1-boss-p1',
    'b1-boss-p3',
    'b2-combat',
    'b3-combat',
    'b1-hud-weapon-compare',
    'b1-hud-debug-on',
    'b1-combat-uiscale-80',
    'b1-combat-uiscale-130',
    'b1-hud-qol-showcase',
    'ui-vi-diacritics',
  ],
  p9b: [
    'menu',
    'menu-en',
    'menu-debug-on',
    'menu-join-input',
    'menu-settings',
    'menu-settings-en',
    'hub-solo',
    'hub-coop-2p',
    'hub-coop-2p-expanded',
    'hub-coop-invite-open',
    'hub-near-statue',
    'pause',
    'pause-en',
    'pause-confirm-exit',
    'pause-confirm-exit-en',
    'modal-buff',
    'modal-buff-en',
    'modal-victory',
    'modal-victory-en',
    'modal-defeat',
    'modal-defeat-en',
    'game-settings',
    'game-settings-en',
  ],
  p10a: [
    'gallery-p1',
    'gallery-characters-idle',
    'gallery-characters',
    'gallery-characters-attack',
    'gallery-characters-dash',
    'gallery-characters-hurt',
    'gallery-characters-crossfade',
    'gallery-enemies-b1',
    'gallery-enemies',
    'p10a-ingame-poses',
    'hub-solo',
    'b1-combat',
    'b2-combat',
    'b3-combat',
    'b1-combat-4p',
    'b1-combat-downed',
    'boss-b1',
    'boss-b2',
    'boss-b3',
  ],
  p10b: [
    'p10b-fx-shoot-hit',
    'p10b-fx-explosion',
    'p10b-fx-elemental-combo',
    'p10b-fx-chest-open',
    'p10b-fx-enemy-spawn',
    'p10b-fx-boss-kill',
    'p10b-ambient-b1',
    'p10b-ambient-b2',
    'p10b-ambient-b3',
    'b1-combat',
    'b2-combat',
    'b3-combat',
    'b1-combat-4p',
    'stress-4p',
    'boss-b2-blizzard',
    'hub-solo',
  ],
  p11: [
    'p11-boss-phase-transition',
    'p11-boss-enrage',
    'p11-wave-overlap-challenge',
    'boss-b1',
    'boss-b2',
    'boss-b3',
    'b1-combat',
    'b2-combat',
    'b3-combat',
  ],
  'ap2-p0b': [
    'ap2-b1-twin-bridges',
    'ap2-b1-gauntlet-chokepoint',
    'ap2-b1-central-bastion',
    'ap2-flip-cover-microblank',
    'ap2-dash-kick-wall-slam',
    'ap2-chasm-ring-out',
    'ap2-microbar-perfect-reload',
    'ap2-heat-vent-staff',
    'ap2-melee-combo3-parry',
    'ap2-tesla-smart-bounce',
  ],
  'ap2-p1a': [
    'ap2-wep-crossbow-rip',
    'ap2-wep-thorn-pull',
    'ap2-wep-shotgun-wallslam',
    'ap2-wep-gale-vent',
    'ap2-wep-frag-airburst',
    'ap2-wep-seed-bloom',
    'ap2-wep-tether-pull',
  ],
  'ap2-p1b': [
    'ap2-wep-laser-railgun',
    'ap2-wep-cleaver-boomerang',
    'ap2-wep-void-implosion',
    'ap2-wep-axe-guillotine',
    'ap2-wep-solar-supernova',
    'ap2-wep-magma-geysers',
    'ap2-wep-hammer-thunder',
  ],
  'ap2-p1c': [
    'ap2-b2-prism-labyrinth',
    'ap2-b2-glacial-kick-spikes',
    'ap2-b2-prism-refract',
    'ap2-b3-crossfire-conveyors',
    'ap2-b3-pneumatic-press-crush',
    'ap2-b3-blast-shield-wave',
    'ap2-crumbling-pillar-ring',
  ],
  'ap2-p1d': [
    'ap2-modal-blessing-vi',
    'ap2-modal-blessing-en',
    'ap2-blessing-table-rocket',
    'ap2-blessing-prism-split',
    'ap2-blessing-tediore-chuck',
    'ap2-skill-vanguard-prism',
    'ap2-skill-elementalist-twin',
  ],
  'ap2-p2a': [
    'ap2-treasure-forge-workshop',
    'ap2-modal-daedalus-mutator',
    'ap2-weapon-salvage-hold',
    'ap2-secret-wall-crack-break',
  ],
  'ap2-p2b': [
    'ap2-shrine-ashen-altar',
    'ap2-modal-ashen-pact-vi',
    'ap2-modal-ashen-pact-en',
    'ap2-pact-soul-chain-stretch',
    'ap2-pact-ashen-executioner',
    'ap2-relic-awakening-banner',
  ],
  'ap2-p3a': [
    'ap2-ai-lead-aim-telegraph',
    'ap2-ai-boar-pillar-crash',
    'ap2-ai-spore-bomber-kick',
    'ap2-ai-yeti-iceblock-counter',
    'ap2-ai-shielder-shock-arc',
    'ap2-ai-dwarf-mortar-lob',
  ],
  'ap2-p3b': [
    'ap2-boss-supply-drop',
    'ap2-boss1-armor-break',
    'ap2-boss2-armor-break',
    'ap2-boss3-armor-break',
  ],
  'ap2-p4a': [
    'ap2-p4a-wall-tether-pylons',
    'ap2-p4a-orbit-return-bullets',
    'ap2-p4a-thunder-decoy-dash',
    'ap2-p4a-holo-decoy-mutator',
  ],
};

export interface ShotsCliOptions {
  phase: string;
  label: string;
  group?: string;
  scenes?: string;
  verifyFreeze: boolean;
  gateMode?: 'WARN_ONLY' | 'HARD_ASSERT';
}

export function parseShotsArgs(argv: string[]): ShotsCliOptions {
  let phase = 'p0';
  let label = 'baseline';
  let group: string | undefined;
  let scenes: string | undefined;
  let verifyFreeze = false;
  let gateMode: 'WARN_ONLY' | 'HARD_ASSERT' | undefined;

  const args = argv.filter((arg) => arg !== '--');

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--phase' && args[i + 1]) {
      phase = args[++i]!;
    } else if (arg.startsWith('--phase=')) {
      phase = arg.slice('--phase='.length);
    } else if (arg === '--label' && args[i + 1]) {
      label = args[++i]!;
    } else if (arg.startsWith('--label=')) {
      label = arg.slice('--label='.length);
    } else if (arg === '--group' && args[i + 1]) {
      group = args[++i]!;
    } else if (arg.startsWith('--group=')) {
      group = arg.slice('--group='.length);
    } else if (arg === '--scenes' && args[i + 1]) {
      const collected: string[] = [];
      while (i + 1 < args.length && !args[i + 1]!.startsWith('--')) {
        collected.push(args[++i]!);
      }
      scenes = collected.join(',').replace(/\s+/g, ',');
    } else if (arg.startsWith('--scenes=')) {
      scenes = arg.slice('--scenes='.length).replace(/\s+/g, ',');
    } else if (arg === '--verify-freeze') {
      verifyFreeze = true;
    } else if (arg === '--gate-mode' && args[i + 1]) {
      const gm = args[++i]!;
      gateMode = gm === 'HARD_ASSERT' ? 'HARD_ASSERT' : 'WARN_ONLY';
    } else if (arg.startsWith('--gate-mode=')) {
      const gm = arg.slice('--gate-mode='.length);
      gateMode = gm === 'HARD_ASSERT' ? 'HARD_ASSERT' : 'WARN_ONLY';
    }
  }

  if (group) {
    const groupScenes = SCENE_GROUPS[group];
    if (!groupScenes) {
      throw new Error(
        `Unknown scene group "${group}". Available groups: ${Object.keys(SCENE_GROUPS).join(', ')}`,
      );
    }
    scenes = scenes ? `${groupScenes.join(',')},${scenes}` : groupScenes.join(',');
  }

  return {
    phase,
    label,
    ...(group ? { group } : {}),
    ...(scenes ? { scenes } : {}),
    verifyFreeze,
    ...(gateMode ? { gateMode } : {}),
  };
}

export function runShotsCli(argv: string[] = process.argv.slice(2)): void {
  const options = parseShotsArgs(argv);

  console.log(
    `[shots] Running visual capture: phase=${options.phase}, label=${options.label}, group=${options.group ?? 'none'}, scenes=${options.scenes ?? 'ALL'}, verifyFreeze=${options.verifyFreeze}, gateMode=${options.gateMode ?? 'HARD_ASSERT'}`,
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ASHEN_SHOTS_PHASE: options.phase,
    ASHEN_SHOTS_LABEL: options.label,
    ASHEN_SHOTS_SCENES: options.scenes ?? '',
    ASHEN_VERIFY_FREEZE: options.verifyFreeze ? '1' : '0',
    ...(options.gateMode ? { ASHEN_ANIM_GATE_MODE: options.gateMode } : {}),
  };

  const result = spawnSync('npx playwright test tests/e2e/visual.spec.ts', {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    shell: true,
    env,
  });

  if (result.error) {
    console.error('[shots] Failed to run playwright:', result.error);
    process.exit(1);
  }

  process.exit(result.status ?? 0);
}

const invokedPath = process.argv[1] ?? '';
if (invokedPath.endsWith('run-shots.ts') || invokedPath.endsWith('capture-visual-scenes.ts')) {
  runShotsCli();
}
