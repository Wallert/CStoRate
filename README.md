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
2. Run **`start.bat`** (Windows) or launch a local server on port 8080:
   ```bash
   npx http-server ./ -p 8080 --proxy https://store.steampowered.com
   ```
3. Open `http://localhost:8080` in your browser.

---

## 🛠️ Built With

- Plain HTML5, CSS3 & JavaScript (Vanilla JS, no heavy frameworks)
- [Lucide Icons](https://lucide.dev/)
- [html2canvas](https://html2canvas.hertzen.com/) for PNG image generation

---

## 📜 License

Distributed under the [MIT License](LICENSE).
