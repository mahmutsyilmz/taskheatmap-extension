import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTracker } from '../lib/tracker.js';

describe('tracker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('requires an onTick callback', () => {
    expect(() => createTracker()).toThrowError(/onTick/);
  });

  it('invokes the callback on an interval', () => {
    const onTick = vi.fn();
    const tracker = createTracker({ onTick, interval: 5000 });

    tracker.start();
    vi.advanceTimersByTime(15000);

    expect(onTick).toHaveBeenCalledTimes(3);
  });

  it('stops firing when stopped', () => {
    const onTick = vi.fn();
    const tracker = createTracker({ onTick, interval: 1000 });

    tracker.start();
    vi.advanceTimersByTime(3000);
    tracker.stop();
    vi.advanceTimersByTime(3000);

    expect(onTick).toHaveBeenCalledTimes(3);
    expect(tracker.isRunning()).toBe(false);
  });

  it('skips ticks while idle and resumes when active again', () => {
    const onTick = vi.fn();
    const addListener = vi.fn();
    const removeListener = vi.fn();
    let idleCallback = null;

    addListener.mockImplementation((fn) => {
      idleCallback = fn;
    });

    const idle = {
      queryState: vi.fn((_timeout, callback) => callback('idle')),
      onStateChanged: {
        addListener,
        removeListener,
      },
    };

    const tracker = createTracker({ onTick, interval: 1000, idle });

    tracker.start();
    vi.advanceTimersByTime(3000);

    expect(onTick).not.toHaveBeenCalled();
    expect(idle.queryState).toHaveBeenCalled();
    expect(addListener).toHaveBeenCalledTimes(1);

    idleCallback('active');
    vi.advanceTimersByTime(2000);

    expect(onTick).toHaveBeenCalledTimes(2);

    tracker.stop();
    expect(removeListener).toHaveBeenCalledWith(idleCallback);
  });

  it('falls back to active state when idle API is unavailable', () => {
    const onTick = vi.fn();
    const tracker = createTracker({ onTick, interval: 1000 });

    tracker.start();
    vi.advanceTimersByTime(3000);

    expect(onTick).toHaveBeenCalledTimes(3);
  });
});
