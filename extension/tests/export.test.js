import { describe, expect, it, vi } from 'vitest';
import { serializeToCsv, serializeToJson, downloadCsv, __test__ } from '../lib/export.js';

const sampleEntries = [
  { domain: 'example.com', activeSeconds: 300, idleSeconds: 60, totalSeconds: 360 },
  { domain: 'openai.com', activeSeconds: 120, idleSeconds: 30, totalSeconds: 150 },
];

describe('export serialization', () => {
  it('produces stable JSON output', () => {
    const json = serializeToJson(sampleEntries);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(sampleEntries);
  });

  it('normalizes invalid entries in JSON', () => {
    const json = serializeToJson([
      ...sampleEntries,
      { domain: null, activeSeconds: 10, idleSeconds: 5 },
      { domain: 'broken.com', activeSeconds: Number.NaN, idleSeconds: 5 },
    ]);

    expect(JSON.parse(json)).toEqual([
      { domain: 'example.com', activeSeconds: 300, idleSeconds: 60, totalSeconds: 360 },
      { domain: 'openai.com', activeSeconds: 120, idleSeconds: 30, totalSeconds: 150 },
      { domain: 'broken.com', activeSeconds: 0, idleSeconds: 5, totalSeconds: 5 },
    ]);
  });

  it('escapes data for CSV export', () => {
    const csv = serializeToCsv([
      { domain: 'example.com', activeSeconds: 60, idleSeconds: 30, totalSeconds: 90 },
      { domain: 'quoted"domain.com', activeSeconds: 10, idleSeconds: 0, totalSeconds: 10 },
    ]);

    expect(csv).toBe(
      '"domain","activeSeconds","idleSeconds","totalSeconds"\n"example.com","60","30","90"\n"quoted""domain.com","10","0","10"'
    );
  });

  it('removes invalid rows for CSV export', () => {
    const csv = serializeToCsv([...sampleEntries, { domain: null, totalSeconds: 10 }]);

    expect(csv.split('\n')).toHaveLength(3);
  });

  it('supports custom download implementations', () => {
    const downloader = vi.fn();
    const csv = serializeToCsv(sampleEntries);

    downloadCsv('report.csv', csv, downloader);

    expect(downloader).toHaveBeenCalledWith('report.csv', csv);
  });

  it('provides sanitized entries for validation', () => {
    expect(__test__.sanitizeEntries(sampleEntries)).toEqual(sampleEntries);
  });
});
