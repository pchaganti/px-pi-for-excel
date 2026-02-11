/**
 * Register all builtin slash commands.
 */

import { commandRegistry, type SlashCommand } from "../types.js";

import { createModelCommands, type ActiveAgentProvider } from "./model.js";
import { createSettingsCommands } from "./settings.js";
import { createDebugCommands } from "./debug.js";
import { createClipboardCommands } from "./clipboard.js";
import { createExportCommands, createCompactCommands } from "./export.js";
import { createSessionIdentityCommands, createSessionLifecycleCommands, type SessionCommandActions } from "./session.js";
import { createHelpCommands } from "./help.js";

export interface BuiltinsContext extends SessionCommandActions {
  getActiveAgent: ActiveAgentProvider;
}

/** Register all built-in commands. Call once after runtime manager is ready. */
export function registerBuiltins(context: BuiltinsContext): void {
  // Keep registration order stable: this is the order shown in the command menu.
  const builtins: SlashCommand[] = [
    ...createModelCommands(context.getActiveAgent),
    ...createSettingsCommands(),
    ...createDebugCommands(),
    ...createClipboardCommands(context.getActiveAgent),
    ...createExportCommands(context.getActiveAgent),
    ...createSessionIdentityCommands(context),
    ...createHelpCommands(),
    ...createSessionLifecycleCommands(context),
    ...createCompactCommands(context.getActiveAgent),
  ];

  for (const cmd of builtins) {
    commandRegistry.register(cmd);
  }
}
