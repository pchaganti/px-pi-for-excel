# Upcoming (open issues digest)

Purpose: keep a lightweight, *engineering-oriented* digest of open GitHub issues and the likely direction of the project, so refactors/cleanup are aligned with where we’re going.

> Source of truth: GitHub issues. This file is a curated summary + implications, not a replacement.

---

## Working assumptions (tentative)

These reflect current direction and may change as we prototype.

- **Workbook identity/scoping:** likely **local-only by default** (to reduce risk of sensitive metadata traveling with a workbook). We’re prototyping an **opt-in workbook-attached ID** (e.g. a random GUID) if it proves materially better.
- **Artifacts/files:** aim for a **global workspace** plus **per-workbook namespaces/tags**. Implementation likely uses **File System Access API** when available, with **OPFS** fallback for Mac Excel/WKWebView.
- **Extensibility:** **user-supplied code in hosted builds is a core requirement.**
  - **V1:** *paste code* only → store in IndexedDB, load via Blob URL + dynamic `import()` (no `eval`).
  - **V2:** add *install from URL* (GitHub raw / releases) and potentially *package sources* (npm), with explicit enable + clear warnings/permissions.

---

## Product semantics & scoping (workbooks, sessions, instructions)

### #31 — Design: multi-workbook semantics + per-workbook chats
https://github.com/tmustier/pi-for-excel/issues/31

**What it’s asking:** define default behavior when multiple workbooks are opened. Today sessions are effectively global; this should become workbook-scoped.

**Key design needs:**
- A stable **workbook identity** (survives restart/rename/move as much as possible).
- Session UX that makes workbook association obvious (filtering, warnings on cross-workbook resume).

**Implication:** workbook identity becomes a foundational primitive (also needed by #23, #30, #32).

---

### #23 — Sessions: session history UI + resume per workbook
https://github.com/tmustier/pi-for-excel/issues/23

**What it’s asking:** first-class session history UI + tie session metadata to workbook identity.

**Notes:** we already have persistence and a resume overlay; the missing piece is workbook association + discoverable UI entry point.

---

### #30 — Design: workbook-scoped agent instructions (AGENTS.md equivalent)
https://github.com/tmustier/pi-for-excel/issues/30

**What it’s asking:** a workbook-scoped instruction store (“conventions / do-don’t / assumptions”) with UI to edit + audit.

**Key decision:** where it lives:
- IndexedDB (local, private)
- inside workbook (travels with file)
- hybrid

**Implication:** pushes us toward a general “workbook-scoped metadata store” abstraction.

---

## Trust, safety, auditability

### #6 — UX: change approval UI + clickable cell citations
https://github.com/tmustier/pi-for-excel/issues/6

**What it’s asking:**
- tool-level approval flow for potentially destructive actions
- clickable citations in assistant messages

**Status note:** clickable cell references have shipped (partial completion of this issue). Approval UI remains.

**Implication:** approval UI will be much easier if tool calls/results expose structured metadata (see cleanup plan lever: `ToolResultMessage.details`).

---

### #28 — Auditability: diff view + audit log for agent changes
https://github.com/tmustier/pi-for-excel/issues/28

**What it’s asking:** record before/after for mutating operations, render diffs in tool cards, export audit log.

**Implication:**
- implies a centralized “tool execution wrapper” to capture diffs consistently
- implies a shared diff model that can be rendered in UI and exported

---

### #27 — Design: YOLO mode + workbook recovery/versioning strategy
https://github.com/tmustier/pi-for-excel/issues/27

**What it’s asking:** safe recovery for low-confirmation workflows.

**Dependencies:**
- feasibility research for Office.js export/snapshot/undo
- strongly related to audit log (#28) — same core data can drive both

---

### #62 — Security follow-up: sunset legacy OAuth localStorage migration path
https://github.com/tmustier/pi-for-excel/issues/62

**What it’s asking:** remove the remaining compatibility path for legacy OAuth `localStorage` migration.

**Key hotspots:**
- `src/auth/oauth-storage.ts` should read/write IndexedDB settings only
- docs/comments should no longer describe a localStorage OAuth fallback

**Implication:** keep credential persistence simple and auditable before expanding higher-risk surfaces (#24, #25, #32, #3).

---

## Context management

### #20 — Auto-compaction: manage context window budget for long conversations
https://github.com/tmustier/pi-for-excel/issues/20

**What it’s asking:** token budgeting + automatic compaction; preserve a “tail” window; keep archived messages available in UI without re-entering LLM context.

**Status note:** `/compact` has been upgraded recently (now a dedicated compaction card message + uses agent streamFn/api key resolution correctly). Auto-trigger + token budgeting are now implemented (Pi-style threshold). Archived-history UX is still TBD.

**Implication:**
- pushes toward tracking per-message cost/tokens and storing an “archived history” separately from the active LLM context
- interacts with artifacts (#32) because verbose reads could be persisted as artifacts rather than staying in LLM context

**Policy reference:** see [`docs/context-management-policy.md`](./context-management-policy.md) for the active cache-safe rollout slices (payload snapshots, progressive tool disclosure, tool-result shaping, workbook-context invalidation).

---

## Agent interface / platform design

### #14 — Design: agent interface — tools, system prompt, context strategy
https://github.com/tmustier/pi-for-excel/issues/14

**What it’s asking:** a holistic design for what the model sees (tools, prompt strategy, context injection, progressive disclosure, compaction, blueprint refresh, conventions).

**Status note (based on issue comments + current code):**
- Tool consolidation + conventions module have shipped.
- Blueprint invalidation after structural changes has shipped.
- Auto-compaction and progressive disclosure are split into dedicated issues (#20, #18).

**Implication:** treat #14 as an umbrella/architecture narrative issue; keep concrete work tracked in the more focused issues.

---

## Tools & Excel capability expansion

### #18 — Tool inventory: Excel JS API capabilities not yet exposed
https://github.com/tmustier/pi-for-excel/issues/18

**What it’s asking:** inventory + tiering / progressive disclosure for future tools.

**Comment updates in issue:** tool consolidation happened, and tiering should apply to *new tools only* (charts/tables/validation etc.).

**Implication:** a capability registry (tools grouped into tiers) should exist at one central point, not scattered across prompt/UI/tool code.

---

### #22 — view_settings: expand with sheet visibility, standard width, and activate
https://github.com/tmustier/pi-for-excel/issues/22

**What it’s asking:** add actions:
- hide/show/very-hide sheet
- set standard width
- activate sheet
- extend `get` output

**Implication:** this is a good test-case for keeping tool registration + UI input humanization in sync (right now those mappings drift in multiple files).

---

### #29 — Explainability: trace precedents/dependents + explain formula UX
https://github.com/tmustier/pi-for-excel/issues/29

**What it’s asking:** dependents tracing and an “explain this formula” workflow; UI should allow navigation.

**Implication:** suggests a shift from “text-only tool outputs” to “structured graph/tree outputs” rendered interactively. Again: `details` metadata is the bridge.

---

### #19 — Decide: integrate with Excel native Style API or keep our own style system
https://github.com/tmustier/pi-for-excel/issues/19

**What it’s asking:** decide between:
- A) adopt native Excel styles
- B) keep our style resolver (current)
- C) hybrid: keep our resolver + sync `pi.*` styles into workbook for inspectability

**Notable comments in issue:**
- header style uses hardcoded hex (theme mismatch risk)
- header alignment for number columns may need variants or style inheritance

**Implication:**
- don’t bake too much of the current style system into tool/UI assumptions; keep it behind `conventions/` boundaries
- if we ever sync to native styles, we’ll want tooling that can *read back* “what was applied” in a stable way

---

## External tools / bridges / extensibility

### #13 — Extensions API: design & build-out
https://github.com/tmustier/pi-for-excel/issues/13

**What it’s asking:** extension manager UI + dynamic loading + (critically) allow extensions to register tools.

**Implication:** this is a strong argument for:
- a centralized tool registry that can be extended dynamically
- a clear permission model + lifecycle hooks

---

### #24 — Tools: enable web search + MCP integration
https://github.com/tmustier/pi-for-excel/issues/24

**What it’s asking:** web search + MCP client support + a “skills” concept (bundled instructions + tools + optional UI).

**Implication:** “skills” and “extensions” are converging concepts; we should avoid building two separate plugin systems.

---

### #25 — Tools: Python runner + LibreOffice bridge
https://github.com/tmustier/pi-for-excel/issues/25

**What it’s asking:** add a Python/LibreOffice execution capability via a local bridge or remote service.

**Implication:** strongly coupled to #26 security + #32 artifacts (Python output likely becomes artifacts/files).

---

### #3 — Explore tmux tool via local bridge (Excel add-in)
https://github.com/tmustier/pi-for-excel/issues/3

**What it’s asking:** local helper for tmux/shell-like interaction.

**Implication:** also drives the “local bridge” architecture shared with #25 and possibly #24 MCP.

---

### #32 — Artifacts: file upload + assistant workspace (create/share/edit files)
https://github.com/tmustier/pi-for-excel/issues/32

**What it’s asking:** a Files/Artifacts panel + tool surface (`list/read/write/delete`) + (optional) local workspace folder.

**Important implementation comment in issue:**
- recommended backend strategy:
  - **File System Access API** (`showDirectoryPicker`) when available (Windows/Web)
  - **OPFS** fallback for WKWebView (Mac Excel)
- upstream `pi-web-ui` already includes substantial attachment infrastructure (pdf/docx/pptx/text/image handling), but it’s not yet wired into our sidebar input.

**Implication:**
- we should treat “artifacts/files” as a first-class subsystem (store, UI, tools, context injection)
- bundling/perf matters: PDF/document handling pulls large deps (pdfjs/xlsx)

---

## UI polish

### #12 — UX: decide what to put in the header bar
https://github.com/tmustier/pi-for-excel/issues/12

**What it’s asking:** decide whether the header is used for session switcher, workbook indicator, settings, etc. or removed entirely.

**Notable comment:** toast offset was changed when header was emptied; if header returns, toast positioning may need adjustment.

---

### #21 — Show thinking duration: “Thought for Xm Xs” on completed thinking blocks
https://github.com/tmustier/pi-for-excel/issues/21

**What it’s asking:** per-thinking-block timing + DOM patching since the component is upstream.

**Implication:** keep monkey patches isolated (fits current `src/compat/*` convention).

---

## Conventions & configuration

### #1 — Decide where to store/expose spreadsheet conventions
https://github.com/tmustier/pi-for-excel/issues/1

**Status note:** Phase 1 is implemented (`src/conventions/*`, prompt now references named styles). Remaining scope is user-configurable + workbook-scoped.

**Implication:** dovetails with #30 workbook instructions; likely the cleanest approach is a workbook-scoped instruction/config store with UI.

---

## Distribution

### #16 — Distribution: non-technical install (hosted build + prod manifest)
https://github.com/tmustier/pi-for-excel/issues/16

**What it’s asking:** a path that requires no Node/mkcert/terminal.

**Implication:** any solution relying on a local helper (proxy/bridge) needs a story for non-technical users.

---

## Cross-cutting implications for cleanup / refactor work

From the issues above, the most leverage comes from making a few primitives explicit and stable:

1) **Workbook identity + scoping**
- needed by sessions, workbook instructions, artifacts, audit logs
- suggests a `workbookContext` module that can provide `{ id, name, url? }` and is safe across hosts

2) **A single extensible capability registry**
- tools + tool tiers + UI renderers + humanizers should be registered in one place
- should be designed to allow extension/skill/MCP-based injection later

3) **Structured tool results (`details`)**
- unlocks approval UI, diffs/audit log, interactive graphs/trees, better tool cards

4) **A safe “external capability” boundary**
- web search, MCP, bridges, filesystem all need opt-in gating + auditability (ties to #26)

5) **UI architecture that supports new panels**
- Files panel, Sessions panel, Workbook Instructions editor likely require more than overlays
- suggests a small “sidebar tabs / panels” framework rather than ad-hoc overlays
