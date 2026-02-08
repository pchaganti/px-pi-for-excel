# AGENTS.md

Notes for agents working in this repo:

- **Tool behavior decisions live in `src/tools/DECISIONS.md`.** Read it before changing tool behavior (column widths, borders, overwrite protection, etc.).
- **UI architecture lives in `src/ui/README.md`.** Read it before touching CSS or components — especially the Tailwind v4 `@layer` gotcha (unlayered resets clobber all utilities).
- **Docs index:** `docs/README.md` (mirrors Pi's docs layout).
- **Model registry freshness:** check `docs/model-updates.md` → if **Last verified** is > 1 week ago, update Pi deps + re-verify pinned model IDs before changing model selection UX.

## TypeScript typing policy (python-typing spirit)

- Prefer fixing types over silencing the checker.
- **No `// @ts-ignore`**. If absolutely necessary, use **`// @ts-expect-error -- <reason>`** and leave a real explanation.
- Avoid **explicit `any`** / `as any` (lint warns). Prefer:
  - specific types when known
  - unions for multiple shapes
  - `unknown` when you must accept anything (then narrow)
  - generics / `Record<string, …>` / discriminated unions
- Avoid non-null assertions (`thing!`) when practical (lint warns). Prefer runtime checks + early throws.

Verification helpers:
- `npm run typecheck`
- `npm run lint`

Pre-commit hook:
- Runs both checks automatically (see `.githooks/pre-commit`, installed via `npm install`).
- Bypass when needed: `git commit --no-verify`

## Excel Add-in dev: sideloaded manifest gotcha

Excel Mac loads the add-in from a **sideloaded manifest** stored at:
```
~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/{add-in-id}.manifest.xml
```

This file is **separate from** the repo's `manifest.xml`. If local CSS/JS changes aren't appearing in the sidebar despite the Vite dev server running correctly:

1. **Check the sideloaded manifest first.** It may point to a production URL (e.g. `https://pi-for-excel.vercel.app/…`) instead of `https://localhost:3000/…`.
2. Fix it by copying the repo manifest over: `cp manifest.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/a1b2c3d4-e5f6-7890-abcd-ef1234567890.manifest.xml`
3. Quit Excel fully and reopen.

If the manifest URL is correct and changes still don't appear, clear the WKWebView cache:
```
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/WebKit/
rm -rf ~/Library/Containers/com.microsoft.Excel/Data/Library/Caches/WebKit/
```
Then quit + reopen Excel.
