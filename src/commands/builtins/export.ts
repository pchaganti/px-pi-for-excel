/**
 * Builtin export/compaction commands.
 */

import type { Api, Model, StopReason, Usage } from "@mariozechner/pi-ai";
import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";

import type { SlashCommand } from "../types.js";
import { showToast } from "../../ui/toast.js";
import { createCompactionSummaryMessage } from "../../messages/compaction.js";
import { getErrorMessage } from "../../utils/errors.js";
import { extractTextBlocks, summarizeContentForTranscript } from "../../utils/content.js";
import { isRecord } from "../../utils/type-guards.js";
import type { PiSidebar } from "../../ui/pi-sidebar.js";

type TranscriptEntry = {
  role: AgentMessage["role"];
  text: string;
  usage?: Usage;
  stopReason?: StopReason;
};


function isApiModel(model: unknown): model is Model<Api> {
  if (!isRecord(model)) return false;

  return (
    typeof model.id === "string" &&
    typeof model.name === "string" &&
    typeof model.provider === "string" &&
    typeof model.api === "string"
  );
}

function hasContent(message: AgentMessage): message is AgentMessage & { content: unknown } {
  return isRecord(message) && "content" in message;
}

function messageToTranscriptText(message: AgentMessage): string {
  if (message.role === "compactionSummary") return message.summary;
  if (hasContent(message)) return summarizeContentForTranscript(message.content);
  return "";
}

function conversationToText(messages: AgentMessage[]): string {
  return messages
    .map((m) => {
      const role =
        m.role === "user"
          ? "User"
          : m.role === "assistant"
            ? "Assistant"
            : m.role === "toolResult"
              ? "Tool"
              : m.role === "compactionSummary"
                ? "Compaction"
                : m.role;

      const text =
        m.role === "compactionSummary"
          ? m.summary
          : hasContent(m)
            ? extractTextBlocks(m.content)
            : "";

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
          const text = messageToTranscriptText(m);
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
        showToast("Compacting to free up context");

        try {
          // Serialize conversation for summarization
          const convo = conversationToText(msgs);

          const now = Date.now();
          const model = agent.state.model;
          if (!isApiModel(model)) {
            showToast("No model configured for compaction");
            return;
          }

          // IMPORTANT: use the agent's configured streamFn + api key resolver.
          // Calling pi-ai's completeSimple() directly bypasses:
          // - our CORS proxy logic (streamFn)
          // - our API key/OAuth resolution (agent.getApiKey)
          // and can crash in browser WebViews due to env key fallbacks using `process`.
          const apiKey = agent.getApiKey ? await agent.getApiKey(model.provider) : undefined;
          if (!apiKey) {
            showToast(`No API key available for ${model.provider}. Use /login or /settings.`);
            return;
          }

          const stream = await agent.streamFn(
            model,
            {
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
                  timestamp: now,
                },
              ],
            },
            {
              apiKey,
              sessionId: agent.sessionId,
              // Keep summaries short-ish by default.
              maxTokens: 1200,
              temperature: 0.2,
            },
          );

          const result = await stream.result();

          const summary = extractTextBlocks(result.content) || "Summary unavailable";

          const compacted = createCompactionSummaryMessage({
            summary,
            messageCountBefore: msgs.length,
            timestamp: now,
          });

          agent.replaceMessages([compacted]);

          const iface = document.querySelector<PiSidebar>("pi-sidebar");
          iface?.requestUpdate();

          showToast(`Summarized ${msgs.length} messages`);
        } catch (e: unknown) {
          showToast(`Compact failed: ${getErrorMessage(e)}`);
        }
      },
    },
  ];
}
