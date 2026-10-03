/**
 * CStoRate E2E Test Suite - Tier 5: Adversarial Coverage Hardening & Stress Testing
 *
 * Covers:
 * - Category 1: High-Density & Heavy Scale Limits (250+ Games, 35+ Tiers)
 * - Category 2: Adversarial & Corrupt Payloads (Proto Pollution, Multi-Vector XSS, Null Bytes)
 * - Category 3: Event Concurrency & Rapid Interactions (Rapid Touch/Drag, Search AbortController)
 * - Category 4: LocalStorage Quotas & 5MB Binary Storage Corruption Recovery
 * - Category 5: Dynamic Layout & Controls Churn (Mass Toggles, Mass Tier Deletion Evacuation)
 * - Category 6: Boundary Edge & Fallback Stress (Untrusted Schemes, Canvas Control Cleanup)
 */

const { createTestEnvironment } = require('./harness');

async function runTier5Tests(reporter) {
    reporter.startSuite("Tier 5: Adversarial Coverage Hardening");

    // =========================================================================
    // CATEGORY 1: High-Density & Heavy Scale Limits (200+ Games, 35+ Tiers)
    // =========================================================================

    await reporter.test("T5_STRESS_01: 250 Games & 35 Custom Tiers Board Scaling", async () => {
        const { app, helpers } = createTestEnvironment();
        
        // Add 30 extra tiers (5 default + 30 = 35 tiers total)
        for (let i = 0; i < 30; i++) {
            app.addNewTier();
        }
        reporter.assert(app.state.tiers.length === 35, "35 total tiers created");

        // Add 250 games to board (200 in tiers, 50 in pool)
        for (let i = 0; i < 250; i++) {
            const game = { id: `stress-g-${i}`, name: `Massive Game #${i}`, image: `https://img.example.com/${i}.jpg` };
            if (i < 200) {
                const tierIndex = i % 35;
                app.state.tiers[tierIndex].games.push(game);
            } else {
                app.state.pool.push(game);
            }
        }
        
        app.renderBoard();
        app.renderPool();

        const doc = helpers.getDocument();
        const tierRows = doc.querySelectorAll('.tier-row');
        const gameCards = doc.querySelectorAll('.game-card');
        const poolCount = doc.getElementById('pool-count');

        reporter.assert(tierRows.length === 35, "DOM rendered exactly 35 tier rows");
        reporter.assert(gameCards.length === 250, "DOM rendered exactly 250 game cards");
        reporter.assert(poolCount.textContent === "50 games", "Pool counter displays '50 games'");

        // Verify tier action button disabled states for top and bottom rows
        const firstRowUpBtn = tierRows[0].querySelector('.tier-row-actions .row-action-btn:nth-child(1)');
        const lastRowDownBtn = tierRows[34].querySelector('.tier-row-actions .row-action-btn:nth-child(2)');
        reporter.assert(firstRowUpBtn.disabled === true, "Top row Up action button is disabled");
        reporter.assert(lastRowDownBtn.disabled === true, "Bottom row Down action button is disabled");
    });

    await reporter.test("T5_STRESS_02: High-Frequency Drag-and-Drop Memory Churn", async () => {
        const { app, helpers } = createTestEnvironment();
        
        // Populate 100 games in pool
        for (let i = 0; i < 100; i++) {
            app.state.pool.push({ id: `churn-${i}`, name: `Churn Game ${i}`, image: 'http://img' });
        }
        app.renderPool();

        const startTime = Date.now();
        
        // Execute 100 consecutive rapid drag-and-drop operations
        for (let i = 0; i < 100; i++) {
            const targetTier = i % 2 === 0 ? 'tier-s' : 'tier-a';
            helpers.dragAndDrop(`churn-${i}`, 'pool', targetTier);
        }

        const duration = Date.now() - startTime;
        
        reporter.assert(app.state.pool.length === 0, "All 100 items moved out of pool");
        reporter.assert(app.state.tiers[0].games.length === 50, "50 items moved to Tier S");
        reporter.assert(app.state.tiers[1].games.length === 50, "50 items moved to Tier A");
        reporter.assert(duration < 2000, `100 drag-and-drop operations executed in ${duration}ms (< 2000ms target)`);

        // Verify zero orphaned card elements in DOM
        const totalCardsInDom = helpers.getDocument().querySelectorAll('.game-card').length;
        reporter.assert(totalCardsInDom === 100, "Exactly 100 card nodes exist in DOM without memory leakage");
    });

    // =========================================================================
    // CATEGORY 2: Adversarial & Corrupt Payloads (Proto Pollution, XSS, Null Bytes)
    // =========================================================================

    await reporter.test("T5_PAYLOAD_01: Prototype Pollution & Injection in JSON Import", async () => {
        const { app, helpers } = createTestEnvironment();

        const maliciousJson = JSON.stringify({
            title: "Safe Title",
            __proto__: { polluted: true },
            constructor: { prototype: { polluted: true } },
            tiers: [
                {
                    id: "tier-s",
                    label: "S",
                    color: "#ff79c6",
                    __proto__: { admin: true },
                    games: [
                        { id: "101", name: "Game 1", image: "http://img", __proto__: { injected: true } }
                    ]
                }
            ],
            pool: [
                { id: "102", name: "Game 2", image: "http://img" }
            ]
        });

        helpers.importJsonFile(maliciousJson);
        await new Promise(r => setTimeout(r, 20));

        // Assert prototype was NOT polluted
        const testObj = {};
        reporter.assert(testObj.polluted === undefined, "Object.prototype.polluted remains undefined");
        reporter.assert(testObj.admin === undefined, "Object.prototype.admin remains undefined");
        reporter.assert(testObj.injected === undefined, "Object.prototype.injected remains undefined");

        reporter.assert(app.state.listTitle === "Safe Title", "Import succeeded safely with sanitized objects");
        reporter.assert(app.state.tiers[0].games[0].id === "101", "Imported game retains correct ID");
    });

    await reporter.test("T5_PAYLOAD_02: Polyglot XSS Attacks & Multi-Vector Payload Escaping", async () => {
        const { app, helpers } = createTestEnvironment();

        const xssPayloads = [
            "<img src=x onerror=alert('XSS1')>",
            "javascript:alert('XSS2')",
            "\"><script>alert('XSS3')</script>",
            "unicode_\u202E_override",
            "null_\0_byte_string",
            "A".repeat(10000) // 10k character stress string
        ];

        // Test title XSS
        helpers.typeInput('#list-title', xssPayloads[0]);
        const boardTitleDisplay = helpers.getDocument().getElementById('board-title-display');
        reporter.assert(!boardTitleDisplay.innerHTML.includes('<img'), "Board title text content sanitized, no img tags inserted");

        // Test tier label XSS
        app.openTierEditModal('tier-s');
        helpers.typeInput('#edit-tier-label', xssPayloads[2]);
        helpers.click('#btn-save-tier-settings');
        
        const tierBanner = helpers.getDocument().querySelector('.tier-label-banner span');
        reporter.assert(!tierBanner.innerHTML.includes('<script>'), "Tier label HTML escaped in DOM banner");
        reporter.assert(tierBanner.textContent === xssPayloads[2].slice(0, 30), "Tier label text matches literal XSS string");

        // Test JSON export serialization of polyglot payloads
        app.addGameToPool('777', xssPayloads[1], 'http://img');
        
        let jsonStr = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                jsonStr = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-json');
        reporter.assert(jsonStr !== null, "JSON backup created with polyglot game name");
        const parsed = JSON.parse(jsonStr);
        reporter.assert(parsed.pool[0].name === xssPayloads[1], "Polyglot string serialized intact without executing");
    });

    // =========================================================================
    // CATEGORY 3: Event Concurrency & Rapid Interactions
    // =========================================================================

    await reporter.test("T5_EVENT_01: Rapid Interleaved Touch & Drag-and-Drop Event Sequences", async () => {
        const { app, helpers, window, document } = createTestEnvironment();

        app.addGameToPool('570', 'Dota 2', 'http://img');
        const card = document.querySelector('.game-card[data-game-id="570"]');

        // Fire rapid interleaved touchstart, touchmove, and touchcancel events
        const touch1 = { clientX: 100, clientY: 100 };
        const touch2 = { clientX: 120, clientY: 200 };

        const touchStartEvt = new window.TouchEvent('touchstart', { touches: [touch1], bubbles: true });
        const touchMoveEvt = new window.TouchEvent('touchmove', { touches: [touch2], bubbles: true, cancelable: true });
        const touchCancelEvt = new window.TouchEvent('touchcancel', { changedTouches: [touch2], bubbles: true });

        card.dispatchEvent(touchStartEvt);
        card.dispatchEvent(touchMoveEvt);
        card.dispatchEvent(touchCancelEvt);

        // Verify mirror elements cleaned up
        const mirrors = document.querySelectorAll('.touch-drag-mirror');
        reporter.assert(mirrors.length === 0, "Touch drag mirror element removed from DOM upon touchcancel");

        // Verify drag state resets cleanly
        reporter.assert(card.style.opacity === '1', "Card opacity restored to 1");
    });

    await reporter.test("T5_EVENT_02: High-Frequency Search Input & AbortController Cancellation", async () => {
        const { app, helpers } = createTestEnvironment();

        // Fire 30 rapid search queries in 10ms
        for (let i = 0; i < 30; i++) {
            helpers.typeInput('#steam-search', `Game Query ${i}`);
        }

        // Wait for debounce timeout to resolve final query
        await new Promise(r => setTimeout(r, 450));

        const spinner = helpers.getDocument().getElementById('search-spinner');
        reporter.assert(spinner.style.display === 'none', "Search spinner hidden after rapid query resolution");
        reporter.assert(app.activeSearchAbortController !== null, "AbortController initialized for active search");
    });

    // =========================================================================
    // CATEGORY 4: LocalStorage Quotas & Corruption Recovery
    // =========================================================================

    await reporter.test("T5_STORAGE_01: LocalStorage Quota Exceeded Safeguard", async () => {
        const { app, helpers, window } = createTestEnvironment();

        helpers.typeInput('#list-title', 'Quota Test List');

        // Mock localStorage.setItem to throw QuotaExceededError
        window.localStorage.setItem = () => {
            const err = new Error("DOMException: QuotaExceededError");
            err.name = "QuotaExceededError";
            throw err;
        };

        // Trigger save active list
        helpers.click('#btn-save');

        const toasts = helpers.getToasts();
        const quotaToast = toasts.find(t => t.isError && t.text.includes("LocalStorage"));
        reporter.assert(quotaToast !== undefined, "Error toast displayed when LocalStorage quota exceeded");

        // Verify app state remains intact in memory
        reporter.assert(app.state.listTitle === 'Quota Test List', "In-memory app state preserved despite storage quota error");
    });

    await reporter.test("T5_STORAGE_02: Disaster Recovery from 5MB Binary/Malformed LocalStorage Payload", async () => {
        // Create 5MB corrupt garbage payload
        const corruptPayload = "BINARY_GARBAGE_010101010101_".repeat(200000);

        const { app, helpers } = createTestEnvironment({
            'steam_tier_master_autosave': corruptPayload,
            'steam_tier_master_library': corruptPayload
        });

        // App initialization should recover gracefully
        reporter.assert(app.state.tiers.length === 5, "App initializes default 5 tiers despite 5MB corrupt storage data");
        reporter.assert(app.state.savedLists.length === 0, "Saved lists gracefully resets to empty array");
        reporter.assert(app.state.pool.length === 0, "Pool gracefully resets to empty array");
    });

    // =========================================================================
    // CATEGORY 5: Dynamic Layout & Controls Churn
    // =========================================================================

    await reporter.test("T5_LAYOUT_01: Rapid Layout & Size Toggle Cycling Under Heavy Load", async () => {
        const { app, helpers } = createTestEnvironment();

        for (let i = 0; i < 100; i++) {
            app.state.pool.push({ id: `layout-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        app.renderPool();

        const styles = ['horizontal', 'vertical'];
        const sizes = ['tiny', 'small', 'medium', 'large', 'xl', 'xxl'];

        // Rapidly cycle style and size toggles 54 times (full size cycles)
        for (let i = 0; i < 54; i++) {
            const nextStyle = styles[i % styles.length];
            const nextSize = sizes[i % sizes.length];
            app.updateCardStyle(nextStyle);
            app.updateCardSize(nextSize);
        }

        const expectedSize = sizes[53 % sizes.length]; // 'xxl'
        const expectedStyle = styles[53 % styles.length]; // 'vertical'
        const board = helpers.getDocument().getElementById('tier-list-board');
        reporter.assert(board.classList.contains(`layout-${expectedStyle}`), `Board has final layout-${expectedStyle} class`);
        reporter.assert(board.classList.contains(`size-${expectedSize}`), `Board has final size-${expectedSize} class`);

        const cards = helpers.getDocument().querySelectorAll('.game-card');
        reporter.assert(cards.length === 100, "100 game cards intact after 50 rapid toggle switches");
    });

    await reporter.test("T5_LAYOUT_02: Mass Dynamic Tier Row Operations & Game Evacuation", async () => {
        const { app, helpers } = createTestEnvironment();

        // Add 30 tiers
        for (let i = 0; i < 30; i++) {
            app.addNewTier();
        }

        // Add 100 games and distribute them across all tiers
        for (let i = 0; i < 100; i++) {
            const tierIndex = i % app.state.tiers.length;
            app.state.tiers[tierIndex].games.push({ id: `evac-${i}`, name: `Evac Game ${i}`, image: 'http://img' });
        }
        app.renderBoard();

        // Delete all tier rows one by one
        const tierIds = app.state.tiers.map(t => t.id);
        tierIds.forEach(id => {
            app.deleteTierRow(id);
        });

        reporter.assert(app.state.tiers.length === 0, "All tier rows deleted");
        reporter.assert(app.state.pool.length === 100, "All 100 placed games evacuated to pool without data loss");
        
        const poolCount = helpers.getDocument().getElementById('pool-count');
        reporter.assert(poolCount.textContent === "100 games", "Pool counter updated to '100 games'");
    });

    // =========================================================================
    // CATEGORY 6: Boundary Edge & Fallback Stress
    // =========================================================================

    await reporter.test("T5_FALLBACK_01: Untrusted Protocols & Broken Image URLs", async () => {
        const { app } = createTestEnvironment();

        const sanitizedPayload = app.validateAndSanitizeImport({
            title: "Sanitize Test",
            tiers: [],
            pool: [
                { id: "s1", name: "JS Scheme", image: "javascript:alert(1)" },
                { id: "s2", name: "File Scheme", image: "file:///etc/passwd" },
                { id: "s3", name: "Data HTML Scheme", image: "data:text/html,<script>alert(1)</script>" },
                { id: "s4", name: "FTP Scheme", image: "ftp://malicious.host/test.jpg" }
            ]
        });

        reporter.assert(sanitizedPayload.pool[0].image === '', "javascript: scheme stripped by validator");
        reporter.assert(sanitizedPayload.pool[1].image === '', "file: scheme stripped by validator");
        reporter.assert(sanitizedPayload.pool[2].image === '', "data:text/html scheme stripped by validator");
        reporter.assert(sanitizedPayload.pool[3].image === '', "ftp: scheme stripped by validator");
    });

    await reporter.test("T5_FALLBACK_02: High-Density Board PNG Export Control Toggling", async () => {
        const { app, helpers, window } = createTestEnvironment();

        // Build 200 game board
        for (let i = 0; i < 200; i++) {
            const tierIndex = i % 5;
            app.state.tiers[tierIndex].games.push({ id: `png-${i}`, name: `PNG Game ${i}`, image: 'http://img' });
        }
        app.renderBoard();

        // Trigger PNG export
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));

        const doc = helpers.getDocument();
        const actions = doc.querySelectorAll('.tier-row-actions');
        const boardControls = doc.querySelector('.board-builder-controls');

        // Verify UI action controls are properly restored to flex display after export finishes
        actions.forEach(a => {
            reporter.assert(a.style.display === '', "Row action controls original inline display restored after PNG export");
        });
        reporter.assert(boardControls.style.display === '', "Board builder controls original inline display restored after PNG export");
    });
}

module.exports = { runTier5Tests };
