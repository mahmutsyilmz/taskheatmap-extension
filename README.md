# TaskHeatmap

TaskHeatmap is a Chrome extension that visualizes browsing activity as a productivity heatmap. This repository contains the extension source, a simple marketing website, automated tests, and a CI pipeline that builds a distributable package.

## Getting started

```bash
npm install
```

## Local Run Instructions

1. Install dependencies (see [Getting started](#getting-started)).
2. Build the extension once to populate the `dist/` directory:
   ```bash
   npm run build
   ```
3. Load the unpacked extension in Chrome:
   - Open `chrome://extensions`.
   - Enable **Developer mode**.
   - Click **Load unpacked** and choose the repository's `dist/` directory.
4. For iterative development, rebuild on changes or keep a watch process running:
   ```bash
   npm run dev
   ```
   The watch command rebuilds bundles and keeps Chrome up to date when the extension is reloaded.

## Available scripts

- `npm run dev` – Runs Rollup in watch mode for iterative development.
- `npm run lint` – Lints all source files with ESLint (warnings fail the run).
- `npm run test` – Executes unit tests with Vitest and enforces coverage thresholds.
- `npm run build` – Bundles the extension using Rollup into the `dist/` folder.
- `npm run package` – Archives the built extension into `artifacts/taskheatmap.zip`.

CI pipelines execute these commands sequentially: lint → test → build → package.

## Directory structure

- `extension/` – Chrome extension source files (manifest, popup, options, service worker, libraries).
- `website/` – Static marketing website.
- `.github/workflows/` – GitHub Actions workflows for linting, testing, and packaging.
- `scripts/` – Utility scripts used by the build pipeline.

## Building locally

```bash
npm run build
npm run package
```

The packaged ZIP located at `artifacts/taskheatmap.zip` can be uploaded to the Chrome Web Store or loaded manually via `chrome://extensions`.
