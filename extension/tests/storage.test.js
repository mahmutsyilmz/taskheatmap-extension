import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialState, getStoredState, saveState, STORAGE_KEY, updateInterval } from '../lib/storage.js';

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
      activities: [],
      options: { intervalMinutes: 15 },
    });
  });

  it('falls back to default state when storage is unavailable', async () => {
    await expect(getStoredState(null)).resolves.toMatchObject(createInitialState());
  });

  it('reads state from a chrome-like storage area', async () => {
    const stored = { options: { intervalMinutes: 5 } };
    const fakeStorage = {
      get(keys, callback) {
        expect(keys).toEqual([STORAGE_KEY]);
        callback({ [STORAGE_KEY]: stored });
      },
    };

    await expect(getStoredState(fakeStorage)).resolves.toEqual(stored);
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

    await expect(saveState(state, fakeStorage)).resolves.toBe(state);
    expect(fakeSet).toHaveBeenCalledWith({ [STORAGE_KEY]: state }, expect.any(Function));
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
});
