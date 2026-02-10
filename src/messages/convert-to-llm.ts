/**
 * convertToLlm() for the Excel taskpane agent.
 *
 * We mostly reuse pi-web-ui's default conversion (attachments, artifact filtering),
 * but extend it with our custom compaction summary message.
 */

import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Message } from "@mariozechner/pi-ai";
import { defaultConvertToLlm } from "@mariozechner/pi-web-ui/dist/components/Messages.js";

import { compactionSummaryToUserMessage } from "./compaction.js";

export function convertToLlm(messages: AgentMessage[]): Message[] {
  const normalized: AgentMessage[] = messages.map((m) => {
    if (m.role === "compactionSummary") {
      return compactionSummaryToUserMessage(m);
    }
    return m;
  });

  return defaultConvertToLlm(normalized);
}
