/* eslint-env jest */
/* global page, describe, it, expect, beforeAll */
/* eslint-disable no-console */

const MESSAGE_TYPES = {
  STATE_UPDATED: 'taskheatmap:state-updated',
};

const SERVER_URL = 'http://localhost:4173/popup.html';

async function waitForServerReady(url, { timeoutMs = 45000, intervalMs = 500 } = {}) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) {
        return true;
      }
    } catch (_error) {
      // ignore until timeout elapses
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Server did not respond with 200 for ${url} within ${timeoutMs}ms`);
}

const initialState = {
  days: {
    '2024-06-10': {
      domains: {
        'example.com': { active: 900, idle: 0 },
        'focus.site': { active: 300, idle: 60 },
      },
      totals: { active: 1200, idle: 60 },
    },
  },
  options: {
    intervalMinutes: 15,
    dailySummary: { enabled: true, hour: 21 },
  },
};

describe('TaskHeatmap end-to-end', () => {
  beforeAll(async () => {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        console.log('[popup console]', message.text());
      }
    });
    await page.evaluateOnNewDocument(
      (state, MESSAGE_TYPES_CONST) => {
        const listeners = [];
        const clone = (value) => JSON.parse(JSON.stringify(value));
        window.__taskHeatmapState = clone(state);
        window.__taskHeatmapListeners = listeners;
        window.chrome = {
          runtime: {
            sendMessage(payload, callback) {
              if (payload?.type === 'taskheatmap:get-state') {
                callback({ ok: true, state: clone(window.__taskHeatmapState), trend: null });
              }
            },
            onMessage: {
              addListener(listener) {
                listeners.push(listener);
              },
            },
          },
          storage: {
            local: {
              clear(callback) {
                window.__taskHeatmapState = {
                  days: {},
                  options: clone(window.__taskHeatmapState.options),
                };
                callback?.();
              },
            },
          },
        };

        window.__triggerStateUpdate = () => {
          for (const listener of listeners) {
            listener({ type: MESSAGE_TYPES_CONST.STATE_UPDATED });
          }
        };
      },
      initialState,
      MESSAGE_TYPES
    );

    await waitForServerReady(SERVER_URL);
    await page.goto(SERVER_URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  });

  it('renders tracked totals from simulated background state', async () => {
    await page.waitForSelector('.table tbody tr');
    const firstRow = await page.$$eval('.table tbody tr', (rows) =>
      rows.map((row) => row.textContent?.trim())
    );

    expect(firstRow[0]).toContain('example.com');
    expect(firstRow[0]).toContain('15m');
  });

  it('updates totals when new activity is recorded', async () => {
    await page.evaluate(() => {
      const current = window.__taskHeatmapState;
      const day = current.days['2024-06-10'];
      day.domains['example.com'].active += 300; // +5 minutes
      day.totals.active += 300;
      window.__taskHeatmapState = JSON.parse(JSON.stringify(current));
      window.__triggerStateUpdate();
    });

    await page.waitForFunction(
      () => {
        const cell = document.querySelector('.table tbody tr:first-child td:last-child');
        return cell && cell.textContent?.trim() === '20m';
      },
      { timeout: 5000 }
    );
  });
});
