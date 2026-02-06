# Install (recommended)

Pi for Excel is an **Excel taskpane add-in**. Excel loads it as a small website from an HTTPS URL.

This guide is the **non-technical install** path:
- no git
- no Node
- no mkcert
- no terminal

## 1) Download the manifest

Download **`manifest.prod.xml`** (production manifest):

- https://pi-for-excel.vercel.app/manifest.prod.xml

> If the link 404s, the hosted build hasn’t been published yet.

## 2) Install in Excel

### macOS (Excel desktop)

1. Open Excel
2. Go to **Insert → Add-ins → My Add-ins**
3. Choose **Add from file…** (or **Upload My Add-in…** depending on Excel version)
4. Select `manifest.prod.xml`
5. You should see **Pi for Excel** appear. Click **Open Pi**.

### Windows (Excel desktop)

1. Open Excel
2. Go to **Insert → Add-ins → My Add-ins**
3. Choose **Upload My Add-in…**
4. Select `manifest.prod.xml`

## 3) First run

When Pi for Excel opens, connect a provider:
- Use `/login` to add an API key or sign in.
- Use `/model` (or click the model name in the bottom status bar) to switch models.

## Updates

### Automatic updates (hosted build)

If you installed using `manifest.prod.xml`, then Pi for Excel’s UI is loaded from a hosted HTTPS URL.

- New versions are deployed to that same URL.
- Typically, you get updates automatically the next time you open the taskpane.
- If you seem “stuck” on an old version, close and reopen Excel.

### When you need to reinstall the manifest

Rarely, a new version may require a manifest change (permissions, commands, etc.).
In that case you’ll download a new `manifest.prod.xml` and re-upload it.

## Troubleshooting

- **Blank taskpane / doesn’t load**
  - You may be on a network that blocks the host, or the hosted build URL changed.

- **Login fails with “CORS / Load failed” (macOS especially)**
  - Some providers (OAuth/subscription flows) require the local HTTPS proxy helper.
  - See README → “CORS / proxy”.
