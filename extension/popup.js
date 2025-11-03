import Chart from 'chart.js/auto';
import dayjs from 'dayjs';
import { getStoredState } from './lib/storage.js';

const chromeApi = globalThis.chrome;
const optionsButton = document.getElementById('open-options');
const clearButton = document.getElementById('clear-data');
const tableBody = document.getElementById('domain-rows');
const statusMessage = document.getElementById('status-message');
const daySelect = document.getElementById('day-select');
const chartCanvas = document.getElementById('activity-chart');
const chartEmpty = document.getElementById('chart-empty');
const topDomainsList = document.getElementById('top-domain-list');

let chartInstance = null;
let cachedDays = {};

if (optionsButton && chromeApi?.runtime?.openOptionsPage) {
  optionsButton.addEventListener('click', () => {
    chromeApi.runtime.openOptionsPage();
  });
}

async function loadStoredDomains() {
  try {
    setStatus('');
    const state = await getStoredState();
    cachedDays = state.days ?? {};
    const dayKeys = getSortedDayKeys(cachedDays);

    renderDayOptions(dayKeys);

    if (dayKeys.length === 0) {
      renderTable([]);
      renderChart('', []);
      renderTopDomains([]);
      setStatus('No activity recorded yet. Start browsing to see data here.');
      return;
    }

    const defaultDay = dayKeys.at(-1);
    const selected = daySelect?.value && dayKeys.includes(daySelect.value) ? daySelect.value : defaultDay;

    if (daySelect) {
      daySelect.value = selected;
    }

    updateSelectedDay(selected);
  } catch (error) {
    console.error('Failed to load stored domains', error);
    cachedDays = {};
    renderTable([]);
    renderChart('', []);
    renderTopDomains([]);
    setStatus('Unable to load stored data. Please try again later.');
  }
}

function updateSelectedDay(dateKey) {
  if (!dateKey) {
    renderTable([]);
    renderChart('', []);
    renderTopDomains([]);
    return;
  }

  const totals = aggregateDayDomains(cachedDays, dateKey);
  renderTable(totals);
  renderChart(dateKey, totals);
  renderTopDomains(totals);

  if (totals.length === 0) {
    setStatus('No activity recorded for the selected day.');
  } else {
    setStatus('');
  }
}

function getSortedDayKeys(days) {
  return Object.keys(days ?? {}).sort((a, b) => a.localeCompare(b));
}

function aggregateDayDomains(days, dateKey) {
  const dayData = resolveDaySites(days?.[dateKey]);
  return Object.entries(dayData)
    .map(([domain, seconds]) => ({
      domain,
      minutes: Number(seconds || 0) / 60,
    }))
    .filter((entry) => entry.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

function resolveDaySites(dayValue) {
  if (!dayValue || typeof dayValue !== 'object') {
    return {};
  }

  if (dayValue.sites && typeof dayValue.sites === 'object') {
    return dayValue.sites;
  }

  return dayValue;
}

function renderTable(totals) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';

  if (totals.length === 0) {
    tableBody.innerHTML = `
      <tr data-empty>
        <td colspan="2">No activity tracked for this day.</td>
      </tr>
    `;
    return;
  }

  const fragment = document.createDocumentFragment();

  totals.forEach(({ domain, minutes }) => {
    const row = document.createElement('tr');

    const domainCell = document.createElement('td');
    domainCell.textContent = domain;
    domainCell.title = domain;

    const minutesCell = document.createElement('td');
    minutesCell.className = 'table__numeric';
    minutesCell.textContent = formatMinutes(minutes);

    row.append(domainCell, minutesCell);
    fragment.append(row);
  });

  tableBody.append(fragment);
}

function renderDayOptions(dayKeys) {
  if (!daySelect) {
    return;
  }

  daySelect.innerHTML = '';
  daySelect.disabled = dayKeys.length === 0;

  if (dayKeys.length === 0) {
    const option = document.createElement('option');
    option.textContent = 'No days tracked';
    option.value = '';
    daySelect.append(option);
    return;
  }

  dayKeys.forEach((dateKey) => {
    const option = document.createElement('option');
    option.value = dateKey;
    option.textContent = formatDayLabel(dateKey);
    daySelect.append(option);
  });
}

function formatDayLabel(dateKey) {
  const parsed = dayjs(dateKey);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : dateKey;
}

function renderChart(dateKey, totals) {
  if (!chartCanvas || !chartEmpty) {
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const hasData = totals.length > 0;
  chartEmpty.hidden = hasData;
  chartCanvas.style.visibility = hasData ? 'visible' : 'hidden';
  chartCanvas.setAttribute('aria-hidden', String(!hasData));

  if (!hasData) {
    const label = dateKey ? formatDayLabel(dateKey) : 'the selected day';
    chartEmpty.textContent = `No activity recorded for ${label}.`;
    chartCanvas.height = 200;
    return;
  }

  const labels = totals.map(({ domain }) => domain);
  const minutes = totals.map(({ minutes }) => minutes);
  const maxMinutes = Math.max(...minutes, 0.01);
  const backgroundColor = minutes.map((value) => toHeatColor(value, maxMinutes));
  const dynamicHeight = Math.max(200, totals.length * 36);
  chartCanvas.height = dynamicHeight;
  const context = chartCanvas.getContext('2d');

  chartInstance = new Chart(context, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          data: minutes,
          label: `Minutes on ${formatDayLabel(dateKey)}`,
          backgroundColor,
          borderRadius: 12,
          borderSkipped: false,
          barPercentage: 0.9,
          categoryPercentage: 0.75,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      animation: { duration: 300 },
      layout: {
        padding: {
          top: 8,
          bottom: 8,
          left: 4,
          right: 12,
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label(contextValue) {
              const value = Number(contextValue.raw ?? 0);
              return `${formatMinutes(value)} min`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: 'rgba(223, 226, 255, 0.8)',
            callback(value) {
              return formatMinutes(Number(value));
            },
          },
          grid: {
            color: 'rgba(122, 127, 255, 0.16)',
          },
          border: {
            color: 'rgba(122, 127, 255, 0.25)',
          },
        },
        y: {
          ticks: {
            color: 'rgba(223, 226, 255, 0.9)',
            font: {
              size: 12,
            },
          },
          grid: {
            display: false,
          },
        },
      },
    },
  });
}

function renderTopDomains(totals) {
  if (!topDomainsList) {
    return;
  }

  topDomainsList.innerHTML = '';

  if (totals.length === 0) {
    topDomainsList.dataset.empty = 'true';
    const item = document.createElement('li');
    item.textContent = 'No domain activity recorded.';
    topDomainsList.append(item);
    return;
  }

  topDomainsList.removeAttribute('data-empty');

  totals.slice(0, 5).forEach(({ domain, minutes }) => {
    const item = document.createElement('li');
    const minutesSpan = document.createElement('span');
    const formattedMinutes = formatMinutes(minutes);

    minutesSpan.textContent = `${formattedMinutes} min`;
    minutesSpan.setAttribute('aria-label', `${formattedMinutes} minutes`);
    item.textContent = domain;
    item.append(minutesSpan);
    topDomainsList.append(item);
  });
}

function toHeatColor(value, max) {
  const ratio = Math.max(0.15, Math.min(1, value / max));
  const hue = 230 - ratio * 140;
  const saturation = 70 + ratio * 20;
  const lightness = 35 + (1 - ratio) * 20;

  return `hsl(${hue.toFixed(0)} ${saturation.toFixed(0)}% ${lightness.toFixed(0)}% / 0.9)`;
}

function formatMinutes(value) {
  if (!Number.isFinite(value)) {
    return '0';
  }

  return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
}

function setStatus(message) {
  if (!statusMessage) {
    return;
  }

  statusMessage.textContent = message;
}

async function clearStoredData() {
  if (!clearButton) {
    return;
  }

  if (!chromeApi?.storage?.local) {
    setStatus('Storage is not available in this environment.');
    return;
  }

  clearButton.disabled = true;
  setStatus('Clearing data…');

  try {
    await new Promise((resolve, reject) => {
      chromeApi.storage.local.clear(() => {
        const error = chromeApi.runtime?.lastError;

        if (error) {
          reject(new Error(error.message));
          return;
        }

        resolve();
      });
    });

    cachedDays = {};
    setStatus('All data cleared.');
    renderTable([]);
    renderChart('', []);
    renderTopDomains([]);
    renderDayOptions([]);
  } catch (error) {
    console.error('Failed to clear stored data', error);
    setStatus('Unable to clear data. Please try again.');
  } finally {
    clearButton.disabled = false;
    await loadStoredDomains();
  }
}

if (clearButton) {
  clearButton.addEventListener('click', clearStoredData);
}

if (daySelect) {
  daySelect.addEventListener('change', (event) => {
    updateSelectedDay(event.target.value);
  });
}

loadStoredDomains();
