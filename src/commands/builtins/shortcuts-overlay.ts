/**
 * Keyboard shortcuts overlay.
 */

import { closeOverlayById, createOverlayDialog } from "../../ui/overlay-dialog.js";
import { SHORTCUTS_OVERLAY_ID } from "../../ui/overlay-ids.js";

export function showShortcutsDialog(): void {
  const shortcuts = [
    ["Enter", "Send message"],
    ["Shift+Tab", "Cycle thinking level"],
    ["Esc", "Exit input focus, dismiss overlays, or abort streaming"],
    ["Enter (streaming)", "Steer — redirect agent"],
    ["⌥Enter", "Queue follow-up message"],
    ["/", "Open command menu"],
    ["↑↓", "Navigate command menu"],
    ["←/→", "Switch chats (after Esc exits input focus, wraps)"],
    ["⌘⇧[/⌘⇧]", "Switch chats (fallback on macOS hosts)"],
    ["Ctrl+PageUp/PageDown", "Switch chats (fallback on Windows hosts)"],
    ["⌘/Ctrl+⇧T", "Reopen last closed tab"],
    ["F2", "Focus chat input"],
    ["F6", "Focus: Sheet ↔ Sidebar"],
    ["⇧F6", "Focus: reverse direction"],
  ] as const;

  if (closeOverlayById(SHORTCUTS_OVERLAY_ID)) {
    return;
  }

  const dialog = createOverlayDialog({
    overlayId: SHORTCUTS_OVERLAY_ID,
    cardClassName: "pi-welcome-card pi-overlay-card pi-shortcuts-dialog",
  });

  const title = document.createElement("h2");
  title.className = "pi-overlay-title";
  title.textContent = "Keyboard Shortcuts";

  const list = document.createElement("div");
  list.className = "pi-shortcuts-list";

  for (const [key, desc] of shortcuts) {
    const row = document.createElement("div");
    row.className = "pi-shortcuts-row";

    const keyEl = document.createElement("kbd");
    keyEl.className = "pi-shortcuts-key";
    keyEl.textContent = key;

    const descEl = document.createElement("span");
    descEl.className = "pi-shortcuts-desc";
    descEl.textContent = desc;

    row.append(keyEl, descEl);
    list.appendChild(row);
  }

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "pi-overlay-btn pi-overlay-btn--ghost pi-overlay-btn--full";
  closeButton.textContent = "Close";

  dialog.card.append(title, list, closeButton);
  closeButton.addEventListener("click", dialog.close);

  dialog.mount();
}
