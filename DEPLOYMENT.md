# CStoRate deployment and local development

CStoRate 1.0.5 is a static HTML/CSS/JavaScript site. Its Node server is a local development helper, not a hosted account backend. Check GitHub Actions and the live site's version footer for deployment status.

## Run locally

Install a supported Node.js release: 20.19+ in the 20.x line, 22.12+ in the 22.x line, or 24+. Prefer a supported LTS line. Run start.bat on Windows or:

```sh
npm run dev
```

Open http://127.0.0.1:8080. The server requires no npm packages to start, listens on 127.0.0.1 only, serves index.html/app.js/style.css, and proxies only Steam storesearch/appdetails endpoints. It provides no file browser. PORT can select another local port, for example `$env:PORT=8081` in PowerShell before running npm run dev.

## Verify before deployment

```sh
npm ci
npm run check
npm audit
```

Checks cover syntax, offline DOM integration/regression tests, stress cases and an isolated HTTP server suite. GitHub Actions runs npm ci and npm run check for main and pull requests. Inspect PNG downloads manually in the target browser; DOM tests mock html2canvas.

## GitHub Pages

Publish the three site assets from the repository main branch/root using Repository Settings -> Pages -> Deploy from a branch, or an equivalent static workflow. Review changes and commit/push through the repository usual process. The Node dev server does not run on GitHub Pages. Do not upload CStoRate.rar, node_modules, local backups or private metadata.

GitHub Pages and localhost have different browser origins, so localStorage does not transfer. Download Save JSON locally and import it on the published site if needed.

## Steam requests on public hosts

Steam does not normally allow direct cross-origin browser requests to these APIs. On localhost the app first tries the included same-origin proxy. On public static hosts it uses Jina, then AllOrigins, with cancellation, a 15-second timeout for HTTPS Jina Reader and 6.5 seconds for other candidates, bounded caches and response schema checks. Providers can fail or rate-limit; loading is announced, errors have an explicit Retry search button, and availability is not guaranteed.

For an owned proxy, deploy the backend separately and add this opt-in setting in index.html:

```html
<meta name="steam-proxy" content="/steam-api/">
```

The app then requests /steam-api/storesearch/ and /steam-api/appdetails/ on the same origin before external fallbacks. The prefix must be an absolute same-origin path ending in a slash. The hosting backend must implement those routes and enforce fixed Steam destinations, valid queries, response limits and timeouts. The bundled development server handles /api/ routes; it is not a public production server. No owned public proxy was deployed during the audit.

## Other static hosts

Vercel/Netlify or another static host can serve the three site assets without a build step. If publishing the repository root, exclude archives and development files or use a dedicated static output directory. Configure an owned Steam proxy separately if needed.

## Browser security and persistence

Executable CDN dependencies remain version-pinned with Subresource Integrity. HTML supplies a meta Content Security Policy. Hosts with response-header support can additionally supply CSP headers and frame-ancestors; GitHub Pages does not offer arbitrary response-header configuration.

JSON files are checked before reading and parsing; share fragments have a pre-decode limit; imported/shared/persisted boards pass the common validator. Image URLs allow bounded raster data images and browser-requested web images; permitted image hosts receive browser image requests. CORS governs which external images can be rendered into a PNG.

Browser storage may be disabled or full. Watch the saved-status indicator and use Save JSON as a portable backup. One previous board is retained during replacement/reset when storage permits.

See [AUDIT_REPORT.md](AUDIT_REPORT.md) for verified results and remaining limits.
