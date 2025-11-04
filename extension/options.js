import {
  createInitialState,
  getStoredState,
  saveState,
  updateDailySummary,
  updateInterval,
} from './lib/storage.js';

const MESSAGE_TYPES = {
  OPTIONS_UPDATED: 'taskheatmap:options-updated',
};

const form = document.getElementById('options-form');
const statusEl = document.querySelector('.status');
const chromeApi = globalThis.chrome;

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message ?? '';
  }
}

function formatHour(hour) {
  const normalized = Number.isFinite(hour) ? Math.max(0, Math.min(23, Math.round(hour))) : 21;
  return `${String(normalized).padStart(2, '0')}:00`;
}

async function loadOptions() {
  try {
    const state = await getStoredState();
    const intervalInput = document.getElementById('interval');
    const summaryToggle = document.getElementById('daily-summary');
    const summaryHour = document.getElementById('summary-hour');

    if (intervalInput) {
      intervalInput.value = state.options.intervalMinutes;
    }

    if (summaryToggle) {
      summaryToggle.checked = state.options.dailySummary.enabled;
    }

    if (summaryHour) {
      summaryHour.value = formatHour(state.options.dailySummary.hour);
    }
  } catch (error) {
    console.error('[TaskHeatmap] Failed to load options', error);
    setStatus('Unable to load preferences.');
  }
}

function parseHour(value) {
  if (typeof value !== 'string' || !value) {
    return createInitialState().options.dailySummary.hour;
  }

  const [hours] = value.split(':');
  const parsed = Number.parseInt(hours, 10);

  if (!Number.isFinite(parsed)) {
    return createInitialState().options.dailySummary.hour;
  }

  return Math.max(0, Math.min(23, parsed));
}

async function broadcastOptions(options) {
  if (!chromeApi?.runtime?.sendMessage) {
    return;
  }

  try {
    chromeApi.runtime.sendMessage({ type: MESSAGE_TYPES.OPTIONS_UPDATED, options });
  } catch (error) {
    console.warn('[TaskHeatmap] Failed to notify background about options update', error);
  }
}

async function saveOptions(event) {
  event.preventDefault();

  const data = new FormData(form);
  const minutes =
    Number.parseInt(data.get('interval'), 10) || createInitialState().options.intervalMinutes;
  const dailySummaryEnabled = data.get('daily-summary') === 'on';
  const hour = parseHour(data.get('summary-hour'));

  try {
    const current = await getStoredState();
    const intervalUpdated = updateInterval(current, minutes);
    const updated = updateDailySummary(intervalUpdated, { enabled: dailySummaryEnabled, hour });
    await saveState(updated);
    await broadcastOptions({ enabled: dailySummaryEnabled, hour });
    setStatus('Preferences saved!');
    setTimeout(() => setStatus(''), 1600);
  } catch (error) {
    console.error('[TaskHeatmap] Failed to save options', error);
    setStatus('Unable to save preferences.');
  }
}

if (form) {
  form.addEventListener('submit', saveOptions);
  void loadOptions();
}
