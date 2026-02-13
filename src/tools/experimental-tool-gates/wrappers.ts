import type { AgentTool } from "@mariozechner/pi-agent-core";

import {
  buildFilesWorkspaceGateErrorMessage,
  buildPythonBridgeGateErrorMessage,
  buildTmuxBridgeGateErrorMessage,
  defaultGetApprovedPythonBridgeUrl,
  defaultSetApprovedPythonBridgeUrl,
  evaluateFilesWorkspaceGate,
  evaluatePythonBridgeGate,
  evaluateTmuxBridgeGate,
} from "./evaluation.js";
import {
  EXECUTE_OFFICE_JS_TOOL_NAME,
  FILES_TOOL_NAME,
  PYTHON_TOOL_NAMES,
  TMUX_TOOL_NAME,
  type ExperimentalToolGateDependencies,
  type OfficeJsExecuteApprovalRequest,
  type PythonBridgeApprovalRequest,
} from "./types.js";

function isRecordObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getRecordValue(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function getFilesAction(params: unknown): "list" | "read" | "write" | "delete" | null {
  if (!isRecordObject(params)) return null;

  const action = params.action;
  if (action === "list" || action === "read" || action === "write" || action === "delete") {
    return action;
  }

  return null;
}

function allowsFilesActionWhenExperimentDisabled(params: unknown): boolean {
  const action = getFilesAction(params);
  return action === "list" || action === "read";
}

function getPythonApprovalMessage(
  toolName: string,
  bridgeUrl: string,
  params: unknown,
): string {
  const title = "Allow local Python / LibreOffice execution?";

  if (isRecordObject(params)) {
    if (toolName === "python_run") {
      const code = getRecordValue(params, "code") ?? "(no code)";
      const previewLine = code.split("\n")[0] ?? code;
      return `${title}\n\nTool: python_run\nBridge: ${bridgeUrl}\nCode preview: ${previewLine}`;
    }

    if (toolName === "libreoffice_convert") {
      const inputPath = getRecordValue(params, "input_path") ?? "(unknown input)";
      const targetFormat = getRecordValue(params, "target_format") ?? "(unknown format)";
      return `${title}\n\nTool: libreoffice_convert\nBridge: ${bridgeUrl}\nInput: ${inputPath}\nTarget: ${targetFormat.toUpperCase()}`;
    }

    if (toolName === "python_transform_range") {
      const range = getRecordValue(params, "range") ?? "(unknown range)";
      const output = getRecordValue(params, "output_start_cell") ?? "(source top-left)";
      return `${title}\n\nTool: python_transform_range\nBridge: ${bridgeUrl}\nRange: ${range}\nOutput start: ${output}`;
    }
  }

  return `${title}\n\nTool: ${toolName}\nBridge: ${bridgeUrl}`;
}

function defaultRequestPythonBridgeApproval(
  request: PythonBridgeApprovalRequest,
): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return Promise.resolve(true);
  }

  return Promise.resolve(
    window.confirm(getPythonApprovalMessage(request.toolName, request.bridgeUrl, request.params)),
  );
}

function getOfficeJsApprovalMessage(request: OfficeJsExecuteApprovalRequest): string {
  const explanation = request.explanation.trim().length > 0
    ? request.explanation.trim()
    : "(no explanation provided)";

  const firstLine = request.code
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0)
    ?? "(no code preview)";

  return [
    "Allow direct Office.js execution?",
    "",
    `Action: ${explanation}`,
    `Code preview: ${firstLine}`,
  ].join("\n");
}

function defaultRequestOfficeJsExecuteApproval(
  request: OfficeJsExecuteApprovalRequest,
): Promise<boolean> {
  if (typeof window === "undefined" || typeof window.confirm !== "function") {
    return Promise.reject(new Error(
      "Office.js execution requires explicit user approval, but confirmation UI is unavailable.",
    ));
  }

  return Promise.resolve(window.confirm(getOfficeJsApprovalMessage(request)));
}

function getOfficeJsExecuteApprovalRequest(params: unknown): OfficeJsExecuteApprovalRequest {
  if (!isRecordObject(params)) {
    return {
      explanation: "",
      code: "",
    };
  }

  const explanation = typeof params.explanation === "string"
    ? params.explanation
    : "";

  const code = typeof params.code === "string"
    ? params.code
    : "";

  return {
    explanation,
    code,
  };
}

function wrapTmuxToolWithHardGate(
  tool: AgentTool,
  dependencies: ExperimentalToolGateDependencies,
): AgentTool {
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const gate = await evaluateTmuxBridgeGate(dependencies);
      if (!gate.allowed) {
        const reason = gate.reason ?? "bridge_unreachable";
        throw new Error(buildTmuxBridgeGateErrorMessage(reason));
      }

      return tool.execute(toolCallId, params, signal, onUpdate);
    },
  };
}

function wrapFilesToolWithHardGate(
  tool: AgentTool,
  dependencies: ExperimentalToolGateDependencies,
): AgentTool {
  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const gate = evaluateFilesWorkspaceGate(dependencies);
      if (!gate.allowed && !allowsFilesActionWhenExperimentDisabled(params)) {
        const reason = gate.reason ?? "files_experiment_disabled";
        throw new Error(buildFilesWorkspaceGateErrorMessage(reason));
      }

      return tool.execute(toolCallId, params, signal, onUpdate);
    },
  };
}

function wrapExecuteOfficeJsToolWithHardGate(
  tool: AgentTool,
  dependencies: ExperimentalToolGateDependencies,
): AgentTool {
  const requestApproval =
    dependencies.requestOfficeJsExecuteApproval
    ?? defaultRequestOfficeJsExecuteApproval;

  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const approved = await requestApproval(getOfficeJsExecuteApprovalRequest(params));
      if (!approved) {
        throw new Error("Office.js execution cancelled by user.");
      }

      return tool.execute(toolCallId, params, signal, onUpdate);
    },
  };
}

function wrapPythonBridgeToolWithHardGate(
  tool: AgentTool,
  dependencies: ExperimentalToolGateDependencies,
): AgentTool {
  const requestApproval = dependencies.requestPythonBridgeApproval ?? defaultRequestPythonBridgeApproval;
  const getApprovedBridgeUrl =
    dependencies.getApprovedPythonBridgeUrl
    ?? defaultGetApprovedPythonBridgeUrl;
  const setApprovedBridgeUrl =
    dependencies.setApprovedPythonBridgeUrl
    ?? defaultSetApprovedPythonBridgeUrl;

  return {
    ...tool,
    execute: async (toolCallId, params, signal, onUpdate) => {
      const gate = await evaluatePythonBridgeGate(dependencies);
      if (!gate.allowed) {
        const reason = gate.reason ?? "bridge_unreachable";
        throw new Error(buildPythonBridgeGateErrorMessage(reason));
      }

      const bridgeUrl = gate.bridgeUrl;
      if (!bridgeUrl) {
        throw new Error("Python bridge gate did not return a bridge URL.");
      }

      const cachedApprovalUrl = await getApprovedBridgeUrl();
      if (cachedApprovalUrl !== bridgeUrl) {
        const approved = await requestApproval({
          toolName: tool.name,
          bridgeUrl,
          params,
        });
        if (!approved) {
          throw new Error("Python/LibreOffice execution cancelled by user.");
        }

        await setApprovedBridgeUrl(bridgeUrl);
      }

      return tool.execute(toolCallId, params, signal, onUpdate);
    },
  };
}

/**
 * Apply execution gates to tool calls.
 *
 * Current rules:
 * - `tmux`, `files`, `execute_office_js`, `python_run`, `libreoffice_convert`, and
 *   `python_transform_range` stay registered to keep the tool list stable.
 * - bridge-backed tools re-check experiment flags (and bridge health) on every execution.
 * - `files` keeps list/read available when disabled, but still gates write/delete.
 * - python/libreoffice bridge tools require user confirmation once per configured bridge URL.
 * - execute_office_js requires explicit user confirmation on every execution.
 */
export function applyExperimentalToolGates(
  tools: AgentTool[],
  dependencies: ExperimentalToolGateDependencies = {},
): Promise<AgentTool[]> {
  const gatedTools: AgentTool[] = [];

  for (const tool of tools) {
    if (tool.name === TMUX_TOOL_NAME) {
      gatedTools.push(wrapTmuxToolWithHardGate(tool, dependencies));
      continue;
    }

    if (tool.name === FILES_TOOL_NAME) {
      gatedTools.push(wrapFilesToolWithHardGate(tool, dependencies));
      continue;
    }

    if (tool.name === EXECUTE_OFFICE_JS_TOOL_NAME) {
      gatedTools.push(wrapExecuteOfficeJsToolWithHardGate(tool, dependencies));
      continue;
    }

    if (PYTHON_TOOL_NAMES.has(tool.name)) {
      gatedTools.push(wrapPythonBridgeToolWithHardGate(tool, dependencies));
      continue;
    }

    gatedTools.push(tool);
  }

  return Promise.resolve(gatedTools);
}
