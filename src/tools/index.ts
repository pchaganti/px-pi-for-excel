/**
 * Tool registry — creates all built-in tools for the agent.
 *
 * Canonical source of truth for core tools lives in `src/tools/registry.ts`.
 * Experimental/non-core tools are appended here.
 */

import { createCoreTools } from "./registry.js";
import { createTmuxTool } from "./tmux.js";

export function createAllTools() {
  return [
    ...createCoreTools(),
    createTmuxTool(),
  ];
}
