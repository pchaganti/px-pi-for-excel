/**
 * Auto-compaction.
 *
 * Pi (TUI) triggers compaction when:
 *
 *   contextTokens > contextWindow - reserveTokens
 *
 * where reserveTokens defaults to 16,384 and keepRecentTokens defaults to 20,000.
 * See: /opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/compaction.md
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import { commandRegistry } from "../commands/types.js";
import { estimateContextTokens, estimateTextTokens } from "../utils/context-tokens.js";

import { effectiveReserveTokens } from "./defaults.js";

export async function maybeAutoCompactBeforePrompt(args: {
  agent: Agent;
  nextUserText: string;
  enabled: boolean;
}): Promise<boolean> {
  const { agent, nextUserText, enabled } = args;

  if (!enabled) return false;
  if (agent.state.isStreaming) return false;

  const model = agent.state.model;
  if (!model) return false;

  const contextWindow = model.contextWindow || 200000;
  const reserveTokens = effectiveReserveTokens(contextWindow);
  const threshold = Math.max(0, contextWindow - reserveTokens);

  const { totalTokens } = estimateContextTokens(agent.state);
  const projectedTokens = totalTokens + estimateTextTokens(nextUserText);

  if (projectedTokens <= threshold) return false;

  // Nothing to summarize / no room to improve.
  if (agent.state.messages.length < 4) return false;

  const compactCmd = commandRegistry.get("compact");
  if (!compactCmd) return false;

  await compactCmd.execute("");
  return true;
}
