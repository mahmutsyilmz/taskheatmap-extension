export function createTracker({ onTick, interval = 60 * 1000 } = {}) {
  if (typeof onTick !== 'function') {
    throw new TypeError('onTick callback is required');
  }

  let timerId = null;

  const start = () => {
    if (timerId) {
      return;
    }

    timerId = setInterval(() => {
      onTick();
    }, interval);
  };

  const stop = () => {
    if (!timerId) {
      return;
    }

    clearInterval(timerId);
    timerId = null;
  };

  const isRunning = () => timerId !== null;

  return {
    start,
    stop,
    isRunning,
  };
}
