import { normalizeDomain } from './lib/domain.js';
import {
  ACTIVITY_TYPES,
  addTrackedSeconds,
  createInitialState,
  getStoredState,
  saveState,
  updateDailySummary,
} from './lib/storage.js';
import {
  calculateTrends,
  summarizeTopDomains,
  TIMEFRAMES,
  ACTIVITY_FILTERS,
} from './lib/analytics.js';
import { getRuntimeState, mergeRuntimeState, saveRuntimeState } from './lib/runtimeStorage.js';

const chromeApi = globalThis.chrome;

const TICK_INTERVAL_MS = 10_000;
const SAVE_DEBOUNCE_MS = 5_000;
const RUNTIME_SAVE_DEBOUNCE_MS = 5_000;
const MIN_VISIT_SECONDS = 5;
const IDLE_DETECTION_INTERVAL_SECONDS = 60;
const TICK_ALARM = 'taskheatmap:tick';
const SUMMARY_ALARM = 'taskheatmap:daily-summary';

const MESSAGE_TYPES = {
  GET_STATE: 'taskheatmap:get-state',
  STATE_UPDATED: 'taskheatmap:state-updated',
  OPTIONS_UPDATED: 'taskheatmap:options-updated',
};

let state = createInitialState();
let runtimeState = mergeRuntimeState(null, {});
let stateLoaded = false;
let runtimeLoaded = false;
let stateLoadPromise = null;
let runtimeLoadPromise = null;
let tickIntervalId = null;
let saveTimer = null;
let runtimeSaveTimer = null;
let workQueue = Promise.resolve();
let windowFocused = true;

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
        scheduleDailySummaryAlarm();
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

async function ensureRuntimeLoaded() {
  if (runtimeLoaded) {
    return runtimeState;
  }

  if (!runtimeLoadPromise) {
    runtimeLoadPromise = getRuntimeState()
      .then((stored) => {
        runtimeState = mergeRuntimeState(null, stored);
        runtimeLoaded = true;
        windowFocused = runtimeState.windowFocused !== false;
        return runtimeState;
      })
      .catch((error) => {
        console.error('[TaskHeatmap] Failed to load runtime state', error);
        runtimeState = mergeRuntimeState(null, {});
        runtimeLoaded = true;
        return runtimeState;
      })
      .finally(() => {
        runtimeLoadPromise = null;
      });
  }

  return runtimeLoadPromise;
}

function scheduleStateSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void flushState();
  }, SAVE_DEBOUNCE_MS);
}

async function flushState() {
  if (!stateLoaded) {
    return;
  }

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  try {
    await saveState(state);
  } catch (error) {
    console.error('[TaskHeatmap] Failed to persist state', error);
  }
}

function scheduleRuntimeSave() {
  if (runtimeSaveTimer) {
    clearTimeout(runtimeSaveTimer);
  }

  runtimeSaveTimer = setTimeout(() => {
    void flushRuntimeState();
  }, RUNTIME_SAVE_DEBOUNCE_MS);
}

async function flushRuntimeState() {
  if (!runtimeLoaded) {
    return;
  }

  if (runtimeSaveTimer) {
    clearTimeout(runtimeSaveTimer);
    runtimeSaveTimer = null;
  }

  try {
    await saveRuntimeState(runtimeState);
  } catch (error) {
    console.warn('[TaskHeatmap] Failed to persist runtime snapshot', error);
  }
}

function notifyStateUpdated() {
  try {
    const result = chromeApi?.runtime?.sendMessage?.({ type: MESSAGE_TYPES.STATE_UPDATED });

    if (result && typeof result.catch === 'function') {
      result.catch(() => {});
    }
  } catch (error) {
    console.warn('[TaskHeatmap] Failed to notify state update', error);
  }
}

async function queryActiveTab() {
  return new Promise((resolve) => {
    const tabsApi = chromeApi?.tabs;

    if (!tabsApi?.query) {
      resolve(null);
      return;
    }

    tabsApi.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const error = chromeApi?.runtime?.lastError;

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

function recordPendingDuration(domain, seconds, activityType) {
  if (!domain || seconds < MIN_VISIT_SECONDS) {
    return false;
  }

  state = addTrackedSeconds(state, domain, seconds, new Date(), undefined, activityType);
  scheduleStateSave();
  notifyStateUpdated();
  return true;
}

async function runTick({ force = false } = {}) {
  await ensureStateLoaded();
  await ensureRuntimeLoaded();

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - runtimeState.lastTimestamp) / 1000);
  runtimeState = mergeRuntimeState(runtimeState, { lastTimestamp: now });

  if (elapsedSeconds <= 0 && !force) {
    scheduleRuntimeSave();
    return;
  }

  const currentActivity =
    runtimeState.activityType === ACTIVITY_TYPES.IDLE ? ACTIVITY_TYPES.IDLE : ACTIVITY_TYPES.ACTIVE;
  let domain = runtimeState.lastDomain;

  if (currentActivity === ACTIVITY_TYPES.ACTIVE) {
    const resolved = await resolveActiveDomain();
    if (resolved) {
      domain = resolved;
      runtimeState = mergeRuntimeState(runtimeState, { lastDomain: domain });
    }
  } else if (!domain) {
    domain = '__idle__';
    runtimeState = mergeRuntimeState(runtimeState, { lastDomain: domain });
  }

  const recorded = recordPendingDuration(domain, elapsedSeconds, currentActivity);

  if (recorded && currentActivity === ACTIVITY_TYPES.ACTIVE) {
    console.info(`[TaskHeatmap] Tracked ${domain} +${elapsedSeconds}s`);
  }

  scheduleRuntimeSave();
}

function startTickLoop() {
  if (tickIntervalId) {
    return;
  }

  tickIntervalId = setInterval(() => {
    void enqueueWork(() => runTick());
  }, TICK_INTERVAL_MS);
  void chromeApi?.alarms?.create?.(TICK_ALARM, { periodInMinutes: 1 });
  console.info('[TaskHeatmap] Background tick loop started.');
}

function stopTickLoop() {
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }
  void chromeApi?.alarms?.clear?.(TICK_ALARM);
  console.info('[TaskHeatmap] Background tick loop stopped.');
}

async function processIdleStateChange(stateValue) {
  await ensureRuntimeLoaded();

  const nowIdle = stateValue === 'idle' || stateValue === 'locked';
  const currentActivity = runtimeState.activityType === ACTIVITY_TYPES.IDLE;

  if (nowIdle === currentActivity) {
    runtimeState = mergeRuntimeState(runtimeState, { windowFocused });
    scheduleRuntimeSave();
    return;
  }

  const now = Date.now();
  const elapsedSeconds = Math.floor((now - runtimeState.lastTimestamp) / 1000);
  runtimeState = mergeRuntimeState(runtimeState, { lastTimestamp: now });

  if (elapsedSeconds > 0 && runtimeState.lastDomain) {
    recordPendingDuration(
      runtimeState.lastDomain,
      elapsedSeconds,
      currentActivity ? ACTIVITY_TYPES.IDLE : ACTIVITY_TYPES.ACTIVE
    );
  }

  if (nowIdle) {
    runtimeState = mergeRuntimeState(runtimeState, {
      activityType: ACTIVITY_TYPES.IDLE,
      windowFocused,
    });
  } else {
    const domain = await resolveActiveDomain();
    runtimeState = mergeRuntimeState(runtimeState, {
      activityType: ACTIVITY_TYPES.ACTIVE,
      lastDomain: domain ?? runtimeState.lastDomain,
      windowFocused,
    });
  }

  scheduleRuntimeSave();
}

function initializeIdleTracking() {
  const idleApi = chromeApi?.idle;

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
    const error = chromeApi?.runtime?.lastError;

    if (error) {
      console.warn('[TaskHeatmap] Failed to query initial idle state', error.message);
      return;
    }

    runtimeState = mergeRuntimeState(runtimeState, {
      activityType:
        stateValue === 'idle' || stateValue === 'locked'
          ? ACTIVITY_TYPES.IDLE
          : ACTIVITY_TYPES.ACTIVE,
      lastTimestamp: Date.now(),
    });

    if (runtimeState.activityType === ACTIVITY_TYPES.ACTIVE) {
      const domain = await resolveActiveDomain();
      runtimeState = mergeRuntimeState(runtimeState, {
        lastDomain: domain ?? runtimeState.lastDomain,
      });
    }

    scheduleRuntimeSave();
  });
}

function initializeWindowFocusTracking() {
  const windowsApi = chromeApi?.windows;

  if (!windowsApi?.onFocusChanged?.addListener) {
    return;
  }

  windowsApi.onFocusChanged.addListener((windowId) => {
    const focused = windowId !== chromeApi.windows.WINDOW_ID_NONE;

    if (focused === windowFocused) {
      return;
    }

    windowFocused = focused;
    void enqueueWork(async () => {
      await ensureRuntimeLoaded();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - runtimeState.lastTimestamp) / 1000);
      runtimeState = mergeRuntimeState(runtimeState, { lastTimestamp: now });

      if (elapsedSeconds > 0 && runtimeState.lastDomain) {
        const type =
          runtimeState.activityType === ACTIVITY_TYPES.IDLE
            ? ACTIVITY_TYPES.IDLE
            : ACTIVITY_TYPES.ACTIVE;
        recordPendingDuration(runtimeState.lastDomain, elapsedSeconds, type);
      }

      runtimeState = mergeRuntimeState(runtimeState, {
        activityType:
          focused && runtimeState.activityType !== ACTIVITY_TYPES.IDLE
            ? ACTIVITY_TYPES.ACTIVE
            : ACTIVITY_TYPES.IDLE,
        windowFocused: focused,
      });

      if (focused && runtimeState.activityType === ACTIVITY_TYPES.ACTIVE) {
        const domain = await resolveActiveDomain();
        runtimeState = mergeRuntimeState(runtimeState, {
          lastDomain: domain ?? runtimeState.lastDomain,
        });
      }

      scheduleRuntimeSave();
    });
  });
}

function getNextSummaryTime(hour) {
  const now = new Date();
  const next = new Date();
  next.setHours(hour, 0, 0, 0);

  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }

  return next.getTime();
}

function scheduleDailySummaryAlarm() {
  if (!chromeApi?.alarms) {
    return;
  }

  if (!state?.options?.dailySummary?.enabled) {
    void chromeApi.alarms.clear(SUMMARY_ALARM);
    return;
  }

  const hour = state.options.dailySummary.hour ?? 21;
  const when = getNextSummaryTime(hour);
  chromeApi.alarms.create(SUMMARY_ALARM, {
    when,
    periodInMinutes: 24 * 60,
  });
}

async function sendDailySummaryNotification() {
  await ensureStateLoaded();

  if (!state?.options?.dailySummary?.enabled) {
    return;
  }

  if (!chromeApi?.notifications?.create) {
    return;
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const entries = summarizeTopDomains(state.days, {
    endDate: yesterday,
    timeframe: TIMEFRAMES.DAY,
    filter: ACTIVITY_FILTERS.ALL,
  });

  if (entries.length === 0) {
    return;
  }

  const top = entries[0];
  const minutes = Math.round(top.totalSeconds / 60);
  const body =
    minutes > 0
      ? `You spent ${minutes} minute${minutes === 1 ? '' : 's'} on ${top.domain} today.`
      : `Your top site was ${top.domain} today.`;

  try {
    await chromeApi.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'TaskHeatmap summary',
      message: body,
    });
  } catch (error) {
    console.warn('[TaskHeatmap] Failed to show summary notification', error);
  }
}

chromeApi?.alarms?.onAlarm?.addListener((alarm) => {
  if (alarm.name === TICK_ALARM) {
    void enqueueWork(() => runTick({ force: true }));
    return;
  }

  if (alarm.name === SUMMARY_ALARM) {
    void enqueueWork(sendDailySummaryNotification);
  }
});

chromeApi?.runtime?.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  if (message.type === MESSAGE_TYPES.GET_STATE) {
    const { flushPending = false } = message;

    enqueueWork(async () => {
      try {
        if (flushPending) {
          await runTick({ force: true });
          await flushState();
          await flushRuntimeState();
        } else {
          await ensureStateLoaded();
        }

        const trend = calculateTrends(state.days, {
          endDate: new Date(),
          timeframe: message.timeframe ?? TIMEFRAMES.DAY,
          filter: message.filter ?? ACTIVITY_FILTERS.ALL,
        });

        sendResponse({ ok: true, state, runtime: runtimeState, trend });
      } catch (error) {
        console.error('[TaskHeatmap] Failed to resolve state for popup', error);
        sendResponse({ ok: false, error: error.message });
      }
    });

    return true;
  }

  if (message.type === MESSAGE_TYPES.OPTIONS_UPDATED) {
    enqueueWork(async () => {
      try {
        await ensureStateLoaded();
        state = updateDailySummary(state, message.options ?? {});
        scheduleStateSave();
        scheduleDailySummaryAlarm();
      } catch (error) {
        console.error('[TaskHeatmap] Failed to apply updated options', error);
      }
    });
  }

  return undefined;
});

chromeApi?.runtime?.onInstalled?.addListener(() => {
  console.info('[TaskHeatmap] Extension installed.');
});

chromeApi?.runtime?.onStartup?.addListener(() => {
  startTickLoop();
});

chromeApi?.runtime?.onSuspend?.addListener(() => {
  stopTickLoop();
  void flushState();
  void flushRuntimeState();
});

initializeIdleTracking();
initializeWindowFocusTracking();
startTickLoop();

void ensureStateLoaded();
void ensureRuntimeLoaded();
