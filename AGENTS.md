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
