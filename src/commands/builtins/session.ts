/**
 * Builtin session management commands.
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import type { SlashCommand } from "../types.js";
import { showToast } from "../../ui/toast.js";
import type { PiSidebar } from "../../ui/pi-sidebar.js";
import { showResumeDialog } from "./overlays.js";

export function createSessionIdentityCommands(_agent: Agent): SlashCommand[] {
  return [
    {
      name: "name",
      description: "Name the current chat session",
      source: "builtin",
      execute: (args: string) => {
        if (!args.trim()) {
          showToast("Usage: /name My Session Name");
          return;
        }
        document.dispatchEvent(
          new CustomEvent("pi:session-rename", { detail: { title: args.trim() } }),
        );
        showToast(`Session named: ${args.trim()}`);
      },
    },
    {
      name: "share-session",
      description: "Share session as a link",
      source: "builtin",
      execute: () => {
        showToast("Session sharing coming soon");
      },
    },
  ];
}

export function createSessionLifecycleCommands(agent: Agent): SlashCommand[] {
  return [
    {
      name: "new",
      description: "Start a new chat session",
      source: "builtin",
      execute: () => {
        // Signal new session (resets ID) then clear messages
        document.dispatchEvent(new CustomEvent("pi:session-new"));
        agent.clearMessages();

        // Force sidebar + status bar to re-render
        const sidebar = document.querySelector<PiSidebar>("pi-sidebar");
        sidebar?.requestUpdate();

        document.dispatchEvent(new CustomEvent("pi:status-update"));
        showToast("New session started");
      },
    },
    {
      name: "resume",
      description: "Resume a previous session",
      source: "builtin",
      execute: async () => {
        await showResumeDialog(agent);
      },
    },
  ];
}
