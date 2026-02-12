/**
 * Builtin settings/auth commands.
 */

import { ApiKeysTab, ProxyTab, SettingsDialog } from "@mariozechner/pi-web-ui/dist/dialogs/SettingsDialog.js";

import type { SlashCommand } from "../types.js";
import { showProviderPicker } from "./overlays.js";

export interface SettingsCommandActions {
  openInstructionsEditor: () => Promise<void>;
}

export function createSettingsCommands(actions: SettingsCommandActions): SlashCommand[] {
  return [
    {
      name: "settings",
      description: "Settings (API keys + CORS proxy)",
      source: "builtin",
      execute: () => {
        void SettingsDialog.open([new ApiKeysTab(), new ProxyTab()]);
      },
    },
    {
      name: "login",
      description: "Add or change provider API keys",
      source: "builtin",
      execute: async () => {
        await showProviderPicker();
      },
    },
    {
      name: "instructions",
      description: "Edit custom rules for Pi (personal + workbook-specific)",
      source: "builtin",
      execute: async () => {
        await actions.openInstructionsEditor();
      },
    },
  ];
}
