/**
 * Session persistence wiring for one runtime.
 *
 * Owns:
 * - auto-saving agent state to IndexedDB
 * - optional latest-session restore on startup
 * - session identity lifecycle (new / rename / resume)
 */

import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { SessionData } from "@mariozechner/pi-web-ui/dist/storage/types.js";
import type { SessionsStore } from "@mariozechner/pi-web-ui/dist/storage/stores/sessions-store.js";
import type { SettingsStore } from "@mariozechner/pi-web-ui/dist/storage/stores/settings-store.js";

import { extractTextFromContent } from "../utils/content.js";
import { getWorkbookContext } from "../workbook/context.js";
import {
  getLatestSessionForWorkbook,
  linkSessionToWorkbook,
  setLatestSessionForWorkbook,
} from "../workbook/session-association.js";

export interface SessionPersistenceController {
  getSessionId: () => string;
  getSessionTitle: () => string;
  getSessionCreatedAt: () => string;
  startNewSession: () => void;
  renameSession: (title: string) => Promise<void>;
  applyLoadedSession: (sessionData: SessionData) => Promise<void>;
  restoreLatestSession: () => Promise<boolean>;
  saveSession: () => Promise<void>;
  subscribe: (listener: () => void) => () => void;
  dispose: () => void;
}

type SessionId = string;

type UserLikeMessage = AgentMessage & {
  role: "user" | "user-with-attachments";
  content: unknown;
};

function hasAssistantMessage(messages: AgentMessage[]): boolean {
  return messages.some((m) => m.role === "assistant");
}

function isChatUserMessage(message: AgentMessage): message is UserLikeMessage {
  if (!(message.role === "user" || message.role === "user-with-attachments")) {
    return false;
  }

  return "content" in message;
}

function isSessionId(value: string): value is SessionId {
  return value.split("-").length === 5;
}

export async function setupSessionPersistence(opts: {
  agent: Agent;
  sessions: SessionsStore;
  settings: SettingsStore;
  autoRestoreLatest?: boolean;
}): Promise<SessionPersistenceController> {
  const { agent, sessions, settings } = opts;

  async function resolveWorkbookId(): Promise<string | null> {
    try {
      const ctx = await getWorkbookContext();
      return ctx.workbookId;
    } catch {
      return null;
    }
  }

  const listeners = new Set<() => void>();
  let sessionId: SessionId = crypto.randomUUID();
  let sessionTitle = "";
  let sessionCreatedAt = new Date().toISOString();
  let firstAssistantSeen = false;

  agent.sessionId = sessionId;

  function emitChange(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  async function updateWorkbookAssociation(savedSessionId: string): Promise<void> {
    const workbookId = await resolveWorkbookId();
    if (!workbookId) return;

    try {
      await linkSessionToWorkbook(settings, savedSessionId, workbookId);
      await setLatestSessionForWorkbook(settings, workbookId, savedSessionId);
    } catch (err) {
      console.warn("[pi] Workbook/session association update failed:", err);
    }
  }

  async function saveSession(): Promise<void> {
    if (!firstAssistantSeen) return;

    try {
      const now = new Date().toISOString();
      const messages = agent.state.messages;

      if (!sessionTitle && messages.length > 0) {
        const firstUser = messages.find((m) => isChatUserMessage(m));
        if (firstUser) {
          const text = extractTextFromContent(firstUser.content);
          sessionTitle = text.slice(0, 80) || "Untitled";
        }
      }

      let preview = "";
      for (const message of messages) {
        let text = "";

        if (message.role === "compactionSummary") {
          text = message.summary;
        } else if (message.role === "user" || message.role === "assistant") {
          text = extractTextFromContent(message.content);
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

      for (const message of messages) {
        if (message.role !== "assistant") continue;
        const usage = message.usage;

        inputTokens += usage.input;
        outputTokens += usage.output;
        cacheReadTokens += usage.cacheRead;
        cacheWriteTokens += usage.cacheWrite;
        totalTokens += usage.totalTokens;

        costInput += usage.cost.input;
        costOutput += usage.cost.output;
        costCacheRead += usage.cost.cacheRead;
        costCacheWrite += usage.cost.cacheWrite;
        costTotal += usage.cost.total;
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

      await updateWorkbookAssociation(savedSessionId);
      emitChange();
    } catch (err) {
      console.warn("[pi] Session save failed:", err);
    }
  }

  function startNewSession(): void {
    sessionId = crypto.randomUUID();
    sessionTitle = "";
    sessionCreatedAt = new Date().toISOString();
    firstAssistantSeen = false;
    agent.sessionId = sessionId;
    emitChange();
  }

  async function renameSession(title: string): Promise<void> {
    sessionTitle = title.trim();
    emitChange();
    await saveSession();
  }

  async function applyLoadedSession(sessionData: SessionData): Promise<void> {
    if (isSessionId(sessionData.id)) {
      sessionId = sessionData.id;
    } else {
      sessionId = crypto.randomUUID();
    }

    sessionTitle = sessionData.title || "";
    sessionCreatedAt = sessionData.createdAt;
    firstAssistantSeen = hasAssistantMessage(sessionData.messages);

    agent.sessionId = sessionId;
    agent.replaceMessages(sessionData.messages);

    if (sessionData.model) {
      agent.setModel(sessionData.model);
    }
    if (sessionData.thinkingLevel) {
      agent.setThinkingLevel(sessionData.thinkingLevel);
    }

    await updateWorkbookAssociation(sessionId);
    emitChange();
  }

  async function restoreLatestSession(): Promise<boolean> {
    try {
      const candidates: string[] = [];

      const workbookId = await resolveWorkbookId();
      if (workbookId) {
        const workbookLatest = await getLatestSessionForWorkbook(settings, workbookId);
        if (workbookLatest) candidates.push(workbookLatest);
      }

      const globalLatest = await sessions.getLatestSessionId();
      if (globalLatest) candidates.push(globalLatest);

      const seen = new Set<string>();
      for (const candidateId of candidates) {
        if (seen.has(candidateId)) continue;
        seen.add(candidateId);

        const sessionData = await sessions.loadSession(candidateId);
        if (!sessionData || sessionData.messages.length === 0) continue;

        await applyLoadedSession(sessionData);
        console.log(`[pi] Restored session: ${sessionData.title || candidateId}`);
        return true;
      }
    } catch (err) {
      console.warn("[pi] Session restore failed:", err);
    }

    return false;
  }

  const unsubscribeAgent = agent.subscribe((event) => {
    if (event.type !== "message_end") return;

    if (event.message.role === "assistant") {
      firstAssistantSeen = true;
    }

    if (firstAssistantSeen) {
      void saveSession();
    }
  });

  if (opts.autoRestoreLatest) {
    await restoreLatestSession();
  }

  return {
    getSessionId: () => sessionId,
    getSessionTitle: () => sessionTitle,
    getSessionCreatedAt: () => sessionCreatedAt,
    startNewSession,
    renameSession,
    applyLoadedSession,
    restoreLatestSession,
    saveSession,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose(): void {
      unsubscribeAgent();
      listeners.clear();
    },
  };
}
