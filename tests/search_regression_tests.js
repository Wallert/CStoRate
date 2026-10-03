const assert = require('node:assert/strict');
const { createTestEnvironment } = require('./harness');
const wait = () => new Promise(resolve => setTimeout(resolve, 450));

async function runSearchRegressionTests(reporter) {
    reporter.startSuite('Steam search, list search and duplicate feedback');
    await reporter.test('Steam search accepts HTTPS Reader envelope and cold-query timeout', async () => {
        const { app, window } = createTestEnvironment();
        const calls = [];
        app.fetchJsonWithTimeout = async (url, options) => {
            calls.push({ url, timeout: options.timeoutMs });
            if (!url.startsWith('https://r.jina.ai/https://')) throw new Error('unavailable');
            return { items: [{ id: 570, name: 'Dota 2' }] };
        };
        const data = await app.fetchSteamJson('https://store.steampowered.com/api/storesearch/?term=Dota&l=english&cc=US');
        assert.equal(data.items[0].id, 570);
        assert.equal(calls.at(-1).timeout, 15000);
        window.fetch = async () => ({ ok: true, text: async () => 'Title:\n\nMarkdown Content:\n{"items":[{"id":570,"name":"Dota 2"}]}' });
        // Test the real parser rather than the override above.
        const fresh = createTestEnvironment();
        fresh.window.fetch = window.fetch;
        assert.equal((await fresh.app.fetchJsonWithTimeout('/reader')).items[0].id, 570);
    });
    await reporter.test('Failure offers a working retry and preserves the query', async () => {
        const { app, document, helpers } = createTestEnvironment();
        app.fetchSteamJson = async () => { throw new Error('offline'); };
        helpers.typeInput('#steam-search', 'Witcher');
        assert(document.getElementById('steam-search-status').textContent.includes('Searching'));
        await wait();
        assert.equal(document.getElementById('btn-retry-search').hidden, false);
        assert.equal(document.getElementById('steam-search').value, 'Witcher');
        app.fetchSteamJson = async () => ({ items: [{ id: 292030, name: 'The Witcher 3' }] });
        helpers.click('#btn-retry-search');
        await wait();
        assert.equal(document.querySelectorAll('#search-dropdown [role="option"]').length, 1);
        assert.equal(document.getElementById('btn-retry-search').hidden, true);
        assert.equal(document.getElementById('steam-search-status').textContent, '');
    });
    await reporter.test('A new query hides old results and cancelled requests cannot repaint', async () => {
        const { app, document, helpers } = createTestEnvironment();
        app.renderSearchDropdown([{ id: 570, name: 'Dota 2' }]);
        let resolve;
        app.fetchSteamJson = () => new Promise(done => { resolve = done; });
        helpers.typeInput('#steam-search', 'Witcher');
        assert.equal(document.getElementById('search-dropdown').style.display, 'none');
        await wait();
        app.dismissSearch();
        resolve({ items: [{ id: 292030, name: 'The Witcher 3' }] });
        await new Promise(done => setTimeout(done, 10));
        assert.equal(document.getElementById('search-dropdown').style.display, 'none');
        assert.equal(document.getElementById('steam-search-status').textContent, '');
    });
    await reporter.test('Enter selects the first visible result without an arrow key', () => {
        const { app, document, window } = createTestEnvironment();
        app.renderSearchDropdown([{ id: 570, name: 'Dota 2' }]);
        document.getElementById('steam-search').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(app.state.pool[0].id, '570');
    });
    await reporter.test('List search finds pool and tiers with names and exact IDs', () => {
        const { app, document, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        app.addGameToPool('730', 'Counter-Strike 2', '');
        app.moveGameToDestination('570', 'pool', 'tier-s');
        const before = JSON.stringify(app.state);
        helpers.typeInput('#board-search', 'DOTA');
        assert(document.getElementById('board-search-results').textContent.includes('tier S'));
        helpers.click('.board-search-result');
        assert.equal(document.activeElement.dataset.gameId, '570');
        helpers.typeInput('#board-search', '730');
        assert(document.getElementById('board-search-results').textContent.includes('unassigned pool'));
        helpers.typeInput('#board-search', '73');
        assert.equal(document.querySelectorAll('.board-search-result').length, 0);
        assert(document.getElementById('board-search-status').textContent.includes('not in this list'));
        assert.equal(JSON.stringify(app.state), before);
        assert.equal(document.querySelectorAll('.game-card').length, 2);
        assert.equal(document.querySelector('#tier-list-board #board-search'), null);
    });
    await reporter.test('Active list search updates after adding, moving, renaming a tier and deleting', () => {
        const { app, document, helpers } = createTestEnvironment();
        helpers.typeInput('#board-search', 'Dota');
        app.addGameToPool('570', 'Dota 2', '');
        assert.equal(document.querySelectorAll('.board-search-result').length, 1);
        app.moveGameToDestination('570', 'pool', 'tier-s');
        assert(document.getElementById('board-search-results').textContent.includes('tier S'));
        app.state.tiers[0].label = 'Favourite';
        app.renderBoard();
        assert(document.getElementById('board-search-results').textContent.includes('tier Favourite'));
        app.deleteGame('570', 'tier-s');
        assert.equal(document.querySelectorAll('.board-search-result').length, 0);
        helpers.click('#btn-clear-board-search');
        assert.equal(document.getElementById('board-search-results').hidden, true);
        assert.equal(document.activeElement.id, 'board-search');
    });
    await reporter.test('Duplicate App ID is blocked offline including leading zeros and shows its tier', async () => {
        const { app, window, helpers, document } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        app.moveGameToDestination('570', 'pool', 'tier-s');
        let requests = 0;
        window.fetch = async () => { requests++; throw new Error('offline'); };
        helpers.typeInput('#steam-id-input', '00570');
        await app.handleAddByLinkOrId();
        assert.equal(requests, 0);
        assert(helpers.getLastToast().text.includes('tier S'));
        assert.equal(document.activeElement.dataset.gameId, '570');
        assert.equal(app.state.tiers[0].games.length, 1);
        app.renderSearchDropdown([{ id: 570, name: 'Dota 2' }]);
        assert(document.querySelector('.search-game-location').textContent.includes('tier S'));
        helpers.click('#search-option-0');
        assert.equal(app.state.pool.length, 0);
    });
    await reporter.test('List search renders hostile names as text and caps a broad result set', () => {
        const { app, document, helpers } = createTestEnvironment();
        app.state.pool = Array.from({ length: 30 }, (_, i) => ({ id: String(i), name: '<img onerror=alert(1)> Game', image: '' }));
        helpers.typeInput('#board-search', 'game');
        assert.equal(document.querySelectorAll('.board-search-result').length, 20);
        assert.equal(document.querySelector('#board-search-results img'), null);
        assert(document.getElementById('board-search-status').textContent.includes('30 games found'));
    });
}

module.exports = { runSearchRegressionTests };
