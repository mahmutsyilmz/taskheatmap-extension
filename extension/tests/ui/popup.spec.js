const BASE_URL = 'http://localhost:4173/popup.html';

describe('Popup UI accessibility', () => {
  beforeAll(async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  });

  it('contains descriptive ARIA labels', async () => {
    const selectAria = await page.$eval('#day-select', (el) => el.getAttribute('aria-label'));
    expect(selectAria).toBe('Select a day');

    const chartRole = await page.$eval('.chart-card', (el) => el.getAttribute('role'));
    expect(chartRole).toBe('img');
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
    const nextFocusedId = await page.evaluate(() => document.activeElement?.id);
    expect(['day-select', 'clear-data']).toContain(nextFocusedId);
  });

  it('achieves a Lighthouse accessibility score of at least 90', async () => {
    const score = await global.runLighthouseAudit(BASE_URL);
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
