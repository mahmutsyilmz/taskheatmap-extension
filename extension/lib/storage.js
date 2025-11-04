export const STORAGE_KEY = 'taskheatmap:state';
export const DEFAULT_RETENTION_DAYS = 30;

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
    target.set(
      {
        [STORAGE_KEY]: state,
      },
      () => {
        const error = globalThis.chrome?.runtime?.lastError;

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve(state);
      }
    );
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

function normalizeRetentionDays(retentionDays) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return Math.floor(retentionDays);
}

export function pruneOldDays(
  state,
  retentionDays = DEFAULT_RETENTION_DAYS,
  referenceDate = new Date()
) {
  const normalizedState = normalizeStateSchema(state);
  const retention = normalizeRetentionDays(retentionDays);
  const reference = new Date(referenceDate);

  if (Number.isNaN(reference.getTime())) {
    return normalizedState;
  }

  const cutoff = new Date(
    Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), reference.getUTCDate())
  );
  cutoff.setUTCDate(cutoff.getUTCDate() - (retention - 1));

  const nextDays = Object.entries(normalizedState.days).reduce((acc, [dayKey, domains]) => {
    const parsed = new Date(`${dayKey}T00:00:00Z`);

    if (Number.isNaN(parsed.getTime()) || parsed >= cutoff) {
      acc[dayKey] = domains;
    }

    return acc;
  }, {});

  return {
    ...normalizedState,
    days: nextDays,
  };
}

export function addTrackedSeconds(
  state,
  domain,
  seconds,
  date = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS
) {
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

  const updated = {
    ...currentState,
    days: {
      ...currentState.days,
      [dateKey]: {
        ...dayEntries,
        [domain]: total,
      },
    },
  };

  return pruneOldDays(updated, retentionDays, date);
}
