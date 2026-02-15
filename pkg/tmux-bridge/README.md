# pi-for-excel-tmux-bridge

Local HTTPS tmux bridge helper for Pi for Excel.

## Usage

```bash
npx pi-for-excel-tmux-bridge
```

This command:

1. Ensures `mkcert` exists (installs via Homebrew on macOS if missing)
2. Creates certificates in `~/.pi-for-excel/certs/` when needed
3. Starts the bridge at `https://localhost:3341`

Default mode is `stub` (safe in-memory simulator).

For real tmux mode:

```bash
TMUX_BRIDGE_MODE=tmux npx pi-for-excel-tmux-bridge
```

Then in Pi for Excel:

1. Run `/experimental on tmux-bridge`
2. Run `/experimental tmux-bridge-url https://localhost:3341`
3. (Optional) run `/experimental tmux-bridge-token <token>` if you set `TMUX_BRIDGE_TOKEN`

## Publishing (maintainers)

Package source lives in `pkg/tmux-bridge/`.

Before packing/publishing, `prepack` copies runtime files from repo root:

- `scripts/tmux-bridge-server.mjs`

Publish from this directory:

```bash
cd pkg/tmux-bridge
npm publish
```
