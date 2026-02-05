# Slash Command System

## Done
- [x] Create `src/commands/` module with SlashCommand type + registry
- [x] Built-in commands: model, default-models, settings, copy, name, shortcuts, share-session, new, resume
- [x] Command menu popup UI (src/commands/command-menu.ts) — absolute positioned above textarea
- [x] Wire to textarea: detect `/` at start, show menu, filter on input, arrow/enter/esc
- [x] CSS for command menu (frosted glass, matches design) + toast notifications
- [x] Extension point: commandRegistry.register() for plugins (source: builtin/extension/skill/prompt)
- [x] Implement each command's action
- [x] /resume — lists past sessions, click to restore
- [x] Build + screenshot verification

## Future
- [ ] /default-models proper UI (scoped model cycling with Ctrl+P)
- [ ] /share-session implementation
- [ ] Skills/prompt snippets loaded from config as slash commands
