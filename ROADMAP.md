# TaskHeatmap Roadmap

## Phase 0 — Foundations (Week 1)
- Finalize architecture decisions for the Manifest v3 extension and static website.
- Set up repository structure with extension (`/extension`) and marketing site (`/website`) directories.
- Establish shared tooling: linting, formatting, localization scaffolding, and basic CI pipeline.

## Phase 1 — Tracking Core (Weeks 2-3)
- Implement background service worker with tick loop, idle detection, and domain normalization.
- Persist data locally using the defined schema with retention, batching, and migration helpers.
- Add domain→category defaults, exclusions list, and pause/resume controls.
- Create JSON/CSV export utilities and ensure schema parity with PRD.

## Phase 2 — User Interfaces (Weeks 4-5)
- Build popup UI with total time header, category donut chart, and top-sites list.
- Implement options page for category mapping, exclusions, and preference toggles.
- Wire UI interactions to storage layer, including pause state messaging and export actions.
- Add localization files (TR/EN) and ensure accessibility (keyboard, contrast, ARIA).

## Phase 3 — Website & Collateral (Week 6)
- Develop landing page with value proposition, install CTA, how-it-works section, and visuals.
- Produce Privacy and Terms pages aligned with privacy commitments.
- Capture extension screenshots/gifs and prepare Chrome Web Store copy.

## Phase 4 — Stabilization & QA (Week 7)
- Run performance profiling to validate CPU (<3%) and memory (<50 MB) targets.
- Execute end-to-end manual test matrix across supported OS/Chrome versions.
- Address bugs, polish UX copy, and finalize iconography/assets.

## Phase 5 — Release Preparation (Week 8)
- Package extension (zip) and complete Chrome Web Store submission assets.
- Publish marketing site and verify installation funnel.
- Plan post-launch telemetry (local-only) and backlog MVP+1 improvements (heat strip, nudge).
