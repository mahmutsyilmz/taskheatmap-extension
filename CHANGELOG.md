# Changelog

## [Unreleased]
### Added
- Advanced analytics views for day, week, and month with active/idle filtering and trend insights.
- Animated chart, responsive popup layout, streak counter, and improved top domains list.
- Data export (CSV/JSON) updated to include active and idle durations per domain.
- Persistent background tracking with debounced storage, runtime recovery, and daily summary notifications.
- Modular popup architecture (`controller`, `ui`, `chart`) with refreshed options page controls.
- Headless end-to-end tests simulating tracked browsing sessions and CI system dependencies for UI runs.

### Changed
- Storage schema now records active and idle seconds per domain and retains daily summary preferences.
- Popup clear-data flow replaced with confirmation modal and richer empty states.

### Fixed
- Service worker now restores activity state after sleep and handles window focus changes reliably.
- Popup trend summary now escapes domain names when rendering and avoids using `innerHTML`.
- CI installs the correct audio library package to fix missing system dependencies for UI tests.
