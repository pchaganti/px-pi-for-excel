# pi-for-excel-python-bridge

Local HTTPS Python / LibreOffice bridge helper for Pi for Excel.

## Usage

```bash
npx pi-for-excel-python-bridge
```

This command:

1. Ensures `mkcert` exists (installs via Homebrew on macOS if missing)
2. Creates certificates in `~/.pi-for-excel/certs/` when needed
3. Starts the bridge at `https://localhost:3340`

Default mode is `stub` (safe simulated responses).

For real local execution mode:

```bash
PYTHON_BRIDGE_MODE=real npx pi-for-excel-python-bridge
```

Then in Pi for Excel:

1. Run `/experimental python-bridge-url https://localhost:3340`
2. (Optional) run `/experimental python-bridge-token <token>` if you set `PYTHON_BRIDGE_TOKEN`

## Publishing (maintainers)

Package source lives in `pkg/python-bridge/`.

Before packing/publishing, `prepack` copies runtime files from repo root:

- `scripts/python-bridge-server.mjs`

Publish from this directory:

```bash
cd pkg/python-bridge
npm publish
```
