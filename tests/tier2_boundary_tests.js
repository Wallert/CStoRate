/**
 * CStoRate E2E Test Suite - Tier 2: Boundary & Corner Cases (40 Tests)
 */

const { createTestEnvironment } = require('./harness');

async function runTier2Tests(reporter) {
    reporter.startSuite("Tier 2: Boundary & Corner Cases");

    // =========================================================================
    // FEATURE 1: Empty Inputs & Whitespace (5 Tests)
    // =========================================================================

    await reporter.test("T2_INPUT_01: Empty App ID input triggers no action or toast", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', '   ');
        helpers.click('#btn-add-by-id');
        
        reporter.assert(app.state.pool.length === 0, "No game added for whitespace input");
        reporter.assert(helpers.getToasts().length === 0, "No toast displayed for blank submit");
    });

    await reporter.test("T2_INPUT_02: Empty/whitespace list title save triggers error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', '   ');
        helpers.click('#btn-save');
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast displayed when saving title with empty string");
        reporter.assert(lastToast.text.includes("title first"), "Toast message alerts user to supply title");
    });

    await reporter.test("T2_INPUT_03: Empty tier label edit triggers error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        app.openTierEditModal('tier-s');
        helpers.typeInput('#edit-tier-label', '   ');
        helpers.click('#btn-save-tier-settings');
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast displayed when saving blank tier label");
        reporter.assert(app.state.tiers[0].label === 'S', "Tier label should remain unchanged");
    });

    await reporter.test("T2_INPUT_04: Whitespace search query closes dropdown without spinner stuck", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-search', '    ');
        await new Promise(r => setTimeout(r, 450));
        
        const dropdown = helpers.getDocument().getElementById('search-dropdown');
        const spinner = helpers.getDocument().getElementById('search-spinner');
        reporter.assert(dropdown.style.display === 'none', "Search dropdown closed for whitespace query");
        reporter.assert(spinner.style.display === 'none', "Spinner hidden for whitespace query");
    });

    await reporter.test("T2_INPUT_05: App ID input with leading/trailing spaces correctly trimmed", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', '   570   ');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Trimmed App ID 570 successfully added");
    });

    // =========================================================================
    // FEATURE 2: Max Length & XSS / Special Characters (5 Tests)
    // =========================================================================

    await reporter.test("T2_SECURITY_01: List title containing XSS script tags safely rendered in DOM", async () => {
        const { app, helpers } = createTestEnvironment();
        const xssPayload = "<script>window._xssExecuted=true;</script>";
        helpers.typeInput('#list-title', xssPayload);
        
        const titleDisplay = helpers.getDocument().getElementById('board-title-display');
        reporter.assert(helpers.getWindow()._xssExecuted === undefined, "XSS script should not execute");
        reporter.assert(titleDisplay.textContent === xssPayload.toUpperCase(), "Title text content safely assigned");
    });

    await reporter.test("T2_SECURITY_02: Tier label with HTML tags sanitized/escaped", async () => {
        const { app, helpers } = createTestEnvironment();
        const xssPayload = "<b onclick='alert(1)'>TIER</b>";
        app.openTierEditModal('tier-s');
        helpers.typeInput('#edit-tier-label', xssPayload);
        helpers.click('#btn-save-tier-settings');
        
        const banner = helpers.getDocument().querySelector('.tier-label-banner span');
        reporter.assert(banner.querySelector('b') === null, "No raw bold HTML element injected into banner");
        reporter.assert(banner.textContent === xssPayload, "Text content safely escaped");
    });

    await reporter.test("T2_SECURITY_03: Game name with quotes and HTML characters safely rendered", async () => {
        const { app, helpers } = createTestEnvironment();
        const specialName = `Game 'With' "Quotes" & <Brackets>`;
        app.addGameToPool('111', specialName, 'http://img');
        
        const overlay = helpers.getDocument().querySelector('.game-card[data-game-id="111"] .game-card-overlay');
        reporter.assert(overlay.textContent === specialName, "Game name rendered safely via textContent");
    });

    await reporter.test("T2_SECURITY_04: JSON import with XSS in title and tier labels sanitized", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonWithXss = JSON.stringify({
            title: "<img src=x onerror=window._xssImport=true>",
            tiers: [{ id: "t1", label: "<script>alert(1)</script>", color: "#fff", games: [] }],
            pool: []
        });
        
        helpers.importJsonFile(jsonWithXss);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(helpers.getWindow()._xssImport === undefined, "XSS in imported JSON title should not execute");
        const banner = helpers.getDocument().querySelector('.tier-label-banner span');
        reporter.assert(banner.textContent === "<script>alert(1)</script>", "XSS in imported tier label safely text-rendered");
    });

    await reporter.test("T2_SECURITY_05: Tier edit label input respects maxlength attribute (15 chars)", async () => {
        const { app, helpers } = createTestEnvironment();
        const input = helpers.getDocument().getElementById('edit-tier-label');
        reporter.assert(input.getAttribute('maxlength') === '15', "edit-tier-label should enforce maxlength 15");
    });

    // =========================================================================
    // FEATURE 3: Bad JSON Schema & Corrupt Data (5 Tests)
    // =========================================================================

    await reporter.test("T2_SCHEMA_01: Import JSON missing title property rejected with error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        const badJson = JSON.stringify({
            tiers: [],
            pool: []
        });
        
        helpers.importJsonFile(badJson);
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown for missing title schema");
        reporter.assert(lastToast.text.includes("Failed to parse"), "Toast message confirms parse failure");
    });

    await reporter.test("T2_SCHEMA_02: Import JSON with non-array tiers property rejected", async () => {
        const { app, helpers } = createTestEnvironment();
        const badJson = JSON.stringify({
            title: "Bad Schema",
            tiers: "not an array",
            pool: []
        });
        
        helpers.importJsonFile(badJson);
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown for non-array tiers");
    });

    await reporter.test("T2_SCHEMA_03: Import JSON with null object rejected gracefully", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.importJsonFile("null");
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown for null import payload");
    });

    await reporter.test("T2_SCHEMA_04: Import malformed JSON text syntax error caught", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.importJsonFile("{ bad json: syntax error, ");
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown for invalid JSON syntax");
    });

    await reporter.test("T2_SCHEMA_05: Import JSON with empty arrays for tiers and pool handles safely", async () => {
        const { app, helpers } = createTestEnvironment();
        const validEmptyJson = JSON.stringify({
            title: "Empty Board",
            tiers: [],
            pool: []
        });
        
        helpers.importJsonFile(validEmptyJson);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.listTitle === "Empty Board", "Title updated to Empty Board");
        reporter.assert(app.state.tiers.length === 0, "Tiers array empty");
        reporter.assert(app.state.pool.length === 0, "Pool array empty");
    });

    // =========================================================================
    // FEATURE 4: Empty Tiers & Extreme Row Configurations (5 Tests)
    // =========================================================================

    await reporter.test("T2_ROW_01: Deleting all tier rows leaves board in safe empty state", async () => {
        const { app, helpers } = createTestEnvironment();
        // Delete initial 5 tiers
        while (app.state.tiers.length > 0) {
            app.deleteTierRow(app.state.tiers[0].id);
        }
        
        reporter.assert(app.state.tiers.length === 0, "All tiers deleted");
        const rowsContainer = helpers.getDocument().getElementById('tier-rows-container');
        reporter.assert(rowsContainer.children.length === 0, "DOM container has 0 row children");
    });

    await reporter.test("T2_ROW_02: Adding 20 tier rows in succession renders DOM without error", async () => {
        const { app, helpers } = createTestEnvironment();
        for (let i = 0; i < 20; i++) {
            app.addNewTier();
        }
        
        reporter.assert(app.state.tiers.length === 25, "App should have 25 total tier rows");
        const rowsContainer = helpers.getDocument().getElementById('tier-rows-container');
        reporter.assert(rowsContainer.children.length === 25, "DOM should render 25 tier rows");
    });

    await reporter.test("T2_ROW_03: Up action button disabled on top tier row (index 0)", async () => {
        const { app, helpers } = createTestEnvironment();
        const topRowControls = helpers.getDocument().querySelector('.tier-row .row-action-btn[title="Move Row Up"]');
        reporter.assert(topRowControls.disabled === true, "Move Row Up button on top row must be disabled");
    });

    await reporter.test("T2_ROW_04: Down action button disabled on bottom tier row", async () => {
        const { app, helpers } = createTestEnvironment();
        const allDownBtns = helpers.getDocument().querySelectorAll('.tier-row .row-action-btn[title="Move Row Down"]');
        const lastDownBtn = allDownBtns[allDownBtns.length - 1];
        reporter.assert(lastDownBtn.disabled === true, "Move Row Down button on bottom row must be disabled");
    });

    await reporter.test("T2_ROW_05: Deleting a tier row containing games returns all row's games to pool", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        helpers.dragAndDrop('730', 'pool', 'tier-s');
        
        app.deleteTierRow('tier-s');
        
        reporter.assert(!app.state.tiers.some(t => t.id === 'tier-s'), "Tier S removed");
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Dota 2 returned to pool");
        reporter.assert(app.state.pool.some(g => g.id === '730'), "CS2 returned to pool");
    });

    // =========================================================================
    // FEATURE 5: Corrupt LocalStorage Handling (5 Tests)
    // =========================================================================

    await reporter.test("T2_STORAGE_01: Invalid JSON in steam_tier_master_library handled safely", async () => {
        const { app, helpers } = createTestEnvironment({
            'steam_tier_master_library': 'CORRUPT_NON_JSON_DATA{{{'
        });
        
        reporter.assert(Array.isArray(app.state.savedLists), "savedLists should fall back to empty array");
        reporter.assert(app.state.savedLists.length === 0, "savedLists length should be 0");
    });

    await reporter.test("T2_STORAGE_02: Invalid JSON in steam_tier_master_autosave handled safely", async () => {
        const { app, helpers } = createTestEnvironment({
            'steam_tier_master_autosave': 'INVALID_AUTOSAVE_JSON'
        });
        
        reporter.assert(app.state.tiers.length === 5, "Default tiers should remain initialized");
    });

    await reporter.test("T2_STORAGE_03: LocalStorage item missing required fields handled safely", async () => {
        const { app, helpers } = createTestEnvironment({
            'steam_tier_master_autosave': JSON.stringify({ id: "123" }) // missing tiers, pool, etc.
        });
        
        reporter.assert(app.state.tiers.length === 5, "App tiers array preserved from default");
    });

    await reporter.test("T2_STORAGE_04: LocalStorage getItem throwing error handled gracefully", async () => {
        const { app, helpers, window } = createTestEnvironment();
        window.localStorage.getItem = () => { throw new Error("Storage permission denied"); };
        
        // App operations should not crash
        app.loadLibraryFromStorage();
        reporter.assert(Array.isArray(app.state.savedLists), "savedLists handles storage exception gracefully");
    });

    await reporter.test("T2_STORAGE_05: LocalStorage setItem throwing quota error handled gracefully", async () => {
        const { app, helpers, window } = createTestEnvironment();
        window.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
        
        // Save should fail gracefully without throwing unhandled error
        try {
            app.saveAutoSave();
            reporter.assert(true, "saveAutoSave did not throw unhandled exception");
        } catch (e) {
            reporter.assert(false, "saveAutoSave threw unexpected exception: " + e.message);
        }
    });

    // =========================================================================
    // FEATURE 6: Large Datasets (100+ Items) (5 Tests)
    // =========================================================================

    await reporter.test("T2_PERF_01: Pool with 150 items renders correct count label", async () => {
        const { app, helpers } = createTestEnvironment();
        for (let i = 0; i < 150; i++) {
            app.state.pool.push({ id: `perf-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        app.renderPool();
        
        const poolCount = helpers.getDocument().getElementById('pool-count');
        reporter.assert(poolCount.textContent === "150 games", "Pool count should display '150 games'");
    });

    await reporter.test("T2_PERF_02: Moving items in 150-item list executes under 50ms", async () => {
        const { app, helpers } = createTestEnvironment();
        for (let i = 0; i < 150; i++) {
            app.state.pool.push({ id: `perf-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        app.renderPool();
        
        const startTime = Date.now();
        helpers.dragAndDrop('perf-50', 'pool', 'tier-s');
        const duration = Date.now() - startTime;
        
        reporter.assert(duration < 50, `Moving game in 150-item list took ${duration}ms (target < 50ms)`);
        reporter.assert(app.state.tiers[0].games.some(g => g.id === 'perf-50'), "Game perf-50 moved to Tier S");
    });

    await reporter.test("T2_PERF_03: Saving list with 150 items to LocalStorage serializes successfully", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Massive List');
        for (let i = 0; i < 150; i++) {
            app.state.pool.push({ id: `perf-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        
        helpers.click('#btn-save');
        
        const saved = JSON.parse(helpers.getWindow().localStorage.getItem('steam_tier_master_library'));
        reporter.assert(saved[0].pool.length === 150, "Saved list in LocalStorage retains 150 pool items");
    });

    await reporter.test("T2_PERF_04: Exporting JSON with 150 items includes all games", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Massive Export');
        for (let i = 0; i < 150; i++) {
            app.state.pool.push({ id: `perf-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        
        let jsonStr = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                jsonStr = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-json');
        
        const parsed = JSON.parse(jsonStr);
        reporter.assert(parsed.pool.length === 150, "Exported JSON contains 150 pool games");
    });

    await reporter.test("T2_PERF_05: Resetting board with 150 items moves all items to pool", async () => {
        const { app, helpers, window } = createTestEnvironment();
        // Distribute 150 items across 5 tiers
        for (let i = 0; i < 150; i++) {
            const tierIndex = i % 5;
            app.state.tiers[tierIndex].games.push({ id: `perf-${i}`, name: `Game ${i}`, image: 'http://img' });
        }
        app.renderBoard();
        
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        reporter.assert(app.state.pool.length === 150, "All 150 items returned to pool");
        reporter.assert(app.state.tiers.every(t => t.games.length === 0), "All 5 tiers are empty");
    });

    // =========================================================================
    // FEATURE 7: Failed Image URLs (5 Tests)
    // =========================================================================

    await reporter.test("T2_IMAGE_01: Game card image onerror hides img and adds fallback text card", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('888', 'Broken Image Game', 'http://invalid-image-url.com/broken.jpg');
        
        const card = helpers.getDocument().querySelector('.game-card[data-game-id="888"]');
        const img = card.querySelector('.game-card-img');
        
        // Safely extract and invoke initial onerror handler while clearing property to prevent JSDOM async loop timing race
        const initialOnError = img.onerror;
        img.onerror = null;
        if (typeof initialOnError === 'function') {
            initialOnError();
        }
        img.onerror = null;
        
        reporter.assert(img.style.display === 'none', "Image element hidden on error");
        reporter.assert(card.classList.contains('no-image'), "Card gets no-image class");
        reporter.assert(card.querySelector('.game-card-text').textContent === 'Broken Image Game', "Fallback text card added");
    });

    await reporter.test("T2_IMAGE_02: Vertical mode image failure falls back to header image", async () => {
        const { app, helpers } = createTestEnvironment();
        app.updateCardStyle('vertical');
        app.addGameToPool('570', 'Dota 2', 'http://header-image.jpg');
        
        const card = helpers.getDocument().querySelector('.game-card[data-game-id="570"]');
        const img = card.querySelector('.game-card-img');
        
        // Safely extract and invoke initial onerror handler while clearing property to prevent JSDOM async loop timing race
        const initialOnError = img.onerror;
        img.onerror = null;
        if (typeof initialOnError === 'function') {
            initialOnError();
        }
        img.onerror = null;
        
        reporter.assert(img.src.includes('http://header-image.jpg'), "Img src falls back to header image");
    });

    await reporter.test("T2_IMAGE_03: Both vertical and header image failures render fallback text card", async () => {
        const { app, helpers } = createTestEnvironment();
        app.updateCardStyle('vertical');
        app.addGameToPool('570', 'Dota 2', 'http://broken-header.jpg');
        
        const card = helpers.getDocument().querySelector('.game-card[data-game-id="570"]');
        const img = card.querySelector('.game-card-img');
        
        // First onerror (vertical fail) -> sets header image
        const firstOnError = img.onerror;
        img.onerror = null;
        if (typeof firstOnError === 'function') {
            firstOnError();
        }
        
        // Second onerror (header fail) -> sets no-image text card
        const secondOnError = img.onerror;
        img.onerror = null;
        if (typeof secondOnError === 'function') {
            secondOnError();
        }
        img.onerror = null;
        
        reporter.assert(card.classList.contains('no-image'), "Card has no-image class after double failure");
        reporter.assert(card.querySelector('.game-card-text').textContent === 'Dota 2', "Fallback text content displayed");
    });

    await reporter.test("T2_IMAGE_04: Broken CDN domain handled without unhandled promise rejection", async () => {
        const { app, helpers } = createTestEnvironment();
        // Adding game with broken domain
        app.addGameToPool('999', 'Broken CDN', 'https://broken.cdn.domain/image.jpg');
        reporter.assert(app.state.pool.some(g => g.id === '999'), "Game added despite broken image domain");
    });

    await reporter.test("T2_IMAGE_05: Image failure during PNG export handled gracefully without throwing error", async () => {
        const { app, helpers, window } = createTestEnvironment();
        window._html2canvasShouldFail = true;
        
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast displayed on PNG capture failure");
        reporter.assert(lastToast.text.includes("Could not generate image"), "Toast informs user of export failure");
    });

    // =========================================================================
    // FEATURE 8: Duplicate Additions (5 Tests)
    // =========================================================================

    await reporter.test("T2_DUP_01: Duplicate game addition to pool blocked with error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        // Attempt duplicate addition
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        reporter.assert(app.state.pool.filter(g => g.id === '570').length === 1, "Pool should only contain 1 instance of Dota 2");
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown for duplicate addition");
        reporter.assert(lastToast.text.includes("already on the board"), "Toast text warns of existing game");
    });

    await reporter.test("T2_DUP_02: Adding game already in a tier row blocked with error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games.length === 1, "Tier S has 1 game");
        reporter.assert(app.state.pool.length === 0, "Pool remains 0");
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast shown when game in tier");
    });

    await reporter.test("T2_DUP_03: Duplicate game IDs in JSON import handled safely", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonWithDups = JSON.stringify({
            title: "Duplicate JSON",
            tiers: [{ id: "t1", label: "S", color: "#fff", games: [{ id: "570", name: "Dota 2", image: "img" }] }],
            pool: [{ id: "570", name: "Dota 2", image: "img" }]
        });
        
        helpers.importJsonFile(jsonWithDups);
        await new Promise(r => setTimeout(r, 20));
        
        // Board renders cleanly without crashing
        reporter.assert(app.state.listTitle === "Duplicate JSON", "Import JSON with duplicate IDs parses safely");
    });

    await reporter.test("T2_DUP_04: Deleted game can be added back to pool", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        app.deleteGame('570', 'pool');
        
        app.addGameToPool('570', 'Dota 2', 'http://img');
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Re-adding deleted game succeeds");
    });

    await reporter.test("T2_DUP_05: Different games with same name but distinct IDs allowed in pool", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('100', 'Same Name Game', 'http://img1');
        app.addGameToPool('200', 'Same Name Game', 'http://img2');
        
        reporter.assert(app.state.pool.length === 2, "Both games added because IDs are distinct (100 and 200)");
    });

    reporter.finishSuite();
}

module.exports = { runTier2Tests };
