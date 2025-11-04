const BASE_URL = 'http://localhost:4173/popup.html';

describe('Popup UI accessibility', () => {
  beforeAll(async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  });

  it('contains descriptive ARIA labels', async () => {
    const selectAria = await page.$eval('#day-select', (el) => el.getAttribute('aria-label'));
    expect(selectAria).toBe('Select a day');

    const chartLabel = await page.$eval('.panel--chart', (el) => el.getAttribute('aria-label'));
    expect(chartLabel).toBe('Activity chart');
  });

  it('passes automated axe accessibility checks', async () => {
    await expect(page).toHaveNoAxeViolations();
  });

  it('supports keyboard navigation between interactive elements', async () => {
    await page.focus('body');
    await page.keyboard.press('Tab');
    const focusedId = await page.evaluate(() => document.activeElement?.id);

    expect(focusedId).toBe('open-options');

    await page.keyboard.press('Tab');
    const nextFocused = await page.evaluate(
      () => document.activeElement?.dataset.timeframe ?? document.activeElement?.id
    );
    expect(['day', 'week', 'month', 'day-select']).toContain(nextFocused);
  });

  it('achieves a Lighthouse accessibility score of at least 90', async () => {
    const score = await global.runLighthouseAudit(BASE_URL);
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
