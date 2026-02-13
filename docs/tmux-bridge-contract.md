# Tmux bridge contract (v1)

Status:
- Add-in adapter implemented in `src/tools/tmux.ts`
- Local bridge scaffold implemented in `scripts/tmux-bridge-server.mjs`

The bridge supports two modes:
- `stub` (default): in-memory tmux simulation for development/testing (does not execute shell commands)
- `tmux`: real tmux subprocess backend with guardrails

## Availability and gating

The `tmux` tool remains registered (stable tool list / prompt caching), but execution is blocked unless all gates pass:

1. `/experimental on tmux-bridge`
2. `tmux.bridge.url` is configured (via `/experimental tmux-bridge-url <url>`)
3. bridge `GET /health` returns success

The gate is checked on each tool execution (defense in depth).

## Local bridge quickstart

```bash
# Stub mode (safe default)
npm run tmux:bridge:https

# Real tmux mode
TMUX_BRIDGE_MODE=tmux npm run tmux:bridge:https
```

Then in the add-in:

```bash
/experimental on tmux-bridge
/experimental tmux-bridge-url https://localhost:3337
/experimental tmux-status
```

Optional auth token:

```bash
TMUX_BRIDGE_TOKEN=your-secret npm run tmux:bridge:https
```

Store the same token for the tool adapter:

```bash
/experimental tmux-bridge-token <token>
```

(setting key: `tmux.bridge.token`)

## Endpoints

- `GET /health`
- `POST /v1/tmux`

Content-Type: `application/json`

Optional auth header when configured:
- `Authorization: Bearer <tmux.bridge.token>`

## Request schema

```json
{
  "action": "list_sessions | create_session | send_keys | capture_pane | send_and_capture | kill_session",
  "session": "optional session name",
  "cwd": "optional absolute working directory (create_session)",
  "text": "optional literal input (send_keys/send_and_capture)",
  "keys": ["optional key tokens, e.g. Enter, C-c"],
  "enter": true,
  "lines": 120,
  "wait_for": "optional regex string",
  "timeout_ms": 5000,
  "join_wrapped": false
}
```

### Action requirements enforced by the add-in/bridge

- `list_sessions`: no required fields
- `create_session`: no required fields
- `capture_pane`: requires `session`
- `kill_session`: requires `session`
- `send_keys`: requires `session` + at least one of (`text`, `keys`, `enter=true`)
- `send_and_capture`: same as `send_keys`

Tip: `send_keys` sends input only. Use `capture_pane` or `send_and_capture` when you need terminal output.

## Response schema

```json
{
  "ok": true,
  "action": "same action",
  "session": "optional resolved session",
  "sessions": ["optional list for list_sessions"],
  "output": "optional text output/capture",
  "error": "optional error string",
  "metadata": { "optional": "structured bridge metadata" }
}
```

Notes:
- Non-2xx HTTP responses are treated as errors by the adapter.
- `ok: false` is treated as an error by the adapter.
- Plain-text success responses are accepted as `output` fallback.

## Real tmux guardrails (implemented)

- Loopback client enforcement
- Origin allowlist enforcement (`ALLOWED_ORIGINS`)
- Optional bearer token auth (`TMUX_BRIDGE_TOKEN`)
- Session name validation (strict regex)
- Key token validation (strict regex)
- `cwd` must be absolute and an existing directory
- Bounded request size and input lengths
- Bounded `lines` and `timeout_ms`
- tmux calls executed via argv arrays (no shell interpolation)
- tmux launched with `-f /dev/null` and fixed socket path

## Tool behavior in workbook runtime

`tmux` is classified as read-only/non-workbook traffic in `execution-policy.ts`, so calls do not acquire workbook write locks or trigger workbook blueprint invalidation.
