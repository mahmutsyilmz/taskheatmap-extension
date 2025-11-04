import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_FILTERS,
  TIMEFRAMES,
  aggregateDomains,
  aggregateTotals,
  buildExportRows,
  calculateTrends,
  computeStreak,
  getDateRange,
} from '../lib/analytics.js';

const sampleDays = {
  '2024-06-01': {
    domains: {
      'example.com': { active: 120, idle: 30 },
      'chat.openai.com': { active: 60, idle: 15 },
    },
    totals: { active: 180, idle: 45 },
  },
  '2024-06-02': {
    domains: {
      'example.com': { active: 90, idle: 0 },
      'docs.google.com': { active: 40, idle: 20 },
    },
    totals: { active: 130, idle: 20 },
  },
  '2024-05-27': {
    domains: {
      'legacy.com': { active: 30, idle: 0 },
    },
    totals: { active: 30, idle: 0 },
  },
};

describe('analytics', () => {
  it('builds aggregates for a daily range', () => {
    const results = aggregateDomains(sampleDays, {
      endDate: new Date('2024-06-02T12:00:00Z'),
      timeframe: TIMEFRAMES.DAY,
      filter: ACTIVITY_FILTERS.ALL,
    });

    expect(results).toEqual([
      { domain: 'example.com', activeSeconds: 90, idleSeconds: 0, totalSeconds: 90 },
      { domain: 'docs.google.com', activeSeconds: 40, idleSeconds: 20, totalSeconds: 60 },
    ]);
  });

  it('filters by activity type', () => {
    const results = aggregateDomains(sampleDays, {
      endDate: new Date('2024-06-02T12:00:00Z'),
      timeframe: TIMEFRAMES.WEEK,
      filter: ACTIVITY_FILTERS.ACTIVE,
    });

    expect(results.find((entry) => entry.domain === 'example.com')?.totalSeconds).toBe(210);
    expect(results.find((entry) => entry.domain === 'example.com')?.idleSeconds).toBe(0);
  });

  it('calculates totals for a range', () => {
    const totals = aggregateTotals(sampleDays, {
      endDate: new Date('2024-06-02T12:00:00Z'),
      timeframe: TIMEFRAMES.WEEK,
      filter: ACTIVITY_FILTERS.ALL,
    });

    expect(totals).toEqual({ activeSeconds: 340, idleSeconds: 65, totalSeconds: 405 });
  });

  it('computes streaks based on active time', () => {
    expect(computeStreak(sampleDays, { filter: ACTIVITY_FILTERS.ACTIVE })).toBe(2);
  });

  it('produces export rows with combined totals', () => {
    const rows = buildExportRows(sampleDays, {
      endDate: new Date('2024-06-02T12:00:00Z'),
      timeframe: TIMEFRAMES.WEEK,
      filter: ACTIVITY_FILTERS.ALL,
    });

    expect(rows).toContainEqual({
      domain: 'example.com',
      activeSeconds: 210,
      idleSeconds: 30,
      totalSeconds: 240,
    });
  });

  it('computes trend deltas against previous period', () => {
    const trend = calculateTrends(sampleDays, {
      endDate: new Date('2024-06-02T12:00:00Z'),
      timeframe: TIMEFRAMES.WEEK,
      filter: ACTIVITY_FILTERS.ALL,
    });

    expect(trend?.topDomain?.domain).toBe('example.com');
    expect(typeof trend?.totals?.delta).toBe('number');
  });

  it('provides sensible date ranges', () => {
    const range = getDateRange(new Date('2024-06-02T00:00:00Z'), TIMEFRAMES.WEEK);

    expect(range?.start.format('YYYY-MM-DD')).toBe('2024-05-27');
    expect(range?.end.format('YYYY-MM-DD')).toBe('2024-06-02');
  });
});
