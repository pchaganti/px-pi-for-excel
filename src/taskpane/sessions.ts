/**
 * Session persistence wiring for the taskpane.
 *
 * Owns:
 * - auto-saving agent state to IndexedDB
 * - restoring latest session on startup
 * - keeping internal session id/title in sync with /new, /name, /resume events
 */

import type { Agent } from "@mariozechner/pi-agent-core";
import type { SessionsStore } from "@mariozechner/pi-web-ui/dist/storage/stores/sessions-store.js";
import type { SettingsStore } from "@mariozechner/pi-web-ui/dist/storage/stores/settings-store.js";

import type { PiSidebar } from "../ui/pi-sidebar.js";
import { extractTextFromContent } from "../utils/content.js";
import { getWorkbookContext } from "../workbook/context.js";
import {
  getLatestSessionForWorkbook,
  linkSessionToWorkbook,
  setLatestSessionForWorkbook,
} from "../workbook/session-association.js";

export async function setupSessionPersistence(opts: {
  agent: Agent;
  sidebar: PiSidebar;
  sessions: SessionsStore;
  settings: SettingsStore;
}): Promise<void> {
  const { agent, sidebar, sessions, settings } = opts;

  async function resolveWorkbookId(): Promise<string | null> {
    try {
      const ctx = await getWorkbookContext();
      return ctx.workbookId;
    } catch {
      return null;
    }
  }

  let sessionId: string = crypto.randomUUID();
  agent.sessionId = sessionId;
  let sessionTitle = "";
  let sessionCreatedAt = new Date().toISOString();
  let firstAssistantSeen = false;

  async function saveSession() {
    if (!firstAssistantSeen) return;

    try {
      const now = new Date().toISOString();
      const messages = agent.state.messages;

      if (!sessionTitle && messages.length > 0) {
        const firstUser = messages.find((m) => m.role === "user");
        if (firstUser) {
          const text = extractTextFromContent(firstUser.content);
          sessionTitle = text.slice(0, 80) || "Untitled";
        }
      }

      let preview = "";
      for (const m of messages) {
        let text = "";

        if (m.role === "compactionSummary") {
          text = m.summary;
        } else if (m.role === "user" || m.role === "assistant") {
          text = extractTextFromContent(m.content);
        } else {
          continue;
        }

        preview += text + "\n";
        if (preview.length > 2048) {
          preview = preview.slice(0, 2048);
          break;
        }
      }

      let inputTokens = 0;
      let outputTokens = 0;
      let cacheReadTokens = 0;
      let cacheWriteTokens = 0;
      let totalTokens = 0;

      let costInput = 0;
      let costOutput = 0;
      let costCacheRead = 0;
      let costCacheWrite = 0;
      let costTotal = 0;

      for (const m of messages) {
        if (m.role !== "assistant") continue;
        const u = m.usage;
        inputTokens += u.input;
        outputTokens += u.output;
        cacheReadTokens += u.cacheRead;
        cacheWriteTokens += u.cacheWrite;
        totalTokens += u.totalTokens;

        costInput += u.cost.input;
        costOutput += u.cost.output;
        costCacheRead += u.cost.cacheRead;
        costCacheWrite += u.cost.cacheWrite;
        costTotal += u.cost.total;
      }

      const savedSessionId = sessionId;

      await sessions.saveSession(
        savedSessionId,
        agent.state,
        {
          id: savedSessionId,
          title: sessionTitle,
          createdAt: sessionCreatedAt,
          lastModified: now,
          messageCount: messages.length,
          usage: {
            input: inputTokens,
            output: outputTokens,
            cacheRead: cacheReadTokens,
            cacheWrite: cacheWriteTokens,
            totalTokens,
            cost: {
              input: costInput,
              output: costOutput,
              cacheRead: costCacheRead,
              cacheWrite: costCacheWrite,
              total: costTotal,
            },
          },
          thinkingLevel: agent.state.thinkingLevel || "off",
          preview,
        },
        sessionTitle,
      );

      const workbookId = await resolveWorkbookId();
      if (workbookId) {
        try {
          await linkSessionToWorkbook(settings, savedSessionId, workbookId);
          await setLatestSessionForWorkbook(settings, workbookId, savedSessionId);
        } catch (err) {
          console.warn("[pi] Workbook/session association update failed:", err);
        }
      }
    } catch (err) {
      console.warn("[pi] Session save failed:", err);
    }
  }

  function startNewSession() {
    sessionId = crypto.randomUUID();
    agent.sessionId = sessionId;
    sessionTitle = "";
    sessionCreatedAt = new Date().toISOString();
    firstAssistantSeen = false;
  }

  agent.subscribe((ev) => {
    if (ev.type === "message_end") {
      if (ev.message.role === "assistant") firstAssistantSeen = true;
      if (firstAssistantSeen) void saveSession();
    }
  });

  // Auto-restore latest session (prefer workbook-scoped "latest" when available)
  try {
    const candidates: string[] = [];

    const workbookId = await resolveWorkbookId();
    if (workbookId) {
      const wbLatest = await getLatestSessionForWorkbook(settings, workbookId);
      if (wbLatest) candidates.push(wbLatest);
    }

    const globalLatest = await sessions.getLatestSessionId();
    if (globalLatest) candidates.push(globalLatest);

    const seen = new Set<string>();
    for (const id of candidates) {
      if (seen.has(id)) continue;
      seen.add(id);

      const sessionData = await sessions.loadSession(id);
      if (!sessionData || sessionData.messages.length === 0) continue;

      sessionId = sessionData.id;
      agent.sessionId = sessionId;
      sessionTitle = sessionData.title || "";
      sessionCreatedAt = sessionData.createdAt;
      firstAssistantSeen = true;

      agent.replaceMessages(sessionData.messages);
      if (sessionData.model) agent.setModel(sessionData.model);
      if (sessionData.thinkingLevel) agent.setThinkingLevel(sessionData.thinkingLevel);

      // Force sidebar to pick up restored messages
      sidebar.syncFromAgent();
      console.log(`[pi] Restored session: ${sessionTitle || id}`);
      break;
    }
  } catch (err) {
    console.warn("[pi] Session restore failed:", err);
  }

  document.addEventListener("pi:session-new", () => startNewSession());

  interface RenameDetail { title?: string }
  interface ResumeDetail { id?: string; title?: string; createdAt?: string }

  document.addEventListener(
    "pi:session-rename",
    ((e: CustomEvent<RenameDetail>) => {
      sessionTitle = e.detail?.title || sessionTitle;
      void saveSession();
    }) as EventListener,
  );
  document.addEventListener(
    "pi:session-resumed",
    ((e: CustomEvent<ResumeDetail>) => {
      const id = e.detail?.id || sessionId;
      sessionId = id;
      agent.sessionId = sessionId;
      sessionTitle = e.detail?.title || "";
      sessionCreatedAt = e.detail?.createdAt || new Date().toISOString();
      firstAssistantSeen = true;

      void (async () => {
        const workbookId = await resolveWorkbookId();
        if (!workbookId) return;

        try {
          await linkSessionToWorkbook(settings, id, workbookId);
          await setLatestSessionForWorkbook(settings, workbookId, id);
        } catch (err) {
          console.warn("[pi] Workbook/session association update failed:", err);
        }
      })();
    }) as EventListener,
  );
}
