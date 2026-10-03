const assert = require('node:assert/strict');
const http = require('node:http');
const { createServer } = require('../scripts/dev-server');

async function main() {
    const upstreamRequests = [];
    let response = () => new Response('{"items":[]}');
    const server = createServer({ fetchImpl: async (url, options) => {
        upstreamRequests.push({ url: String(url), options });
        return response();
    } });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const request = (target, method = 'GET') => new Promise((resolve, reject) => {
        const req = http.request({ hostname: '127.0.0.1', port: server.address().port, path: target, method }, res => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
        });
        req.on('error', reject); req.end();
    });
    let passed = 0;
    async function check(name, fn) { await fn(); passed++; console.log(`  PASS: ${name}`); }
    try {
        await check('Site serves locally with MIME and nosniff headers', async () => {
            const result = await request('/');
            assert.equal(result.status, 200);
            assert(result.body.includes('tier-list-board'));
            assert.equal(result.headers['x-content-type-options'], 'nosniff');
        });
        await check('HEAD returns headers without a body', async () => {
            const result = await request('/app.js', 'HEAD'); assert.equal(result.status, 200); assert.equal(result.body, '');
        });
        await check('Private files, archive and directory listings are unavailable', async () => {
            for (const target of ['/.git/config', '/CStoRate.rar', '/node_modules/', '/package.json', '/scripts/dev-server.js', '/../MEMORY.md', '/%2e%2e/%2e%2e/secret']) {
                assert.equal((await request(target)).status, 404, target);
            }
        });
        await check('Writes are rejected', async () => { assert.equal((await request('/', 'POST')).status, 405); });
        await check('Proxy uses fixed Steam origin and does not forward supplied headers or arbitrary URL', async () => {
            const result = await request('/api/storesearch/?term=Dota%202&url=https://evil.example&l=other');
            assert.equal(result.status, 200);
            const last = upstreamRequests.at(-1);
            assert.equal(last.url, 'https://store.steampowered.com/api/storesearch?term=Dota+2&l=english&cc=US');
            assert.equal(last.options.redirect, 'error');
            assert.deepEqual(last.options.headers, { Accept: 'application/json' });
        });
        await check('Malformed IDs and unknown endpoints do not contact Steam', async () => {
            const count = upstreamRequests.length;
            assert.equal((await request('/api/appdetails/?appids=abc')).status, 400);
            assert.equal((await request('/api/storesearch/?term=x')).status, 400);
            assert.equal((await request('/api/other')).status, 404);
            assert.equal(upstreamRequests.length, count);
        });
        await check('Invalid upstream JSON fails explicitly', async () => {
            response = () => new Response('not json');
            assert.equal((await request('/api/appdetails/?appids=570')).status, 502);
        });
        await check('Oversized upstream data is canceled before parsing', async () => {
            let canceled = false;
            response = () => new Response(new ReadableStream({
                start(controller) { controller.enqueue(new Uint8Array(5 * 1024 * 1024 + 1)); },
                cancel() { canceled = true; }
            }));
            assert.equal((await request('/api/appdetails/?appids=570')).status, 502);
            assert(canceled);
        });
        console.log(`Local server: ${passed}/8 passed`);
    } finally {
        server.closeAllConnections();
        await new Promise(resolve => server.close(resolve));
    }
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { main };
