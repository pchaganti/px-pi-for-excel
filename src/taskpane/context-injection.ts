/**
 * Auto-context injection.
 *
 * Adds (when available):
 * - workbook structure context (blueprint), only on first send and when invalidated
 * - selection context (read around current selection)
 * - change tracker summary (cells edited since last message)
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";

import type { ChangeTracker } from "../context/change-tracker.js";
import { getBlueprint, getBlueprintRevision } from "../context/blueprint.js";
import { readSelectionContext } from "../context/selection.js";
import { getWorkbookContext } from "../workbook/context.js";

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<null>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(null), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }) as Promise<T | null>;
}

type BlueprintRefreshReason = "initial" | "workbook_switched" | "blueprint_invalidated";

function buildWorkbookContextSection(blueprint: string, reason: BlueprintRefreshReason): string {
  let reasonText = "initial";
  if (reason === "workbook_switched") reasonText = "workbook switched";
  if (reason === "blueprint_invalidated") reasonText = "workbook structure changed";

  return [
    `[Workbook context refresh: ${reasonText}]`,
    blueprint,
  ].join("\n\n");
}

export function createContextInjector(changeTracker: ChangeTracker) {
  let lastInjectedWorkbookId: string | null | undefined;
  let lastInjectedBlueprintRevision = -1;

  return async (messages: AgentMessage[], _signal?: AbortSignal): Promise<AgentMessage[]> => {
    const injections: string[] = [];

    // Workbook structure context: inject only when needed.
    try {
      const workbookCtx = await withTimeout(getWorkbookContext().catch(() => null), 1200);
      const workbookId = workbookCtx?.workbookId ?? null;
      const currentRevision = getBlueprintRevision();

      let refreshReason: BlueprintRefreshReason | null = null;
      if (lastInjectedWorkbookId === undefined) {
        refreshReason = "initial";
      } else if (lastInjectedWorkbookId !== workbookId) {
        refreshReason = "workbook_switched";
      } else if (currentRevision !== lastInjectedBlueprintRevision) {
        refreshReason = "blueprint_invalidated";
      }

      if (refreshReason) {
        const blueprint = await withTimeout(getBlueprint().catch(() => null), 2500);
        if (blueprint && blueprint.trim().length > 0) {
          injections.push(buildWorkbookContextSection(blueprint, refreshReason));
          lastInjectedWorkbookId = workbookId;
          lastInjectedBlueprintRevision = getBlueprintRevision();
        }
      }
    } catch {
      // ignore
    }

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
