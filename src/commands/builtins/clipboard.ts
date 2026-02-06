/**
 * Builtin clipboard commands.
 */

import type { Agent, AgentMessage } from "@mariozechner/pi-agent-core";

import type { SlashCommand } from "../types.js";
import { showToast } from "../../ui/toast.js";
import { extractTextBlocks } from "../../utils/content.js";

function getLastAssistantText(messages: AgentMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant") {
      const text = extractTextBlocks(msg.content).trim();
      return text || null;
    }
  }
  return null;
}

export function createClipboardCommands(agent: Agent): SlashCommand[] {
  return [
    {
      name: "copy",
      description: "Copy last agent message to clipboard",
      source: "builtin",
      execute: () => {
        const msgs = agent.state.messages;
        const text = getLastAssistantText(msgs);
        if (text) {
          navigator.clipboard.writeText(text).then(() => {
            showToast("Copied to clipboard");
          });
          return;
        }
        showToast("No agent message to copy");
      },
    },
  ];
}
