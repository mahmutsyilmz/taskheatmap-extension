import dayjs from 'dayjs';
import { renderChart, destroyChart } from './chart.js';
import {
  getElements,
  highlightSegmented,
  renderDayOptions,
  renderTable,
  renderTopDomains,
  setStatus,
  toggleModal,
  updateEmptyState,
  updateStreak,
  updateTotalDuration,
  updateTrendSummary,
} from './ui.js';
import {
  ACTIVITY_FILTERS,
  TIMEFRAMES,
  aggregateDomains,
  aggregateTotals,
  buildExportRows,
  calculateTrends,
  computeStreak,
} from '../lib/analytics.js';
import { serializeToCsv, serializeToJson, downloadCsv } from '../lib/export.js';
import { getStoredState } from '../lib/storage.js';

const chromeApi = globalThis.chrome;
const MESSAGE_TYPES = {
  GET_STATE: 'taskheatmap:get-state',
  STATE_UPDATED: 'taskheatmap:state-updated',
  OPTIONS_UPDATED: 'taskheatmap:options-updated',
};

const elements = getElements();

let cachedState = null;
let selectedDay = '';
let selectedTimeframe = TIMEFRAMES.DAY;
let selectedFilter = ACTIVITY_FILTERS.ALL;
let latestTrend = null;
let isLoading = false;

function getReferenceDate() {
  if (!selectedDay) {
    return new Date();
  }

  const parsed = dayjs(`${selectedDay}T00:00:00Z`);
  return parsed.isValid() ? parsed.toDate() : new Date();
}

async function requestStateFromBackground({ flushPending = false } = {}) {
  if (!chromeApi?.runtime?.sendMessage) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      chromeApi.runtime.sendMessage(
        {
          type: MESSAGE_TYPES.GET_STATE,
          flushPending,
          timeframe: selectedTimeframe,
          filter: selectedFilter,
        },
        (response) => {
          const error = chromeApi.runtime?.lastError;

          if (error) {
            console.warn('[TaskHeatmap] Failed to fetch state from background', error.message);
            resolve(null);
            return;
          }

          if (response?.ok) {
            latestTrend = response.trend ?? null;
            resolve(response.state ?? null);
            return;
          }

          if (response?.error) {
            console.warn('[TaskHeatmap] Background rejected state request', response.error);
          }

          resolve(null);
        }
      );
    } catch (error) {
      console.warn('[TaskHeatmap] Failed to request state from background', error);
      resolve(null);
    }
  });
}

function getDayKeys(days) {
  return Object.keys(days ?? {}).sort((a, b) => a.localeCompare(b));
}

function updateSelections(days) {
  const dayKeys = getDayKeys(days);

  if (!dayKeys.includes(selectedDay)) {
    selectedDay = dayKeys.at(-1) ?? '';
  }

  renderDayOptions(elements.daySelect, dayKeys, selectedDay);
}

function formatRangeLabel(date) {
  const reference = dayjs(date);

  if (!reference.isValid()) {
    return '';
  }

  if (selectedTimeframe === TIMEFRAMES.DAY) {
    return reference.format('MMM D, YYYY');
  }

  if (selectedTimeframe === TIMEFRAMES.WEEK) {
    const start = reference.subtract(6, 'day');
    return `${start.format('MMM D')} – ${reference.format('MMM D, YYYY')}`;
  }

  const start = reference.subtract(29, 'day');
  return `${start.format('MMM D')} – ${reference.format('MMM D, YYYY')}`;
}

function getFilterLabel() {
  switch (selectedFilter) {
    case ACTIVITY_FILTERS.ACTIVE:
      return 'Active';
    case ACTIVITY_FILTERS.IDLE:
      return 'Idle';
    default:
      return 'All';
  }
}

function renderView() {
  if (!cachedState) {
    renderTable(elements.tableBody, []);
    renderTopDomains(elements.topDomainsList, []);
    updateEmptyState(elements.chartCanvas, elements.chartEmpty, 'No data yet.');
    destroyChart();
    updateTrendSummary(elements.trendSummary, null);
    updateTotalDuration(elements.totalDuration, { totalSeconds: 0 }, 'Total');
    updateStreak(elements.streakCounter, 0);
    return false;
  }

  const referenceDate = getReferenceDate();
  const aggregated = aggregateDomains(cachedState.days, {
    endDate: referenceDate,
    timeframe: selectedTimeframe,
    filter: selectedFilter,
  });
  const totals = aggregateTotals(cachedState.days, {
    endDate: referenceDate,
    timeframe: selectedTimeframe,
    filter: selectedFilter,
  });

  const hasData = aggregated.length > 0;
  const timeframeLabel = formatRangeLabel(referenceDate);
  const filterLabel = getFilterLabel();

  renderTable(elements.tableBody, aggregated);
  renderTopDomains(elements.topDomainsList, aggregated);
  updateEmptyState(
    elements.chartCanvas,
    elements.chartEmpty,
    hasData ? null : 'No activity in this range yet.'
  );

  if (hasData) {
    renderChart(elements.chartCanvas, aggregated, { filterLabel, timeframeLabel });
  } else {
    destroyChart();
  }

  const localTrend = calculateTrends(cachedState.days, {
    endDate: referenceDate,
    timeframe: selectedTimeframe,
    filter: selectedFilter,
  });

  updateTrendSummary(elements.trendSummary, latestTrend ?? localTrend);
  updateTotalDuration(elements.totalDuration, totals, timeframeLabel || 'Total');
  updateStreak(
    elements.streakCounter,
    computeStreak(cachedState.days, { filter: ACTIVITY_FILTERS.ACTIVE })
  );

  return hasData;
}

async function loadState({ flushPending = false } = {}) {
  if (isLoading) {
    return;
  }

  isLoading = true;
  setStatus(elements.statusMessage, flushPending ? 'Refreshing data…' : 'Loading data…');

  try {
    const backgroundState = await requestStateFromBackground({ flushPending });
    const state = backgroundState ?? (await getStoredState());
    cachedState = state;
    updateSelections(state.days ?? {});
    const hasData = renderView();
    setStatus(elements.statusMessage, hasData ? '' : 'No activity recorded yet.');
  } catch (error) {
    console.error('[TaskHeatmap] Failed to load stored domains', error);
    cachedState = null;
    renderView();
    setStatus(elements.statusMessage, 'Unable to load stored data.');
  } finally {
    isLoading = false;
  }
}

async function openOptionsPage() {
  if (!chromeApi?.runtime) {
    setStatus(elements.statusMessage, 'Options page is unavailable.');
    return;
  }

  if (typeof chromeApi.runtime.openOptionsPage === 'function') {
    try {
      await new Promise((resolve, reject) => {
        chromeApi.runtime.openOptionsPage(() => {
          const error = chromeApi.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve();
        });
      });
      return;
    } catch (error) {
      console.warn(
        '[TaskHeatmap] Failed to open options page via chrome.runtime.openOptionsPage',
        error
      );
    }
  }

  const url = chromeApi.runtime.getURL?.('options.html');

  if (url && typeof chromeApi.tabs?.create === 'function') {
    try {
      await new Promise((resolve, reject) => {
        chromeApi.tabs.create({ url }, () => {
          const error = chromeApi.runtime?.lastError;
          if (error) {
            reject(new Error(error.message));
            return;
          }
          resolve();
        });
      });
      return;
    } catch (error) {
      console.warn('[TaskHeatmap] Failed to open options page via chrome.tabs.create', error);
    }
  }

  setStatus(elements.statusMessage, 'Unable to open options automatically.');
}

function bindEventListeners() {
  elements.timeframeControls.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener('click', () => {
      const value = button.dataset.timeframe;
      if (!value || value === selectedTimeframe) {
        return;
      }
      selectedTimeframe = value;
      highlightSegmented(elements.timeframeControls, 'timeframe', selectedTimeframe);
      void loadState();
    });
  });

  elements.filterControls.forEach((button) => {
    if (!(button instanceof HTMLButtonElement)) {
      return;
    }

    button.addEventListener('click', () => {
      const value = button.dataset.filter;
      if (!value || value === selectedFilter) {
        return;
      }
      selectedFilter = value;
      highlightSegmented(elements.filterControls, 'filter', selectedFilter);
      void loadState();
    });
  });

  elements.daySelect?.addEventListener('change', (event) => {
    const value = event.target.value;
    if (value) {
      selectedDay = value;
      void loadState();
    }
  });

  elements.optionsButton?.addEventListener('click', () => {
    void openOptionsPage();
  });

  if (elements.modal) {
    elements.modal.tabIndex = -1;
  }

  elements.clearButton?.addEventListener('click', () => {
    toggleModal(elements.modal, true);
  });

  elements.confirmCancel?.addEventListener('click', () => {
    toggleModal(elements.modal, false);
  });

  elements.confirmAccept?.addEventListener('click', async () => {
    if (!chromeApi?.storage?.local) {
      setStatus(elements.statusMessage, 'Storage is not available.');
      toggleModal(elements.modal, false);
      return;
    }

    elements.clearButton.disabled = true;
    setStatus(elements.statusMessage, 'Clearing data…');

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
      cachedState = null;
      renderView();
      setStatus(elements.statusMessage, 'All data cleared.');
      await loadState();
    } catch (error) {
      console.error('[TaskHeatmap] Failed to clear stored data', error);
      setStatus(elements.statusMessage, 'Unable to clear data.');
    } finally {
      toggleModal(elements.modal, false);
      elements.clearButton.disabled = false;
    }
  });

  elements.exportCsv?.addEventListener('click', () => {
    if (!cachedState) {
      return;
    }

    const rows = buildExportRows(cachedState.days, {
      endDate: getReferenceDate(),
      timeframe: selectedTimeframe,
      filter: selectedFilter,
    });
    const csv = serializeToCsv(rows);
    downloadCsv(`taskheatmap-${selectedTimeframe}.csv`, csv);
  });

  elements.exportJson?.addEventListener('click', () => {
    if (!cachedState) {
      return;
    }

    const rows = buildExportRows(cachedState.days, {
      endDate: getReferenceDate(),
      timeframe: selectedTimeframe,
      filter: selectedFilter,
    });
    const json = serializeToJson(rows);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `taskheatmap-${selectedTimeframe}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  });
}

function attachBackgroundListeners() {
  if (!chromeApi?.runtime?.onMessage?.addListener) {
    return;
  }

  chromeApi.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_TYPES.STATE_UPDATED) {
      void loadState();
    }
  });
}

function initializeControls() {
  highlightSegmented(elements.timeframeControls, 'timeframe', selectedTimeframe);
  highlightSegmented(elements.filterControls, 'filter', selectedFilter);
}

void (async function bootstrap() {
  initializeControls();
  bindEventListeners();
  attachBackgroundListeners();
  await loadState({ flushPending: true });
})();
