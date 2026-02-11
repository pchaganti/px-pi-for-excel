# Experimental tmux bridge contract (v1 stub)

Status: implemented as an **experimental tool adapter stub** in the add-in (`src/tools/tmux.ts`).

This does **not** include a bundled local bridge daemon yet. It defines the request/response contract the future local helper should implement.

## Availability and gating

The `tmux` tool is hidden unless all gates pass:

1. `/experimental on tmux-bridge`
2. `tmux.bridge.url` is configured (via `/experimental tmux-bridge-url <url>`)
3. bridge `GET /health` returns success

The gate is checked:
- before tool exposure
- again on each tool execution (defense in depth)

## Endpoint

`POST {tmux.bridge.url}/v1/tmux`

Content-Type: `application/json`

Optional auth header when configured:
- `Authorization: Bearer <tmux.bridge.token>`

## Request schema

```json
{
  "action": "list_sessions | create_session | send_keys | capture_pane | send_and_capture | kill_session",
  "session": "optional session name",
  "cwd": "optional working directory (create_session)",
  "text": "optional literal input (send_keys/send_and_capture)",
  "keys": ["optional key tokens, e.g. Enter, C-c"],
  "enter": true,
  "lines": 120,
  "wait_for": "optional regex string",
  "timeout_ms": 5000,
  "join_wrapped": false
}
```

### Action requirements enforced by the add-in

- `list_sessions`: no required fields
- `create_session`: no required fields
- `capture_pane`: requires `session`
- `kill_session`: requires `session`
- `send_keys`: requires `session` + at least one of (`text`, `keys`, `enter=true`)
- `send_and_capture`: same as `send_keys`

## Response schema (expected)

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
- Non-2xx HTTP responses are treated as errors.
- `ok: false` is treated as an error.
- Plain-text success responses are accepted as `output` fallback.

## Tool behavior in workbook runtime

`tmux` is classified as read-only/non-workbook traffic in `execution-policy.ts`, so calls do not acquire workbook write locks or trigger workbook blueprint invalidation.
