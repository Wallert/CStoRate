# CStoRate — Steam Gaming Tier List Maker 🎮

[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Try_it_Now-ff79c6?style=for-the-badge)](https://wallert.github.io/CStoRate/)

> **🌐 Live Web Application:** [https://wallert.github.io/CStoRate/](https://wallert.github.io/CStoRate/)

A simple, fast, and customizable web tool for creating Steam game tier lists. 

Easily search for games on Steam, paste store links or App IDs, drag and drop games to rank them, and export your tier list as a PNG image or JSON file.

---

## ✨ Features

- **Steam Search & Fast Import:** Search games by name or paste Steam store links / App IDs directly.
- **Drag & Drop:** Move games between tiers, reorder them within a row, or drag to the trash bin to delete.
- **Mobile & Touch Friendly:** Works smoothly on phones, tablets, and desktops.
- **Card Styles:** Switch between horizontal banners and vertical posters, with adjustable card sizes.
- **PNG & JSON Export:** Save high-resolution images of your tier lists or export your config to JSON.
- **Auto-Save:** Saves your progress locally in your browser so you don't lose your work.

---

## 💻 How to Run Locally

For the best search experience (and to bypass browser CORS limits on Steam API), run it locally:

1. Clone or download this repository.
2. Install a supported Node.js version, then run **`start.bat`** (Windows) or start the included local server:
   ```bash
   npm run dev
   ```
3. Open `http://127.0.0.1:8080` in your browser. The server binds only to loopback and serves only the website assets and two fixed Steam API endpoints; no extra server package is downloaded.

---

## 🛠️ Built With

- Plain HTML5, CSS3 & JavaScript (Vanilla JS, no heavy frameworks)
- [Lucide Icons](https://lucide.dev/)
- [html2canvas](https://html2canvas.hertzen.com/) for PNG image generation

## Local data and recovery

Autosave and My Library live in this browser profile and website origin. The status beside the Actions panel shows whether the latest changes were saved. If browser storage is blocked or full, use **Save JSON** before closing the tab.

Loading JSON, a share link, a saved list, or Reset All preserves one previous board. Use **Restore previous board** to recover it, including after reload. This is one recovery slot, not a full undo history. JSON is the portable backup between localhost, GitHub Pages and other browsers.

Boards support up to **50 tiers / 1000 games**. JSON imports are limited to **5 MiB** and combined image strings to **3 MiB**. Share links are limited to **500000 encoded characters**; use JSON for larger boards. Third-party Steam search providers can be unavailable; the UI reports errors and supports retrying.

## Quality checks

Requires Node.js 20.19+ on the 20.x line, 22.12+ on the 22.x line, or 24+. A supported Node.js LTS release is recommended:

```bash
npm ci
npm run check
```

The check command validates JavaScript syntax and runs offline DOM integration/regression tests, stress tests, and HTTP tests for the local server. Tests close their browser environments and return failing exit codes.

Current version: **1.0.3**. See [the audit and fixes](AUDIT_REPORT.md), [release notes](RELEASE_NOTES.md), and [deployment guide](DEPLOYMENT.md). GitHub Pages deployments can be checked in the repository Actions tab and the live site's version footer.

---

## 📜 License

Distributed under the [MIT License](LICENSE).
