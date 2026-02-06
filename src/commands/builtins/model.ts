/**
 * Builtin model-related commands.
 */

import type { Agent } from "@mariozechner/pi-agent-core";
import { ModelSelector } from "@mariozechner/pi-web-ui";

import type { SlashCommand } from "../types.js";

function openModelSelector(agent: Agent): void {
  ModelSelector.open(agent.state.model, (model) => {
    agent.setModel(model);
    // Header update is handled by the agent subscriber in taskpane.ts
    document.dispatchEvent(new CustomEvent("pi:model-changed"));
  });
}

export function createModelCommands(agent: Agent): SlashCommand[] {
  return [
    {
      name: "model",
      description: "Change the AI model",
      source: "builtin",
      execute: () => {
        openModelSelector(agent);
      },
    },
    {
      name: "default-models",
      description: "Cycle models with Ctrl+P",
      source: "builtin",
      execute: () => {
        // TODO: implement scoped models dialog
        // For now, open model selector as a placeholder
        openModelSelector(agent);
      },
    },
  ];
}
