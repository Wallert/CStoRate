/**
 * CStoRate E2E Test Suite - Harness & DOM Environment
 */

const fs = require('fs');
const path = require('path');

const environments = new Set();
let JSDOM;
try {
    JSDOM = require('jsdom').JSDOM;
} catch (e) {
    // Graceful fallback message if jsdom is missing
    console.error("JSDOM is required to run the E2E test suite. Installing or resolving JSDOM...");
}

const htmlPath = path.join(__dirname, '../index.html');
const appJsPath = path.join(__dirname, '../app.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

function createTestEnvironment(initialLocalStorage = {}, { manualConfirm = false } = {}) {
    if (!JSDOM) {
        throw new Error("JSDOM module is not installed. Please run: npm install jsdom --save-dev");
    }

    // Prepare simulated localStorage
    const storageStore = { ...initialLocalStorage };
    const mockLocalStorage = {
        getItem: (key) => (key in storageStore ? storageStore[key] : null),
        setItem: (key, val) => { storageStore[key] = String(val); },
        removeItem: (key) => { delete storageStore[key]; },
        clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); },
        get length() { return Object.keys(storageStore).length; },
        key: (i) => Object.keys(storageStore)[i] || null,
        _store: storageStore // Direct inspect reference for tests
    };

    const cleanHtmlContent = htmlContent
        .replace('<script src="app.js"></script>', '')
        .replace('<link rel="stylesheet" href="style.css">', '');

    // Instantiate JSDOM
    const dom = new JSDOM(cleanHtmlContent, {
        url: 'http://localhost:3000/',
        runScripts: 'outside-only',
        pretendToBeVisual: true
    });
    environments.add(dom);

    const { window } = dom;
    const { document } = window;
    document.elementFromPoint = () => null;
    window.scrollBy = () => {};
    const runtimeErrors = [];
    window.addEventListener('error', event => runtimeErrors.push(event.error || new Error(event.message)));
    dom._runtimeErrors = runtimeErrors;
    const anchorClick = window.HTMLAnchorElement.prototype.click;
    window.HTMLAnchorElement.prototype.click = function () {
        if (!this.hasAttribute('download')) anchorClick.call(this);
    };

    // Attach mock LocalStorage
    Object.defineProperty(window, 'localStorage', {
        value: mockLocalStorage,
        writable: true
    });

    // Mock confirm dialog (default auto-accept)
    window.confirm = (msg) => {
        window._lastConfirmMessage = msg;
        return window._confirmResult !== undefined ? window._confirmResult : true;
    };

    // Mock lucide icons
    window.lucide = {
        createIcons: () => {}
    };

    // Mock html2canvas
    window.html2canvas = async (element, options) => {
        window._html2canvasCalled = true;
        window._html2canvasTarget = element;
        window._html2canvasOptions = options;
        if (window._html2canvasShouldFail) {
            throw new Error("Simulated canvas export error");
        }
        return {
            toDataURL: (type = 'image/png') => `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`
        };
    };

    // Mock fetch API for Steam endpoints
    window.fetch = async (url, opts) => {
        window._lastFetchUrl = url;
        const urlStr = String(url);

        if (urlStr.includes('error') || urlStr.includes('fail')) {
            throw new Error("Network request failed");
        }

        // App Details query
        if (urlStr.includes('appdetails')) {
            const match = urlStr.match(/appids=(\d+)/);
            const appId = match ? match[1] : '570';
            if (appId === '999999') {
                return {
                    ok: true,
                    json: async () => ({ [appId]: { success: false } })
                };
            }
            return {
                ok: true,
                json: async () => ({
                    [appId]: {
                        success: true,
                        data: {
                            name: appId === '730' ? "Counter-Strike 2" : (appId === '570' ? "Dota 2" : `Test Game ${appId}`),
                            header_image: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
                        }
                    }
                })
            };
        }

        // Store Search query
        if (urlStr.includes('storesearch')) {
            if (urlStr.includes('Witcher')) {
                return {
                    ok: true,
                    json: async () => ({
                        items: [
                            { id: 292030, name: "The Witcher 3: Wild Hunt" }
                        ]
                    })
                };
            }
            if (urlStr.includes('Cyberpunk')) {
                return {
                    ok: true,
                    json: async () => ({
                        items: [
                            { id: 207710, name: "Cyberpunk 2077" }
                        ]
                    })
                };
            }
            return {
                ok: true,
                json: async () => ({ items: [] })
            };
        }

        return {
            ok: true,
            json: async () => ({})
        };
    };

    // Mock FileReader for JSON import tests
    class MockFileReader {
        readAsText(file) {
            window._fileReads = (window._fileReads || 0) + 1;
            this.timer = window.setTimeout(() => {
                if (file._triggerError) {
                    if (this.onerror) this.onerror(new Error("File read error"));
                } else if (this.onload) {
                    this.onload({ target: { result: file.content } });
                }
            }, 0);
        }
        abort() { window.clearTimeout(this.timer); }
    }
    window.FileReader = MockFileReader;

    // Execute app.js in the window scope
    try {
        window.eval(appJsContent);
    } catch (e) {
        dom.window.close();
        environments.delete(dom);
        throw e;
    }

    // Dispatch DOMContentLoaded
    const event = document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    document.dispatchEvent(event);

    const app = window.app;
    if (!app || document.getElementById('fatal-app-error')) throw new Error('Application initialization failed');
    if (!manualConfirm) {
        app.showConfirmModal = (title, message, onConfirm) => {
            if (window.confirm(message)) onConfirm?.();
        };
    }

    // Test Helpers
    const helpers = {
        getApp: () => window.app,
        getDom: () => dom,
        getWindow: () => window,
        getDocument: () => document,
        getStorage: () => storageStore,

        // UI Interactions
        click: (selector) => {
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!el) throw new Error(`Element not found for click: ${selector}`);
            el.click();
            return el;
        },

        typeInput: (selector, text) => {
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!el) throw new Error(`Element not found for typeInput: ${selector}`);
            el.value = text;
            const event = new window.Event('input', { bubbles: true });
            el.dispatchEvent(event);
            return el;
        },

        pressKey: (selector, key) => {
            const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
            if (!el) throw new Error(`Element not found for pressKey: ${selector}`);
            const event = new window.KeyboardEvent('keypress', { key, bubbles: true });
            el.dispatchEvent(event);
            return el;
        },

        // Drag & Drop simulation
        dragAndDrop: (gameId, sourceId, destTierId, targetGameId = null, insertAfter = false) => {
            app.draggedGameId = gameId;
            app.draggedSourceId = sourceId;

            const targetZone = destTierId === 'pool' 
                ? document.getElementById('unassigned-pool')
                : (destTierId === 'trash' 
                    ? document.getElementById('trash-dropzone')
                    : document.querySelector(`.tier-row-content[data-tier-id="${destTierId}"]`));

            if (!targetZone) throw new Error(`Target drop zone not found: ${destTierId}`);

            const dropEvent = new window.Event('drop', { bubbles: true, cancelable: true });
            dropEvent.clientX = insertAfter ? 200 : 50;
            dropEvent.clientY = 100;
            
            let targetEl = targetZone;
            if (targetGameId) {
                const card = document.querySelector(`.game-card[data-game-id="${targetGameId}"]`);
                if (card) {
                    card.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 });
                    targetEl = card;
                }
            }

            targetEl.dispatchEvent(dropEvent);
        },

        // File Import simulation
        importJsonFile: (jsonContent) => {
            const file = { content: jsonContent, size: Buffer.byteLength(jsonContent) };
            const event = { target: { files: [file] } };
            app.importJson(event);
        },

        // Toast inspector
        getToasts: () => {
            const toasts = document.querySelectorAll('.toast');
            return Array.from(toasts).map(t => ({
                text: t.textContent.trim(),
                isSuccess: t.classList.contains('toast-success'),
                isError: t.classList.contains('toast-error')
            }));
        },

        getLastToast: () => {
            const toasts = helpers.getToasts();
            return toasts.length > 0 ? toasts[toasts.length - 1] : null;
        }
    };

    return { dom, window, document, app, helpers };
}

function assertNoRuntimeErrors() {
    for (const dom of environments) {
        if (dom._runtimeErrors.length) throw dom._runtimeErrors[0];
    }
}

function closeTestEnvironments() {
    for (const dom of environments) dom.window.close();
    environments.clear();
}

module.exports = { createTestEnvironment, assertNoRuntimeErrors, closeTestEnvironments };
