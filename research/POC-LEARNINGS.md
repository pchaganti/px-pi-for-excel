# PoC Learnings — What to Bring Forward to v0.1.0

Compiled after building and validating the full PoC end-to-end inside Excel on macOS.

---

## 1. Office.js is the Right Call — But It Has Sharp Edges

**Confirmed: Claude for Excel uses Office.js too.** Same API surface, same limitations. Our structural advantage: tool calls are local (10–50ms vs 500ms+ cloud round-trip), data never leaves the device.

### What works well
- Read/write cells, formulas, number formats: rock solid
- Workbook overview (sheets, dimensions, headers): reliable
- Selection reading: works
- Named ranges CRUD: works
- Conditional formatting CRUD: works
- `onChanged` event listener: works, detected live edits
- Formula error detection via read-back values: works (e.g. `#DIV/0!`)

### What doesn't
- **`getDirectPrecedents()` fails on empty cells** — throws, doesn't return null. Must guard. On non-empty formula cells it works fine, so `trace_dependencies` is viable but needs defensive code.
- **Syntax-invalid formulas kill the entire batch** — if you write `[["=SUM(A1)", "=BROKEN+", "=A1*2"]]`, ALL three cells fail. Valid formulas that eval to errors (like `=1/0`) write fine, only the result is an error. v0.1.0 must either validate formula syntax client-side before writing or catch the batch error and attribute it to the bad formula.
- **`Range.address` returns sheet-local addresses** — you need to manually prepend the sheet name. Easy to forget.

### Implication for v0.1.0
- Wrap Office.js in a thin abstraction layer (`excel-helpers.ts`) that handles these edges: guarded `getDirectPrecedents`, always-qualified addresses, formula syntax pre-check.

---

## 2. The Webview is Surprisingly Capable

Every capability we tested works inside Excel's WKWebView:

| Capability | Status | Notes |
|------------|--------|-------|
| IndexedDB | ✅ | Persistent storage across sessions — Claude doesn't have this |
| CORS fetch | ✅ | OpenAI and Google direct. Anthropic needs proxy (rejects Origin header) |
| WASM | ✅ | Full WebAssembly support |
| Pyodide | ✅ | Python 3.12 with numpy + pandas in-browser. 10–20s cold start |
| Lit/web components | ✅ | After the tsgo class field fix |
| OAuth flows | ✅ | Popup-based PKCE works |

### Implication for v0.1.0
- **Pyodide is a real option** for v0.2.0 code execution — we don't need a server. Cold start is the main UX concern; could pre-load lazily after first render.
- **IndexedDB persistence** is a genuine differentiator. Claude loses everything between sessions. We can store conversation history, workbook fingerprints, user preferences.
- **No need for a companion server** for the core product. Client-side agent loop is sufficient.

---

## 3. CORS is Solvable But Requires Infrastructure

Three levels of CORS behavior across providers:

| Provider | Direct from browser? | Solution |
|----------|---------------------|----------|
| OpenAI | ✅ Yes | No proxy needed |
| Google | ✅ Yes | No proxy needed |
| Anthropic | ❌ No | Must strip `Origin` + browser headers via proxy |

### What we learned the hard way
- **Anthropic rejects requests with an `Origin` header** even when the `anthropic-dangerous-direct-browser-access` header is set. The request reaches the server but gets rejected by org-level CORS policy for OAuth tokens.
- **The proxy must strip 5 headers**: `origin`, `referer`, `sec-fetch-site`, `sec-fetch-mode`, `sec-fetch-dest`, plus `anthropic-dangerous-direct-browser-access`.
- **Fetch interceptor pattern works well**: monkey-patch `window.fetch` to rewrite URLs and strip headers. Clean, centralized, no per-call logic needed.

### Implication for v0.1.0
- **Dev: Vite proxy** (already built, works perfectly).
- **Production: need a real solution.** Options: (a) bundled service worker proxy, (b) `corsproxy.io`-style public proxy (privacy concern), (c) user self-hosts a tiny proxy, (d) we host a free relay. Decision needed before v0.1.0 ships.
- The fetch interceptor pattern should be extracted into a reusable module (`cors-proxy.ts`).

---

## 4. pi-mono Integration Works — With One Critical Fix

### The Lit class field shadowing bug
`tsgo` (the Go TypeScript compiler used by pi-web-ui's build) does NOT respect `useDefineForClassFields: false`. It emits native class field declarations that shadow Lit's `@state()` / `@property()` prototype accessors. Lit's dev-mode check catches this and throws.

**Fix**: monkey-patch `ReactiveElement.prototype.performUpdate` to auto-delete own properties that shadow prototype accessors before the first update. ~15 lines, handles ALL Lit components.

**This fix must ship with v0.1.0.** It's not optional — without it, no pi-web-ui component renders.

### What imports cleanly
- `Agent` from `pi-agent-core` ✅
- `getModel`, `getOAuthProvider`, `getOAuthProviders` from `pi-ai` ✅
- `ChatPanel`, `AppStorage`, `IndexedDBStorageBackend`, all stores from `pi-web-ui` ✅
- `ApiKeyPromptDialog`, `SettingsDialog`, `ProvidersModelsTab` from `pi-web-ui` ✅

### What needed workarounds
- `pi-web-ui/app.css` must be imported before any Lit components mount (Tailwind v4)
- `lit`'s `render()` function is the correct way to mount `ChatPanel` — not `document.appendChild`
- `setAppStorage()` must be called before `chatPanel.setAgent()` — otherwise settings/keys aren't available

### Implication for v0.1.0
- Keep the Lit fix as a top-level boot script that runs before any imports.
- Document the pi-mono dependency versions we're built against (currently v0.51.0 source / v0.51.5 npm).
- Consider vendoring or pinning exact versions — pi-mono is actively developed.

---

## 5. Auth: Multi-Provider Works, But the UX Flow Matters

### What we proved
- **Anthropic OAuth** (subscription, free): works end-to-end via PKCE popup
- **OpenAI Codex OAuth**: token loads from `auth.json`, works with `chatgpt.com/backend-api`
- **Google Gemini CLI / Antigravity OAuth**: auto-refresh works
- **API keys** (any provider): work via Settings dialog
- **pi's `auth.json` reuse**: Vite plugin serves `~/.pi/agent/auth.json` — existing TUI credentials work instantly in the add-in

### Key insight: provider ID ≠ API provider name
The mapping is non-obvious and easy to get wrong:
```
openai-codex → openai-codex (NOT openai — different base URL!)
google-gemini-cli → google
google-antigravity → google
anthropic → anthropic
github-copilot → github-copilot
```
Getting this wrong routes requests to the wrong endpoint. We burned real time on this.

### Implication for v0.1.0
- **Provider mapping must be centralized** in one file with clear documentation.
- **Two auth paths**: (1) OAuth login (free, uses subscription), (2) API key (BYOK). Both should work from the sidebar.
- **`auth.json` reuse is dev-only** — production won't have access to the filesystem. But it's a great DX for development.
- **Token refresh must be automatic and silent** — the user should never see an expired token error if we have a refresh token.

---

## 6. Tool Architecture Learnings

### From building `read_range` and `write_cells`

**`toolsFactory` is the right hook.** It receives agent, agentInterface, artifactsPanel, and runtimeProvidersFactory. Returns `AgentTool[]`. Tools are set on the agent automatically.

**Tool response format matters.** The LLM reads the tool result. Key principles:
- **Markdown tables are excellent** for tabular data — LLMs are trained on them, they're compact, they're human-readable in tool call UI.
- **Include cell addresses** in the response so the LLM can reference them in its reply ("I put the total in E15").
- **Auto-verify writes** — read back after writing, report errors prominently. Don't rely on the LLM to ask for verification.
- **Error attribution is critical** — when a batch write fails, tell the LLM which formula caused it. "Error writing cells: The formula in row 3, col 2 (`=BROKEN+`) has invalid syntax."

**TypeBox schemas work well** for tool parameters. The `Type.Object`, `Type.String`, `Type.Array` pattern is clean and generates good JSON Schema for the LLM.

### From studying Claude's 14 tools

**Claude's flat-dict format for `get_cell_ranges` is genuinely well-designed:**
- Empty cells omitted (huge token savings)
- Formula cells as `[value, formula]` tuples
- Styles deduplicated (cells with identical formatting share one key)
- BUT: it's verbose for large reads. Our markdown table mode is better for "just show me the data."

**Two read modes in one tool > two separate tools.** Claude has `get_cell_ranges` (detailed) and `get_range_as_csv` (compact). The LLM often picks the wrong one. A single `read_range` with a `mode` parameter is cleaner.

### Implication for v0.1.0
- 7 tools is the right number. Not 14 (too many decisions for the LLM) and not 2 (too limited).
- Tool responses should be token-conscious. Use compact formats by default, detailed on request.
- Every write tool must read-back and verify.
- Include `mode` parameter on `read_range` for compact vs. detailed.

---

## 7. System Prompt is the Product

The system prompt defines the agent's personality, workflow, and conventions. Claude's prompt encodes financial modeling conventions (blue text for inputs, parentheses for negatives) that users love.

### What should go in ours
1. **Identity**: "You are Pi, an AI assistant embedded in Excel."
2. **Workflow**: Always read first. Never guess. Verify writes.
3. **Formula philosophy**: Formulas over hardcodes. Assumptions in separate cells.
4. **Read vs. write discipline**: Analysis = read only + chat. Modification = only when asked.
5. **Planning**: Complex tasks → present plan → get approval → execute.
6. **Available tools**: List with one-line descriptions.
7. **Conventions**: Number formatting, error handling, formula style.

### What should NOT go in the system prompt
- **Workbook-specific context** — inject via `transformContext`, not hardcoded.
- **Long examples** — waste tokens every turn. Use tool descriptions instead.
- **Provider-specific instructions** — the prompt should work across models.

### Implication for v0.1.0
- System prompt should be ~500 tokens (not 2000+). Every token is paid on every turn.
- Make it a builder function, not a string literal — allows conditional sections.
- Financial conventions should be configurable (not everyone works in finance).

---

## 8. Context Injection is the Key Differentiator

Claude pushes thin metadata (sheet names + dimensions). Microsoft pushes rich structure (spatial layout + formula graph). Microsoft scores 57.2% vs Claude's 43%.

### What we should auto-inject

**At session start** (via `transformContext`, first message only):
- Workbook blueprint: sheet names, dimensions, header rows, named ranges, table inventory
- This is MORE than Claude pushes, approaching Microsoft's richness

**Per user message** (via `transformContext`):
- Active sheet name + selected range
- **Auto-read of selection context**: Read ±5 rows around the selection, full columns of the data region. Claude does NOT do this — it knows the selection but doesn't auto-read content. This means our agent can answer "what's wrong with this formula?" without a tool call.
- Change tracker: "Since your last message, the user edited B5, C12 on Sheet1"

### Implication for v0.1.0
- `transformContext` is the hook. It runs before every LLM call.
- Build three injectors: blueprint (once), selection context (every message), change tracker (every message).
- This is where we win. The agent should feel like it can "see" what you're looking at.

---

## 9. Dev Workflow Learnings

### Sideloading on macOS
- **Path**: `~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/manifest.xml`
- **`npx office-addin-debugging start manifest.xml desktop --app excel`** is more reliable than manual placement
- **Manifest validation**: `npx office-addin-manifest validate manifest.xml` catches silent schema errors
- **Three common manifest errors**: (1) missing `<SupportUrl>`, (2) missing `<Icon>` in `<Group>`, (3) version must be 4-part (`1.0.0.0`)
- After changing the manifest, must fully quit + reopen Excel

### HTTPS requirement
- Office add-ins REQUIRE HTTPS, even for localhost dev
- `mkcert` works perfectly: `mkcert localhost` → `cert.pem` + `key.pem`
- Must install CA: `mkcert -install` (adds to system keychain)
- **Production**: Microsoft Marketplace handles certs. Self-hosted needs Let's Encrypt.

### Pi's bash executor + background processes
- Background processes inherit stdout/stderr pipes → `close` event never fires → pi hangs
- **Fix**: `(cmd >/dev/null 2>&1 </dev/null &)` — subshell isolates file descriptors
- Affected us when starting Vite dev server from pi

### Implication for v0.1.0
- Document the dev setup thoroughly (mkcert, sideloading, manifest validation)
- Include a `dev:start` script that handles HTTPS + sideloading
- Manifest should be generated or validated in CI

---

## 10. What Makes This Better Than Claude for Excel

Even at v0.1.0, we have structural advantages:

| Advantage | Why it matters |
|-----------|---------------|
| **Free + BYOK** | $0 vs $20+/mo. Any model, any provider. |
| **Persistent sessions** | IndexedDB survives across sessions. Claude loses everything. |
| **Richer context push** | Blueprint with headers + named ranges + tables vs Claude's thin sheet metadata. |
| **Selection auto-read** | Agent already knows what you're looking at. Claude needs a tool call. |
| **`trace_dependencies`** | One tool call vs Claude's dozens for deep formula trees. |
| **Local tool calls** | 10–50ms vs 500ms+. Feels instant. |
| **Multi-model** | Claude, GPT, Gemini, Codex, open models. |
| **Open source** | Extensible, auditable, forkable. |
| **Data stays on device** | Only LLM calls leave the machine. Spreadsheet data never goes to a third-party server (except in the LLM prompt itself). |

### What Claude does better (and we should aim to match)
| Claude advantage | Our response |
|-----------------|-------------|
| Python code execution | Pyodide in v0.2.0 (validated in PoC) |
| Web search | Brave Search skill or similar in v0.2.0 |
| File upload + processing | SheetJS + pdf.js client-side in v0.2.0 |
| Polished UI + brand trust | Focus on tool quality, let the interface be pi-web-ui |
| `copy_to` (fill-handle semantics) | Implement in v0.2.0 |

---

## Summary: The Three Highest-Leverage Investments for v0.1.0

1. **Context injection** — auto-inject blueprint at session start + selection context per message. This is the single biggest accuracy lever (Microsoft proved it with their 57.2% score).

2. **Tool quality** — 7 well-designed tools with auto-verification, clear error attribution, and compact token-efficient responses. The agent-facing interface IS the product.

3. **System prompt** — concise, model-agnostic, with clear workflow instructions. Not too long (every token costs every turn), not too short (the agent needs to know the rules).

Everything else (UI polish, Pyodide, web search, templates) can wait.
