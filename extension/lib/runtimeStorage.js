export const RUNTIME_STORAGE_KEY = 'taskheatmap:runtime';

const DEFAULT_RUNTIME_STATE = {
  lastDomain: null,
  lastTimestamp: Date.now(),
  activityType: 'active',
  windowFocused: true,
};

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  return globalThis.chrome?.storage?.local ?? null;
}

export function normalizeRuntimeState(state) {
  if (!state || typeof state !== 'object') {
    return { ...DEFAULT_RUNTIME_STATE, lastTimestamp: Date.now() };
  }

  const lastTimestamp = Number(state.lastTimestamp);

  return {
    lastDomain: typeof state.lastDomain === 'string' ? state.lastDomain : null,
    lastTimestamp: Number.isFinite(lastTimestamp) ? lastTimestamp : Date.now(),
    activityType: state.activityType === 'idle' ? 'idle' : 'active',
    windowFocused: state.windowFocused !== false,
  };
}

export async function getRuntimeState(storage = null) {
  const target = resolveStorage(storage);

  if (!target) {
    return normalizeRuntimeState(null);
  }

  return new Promise((resolve, reject) => {
    target.get([RUNTIME_STORAGE_KEY], (result) => {
      const error = globalThis.chrome?.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(normalizeRuntimeState(result?.[RUNTIME_STORAGE_KEY]));
    });
  });
}

export async function saveRuntimeState(state, storage = null) {
  const target = resolveStorage(storage);

  if (!target) {
    return normalizeRuntimeState(state);
  }

  const normalized = normalizeRuntimeState(state);

  return new Promise((resolve, reject) => {
    target.set(
      {
        [RUNTIME_STORAGE_KEY]: normalized,
      },
      () => {
        const error = globalThis.chrome?.runtime?.lastError;

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(normalized);
      }
    );
  });
}

export function mergeRuntimeState(current, updates) {
  return normalizeRuntimeState({
    ...current,
    ...(updates ?? {}),
  });
}
