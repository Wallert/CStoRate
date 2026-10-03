# Current CStoRate project state

Date: October 3, 2026. Version: **1.0.4**. Source reviewed from the extracted 1.0.2 archive. Deployment status is available in GitHub Actions; the live footer identifies the served version.

The audit and implementation are documented in [AUDIT_REPORT.md](AUDIT_REPORT.md). The application remains a static vanilla HTML/CSS/JS Steam tier-list editor with its existing neon visual design.

## Implemented and verified

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

`npm run check` passed: 147 DOM tests, 8 stress tests, 8 HTTP server tests. Browser checks covered Steam metadata for Dota 2, keyboard movement, library save/reload, desktop layout and a 375 px viewport. These checks do not establish universal browser support or full WCAG compliance.

## Remaining limits

Public static hosting depends on external Steam CORS providers unless an owned same-origin proxy is configured. Physical iOS/Safari/multi-touch and screen readers have not been tested. Real-browser PNG generation reported success, but browser tooling did not return the downloaded file, so output pixels remain unverified. See the audit for scope and acceptance criteria.

## Running and publishing

Use `start.bat` or `npm run dev`, then open http://127.0.0.1:8080. For tests use `npm ci` and `npm run check`. See [DEPLOYMENT.md](DEPLOYMENT.md) for public-host configuration. Updates are published through main and verified in GitHub Actions and on the live site.

The older RELEASE_1.0.2_HANDOFF.md is historical release material; it is not the current release state or authorization to publish.
