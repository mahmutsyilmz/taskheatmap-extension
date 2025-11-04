/* eslint-disable no-console */
import { normalizeDomain } from './lib/domain.js';
import { addTrackedSeconds, createInitialState, getStoredState, saveState } from './lib/storage.js';

const TICK_INTERVAL = 10 * 1000;
const MIN_VISIT_SECONDS = 5;
const IDLE_DETECTION_INTERVAL_SECONDS = 60;

const MESSAGE_TYPES = {
  GET_STATE: 'taskheatmap:get-state',
  STATE_UPDATED: 'taskheatmap:state-updated',
};

let tickTimer = null;
let lastTickTimestamp = Date.now();
let lastActiveDomain = null;
let isIdle = false;
let state = createInitialState();
let stateLoaded = false;
let stateLoadPromise = null;
let workQueue = Promise.resolve();

function enqueueWork(task) {
  workQueue = workQueue
    .then(() => task())
    .catch((error) => {
      console.error('[TaskHeatmap] Background task failed', error);
    });

  return workQueue;
}

async function ensureStateLoaded() {
  if (stateLoaded) {
    return state;
  }

  if (!stateLoadPromise) {
    stateLoadPromise = getStoredState()
      .then((stored) => {
        state = stored;
        stateLoaded = true;
        return state;
      })
      .catch((error) => {
        console.error('[TaskHeatmap] Failed to load stored state', error);
        state = createInitialState();
        stateLoaded = true;
        return state;
      })
      .finally(() => {
        stateLoadPromise = null;
      });
  }

  return stateLoadPromise;
}

function queryActiveTab() {
  return new Promise((resolve) => {
    const tabsApi = globalThis.chrome?.tabs;

    if (!tabsApi?.query) {
      resolve(null);
      return;
    }

    tabsApi.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const error = globalThis.chrome?.runtime?.lastError;

      if (error) {
        console.warn('[TaskHeatmap] Failed to query active tab', error.message);
        resolve(null);
        return;
      }

      resolve(Array.isArray(tabs) && tabs.length > 0 ? tabs[0] : null);
    });
  });
}

async function resolveActiveDomain() {
  const tab = await queryActiveTab();

  if (!tab?.url) {
    return null;
  }

  return normalizeDomain(tab.url);
}

async function recordDomainTime(domain, seconds) {
  if (!domain || seconds < MIN_VISIT_SECONDS) {
    return;
  }

  await ensureStateLoaded();
  state = addTrackedSeconds(state, domain, seconds);

  try {
    await saveState(state);
    console.log(`tracked ${domain} +${seconds}s`);
    notifyStateUpdated();
  } catch (error) {
    console.error(`[TaskHeatmap] Failed to persist tracked time for ${domain}`, error);
  }
}

async function runTick() {
  await ensureStateLoaded();

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastTickTimestamp) / 1000);
  lastTickTimestamp = now;

  if (!isIdle && lastActiveDomain && elapsedSeconds > 0) {
    await recordDomainTime(lastActiveDomain, elapsedSeconds);
  }

  if (isIdle) {
    lastActiveDomain = null;
    return;
  }

  const domain = await resolveActiveDomain();
  lastActiveDomain = domain;
}

async function processIdleStateChange(stateValue) {
  const nowIdle = stateValue === 'idle' || stateValue === 'locked';

  if (nowIdle === isIdle) {
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - lastTickTimestamp) / 1000);
  lastTickTimestamp = now;

  if (nowIdle) {
    if (lastActiveDomain && elapsedSeconds > 0) {
      await recordDomainTime(lastActiveDomain, elapsedSeconds);
    }

    lastActiveDomain = null;
    isIdle = true;
    return;
  }

  isIdle = false;
  lastActiveDomain = await resolveActiveDomain();
}

function initializeIdleTracking() {
  const idleApi = globalThis.chrome?.idle;

  if (!idleApi) {
    return;
  }

  if (typeof idleApi.setDetectionInterval === 'function') {
    try {
      idleApi.setDetectionInterval(IDLE_DETECTION_INTERVAL_SECONDS);
    } catch (error) {
      console.warn('[TaskHeatmap] Failed to set idle detection interval', error);
    }
  }

  idleApi.onStateChanged.addListener((stateValue) => {
    void enqueueWork(() => processIdleStateChange(stateValue));
  });

  idleApi.queryState(IDLE_DETECTION_INTERVAL_SECONDS, async (stateValue) => {
    const error = globalThis.chrome?.runtime?.lastError;

    if (error) {
      console.warn('[TaskHeatmap] Failed to query initial idle state', error.message);
      return;
    }

    isIdle = stateValue === 'idle' || stateValue === 'locked';
    lastTickTimestamp = Date.now();

    if (!isIdle) {
      const domain = await resolveActiveDomain();
      lastActiveDomain = domain;
    }
  });
}

function startTickLoop() {
  if (tickTimer) {
    return;
  }

  lastTickTimestamp = Date.now();
  tickTimer = setInterval(() => {
    void enqueueWork(runTick);
  }, TICK_INTERVAL);
  console.info('[TaskHeatmap] Background tick loop started.');
  void enqueueWork(runTick);
}

function stopTickLoop() {
  if (!tickTimer) {
    return;
  }

  clearInterval(tickTimer);
  tickTimer = null;
  console.info('[TaskHeatmap] Background tick loop stopped.');
}

function notifyStateUpdated() {
  try {
    const result = chrome.runtime?.sendMessage?.({ type: MESSAGE_TYPES.STATE_UPDATED });

    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (error) {
    console.warn('[TaskHeatmap] Failed to notify state update', error);
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  if (message.type === MESSAGE_TYPES.GET_STATE) {
    const { flushPending = false } = message;

    enqueueWork(async () => {
      try {
        if (flushPending) {
          await runTick();
        } else {
          await ensureStateLoaded();
        }

        sendResponse({ ok: true, state });
      } catch (error) {
        console.error('[TaskHeatmap] Failed to resolve state for popup', error);
        sendResponse({ ok: false, error: error.message });
      }
    });

    return true;
  }

  return undefined;
});

chrome.runtime.onInstalled.addListener(() => {
  console.info('[TaskHeatmap] Extension installed.');
});

chrome.runtime.onStartup.addListener(() => {
  startTickLoop();
});

chrome.runtime.onSuspend.addListener(() => {
  stopTickLoop();
});

initializeIdleTracking();
startTickLoop();
