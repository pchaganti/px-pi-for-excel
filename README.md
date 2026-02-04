# Pi for Excel

An open-source, multi-model AI sidebar add-in for Microsoft Excel — powered by [Pi](https://github.com/mariozechner/pi-coding-agent).

**Bring your own key. Free. Open source.**

## What is this?

Pi for Excel puts an AI assistant directly in your Excel sidebar. It can read your spreadsheet, write formulas, format cells, search data, and trace dependencies — all through natural conversation.

Unlike proprietary alternatives (Claude for Excel, Copilot), Pi for Excel:
- **Works with any LLM** — Anthropic, OpenAI, Google, local models via Ollama/vLLM
- **Keeps your data local** — the agent runs entirely in the browser; your spreadsheet data never leaves your machine (only the context you send to your chosen LLM provider)
- **Is free and open source** — no subscription, no per-seat pricing

## Features (v0.1.0)

- **7 Excel tools** — `get_workbook_overview`, `read_range`, `write_cells`, `search_workbook`, `modify_structure`, `format_cells`, `trace_dependencies`
- **Auto-context injection** — automatically reads around your selection and tracks changes between messages
- **Workbook blueprint** — sends a structural overview of your workbook to the LLM at session start
- **Multi-provider auth** — API keys, OAuth (Anthropic, OpenAI, Google), or reuse credentials from Pi TUI
- **Write verification** — automatically checks formula results after writing
- **Pi TUI interop** — sessions are stored in Pi-compatible format

## Quick Start

### Prerequisites
- Node.js 18+
- Microsoft Excel (desktop, macOS or Windows)
- [mkcert](https://github.com/FiloSottile/mkcert) for local HTTPS

### Setup

```bash
git clone https://github.com/tmustier/pi-for-excel.git
cd pi-for-excel

# Install dependencies
npm install

# Generate HTTPS certificates (required by Office add-ins)
mkcert -install  # one-time: trust the CA
mkcert localhost
mv localhost.pem cert.pem
mv localhost-key.pem key.pem

# Start dev server
npx vite --port 3000
```

### Sideload into Excel

**macOS:**
```bash
cp manifest.xml ~/Library/Containers/com.microsoft.Excel/Data/Documents/wef/
```

Then open Excel → Insert → My Add-ins → Pi for Excel (Dev).

**Windows:**
```bash
npx office-addin-debugging start manifest.xml desktop --app excel
```

### Configure an LLM provider

Click the ⚙️ settings button in the sidebar to add API keys, or:

1. If you already use [Pi TUI](https://github.com/mariozechner/pi-coding-agent), your credentials from `~/.pi/agent/auth.json` are loaded automatically in dev mode.
2. Click the 🔑 button to authenticate via OAuth (Anthropic, Google).
3. Paste an API key directly.

## Architecture

```
src/
├── taskpane.ts           # Entry — mounts ChatPanel, wires agent
├── boot.ts               # Lit class field fix + CSS
├── excel/helpers.ts       # Office.js wrappers + edge-case guards
├── auth/                  # CORS proxy, credential restore, provider mapping
├── tools/                 # 7 Excel tools (read, write, search, format, etc.)
├── context/               # Blueprint, selection auto-read, change tracker
├── prompt/system-prompt.ts # Model-agnostic system prompt builder
└── utils/format.ts        # Markdown tables, token truncation
```

The agent loop runs client-side in Excel's webview (WebView2 on Windows, WKWebView on Mac). Tool calls execute locally via Office.js — no server round-trips for Excel operations.

## Development

```bash
# Type-check
npx tsc --noEmit

# Build for production
npx vite build

# Validate manifest
npx office-addin-manifest validate manifest.xml
```

### CORS in development

The Vite dev server proxies API calls to LLM providers, stripping browser headers that would trigger CORS failures (notably Anthropic rejects requests with `Origin` headers). This is dev-only — production deployment will need a different solution.

## Roadmap

- [ ] Python code execution via Pyodide
- [ ] SpreadsheetBench evaluation (target >43%)
- [ ] Production CORS solution (service worker or hosted relay)
- [ ] Per-workbook instructions (like AGENTS.md)
- [ ] Chart creation and modification
- [ ] Named range awareness in formulas
- [ ] Conditional formatting rules
- [ ] Data validation
- [ ] Pi TUI ↔ Excel session teleport

## Prior Art

- [Claude for Excel](https://workspace.anthropic.com) — Opus 4.5, $20+/mo, 14 tools, ~43% SpreadsheetBench
- [Microsoft Copilot Agent Mode](https://techcommunity.microsoft.com/) — JS code gen + reflection, 57.2% SpreadsheetBench
- [Univer](https://univer.ai) — Canvas-based spreadsheet runtime, 68.86% SpreadsheetBench (different architecture)

## License

MIT
