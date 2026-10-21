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
};

export interface ShotsCliOptions {
  phase: string;
  label: string;
  group?: string;
  scenes?: string;
  verifyFreeze: boolean;
}

export function parseShotsArgs(argv: string[]): ShotsCliOptions {
  let phase = 'p0';
  let label = 'baseline';
  let group: string | undefined;
  let scenes: string | undefined;
  let verifyFreeze = false;

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
  };
}

export function runShotsCli(argv: string[] = process.argv.slice(2)): void {
  const options = parseShotsArgs(argv);

  console.log(
    `[shots] Running visual capture: phase=${options.phase}, label=${options.label}, group=${options.group ?? 'none'}, scenes=${options.scenes ?? 'ALL'}, verifyFreeze=${options.verifyFreeze}`,
  );

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ASHEN_SHOTS_PHASE: options.phase,
    ASHEN_SHOTS_LABEL: options.label,
    ASHEN_SHOTS_SCENES: options.scenes ?? '',
    ASHEN_VERIFY_FREEZE: options.verifyFreeze ? '1' : '0',
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
