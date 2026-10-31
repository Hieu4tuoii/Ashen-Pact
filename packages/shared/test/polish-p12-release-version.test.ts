import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

function readRepoFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

describe('Phase P5.4 / P12 — Release Version v2.0.0, Deferred P9b Ledger & Documentation Integrity', () => {
  it('bumps all workspace package.json manifests to version 2.0.0', () => {
    const manifests = [
      'package.json',
      'packages/shared/package.json',
      'apps/client/package.json',
      'apps/server/package.json',
    ];
    for (const rel of manifests) {
      const pkg = JSON.parse(readRepoFile(rel)) as { name: string; version: string };
      expect(pkg.version, `${rel} should have version 2.0.0`).toBe('2.0.0');
    }
  });

  it('updates tools/package-release.ts, apps/server/src/index.ts, and MenuScene.ts to v2.0.0 with zero 0.1.0/0.2.1 occurrences', () => {
    const packageReleaseSrc = readRepoFile('tools/package-release.ts');
    expect(packageReleaseSrc).toContain("const RELEASE_NAME = 'AshenPact-v2.0.0-win-x64';");
    expect(packageReleaseSrc).toContain('Ashen Pact v2.0.0 - Co-op LAN Host Server');
    expect(packageReleaseSrc).toContain('ASHEN PACT v2.0.0 - CAU HINH WINDOWS DEFENDER FIREWALL (LAN)');
    expect(packageReleaseSrc).toContain('Ashen Pact v2.0.0 - Co-op LAN Host Server (DEBUG MODE)');
    expect(packageReleaseSrc).toContain('ASHEN PACT v2.0.0 WIN-X64');
    expect(packageReleaseSrc).not.toContain('0.1.0');
    expect(packageReleaseSrc).not.toContain('0.2.1');

    const serverIndexSrc = readRepoFile('apps/server/src/index.ts');
    const versionMatches = serverIndexSrc.match(/version:\s*'2\.0\.0'/g) ?? [];
    expect(versionMatches.length).toBeGreaterThanOrEqual(2);
    expect(serverIndexSrc).toContain('ASHEN PACT v2.0.0 — MÁY CHỦ CO-OP LAN ĐÃ KHỞI ĐỘNG THÀNH CÔNG');
    expect(serverIndexSrc).toContain("openBrowserUrl(`http://localhost:${activePort}/${isServerDebugEnabled() ? '?debug=1' : ''}`)");
    const preloadSrc = readRepoFile('apps/client/src/scenes/PreloadScene.ts');
    expect(preloadSrc).not.toContain('isHostServerPort');
    expect(serverIndexSrc).not.toContain('0.1.0');
    expect(serverIndexSrc).not.toContain('0.2.1');

    const menuSceneSrc = readRepoFile('apps/client/src/scenes/MenuScene.ts');
    expect(menuSceneSrc).toContain("'v2.0.0 · LAN'");
    expect(menuSceneSrc).not.toContain('0.2.1');
  });

  it('updates phase8.spec.ts and phase8-soak-release.test.ts to reference AshenPact-v2.0.0-win-x64 and 2.0.0', () => {
    const phase8Spec = readRepoFile('tests/e2e/phase8.spec.ts');
    expect(phase8Spec).toContain('release/AshenPact-v2.0.0-win-x64');
    expect(phase8Spec).toContain('release/AshenPact-v2.0.0-win-x64.zip');
    expect(phase8Spec).toContain('ASHEN PACT v2.0.0');
    expect(phase8Spec).toContain("expect(hostInfo.version).toBe('2.0.0')");
    expect(phase8Spec).not.toContain('0.1.0');
    expect(phase8Spec).not.toContain('0.2.1');

    const soakTestSrc = readRepoFile('packages/shared/test/phase8-soak-release.test.ts');
    expect(soakTestSrc).toContain('release/AshenPact-v2.0.0-win-x64');
    expect(soakTestSrc).toContain('release/AshenPact-v2.0.0-win-x64.zip');
    expect(soakTestSrc).not.toContain('0.1.0');
    expect(soakTestSrc).not.toContain('0.2.1');
  });

  it('resolves the 2 Phase P9b deferred minor items in hud-modals-and-debug.ts and input-and-network.ts', () => {
    const hudModalsSrc = readRepoFile('apps/client/src/scenes/game-scene/hud-modals-and-debug.ts');
    expect(hudModalsSrc).toContain("activeModal === 'controls' || (activeModal === 'settings' && activeTab === 'controls')");

    const inputNetworkSrc = readRepoFile('apps/client/src/scenes/game-scene/input-and-network.ts');
    expect(inputNetworkSrc).toContain("kb.on('keydown-O'");
    expect(inputNetworkSrc).toContain("this.settingsModal?.open('settings')");
  });

  it('updates README.md, RELEASE_NOTES.md, QA_CHECKLIST.md, and CREDITS.md to v2.0.0 with zero remaining 0.2.1 in all 13 active files', () => {
    const readme = readRepoFile('README.md');
    expect(readme).toContain('v2.0.0');
    expect(readme).toContain('Tactical Arena Overhaul');
    expect(readme).toContain('AshenPact-v2.0.0-win-x64.zip');
    expect(readme).toContain('release/AshenPact-v2.0.0-win-x64/');
    expect(readme).toContain('Ctrl + Shift + D');
    expect(readme).toContain('start-host-debug.bat');
    expect(readme).not.toContain('thu hẹp tầm nhìn');
    expect(readme).not.toContain('0.1.0');

    const releaseNotes = readRepoFile('docs/RELEASE_NOTES.md');
    const activeV2HeaderSection = releaseNotes.split('# 📜 LỊCH SỬ PHÁT HÀNH')[0] ?? releaseNotes;
    expect(activeV2HeaderSection).toContain('v2.0.0');
    expect(activeV2HeaderSection).toContain('Tactical Arena Overhaul');
    expect(activeV2HeaderSection).toContain('AshenPact-v2.0.0-win-x64.zip');
    expect(activeV2HeaderSection).not.toContain('0.2.1');

    const qaChecklist = readRepoFile('docs/QA_CHECKLIST.md');
    expect(qaChecklist).toContain('v2.0.0');
    expect(qaChecklist).toContain('AshenPact-v2.0.0-win-x64');
    expect(qaChecklist).not.toContain('0.1.0');

    const rootCredits = readRepoFile('CREDITS.md');
    const docsCredits = readRepoFile('docs/CREDITS.md');
    expect(rootCredits).toContain('v2.0.0');
    expect(rootCredits).not.toContain('0.1.0');
    expect(docsCredits).toContain('v2.0.0');
    expect(docsCredits).not.toContain('0.1.0');

    const activeZeroStaleVersionFiles = [
      'package.json',
      'packages/shared/package.json',
      'apps/client/package.json',
      'apps/server/package.json',
      'tools/package-release.ts',
      'apps/server/src/index.ts',
      'apps/client/src/scenes/MenuScene.ts',
      'tests/e2e/phase8.spec.ts',
      'packages/shared/test/phase8-soak-release.test.ts',
      'README.md',
      'docs/QA_CHECKLIST.md',
      'CREDITS.md',
      'docs/CREDITS.md',
    ];
    for (const rel of activeZeroStaleVersionFiles) {
      expect(readRepoFile(rel), `${rel} must contain zero '0.2.1' occurrences`).not.toContain(
        '0.2.1',
      );
    }
  });
});
