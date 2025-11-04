function sanitizeEntries(entries = []) {
  return entries
    .filter((entry) => entry && typeof entry.domain === 'string')
    .map((entry) => ({
      domain: entry.domain,
      activeSeconds: Number.isFinite(entry.activeSeconds) ? entry.activeSeconds : 0,
      idleSeconds: Number.isFinite(entry.idleSeconds) ? entry.idleSeconds : 0,
      totalSeconds: Number.isFinite(entry.totalSeconds)
        ? entry.totalSeconds
        : (Number.isFinite(entry.activeSeconds) ? entry.activeSeconds : 0) +
          (Number.isFinite(entry.idleSeconds) ? entry.idleSeconds : 0),
    }));
}

export function serializeToJson(entries) {
  return JSON.stringify(sanitizeEntries(entries), null, 2);
}

export function serializeToCsv(entries) {
  const headers = ['domain', 'activeSeconds', 'idleSeconds', 'totalSeconds'];
  const rows = sanitizeEntries(entries).map(
    ({ domain, activeSeconds, idleSeconds, totalSeconds }) => [
      domain,
      String(activeSeconds ?? 0),
      String(idleSeconds ?? 0),
      String(totalSeconds ?? 0),
    ]
  );
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
