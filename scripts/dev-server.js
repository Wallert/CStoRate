'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const staticFiles = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
    ['/style.css', ['style.css', 'text/css; charset=utf-8']]
]);
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;

function steamTarget(url) {
    const endpoint = url.pathname.replace(/\/$/, '');
    const target = new URL(endpoint, 'https://store.steampowered.com');
    if (endpoint === '/api/appdetails') {
        const id = url.searchParams.get('appids');
        if (!/^\d{1,10}$/.test(id || '')) throw new Error('Invalid App ID');
        target.searchParams.set('appids', id);
    } else if (endpoint === '/api/storesearch') {
        const term = url.searchParams.get('term')?.trim();
        if (!term || term.length < 2 || term.length > 100) throw new Error('Invalid search term');
        target.searchParams.set('term', term);
        target.searchParams.set('l', 'english');
        target.searchParams.set('cc', 'US');
    } else return null;
    return target;
}

function createServer({ fetchImpl = fetch } = {}) {
    return http.createServer(async (req, res) => {
        const send = (status, body, type = 'text/plain; charset=utf-8') => {
            if (res.destroyed) return;
            res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
            res.end(req.method === 'HEAD' ? undefined : body);
        };
        if (!['GET', 'HEAD'].includes(req.method)) { send(405, 'Method not allowed'); return; }
        let url;
        try {
            if (!req.url.startsWith('/') || req.url.startsWith('//')) throw new Error('Invalid URL');
            url = new URL(req.url, 'http://127.0.0.1');
        } catch { send(400, 'Invalid URL'); return; }
        let target;
        try { target = steamTarget(url); }
        catch { send(400, 'Invalid Steam query'); return; }
        if (target) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6500);
            const cancel = () => controller.abort();
            res.on('close', cancel);
            try {
                const upstream = await fetchImpl(target, {
                    signal: controller.signal, redirect: 'error',
                    headers: { Accept: 'application/json' }
                });
                if (!upstream.ok || !upstream.body) throw new Error('Steam unavailable');
                const reader = upstream.body.getReader();
                const chunks = [];
                let size = 0;
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        size += value.byteLength;
                        if (size > MAX_RESPONSE_BYTES) throw new Error('Response too large');
                        chunks.push(Buffer.from(value));
                    }
                } finally {
                    await reader.cancel().catch(() => {});
                }
                const body = Buffer.concat(chunks);
                JSON.parse(body.toString('utf8'));
                send(200, body, 'application/json; charset=utf-8');
            } catch {
                send(controller.signal.aborted ? 504 : 502, 'Steam API unavailable. Retry shortly.');
            } finally {
                clearTimeout(timer);
                res.off('close', cancel);
            }
            return;
        }
        const file = staticFiles.get(url.pathname);
        if (!file) { send(404, 'Not found'); return; }
        try { send(200, await fs.readFile(path.join(root, file[0])), file[1]); }
        catch { send(500, 'Cannot read site file'); }
    });
}

if (require.main === module) {
    const port = Number(process.env.PORT || 8080);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        console.error('PORT must be an integer between 1 and 65535.');
        process.exitCode = 1;
    } else {
        const server = createServer();
        server.on('error', error => { console.error(`Cannot start local server: ${error.message}`); process.exitCode = 1; });
        server.listen(port, '127.0.0.1', () => console.log(`CStoRate: http://127.0.0.1:${port}`));
    }
}

module.exports = { createServer, steamTarget };
