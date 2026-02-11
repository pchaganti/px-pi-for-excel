/**
 * Tool execution policy.
 *
 * Classifies core tool calls as read-only vs workbook-mutating.
 */

import { isRecord } from "../utils/type-guards.js";

export type ToolExecutionMode = "read" | "mutate";

const ALWAYS_READ_TOOLS = new Set<string>([
  "get_workbook_overview",
  "read_range",
  "search_workbook",
  "trace_dependencies",
]);

const ALWAYS_MUTATE_TOOLS = new Set<string>([
  "write_cells",
  "fill_formula",
  "modify_structure",
  "format_cells",
  "conditional_format",
]);

function getActionParam(params: unknown): string | null {
  if (!isRecord(params)) return null;
  const action = params.action;
  return typeof action === "string" ? action : null;
}

function classifyViewSettings(params: unknown): ToolExecutionMode {
  const action = getActionParam(params);
  return action === "get" ? "read" : "mutate";
}

function classifyComments(params: unknown): ToolExecutionMode {
  const action = getActionParam(params);
  return action === "read" ? "read" : "mutate";
}

/**
 * Return execution mode for a tool call.
 *
 * Unknown tools default to `mutate` as a safe fallback.
 */
export function getToolExecutionMode(toolName: string, params: unknown): ToolExecutionMode {
  if (ALWAYS_READ_TOOLS.has(toolName)) return "read";
  if (ALWAYS_MUTATE_TOOLS.has(toolName)) return "mutate";

  if (toolName === "view_settings") {
    return classifyViewSettings(params);
  }

  if (toolName === "comments") {
    return classifyComments(params);
  }

  return "mutate";
}
