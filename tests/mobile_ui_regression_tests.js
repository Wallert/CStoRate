const assert = require('node:assert/strict');
const { createTestEnvironment } = require('./harness');

const settle = () => new Promise(resolve => setTimeout(resolve, 10));

function responsiveEnvironment(initiallyPhone) {
    const listeners = new Set();
    const media = {
        matches: initiallyPhone,
        addEventListener(type, listener) {
            if (type === 'change') listeners.add(listener);
        }
    };
    const env = createTestEnvironment({}, { matchMedia: () => media });
    return {
        ...env,
        groups: Array.from(env.document.querySelectorAll('.settings-group')),
        async resize(phone) {
            media.matches = phone;
            listeners.forEach(listener => listener(media));
            await settle();
        }
    };
}

function touchEnvironment() {
    const env = createTestEnvironment();
    const pending = new Map();
    let now = 0;
    let nextTimer = 0;
    env.window.Date.now = () => now;
    env.window.setTimeout = (callback, delay = 0) => {
        const id = ++nextTimer;
        pending.set(id, { at: now + delay, callback });
        return id;
    };
    env.window.clearTimeout = id => pending.delete(id);
    env.app.addGameToPool('620', 'Portal 2', '');
    const card = env.document.querySelector('.game-card');
    return {
        ...env,
        card,
        advance(ms) {
            const until = now + ms;
            while (true) {
                const next = [...pending].filter(([, task]) => task.at <= until)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!next) break;
                now = next[1].at;
                pending.delete(next[0]);
                next[1].callback();
            }
            now = until;
        },
        touch(type, x = 40, y = 300, { identifier = 3, touches } = {}) {
            const event = new env.window.Event(type, { bubbles: true, cancelable: true });
            const point = { identifier, clientX: x, clientY: y };
            event.touches = touches ?? (type === 'touchend' || type === 'touchcancel' ? [] : [point]);
            event.changedTouches = [point];
            card.dispatchEvent(event);
            return event;
        }
    };
}

async function runMobileUiRegressionTests(reporter) {
    reporter.startSuite('Mobile settings, gestures and toolbar states');
    await reporter.test('Phone starts collapsed; opening settings permits editing without hiding list search', async () => {
        const { document, groups, helpers } = responsiveEnvironment(true);
        assert.equal(groups.length, 3);
        await settle();
        assert(groups.every(group => !group.open));
        assert(groups.every(group => group.querySelector('summary').tabIndex === 0));
        groups[0].querySelector('summary').click();
        await settle();
        assert.equal(groups[0].open, true);
        helpers.typeInput('#list-title', 'Mobile favourites');
        assert.equal(document.getElementById('board-title-display').textContent, 'MOBILE FAVOURITES');
        assert.equal(document.getElementById('board-search').closest('.settings-group'), null);
        assert.equal(groups[1].open, false);
        assert.equal(groups[2].open, false);
    });
    await reporter.test('Desktop keeps every group open; mobile choices survive resizing without changing the list', async () => {
        const { app, groups, resize } = responsiveEnvironment(true);
        await settle();
        app.addGameToPool('620', 'Portal 2', '');
        const before = JSON.stringify(app.state);
        groups[1].querySelector('summary').click();
        await settle();
        await resize(false);
        assert(groups.every(group => group.open));
        assert(groups.every(group => group.querySelector('summary').tabIndex === -1));
        groups[1].querySelector('summary').click();
        await settle();
        assert.equal(groups[1].open, true);
        await resize(true);
        assert.deepEqual(groups.map(group => group.open), [false, true, false]);
        assert.equal(JSON.stringify(app.state), before);
    });
    await reporter.test('Resizing to phone preserves a focused field and leaves other settings collapsed', async () => {
        const { document, groups, resize } = responsiveEnvironment(false);
        await settle();
        const title = document.getElementById('list-title');
        title.focus();
        await resize(true);
        assert.deepEqual(groups.map(group => group.open), [true, false, false]);
        assert.equal(document.activeElement, title);
    });
    await reporter.test('An immediate swipe allows native scrolling and cannot drop a game or open its menu', () => {
        const { app, document, card, touch, advance } = touchEnvironment();
        document.elementFromPoint = () => app.dom.trashDropzone;
        const before = JSON.stringify(app.state);
        touch('touchstart');
        assert.equal(touch('touchmove', 40, 345).defaultPrevented, false);
        advance(600);
        touch('touchend', 40, 345);
        card.click();
        assert.equal(JSON.stringify(app.state), before);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        assert.equal(app.activeModal, null);
        assert.equal(card.style.opacity, '1');
        touch('touchstart');
        touch('touchend');
        card.click();
        assert.equal(app.activeModal, app.dom.mobileMoveModal);
    });
    await reporter.test('A short tap opens tier selection and cancels the pending hold', () => {
        const { app, document, card, touch, advance } = touchEnvironment();
        touch('touchstart');
        advance(100);
        assert.equal(touch('touchend').defaultPrevented, false);
        card.click();
        assert.equal(app.activeModal, app.dom.mobileMoveModal);
        advance(1000);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        document.querySelector('#mobile-tier-select-grid button').click();
        assert.equal(app.state.tiers[0].games[0].id, '620');
    });
    await reporter.test('A stationary hold arms dragging; moving and releasing places the game once', () => {
        const { app, document, window, card, touch, advance } = touchEnvironment();
        const target = document.querySelector('[data-tier-id="tier-s"] .tier-row-content');
        document.elementFromPoint = () => target;
        touch('touchstart');
        advance(449);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        advance(1);
        const mirror = document.querySelector('.touch-drag-mirror');
        assert.equal(mirror.getAttribute('aria-hidden'), 'true');
        assert.equal(mirror.inert, true);
        const menu = new window.Event('contextmenu', { cancelable: true });
        card.dispatchEvent(menu);
        assert.equal(menu.defaultPrevented, true);
        assert.equal(touch('touchmove', 60, 350).defaultPrevented, true);
        touch('touchend', 60, 350, { identifier: 99 });
        assert(document.querySelector('.touch-drag-mirror'));
        assert.equal(touch('touchend', 60, 350).defaultPrevented, true);
        assert.equal(app.state.tiers[0].games[0].id, '620');
        assert.equal(app.state.pool.length, 0);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        card.click();
        assert.equal(app.activeModal, null);
    });
    await reporter.test('Releasing a hold without movement never changes the board or opens a menu', () => {
        const { app, document, card, touch, advance } = touchEnvironment();
        document.elementFromPoint = () => app.dom.trashDropzone;
        const before = JSON.stringify(app.state);
        touch('touchstart');
        advance(450);
        touch('touchend');
        card.click();
        assert.equal(JSON.stringify(app.state), before);
        assert.equal(app.activeModal, null);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
    });
    await reporter.test('Cancellation, extra fingers and window blur clear armed and pending gestures without a drop', () => {
        const { app, document, window, touch, advance } = touchEnvironment();
        document.elementFromPoint = () => app.dom.trashDropzone;
        const before = JSON.stringify(app.state);
        for (const interrupt of ['cancel', 'multi', 'blur']) {
            touch('touchstart');
            advance(450);
            touch('touchmove', 60, 350);
            if (interrupt === 'cancel') touch('touchcancel');
            else if (interrupt === 'multi') touch('touchmove', 60, 350, {
                touches: [{ identifier: 3, clientX: 60, clientY: 350 }, { identifier: 4, clientX: 80, clientY: 350 }]
            });
            else window.dispatchEvent(new window.Event('blur'));
            touch('touchend', 60, 350);
            assert.equal(document.querySelector('.touch-drag-mirror'), null);
            assert.equal(document.querySelector('.drag-over'), null);
            assert.equal(JSON.stringify(app.state), before);
        }
        touch('touchstart');
        window.dispatchEvent(new window.Event('blur'));
        advance(600);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        touch('touchstart');
        advance(450);
        const uncancelableMove = new window.Event('touchmove', { bubbles: true, cancelable: false });
        uncancelableMove.touches = [{ identifier: 3, clientX: 60, clientY: 350 }];
        document.querySelector('.game-card').dispatchEvent(uncancelableMove);
        touch('touchend', 60, 350);
        assert.equal(JSON.stringify(app.state), before);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
    });
    await reporter.test('Replacing a card during a pending hold cannot create a detached drag mirror', () => {
        const { app, document, touch, advance } = touchEnvironment();
        touch('touchstart');
        app.renderPool();
        advance(600);
        assert.equal(document.querySelector('.touch-drag-mirror'), null);
        assert.equal(app.cancelTouchDrag, null);
        assert.equal(app.state.pool[0].id, '620');
    });
    await reporter.test('Format and size expose one pressed choice after edits and autosave reload', () => {
        const { app, document, helpers } = createTestEnvironment();
        const pressed = id => Array.from(document.querySelectorAll(`#${id} [aria-pressed="true"]`));
        assert.equal(pressed('layout-toggle-group')[0].dataset.layout, 'horizontal');
        assert.equal(pressed('size-toggle-group')[0].dataset.size, 'medium');
        helpers.click('[data-layout="vertical"]');
        helpers.click('[data-size="large"]');
        assert.equal(pressed('layout-toggle-group').length, 1);
        assert.equal(pressed('size-toggle-group').length, 1);
        assert.equal(pressed('layout-toggle-group')[0].dataset.layout, 'vertical');
        assert.equal(pressed('size-toggle-group')[0].dataset.size, 'large');
        app.saveAutoSave();
        const reloaded = createTestEnvironment(helpers.getStorage());
        assert.equal(reloaded.document.querySelector('[data-layout="vertical"]').getAttribute('aria-pressed'), 'true');
        assert.equal(reloaded.document.querySelector('[data-layout="horizontal"]').getAttribute('aria-pressed'), 'false');
        assert.equal(reloaded.document.querySelector('[data-size="large"]').getAttribute('aria-pressed'), 'true');
        assert.equal(reloaded.document.querySelector('[data-size="medium"]').getAttribute('aria-pressed'), 'false');
    });
    await reporter.test('Save errors stay outside collapsed settings and PNG content; a retry clears the error', async () => {
        const { app, document, window, groups } = responsiveEnvironment(true);
        await settle();
        assert(groups.every(group => !group.open));
        const status = document.getElementById('save-status');
        assert.equal(status.closest('.settings-group'), null);
        assert.equal(status.closest('#tier-list-board'), null);
        assert.equal(status.getAttribute('aria-atomic'), 'true');
        const write = window.localStorage.setItem;
        window.localStorage.setItem = () => { throw new Error('quota'); };
        app.markDirty();
        assert.equal(app.saveAutoSave(), false);
        assert(status.textContent.includes('Actions → Save JSON'));
        assert.equal(status.classList.contains('save-error'), true);
        assert(groups.every(group => !group.open));
        window.localStorage.setItem = write;
        assert.equal(app.saveAutoSave(), true);
        assert.equal(status.textContent, 'Saved locally');
        assert.equal(status.classList.contains('save-error'), false);
    });
    reporter.finishSuite();
}

module.exports = { runMobileUiRegressionTests };
