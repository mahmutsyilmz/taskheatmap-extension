import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import advancedFormat from 'dayjs/plugin/advancedFormat.js';

import { ACTIVITY_TYPES, getDayTotals, getNormalizedDays, normalizeDayEntry } from './storage.js';

dayjs.extend(utc);
dayjs.extend(advancedFormat);

export const TIMEFRAMES = {
  DAY: 'day',
  WEEK: 'week',
  MONTH: 'month',
};

export const ACTIVITY_FILTERS = {
  ACTIVE: ACTIVITY_TYPES.ACTIVE,
  IDLE: ACTIVITY_TYPES.IDLE,
  ALL: 'all',
};

function ensureTimeframe(value) {
  return Object.values(TIMEFRAMES).includes(value) ? value : TIMEFRAMES.DAY;
}

function ensureFilter(value) {
  return Object.values(ACTIVITY_FILTERS).includes(value) ? value : ACTIVITY_FILTERS.ALL;
}

export function getDateRange(endDate, timeframe) {
  const normalizedFrame = ensureTimeframe(timeframe);
  const end = dayjs(endDate).utc().endOf('day');

  if (!end.isValid()) {
    return null;
  }

  const start =
    normalizedFrame === TIMEFRAMES.DAY
      ? end.startOf('day')
      : normalizedFrame === TIMEFRAMES.WEEK
        ? end.subtract(6, 'day').startOf('day')
        : end.subtract(29, 'day').startOf('day');

  return { start, end };
}

function iterateDays(days, range, callback) {
  if (!range) {
    return;
  }

  const keys = Object.keys(days ?? {}).sort((a, b) => a.localeCompare(b));
  const { start, end } = range;

  keys.forEach((dayKey) => {
    const current = dayjs.utc(dayKey, 'YYYY-MM-DD', true);

    if (!current.isValid()) {
      return;
    }

    if (current.isBefore(start) || current.isAfter(end)) {
      return;
    }

    callback(dayKey, normalizeDayEntry(days[dayKey]));
  });
}

export function aggregateDomains(
  days,
  { endDate = new Date(), timeframe = TIMEFRAMES.DAY, filter = ACTIVITY_FILTERS.ALL } = {}
) {
  const normalizedDays = days ?? {};
  const range = getDateRange(endDate, timeframe);
  if (!range) {
    return [];
  }

  const selectedFilter = ensureFilter(filter);
  const aggregates = new Map();

  iterateDays(normalizedDays, range, (_key, dayEntry) => {
    Object.entries(dayEntry.domains).forEach(([domain, metrics]) => {
      const existing = aggregates.get(domain) ?? {
        domain,
        activeSeconds: 0,
        idleSeconds: 0,
        totalSeconds: 0,
      };

      if (selectedFilter === ACTIVITY_FILTERS.ALL || selectedFilter === ACTIVITY_FILTERS.ACTIVE) {
        existing.activeSeconds += metrics[ACTIVITY_TYPES.ACTIVE] ?? 0;
      }
      if (selectedFilter === ACTIVITY_FILTERS.ALL || selectedFilter === ACTIVITY_FILTERS.IDLE) {
        existing.idleSeconds += metrics[ACTIVITY_TYPES.IDLE] ?? 0;
      }

      existing.totalSeconds =
        (selectedFilter === ACTIVITY_FILTERS.IDLE ? 0 : existing.activeSeconds) +
        (selectedFilter === ACTIVITY_FILTERS.ACTIVE ? 0 : existing.idleSeconds);

      if (selectedFilter === ACTIVITY_FILTERS.ALL) {
        existing.totalSeconds = existing.activeSeconds + existing.idleSeconds;
      } else if (selectedFilter === ACTIVITY_FILTERS.ACTIVE) {
        existing.totalSeconds = existing.activeSeconds;
      } else {
        existing.totalSeconds = existing.idleSeconds;
      }

      aggregates.set(domain, existing);
    });
  });

  return Array.from(aggregates.values()).sort((a, b) => b.totalSeconds - a.totalSeconds);
}

export function aggregateTotals(days, options = {}) {
  const entries = aggregateDomains(days, options);

  return entries.reduce(
    (acc, entry) => {
      acc.activeSeconds += entry.activeSeconds;
      acc.idleSeconds += entry.idleSeconds;
      acc.totalSeconds += entry.totalSeconds;
      return acc;
    },
    { activeSeconds: 0, idleSeconds: 0, totalSeconds: 0 }
  );
}

export function toMinutes(seconds) {
  if (!Number.isFinite(seconds)) {
    return 0;
  }

  return seconds / 60;
}

export function formatRangeLabel(range, timeframe) {
  if (!range) {
    return '';
  }

  if (timeframe === TIMEFRAMES.DAY) {
    return range.end.format('MMM D, YYYY');
  }

  const startLabel = range.start.format('MMM D');
  const endLabel = range.end.format('MMM D, YYYY');
  return `${startLabel} – ${endLabel}`;
}

function difference(current, previous) {
  const delta = current - previous;
  const magnitude = Math.abs(previous) < 0.0001 ? (delta > 0 ? 100 : 0) : (delta / previous) * 100;
  return {
    delta,
    percent: magnitude,
    direction: delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
  };
}

export function calculateTrends(
  days,
  { endDate = new Date(), timeframe = TIMEFRAMES.DAY, filter = ACTIVITY_FILTERS.ALL } = {}
) {
  const range = getDateRange(endDate, timeframe);
  if (!range) {
    return null;
  }

  const previousRange = {
    start:
      timeframe === TIMEFRAMES.DAY
        ? range.start.subtract(1, 'day')
        : timeframe === TIMEFRAMES.WEEK
          ? range.start.subtract(7, 'day')
          : range.start.subtract(30, 'day'),
    end:
      timeframe === TIMEFRAMES.DAY
        ? range.start.subtract(1, 'day')
        : timeframe === TIMEFRAMES.WEEK
          ? range.start.subtract(1, 'day')
          : range.start.subtract(1, 'day'),
  };

  const currentTotals = aggregateTotals(days, { endDate, timeframe, filter });
  const previousTotals = aggregateTotals(days, {
    endDate: previousRange.end.toDate(),
    timeframe,
    filter,
  });
  const trend = difference(currentTotals.totalSeconds, previousTotals.totalSeconds);

  const currentDomains = aggregateDomains(days, { endDate, timeframe, filter });
  const previousDomains = aggregateDomains(days, {
    endDate: previousRange.end.toDate(),
    timeframe,
    filter,
  });
  const previousMap = new Map(previousDomains.map((entry) => [entry.domain, entry]));

  const topDomain = currentDomains[0] ?? null;
  const domainTrend = topDomain
    ? difference(topDomain.totalSeconds, previousMap.get(topDomain.domain)?.totalSeconds ?? 0)
    : null;

  return {
    totals: trend,
    topDomain: topDomain
      ? {
          domain: topDomain.domain,
          seconds: topDomain.totalSeconds,
          trend: domainTrend,
        }
      : null,
  };
}

export function computeStreak(days, { filter = ACTIVITY_FILTERS.ACTIVE } = {}) {
  const normalized = getNormalizedDays({ days });
  const sortedKeys = Object.keys(normalized).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let lastDate = null;

  for (const key of sortedKeys) {
    const totals = getDayTotals(normalized[key]);
    const value =
      filter === ACTIVITY_FILTERS.IDLE
        ? totals[ACTIVITY_TYPES.IDLE]
        : filter === ACTIVITY_FILTERS.ALL
          ? totals.total
          : totals[ACTIVITY_TYPES.ACTIVE];

    if (value <= 0) {
      if (lastDate) {
        break;
      }
      continue;
    }

    const current = dayjs.utc(key, 'YYYY-MM-DD', true);

    if (!lastDate) {
      streak += 1;
      lastDate = current;
      continue;
    }

    const expectedNext = lastDate.subtract(1, 'day');
    if (current.isSame(expectedNext, 'day')) {
      streak += 1;
      lastDate = current;
      continue;
    }

    break;
  }

  return streak;
}

export function buildExportRows(days, options = {}) {
  const entries = aggregateDomains(days, options);
  return entries.map((entry) => ({
    domain: entry.domain,
    activeSeconds: entry.activeSeconds,
    idleSeconds: entry.idleSeconds,
    totalSeconds: entry.totalSeconds,
  }));
}

export function resolveFriendlyDomain(domain) {
  if (domain === '__idle__') {
    return 'Idle time';
  }
  return domain;
}

export function summarizeTopDomains(days, options = {}) {
  const entries = aggregateDomains(days, options);
  return entries.slice(0, 5);
}
