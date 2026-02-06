/**
 * Auto-context injection.
 *
 * Adds (when available):
 * - selection context (read around current selection)
 * - change tracker summary (cells edited since last message)
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

import type { ChangeTracker } from "../context/change-tracker.js";
import { readSelectionContext } from "../context/selection.js";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }) as Promise<T | null>;
}

export function createContextInjector(changeTracker: ChangeTracker) {
  return async (messages: AgentMessage[], _signal?: AbortSignal): Promise<AgentMessage[]> => {
    const injections: string[] = [];

    try {
      const sel = await withTimeout(readSelectionContext().catch(() => null), 1500);
      if (sel) injections.push(sel.text);
    } catch {
      // ignore
    }

    const changes = changeTracker.flush();
    if (changes) injections.push(changes);
    if (injections.length === 0) return messages;

    const injection = injections.join("\n\n");
    const injectionMessage: AgentMessage = {
      role: "user",
      content: [{ type: "text", text: `[Auto-context]\n${injection}` }],
      timestamp: Date.now(),
    };

    const nextMessages = [...messages];
    let lastUserIdx = -1;
    for (let i = nextMessages.length - 1; i >= 0; i--) {
      if (nextMessages[i].role === "user") {
        lastUserIdx = i;
        break;
      }
    }

    if (lastUserIdx >= 0) {
      nextMessages.splice(lastUserIdx, 0, injectionMessage);
    } else {
      nextMessages.push(injectionMessage);
    }

    return nextMessages;
  };
}
