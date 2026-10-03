const { createTestEnvironment } = require('./harness');

async function runReleaseRegressionTests(reporter) {
    reporter.startSuite('Release Regression: Production Readiness');

    await reporter.test('REG_STORAGE_01: Loading a library item synchronizes autosave', async () => {
        const { app, helpers, window } = createTestEnvironment();
        helpers.typeInput('#list-title', 'Release Candidate');
        app.addGameToPool('570', 'Dota 2', 'https://example.com/dota.jpg');
        helpers.click('#btn-save');
        const savedId = app.state.id;

        window._confirmResult = true;
        app.fullResetBoard();
        app.loadSavedList(savedId);

        const autosave = JSON.parse(window.localStorage.getItem('steam_tier_master_autosave'));
        reporter.assert(autosave.listTitle === 'Release Candidate', 'Loaded title must be written to autosave');
        reporter.assert(autosave.pool.some(game => game.id === '570'), 'Loaded games must be written to autosave');
    });

    await reporter.test('REG_NETWORK_01: Requests stop at the configured timeout', async () => {
        const { app, window } = createTestEnvironment();
        window.fetch = (url, options = {}) => new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                const error = new Error('aborted');
                error.name = 'AbortError';
                reject(error);
            }, { once: true });
        });

        const startedAt = Date.now();
        let message = '';
        try {
            await app.fetchJsonWithTimeout('/never', { timeoutMs: 15 });
        } catch (error) {
            message = error.message;
        }
        reporter.assert(message === 'Request timed out', 'Timeout should surface a deterministic error');
        reporter.assert(Date.now() - startedAt < 250, 'Request should abort promptly');
    });

    await reporter.test('REG_A11Y_01: Modal captures and restores keyboard focus', async () => {
        const { app, helpers } = createTestEnvironment();
        const settings = helpers.getDocument().querySelector('.row-action-btn[aria-label*="settings"]');
        settings.focus();
        app.openTierEditModal('tier-s');

        reporter.assert(helpers.getDocument().activeElement === helpers.getDocument().getElementById('edit-tier-label'), 'Focus should move into the dialog');
        reporter.assert(helpers.getDocument().querySelector('.app-container').hasAttribute('inert'), 'Background should be inert while dialog is open');

        app.closeTierEditModal();
        reporter.assert(helpers.getDocument().activeElement === settings, 'Focus should return to the triggering control');
        reporter.assert(!helpers.getDocument().querySelector('.app-container').hasAttribute('inert'), 'Background inert state should be removed');
    });

    await reporter.test('REG_IMPORT_01: Duplicate tier IDs are normalized', async () => {
        const { app } = createTestEnvironment();
        const sanitized = app.validateAndSanitizeImport({
            title: 'Duplicates',
            tiers: [
                { id: 'same', label: 'A', color: '#ffffff', games: [] },
                { id: 'same', label: 'B', color: '#ffffff', games: [] }
            ],
            pool: [],
            cardStyle: 'horizontal',
            cardSize: 'medium'
        });
        reporter.assert(new Set(sanitized.tiers.map(tier => tier.id)).size === 2, 'Tier IDs must be unique');
    });

    await reporter.test('REG_SHARE_01: Invalid shared state cannot corrupt the active board', async () => {
        const { app, window } = createTestEnvironment();
        const previousTitle = app.state.listTitle;
        const invalidPayload = { t: { unexpected: true }, r: {}, p: [] };
        window.location.hash = `#share=${window.btoa(encodeURIComponent(JSON.stringify(invalidPayload)))}`;
        app.checkAndLoadShareUrl();
        reporter.assert(app.state.listTitle === previousTitle, 'Invalid share payload must leave current state unchanged');
    });
}

module.exports = { runReleaseRegressionTests };
