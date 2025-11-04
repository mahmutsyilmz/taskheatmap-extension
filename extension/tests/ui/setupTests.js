import 'expect-puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);

function normalizeAxeOptions(options = {}) {
  if (!options.rules || Array.isArray(options.rules)) {
    return options;
  }

  return {
    ...options,
    rules: Object.entries(options.rules).map(([id, rule]) => ({ id, ...(rule ?? {}) })),
  };
}

expect.extend({
  async toHaveNoAxeViolations(page, options = {}) {
    const normalized = normalizeAxeOptions(options);
    const results = await new AxePuppeteer(page).configure(normalized).analyze();
    if (results.violations.length === 0) {
      return {
        pass: true,
        message: () => 'No accessibility violations found.',
      };
    }

    const formatted = results.violations
      .map((violation) => `${violation.id}: ${violation.help} (nodes: ${violation.nodes.length})`)
      .join('\n');

    return {
      pass: false,
      message: () => `Accessibility violations detected:\n${formatted}`,
    };
  },
});

global.runLighthouseAudit = async function runLighthouseAudit(url) {
  const puppeteer = await import('puppeteer');
  const executablePath = puppeteer.default?.executablePath?.() ?? puppeteer.executablePath?.();

  if (!executablePath) {
    throw new Error('Unable to resolve Chrome executable path for Lighthouse audit.');
  }

  const cliPath = require.resolve('lighthouse/cli/index.js');
  const { stdout } = await execFileAsync(
    'node',
    [
      cliPath,
      url,
      '--only-categories=accessibility',
      '--quiet',
      '--output=json',
      '--output-path=stdout',
      '--chrome-flags=--headless --no-sandbox --disable-gpu --disable-dev-shm-usage',
    ],
    {
      env: {
        ...process.env,
        CHROME_PATH: executablePath,
      },
    }
  );

  const report = JSON.parse(stdout);
  return report.categories.accessibility.score * 100;
};
