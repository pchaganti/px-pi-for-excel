import { validateOfficeProxyUrl } from "../../auth/proxy-validation.js";
import { isExperimentalFeatureEnabled } from "../../experiments/flags.js";

import {
  PYTHON_BRIDGE_APPROVED_URL_SETTING_KEY,
  PYTHON_BRIDGE_URL_SETTING_KEY,
  TMUX_BRIDGE_URL_SETTING_KEY,
  type FilesWorkspaceGateDependencies,
  type FilesWorkspaceGateReason,
  type FilesWorkspaceGateResult,
  type PythonBridgeGateDependencies,
  type PythonBridgeGateReason,
  type PythonBridgeGateResult,
  type TmuxBridgeGateDependencies,
  type TmuxBridgeGateReason,
  type TmuxBridgeGateResult,
} from "./types.js";

const BRIDGE_HEALTH_PATH = "/health";
const BRIDGE_HEALTH_TIMEOUT_MS = 900;

function defaultIsTmuxExperimentEnabled(): boolean {
  return isExperimentalFeatureEnabled("tmux_bridge");
}

function defaultIsPythonExperimentEnabled(): boolean {
  return isExperimentalFeatureEnabled("python_bridge");
}

function defaultIsFilesWorkspaceExperimentEnabled(): boolean {
  return isExperimentalFeatureEnabled("files_workspace");
}

async function defaultGetBridgeUrl(settingKey: string): Promise<string | undefined> {
  try {
    const storageModule = await import("@mariozechner/pi-web-ui/dist/storage/app-storage.js");
    const storage = storageModule.getAppStorage();
    const value = await storage.settings.get<string>(settingKey);
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function defaultGetTmuxBridgeUrl(): Promise<string | undefined> {
  return defaultGetBridgeUrl(TMUX_BRIDGE_URL_SETTING_KEY);
}

async function defaultGetPythonBridgeUrl(): Promise<string | undefined> {
  return defaultGetBridgeUrl(PYTHON_BRIDGE_URL_SETTING_KEY);
}

async function defaultSetBridgeSetting(settingKey: string, value: string): Promise<void> {
  try {
    const storageModule = await import("@mariozechner/pi-web-ui/dist/storage/app-storage.js");
    const storage = storageModule.getAppStorage();
    await storage.settings.set(settingKey, value);
  } catch {
    // ignore (approval prompt will continue to appear if persistence is unavailable)
  }
}

export async function defaultGetApprovedPythonBridgeUrl(): Promise<string | undefined> {
  return defaultGetBridgeUrl(PYTHON_BRIDGE_APPROVED_URL_SETTING_KEY);
}

export async function defaultSetApprovedPythonBridgeUrl(bridgeUrl: string): Promise<void> {
  await defaultSetBridgeSetting(PYTHON_BRIDGE_APPROVED_URL_SETTING_KEY, bridgeUrl);
}

function defaultValidateBridgeUrl(url: string): string | null {
  try {
    return validateOfficeProxyUrl(url);
  } catch {
    return null;
  }
}

async function defaultProbeBridge(bridgeUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, BRIDGE_HEALTH_TIMEOUT_MS);

  try {
    const target = `${bridgeUrl.replace(/\/+$/, "")}${BRIDGE_HEALTH_PATH}`;
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

  const probeTmuxBridge = dependencies.probeTmuxBridge ?? defaultProbeBridge;
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

export async function evaluatePythonBridgeGate(
  dependencies: PythonBridgeGateDependencies = {},
): Promise<PythonBridgeGateResult> {
  const isEnabled = dependencies.isPythonExperimentEnabled ?? defaultIsPythonExperimentEnabled;
  if (!isEnabled()) {
    return {
      allowed: false,
      reason: "python_experiment_disabled",
    };
  }

  const getBridgeUrl = dependencies.getPythonBridgeUrl ?? defaultGetPythonBridgeUrl;
  const rawBridgeUrl = await getBridgeUrl();
  if (!rawBridgeUrl) {
    return {
      allowed: false,
      reason: "missing_bridge_url",
    };
  }

  const validateBridgeUrl = dependencies.validatePythonBridgeUrl ?? defaultValidateBridgeUrl;
  const bridgeUrl = validateBridgeUrl(rawBridgeUrl);
  if (!bridgeUrl) {
    return {
      allowed: false,
      reason: "invalid_bridge_url",
    };
  }

  const probePythonBridge = dependencies.probePythonBridge ?? defaultProbeBridge;
  const reachable = await probePythonBridge(bridgeUrl);
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

export function evaluateFilesWorkspaceGate(
  dependencies: FilesWorkspaceGateDependencies = {},
): FilesWorkspaceGateResult {
  const isEnabled =
    dependencies.isFilesWorkspaceExperimentEnabled
    ?? defaultIsFilesWorkspaceExperimentEnabled;

  if (!isEnabled()) {
    return {
      allowed: false,
      reason: "files_experiment_disabled",
    };
  }

  return { allowed: true };
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

export function buildPythonBridgeGateErrorMessage(reason: PythonBridgeGateReason): string {
  switch (reason) {
    case "python_experiment_disabled":
      return "Python bridge is disabled. Enable it with /experimental on python-bridge.";
    case "missing_bridge_url":
      return `Python bridge URL is not configured. Run /experimental python-bridge-url https://localhost:<port> (setting: ${PYTHON_BRIDGE_URL_SETTING_KEY}).`;
    case "invalid_bridge_url":
      return "Python bridge URL is invalid. Use a full URL like https://localhost:3340.";
    case "bridge_unreachable":
      return "Python bridge is not reachable at the configured URL.";
  }
}

export function buildFilesWorkspaceGateErrorMessage(reason: FilesWorkspaceGateReason): string {
  switch (reason) {
    case "files_experiment_disabled":
      return "Files workspace write/delete actions are disabled. Enable them with /experimental on files-workspace.";
  }
}
