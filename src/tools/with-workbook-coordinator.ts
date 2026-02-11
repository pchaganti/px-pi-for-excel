/**
 * Tool wrapper that routes mutating tool calls through the workbook coordinator.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";

import type { WorkbookCoordinator, WorkbookOperationContext } from "../workbook/coordinator.js";
import { getToolExecutionMode } from "./execution-policy.js";

export interface WorkbookCoordinatorContextProvider {
  getWorkbookId: () => Promise<string | null>;
  getSessionId: () => string;
}

function makeContext(args: {
  workbookId: string;
  sessionId: string;
  toolName: string;
}): WorkbookOperationContext {
  return {
    workbookId: args.workbookId,
    sessionId: args.sessionId,
    opId: crypto.randomUUID(),
    toolName: args.toolName,
  };
}

function wrapTool<TParameters extends TSchema, TDetails>(
  tool: AgentTool<TParameters, TDetails>,
  coordinator: WorkbookCoordinator,
  contextProvider: WorkbookCoordinatorContextProvider,
): AgentTool<TParameters, TDetails> {
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const mode = getToolExecutionMode(tool.name, params);
      const workbookId = (await contextProvider.getWorkbookId()) ?? "workbook:unknown";
      const context = makeContext({
        workbookId,
        sessionId: contextProvider.getSessionId(),
        toolName: tool.name,
      });

      if (mode === "read") {
        return coordinator.runRead(context, () => tool.execute(toolCallId, params, signal, onUpdate));
      }

      const out = await coordinator.runWrite(
        context,
        () => tool.execute(toolCallId, params, signal, onUpdate),
      );
      return out.result;
    },
  };
}

export function withWorkbookCoordinator(
  tools: AgentTool[],
  coordinator: WorkbookCoordinator,
  contextProvider: WorkbookCoordinatorContextProvider,
): AgentTool[] {
  return tools.map((tool) => wrapTool(tool, coordinator, contextProvider));
}
