import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';

dayjs.extend(utc);

export const STORAGE_KEY = 'taskheatmap:state';
export const DEFAULT_RETENTION_DAYS = 30;
export const ACTIVITY_TYPES = {
  ACTIVE: 'active',
  IDLE: 'idle',
};

const DAILY_SUMMARY_DEFAULT_HOUR = 21;

function clampHour(value) {
  if (!Number.isFinite(value)) {
    return DAILY_SUMMARY_DEFAULT_HOUR;
  }

  return Math.min(23, Math.max(0, Math.round(value)));
}

export function createInitialState() {
  return {
    days: {},
    options: {
      intervalMinutes: 15,
      dailySummary: {
        enabled: true,
        hour: DAILY_SUMMARY_DEFAULT_HOUR,
      },
    },
  };
}

function ensureActivityType(type) {
  return type === ACTIVITY_TYPES.IDLE ? ACTIVITY_TYPES.IDLE : ACTIVITY_TYPES.ACTIVE;
}

function createEmptyDomainEntry() {
  return {
    [ACTIVITY_TYPES.ACTIVE]: 0,
    [ACTIVITY_TYPES.IDLE]: 0,
  };
}

function createEmptyDayEntry() {
  return {
    domains: {},
    totals: {
      [ACTIVITY_TYPES.ACTIVE]: 0,
      [ACTIVITY_TYPES.IDLE]: 0,
    },
    lastUpdatedAt: null,
  };
}

export function normalizeDayEntry(dayValue) {
  if (!dayValue || typeof dayValue !== 'object') {
    return createEmptyDayEntry();
  }

  if (dayValue.domains && dayValue.totals) {
    const normalizedDomains = Object.entries(dayValue.domains).reduce((acc, [domain, value]) => {
      if (!domain || typeof domain !== 'string') {
        return acc;
      }

      const entry = { ...createEmptyDomainEntry() };

      if (value && typeof value === 'object') {
        entry[ACTIVITY_TYPES.ACTIVE] = Number(value[ACTIVITY_TYPES.ACTIVE] ?? 0) || 0;
        entry[ACTIVITY_TYPES.IDLE] = Number(value[ACTIVITY_TYPES.IDLE] ?? 0) || 0;
      } else {
        const numeric = Number(value) || 0;
        entry[ACTIVITY_TYPES.ACTIVE] = numeric;
      }

      acc[domain] = entry;
      return acc;
    }, {});

    return {
      domains: normalizedDomains,
      totals: {
        [ACTIVITY_TYPES.ACTIVE]: Number(dayValue.totals?.[ACTIVITY_TYPES.ACTIVE] ?? 0) || 0,
        [ACTIVITY_TYPES.IDLE]: Number(dayValue.totals?.[ACTIVITY_TYPES.IDLE] ?? 0) || 0,
      },
      lastUpdatedAt: Number(dayValue.lastUpdatedAt ?? null) || null,
    };
  }

  const legacySites =
    dayValue.sites && typeof dayValue.sites === 'object' ? dayValue.sites : dayValue;
  const normalizedDomains = Object.entries(legacySites ?? {}).reduce((acc, [domain, seconds]) => {
    if (!domain || typeof domain !== 'string') {
      return acc;
    }

    const numeric = Number(seconds) || 0;
    acc[domain] = {
      [ACTIVITY_TYPES.ACTIVE]: numeric,
      [ACTIVITY_TYPES.IDLE]: 0,
    };
    return acc;
  }, {});

  const totals = Object.values(normalizedDomains).reduce(
    (acc, entry) => {
      acc[ACTIVITY_TYPES.ACTIVE] += entry[ACTIVITY_TYPES.ACTIVE];
      acc[ACTIVITY_TYPES.IDLE] += entry[ACTIVITY_TYPES.IDLE];
      return acc;
    },
    { ...createEmptyDayEntry().totals }
  );

  return {
    domains: normalizedDomains,
    totals,
    lastUpdatedAt: null,
  };
}

function normalizeOptions(options) {
  const defaults = createInitialState().options;

  if (!options || typeof options !== 'object') {
    return defaults;
  }

  const hour = clampHour(options.dailySummary?.hour ?? defaults.dailySummary.hour);

  return {
    intervalMinutes: Number.isFinite(options.intervalMinutes)
      ? Math.max(1, Math.round(options.intervalMinutes))
      : defaults.intervalMinutes,
    dailySummary: {
      enabled: options.dailySummary?.enabled !== false,
      hour,
    },
  };
}

function normalizeStateSchema(state) {
  const defaults = createInitialState();

  if (!state || typeof state !== 'object') {
    return defaults;
  }

  const normalizedDays = Object.entries(state.days ?? {}).reduce((acc, [dayKey, value]) => {
    if (typeof dayKey !== 'string') {
      return acc;
    }

    acc[dayKey] = normalizeDayEntry(value);
    return acc;
  }, {});

  return {
    days: normalizedDays,
    options: normalizeOptions(state.options),
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

  const normalized = normalizeStateSchema(state);

  return new Promise((resolve, reject) => {
    target.set(
      {
        [STORAGE_KEY]: normalized,
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

export function updateInterval(state, minutes) {
  const normalized = normalizeStateSchema(state);
  const nextMinutes = Number.isFinite(minutes)
    ? Math.max(1, Math.round(minutes))
    : normalized.options.intervalMinutes;

  return {
    ...normalized,
    options: {
      ...normalized.options,
      intervalMinutes: nextMinutes,
    },
  };
}

export function updateDailySummary(state, { enabled, hour }) {
  const normalized = normalizeStateSchema(state);

  return {
    ...normalized,
    options: {
      ...normalized.options,
      dailySummary: {
        enabled: enabled ?? normalized.options.dailySummary.enabled,
        hour: clampHour(hour ?? normalized.options.dailySummary.hour),
      },
    },
  };
}

function toDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return null;
  }

  return dayjs(date).utc().format('YYYY-MM-DD');
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
  const reference = dayjs(referenceDate).utc().startOf('day');

  if (!reference.isValid()) {
    return normalizedState;
  }

  const cutoff = reference.subtract(retention - 1, 'day');
  const nextDays = Object.entries(normalizedState.days).reduce((acc, [dayKey, dayValue]) => {
    const parsed = dayjs.utc(dayKey, 'YYYY-MM-DD', true);

    if (!parsed.isValid() || parsed.isAfter(cutoff) || parsed.isSame(cutoff)) {
      acc[dayKey] = normalizeDayEntry(dayValue);
    }

    return acc;
  }, {});

  return {
    ...normalizedState,
    days: nextDays,
  };
}

function appendDomainMetrics(dayEntry, domain, seconds, activityType) {
  const activity = ensureActivityType(activityType);
  const normalized = { ...dayEntry.domains };
  const current = { ...createEmptyDomainEntry(), ...(normalized[domain] ?? {}) };
  current[activity] += seconds;
  normalized[domain] = current;

  const totals = {
    [ACTIVITY_TYPES.ACTIVE]:
      dayEntry.totals[ACTIVITY_TYPES.ACTIVE] + (activity === ACTIVITY_TYPES.ACTIVE ? seconds : 0),
    [ACTIVITY_TYPES.IDLE]:
      dayEntry.totals[ACTIVITY_TYPES.IDLE] + (activity === ACTIVITY_TYPES.IDLE ? seconds : 0),
  };

  return {
    domains: normalized,
    totals,
    lastUpdatedAt: Date.now(),
  };
}

export function addTrackedSeconds(
  state,
  domain,
  seconds,
  date = new Date(),
  retentionDays = DEFAULT_RETENTION_DAYS,
  activityType = ACTIVITY_TYPES.ACTIVE
) {
  if (!domain || typeof domain !== 'string' || seconds <= 0) {
    return normalizeStateSchema(state);
  }

  const dateKey = toDateKey(date);

  if (!dateKey) {
    return normalizeStateSchema(state);
  }

  const currentState = normalizeStateSchema(state);
  const currentDay = normalizeDayEntry(currentState.days[dateKey]);
  const nextDay = appendDomainMetrics(currentDay, domain, seconds, activityType);

  const updated = {
    ...currentState,
    days: {
      ...currentState.days,
      [dateKey]: nextDay,
    },
  };

  return pruneOldDays(updated, retentionDays, date);
}

export function getSortedDayKeys(days = {}) {
  return Object.keys(days).sort((a, b) => a.localeCompare(b));
}

export function getDayTotals(dayEntry) {
  const normalized = normalizeDayEntry(dayEntry);
  return {
    ...normalized.totals,
    total: normalized.totals[ACTIVITY_TYPES.ACTIVE] + normalized.totals[ACTIVITY_TYPES.IDLE],
  };
}

export function hasTrackedActivity(dayEntry) {
  const totals = getDayTotals(dayEntry);
  return totals.total > 0;
}

export function getNormalizedDays(state) {
  const normalized = normalizeStateSchema(state);
  return normalized.days;
}

export { normalizeStateSchema };
