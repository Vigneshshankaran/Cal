# Backend Deployment Guide (Node.js)

Since your backend uses **Puppeteer** and **Chromium** to generate PDFs, it requires a hosting environment that supports these tools. We recommend using **Render** or **Railway** for a seamless experience.

## Option 1: Deployment on Render (Recommended)

Render is great because it supports "Web Services" and can handle the Chromium dependencies automatically.

### 1. Prepare your Repository

Ensure your GitHub repository has the `backend` folder. If you want to deploy _only_ the backend, it's easier if the backend is in its own repository or if you point Render to the `backend` subdirectory.

### 2. Create a New Web Service

- Link your GitHub account and select this repository.
- **Root Directory**: `backend`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`

### 3. Configure Environment Variables

In the Render dashboard, go to the **Environment** tab and add:

- `PORT`: `10000` (or leave blank; Render provides one automatically)
- `GMAIL_USER`: Your Gmail address
- `GMAIL_PASS`: Your Gmail App Password
- `NODE_ENV`: `production`

### 4. Special Note for Puppeteer

Render's default environment might need the **Puppeteer Buildpack** or a slightly different launch config.

- In `server.js`, you are already using `@sparticuz/chromium`. Render usually works fine with this, but if you see errors, you might need to add a "Native Dependency" in Render to include Chrome.

---

## Completely Free Deployment Options

Running a backend with Puppeteer (Chrome) for free is difficult because it requires significant memory (RAM). Here are the best "Zero Cost" strategies:

### 1. Oracle Cloud "Always Free" Arm VM (The "Holy Grail")

Oracle offers the most generous free tier in the industry.

- **Specs**: 4 ARM OCPUs and **24 GB of RAM** — more than enough for Puppeteer.
- **Process**:
  1. Sign up for Oracle Cloud (requires a credit card for identity verification, but costs $0).
  2. Create an "Always Free" instance (Ubuntu 22.04).
  3. Install Node.js and Chromium:
     ```bash
     sudo apt-get update && sudo apt-get install -y chromium-browser
     ```
  4. Use **PM2** to keep your `server.js` alive.

### 2. Koyeb (Free Tier)

Koyeb provides a free tier for Node.js apps.

- **Root Directory**: `backend`
- **Pros**: Easy setup, includes SSL.
- **Cons**: 512MB RAM limit. Puppeteer may crash if generating very complex PDFs.
- **Setup**: Link GitHub -> Select `backend` folder -> Deploy.

### 3. Hyper-Optimized "Free" Architecture (No Backend Needed)

If you want **truly zero maintenance and zero cost forever**, you can move the logic to the frontend:

1. **PDF Generation**: Use the existing `jspdf` and `html2canvas` in your `index.html` to generate the PDF entirely in the user's browser.
2. **Emailing**: Use **EmailJS** (Free Tier). You can send emails directly from the frontend without needing `nodemailer` or an Express server.
3. **Hosting**: Host the whole project on **GitHub Pages** or **Vercel** for $0/month.

---

## Deployment on Vercel

Vercel is the best platform for your **frontend**, but it has some limitations for this specific **backend** because of how Puppeteer works.

### 1. Deploying the Frontend (High Success)

You can deploy your main `index.html`, `script.js`, and `style.css` to Vercel in seconds.

- **Cost**: $0
- **Speed**: Extremely fast.
- **Process**: Push your code to GitHub -> Import to Vercel -> Done.

### 2. Deploying the Backend (Requires Changes)

Vercel uses "Serverless Functions," which have unique rules:

- **Read-Only**: You cannot write files to `backend/public/js/`. Your current `server.js` uses `fs.writeFileSync`, which will **fail** on Vercel.
- **Timeout**: The free tier has a **10-second limit**. Generating 3 separate PDFs in one request might take 12-15 seconds, causing a "504 Gateway Timeout."
- **Size**: The Chromium binary is large. You are already using `@sparticuz/chromium`, which is the correct way to handle this on Vercel.

### How to make the Backend work on Vercel:

To use Vercel for the backend, you would need to:

1. **Remove `fs.writeFileSync`**: Instead of writing a config file, you should use `page.setContent()` to inject your HTML directly or pass data via URL parameters.
2. **Increase Timeout**: You would need a Pro account or break the PDF generation into 3 separate API calls (one for each page) so each one stays under the 10s limit.

**Recommendation**: Use Vercel for the **Frontend** and use **Koyeb** or **Render** for the **Backend**. This gives you the best of both worlds for free.

---

## Vital Step: Update your Frontend

Once the backend is deployed, you will get a URL (e.g., `https://equity-calc-api.onrender.com`).

You **must** go to your frontend `script.js` and change the API endpoint:

```javascript
// Search for your fetch calls and update the URL:
const API_URL = "https://your-deployed-backend-url.com";
```

### Why "Backend Only"?

Deploying the backend separately allows you to:

1. Keep the frontend fast (static hosting like Vercel/Netlify/Webflow).
2. Scale the backend independently for heavy PDF generation.
3. Securely hide your GMAIL credentials in the backend environment.
