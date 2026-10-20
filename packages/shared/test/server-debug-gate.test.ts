import { afterEach, describe, expect, it } from 'vitest';
import {
  isServerDebugEnabled,
  resolveServerDebugEnabled,
  setServerDebugEnabledForTest,
} from '../../../apps/server/src/debug-gate.js';

describe('server debug-gate resolution', () => {
  afterEach(() => {
    setServerDebugEnabledForTest(null);
  });

  it('returns false by default when neither --debug nor ASHEN_PACT_DEBUG=1 is provided', () => {
    expect(resolveServerDebugEnabled([], {})).toBe(false);
    expect(resolveServerDebugEnabled(['--host', '--port', '2578'], {})).toBe(false);
  });

  it('returns true when --debug CLI flag is present', () => {
    expect(resolveServerDebugEnabled(['--debug'], {})).toBe(true);
    expect(resolveServerDebugEnabled(['--host', '--debug', '--port', '2567'], {})).toBe(true);
  });

  it('returns true when ASHEN_PACT_DEBUG=1 environment variable is present', () => {
    expect(resolveServerDebugEnabled([], { ASHEN_PACT_DEBUG: '1' })).toBe(true);
  });

  it('returns false when ASHEN_PACT_DEBUG is 0 or other value without --debug', () => {
    expect(resolveServerDebugEnabled([], { ASHEN_PACT_DEBUG: '0' })).toBe(false);
    expect(resolveServerDebugEnabled([], { ASHEN_PACT_DEBUG: 'true' })).toBe(false);
  });

  it('supports setServerDebugEnabledForTest override', () => {
    setServerDebugEnabledForTest(true);
    expect(isServerDebugEnabled()).toBe(true);
    setServerDebugEnabledForTest(false);
    expect(isServerDebugEnabled()).toBe(false);
  });
});
