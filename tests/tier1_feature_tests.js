/**
 * CStoRate E2E Test Suite - Tier 1: Feature Coverage (40 Tests)
 */

const { createTestEnvironment } = require('./harness');

async function runTier1Tests(reporter) {
    reporter.startSuite("Tier 1: Feature Coverage");

    // =========================================================================
    // FEATURE 1: Steam Search (5 Tests)
    // =========================================================================
    
    await reporter.test("T1_SEARCH_01: Search query populates autocomplete dropdown", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-search', 'Witcher');
        await new Promise(r => setTimeout(r, 450));
        
        const dropdown = helpers.getDocument().getElementById('search-dropdown');
        reporter.assert(dropdown.style.display === 'block', "Search dropdown should be visible");
        const items = dropdown.querySelectorAll('.autocomplete-item');
        reporter.assert(items.length > 0, "Dropdown should contain matching games");
        reporter.assert(items[0].textContent.includes('Witcher'), "Game title should match query");
    });

    await reporter.test("T1_SEARCH_02: Click search dropdown item adds game to pool", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-search', 'Witcher');
        await new Promise(r => setTimeout(r, 450));
        
        const item = helpers.getDocument().querySelector('.autocomplete-item');
        helpers.click(item);
        
        reporter.assert(app.state.pool.some(g => g.id === '292030'), "Game ID 292030 should be in pool");
        const searchInput = helpers.getDocument().getElementById('steam-search');
        reporter.assert(searchInput.value === '', "Search input should be cleared");
    });

    await reporter.test("T1_SEARCH_03: Clearing search input closes dropdown", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-search', 'Witcher');
        await new Promise(r => setTimeout(r, 450));
        
        helpers.typeInput('#steam-search', '');
        const dropdown = helpers.getDocument().getElementById('search-dropdown');
        reporter.assert(dropdown.style.display === 'none', "Dropdown should hide when input cleared");
    });

    await reporter.test("T1_SEARCH_04: Fallback to empty message when API search returns no results", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-search', 'NonExistentGame12345');
        await new Promise(r => setTimeout(r, 450));
        
        const dropdown = helpers.getDocument().getElementById('search-dropdown');
        reporter.assert(dropdown.style.display === 'block', "Dropdown should show fallback message");
        reporter.assert(dropdown.textContent.includes('No games found'), "Dropdown should show empty state message");
    });

    await reporter.test("T1_SEARCH_05: Spinner element visibility toggles during active search query", async () => {
        const { app, helpers } = createTestEnvironment();
        const spinner = helpers.getDocument().getElementById('search-spinner');
        helpers.typeInput('#steam-search', 'Witcher');
        reporter.assert(spinner.style.display === 'block', "Spinner should show immediately on input");
        await new Promise(r => setTimeout(r, 450));
        reporter.assert(spinner.style.display === 'none', "Spinner should hide after search completes");
    });

    // =========================================================================
    // FEATURE 2: Manual Addition by Link or App ID (5 Tests)
    // =========================================================================

    await reporter.test("T1_MANUAL_01: Add game by numeric App ID", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', '570');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Dota 2 (570) should be in pool");
        reporter.assert(app.state.pool.find(g => g.id === '570').name === "Dota 2", "Game name should be fetched");
    });

    await reporter.test("T1_MANUAL_02: Add game by Steam Store URL", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', 'https://store.steampowered.com/app/730/CounterStrike_2/');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        
        reporter.assert(app.state.pool.some(g => g.id === '730'), "CS2 (730) should be parsed and added to pool");
    });

    await reporter.test("T1_MANUAL_03: Add game by URL with extra query parameters", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', 'https://store.steampowered.com/app/570/Dota_2/?snr=1_4_4__125');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        
        reporter.assert(app.state.pool.some(g => g.id === '570'), "App ID 570 extracted from complex URL");
    });

    await reporter.test("T1_MANUAL_04: Press Enter key in steam-id-input triggers addition", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', '730');
        helpers.pressKey('#steam-id-input', 'Enter');
        await new Promise(r => setTimeout(r, 50));
        
        reporter.assert(app.state.pool.some(g => g.id === '730'), "Enter key press should trigger addition");
    });

    await reporter.test("T1_MANUAL_05: Invalid input string triggers error toast", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#steam-id-input', 'invalid_not_a_url_or_id');
        helpers.click('#btn-add-by-id');
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Error toast should be displayed for unparseable input");
        reporter.assert(lastToast.text.includes("Could not parse"), "Toast text should mention parse error");
    });

    // =========================================================================
    // FEATURE 3: Drag-and-Drop Tier/Pool Sorting (5 Tests)
    // =========================================================================

    await reporter.test("T1_DRAG_01: Move game from pool to Tier S", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        reporter.assert(!app.state.pool.some(g => g.id === '570'), "Game should leave pool");
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games.some(g => g.id === '570'), "Game should be in Tier S");
    });

    await reporter.test("T1_DRAG_02: Move game from Tier S to Tier A", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        helpers.dragAndDrop('570', 'tier-s', 'tier-a');
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        const tierA = app.state.tiers.find(t => t.id === 'tier-a');
        reporter.assert(!tierS.games.some(g => g.id === '570'), "Game should no longer be in Tier S");
        reporter.assert(tierA.games.some(g => g.id === '570'), "Game should be in Tier A");
    });

    await reporter.test("T1_DRAG_03: Reorder games within the same tier", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        helpers.dragAndDrop('730', 'pool', 'tier-s');
        
        // Reorder 730 before 570
        helpers.dragAndDrop('730', 'tier-s', 'tier-s', '570', false);
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games[0].id === '730', "CS2 should be moved first");
        reporter.assert(tierS.games[1].id === '570', "Dota 2 should be second");
    });

    await reporter.test("T1_DRAG_04: Move game from Tier B back to pool", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-b');
        
        helpers.dragAndDrop('570', 'tier-b', 'pool');
        
        const tierB = app.state.tiers.find(t => t.id === 'tier-b');
        reporter.assert(!tierB.games.some(g => g.id === '570'), "Game should leave Tier B");
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Game should return to pool");
    });

    await reporter.test("T1_DRAG_05: Move game from pool to newly created tier", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        app.addNewTier();
        const newTierId = app.state.tiers[app.state.tiers.length - 1].id;
        
        helpers.dragAndDrop('570', 'pool', newTierId);
        
        const newTier = app.state.tiers.find(t => t.id === newTierId);
        reporter.assert(newTier.games.some(g => g.id === '570'), "Game should move to new tier");
    });

    // =========================================================================
    // FEATURE 4: Game Deletion via Trash / Mobile Modal (5 Tests)
    // =========================================================================

    await reporter.test("T1_DELETE_01: Drag game from pool to trash dropzone", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        helpers.dragAndDrop('570', 'pool', 'trash');
        
        reporter.assert(!app.state.pool.some(g => g.id === '570'), "Game should be deleted from pool");
        reporter.assert(helpers.getDocument().querySelectorAll('.game-card').length === 0, "DOM card should be removed");
    });

    await reporter.test("T1_DELETE_02: Drag game from Tier S to trash dropzone", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        helpers.dragAndDrop('570', 'tier-s', 'trash');
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(!tierS.games.some(g => g.id === '570'), "Game should be deleted from Tier S");
    });

    await reporter.test("T1_DELETE_03: Click game card (mobile modal) and select Remove Game", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        const card = helpers.getDocument().querySelector('.game-card[data-game-id="570"]');
        helpers.click(card);
        
        const modal = helpers.getDocument().getElementById('mobile-move-modal');
        reporter.assert(modal.style.display === 'flex', "Mobile modal should open on card click");
        
        helpers.click('#btn-mobile-delete');
        
        reporter.assert(!app.state.pool.some(g => g.id === '570'), "Game should be removed via mobile modal");
        reporter.assert(modal.style.display === 'none', "Modal should close after deletion");
    });

    await reporter.test("T1_DELETE_04: Pool counter updates correctly upon deletion", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        
        helpers.dragAndDrop('570', 'pool', 'trash');
        
        const countLabel = helpers.getDocument().getElementById('pool-count');
        reporter.assert(countLabel.textContent.includes('1 game'), "Pool counter should reflect 1 remaining game");
    });

    await reporter.test("T1_DELETE_05: Re-adding a deleted game succeeds without duplicate error", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        app.deleteGame('570', 'pool');
        
        app.addGameToPool('570', 'Dota 2', 'http://img');
        reporter.assert(app.state.pool.some(g => g.id === '570'), "Deleted game should be re-addable");
    });

    // =========================================================================
    // FEATURE 5: Board Reset (5 Tests)
    // =========================================================================

    await reporter.test("T1_RESET_01: Board reset moves all tier games to pool", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        helpers.dragAndDrop('730', 'pool', 'tier-a');
        
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        const tierA = app.state.tiers.find(t => t.id === 'tier-a');
        reporter.assert(tierS.games.length === 0, "Tier S should be empty");
        reporter.assert(tierA.games.length === 0, "Tier A should be empty");
        reporter.assert(app.state.pool.length === 2, "All 2 games should be back in pool");
    });

    await reporter.test("T1_RESET_02: Board reset preserves existing games in pool", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        reporter.assert(app.state.pool.length === 2, "Pool should contain both Dota 2 and CS2");
    });

    await reporter.test("T1_RESET_03: Canceling board reset leaves state unchanged", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        
        window._confirmResult = false;
        helpers.click('#btn-reset');
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games.length === 1, "Tier S should still hold Dota 2 when canceled");
    });

    await reporter.test("T1_RESET_04: Board reset shows success toast notification", async () => {
        const { app, helpers, window } = createTestEnvironment();
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isSuccess, "Success toast should appear on board reset");
        reporter.assert(lastToast.text.includes("reset complete"), "Toast text should confirm reset");
    });

    await reporter.test("T1_RESET_05: Reset preserves tier structure (labels and colors)", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.state.tiers[0].label = "CUSTOM S";
        app.state.tiers[0].color = "#123456";
        
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        reporter.assert(app.state.tiers[0].label === "CUSTOM S", "Tier label should be preserved");
        reporter.assert(app.state.tiers[0].color === "#123456", "Tier color should be preserved");
    });

    // =========================================================================
    // FEATURE 6: List Saving/Loading (5 Tests)
    // =========================================================================

    await reporter.test("T1_SAVE_01: Save active tier list writes entry to LocalStorage", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'My Custom List');
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        helpers.click('#btn-save');
        
        const saved = JSON.parse(helpers.getWindow().localStorage.getItem('steam_tier_master_library'));
        reporter.assert(Array.isArray(saved) && saved.length === 1, "Library should contain 1 saved item");
        reporter.assert(saved[0].title === "My Custom List", "Saved item title should match");
    });

    await reporter.test("T1_SAVE_02: Library tab renders saved list card", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'My Custom List');
        helpers.click('#btn-save');
        
        app.switchTab('library');
        
        const grid = helpers.getDocument().getElementById('library-grid');
        reporter.assert(grid.querySelector('.saved-card'), "Library grid should contain saved card element");
        reporter.assert(grid.querySelector('.saved-title').textContent === 'My Custom List', "Card title match");
    });

    await reporter.test("T1_SAVE_03: Loading list from Library restores state", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Saved List 1');
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        helpers.click('#btn-save');
        const listId = app.state.id;
        
        // Reset state
        app.resetBoard();
        helpers.typeInput('#list-title', 'Empty');
        
        // Load saved list
        app.loadSavedList(listId);
        
        reporter.assert(app.state.listTitle === 'Saved List 1', "Title restored");
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games.some(g => g.id === '570'), "Tier S game restored");
    });

    await reporter.test("T1_SAVE_04: Duplicate list in Library creates clone with copy title", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Original List');
        helpers.click('#btn-save');
        const listId = app.state.id;
        
        app.duplicateSavedList(listId);
        
        reporter.assert(app.state.savedLists.length === 2, "Library should have 2 lists");
        reporter.assert(app.state.savedLists[1].title === "Original List (Copy)", "Cloned title should have (Copy)");
    });

    await reporter.test("T1_SAVE_05: Delete saved list removes entry from Library and LocalStorage", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'To Delete');
        helpers.click('#btn-save');
        const listId = app.state.id;
        
        app.deleteSavedList(listId);
        
        reporter.assert(app.state.savedLists.length === 0, "Library should be empty");
        const stored = JSON.parse(helpers.getWindow().localStorage.getItem('steam_tier_master_library'));
        reporter.assert(stored.length === 0, "LocalStorage should be empty");
    });

    // =========================================================================
    // FEATURE 7: JSON Import/Export (5 Tests)
    // =========================================================================

    await reporter.test("T1_JSON_01: Export JSON generates valid config object", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Export Test');
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        // Intercept download anchor
        let downloadedContent = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                const href = node.getAttribute('href');
                downloadedContent = decodeURIComponent(href.replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-json');
        
        reporter.assert(downloadedContent !== null, "JSON download should be triggered");
        const parsed = JSON.parse(downloadedContent);
        reporter.assert(parsed.title === 'Export Test', "JSON title match");
        reporter.assert(Array.isArray(parsed.tiers) && Array.isArray(parsed.pool), "JSON arrays match");
    });

    await reporter.test("T1_JSON_02: Import valid JSON updates title, tiers, and pool", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonContent = JSON.stringify({
            title: "Imported Tier List",
            tiers: [{ id: "t1", label: "S", color: "#ff0000", games: [{ id: "100", name: "Game 100", image: "img" }] }],
            pool: [{ id: "101", name: "Game 101", image: "img" }],
            cardStyle: "vertical",
            cardSize: "large"
        });
        
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.listTitle === "Imported Tier List", "List title should be updated");
        reporter.assert(app.state.tiers[0].games[0].name === "Game 100", "Tier game imported");
        reporter.assert(app.state.pool[0].name === "Game 101", "Pool game imported");
    });

    await reporter.test("T1_JSON_03: Import JSON updates cardStyle layout", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonContent = JSON.stringify({
            title: "Style Test",
            tiers: [],
            pool: [],
            cardStyle: "vertical"
        });
        
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.cardStyle === "vertical", "Card style updated to vertical");
        const board = helpers.getDocument().getElementById('tier-list-board');
        reporter.assert(board.classList.contains('layout-vertical'), "DOM board has layout-vertical class");
    });

    await reporter.test("T1_JSON_04: Import JSON updates cardSize", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonContent = JSON.stringify({
            title: "Size Test",
            tiers: [],
            pool: [],
            cardSize: "large"
        });
        
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.cardSize === "large", "Card size updated to large");
        const board = helpers.getDocument().getElementById('tier-list-board');
        reporter.assert(board.classList.contains('size-large'), "DOM board has size-large class");
    });

    await reporter.test("T1_JSON_05: Import JSON clears active list session lock", async () => {
        const { app, helpers } = createTestEnvironment();
        app.state.id = "list-12345";
        
        const jsonContent = JSON.stringify({
            title: "New JSON",
            tiers: [],
            pool: []
        });
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.id === null, "Session lock state.id should be reset to null");
    });

    // =========================================================================
    // FEATURE 8: PNG Export (5 Tests)
    // =========================================================================

    await reporter.test("T1_PNG_01: Export PNG calls html2canvas on board element", async () => {
        const { app, helpers, window } = createTestEnvironment();
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(window._html2canvasCalled === true, "html2canvas should be invoked");
        reporter.assert(window._html2canvasTarget.id === 'tier-list-board', "Captured element should be tier-list-board");
    });

    await reporter.test("T1_PNG_02: Actions controls hidden during export", async () => {
        const { app, helpers, window } = createTestEnvironment();
        const actionControls = helpers.getDocument().querySelectorAll('.tier-row-actions');
        
        // Intercept html2canvas to inspect styles mid-export
        let actionStyleDuringExport = null;
        window.html2canvas = async (el, opts) => {
            actionStyleDuringExport = actionControls[0] ? actionControls[0].style.display : null;
            return { toDataURL: () => 'data:image/png;base64,mock' };
        };
        
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(actionStyleDuringExport === 'none', "Tier row actions should be hidden during export");
    });

    await reporter.test("T1_PNG_03: Board builder controls hidden during export", async () => {
        const { app, helpers, window } = createTestEnvironment();
        const boardControls = helpers.getDocument().querySelector('.board-builder-controls');
        
        let controlsStyleDuringExport = null;
        window.html2canvas = async (el, opts) => {
            controlsStyleDuringExport = boardControls.style.display;
            return { toDataURL: () => 'data:image/png;base64,mock' };
        };
        
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(controlsStyleDuringExport === 'none', "Board builder controls should be hidden during export");
    });

    await reporter.test("T1_PNG_04: Controls restored after PNG export completes", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        const actionControls = helpers.getDocument().querySelectorAll('.tier-row-actions');
        const boardControls = helpers.getDocument().querySelector('.board-builder-controls');
        reporter.assert(actionControls[0].style.display === '', "Tier row actions display restored");
        reporter.assert(boardControls.style.display === '', "Board builder controls display restored");
    });

    await reporter.test("T1_PNG_05: Download anchor created with sanitized list title filename", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'My Gaming Tier List');
        
        let downloadName = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.hasAttribute('download')) {
                downloadName = node.getAttribute('download');
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(downloadName === 'My_Gaming_Tier_List_tierlist.png', "Filename should replace spaces with underscores");
    });

    await reporter.test("T1_SHARE_01: Generate share URL encodes board state and decodes on init", async () => {
        const { app, helpers, createTestEnvironment: createEnv } = require('./harness');
        const env1 = createTestEnvironment();
        env1.app.addGameToPool('570', 'Dota 2', 'http://img');
        
        const shareUrl = env1.app.generateShareUrl(env1.app.state);
        reporter.assert(shareUrl.includes('#share='), "Share URL contains #share= payload");
        
        // Simulate opening share URL in a fresh environment
        const shareHash = shareUrl.substring(shareUrl.indexOf('#share='));
        const env2 = createTestEnvironment();
        env2.window.location.hash = shareHash;
        env2.app.checkAndLoadShareUrl();
        
        reporter.assert(env2.app.state.pool.some(g => g.id === '570'), "Shared game Dota 2 loaded into new app state");
    });

    reporter.finishSuite();
}

module.exports = { runTier1Tests };
