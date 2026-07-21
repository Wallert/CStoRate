# Deployment & Hosting Guide — CStoRate

This guide covers options for running and deploying **CantStop to rate (CStoRate)**.

---

## 1. Running Locally (Recommended for full Steam API Proxy support)

Because Steam APIs enforce strict CORS policies for web browsers, running locally with the included local proxy provides the fastest and most reliable search experience.

### Quick Start:
1. Double-click `start.bat` in the project root directory.
2. The batch script starts a local Node `http-server` proxying Steam requests on port `8080`.
3. Open your browser at:
   ```
   http://127.0.0.1:8080
   ```

---

## 2. Deploying to GitHub Pages (Static Hosting)

CStoRate is a pure static web app (HTML, CSS, JavaScript) and can be hosted directly on GitHub Pages for free.

### Steps:
1. Push the code to your GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Release CStoRate v1.0.0"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/CStoRate.git
   git push -u origin main
   ```
2. Go to **Repository Settings** -> **Pages**.
3. Under **Build and deployment**, select **Source:** `Deploy from a branch` -> `main` / `/ (root)`.
4. Click **Save**. Your site will be live at `https://YOUR_USERNAME.github.io/CStoRate/`.

> **Note on Steam Search on Public Static Hosts:**  
> When hosted on GitHub Pages, the application automatically falls back to public high-speed CORS proxies (`CodeTabs`, `AllOrigins`, `ThingProxy`). Search and App ID fetching will continue to work seamlessly!

---

## 3. Deploying to Vercel or Netlify

### Netlify / Vercel:
1. Connect your GitHub repository to Vercel or Netlify.
2. Build Settings:
   - **Build Command:** *(leave empty)*
   - **Publish Directory:** `./` (or root)
3. Deploy!

---

## 🔒 Security & CORS Notes
- The application relies on client-side state stored in `localStorage`.
- All user inputs are sanitized against XSS.
- PNG export operates with `useCORS: true` enabled for cross-origin Steam header images.
