# Release Notes — CantStop to rate (CStoRate)

## v1.0.6 UI refinements and compact phone settings

Release dated October 5, 2026. Deployment status is available in GitHub Actions and the live site's version footer.

- Add native collapsible List Info, Add Games and Actions panels on screens up to 768 px. Start collapsed, remember choices while resizing, and keep a focused field visible. Keep desktop panels open.
- On phones from 360 px wide, put Card Format and Card Size on one row with full-width list search below. Keep each group's buttons in an equal-width single row, including intermediate viewport widths. Use narrower tier labels and compact row padding to leave more room for covers.
- Wrap long board titles, use actual 44 px modal close targets, remove the doubled toolbar-to-board gap, keep phone actions in two columns, and let pool heading/counter wrap with a gap.
- Let swipes over cards scroll. Arm touch dragging only after a stationary 450 ms hold; keep tap-to-select, cancel pending/armed gestures safely, and suppress accidental menus after a drag. Add a brief phone interaction hint.
- Move autosave status beneath the board controls, outside collapsible settings and PNG content. Keep storage failures and recovery instructions visible.
- Expose pressed states and group labels for format/size controls. Synchronize both their visual and accessible states with restored settings at startup.
- Add 11 behavioral regressions for disclosures, gestures, focus, save errors and restored control states. Verified 158 DOM, 8 stress and 8 server checks. Browser checks cover responsive layout, mouse dragging, tap-to-select and settings after reload. Touch gesture sequences are tested in the DOM harness; physical iOS/Android testing remains pending.
- Remove the temporary UI comparison page after incorporating the accepted refinements.


## v1.0.5 Compact search toolbar

Release dated October 4, 2026.

- Move list search between Card Format and Card Size, with aligned labels and controls.
- On narrower boards, place search below the display controls at full width. Use the actual toolbar width for responsive changes.
- Show search results beneath the entire toolbar; hide feedback when the query is cleared. Keep keyboard order aligned with the visual layout.
- Existing search, duplicate protection and PNG behavior remain covered by 147 DOM, 8 stress and 8 server checks.

## v1.0.4 Search and duplicate feedback

Release dated October 3, 2026.

- Search the current list by game name or exact App ID across all tiers and the pool; results show locations and focus the matching card. Search updates after board edits without hiding cards or changing exports.
- Explain duplicates with the existing tier or pool location. Mark existing games in Steam results and reject repeated App IDs before any network request, including IDs with leading zeros.
- Request the HTTPS Steam endpoint through Jina Reader and allow up to 15 seconds for cold queries. Hide stale results while loading, announce progress, offer Retry search after errors, and allow Enter to add the first visible result.
- Added 8 behavioral regressions; 147 DOM, 8 stress and 8 server checks pass.

GitHub Pages still relies on public CORS providers for Steam data. A successful query does not guarantee provider availability for every user or query.

## v1.0.3 Audit fixes

Release dated October 3, 2026. Deployment status is available in GitHub Actions and the live site's version footer.

- Bound JSON import and aggregate images; normalize IDs without collisions and reserve internal tier destinations.
- Keep autosave failures visible and retryable; make library mutations transactional and persist active-list identity.
- Preserve one previous board across import, share, library load and Reset All; add Restore previous board.
- Fix invalid-destination data loss, mouse clicks, keyboard moves, poster ordering, touch cancellation and drag cleanup.
- Cancel stale Steam metadata and imports on replacement; validate provider responses and bound caches.
- Add keyboard autocomplete, focus/contrast improvements, touch-sized row actions, modal scrolling and reduced-motion support.
- Protect concurrent PNG export, bound canvas dimensions, restore original control styles, use Blob downloads and clean filenames.
- Replace npx http-server with the included loopback-only allowlisted server; support opt-in owned same-origin Steam proxy paths.
- Close offline test environments and detect DOM errors; propagate stress failures to CI. Added 29 audit regression tests and 8 server tests.
- Update undici to 7.30.0; current npm audit reports 0 known vulnerabilities.

Verified: 139 DOM integration/regression + 8 stress + 8 server tests. Browser checks include Steam metadata, keyboard movement, save/reload and phone-width layout. PNG generation reports success; downloaded-image pixel verification and physical iOS/Safari tests remain pending. See [AUDIT_REPORT.md](AUDIT_REPORT.md).

Earlier entries below describe historical versions; they are not the current verification report.


## v1.0.2 — Release hardening

> **Release Date:** August 25, 2026
> **Status:** Release Candidate Verified

- Restored production Steam search and App ID metadata through timeout-protected, cached fallbacks.
- Kept autocomplete results in the form layout so they cannot intercept clicks intended for the App ID field.
- Removed dead CodeTabs and ThingProxy dependencies and stopped creating misleading placeholder games on network failure.
- Fixed mobile horizontal overflow and compacted controls at phone breakpoints.
- Fixed Library-to-autosave synchronization and autosave coverage for tier mutations.
- Added strict validation and size limits for JSON files, share links, Library data, and autosave data.
- Added accessible tab semantics, keyboard navigation, modal focus trapping/restoration, inert backgrounds, and accessible dynamic controls.
- Pinned Lucide and html2canvas with Subresource Integrity and added a restrictive Content Security Policy.
- Added CI, five targeted release regression tests, and the standalone stress suite to the default test command.

---

## v1.0.0

> **Release Date:** July 2026  
> **Status:** Production Ready  

Welcome to the official **v1.0.0 release** of **CantStop to rate** — the ultimate Steam Gaming Tier List Master application!

---

## 🌟 Key Features & Improvements

### 🎮 Steam Integration & Search
- **Steam App Autocomplete:** Real-time search by Steam game title with high-speed proxy fallback chain (`Local Proxy` -> `CodeTabs` -> `AllOrigins` -> `ThingProxy`).
- **Direct App ID / Link Import:** Paste Steam Store URLs or raw App IDs to automatically fetch game metadata and high-res cover art.
- **Preloaded Game Templates:** Built-in templates (FPS Classics, Soulsborne Hardcore, Open World Epics, RPG Masterpieces, etc.).

### 🔀 Drag-and-Drop & Reordering
- **Precision In-Tier Reordering:** Drag games within tiers or between tiers with left/right drop position detection.
- **Mobile & Touch Drag Support:** Native touch event handlers (`touchstart`, `touchmove`, `touchend`) with drag mirrors for smartphones and tablets.
- **Trash Bin Dropzone:** Interactive neon trash dropzone next to the pool to delete games instantly by dragging.
- **Edge Auto-Scrolling & Wheel Scroll:** Scroll the page smoothly while holding a game via edge proximity detection or mouse wheel.

### 🛡️ Security & Data Hardening
- **XSS Protection:** Input sanitization helper (`escapeHtml()`) applied to all user-editable labels, titles, and imported content.
- **JSON Import Validation:** Schema validation (`validateAndSanitizeImport()`) checking for valid structures, color hex codes, duplicate IDs, and protocol-safe image URLs (`http://`, `https://`, `data:image/`).
- **Storage Quota Protection:** LocalStorage saves protected with try/catch fallback error toasts.

### ⚡ Performance & Memory Optimization
- **Targeted DOM Manipulation:** Replaced full-page DOM re-renders (`innerHTML`) with direct element node insertions (`replaceChildren`, `appendChild`, `insertBefore`), improving drag performance 100x.
- **Image Lazy Loading:** Added `loading="lazy"` and `decoding="async"` to image elements to eliminate memory spikes during 100+ game sessions.
- **Dirty-State Autosave:** Background autosave loop only writes to `localStorage` when state changes occur (`isDirty === true`).
- **Search AbortController:** Interrupted search queries cleanly abort pending HTTP requests to prevent race conditions.

### ♿ Accessibility & UI/UX Polish
- **Keyboard Navigation:** Full support for `Enter` and `Space` on cards, and global `Escape` key handling to close dropdowns and modals.
- **ARIA Standards:** Added `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, and `aria-label` tags for screen reader compatibility.
- **Cross-Browser Glassmorphism:** Added `-webkit-backdrop-filter` fallbacks for Safari/iOS devices.
- **Responsive Layouts:** Dedicated mobile styling for row controls, modal windows, and sidebars.

---

## 📤 Export & Import Support
- **PNG High-Res Image Export:** Compile and download crisp tier list image captures using `html2canvas` at 2x scale.
- **JSON Backup & Restore:** Save your tier list configuration to a `.json` backup file or restore previously saved lists.
- **LocalStorage Library:** Save multiple custom lists into your local browser library.

---

*Enjoy building and ranking your ultimate gaming tier lists!* 🚀
