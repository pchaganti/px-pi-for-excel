/**
 * Register all builtin slash commands.
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import { commandRegistry, type SlashCommand } from "../types.js";

import { createModelCommands } from "./model.js";
import { createSettingsCommands } from "./settings.js";
import { createDebugCommands } from "./debug.js";
import { createClipboardCommands } from "./clipboard.js";
import { createExportCommands, createCompactCommands } from "./export.js";
import { createSessionIdentityCommands, createSessionLifecycleCommands } from "./session.js";
import { createHelpCommands } from "./help.js";

/** Register all built-in commands. Call once after agent is created. */
export function registerBuiltins(agent: Agent): void {
  // Keep registration order stable: this is the order shown in the command menu.
  const builtins: SlashCommand[] = [
    ...createModelCommands(agent),
    ...createSettingsCommands(),
    ...createDebugCommands(),
    ...createClipboardCommands(agent),
    ...createExportCommands(agent),
    ...createSessionIdentityCommands(agent),
    ...createHelpCommands(),
    ...createSessionLifecycleCommands(agent),
    ...createCompactCommands(agent),
  ];

  for (const cmd of builtins) {
    commandRegistry.register(cmd);
  }
}
