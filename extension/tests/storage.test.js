import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ACTIVITY_TYPES,
  addTrackedSeconds,
  createInitialState,
  getStoredState,
  saveState,
  STORAGE_KEY,
  updateInterval,
  pruneOldDays,
  updateDailySummary,
} from '../lib/storage.js';

const originalChrome = globalThis.chrome;

afterEach(() => {
  if (originalChrome) {
    globalThis.chrome = originalChrome;
  } else {
    delete globalThis.chrome;
  }
});

describe('storage', () => {
  it('creates a predictable default state', () => {
    expect(createInitialState()).toMatchObject({
      days: {},
      options: {
        intervalMinutes: 15,
        dailySummary: { enabled: true, hour: 21 },
      },
    });
  });

  it('falls back to default state when storage is unavailable', async () => {
    await expect(getStoredState(null)).resolves.toMatchObject(createInitialState());
  });

  it('reads state from a chrome-like storage area', async () => {
    const stored = { options: { intervalMinutes: 5, dailySummary: { enabled: false, hour: 18 } } };
    const fakeStorage = {
      get(keys, callback) {
        expect(keys).toEqual([STORAGE_KEY]);
        callback({ [STORAGE_KEY]: stored });
      },
    };

    await expect(getStoredState(fakeStorage)).resolves.toEqual({
      days: {},
      options: { intervalMinutes: 5, dailySummary: { enabled: false, hour: 18 } },
    });
  });

  it('rejects when chrome reports a read error', async () => {
    const fakeStorage = {
      get(keys, callback) {
        expect(keys).toEqual([STORAGE_KEY]);
        globalThis.chrome = {
          runtime: {
            lastError: { message: 'read failed' },
          },
        };
        callback({});
      },
    };

    await expect(getStoredState(fakeStorage)).rejects.toThrow('read failed');
  });

  it('writes state to storage and resolves with the saved value', async () => {
    const fakeSet = vi.fn((data, callback) => callback());
    const fakeStorage = { set: fakeSet };
    const state = createInitialState();

    await expect(saveState(state, fakeStorage)).resolves.toEqual(createInitialState());
    expect(fakeSet).toHaveBeenCalledWith(
      { [STORAGE_KEY]: createInitialState() },
      expect.any(Function)
    );
  });

  it('rejects when chrome reports a write error', async () => {
    const fakeStorage = {
      set(_data, callback) {
        globalThis.chrome = {
          runtime: {
            lastError: { message: 'write failed' },
          },
        };
        callback();
      },
    };

    await expect(saveState(createInitialState(), fakeStorage)).rejects.toThrow('write failed');
  });

  it('throws when storage is unavailable for writes', async () => {
    await expect(saveState(createInitialState(), null)).rejects.toThrow('Storage is not available');
  });

  it('updates the interval immutably', () => {
    const state = createInitialState();
    const result = updateInterval(state, 30);

    expect(result).not.toBe(state);
    expect(result.options.intervalMinutes).toBe(30);
    expect(state.options.intervalMinutes).toBe(15);
  });

  it('updates daily summary immutably', () => {
    const state = createInitialState();
    const result = updateDailySummary(state, { enabled: false, hour: 9 });

    expect(result.options.dailySummary).toEqual({ enabled: false, hour: 9 });
    expect(state.options.dailySummary).toEqual({ enabled: true, hour: 21 });
  });

  it('rolls tracked seconds into the days collection with activity types', () => {
    const state = createInitialState();
    const date = new Date('2024-01-02T10:00:00Z');

    const updated = addTrackedSeconds(
      state,
      'github.com',
      120,
      date,
      undefined,
      ACTIVITY_TYPES.ACTIVE
    );

    expect(updated.days['2024-01-02']).toEqual({
      domains: { 'github.com': { active: 120, idle: 0 } },
      totals: { active: 120, idle: 0 },
      lastUpdatedAt: expect.any(Number),
    });
    expect(state.days).toEqual({});
  });

  it('accumulates active and idle seconds across multiple updates', () => {
    const state = createInitialState();
    const date = new Date('2024-05-05T12:00:00Z');

    const first = addTrackedSeconds(
      state,
      'example.com',
      60,
      date,
      undefined,
      ACTIVITY_TYPES.ACTIVE
    );
    const second = addTrackedSeconds(
      first,
      'example.com',
      30,
      date,
      undefined,
      ACTIVITY_TYPES.IDLE
    );

    expect(second.days['2024-05-05']).toEqual({
      domains: { 'example.com': { active: 60, idle: 30 } },
      totals: { active: 60, idle: 30 },
      lastUpdatedAt: expect.any(Number),
    });
  });

  it('ignores invalid inputs when rolling up seconds', () => {
    const state = createInitialState();

    expect(addTrackedSeconds(state, null, 10)).toEqual(createInitialState());
    expect(addTrackedSeconds(state, 'github.com', 0)).toEqual(createInitialState());
    expect(addTrackedSeconds(state, 'github.com', 10, new Date('invalid'))).toEqual(
      createInitialState()
    );
  });

  it('prunes days outside of the retention window', () => {
    const reference = new Date('2024-06-30T00:00:00Z');
    const state = {
      days: {
        '2024-05-01': {
          domains: { 'old.com': { active: 10, idle: 0 } },
          totals: { active: 10, idle: 0 },
        },
        '2024-06-15': {
          domains: { 'fresh.com': { active: 5, idle: 0 } },
          totals: { active: 5, idle: 0 },
        },
        'invalid-date': { foo: 1 },
      },
      options: {},
    };

    const pruned = pruneOldDays(state, 30, reference);

    expect(Object.keys(pruned.days)).toEqual(['2024-06-15', 'invalid-date']);
  });

  it('integrates retention into tracked updates', () => {
    const date = new Date('2024-07-01T12:00:00Z');
    const olderDate = new Date('2024-05-15T12:00:00Z');
    let state = createInitialState();

    state = addTrackedSeconds(state, 'old.com', 10, olderDate, 30);
    state = addTrackedSeconds(state, 'new.com', 5, date, 30);

    expect(Object.keys(state.days)).toEqual(['2024-07-01']);
    expect(state.days['2024-07-01'].domains).toEqual({ 'new.com': { active: 5, idle: 0 } });
  });
});
