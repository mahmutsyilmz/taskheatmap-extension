import { describe, expect, it } from 'vitest';
import { groupByDomain, normalizeDomain } from '../lib/domain.js';

describe('domain helpers', () => {
  it('normalizes URLs and strips protocol + www', () => {
    expect(normalizeDomain('https://www.example.com/path')).toBe('example.com');
    expect(normalizeDomain('sub.domain.com')).toBe('sub.domain.com');
    expect(normalizeDomain('not a url')).toBeNull();
  });

  it('groups entries by normalized domain', () => {
    const entries = [
      { url: 'https://example.com', duration: 10 },
      { url: 'http://www.example.com/home', duration: 5 },
      { url: 'https://another.dev', duration: 3 },
    ];

    expect(groupByDomain(entries)).toEqual({
      'example.com': 15,
      'another.dev': 3,
    });
  });
});
