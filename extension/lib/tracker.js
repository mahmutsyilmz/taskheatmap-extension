const ACTIVE_STATE = 'active';

function resolveIdleApi(idleOverride) {
  if (idleOverride) {
    return idleOverride;
  }

  return globalThis.chrome?.idle ?? null;
}

export function createTracker({
  onTick,
  interval = 60 * 1000,
  idleTimeout = 300,
  idle = null,
} = {}) {
  if (typeof onTick !== 'function') {
    throw new TypeError('onTick callback is required');
  }

  let timerId = null;
  let isListeningToIdle = false;
  let idleState = ACTIVE_STATE;
  const idleApi = resolveIdleApi(idle);

  const clearTimer = () => {
    if (!timerId) {
      return;
    }

    clearInterval(timerId);
    timerId = null;
  };

  const handleIdleChange = (state) => {
    idleState = state;
  };

  const attachIdleListeners = () => {
    if (!idleApi || isListeningToIdle) {
      return;
    }

    if (typeof idleApi.onStateChanged?.addListener === 'function') {
      idleApi.onStateChanged.addListener(handleIdleChange);
      isListeningToIdle = true;
    }
  };

  const detachIdleListeners = () => {
    if (!idleApi || !isListeningToIdle) {
      return;
    }

    if (typeof idleApi.onStateChanged?.removeListener === 'function') {
      idleApi.onStateChanged.removeListener(handleIdleChange);
    }

    isListeningToIdle = false;
  };

  const refreshIdleState = () => {
    if (!idleApi || typeof idleApi.queryState !== 'function') {
      idleState = ACTIVE_STATE;
      return;
    }

    idleApi.queryState(idleTimeout, (state) => {
      idleState = state;
    });
  };

  const tick = () => {
    if (idleState === ACTIVE_STATE) {
      onTick();
    }
  };

  const start = () => {
    if (timerId) {
      return;
    }

    refreshIdleState();
    attachIdleListeners();
    timerId = setInterval(tick, interval);
  };

  const stop = () => {
    if (!timerId) {
      return;
    }

    clearTimer();
    detachIdleListeners();
  };

  const isRunning = () => timerId !== null;

  return {
    start,
    stop,
    isRunning,
    __test__: {
      refreshIdleState,
      handleIdleChange,
    },
  };
}
