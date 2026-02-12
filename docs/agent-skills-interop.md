# Agent Skills interop: skills vs integrations

This repo uses two distinct concepts:

## 1) Agent Skills (standard)

- Standard: https://agentskills.io/specification
- Format: `SKILL.md` + frontmatter
- Portable across providers/harnesses

In this repo, standards artifacts live in:

- `skills/web-search/SKILL.md`
- `skills/mcp-gateway/SKILL.md`

## 2) Integrations (Excel runtime)

Integrations are built-in, opt-in capability bundles in the Excel add-in runtime.
They control:

- tool injection (`web_search`, `mcp`)
- prompt guidance (`## Active Integrations`)
- scope (session/workbook)
- global external-tools safety gate

Code lives under `src/integrations/*`.

## Runtime skill loading

The add-in now exposes a `skills` tool for standards-based skill loading:

- `skills` action=`list` → lists bundled Agent Skills
- `skills` action=`read` + `name` → returns full `SKILL.md`

The system prompt also includes `<available_skills>` entries so the model can choose a matching skill, then load it on demand.

## Mapping table

| Agent Skill | Integration ID | Tool name |
|---|---|---|
| `web-search` | `web_search` | `web_search` |
| `mcp-gateway` | `mcp_tools` | `mcp` |

## Why this split exists

- **Skills** maximize portability/interoperability.
- **Integrations** manage runtime consent, scoping, and local configuration in the Excel add-in.

Use the term **skill** only for standards-based `SKILL.md` artifacts.
Use **integration** for Excel runtime toggles and UI (`/integrations`).
