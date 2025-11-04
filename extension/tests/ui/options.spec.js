const BASE_URL = 'http://localhost:4173/options.html';

describe('Options UI accessibility', () => {
  beforeAll(async () => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  });

  it('associates form inputs with accessible labels', async () => {
    const labelText = await page.$eval('#interval', (el) => el.labels?.[0]?.textContent?.trim());
    expect(labelText).toContain('Tracking interval');

    const inputType = await page.$eval('#interval', (el) => el.getAttribute('type'));
    expect(inputType).toBe('number');
  });

  it('passes axe accessibility checks', async () => {
    await expect(page).toHaveNoAxeViolations();
  });

  it('allows keyboard navigation through the form', async () => {
    await page.focus('body');
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.id);
    expect(firstFocus).toBe('interval');

    await page.keyboard.press('Tab');
    const secondFocus = await page.evaluate(() => document.activeElement?.id);
    expect(secondFocus).toBe('daily-summary');

    await page.keyboard.press('Tab');
    const thirdFocus = await page.evaluate(() => document.activeElement?.id);
    expect(['summary-hour', 'summary-hour-hours']).toContain(thirdFocus);

    let attempts = 0;
    let focusedTag = '';
    while (attempts < 5 && focusedTag !== 'BUTTON') {
      await page.keyboard.press('Tab');
      focusedTag = await page.evaluate(() => document.activeElement?.tagName ?? '');
      attempts += 1;
    }

    expect(focusedTag).toBe('BUTTON');
  });

  it('meets Lighthouse accessibility expectations', async () => {
    const score = await global.runLighthouseAudit(BASE_URL);
    expect(score).toBeGreaterThanOrEqual(90);
  });
});
