import { resolveFriendlyDomain, toMinutes } from '../lib/analytics.js';

export function getElements() {
  return {
    optionsButton: document.getElementById('open-options'),
    clearButton: document.getElementById('clear-data'),
    daySelect: document.getElementById('day-select'),
    chartCanvas: document.getElementById('activity-chart'),
    chartEmpty: document.getElementById('chart-empty'),
    chartEmptyMessage: document.getElementById('chart-empty-message'),
    topDomainsList: document.getElementById('top-domain-list'),
    tableBody: document.getElementById('domain-rows'),
    statusMessage: document.getElementById('status-message'),
    timeframeControls: document.querySelectorAll('[data-timeframe]'),
    filterControls: document.querySelectorAll('[data-filter]'),
    exportCsv: document.getElementById('export-csv'),
    exportJson: document.getElementById('export-json'),
    trendSummary: document.getElementById('trend-summary'),
    totalDuration: document.getElementById('total-duration'),
    streakCounter: document.getElementById('streak-counter'),
    modal: document.getElementById('confirm-modal'),
    confirmAccept: document.getElementById('confirm-accept'),
    confirmCancel: document.getElementById('confirm-cancel'),
  };
}

export function setStatus(statusEl, message) {
  if (!statusEl) {
    return;
  }

  statusEl.textContent = message ?? '';
}

export function renderDayOptions(selectEl, dayKeys, selectedKey) {
  if (!selectEl) {
    return;
  }

  selectEl.innerHTML = '';
  selectEl.disabled = dayKeys.length === 0;

  if (dayKeys.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No days tracked';
    option.value = '';
    selectEl.append(option);
    return;
  }

  dayKeys.forEach((key) => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = new Date(`${key}T00:00:00Z`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    if (key === selectedKey) {
      option.selected = true;
    }
    selectEl.append(option);
  });
}

export function highlightSegmented(controlList, attribute, value) {
  controlList.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    const isActive = button.dataset[attribute] === value;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
    if (isActive) {
      button.setAttribute('tabindex', '0');
    } else {
      button.setAttribute('tabindex', '-1');
    }
  });
}

function formatMinutes(minutes) {
  if (!Number.isFinite(minutes)) {
    return '0m';
  }

  if (minutes < 1) {
    return `${minutes.toFixed(1)}m`;
  }

  return `${Math.round(minutes)}m`;
}

export function renderTable(body, entries) {
  if (!body) {
    return;
  }

  body.innerHTML = '';

  if (!entries || entries.length === 0) {
    const row = document.createElement('tr');
    row.dataset.empty = 'true';
    const cell = document.createElement('td');
    cell.colSpan = 4;
    cell.textContent = 'No activity for this range yet.';
    row.append(cell);
    body.append(row);
    return;
  }

  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const row = document.createElement('tr');
    row.title = resolveFriendlyDomain(entry.domain);

    const domainCell = document.createElement('td');
    domainCell.textContent = resolveFriendlyDomain(entry.domain);

    const activeCell = document.createElement('td');
    activeCell.className = 'table__numeric';
    activeCell.textContent = formatMinutes(toMinutes(entry.activeSeconds));

    const idleCell = document.createElement('td');
    idleCell.className = 'table__numeric';
    idleCell.textContent = formatMinutes(toMinutes(entry.idleSeconds));

    const totalCell = document.createElement('td');
    totalCell.className = 'table__numeric';
    totalCell.textContent = formatMinutes(toMinutes(entry.totalSeconds));

    row.append(domainCell, activeCell, idleCell, totalCell);
    fragment.append(row);
  });

  body.append(fragment);
}

export function renderTopDomains(listEl, entries) {
  if (!listEl) {
    return;
  }

  listEl.innerHTML = '';

  if (!entries || entries.length === 0) {
    listEl.dataset.empty = 'true';
    const item = document.createElement('li');
    item.textContent = 'Browse to start building your heatmap.';
    listEl.append(item);
    return;
  }

  delete listEl.dataset.empty;

  entries.slice(0, 5).forEach((entry) => {
    const item = document.createElement('li');
    item.textContent = resolveFriendlyDomain(entry.domain);

    const badge = document.createElement('span');
    badge.textContent = `${formatMinutes(toMinutes(entry.totalSeconds))}`;
    badge.setAttribute('aria-label', `${formatMinutes(toMinutes(entry.totalSeconds))} tracked`);
    item.append(badge);
    listEl.append(item);
  });
}

export function updateEmptyState(chartCanvas, emptyContainer, message) {
  if (!chartCanvas || !emptyContainer) {
    return;
  }

  const hasData = !message;
  emptyContainer.hidden = hasData;
  chartCanvas.style.visibility = hasData ? 'visible' : 'hidden';
  chartCanvas.setAttribute('aria-hidden', String(!hasData));

  if (!hasData) {
    const textEl = emptyContainer.querySelector('p') ?? emptyContainer;
    textEl.textContent = 'No insights yet. Start browsing to see your focus map.';
    if (typeof message === 'string') {
      textEl.textContent = message;
    }
  }
}

export function updateTrendSummary(target, trend) {
  if (!target) {
    return;
  }

  target.textContent = '';

  if (!trend || !trend.topDomain) {
    target.textContent = 'No trend data yet — keep working and check back soon!';
    return;
  }

  const direction = trend.topDomain.trend?.direction ?? 'flat';
  const domainLabel = resolveFriendlyDomain(trend.topDomain.domain);

  if (direction === 'flat') {
    target.textContent = `Consistent focus on ${domainLabel}.`;
    return;
  }

  const arrow = direction === 'up' ? '▲' : '▼';
  const adjective = direction === 'up' ? 'more' : 'less';
  const percent = Math.abs(trend.topDomain.trend?.percent ?? 0).toFixed(1);
  const deltaMinutes = Math.abs(toMinutes(trend.topDomain.trend?.delta ?? 0)).toFixed(1);

  const emphasis = document.createElement('strong');
  emphasis.textContent = domainLabel;

  target.append(
    emphasis,
    document.createTextNode(
      `: ${arrow} ${percent}% ${adjective} than last period (${deltaMinutes}m).`
    )
  );
}

export function updateTotalDuration(target, totals, label) {
  if (!target) {
    return;
  }

  const minutes = toMinutes(totals.totalSeconds ?? 0);
  target.textContent = minutes > 0 ? `${label}: ${minutes.toFixed(1)} minutes` : '';
}

export function updateStreak(element, streak) {
  if (!element) {
    return;
  }

  if (!Number.isFinite(streak) || streak <= 0) {
    element.textContent = 'No streak yet — let today be day one.';
    return;
  }

  element.textContent = `🔥 ${streak}-day streak of active focus`;
}

export function toggleModal(modal, open) {
  if (!modal) {
    return;
  }

  if (open) {
    modal.hidden = false;
    modal.focus();
  } else {
    modal.hidden = true;
  }
}
