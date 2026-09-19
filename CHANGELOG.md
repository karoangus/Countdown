# Changelog

## 2.0.0 — 2026-09-19

### Added
- Responsive Persian dashboard with live summary, next event, light/dark themes.
- Normalized Persian search, status filters, due-date/title sorting; preserved manual order.
- Persistent-until-dismissed undo for deletion; non-destructive JSON backup import/export.
- Direct calendar month/year selection, today and relative-time shortcuts.
- Accessible native modal, focus management, numeric validation and reduced-motion support.
- Corrupt-storage recovery UI, safe storage failure handling and cross-tab stale-edit detection.
- Node unit tests, Playwright desktop/mobile regression tests, axe audits and GitHub Actions CI.
- Automated 24 KiB gzip runtime text budget (fonts/icons excluded).

### Fixed
- Startup crash from null/malformed timer records, duplicate/unsafe IDs and nonnumeric dates.
- Unhandled storage writes and destructive startup rewrites of invalid data.
- HTML injection surface from unvalidated IDs and inline action handlers.
- Silent hour/minute overflow and premature all-zero countdown before the deadline.
- Calendar reliance on a one-year arithmetic patch; use native Persian ICU calendar instead.
- Selected date being lost when browsing calendar months; invalid dates and DST gaps rejected.
- Truncated combined emoji, inaccessible date/color controls and background focus leakage.
- Expiry summaries and filters becoming stale while a tab is hidden.
- Service-worker deletion of unrelated caches and offline navigation with query strings.
- Installation identity retained as `./index.html` for existing PWA users.

### Performance
- No runtime packages, frameworks, remote fonts, build step or continuous animations.
- Update only changed number text nodes instead of rebuilding timer HTML every second.
- A single aligned timeout; no countdown work while hidden or after all timers expire.
- Filtered-out lists schedule only the next relevant deadline (up to a minute).
- Static CSS surfaces, off-screen card rendering containment, cached calendar year boundaries.

### Compatibility / migration
- Existing valid `cd_timers` records and order are preserved; no startup writes.
- Modern browsers with native `dialog` and `Intl` Persian calendar required.
- Event dates retain the previous 1901–2199 Gregorian range; up to 1,000 timers.
- Backup imports merge by ID; an existing timer wins over an imported duplicate.
- Old open tabs must close before the new offline worker activates. No forced reload of forms.
- Device clock and timezone determine display; this is not a background alarm service.
