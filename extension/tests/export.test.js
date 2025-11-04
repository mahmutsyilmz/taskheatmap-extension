import { describe, expect, it, vi } from 'vitest';
import { serializeToCsv, serializeToJson, downloadCsv, __test__ } from '../lib/export.js';

const sampleEntries = [
  { domain: 'example.com', duration: 120 },
  { domain: 'openai.com', duration: 45 },
];

describe('export serialization', () => {
  it('produces stable JSON output', () => {
    const json = serializeToJson(sampleEntries);
    const parsed = JSON.parse(json);

    expect(parsed).toEqual(sampleEntries);
    expect(json).toBe(
      '[\n  {\n    "domain": "example.com",\n    "duration": 120\n  },\n  {\n    "domain": "openai.com",\n    "duration": 45\n  }\n]'
    );
  });

  it('omits invalid entries from JSON', () => {
    const json = serializeToJson([
      ...sampleEntries,
      { domain: null, duration: 10 },
      { domain: 'broken.com', duration: Number.NaN },
    ]);

    expect(JSON.parse(json)).toEqual([
      { domain: 'example.com', duration: 120 },
      { domain: 'openai.com', duration: 45 },
      { domain: 'broken.com', duration: 0 },
    ]);
  });

  it('escapes data for CSV export', () => {
    const csv = serializeToCsv([
      { domain: 'example.com', duration: 120 },
      { domain: 'quoted"domain.com', duration: 30 },
    ]);

    expect(csv).toBe('"domain","duration"\n"example.com","120"\n"quoted""domain.com","30"');
  });

  it('removes invalid rows for CSV export', () => {
    const csv = serializeToCsv([...sampleEntries, { domain: null, duration: 10 }]);

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
