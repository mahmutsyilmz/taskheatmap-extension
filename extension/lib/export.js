function sanitizeEntries(entries = []) {
  return entries
    .filter((entry) => entry && typeof entry.domain === 'string')
    .map((entry) => ({
      domain: entry.domain,
      duration: Number.isFinite(entry.duration) ? entry.duration : 0,
    }));
}

export function serializeToJson(entries) {
  return JSON.stringify(sanitizeEntries(entries), null, 2);
}

export function serializeToCsv(entries) {
  const headers = ['domain', 'duration'];
  const rows = sanitizeEntries(entries).map(({ domain, duration }) => [
    domain,
    String(duration ?? 0),
  ]);
  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');
}

export function downloadCsv(filename, csvContent, downloader = null) {
  const triggerDownload =
    downloader ??
    ((name, content) => {
      const blob = new Blob([content], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      link.click();
      URL.revokeObjectURL(url);
    });

  triggerDownload(filename, csvContent);
}

export const __test__ = { sanitizeEntries };
