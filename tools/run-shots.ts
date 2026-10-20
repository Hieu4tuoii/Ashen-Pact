import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface ShotsCliOptions {
  phase: string;
  label: string;
  scenes?: string;
  verifyFreeze: boolean;
}

export function parseShotsArgs(argv: string[]): ShotsCliOptions {
  let phase = 'p0';
  let label = 'baseline';
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

  return {
    phase,
    label,
    ...(scenes ? { scenes } : {}),
    verifyFreeze,
  };
}

export function runShotsCli(argv: string[] = process.argv.slice(2)): void {
  const options = parseShotsArgs(argv);

  console.log(
    `[shots] Running visual capture: phase=${options.phase}, label=${options.label}, scenes=${options.scenes ?? 'ALL'}, verifyFreeze=${options.verifyFreeze}`,
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

runShotsCli();
