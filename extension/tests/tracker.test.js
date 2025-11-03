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
});
