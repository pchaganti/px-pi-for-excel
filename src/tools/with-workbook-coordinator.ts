/**
 * Tool wrapper that routes mutating tool calls through the workbook coordinator.
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { TSchema } from "@sinclair/typebox";

import type { WorkbookCoordinator, WorkbookOperationContext } from "../workbook/coordinator.js";
import { getErrorMessage } from "../utils/errors.js";
import { getToolContextImpact, getToolExecutionMode, type ToolContextImpact } from "./execution-policy.js";

export interface WorkbookCoordinatorContextProvider {
  getWorkbookId: () => Promise<string | null>;
  getSessionId: () => string;
}

export interface WorkbookMutationEvent {
  workbookId: string | null;
  sessionId: string;
  toolName: string;
  impact: ToolContextImpact;
  revision: number;
}

export interface WorkbookMutationObserver {
  onWriteCommitted?: (event: WorkbookMutationEvent) => void;
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

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;

  // Keep message text compatible with existing abort handling paths.
  throw new Error("Aborted");
}

function wrapTool<TParameters extends TSchema, TDetails>(
  tool: AgentTool<TParameters, TDetails>,
  coordinator: WorkbookCoordinator,
  contextProvider: WorkbookCoordinatorContextProvider,
  mutationObserver: WorkbookMutationObserver | undefined,
): AgentTool<TParameters, TDetails> {
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const mode = getToolExecutionMode(tool.name, params);
      const contextWorkbookId = await contextProvider.getWorkbookId();
      const coordinatorWorkbookId = contextWorkbookId ?? "workbook:unknown";
      const sessionId = contextProvider.getSessionId();
      const context = makeContext({
        workbookId: coordinatorWorkbookId,
        sessionId,
        toolName: tool.name,
      });

      throwIfAborted(signal);

      if (mode === "read") {
        return coordinator.runRead(context, () => {
          throwIfAborted(signal);
          return tool.execute(toolCallId, params, signal, onUpdate);
        });
      }

      const out = await coordinator.runWrite(
        context,
        () => {
          throwIfAborted(signal);
          return tool.execute(toolCallId, params, signal, onUpdate);
        },
      );

      if (mutationObserver?.onWriteCommitted) {
        const impact = getToolContextImpact(tool.name, params);
        try {
          mutationObserver.onWriteCommitted({
            workbookId: contextWorkbookId,
            sessionId,
            toolName: tool.name,
            impact,
            revision: out.revision,
          });
        } catch (error: unknown) {
          console.warn("[pi] Workbook mutation observer failed:", getErrorMessage(error));
        }
      }

      return out.result;
    },
  };
}

export function withWorkbookCoordinator(
  tools: AgentTool[],
  coordinator: WorkbookCoordinator,
  contextProvider: WorkbookCoordinatorContextProvider,
  mutationObserver?: WorkbookMutationObserver,
): AgentTool[] {
  return tools.map((tool) => wrapTool(tool, coordinator, contextProvider, mutationObserver));
}
