export const STORAGE_KEY = 'taskheatmap:state';

export function createInitialState() {
  return {
    activities: [],
    options: {
      intervalMinutes: 15,
    },
  };
}

function resolveStorage(storage) {
  if (storage) {
    return storage;
  }

  return globalThis.chrome?.storage?.local ?? null;
}

export async function getStoredState(storage = null) {
  const target = resolveStorage(storage);

  if (!target) {
    return createInitialState();
  }

  return new Promise((resolve, reject) => {
    target.get([STORAGE_KEY], (result) => {
      const error = globalThis.chrome?.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(result?.[STORAGE_KEY] ?? createInitialState());
    });
  });
}

export async function saveState(state, storage = null) {
  const target = resolveStorage(storage);

  if (!target) {
    throw new Error('Storage is not available');
  }

  return new Promise((resolve, reject) => {
    target.set({
      [STORAGE_KEY]: state,
    }, () => {
      const error = globalThis.chrome?.runtime?.lastError;

      if (error) {
        reject(new Error(error.message));
        return;
      }

      resolve(state);
    });
  });
}

export function updateInterval(state, minutes) {
  return {
    ...state,
    options: {
      ...state.options,
      intervalMinutes: minutes,
    },
  };
}
