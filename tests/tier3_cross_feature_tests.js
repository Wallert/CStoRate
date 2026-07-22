/**
 * CStoRate E2E Test Suite - Tier 3: Cross-Feature Combinations (8 Pairwise Interaction Tests)
 */

const { createTestEnvironment } = require('./harness');

async function runTier3Tests(reporter) {
    reporter.startSuite("Tier 3: Cross-Feature Combinations");

    await reporter.test("T3_COMB_01: Drag game from pool to Tier S, then drag from Tier S to Trash dropzone", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img');
        
        // Drag to Tier S
        helpers.dragAndDrop('570', 'pool', 'tier-s');
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(tierS.games.some(g => g.id === '570'), "Game in Tier S");
        
        // Drag from Tier S to Trash
        helpers.dragAndDrop('570', 'tier-s', 'trash');
        reporter.assert(!tierS.games.some(g => g.id === '570'), "Game removed from Tier S");
        reporter.assert(!app.state.pool.some(g => g.id === '570'), "Game not in pool");
        reporter.assert(helpers.getDocument().querySelectorAll('.game-card').length === 0, "No cards in DOM");
    });

    await reporter.test("T3_COMB_02: Save list to Library, import JSON over active board, verify Library item untouched", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Library Original');
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.click('#btn-save');
        const originalId = app.state.id;
        
        // Import JSON over active board
        const jsonContent = JSON.stringify({
            title: "Overwriting Board",
            tiers: [],
            pool: [{ id: "999", name: "New Game", image: "img" }]
        });
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(app.state.listTitle === "Overwriting Board", "Active board title updated");
        reporter.assert(app.state.id === null, "Session lock reset");
        
        // Check saved library item in LocalStorage
        const savedLists = JSON.parse(helpers.getWindow().localStorage.getItem('steam_tier_master_library'));
        const originalSaved = savedLists.find(l => l.id === originalId);
        reporter.assert(originalSaved !== undefined, "Original saved list still exists in Library");
        reporter.assert(originalSaved.title === "Library Original", "Original saved title untouched");
    });

    await reporter.test("T3_COMB_03: Search & add game from Steam, then hit Reset Board, verify game in pool", async () => {
        const { app, helpers, window } = createTestEnvironment();
        helpers.typeInput('#steam-search', 'Witcher');
        await new Promise(r => setTimeout(r, 450));
        
        const item = helpers.getDocument().querySelector('.autocomplete-item');
        helpers.click(item); // Adds 292030 to pool
        
        // Drag to Tier S
        helpers.dragAndDrop('292030', 'pool', 'tier-s');
        reporter.assert(app.state.tiers[0].games.some(g => g.id === '292030'), "Witcher in Tier S");
        
        // Reset Board
        window._confirmResult = true;
        helpers.click('#btn-reset');
        
        reporter.assert(app.state.tiers[0].games.length === 0, "Tier S emptied");
        reporter.assert(app.state.pool.some(g => g.id === '292030'), "Witcher returned to pool");
    });

    await reporter.test("T3_COMB_04: Edit Tier S label & color, then export PNG, verify board layout", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.openTierEditModal('tier-s');
        helpers.typeInput('#edit-tier-label', 'LEGENDARY');
        helpers.click('#btn-save-tier-settings');
        
        reporter.assert(app.state.tiers[0].label === 'LEGENDARY', "Label updated");
        
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        
        reporter.assert(window._html2canvasCalled === true, "PNG export called html2canvas");
        const bannerSpan = helpers.getDocument().querySelector('.tier-label-banner span');
        reporter.assert(bannerSpan.textContent === 'LEGENDARY', "DOM banner retains custom label after PNG export");
    });

    await reporter.test("T3_COMB_05: Clone saved list, load cloned list, edit title, save, verify distinct items", async () => {
        const { app, helpers } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Original Version');
        app.addGameToPool('570', 'Dota 2', 'http://img');
        helpers.click('#btn-save');
        const origId = app.state.id;
        
        // Clone
        app.duplicateSavedList(origId);
        const cloneId = app.state.savedLists[1].id;
        
        // Load clone and edit
        app.loadSavedList(cloneId);
        helpers.typeInput('#list-title', 'Cloned Version Edited');
        helpers.click('#btn-save');
        
        const library = JSON.parse(helpers.getWindow().localStorage.getItem('steam_tier_master_library'));
        reporter.assert(library.length === 2, "Library has 2 distinct entries");
        reporter.assert(library[0].title === 'Original Version', "First list title is Original Version");
        reporter.assert(library[1].title === 'Cloned Version Edited', "Second list title is Cloned Version Edited");
    });

    await reporter.test("T3_COMB_06: Import JSON in vertical mode, toggle to horizontal, change size to Small, export JSON", async () => {
        const { app, helpers } = createTestEnvironment();
        const jsonContent = JSON.stringify({
            title: "Multi Toggle",
            tiers: [],
            pool: [],
            cardStyle: "vertical",
            cardSize: "large"
        });
        
        helpers.importJsonFile(jsonContent);
        await new Promise(r => setTimeout(r, 20));
        
        // Toggle to horizontal
        app.updateCardStyle('horizontal');
        // Toggle to small
        app.updateCardSize('small');
        
        let exportedObj = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                const jsonStr = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
                exportedObj = JSON.parse(jsonStr);
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-json');
        
        reporter.assert(exportedObj.cardStyle === 'horizontal', "Exported JSON reflects updated horizontal layout");
        reporter.assert(exportedObj.cardSize === 'small', "Exported JSON reflects updated small size");
    });

    await reporter.test("T3_COMB_07: Populate games, add by App ID, save to library, delete from library", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('1086940', "Baldur's Gate 3", 'http://img');
        reporter.assert(app.state.pool.length === 1, "Pool initialized with 1 game");
        
        // Add game by App ID
        helpers.typeInput('#steam-id-input', '570');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        reporter.assert(app.state.pool.length === 2, "Dota 2 added, pool count now 2");
        
        // Save to Library
        helpers.typeInput('#list-title', 'My Custom List');
        helpers.click('#btn-save');
        const listId = app.state.id;
        reporter.assert(app.state.savedLists.length === 1, "Saved to library");
        
        // Delete from Library
        app.deleteSavedList(listId);
        reporter.assert(app.state.savedLists.length === 0, "Deleted from library");
    });

    await reporter.test("T3_COMB_08: Move games across tiers, export JSON, reset board, import JSON, verify positions", async () => {
        const { app, helpers, window } = createTestEnvironment();
        app.addGameToPool('100', 'Game A', 'http://img1');
        app.addGameToPool('200', 'Game B', 'http://img2');
        app.addGameToPool('300', 'Game C', 'http://img3');
        
        helpers.dragAndDrop('100', 'pool', 'tier-s');
        helpers.dragAndDrop('200', 'pool', 'tier-a');
        helpers.dragAndDrop('300', 'pool', 'tier-b');
        
        let jsonPayload = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                jsonPayload = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        
        helpers.click('#btn-export-json');
        
        // Reset Board
        window._confirmResult = true;
        helpers.click('#btn-reset');
        reporter.assert(app.state.pool.length === 3, "Reset returns all 3 games to pool");
        
        // Import JSON
        helpers.importJsonFile(jsonPayload);
        await new Promise(r => setTimeout(r, 20));
        
        const tierS = app.state.tiers.find(t => t.id === 'tier-s');
        const tierA = app.state.tiers.find(t => t.id === 'tier-a');
        const tierB = app.state.tiers.find(t => t.id === 'tier-b');
        
        reporter.assert(tierS.games[0].id === '100', "Game A restored to Tier S");
        reporter.assert(tierA.games[0].id === '200', "Game B restored to Tier A");
        reporter.assert(tierB.games[0].id === '300', "Game C restored to Tier B");
        reporter.assert(app.state.pool.length === 0, "Pool is empty after restore");
    });

    reporter.finishSuite();
}

module.exports = { runTier3Tests };
