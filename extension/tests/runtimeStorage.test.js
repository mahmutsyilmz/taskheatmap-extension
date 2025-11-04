import { describe, expect, it } from 'vitest';
import { mergeRuntimeState, normalizeRuntimeState } from '../lib/runtimeStorage.js';

describe('runtime storage helpers', () => {
  it('normalizes missing values', () => {
    const normalized = normalizeRuntimeState({});
    expect(normalized.lastDomain).toBeNull();
    expect(normalized.activityType).toBe('active');
    expect(normalized.windowFocused).toBe(true);
  });

  it('merges state updates safely', () => {
    const current = normalizeRuntimeState({
      lastDomain: 'example.com',
      activityType: 'idle',
      windowFocused: false,
    });
    const merged = mergeRuntimeState(current, { activityType: 'active', lastDomain: 'focus.site' });

    expect(merged.activityType).toBe('active');
    expect(merged.lastDomain).toBe('focus.site');
    expect(merged.windowFocused).toBe(false);
  });
});
