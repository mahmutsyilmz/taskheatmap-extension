const TICK_INTERVAL = 60 * 1000;
let tickTimer = null;

function handleTick() {
  // Placeholder: future tracking logic will live here.
  console.debug('[TaskHeatmap] Tick event fired');
}

chrome.runtime.onInstalled.addListener(() => {
  console.info('[TaskHeatmap] Extension installed.');
});

function startTickLoop() {
  if (tickTimer) {
    return;
  }

  tickTimer = setInterval(handleTick, TICK_INTERVAL);
  console.info('[TaskHeatmap] Background tick loop started.');
}

function stopTickLoop() {
  if (!tickTimer) {
    return;
  }

  clearInterval(tickTimer);
  tickTimer = null;
  console.info('[TaskHeatmap] Background tick loop stopped.');
}

chrome.runtime.onStartup.addListener(startTickLoop);
chrome.runtime.onSuspend.addListener(stopTickLoop);

// Start immediately when the service worker wakes up.
startTickLoop();
