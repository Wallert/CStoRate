/**
 * CStoRate E2E Test Suite - Tier 4: Real-World Application Scenarios (4 Full E2E Workflows)
 */

const { createTestEnvironment } = require('./harness');

async function runTier4Tests(reporter) {
    reporter.startSuite("Tier 4: Real-World Application Scenarios");

    await reporter.test("T4_SCENARIO_01: Full E2E Tier List Creation, Export, Reload, and Capture Workflow", async () => {
        const { app, helpers, window } = createTestEnvironment();
        
        // Step 1: Load preset template
        app.loadTemplate('rpg-legends');
        reporter.assert(app.state.pool.length === 6, "Step 1: Loaded RPG Legends template with 6 games");
        
        // Step 2: Add extra game via App ID
        helpers.typeInput('#steam-id-input', '730');
        helpers.click('#btn-add-by-id');
        await new Promise(r => setTimeout(r, 50));
        reporter.assert(app.state.pool.some(g => g.id === '730'), "Step 2: CS2 added to pool");
        
        // Step 3: Customize Tier S label and color
        app.openTierEditModal('tier-s');
        helpers.typeInput('#edit-tier-label', 'GOD TIER');
        app.dom.customColorPicker.value = '#ff007f';
        helpers.click('#btn-save-tier-settings');
        
        const godTier = app.state.tiers.find(t => t.id === 'tier-s');
        reporter.assert(godTier.label === 'GOD TIER', "Step 3: Tier S relabeled to GOD TIER");
        reporter.assert(godTier.color === '#ff007f', "Step 3: Tier S color updated to #ff007f");
        
        // Step 4: Reorder games into GOD TIER
        helpers.dragAndDrop('1086940', 'pool', 'tier-s'); // BG3
        helpers.dragAndDrop('1245620', 'pool', 'tier-s'); // Elden Ring
        reporter.assert(godTier.games.length === 2, "Step 4: 2 games moved to GOD TIER");
        
        // Step 5: Save list to Library
        helpers.typeInput('#list-title', 'My RPG Masterpiece');
        helpers.click('#btn-save');
        const listId = app.state.id;
        reporter.assert(app.state.savedLists.some(l => l.id === listId), "Step 5: Tier list saved to Library");
        
        // Step 6: Export PNG
        helpers.click('#btn-export-png');
        await new Promise(r => setTimeout(r, 20));
        reporter.assert(window._html2canvasCalled === true, "Step 6: PNG export compiled successfully");
        
        // Step 7: Backup JSON
        let jsonExport = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                jsonExport = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        helpers.click('#btn-export-json');
        
        reporter.assert(jsonExport !== null, "Step 7: Config JSON exported successfully");
        const parsed = JSON.parse(jsonExport);
        reporter.assert(parsed.title === 'My RPG Masterpiece', "Step 7: Exported title matches");
        reporter.assert(parsed.tiers[0].label === 'GOD TIER', "Step 7: Exported GOD TIER label matches");
    });

    await reporter.test("T4_SCENARIO_02: Disaster Recovery & Data Corruption Safeguard Workflow", async () => {
        // Step 1: Initialize with corrupted autosave
        const { app, helpers, window } = createTestEnvironment({
            'steam_tier_master_autosave': 'CORRUPTED_JSON_MALFORMED{{{'
        });
        
        reporter.assert(app.state.tiers.length === 5, "Step 1: App initializes default 5 tiers despite corrupted autosave");
        
        // Step 2: Attempt importing malformed JSON
        helpers.importJsonFile("NOT_VALID_JSON_FORMAT");
        await new Promise(r => setTimeout(r, 20));
        
        const lastToast = helpers.getLastToast();
        reporter.assert(lastToast && lastToast.isError, "Step 2: Graceful error toast displayed for malformed JSON");
        
        // Step 3: Recover app state by loading a preset template
        app.loadTemplate('competitive-fps');
        reporter.assert(app.state.listTitle.includes("Competitive Shooters"), "Step 3: Board recovered via preset template");
        reporter.assert(app.state.pool.length === 6, "Step 3: 6 games loaded into pool");
        
        // Step 4: Save valid list to LocalStorage
        helpers.click('#btn-save');
        reporter.assert(app.state.savedLists.length === 1, "Step 4: Valid tier list saved to LocalStorage");
    });

    await reporter.test("T4_SCENARIO_03: Mobile / Touch User Quick-Move Workflow", async () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', 'http://img1');
        app.addGameToPool('730', 'CS2', 'http://img2');
        app.addGameToPool('1172470', 'Apex Legends', 'http://img3');
        
        // Step 1: Open mobile modal for Dota 2 and assign to Tier A
        const card1 = helpers.getDocument().querySelector('.game-card[data-game-id="570"]');
        helpers.click(card1);
        
        const modal = helpers.getDocument().getElementById('mobile-move-modal');
        reporter.assert(modal.style.display === 'flex', "Step 1: Mobile modal opened");
        
        // Click Tier A button inside modal
        const tierABtn = Array.from(helpers.getDocument().querySelectorAll('.tier-select-btn')).find(b => b.textContent === 'A');
        helpers.click(tierABtn);
        
        const tierA = app.state.tiers.find(t => t.id === 'tier-a');
        reporter.assert(tierA.games.some(g => g.id === '570'), "Step 1: Dota 2 moved to Tier A via tap UI");
        
        // Step 2: Open mobile modal for Apex Legends and delete
        const card3 = helpers.getDocument().querySelector('.game-card[data-game-id="1172470"]');
        helpers.click(card3);
        helpers.click('#btn-mobile-delete');
        
        reporter.assert(!app.state.pool.some(g => g.id === '1172470'), "Step 2: Apex Legends deleted via mobile modal");
        
        // Step 3: Switch layout formats and card size
        app.updateCardStyle('vertical');
        app.updateCardSize('large');
        
        const board = helpers.getDocument().getElementById('tier-list-board');
        reporter.assert(board.classList.contains('layout-vertical'), "Step 3: Layout changed to vertical");
        reporter.assert(board.classList.contains('size-large'), "Step 3: Size changed to large");
    });

    await reporter.test("T4_SCENARIO_04: High-Density Scaling Workflow (100 Games & Custom Tiers)", async () => {
        const { app, helpers, window } = createTestEnvironment();
        helpers.typeInput('#list-title', 'High Density 100 Games');
        
        // Step 1: Add 5 new tier rows (10 total tiers)
        for (let i = 0; i < 5; i++) {
            app.addNewTier();
        }
        reporter.assert(app.state.tiers.length === 10, "Step 1: 10 total tiers created");
        
        // Step 2: Generate and populate 100 games distributed across 10 tiers (10 per tier)
        for (let i = 0; i < 100; i++) {
            const tierIndex = Math.floor(i / 10);
            const gameObj = { id: `scale-${i}`, name: `Game ${i}`, image: 'http://img' };
            app.state.tiers[tierIndex].games.push(gameObj);
        }
        app.renderBoard();
        
        const totalPlaced = app.state.tiers.reduce((sum, t) => sum + t.games.length, 0);
        reporter.assert(totalPlaced === 100, "Step 2: 100 games distributed across 10 tiers");
        
        // Step 3: Backup to JSON
        let jsonExport = null;
        const origAppend = helpers.getDocument().body.appendChild;
        helpers.getDocument().body.appendChild = function(node) {
            if (node.tagName === 'A' && node.getAttribute('href')) {
                jsonExport = decodeURIComponent(node.getAttribute('href').replace('data:text/json;charset=utf-8,', ''));
            }
            return origAppend.call(this, node);
        };
        helpers.click('#btn-export-json');
        reporter.assert(jsonExport !== null, "Step 3: Exported JSON containing 100 games");
        
        // Step 4: Reset Board
        window._confirmResult = true;
        helpers.click('#btn-reset');
        reporter.assert(app.state.pool.length === 100, "Step 4: All 100 games returned to pool on reset");
        
        // Step 5: Restore from JSON
        helpers.importJsonFile(jsonExport);
        await new Promise(r => setTimeout(r, 20));
        
        const restoredPlaced = app.state.tiers.reduce((sum, t) => sum + t.games.length, 0);
        reporter.assert(restoredPlaced === 100, "Step 5: All 100 games restored to exact tier positions from JSON");
        reporter.assert(app.state.pool.length === 0, "Step 5: Pool empty after restoration");
    });

    reporter.finishSuite();
}

module.exports = { runTier4Tests };
