# CStoRate v1.0.2 release handoff

> Historical handoff from the 1.0.2 archive, superseded by version 1.0.3. See AUDIT_REPORT.md, PROJECT_STATE.md and RELEASE_NOTES.md for current scope and checks. Authorization statements below describe the earlier session only.

This document is for the agent who will commit and publish the prepared release from another computer.

## Authorization and scope

The user explicitly requested that the next agent commit the prepared v1.0.2 changes and push them to GitHub.

- Repository: `https://github.com/Wallert/CStoRate.git`
- Target branch: `main`
- Expected base commit before this release: `238b9d3b00deb716f610a944d1426f2a2adc35f6`
- Recommended commit message: `Release CStoRate v1.0.2`
- Do not discard, reset, clean, or overwrite the existing uncommitted changes.
- Do not amend or combine unrelated user changes if any appear after this handoff.

No commit or push was performed on the source computer.

## Release contents

The prepared changes include:

- restored Steam title search and App ID metadata fetching;
- prevented the autocomplete dropdown from covering or intercepting the App ID field;
- timeout-protected and cancellable network requests with caching and explicit failure states;
- removal of dead CodeTabs and ThingProxy integrations;
- fixed 375 px mobile overflow and responsive action controls;
- fixed Library-to-autosave synchronization and autosave coverage for tier mutations;
- schema, size, URL, and identifier validation for imports, share links, Library, and autosave;
- accessible tabs, search results, tier buttons, modal focus trap/restoration, and inert backgrounds;
- pinned Lucide and html2canvas CDN assets with SRI plus a restrictive meta CSP;
- GitHub Actions CI and additional release regression/stress coverage;
- version and release documentation updated to v1.0.2.

Expected changed or new files:

```text
.github/workflows/ci.yml
DEPLOYMENT.md
PROJECT_STATE.md
README.md
RELEASE_NOTES.md
RELEASE_1.0.2_HANDOFF.md
app.js
index.html
package-lock.json
package.json
style.css
tests/release_regression_tests.js
tests/run_tests.js
tests/tier5_stress_tests.js
```

## Required pre-commit verification

Use Node.js 20.19 or newer. From the repository root:

```bash
git status --short --branch
git diff --check
npm ci
npm run check
```

Expected test gate:

- core, boundary, cross-feature, real-world, adversarial, and release-regression tests: `110/110` passing;
- standalone stress/security suite: `8/8` passing;
- `git diff --check`: no errors.

If test counts differ because additional legitimate tests were added later, investigate the diff and require all tests to pass. Do not bypass or remove failing tests merely to publish.

## Recommended local smoke test

Run:

```bash
npm run dev
```

Open `http://127.0.0.1:8080` and verify:

1. Searching `Witcher` returns real Steam games.
2. App ID `570` adds `Dota 2`, not `Steam App #570`.
3. At a 375 x 812 viewport there is no horizontal document scrolling.
4. Opening tier settings moves focus to the tier-name input; closing restores focus.
5. The browser console has no application errors.

The previous QA run observed eight Witcher results in about 5.6 seconds and Dota 2 metadata in about 6.8 seconds. External service latency can vary.

## Latest repeated release gate

The release was audited again on August 25, 2026 after the handoff was first prepared:

- manifests remained aligned at `1.0.2`;
- the supported runtime was tightened to Node.js `>=20.19.0`, matching JSDOM's actual requirement;
- image URL sanitization was unified across Steam results, direct additions, and imported data;
- autocomplete/App ID overlap was reproduced and fixed;
- core/regression tests passed `110/110`;
- stress/security tests passed `8/8`;
- a clean-origin browser run produced eight Witcher results;
- focusing and using App ID after an open autocomplete added only `Dota 2`, with no accidental search-result card;
- the 375 px layout had equal document and client widths (`365 px`);
- modal focus moved to `edit-tier-label`, the background became inert, and the browser console remained clean.

## Commit and push

After the verification succeeds, review the complete diff and stage the explicit release files:

```bash
git diff --stat
git diff
git add .github/workflows/ci.yml DEPLOYMENT.md PROJECT_STATE.md README.md RELEASE_NOTES.md RELEASE_1.0.2_HANDOFF.md app.js index.html package-lock.json package.json style.css tests/release_regression_tests.js tests/run_tests.js tests/tier5_stress_tests.js
git status --short
git commit -m "Release CStoRate v1.0.2"
git push origin main
```

If `main` has advanced on GitHub, do not force-push. Fetch first, inspect the incoming commits, then integrate carefully and rerun the complete release gate.

## Post-push verification

1. Confirm the GitHub Actions `CI` workflow succeeds for the pushed commit.
2. Confirm GitHub Pages deploys that same commit.
3. Open `https://wallert.github.io/CStoRate/?release=1.0.2` to avoid a stale browser cache.
4. Confirm the footer displays `v1.0.2`.
5. Repeat the `Witcher` search and App ID `570` smoke tests on the public site.
6. Check the browser console for CSP, SRI, network, or application errors.

## Operational note

Steam does not provide the required CORS headers to GitHub Pages. Static hosting currently uses a timeout-protected Jina Reader fallback with AllOrigins as secondary fallback. The UI now fails explicitly rather than creating false metadata. For guaranteed high-volume availability, a future release should use an owned same-origin or serverless Steam proxy.
