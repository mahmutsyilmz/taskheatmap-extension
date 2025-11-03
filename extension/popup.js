import { getStoredState } from './lib/storage.js';

const chromeApi = globalThis.chrome;
const optionsButton = document.getElementById('open-options');
const clearButton = document.getElementById('clear-data');
const tableBody = document.getElementById('domain-rows');
const statusMessage = document.getElementById('status-message');

if (optionsButton && chromeApi?.runtime?.openOptionsPage) {
  optionsButton.addEventListener('click', () => {
    chromeApi.runtime.openOptionsPage();
  });
}

async function loadStoredDomains() {
  try {
    setStatus('');
    const state = await getStoredState();
    const totals = aggregateDomains(state.days);

    renderTable(totals);

    if (totals.length === 0) {
      setStatus('No activity recorded yet. Start browsing to see data here.');
    }
  } catch (error) {
    console.error('Failed to load stored domains', error);
    renderTable([]);
    setStatus('Unable to load stored data. Please try again later.');
  }
}

function aggregateDomains(days) {
  const entries = new Map();

  Object.values(days ?? {}).forEach((domains) => {
    Object.entries(domains ?? {}).forEach(([domain, seconds]) => {
      const totalSeconds = entries.get(domain) ?? 0;
      entries.set(domain, totalSeconds + Number(seconds || 0));
    });
  });

  return Array.from(entries.entries())
    .map(([domain, seconds]) => ({
      domain,
      minutes: seconds / 60,
    }))
    .sort((a, b) => b.minutes - a.minutes);
}

function renderTable(totals) {
  if (!tableBody) {
    return;
  }

  tableBody.innerHTML = '';

  if (totals.length === 0) {
    tableBody.innerHTML = `
      <tr data-empty>
        <td colspan="2">No browsing data stored yet.</td>
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

    setStatus('All data cleared.');
    renderTable([]);
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

loadStoredDomains();
