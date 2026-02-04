
# Scaffold v0.1.0 — Pi for Excel

Build the real v0.1.0 project structure alongside the existing PoC. The PoC stays as reference; v0.1.0 lives at the project root with `src/`.

## Architecture
- Root-level `package.json`, `vite.config.ts`, `tsconfig.json`, `manifest.xml`
- `src/` contains all source code
- Bring forward all PoC learnings (Lit fix, CORS proxy, auth, Office.js patterns)
- 7 tools, context injection, system prompt

## File Structure
```
pi-for-excel/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── manifest.xml
├── assets/icon-*.png
├── src/
│   ├── taskpane.html
│   ├── taskpane.ts           # Entry point — mount ChatPanel, wire everything
│   ├── boot.ts               # Lit class field fix + CSS import
│   ├── excel/
│   │   └── helpers.ts        # Office.js wrappers, address parsing
│   ├── auth/
│   │   ├── provider-map.ts   # Centralized provider ID → API provider mapping
│   │   ├── cors-proxy.ts     # Fetch interceptor for CORS
│   │   └── restore.ts        # Auto-restore credentials from auth.json + localStorage
│   ├── tools/
│   │   ├── index.ts          # createAllTools() factory
│   │   ├── get-workbook-overview.ts
│   │   ├── read-range.ts
│   │   ├── write-cells.ts
│   │   ├── search-workbook.ts
│   │   ├── modify-structure.ts
│   │   ├── format-cells.ts
│   │   └── trace-dependencies.ts
│   ├── context/
│   │   ├── blueprint.ts      # Build workbook blueprint
│   │   ├── selection.ts      # Auto-read around user's selection
│   │   └── change-tracker.ts # Track user edits between messages
│   ├── prompt/
│   │   └── system-prompt.ts  # System prompt builder
│   └── utils/
│       └── format.ts         # Markdown table formatting, cell address utils
```

## Goals
- [x] Project config: package.json, tsconfig.json, vite.config.ts, manifest.xml
- [x] Boot + HTML: boot.ts (Lit fix), taskpane.html
- [x] Excel helpers: src/excel/helpers.ts
- [x] Format utils: src/utils/format.ts
- [x] Auth: provider-map.ts, cors-proxy.ts, restore.ts
- [x] Tools: all 7 + index.ts
- [x] Context: blueprint.ts, selection.ts, change-tracker.ts
- [x] System prompt: system-prompt.ts
- [x] Main entry: taskpane.ts (wire everything)
- [x] Icons: placeholder PNGs for 16/32/80/128px
- [x] HTTPS certs: mkcert localhost (key.pem, cert.pem)
- [x] Build: npm install ✅, tsc --noEmit ✅, vite build ✅ (6.5MB dist)
  - Fixed: CustomProvidersStore missing from AppStorage constructor
  - Fixed: `performUpdate` protected access → cast to `any`
  - Fixed: `@smithy/node-http-handler` imports `Readable` from `stream` → added stub + rollup external
- [x] Dev server: `npx vite --port 3000` starts, serves on https://localhost:3000
- [x] Installed frontend-design skill from anthropics/skills repo
- [x] README: quick start, architecture, roadmap, prior art
- [x] Manifest validation: fixed version `0.1.0.0` → `1.0.0.0` (must be ≥1.0)
- [x] Sideloaded manifest to `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/`
- [x] Dev server verified: `https://localhost:3000/src/taskpane.html` serves correctly
- [x] Git commit `4d1aec3` + pushed to origin/main
- [~] UI review & polish — deferred to dedicated design task (not part of scaffold)
