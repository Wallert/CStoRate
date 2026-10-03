const assert = require('node:assert/strict');
const { createTestEnvironment } = require('./harness');
const wait = () => new Promise(resolve => setTimeout(resolve, 15));
const board = (title = 'Imported') => ({ title, tiers: [], pool: [], cardStyle: 'horizontal', cardSize: 'medium' });
const game = id => ({ id, name: `Game ${id}`, image: '' });

async function runAuditRegressionTests(reporter) {
    reporter.startSuite('Audit regressions: data integrity, async work and accessibility');
    await reporter.test('Oversized file is rejected before FileReader and preserves state', async () => {
        const { app, window, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        const before = JSON.stringify(app.state);
        app.importJson({ target: { files: [{ size: 5 * 1024 * 1024 + 1, content: '{}' }] } });
        await wait();
        assert.equal(window._fileReads || 0, 0);
        assert.equal(JSON.stringify(app.state), before);
        assert(helpers.getLastToast().isError);
    });
    await reporter.test('Oversized decoded text is rejected before JSON.parse', async () => {
        const { app, window } = createTestEnvironment();
        let parsed = false;
        window.JSON.parse = () => { parsed = true; throw new Error('Should not parse'); };
        app.importJson({ target: { files: [{ size: 1, content: ' '.repeat(5 * 1024 * 1024 + 1) }] } });
        await wait();
        assert.equal(parsed, false);
    });
    await reporter.test('Aggregate embedded image data has a budget', () => {
        const { app } = createTestEnvironment();
        const payload = board();
        payload.pool = [game('1'), game('2')].map(g => ({ ...g, image: 'data:image/png;base64,' + 'A'.repeat(1800000) }));
        assert.throws(() => app.validateAndSanitizeImport(payload), /Combined image/);
    });
    await reporter.test('Duplicate normalization remains unique when suffixes already exist', () => {
        const { app } = createTestEnvironment();
        const payload = board();
        payload.pool = ['x', 'x_dup_1', 'x', 'x', 'x'.repeat(100), 'x'.repeat(100)].map(game);
        const ids = app.validateAndSanitizeImport(payload).pool.map(g => g.id);
        assert.equal(new Set(ids).size, ids.length);
        assert(ids.every(id => id.length <= 100));
    });
    await reporter.test('Reserved tier IDs cannot collide with pool and trash destinations', () => {
        const { app } = createTestEnvironment();
        const payload = board();
        payload.tiers = ['pool', 'trash', 'pool_dup_1', 'pool'].map(id => ({ id, label: id, color: '#fff', games: [] }));
        const ids = app.validateAndSanitizeImport(payload).tiers.map(t => t.id);
        assert(!ids.includes('pool') && !ids.includes('trash'));
        assert.equal(new Set(ids).size, ids.length);
    });
    await reporter.test('Invalid destination or target does not remove the source game', () => {
        const { app } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        assert.equal(app.moveGameToDestination('570', 'pool', 'missing'), false);
        assert.equal(app.moveGameToDestination('570', 'pool', 'tier-s', 'missing'), false);
        assert.equal(app.state.pool.length, 1);
    });
    await reporter.test('Move saves even when the previous DOM node is absent', () => {
        const { app, helpers } = createTestEnvironment();
        app.state.pool.push(game('570'));
        app.moveGameToDestination('570', 'pool', 'tier-s');
        assert.equal(JSON.parse(helpers.getStorage().steam_tier_master_autosave).tiers[0].games[0].id, '570');
    });
    await reporter.test('Interactive additions respect the import limits', () => {
        const { app } = createTestEnvironment();
        app.state.pool = Array.from({ length: 1000 }, (_, i) => game(String(i)));
        app.addGameToPool('999999', 'Overflow', '');
        assert.equal(app.state.pool.length, 1000);
        app.state.tiers = Array.from({ length: 50 }, (_, i) => ({ id: `tier-${i}`, label: 'T', color: '#fff', games: [] }));
        app.addNewTier();
        assert.equal(app.state.tiers.length, 50);
    });
    await reporter.test('Temporarily empty title does not destroy the board after reload', () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        helpers.typeInput('#list-title', '');
        app.saveAutoSave();
        const reloaded = createTestEnvironment(helpers.getStorage());
        assert.equal(reloaded.app.state.pool.length, 1);
        assert(reloaded.app.state.listTitle.length > 0);
    });
    await reporter.test('Failed library create, clone and delete leave library and identity intact', () => {
        const { app, window } = createTestEnvironment();
        app.saveActiveList();
        const before = JSON.stringify(app.state.savedLists);
        const id = app.state.id;
        window.localStorage.setItem = () => { throw new Error('quota'); };
        app.duplicateSavedList(id);
        app.deleteSavedList(id);
        app.state.id = null;
        app.saveActiveList();
        assert.equal(app.state.id, null);
        assert.equal(JSON.stringify(app.state.savedLists), before);
    });
    await reporter.test('Autosave failures remain dirty, warn once and retry successfully', () => {
        const { app, window, helpers, document } = createTestEnvironment();
        const write = window.localStorage.setItem;
        window.localStorage.setItem = () => { throw new Error('quota'); };
        helpers.typeInput('#list-title', 'Unsaved draft');
        assert.equal(app.saveAutoSave(), false);
        app.saveAutoSave();
        assert.equal(app.isDirty, true);
        assert.equal(helpers.getToasts().filter(t => t.isError).length, 1);
        assert(document.getElementById('save-status').classList.contains('save-error'));
        window.localStorage.setItem = write;
        assert.equal(app.saveAutoSave(), true);
        assert.equal(app.isDirty, false);
        assert.equal(document.getElementById('save-status').textContent, 'Saved locally');
    });
    await reporter.test('Saving a list persists its active identity across reloads', () => {
        const { app, helpers } = createTestEnvironment();
        app.saveActiveList();
        const reloaded = createTestEnvironment(helpers.getStorage());
        assert.equal(reloaded.app.state.id, app.state.id);
        reloaded.app.saveActiveList();
        assert.equal(reloaded.app.state.savedLists.length, 1);
    });
    await reporter.test('Shared board preserves the draft and restores it after another reload', () => {
        const { app, window, helpers } = createTestEnvironment();
        app.addGameToPool('570', 'Previous draft', '');
        window.location.hash = app.generateShareUrl({ listTitle: 'Shared', tiers: [], pool: [] }).split('#')[1];
        app.checkAndLoadShareUrl();
        assert.equal(app.state.listTitle, 'Shared');
        const reloaded = createTestEnvironment(helpers.getStorage());
        reloaded.helpers.click('#btn-restore-board');
        assert.equal(reloaded.app.state.pool[0].name, 'Previous draft');
        reloaded.helpers.click('#btn-restore-board');
        assert.equal(reloaded.app.state.listTitle, 'Shared');
    });
    await reporter.test('Reset backs up the board and cancels pending metadata', async () => {
        const { app, window, helpers } = createTestEnvironment();
        app.addGameToPool('1', 'Old game', '');
        let resolve;
        app.fetchSteamJson = () => new Promise(done => { resolve = done; });
        helpers.typeInput('#steam-id-input', '570');
        const request = app.handleAddByLinkOrId();
        app.fullResetBoard();
        resolve({ 570: { success: true, data: { name: 'Late game' } } });
        await request;
        assert.equal(app.state.pool.length, 0);
        app.restorePreviousBoard();
        assert.equal(app.state.pool[0].name, 'Old game');
        assert.equal(window.document.getElementById('steam-id-input').disabled, false);
    });
    await reporter.test('A stale detail request cannot unlock controls for a newer request', async () => {
        const { app, helpers } = createTestEnvironment();
        const completions = [];
        app.fetchSteamJson = () => new Promise(done => completions.push(done));
        helpers.typeInput('#steam-id-input', '570');
        const first = app.handleAddByLinkOrId();
        helpers.typeInput('#steam-id-input', '730');
        const second = app.handleAddByLinkOrId();
        completions[0]({ 570: { success: true, data: { name: 'Old' } } });
        await first;
        assert.equal(app.dom.steamIdInput.disabled, true);
        completions[1]({ 730: { success: true, data: { name: 'New' } } });
        await second;
        assert.equal(app.state.pool.length, 1);
        assert.equal(app.state.pool[0].id, '730');
    });
    await reporter.test('Last chosen import wins even if previous readers ignore cancellation', () => {
        const { app, window } = createTestEnvironment();
        const readers = [];
        window.FileReader = class { constructor() { readers.push(this); } readAsText() {} abort() {} };
        const input = { target: { files: [{ size: 1 }] } };
        app.importJson(input); app.importJson(input);
        readers[1].onload({ target: { result: JSON.stringify(board('Latest')) } });
        readers[0].onload({ target: { result: JSON.stringify(board('Stale')) } });
        assert.equal(app.state.listTitle, 'Latest');
    });
    await reporter.test('Invalid proxy response advances to the next provider', async () => {
        const { app, window } = createTestEnvironment();
        let calls = 0;
        window.fetch = async () => ({ ok: true, json: async () => ++calls === 1 ? {} : { items: [] } });
        const result = await app.fetchSteamJson('https://store.steampowered.com/api/storesearch/?term=test');
        assert.equal(calls, 2);
        assert(Array.isArray(result.items));
    });
    await reporter.test('Search supports ArrowDown and Enter and Escape aborts pending work', () => {
        const { app, document, window } = createTestEnvironment();
        app.renderSearchDropdown([{ id: '570', name: 'Dota 2' }]);
        const input = document.getElementById('steam-search');
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        assert.equal(input.getAttribute('aria-activedescendant'), 'search-option-0');
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(app.state.pool[0].id, '570');
        app.handleSearchInput('pending');
        const signal = app.activeSearchAbortController.signal;
        input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        assert(signal.aborted);
        assert.equal(input.getAttribute('aria-expanded'), 'false');
    });
    await reporter.test('Ordinary mouse click opens game dialog; Enter after a move uses current row', () => {
        const { app, document, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        const card = document.querySelector('.game-card');
        card.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0 }));
        card.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true, button: 0 }));
        card.click();
        assert.equal(app.activeModal, app.dom.mobileMoveModal);
        app.closeMobileModal();
        app.moveGameToDestination('570', 'pool', 'tier-s');
        card.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        assert.equal(app.draggedSourceId, 'tier-s');
        app.dom.btnMobileReturnPool.click();
        assert.equal(app.state.pool.length, 1);
    });
    await reporter.test('Touch cancellation never commits a drop or deletes a game', () => {
        const { app, document, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        const card = document.querySelector('.game-card');
        document.elementFromPoint = () => app.dom.trashDropzone;
        const dispatch = (name, x, y) => {
            const event = new window.Event(name, { bubbles: true, cancelable: true });
            event.touches = name === 'touchcancel' ? [] : [{ identifier: 3, clientX: x, clientY: y }];
            event.changedTouches = [{ identifier: 3, clientX: x, clientY: y }];
            card.dispatchEvent(event);
        };
        dispatch('touchstart', 0, 0); dispatch('touchmove', 30, 30); dispatch('touchcancel', 30, 30);
        assert.equal(app.state.pool.length, 1);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
    });
    await reporter.test('Window blur clears drag mirror and selection lock', () => {
        const { app, document, window } = createTestEnvironment();
        app.addGameToPool('570', 'Dota 2', '');
        document.querySelector('.game-card').dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 300 }));
        document.dispatchEvent(new window.MouseEvent('mousemove', { clientX: 50, clientY: 320 }));
        assert(document.querySelector('.custom-drag-mirror'));
        window.dispatchEvent(new window.Event('blur'));
        assert.equal(document.querySelector('.custom-drag-mirror'), null);
        assert.equal(document.body.style.userSelect, '');
    });
    await reporter.test('Actual confirmation modal cancels safely and restores focus', () => {
        const { app, document } = createTestEnvironment({}, { manualConfirm: true });
        app.addGameToPool('570', 'Dota 2', '');
        const button = document.getElementById('btn-reset-all'); button.focus(); button.click();
        assert.equal(app.activeModal, app.dom.confirmModal);
        assert(document.querySelector('.app-container').hasAttribute('inert'));
        app.dom.btnConfirmCancel.click();
        assert.equal(app.state.pool.length, 1);
        assert.equal(document.activeElement, button);
        button.click(); app.dom.btnConfirmOk.click();
        assert.equal(app.state.pool.length, 0);
    });
    await reporter.test('PNG export ignores concurrent requests and restores original display on failure', async () => {
        const { app, window, document } = createTestEnvironment();
        const actions = document.querySelector('.tier-row-actions'); actions.style.display = 'grid';
        let reject; let calls = 0;
        window.html2canvas = () => { calls++; return new Promise((resolve, fail) => { reject = fail; }); };
        const first = app.exportToPng(); await app.exportToPng();
        assert.equal(calls, 1); assert(app.dom.btnExportPng.disabled);
        reject(new Error('Canvas failed')); await first;
        assert.equal(actions.style.display, 'grid');
        assert.equal(app.dom.btnExportPng.disabled, false);
    });
    await reporter.test('Oversized share links have actionable errors and clipboard fallback leaves no field', async () => {
        const { app, document, helpers } = createTestEnvironment();
        app.state.pool = [{ ...game('1'), image: 'data:image/png;base64,' + 'A'.repeat(500000) }];
        await app.shareCurrentList();
        assert(helpers.getLastToast().text.includes('Save JSON'));
        const button = document.getElementById('btn-share-current'); button.focus();
        document.execCommand = () => { throw new Error('Copy denied'); };
        assert.equal(await app.copyToClipboard('test'), false);
        assert.equal(document.querySelector('textarea'), null);
        assert.equal(document.activeElement, button);
    });
    await reporter.test('Literal prototype keys remain data in the application realm', () => {
        const { app, window } = createTestEnvironment();
        const payload = JSON.parse('{"title":"Safe","tiers":[],"pool":[],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}');
        app.validateAndSanitizeImport(payload);
        assert.equal(window.Object.prototype.polluted, undefined);
    });
    await reporter.test('Recovery preserves empty boards with customized tiers and can switch back', () => {
        const { app } = createTestEnvironment();
        app.state.tiers[0].label = 'Custom';
        app.fullResetBoard();
        app.restorePreviousBoard();
        assert.equal(app.state.tiers[0].label, 'Custom');
        app.restorePreviousBoard();
        assert.equal(app.state.tiers[0].label, 'S');
    });
    await reporter.test('Vertical posters reorder left to right within a row', () => {
        const { app, helpers } = createTestEnvironment();
        app.addGameToPool('1', 'One', ''); app.addGameToPool('2', 'Two', '');
        app.updateCardStyle('vertical');
        helpers.dragAndDrop('1', 'pool', 'pool', '2', true);
        assert.equal(app.state.pool[0].id, '2');
    });
    await reporter.test('Configured same-origin proxy is consumed before external providers', async () => {
        const { app, document, window } = createTestEnvironment();
        const meta = document.createElement('meta'); meta.name = 'steam-proxy'; meta.content = '/steam-api/'; document.head.append(meta);
        const urls = [];
        window.fetch = async url => { urls.push(url); return { ok: true, json: async () => ({ items: [] }) }; };
        await app.fetchSteamJson('https://store.steampowered.com/api/storesearch/?term=Dota');
        assert.equal(urls[0], '/steam-api/storesearch/?term=Dota');
    });
    await reporter.test('PNG uses a Blob download and reduces scale for large boards', async () => {
        const { app, window, document } = createTestEnvironment();
        Object.defineProperty(app.dom.tierListBoard, 'scrollWidth', { value: 10000 });
        Object.defineProperty(app.dom.tierListBoard, 'scrollHeight', { value: 2000 });
        let options; let href;
        window.html2canvas = async (element, settings) => {
            options = settings;
            return { toBlob: callback => callback(new window.Blob(['png'], { type: 'image/png' })) };
        };
        window.URL.createObjectURL = blob => { assert.equal(blob.type, 'image/png'); return 'blob:test-png'; };
        window.URL.revokeObjectURL = () => {};
        document.createElement = ((original) => function (name) {
            const element = original.call(document, name);
            if (name === 'a') element.click = () => { href = element.href; };
            return element;
        })(document.createElement);
        await app.exportToPng();
        assert.equal(href, 'blob:test-png');
        assert(options.scale < 2 && options.scale >= 0.5);
        assert(options.scale ** 2 * 20000000 <= 32000001);
    });
}

module.exports = { runAuditRegressionTests };
