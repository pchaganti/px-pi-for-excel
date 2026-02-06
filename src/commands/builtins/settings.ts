/**
 * Builtin settings/auth commands.
 */

import { ApiKeysTab, ProxyTab, SettingsDialog } from "@mariozechner/pi-web-ui";

import type { SlashCommand } from "../types.js";
import { showProviderPicker } from "./overlays.js";

export function createSettingsCommands(): SlashCommand[] {
  return [
    {
      name: "settings",
      description: "Settings (API keys + CORS proxy)",
      source: "builtin",
      execute: () => {
        SettingsDialog.open([new ApiKeysTab(), new ProxyTab()]);
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
  ];
}
