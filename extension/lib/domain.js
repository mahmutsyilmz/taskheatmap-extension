export function normalizeDomain(url) {
  if (!url) {
    return null;
  }

  try {
    const { hostname } = new URL(url.startsWith('http') ? url : `https://${url}`);
    return hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

export function groupByDomain(entries) {
  return entries.reduce((acc, entry) => {
    const domain = normalizeDomain(entry.url);

    if (!domain) {
      return acc;
    }

    acc[domain] = (acc[domain] ?? 0) + (entry.duration ?? 0);
    return acc;
  }, {});
}
