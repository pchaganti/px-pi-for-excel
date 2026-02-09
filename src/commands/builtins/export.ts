/**
 * Builtin export/compaction commands.
 */

import type {
  AssistantMessage,
  StopReason,
  Usage,
  UserMessage,
} from "@mariozechner/pi-ai";
import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";

import type { SlashCommand } from "../types.js";
import { showToast } from "../../ui/toast.js";
import { getErrorMessage } from "../../utils/errors.js";
import { extractTextBlocks, summarizeContentForTranscript } from "../../utils/content.js";
import type { PiSidebar } from "../../ui/pi-sidebar.js";

type TranscriptEntry = {
  role: AgentMessage["role"];
  text: string;
  usage?: Usage;
  stopReason?: StopReason;
};

const ZERO_USAGE: Usage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 0,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0,
  },
};

function conversationToText(messages: AgentMessage[]): string {
  return messages
    .map((m) => {
      const role = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "Tool";
      const text = extractTextBlocks(m.content);
      return `${role}: ${text}`;
    })
    .join("\n\n");
}

export function createExportCommands(agent: Agent): SlashCommand[] {
  return [
    {
      name: "export",
      description: "Export session transcript (JSON to clipboard or download)",
      source: "builtin",
      execute: (args: string) => {
        const msgs = agent.state.messages;
        if (msgs.length === 0) {
          showToast("No messages to export");
          return;
        }

        const transcript: TranscriptEntry[] = msgs.map((m) => {
          const text = summarizeContentForTranscript(m.content);
          if (m.role === "assistant") {
            return {
              role: m.role,
              text,
              usage: m.usage,
              stopReason: m.stopReason,
            };
          }
          return { role: m.role, text };
        });

        const exportData = {
          exported: new Date().toISOString(),
          model: agent.state.model
            ? {
              id: agent.state.model.id,
              name: agent.state.model.name,
              provider: agent.state.model.provider,
            }
            : null,
          thinkingLevel: agent.state.thinkingLevel,
          messageCount: msgs.length,
          transcript,
          // Also include raw messages for full fidelity debugging
          raw: msgs,
        };

        const json = JSON.stringify(exportData, null, 2);

        if (args.trim() === "clipboard" || !args.trim()) {
          void navigator.clipboard.writeText(json).then(() => {
            showToast(
              `Transcript copied (${msgs.length} messages, ${(json.length / 1024).toFixed(0)}KB)`,
            );
          });
        } else {
          // Download as file
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `pi-session-${new Date().toISOString().slice(0, 10)}.json`;
          a.click();
          URL.revokeObjectURL(url);
          showToast(`Downloaded transcript (${msgs.length} messages)`);
        }
      },
    },
  ];
}

export function createCompactCommands(agent: Agent): SlashCommand[] {
  return [
    {
      name: "compact",
      description: "Summarize conversation to free context",
      source: "builtin",
      execute: async () => {
        const msgs = agent.state.messages;
        if (msgs.length < 4) {
          showToast("Too few messages to compact");
          return;
        }
        showToast("Compacting…");

        try {
          const { completeSimple } = await import("@mariozechner/pi-ai");

          // Serialize conversation for summarization
          const convo = conversationToText(msgs);

          const result = await completeSimple(agent.state.model, {
            systemPrompt:
              "You are a conversation summarizer. Summarize the following conversation concisely, preserving key decisions, facts, and context. Output ONLY the summary, no preamble.",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: `Summarize this conversation:\n\n${convo}`,
                  },
                ],
                timestamp: Date.now(),
              },
            ],
          });

          const summary = extractTextBlocks(result.content) || "Summary unavailable";

          const now = Date.now();
          const model = agent.state.model;

          const marker: UserMessage = {
            role: "user",
            content: [{ type: "text", text: "[This conversation was compacted]" }],
            timestamp: now,
          };

          const summaryMessage: AssistantMessage = {
            role: "assistant",
            content: [
              {
                type: "text",
                text: `**Session Summary (compacted)**\n\n${summary}`,
              },
            ],
            api: model.api as string,
            provider: model.provider,
            model: model.id,
            usage: ZERO_USAGE,
            stopReason: "stop",
            timestamp: now,
          };

          agent.replaceMessages([marker, summaryMessage]);

          const iface = document.querySelector<PiSidebar>("pi-sidebar");
          iface?.requestUpdate();

          showToast(`Compacted ${msgs.length} messages → summary`);
        } catch (e: unknown) {
          showToast(`Compact failed: ${getErrorMessage(e)}`);
        }
      },
    },
  ];
}
