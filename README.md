# TaskHeatmap

TaskHeatmap is a Chrome extension that visualizes browsing activity as a productivity heatmap. This repository contains the extension source, a simple marketing website, automated tests, and a CI pipeline that builds a distributable package.

## Getting started

```bash
npm install
```

## Available scripts

- `npm run lint` – Lints all source files with ESLint.
- `npm run test` – Executes unit tests with Vitest.
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
