import { createInitialState, getStoredState, saveState, updateInterval } from './lib/storage.js';

const form = document.getElementById('options-form');
const statusEl = document.querySelector('.status');

async function loadOptions() {
  try {
    const state = await getStoredState();
    const intervalInput = document.getElementById('interval');

    if (intervalInput) {
      intervalInput.value = state.options.intervalMinutes;
    }
  } catch (error) {
    console.error('Failed to load options', error);
  }
}

async function saveOptions(event) {
  event.preventDefault();

  const data = new FormData(form);
  const minutes = Number.parseInt(data.get('interval'), 10) || createInitialState().options.intervalMinutes;

  try {
    const current = await getStoredState();
    const updated = updateInterval(current, minutes);
    await saveState(updated);
    statusEl.textContent = 'Options saved!';
    setTimeout(() => {
      statusEl.textContent = '';
    }, 1500);
  } catch (error) {
    console.error('Failed to save options', error);
    statusEl.textContent = 'Unable to save options';
  }
}

if (form) {
  form.addEventListener('submit', saveOptions);
  loadOptions();
}
