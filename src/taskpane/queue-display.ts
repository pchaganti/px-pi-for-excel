/**
 * Small DOM-only queue display for queued steering / follow-up messages.
 *
 * This intentionally stays as plain DOM manipulation (not Lit) for now.
 *
 * Security note: avoid `innerHTML` so queued text can't inject markup.
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import type { PiSidebar } from "../ui/pi-sidebar.js";
import { extractTextFromContent } from "../utils/content.js";

export type QueuedMessageType = "steer" | "follow-up";
export type QueuedActionType = "prompt" | "command";

type QueuedItem = { type: QueuedMessageType; text: string };
type QueuedActionItem = { type: QueuedActionType; label: string; text: string };

function renderQueuedItem({ type, text }: QueuedItem): HTMLElement {
  const itemEl = document.createElement("div");
  itemEl.className = "pi-queue__item";

  const label = type === "steer" ? "Steering" : "Follow-up";
  const cls = type === "steer" ? "pi-queue__label--steer" : "pi-queue__label--followup";

  const labelEl = document.createElement("span");
  labelEl.className = `pi-queue__label ${cls}`;
  labelEl.textContent = label;

  const truncated = text.length > 50 ? text.slice(0, 47) + "…" : text;
  const textEl = document.createElement("span");
  textEl.className = "pi-queue__text";
  textEl.textContent = truncated;

  itemEl.append(labelEl, textEl);
  return itemEl;
}

export type QueueDisplay = {
  add: (type: QueuedMessageType, text: string) => void;
  clear: () => void;
  setActionQueue: (items: Array<{ type: QueuedActionType; label: string; text: string }>) => void;
};

export function createQueueDisplay(opts: {
  agent: Agent;
  sidebar: PiSidebar;
}): QueueDisplay {
  const { agent, sidebar } = opts;

  const queued: QueuedItem[] = [];
  let queuedActions: QueuedActionItem[] = [];

  function updateQueueDisplay() {
    let container = document.getElementById("pi-queue-display");
    if (queued.length === 0 && queuedActions.length === 0) {
      container?.remove();
      return;
    }

    if (!container) {
      container = document.createElement("div");
      container.id = "pi-queue-display";
      container.className = "pi-queue";
      // Insert into sidebar layout (before input area) so it participates
      // in flexbox flow — no fixed positioning, no overlay issues.
      const inputArea = sidebar.querySelector<HTMLElement>(".pi-input-area");
      if (inputArea) {
        inputArea.parentElement?.insertBefore(container, inputArea);
      } else {
        sidebar.appendChild(container);
      }
    }

    const fragment = document.createDocumentFragment();

    for (const item of queued) {
      fragment.appendChild(renderQueuedItem(item));
    }

    for (const action of queuedActions) {
      const itemEl = document.createElement("div");
      itemEl.className = "pi-queue__item";

      const labelEl = document.createElement("span");
      labelEl.className = "pi-queue__label pi-queue__label--action";
      labelEl.textContent = action.label;

      const truncated = action.text.length > 50 ? action.text.slice(0, 47) + "…" : action.text;
      const textEl = document.createElement("span");
      textEl.className = "pi-queue__text";
      textEl.textContent = truncated;

      itemEl.append(labelEl, textEl);
      fragment.appendChild(itemEl);
    }

    container.replaceChildren(fragment);
  }

  function add(type: QueuedMessageType, text: string) {
    queued.push({ type, text });
    updateQueueDisplay();
  }

  function clear() {
    queued.length = 0;
    updateQueueDisplay();
  }

  function setActionQueue(items: QueuedActionItem[]) {
    queuedActions = items;
    updateQueueDisplay();
  }

  agent.subscribe((ev) => {
    if (queued.length === 0) return;

    if (ev.type === "message_start" && ev.message.role === "user") {
      const msgText = extractTextFromContent(ev.message.content);
      const idx = queued.findIndex((q) => q.text === msgText);
      if (idx !== -1) {
        queued.splice(idx, 1);
        updateQueueDisplay();
      }
    }

    // Only clear steer/follow-up on agent end. Action queue is owned elsewhere.
    if (ev.type === "agent_end" && queued.length > 0) clear();
  });

  return { add, clear, setActionQueue };
}
