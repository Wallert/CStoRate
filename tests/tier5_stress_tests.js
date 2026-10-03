/**
 * CStoRate Tier 5 State Mutation & Security Stress Verification Suite
 * Written by Challenger 2
 */

const { createTestEnvironment, assertNoRuntimeErrors, closeTestEnvironments } = require('./harness.js');

async function runTier5StressSuite() {
    const results = [];
    
    function logTest(name, passed, detail = '') {
        results.push({ name, passed, detail });
        const icon = passed ? '✓ PASS' : '✗ FAIL';
        console.log(`  ${icon}: ${name} ${detail ? `(${detail})` : ''}`);
    }

    console.log('\n==================================================');
    console.log('SUITE: Tier 5: State Mutation & Security Stress Verification');
    console.log('==================================================');

    // -------------------------------------------------------------------------
    // TASK 1: Extreme State Mutation Sequences
    // -------------------------------------------------------------------------
    try {
        const { app, helpers, window } = createTestEnvironment();

        // 1. Import JSON
        const sampleJson = JSON.stringify({
            version: "1.0",
            title: "Mutation Test List",
            tiers: [
                { id: "tier-s", label: "S Tier", color: "#ff7f7f", games: [{ id: "570", name: "Dota 2", image: "http://img1" }] },
                { id: "tier-a", label: "A Tier", color: "#ffbf7f", games: [] }
            ],
            pool: [
                { id: "730", name: "Counter-Strike 2", image: "http://img2" }
            ],
            cardStyle: "vertical",
            cardSize: "medium"
        });

        helpers.importJsonFile(sampleJson);
        await new Promise(resolve => setTimeout(resolve, 0));
        if (app.state.listTitle !== "Mutation Test List" || app.state.pool.length !== 1) {
            throw new Error(`Step 1 (Import) failed: listTitle="${app.state.listTitle}", pool.len=${app.state.pool.length}`);
        }

        // 2. Edit (Title, add game, move game, change tier label)
        helpers.typeInput('#list-title', 'Mutated List Title');
        app.addGameToPool('271590', 'GTA V', 'http://img3');
        helpers.dragAndDrop('730', 'pool', 'tier-a');
        app.state.tiers[0].label = 'SUPER TIER';
        app.renderBoard();

        if (app.state.tiers[0].label !== 'SUPER TIER' || app.state.tiers[1].games.length !== 1) {
            throw new Error("Step 2 (Edit) failed");
        }

        // 3. Save to Library
        helpers.click('#btn-save');
        const libraryData = JSON.parse(window.localStorage.getItem('steam_tier_master_library') || '[]');
        if (libraryData.length === 0 || libraryData[0].title !== 'Mutated List Title') {
            throw new Error("Step 3 (Save) failed");
        }
        const savedId = libraryData[0].id;

        // 4. Export PNG
        let pngTriggered = false;
        const origCanvas = window.html2canvas;
        window.html2canvas = async (el, opts) => {
            pngTriggered = true;
            return origCanvas(el, opts);
        };
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 50));
        if (!pngTriggered) {
            throw new Error("Step 4 (Export PNG) failed");
        }

        // 5. Reset Board
        window._confirmResult = true;
        helpers.click('#btn-reset');
        if (app.state.tiers.some(t => t.games.length > 0)) {
            throw new Error("Step 5 (Reset) failed: tiers not empty");
        }

        // 6. Load Saved List from Library
        app.loadSavedList(savedId);
        if (app.state.listTitle !== 'Mutated List Title' || app.state.tiers[1].games.length !== 1) {
            throw new Error("Step 6 (Load) failed: title or games not restored");
        }

        // 7. Export JSON
        let exportedJsonStr = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                exportedJsonStr = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        helpers.click('#btn-export-json');
        helpers.getDocument().body.appendChild = origAppend;
        
        if (!exportedJsonStr) {
            throw new Error("Step 7 (Export JSON) failed: no JSON generated");
        }
        const parsedExport = JSON.parse(exportedJsonStr);
        if (parsedExport.title !== 'Mutated List Title') {
            throw new Error("Step 7 (Export JSON) content mismatch");
        }

        // 8. Delete Saved List from Library
        app.deleteSavedList(savedId);
        const postDeleteLibrary = JSON.parse(window.localStorage.getItem('steam_tier_master_library') || '[]');
        if (postDeleteLibrary.some(item => item.id === savedId)) {
            throw new Error("Step 8 (Delete saved list) failed");
        }

        logTest("T5_MUTATION_01: Rapid sequence (Import -> Edit -> Save -> PNG -> Reset -> Load -> Export JSON -> Delete)", true);
    } catch (e) {
        logTest("T5_MUTATION_01: Rapid sequence (Import -> Edit -> Save -> PNG -> Reset -> Load -> Export JSON -> Delete)", false, e.message);
    }

    // -------------------------------------------------------------------------
    // TASK 2: Client-side XSS Immunity Verification
    // -------------------------------------------------------------------------
    const xssPayloads = [
        `<svg onload=alert('XSS_1')>`,
        `<iframe src=javascript:alert('XSS_2')>`,
        `'"><script>alert('XSS_3')</script>`,
        `<img src=x onerror=alert('XSS_4')>`,
        `<a href="javascript:alert('XSS_5')">Click me</a>`
    ];

    for (let i = 0; i < xssPayloads.length; i++) {
        const payload = xssPayloads[i];
        try {
            const { app, helpers } = createTestEnvironment();

            // Inject into List Title
            helpers.typeInput('#list-title', payload);
            const titleEl = helpers.getDocument().getElementById('list-title');
            if (titleEl.value !== payload) {
                throw new Error("Title value desync");
            }

            // Save to library and check rendered cards
            helpers.click('#btn-save');
            const savedCards = helpers.getDocument().querySelectorAll('.saved-title');
            savedCards.forEach(card => {
                if (card.querySelector('script, svg, iframe, img, a')) {
                    throw new Error("XSS unescaped in library item title DOM");
                }
            });

            // Inject into Tier Label
            app.state.tiers[0].label = payload;
            app.renderBoard();
            const tierLabelEl = helpers.getDocument().querySelector('.tier-label-banner');
            if (tierLabelEl && tierLabelEl.querySelector('script, svg, iframe, img, a')) {
                throw new Error("XSS unescaped in tier label DOM");
            }

            // Inject into Game Name & Custom Image URL
            app.addGameToPool(`xss-game-${i}`, payload, `http://example.com/image.jpg'">${payload}`);
            const gameCard = helpers.getDocument().querySelector(`.game-card[data-game-id="xss-game-${i}"]`);
            if (!gameCard) throw new Error("Game card not created");

            // Check if DOM contains unescaped HTML elements
            if (gameCard.querySelector('script, iframe')) {
                throw new Error("XSS unescaped in game card DOM");
            }

            // Inject via JSON Import
            const xssJson = JSON.stringify({
                version: "1.0",
                title: payload,
                tiers: [{ id: "tier-s", label: payload, color: "#ff7f7f", games: [{ id: `xss-json-${i}`, name: payload, image: payload }] }],
                pool: [{ id: `xss-json-pool-${i}`, name: payload, image: payload }]
            });
            helpers.importJsonFile(xssJson);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            // Check for actual executable DOM nodes, not escaped text inside attributes.
            const executablePayload = helpers.getDocument().querySelector('script:not([src]), iframe[src^="javascript:"]');
            if (executablePayload) {
                throw new Error("Raw executable script/iframe found in DOM!");
            }

            logTest(`T5_XSS_${i+1}: XSS immunity for payload [${payload.substring(0, 20)}...]`, true);
        } catch (e) {
            logTest(`T5_XSS_${i+1}: XSS immunity for payload [${payload.substring(0, 20)}...]`, false, e.message);
        }
    }

    // -------------------------------------------------------------------------
    // TASK 3: LocalStorage Recovery (Quota Exceeded & Corrupted Storage)
    // -------------------------------------------------------------------------
    try {
        // Quota Exceeded Scenario
        const { app, helpers, window } = createTestEnvironment();
        window.localStorage.setItem = () => {
            const err = new Error("DOMException: QuotaExceededError");
            err.name = "QuotaExceededError";
            throw err;
        };

        // Attempt save
        helpers.typeInput('#list-title', 'Quota Test List');
        helpers.click('#btn-save');

        // Verify toast error shown and app did not crash
        const lastToast = helpers.getLastToast();
        const hasQuotaToast = lastToast && (lastToast.text.toLowerCase().includes('storage') || lastToast.text.toLowerCase().includes('quota') || lastToast.isError);
        if (!hasQuotaToast) {
            throw new Error("Quota exceeded did not trigger user notification toast");
        }
        logTest("T5_STORAGE_01: LocalStorage quota exceeded caught gracefully with toast notification", true);
    } catch (e) {
        logTest("T5_STORAGE_01: LocalStorage quota exceeded caught gracefully with toast notification", false, e.message);
    }

    try {
        // Corrupted LocalStorage Scenario
        const { app, helpers } = createTestEnvironment({
            'steam_tier_master_library': 'INVALID_JSON_{{::',
            'steam_tier_master_autosave': '{{{CORRUPTED'
        });

        // Trigger load library storage
        app.loadLibraryFromStorage();
        
        // App should handle corrupt storage by falling back to empty list/defaults without crashing
        if (!Array.isArray(app.state.savedLists) || app.state.savedLists.length !== 0) {
            throw new Error("Corrupted library storage did not reset to empty array");
        }

        logTest("T5_STORAGE_02: Corrupted LocalStorage gracefully falls back to empty defaults", true);
    } catch (e) {
        logTest("T5_STORAGE_02: Corrupted LocalStorage gracefully falls back to empty defaults", false, e.message);
    }

    const total = results.length;
    const passedCount = results.filter(r => r.passed).length;
    console.log(`\nTier 5 Stress Verification Total: ${passedCount}/${total} Passed`);
    assertNoRuntimeErrors();
    closeTestEnvironments();
    return passedCount === total;
}

if (require.main === module) {
    runTier5StressSuite().then(success => { process.exitCode = success ? 0 : 1; })
        .catch(error => { console.error(error); process.exitCode = 1; })
        .finally(closeTestEnvironments);
}

module.exports = { runTier5StressSuite };
