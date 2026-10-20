export function resolveServerDebugEnabled(
  args: readonly string[] = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return args.includes('--debug') || env.ASHEN_PACT_DEBUG === '1';
}

let serverDebugOverride: boolean | null = null;

export function isServerDebugEnabled(): boolean {
  if (serverDebugOverride !== null) return serverDebugOverride;
  return resolveServerDebugEnabled();
}

export function setServerDebugEnabledForTest(enabled: boolean | null): void {
  serverDebugOverride = enabled;
}
