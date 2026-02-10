# AGENTS.md

Notes for agents working in this repo:

- **Tool behavior decisions live in `src/tools/DECISIONS.md`.** Read it before changing tool behavior (column widths, borders, overwrite protection, etc.).
- **UI architecture lives in `src/ui/README.md`.** Read it before touching CSS or components — especially the Tailwind v4 `@layer` gotcha (unlayered resets clobber all utilities).
- **Docs index:** `docs/README.md` (mirrors Pi's docs layout).
- **Model registry freshness:** check `docs/model-updates.md` → if **Last verified** is > 1 week ago, update Pi deps + re-verify pinned model IDs before changing model selection UX.

## High-leverage repo conventions (keep consistent)

### Tool registry is the single source of truth
- Core tool names + construction live in `src/tools/registry.ts` (`CORE_TOOL_NAMES`, `CoreToolName`, `createCoreTools()`).
- **Do not** create new tool-name lists in UI/prompt/docs — import `CORE_TOOL_NAMES`.
- When adding/removing a core tool, update in the same PR:
  - `src/tools/registry.ts`
  - `src/ui/tool-renderers.ts` (renderer registration)
  - `src/ui/humanize-params.ts` (input humanizers)
  - `src/prompt/system-prompt.ts` (documented tool list), if applicable

### Structured tool results (`ToolResultMessage.details`) — additive metadata
- Tools should keep human-readable markdown in `result.content`.
- Put stable, machine-readable metadata in `result.details` (range addresses, blocked state, error counts, etc.).
- **Compatibility rule:** prefer `details` in the UI, but keep a fallback for older persisted sessions that have no `details`.
- Centralize types/guards in `src/tools/tool-details.ts` and reuse them in tools + renderers.

### Workbook identity + per-workbook session restore
- Workbook identity is **local-only** and must never persist raw `Office.context.document.url`.
  - Use `getWorkbookContext()` from `src/workbook/context.ts` (returns hashed IDs like `url_sha256:<hex>`).
- Session↔workbook mapping is stored in `SettingsStore` (not session metadata).
  - Use helpers in `src/workbook/session-association.ts` (versioned keys `*.v1.*`).

### Security / HTML sinks
- Avoid `innerHTML` for any user/tool/session data.
  - Prefer DOM APIs, or escape with `src/utils/html.ts` (`escapeHtml`, `escapeAttr`).
- Markdown safety is enforced by `installMarkedSafetyPatch()` (`src/compat/marked-safety.ts`).
  - Don’t re-enable unsafe link protocols or inline images without a security review.
- The local CORS proxy (`scripts/cors-proxy-server.mjs`) has an **origin allowlist**. Don’t loosen it to `*`.

### Bundle hygiene (Office WebView)
- Avoid Node-only imports and side-effect barrel imports that defeat tree-shaking.
- When changing imports/deps, run `npm run build` and sanity-check:
  - output chunk sizes (and any newly emitted large assets)
  - Vite “externalized for browser compatibility” warnings

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
- `npm run check` (lint + typecheck)
- `npm run build`
- `npm run test:models`
- Manual Excel smoke test when changes touch session persistence, tools, auth, or UI wiring

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
