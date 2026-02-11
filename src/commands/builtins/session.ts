/**
 * Builtin session management commands.
 */

import type { SlashCommand } from "../types.js";
import { showToast } from "../../ui/toast.js";

export interface SessionCommandActions {
  renameActiveSession: (title: string) => Promise<void>;
  createRuntime: () => Promise<void>;
  resumeIntoActiveRuntime: () => Promise<void>;
}

export function createSessionIdentityCommands(actions: SessionCommandActions): SlashCommand[] {
  return [
    {
      name: "name",
      description: "Name the current chat session",
      source: "builtin",
      execute: async (args: string) => {
        const title = args.trim();
        if (!title) {
          showToast("Usage: /name My Session Name");
          return;
        }

        await actions.renameActiveSession(title);
        showToast(`Session named: ${title}`);
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

export function createSessionLifecycleCommands(actions: SessionCommandActions): SlashCommand[] {
  return [
    {
      name: "new",
      description: "Start a new chat session tab",
      source: "builtin",
      execute: async () => {
        await actions.createRuntime();
        showToast("New session tab started");
      },
    },
    {
      name: "resume",
      description: "Resume a previous session",
      source: "builtin",
      execute: async () => {
        await actions.resumeIntoActiveRuntime();
      },
    },
  ];
}
