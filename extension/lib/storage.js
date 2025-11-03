export const STORAGE_KEY = 'taskheatmap:state';

export function createInitialState() {
  return {
    days: {},
    options: {
      intervalMinutes: 15,
    },
  };
}

function normalizeStateSchema(state) {
  const defaults = createInitialState();

  if (!state || typeof state !== 'object') {
    return defaults;
  }

  return {
    ...defaults,
    ...state,
    days: { ...(state.days ?? defaults.days) },
    options: {
      ...defaults.options,
      ...(state.options ?? {}),
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

      resolve(normalizeStateSchema(result?.[STORAGE_KEY]));
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

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

export function addTrackedSeconds(state, domain, seconds, date = new Date()) {
  if (!domain || typeof domain !== 'string' || seconds <= 0) {
    return state;
  }

  const dateKey = toDateKey(date);

  if (!dateKey) {
    return state;
  }

  const currentState = normalizeStateSchema(state);
  const dayEntries = currentState.days[dateKey] ?? {};
  const total = (dayEntries[domain] ?? 0) + seconds;

  return {
    ...currentState,
    days: {
      ...currentState.days,
      [dateKey]: {
        ...dayEntries,
        [domain]: total,
      },
    },
  };
}
