# Build Our Own UI Layer

Replace pi-web-ui components with our own Lit-based chat UI. Keep pi-ai (models/providers) and pi-agent-core (Agent, tools) as SDK. Keep pi-web-ui's storage stores (headless IndexedDB).

## Architecture
- Agent class from pi-agent-core: subscribe to events, call prompt(), setModel(), etc.
- Storage from pi-web-ui: AppStorage, IndexedDBStorageBackend, ProviderKeysStore, SessionsStore, SettingsStore, CustomProvidersStore
- Markdown: `marked` library (already a transitive dep)
- Our own Lit components in `src/ui/components/`

## Components to Build
1. `chat-view.ts` — main container: message list + input area + auto-scroll
2. `message-list.ts` — renders committed messages from agent.state.messages
3. `user-message.ts` — user message bubble with markdown
4. `assistant-message.ts` — assistant text + tool calls + streaming partial
5. `tool-call-card.ts` — collapsible tool invocation card (name, args, result, status)
6. `message-input.ts` — textarea with auto-grow, send button, model/thinking selectors
7. `model-picker.ts` — model selection dialog (search, filters, list)
8. `api-key-dialog.ts` — simple API key entry dialog
9. `markdown-view.ts` — renders markdown to HTML using `marked`
10. `thinking-block.ts` — collapsible thinking/reasoning content

## Checklist
- [ ] Install `marked` as direct dependency
- [ ] Create `src/ui/components/markdown-view.ts` — markdown rendering
- [ ] Create `src/ui/components/user-message.ts`
- [ ] Create `src/ui/components/tool-call-card.ts`
- [ ] Create `src/ui/components/thinking-block.ts`
- [ ] Create `src/ui/components/assistant-message.ts`
- [ ] Create `src/ui/components/message-list.ts`
- [ ] Create `src/ui/components/message-input.ts`
- [ ] Create `src/ui/components/model-picker.ts`
- [ ] Create `src/ui/components/api-key-dialog.ts`
- [ ] Create `src/ui/components/chat-view.ts` — orchestrates everything
- [ ] Update `src/taskpane.ts` — wire Agent directly, no ChatPanel
- [ ] Update `src/boot.ts` — remove pi-web-ui/app.css import, keep Lit fix
- [ ] Update `src/ui/theme.css` — self-contained styles (no pi-web-ui overrides)
- [ ] Clean up imports — no pi-web-ui component imports remain
- [ ] Build passes (tsc + vite)
- [ ] Screenshot verification in browser
