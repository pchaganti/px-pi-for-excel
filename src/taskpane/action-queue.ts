/**
 * UI-level ordered action queue.
 *
 * Needed because some actions (notably `/compact`) run outside the Agent loop
 * (they call `agent.streamFn(...)` directly) and therefore don't set
 * `agent.state.isStreaming`. Without a queue, user input can be lost when
 * compaction rewrites the message list.
 */

import type { Agent } from "@mariozechner/pi-agent-core";

import type { QueueDisplay } from "./queue-display.js";
import type { PiSidebar } from "../ui/pi-sidebar.js";
import { commandRegistry } from "../commands/types.js";
import { maybeAutoCompactBeforePrompt } from "../compaction/auto-compaction.js";

export type QueuedAction =
  | { type: "prompt"; text: string }
  | { type: "command"; name: string; args: string };

export interface ActionQueue {
  enqueuePrompt: (text: string) => void;
  enqueueCommand: (name: string, args: string) => void;
  isBusy: () => boolean;
}

export function createActionQueue(opts: {
  agent: Agent;
  sidebar: PiSidebar;
  queueDisplay: QueueDisplay;
  autoCompactEnabled: boolean;
}): ActionQueue {
  const { agent, sidebar, queueDisplay, autoCompactEnabled } = opts;

  const actions: QueuedAction[] = [];
  let running = false;

  const syncDisplay = () => {
    queueDisplay.setActionQueue(
      actions.map((a) => {
        if (a.type === "prompt") return { type: "prompt", label: "Queued", text: a.text };
        return { type: "command", label: `/${a.name}`, text: a.args ? a.args : "" };
      }),
    );
  };

  const isBusy = () => running || agent.state.isStreaming;

  async function runCommand(name: string, args: string): Promise<void> {
    const cmd = commandRegistry.get(name);
    if (!cmd) throw new Error(`Unknown command: /${name}`);

    // Special-case: show an explicit non-streaming indicator for compaction.
    if (name === "compact") {
      sidebar.setBusyIndicator(
        "Compacting context…",
        "Send messages and Pi will see them after compaction",
      );
      try {
        await cmd.execute(args);
      } finally {
        sidebar.setBusyIndicator(null);
      }
      return;
    }

    await cmd.execute(args);
  }

  async function process(): Promise<void> {
    if (running) return;
    running = true;

    try {
      // Drain sequentially.
      while (actions.length > 0) {
        // Never start queued actions while the agent is still streaming.
        await agent.waitForIdle();

        const next = actions.shift();
        if (!next) break;
        syncDisplay();

        if (next.type === "command") {
          await runCommand(next.name, next.args);
          continue;
        }

        // next.type === "prompt"
        await maybeAutoCompactBeforePrompt({
          agent,
          nextUserText: next.text,
          enabled: autoCompactEnabled,
          runCompact: async () => runCommand("compact", ""),
        });

        await agent.prompt(next.text);
      }
    } finally {
      running = false;
      syncDisplay();
    }
  }

  const enqueuePrompt = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    actions.push({ type: "prompt", text: trimmed });
    syncDisplay();
    void process();
  };

  const enqueueCommand = (name: string, args: string) => {
    const cmdName = name.trim();
    if (!cmdName) return;

    actions.push({ type: "command", name: cmdName, args: args.trim() });
    syncDisplay();
    void process();
  };

  return { enqueuePrompt, enqueueCommand, isBusy };
}
