/**
 * Experimental tool gatekeeper.
 *
 * Security posture for local-bridge capabilities (tmux, future execution tools):
 * - capability must be explicitly enabled via /experimental
 * - local bridge URL must be configured
 * - bridge must be reachable at execution time
 * - tool remains registered (stable tool list / prompt caching)
 * - execution performs a hard gate check (defense in depth)
 */

import type { AgentTool } from "@mariozechner/pi-agent-core";

import { validateOfficeProxyUrl } from "../auth/proxy-validation.js";
import { isExperimentalFeatureEnabled } from "../experiments/flags.js";

const TMUX_TOOL_NAME = "tmux";
const TMUX_BRIDGE_HEALTH_PATH = "/health";
const TMUX_BRIDGE_HEALTH_TIMEOUT_MS = 900;

export const TMUX_BRIDGE_URL_SETTING_KEY = "tmux.bridge.url";

export type TmuxBridgeGateReason =
  | "tmux_experiment_disabled"
  | "missing_bridge_url"
  | "invalid_bridge_url"
  | "bridge_unreachable";

export interface TmuxBridgeGateResult {
  allowed: boolean;
  bridgeUrl?: string;
  reason?: TmuxBridgeGateReason;
}

export interface TmuxBridgeGateDependencies {
  isTmuxExperimentEnabled?: () => boolean;
  getTmuxBridgeUrl?: () => Promise<string | undefined>;
  validateBridgeUrl?: (url: string) => string | null;
  probeTmuxBridge?: (bridgeUrl: string) => Promise<boolean>;
}

function defaultIsTmuxExperimentEnabled(): boolean {
  return isExperimentalFeatureEnabled("tmux_bridge");
}

async function defaultGetTmuxBridgeUrl(): Promise<string | undefined> {
  try {
    const storageModule = await import("@mariozechner/pi-web-ui/dist/storage/app-storage.js");
    const storage = storageModule.getAppStorage();
    const value = await storage.settings.get<string>(TMUX_BRIDGE_URL_SETTING_KEY);
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

function defaultValidateBridgeUrl(url: string): string | null {
  try {
    return validateOfficeProxyUrl(url);
  } catch {
    return null;
  }
}

async function defaultProbeTmuxBridge(bridgeUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TMUX_BRIDGE_HEALTH_TIMEOUT_MS);

  try {
    const target = `${bridgeUrl.replace(/\/+$/, "")}${TMUX_BRIDGE_HEALTH_PATH}`;
    const response = await fetch(target, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function evaluateTmuxBridgeGate(
  dependencies: TmuxBridgeGateDependencies = {},
): Promise<TmuxBridgeGateResult> {
  const isEnabled = dependencies.isTmuxExperimentEnabled ?? defaultIsTmuxExperimentEnabled;
  if (!isEnabled()) {
    return {
      allowed: false,
      reason: "tmux_experiment_disabled",
    };
  }

  const getBridgeUrl = dependencies.getTmuxBridgeUrl ?? defaultGetTmuxBridgeUrl;
  const rawBridgeUrl = await getBridgeUrl();
  if (!rawBridgeUrl) {
    return {
      allowed: false,
      reason: "missing_bridge_url",
    };
  }

  const validateBridgeUrl = dependencies.validateBridgeUrl ?? defaultValidateBridgeUrl;
  const bridgeUrl = validateBridgeUrl(rawBridgeUrl);
  if (!bridgeUrl) {
    return {
      allowed: false,
      reason: "invalid_bridge_url",
    };
  }

  const probeTmuxBridge = dependencies.probeTmuxBridge ?? defaultProbeTmuxBridge;
  const reachable = await probeTmuxBridge(bridgeUrl);
  if (!reachable) {
    return {
      allowed: false,
      reason: "bridge_unreachable",
      bridgeUrl,
    };
  }

  return {
    allowed: true,
    bridgeUrl,
  };
}

export function buildTmuxBridgeGateErrorMessage(reason: TmuxBridgeGateReason): string {
  switch (reason) {
    case "tmux_experiment_disabled":
      return "Tmux bridge is disabled. Enable it with /experimental on tmux-bridge.";
    case "missing_bridge_url":
      return `Tmux bridge URL is not configured. Run /experimental tmux-bridge-url https://localhost:<port> (setting: ${TMUX_BRIDGE_URL_SETTING_KEY}).`;
    case "invalid_bridge_url":
      return "Tmux bridge URL is invalid. Use a full URL like https://localhost:3337.";
    case "bridge_unreachable":
      return "Tmux bridge is not reachable at the configured URL.";
  }
}

function wrapTmuxToolWithHardGate(
  tool: AgentTool,
  dependencies: TmuxBridgeGateDependencies,
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

/**
 * Apply experimental gates to tool execution.
 *
 * Current rule:
 * - `tmux` stays registered to keep the tool list stable
 * - `tmux` execution always re-checks experiment flag, URL, and bridge health
 */
export function applyExperimentalToolGates(
  tools: AgentTool[],
  dependencies: TmuxBridgeGateDependencies = {},
): Promise<AgentTool[]> {
  const gatedTools: AgentTool[] = [];

  for (const tool of tools) {
    if (tool.name !== TMUX_TOOL_NAME) {
      gatedTools.push(tool);
      continue;
    }

    gatedTools.push(wrapTmuxToolWithHardGate(tool, dependencies));
  }

  return Promise.resolve(gatedTools);
}
