# Current CStoRate project state

Date: October 5, 2026. Current release: **1.0.6**, including the approved UI refinements and compact phone settings. Source reviewed from the extracted 1.0.2 archive. Deployment status is available in GitHub Actions; the live footer identifies the served version.

The audit and implementation are documented in [AUDIT_REPORT.md](AUDIT_REPORT.md). The application remains a static vanilla HTML/CSS/JS Steam tier-list editor with its existing neon visual design.

## Implemented and verified

- Collapsible phone settings up to 768 px, with native keyboard support, independent sections, preserved open choices during resizing and protection for a focused field. Desktop settings remain open. From 360 px, display controls share one row and list search remains below them.
- Accepted UI fixes: long-title wrapping, actual 44 px modal close buttons, a 24 px toolbar-to-board gap, two-column phone actions and spaced/wrapping pool headers. Narrower phone tier labels fit two medium horizontal covers per row at 375 px. The temporary comparison scaffold has been removed.
- Touch swipes preserve browser scrolling; a stationary 450 ms hold arms dragging with a visible mirror. Short taps still select a tier. Pending timers, cancellation, extra fingers, lost focus and detached cards are covered by regression tests.
- Autosave status lives outside collapsible settings and exported board content. Format/size controls expose pressed states and synchronize their highlighted choices with settings restored on reload.

- Compact responsive toolbar: Card Format, list search, Card Size on wide boards; full-width search underneath controls on narrow boards. Results span the toolbar and disappear when the query is cleared. Keyboard order follows the responsive layout.

- List search by name or exact App ID across every tier and pool, with locations and jump-to-card buttons.
- Duplicate warnings with locations, existing-game badges in Steam results and offline App ID duplicate checks.
- HTTPS Reader requests, a longer bounded cold-query timeout, visible loading, explicit retry, stale-result hiding and Enter-to-add support. Eight new search regressions.

- Bounded JSON import, aggregate image budget, unique IDs and reserved tier IDs.
- Transactional library persistence, truthful autosave failure state, active-list identity persistence, fallback for temporarily empty titles, and one recoverable previous board.
- Validated moves, click/keyboard fixes, touch cancellation and drag cleanup, stale request/import cancellation, bounded caches and response validation.
- Keyboard autocomplete, visible focus, larger mobile controls, custom tier contrast and reduced-motion support.
- Concurrent PNG export guard, original control-style restoration, bounded canvas scale, Blob downloads and safe filenames.
- A loopback-only Node dev server with an allowlist of website assets and Steam endpoints; no npx server download or directory listing.
- Offline JSDOM cleanup and runtime-error detection; stress runner exit status; 29 additional audit regressions and 8 local-server checks.
- Updated transitive test dependency undici to 7.30.0. npm audit currently reports 0 known vulnerabilities.

`npm run check` passed: 158 DOM tests, 8 stress tests, 8 HTTP server tests. Browser checks at 320, 375 and 1280 px covered disclosure activation, focused-field visibility on resize, list search, duplicate feedback, long-title wrapping, two-column action controls, the 44 px modal close target, mouse dragging, click-based tier selection and pressed states after reload. Touch swipe/hold sequences and storage failures were simulated in the DOM harness. Earlier browser checks covered Steam metadata for Dota 2, keyboard movement and library save/reload. These checks do not establish universal browser support or full WCAG compliance.

## Remaining limits

Public static hosting depends on external Steam CORS providers unless an owned same-origin proxy is configured. Physical iOS/Safari/multi-touch and screen readers have not been tested. Real-browser PNG generation reported success, but browser tooling did not return the downloaded file, so output pixels remain unverified. See the audit for scope and acceptance criteria.

## Running and publishing

Use `start.bat` or `npm run dev`, then open http://127.0.0.1:8080. For tests use `npm ci` and `npm run check`. See [DEPLOYMENT.md](DEPLOYMENT.md) for public-host configuration. Updates are published through main and verified in GitHub Actions and on the live site.
