# Install Pi for Excel (recommended)

Pi for Excel is an Excel taskpane add-in. Excel loads it from a manifest file that points to a hosted HTTPS app.

This is the **non-technical install path**:
- no git
- no Node
- no mkcert
- no local dev server

---

## 1) Download the production manifest

Download:
- **https://pi-for-excel.vercel.app/manifest.prod.xml**

Fallbacks (if the hosted link is temporarily unavailable):
- Latest release assets: https://github.com/tmustier/pi-for-excel/releases/latest
- Repo copy: https://github.com/tmustier/pi-for-excel/blob/main/manifest.prod.xml

Keep the filename as `manifest.prod.xml`.

---

## 2) Install in Excel

> Excel labels differ slightly by version (`Add-ins`, `Office Add-ins`, `My Add-ins`, `Upload My Add-in`, `Add from file`).

### macOS (Excel desktop)

Sideload by copying the manifest into Excel's add-in folder ([Microsoft docs](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-an-office-add-in-on-mac)):

```bash
cp manifest.prod.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
```

Then:
1. Quit Excel completely and reopen it
2. Go to **Insert → My Add-ins**
3. You should see **Pi for Excel**
4. Click **Open Pi**

> **Tip:** If the add-in doesn't appear, make sure the `wef/` folder exists. Create it if needed:
> ```bash
> mkdir -p ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef
> ```

### Windows (Excel desktop)

You can try to install and run this on Windows — it might work! Follow the [Microsoft sideloading docs](https://learn.microsoft.com/en-us/office/dev/add-ins/testing/sideload-office-add-ins-for-testing):

1. Open Excel
2. Go to **Insert → My Add-ins**
3. Choose **Upload My Add-in…**
4. Select `manifest.prod.xml`
5. Open **Pi for Excel**

---

## 3) First-run check

1. Open the taskpane (`Open Pi` button)
2. Connect a provider (see below)
3. Send a test prompt, e.g.:
   - `What sheet am I currently on?`
   - `Summarize my current selection`

If you get a response, install is complete.

---

## 4) Connect a provider

### Recommended (easiest): API key

For most users, API keys are the smoothest setup and usually do **not** need the proxy helper.

1. In Pi, run `/login` (or use the welcome screen)
2. Expand a provider row (OpenAI, Google Gemini, Anthropic, etc.)
3. Paste your API key
4. Click **Save**

### OAuth / account login (Anthropic, GitHub Copilot)

1. In `/login`, click **Login with …**
2. Complete login in the browser window that opens
3. Return to Excel and complete any prompt shown

If login fails with a CORS/network error, follow the next section.

---

## OAuth logins and CORS helper

Some OAuth/token endpoints are blocked by CORS inside Office webviews (especially on macOS WKWebView).

Typical symptoms:
- `Login was blocked by browser CORS`
- `Load failed`
- `Failed to fetch`

### What to do

1. Run a local HTTPS proxy helper on the same machine as Excel (defaults to `https://localhost:3003`):

```bash
npm run proxy:https
```

If the user is non-technical, a teammate/admin can run this step for them on their machine.

2. In Pi, open `/settings` → **Proxy**:
   - enable **Use CORS Proxy**
   - set URL to `https://localhost:3003`

3. Retry OAuth login

Notes:
- Keep the proxy URL on **HTTPS** (`https://...`), not HTTP.
- API-key providers generally work without proxy.
- If port `3003` is busy, run with another port and use that same URL in settings:

```bash
PORT=3005 npm run proxy:https
```

---

## Updates

If you installed with `manifest.prod.xml`, Pi for Excel loads from a hosted URL and most updates are automatic.

- Normal case: close/reopen Excel taskpane to pick up latest version.
- Rare case (manifest changes): download the new `manifest.prod.xml` and upload it again in Excel.

---

## Troubleshooting

### Pi does not appear in My Add-ins
- Re-open Excel and try again
- Ensure you uploaded `manifest.prod.xml` (not the localhost dev manifest)

### Taskpane opens but is blank
- Your network may block `https://pi-for-excel.vercel.app`
- Try a different network / VPN setting

### I installed, but changes are not visible
- Close and reopen Excel to clear cached taskpane state

### OAuth login still fails
- Confirm proxy is running and reachable at the exact URL in `/settings`
- Confirm proxy URL is `https://localhost:<port>` (not `http://`)
- Try API key auth as a fallback

---

## Developer setup (separate)

If you want to run from source (`localhost`, Vite, mkcert), use the root README: [Developer Quick Start](../README.md#developer-quick-start).
