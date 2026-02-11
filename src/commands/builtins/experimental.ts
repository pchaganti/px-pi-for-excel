/**
 * Builtin command for managing experimental feature flags.
 */

import type { SlashCommand } from "../types.js";
import {
  getExperimentalFeatureSlugs,
  isExperimentalFeatureEnabled,
  resolveExperimentalFeature,
  setExperimentalFeatureEnabled,
  toggleExperimentalFeature,
  type ExperimentalFeatureDefinition,
  type ExperimentalFeatureId,
} from "../../experiments/flags.js";
import { validateOfficeProxyUrl } from "../../auth/proxy-validation.js";
import { dispatchExperimentalToolConfigChanged } from "../../experiments/events.js";
import {
  buildTmuxBridgeGateErrorMessage,
  TMUX_BRIDGE_URL_SETTING_KEY,
  type TmuxBridgeGateReason,
  type TmuxBridgeGateResult,
} from "../../tools/experimental-tool-gates.js";
import { TMUX_BRIDGE_TOKEN_SETTING_KEY } from "../../tools/tmux.js";
import { isRecord } from "../../utils/type-guards.js";
import { showToast } from "../../ui/toast.js";
import { showExperimentalDialog } from "./experimental-overlay.js";

const ENABLE_ACTIONS = new Set(["enable", "on"]);
const DISABLE_ACTIONS = new Set(["disable", "off"]);
const TOGGLE_ACTIONS = new Set(["toggle"]);
const OPEN_ACTIONS = new Set(["open", "ui", "list", "status"]);
const TMUX_BRIDGE_URL_ACTIONS = new Set(["tmux-bridge-url", "tmux-url", "bridge-url"]);
const TMUX_BRIDGE_URL_CLEAR_ACTIONS = new Set(["clear", "unset", "none"]);
const TMUX_BRIDGE_URL_SHOW_ACTIONS = new Set(["show", "status", "get"]);
const TMUX_BRIDGE_TOKEN_ACTIONS = new Set(["tmux-bridge-token", "tmux-token", "bridge-token"]);
const TMUX_BRIDGE_TOKEN_CLEAR_ACTIONS = new Set(["clear", "unset", "none"]);
const TMUX_BRIDGE_TOKEN_SHOW_ACTIONS = new Set(["show", "status", "get"]);
const TMUX_STATUS_ACTIONS = new Set(["tmux-status", "tmux-bridge-status", "bridge-status"]);
const TMUX_BRIDGE_HEALTH_TIMEOUT_MS = 1500;

type FeatureResolver = (input: string) => ExperimentalFeatureDefinition | null;

export interface TmuxBridgeHealthStatus {
  reachable: boolean;
  status?: number;
  mode?: string;
  backend?: string;
  sessions?: number;
  error?: string;
}

export interface ExperimentalCommandDependencies {
  showToast?: (message: string) => void;
  showExperimentalDialog?: () => void;
  getFeatureSlugs?: () => string[];
  resolveFeature?: FeatureResolver;
  setFeatureEnabled?: (featureId: ExperimentalFeatureId, enabled: boolean) => void;
  toggleFeature?: (featureId: ExperimentalFeatureId) => boolean;
  getTmuxBridgeUrl?: () => Promise<string | undefined>;
  setTmuxBridgeUrl?: (url: string) => Promise<void>;
  clearTmuxBridgeUrl?: () => Promise<void>;
  validateTmuxBridgeUrl?: (url: string) => string;
  getTmuxBridgeToken?: () => Promise<string | undefined>;
  setTmuxBridgeToken?: (token: string) => Promise<void>;
  clearTmuxBridgeToken?: () => Promise<void>;
  validateTmuxBridgeToken?: (token: string) => string;
  isTmuxBridgeEnabled?: () => boolean;
  probeTmuxBridgeHealth?: (bridgeUrl: string) => Promise<TmuxBridgeHealthStatus>;
  notifyToolConfigChanged?: (configKey: string) => void;
}

interface ResolvedExperimentalCommandDependencies {
  showToast: (message: string) => void;
  showExperimentalDialog: () => void;
  getFeatureSlugs: () => string[];
  resolveFeature: FeatureResolver;
  setFeatureEnabled: (featureId: ExperimentalFeatureId, enabled: boolean) => void;
  toggleFeature: (featureId: ExperimentalFeatureId) => boolean;
  getTmuxBridgeUrl: () => Promise<string | undefined>;
  setTmuxBridgeUrl: (url: string) => Promise<void>;
  clearTmuxBridgeUrl: () => Promise<void>;
  validateTmuxBridgeUrl: (url: string) => string;
  getTmuxBridgeToken: () => Promise<string | undefined>;
  setTmuxBridgeToken: (token: string) => Promise<void>;
  clearTmuxBridgeToken: () => Promise<void>;
  validateTmuxBridgeToken: (token: string) => string;
  isTmuxBridgeEnabled: () => boolean;
  probeTmuxBridgeHealth: (bridgeUrl: string) => Promise<TmuxBridgeHealthStatus>;
  notifyToolConfigChanged: (configKey: string) => void;
}

function tokenize(args: string): string[] {
  return args
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0);
}

function usageText(): string {
  return (
    "Usage: /experimental [list|on|off|toggle] <feature> " +
    "| /experimental tmux-bridge-url [<url>|show|clear] " +
    "| /experimental tmux-bridge-token [<token>|show|clear] " +
    "| /experimental tmux-status"
  );
}

function featureListText(getFeatureSlugs: () => string[]): string {
  const slugs = getFeatureSlugs();
  return slugs.length > 0 ? slugs.join(", ") : "(none)";
}

async function getSettingsStore() {
  const storageModule = await import("@mariozechner/pi-web-ui/dist/storage/app-storage.js");
  return storageModule.getAppStorage().settings;
}

async function defaultGetTmuxBridgeUrl(): Promise<string | undefined> {
  try {
    const settings = await getSettingsStore();
    const value = await settings.get<string>(TMUX_BRIDGE_URL_SETTING_KEY);
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function defaultSetTmuxBridgeUrl(url: string): Promise<void> {
  const settings = await getSettingsStore();
  await settings.set(TMUX_BRIDGE_URL_SETTING_KEY, url);
}

async function defaultClearTmuxBridgeUrl(): Promise<void> {
  const settings = await getSettingsStore();
  await settings.delete(TMUX_BRIDGE_URL_SETTING_KEY);
}

async function defaultGetTmuxBridgeToken(): Promise<string | undefined> {
  try {
    const settings = await getSettingsStore();
    const value = await settings.get<string>(TMUX_BRIDGE_TOKEN_SETTING_KEY);
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function defaultSetTmuxBridgeToken(token: string): Promise<void> {
  const settings = await getSettingsStore();
  await settings.set(TMUX_BRIDGE_TOKEN_SETTING_KEY, token);
}

async function defaultClearTmuxBridgeToken(): Promise<void> {
  const settings = await getSettingsStore();
  await settings.delete(TMUX_BRIDGE_TOKEN_SETTING_KEY);
}

function defaultValidateTmuxBridgeToken(token: string): string {
  const normalized = token.trim();
  if (normalized.length === 0) {
    throw new Error("Tmux bridge token cannot be empty.");
  }

  if (/\s/u.test(normalized)) {
    throw new Error("Tmux bridge token must not contain whitespace.");
  }

  if (normalized.length > 512) {
    throw new Error("Tmux bridge token is too long (max 512 characters).");
  }

  return normalized;
}

function maskToken(token: string): string {
  if (token.length <= 4) {
    return "*".repeat(token.length);
  }

  if (token.length <= 8) {
    return `${token.slice(0, 2)}${"*".repeat(token.length - 2)}`;
  }

  const hiddenLength = token.length - 6;
  return `${token.slice(0, 4)}${"*".repeat(hiddenLength)}${token.slice(-2)}`;
}

function defaultIsTmuxBridgeEnabled(): boolean {
  return isExperimentalFeatureEnabled("tmux_bridge");
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeOptionalInteger(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return undefined;
  }

  return value;
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function resolveDependencies(
  dependencies: ExperimentalCommandDependencies,
): ResolvedExperimentalCommandDependencies {
  return {
    showToast: dependencies.showToast ?? showToast,
    showExperimentalDialog: dependencies.showExperimentalDialog ?? showExperimentalDialog,
    getFeatureSlugs: dependencies.getFeatureSlugs ?? getExperimentalFeatureSlugs,
    resolveFeature: dependencies.resolveFeature ?? resolveExperimentalFeature,
    setFeatureEnabled: dependencies.setFeatureEnabled ?? setExperimentalFeatureEnabled,
    toggleFeature: dependencies.toggleFeature ?? toggleExperimentalFeature,
    getTmuxBridgeUrl: dependencies.getTmuxBridgeUrl ?? defaultGetTmuxBridgeUrl,
    setTmuxBridgeUrl: dependencies.setTmuxBridgeUrl ?? defaultSetTmuxBridgeUrl,
    clearTmuxBridgeUrl: dependencies.clearTmuxBridgeUrl ?? defaultClearTmuxBridgeUrl,
    validateTmuxBridgeUrl: dependencies.validateTmuxBridgeUrl ?? validateOfficeProxyUrl,
    getTmuxBridgeToken: dependencies.getTmuxBridgeToken ?? defaultGetTmuxBridgeToken,
    setTmuxBridgeToken: dependencies.setTmuxBridgeToken ?? defaultSetTmuxBridgeToken,
    clearTmuxBridgeToken: dependencies.clearTmuxBridgeToken ?? defaultClearTmuxBridgeToken,
    validateTmuxBridgeToken: dependencies.validateTmuxBridgeToken ?? defaultValidateTmuxBridgeToken,
    isTmuxBridgeEnabled: dependencies.isTmuxBridgeEnabled ?? defaultIsTmuxBridgeEnabled,
    probeTmuxBridgeHealth: dependencies.probeTmuxBridgeHealth ?? defaultProbeTmuxBridgeHealth,
    notifyToolConfigChanged: dependencies.notifyToolConfigChanged ?? ((configKey: string) => {
      dispatchExperimentalToolConfigChanged({ configKey });
    }),
  };
}

function asErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }
  return fallback;
}

async function defaultProbeTmuxBridgeHealth(bridgeUrl: string): Promise<TmuxBridgeHealthStatus> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, TMUX_BRIDGE_HEALTH_TIMEOUT_MS);

  try {
    const target = `${bridgeUrl.replace(/\/+$/u, "")}/health`;
    const response = await fetch(target, {
      method: "GET",
      signal: controller.signal,
    });

    const bodyText = await response.text();
    const parsed = tryParseJson(bodyText);

    const status = normalizeOptionalInteger(response.status);
    let mode: string | undefined;
    let backend: string | undefined;
    let sessions: number | undefined;
    let error: string | undefined;

    if (isRecord(parsed)) {
      mode = normalizeOptionalString(parsed.mode);
      backend = normalizeOptionalString(parsed.backend);
      sessions = normalizeOptionalInteger(parsed.sessions);
      error = normalizeOptionalString(parsed.error);
    } else if (!response.ok) {
      error = normalizeOptionalString(bodyText);
    }

    return {
      reachable: response.ok,
      status,
      mode,
      backend,
      sessions,
      error,
    };
  } catch (error: unknown) {
    return {
      reachable: false,
      error: asErrorMessage(error, "Health check failed."),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function handleTmuxBridgeUrlCommand(
  valueTokens: string[],
  dependencies: ResolvedExperimentalCommandDependencies,
): Promise<void> {
  if (valueTokens.length === 0) {
    const existing = await dependencies.getTmuxBridgeUrl();
    if (!existing) {
      dependencies.showToast(
        "Tmux bridge URL is not set. Example: /experimental tmux-bridge-url https://localhost:3337",
      );
      return;
    }

    dependencies.showToast(`Tmux bridge URL: ${existing}`);
    return;
  }

  const firstToken = valueTokens[0].toLowerCase();
  if (TMUX_BRIDGE_URL_SHOW_ACTIONS.has(firstToken)) {
    const existing = await dependencies.getTmuxBridgeUrl();
    if (!existing) {
      dependencies.showToast(
        "Tmux bridge URL is not set. Example: /experimental tmux-bridge-url https://localhost:3337",
      );
      return;
    }

    dependencies.showToast(`Tmux bridge URL: ${existing}`);
    return;
  }

  if (valueTokens.length === 1 && TMUX_BRIDGE_URL_CLEAR_ACTIONS.has(firstToken)) {
    await dependencies.clearTmuxBridgeUrl();
    dependencies.notifyToolConfigChanged(TMUX_BRIDGE_URL_SETTING_KEY);
    dependencies.showToast("Tmux bridge URL cleared.");
    return;
  }

  const candidateUrl = valueTokens.join(" ");
  const normalized = dependencies.validateTmuxBridgeUrl(candidateUrl);
  await dependencies.setTmuxBridgeUrl(normalized);
  dependencies.notifyToolConfigChanged(TMUX_BRIDGE_URL_SETTING_KEY);
  dependencies.showToast(`Tmux bridge URL set to ${normalized}`);
}

async function handleTmuxBridgeTokenCommand(
  valueTokens: string[],
  dependencies: ResolvedExperimentalCommandDependencies,
): Promise<void> {
  if (valueTokens.length === 0) {
    const existing = await dependencies.getTmuxBridgeToken();
    if (!existing) {
      dependencies.showToast(
        "Tmux bridge token is not set. Example: /experimental tmux-bridge-token <token>",
      );
      return;
    }

    dependencies.showToast(`Tmux bridge token: ${maskToken(existing)} (length ${existing.length})`);
    return;
  }

  const firstToken = valueTokens[0].toLowerCase();
  if (TMUX_BRIDGE_TOKEN_SHOW_ACTIONS.has(firstToken)) {
    const existing = await dependencies.getTmuxBridgeToken();
    if (!existing) {
      dependencies.showToast(
        "Tmux bridge token is not set. Example: /experimental tmux-bridge-token <token>",
      );
      return;
    }

    dependencies.showToast(`Tmux bridge token: ${maskToken(existing)} (length ${existing.length})`);
    return;
  }

  if (valueTokens.length === 1 && TMUX_BRIDGE_TOKEN_CLEAR_ACTIONS.has(firstToken)) {
    await dependencies.clearTmuxBridgeToken();
    dependencies.notifyToolConfigChanged(TMUX_BRIDGE_TOKEN_SETTING_KEY);
    dependencies.showToast("Tmux bridge token cleared.");
    return;
  }

  const candidateToken = valueTokens.join(" ");
  const normalized = dependencies.validateTmuxBridgeToken(candidateToken);
  await dependencies.setTmuxBridgeToken(normalized);
  dependencies.notifyToolConfigChanged(TMUX_BRIDGE_TOKEN_SETTING_KEY);
  dependencies.showToast(`Tmux bridge token set (${maskToken(normalized)}).`);
}

async function handleTmuxStatusCommand(
  dependencies: ResolvedExperimentalCommandDependencies,
): Promise<void> {
  const featureEnabled = dependencies.isTmuxBridgeEnabled();
  const configuredBridgeUrl = await dependencies.getTmuxBridgeUrl();
  const configuredToken = await dependencies.getTmuxBridgeToken();

  let normalizedBridgeUrl: string | undefined;
  let bridgeUrlValidationError: string | undefined;

  if (configuredBridgeUrl) {
    try {
      normalizedBridgeUrl = dependencies.validateTmuxBridgeUrl(configuredBridgeUrl);
    } catch (error: unknown) {
      bridgeUrlValidationError = asErrorMessage(error, "invalid bridge URL");
    }
  }

  const health = normalizedBridgeUrl
    ? await dependencies.probeTmuxBridgeHealth(normalizedBridgeUrl)
    : undefined;

  let gateReason: TmuxBridgeGateReason | undefined;
  if (!featureEnabled) {
    gateReason = "tmux_experiment_disabled";
  } else if (!configuredBridgeUrl) {
    gateReason = "missing_bridge_url";
  } else if (!normalizedBridgeUrl) {
    gateReason = "invalid_bridge_url";
  } else if (!health?.reachable) {
    gateReason = "bridge_unreachable";
  }

  const gate: TmuxBridgeGateResult = gateReason
    ? {
      allowed: false,
      reason: gateReason,
      bridgeUrl: normalizedBridgeUrl,
    }
    : {
      allowed: true,
      bridgeUrl: normalizedBridgeUrl,
    };

  const lines: string[] = ["Tmux bridge status:"];
  lines.push(`- feature flag (tmux-bridge): ${featureEnabled ? "enabled" : "disabled"}`);

  if (!configuredBridgeUrl) {
    lines.push("- bridge URL: not set");
  } else if (normalizedBridgeUrl) {
    lines.push(`- bridge URL: ${normalizedBridgeUrl}`);
  } else {
    lines.push(`- bridge URL: invalid (${bridgeUrlValidationError ?? configuredBridgeUrl})`);
  }

  if (!configuredToken) {
    lines.push("- auth token: not set");
  } else {
    lines.push(`- auth token: set (${maskToken(configuredToken)}, length ${configuredToken.length})`);
  }

  if (gate.allowed) {
    lines.push("- gate: pass");
  } else {
    const reason = gate.reason ?? "bridge_unreachable";
    lines.push(`- gate: blocked (${reason})`);
    lines.push(`  hint: ${buildTmuxBridgeGateErrorMessage(reason)}`);
  }

  if (!health) {
    lines.push("- health: not checked (set a valid tmux bridge URL first)");
  } else if (health.reachable) {
    const details: string[] = [];
    if (health.status !== undefined) details.push(`HTTP ${health.status}`);
    if (health.mode) details.push(`mode=${health.mode}`);
    if (health.backend) details.push(`backend=${health.backend}`);
    if (health.sessions !== undefined) details.push(`sessions=${health.sessions}`);

    const suffix = details.length > 0 ? ` (${details.join(", ")})` : "";
    lines.push(`- health: reachable${suffix}`);
  } else {
    const details: string[] = [];
    if (health.status !== undefined) details.push(`HTTP ${health.status}`);
    if (health.error) details.push(health.error);

    const suffix = details.length > 0 ? ` (${details.join("; ")})` : "";
    lines.push(`- health: unreachable${suffix}`);
  }

  dependencies.showToast(lines.join("\n"));
}

export function createExperimentalCommands(
  dependencies: ExperimentalCommandDependencies = {},
): SlashCommand[] {
  const resolved = resolveDependencies(dependencies);

  return [
    {
      name: "experimental",
      description: "Manage experimental features",
      source: "builtin",
      execute: async (args: string) => {
        try {
          const tokens = tokenize(args);
          if (tokens.length === 0) {
            resolved.showExperimentalDialog();
            return;
          }

          const action = tokens[0].toLowerCase();

          if (action === "help") {
            resolved.showToast(`${usageText()} • Features: ${featureListText(resolved.getFeatureSlugs)}`);
            return;
          }

          if (OPEN_ACTIONS.has(action)) {
            resolved.showExperimentalDialog();
            return;
          }

          if (TMUX_BRIDGE_URL_ACTIONS.has(action)) {
            await handleTmuxBridgeUrlCommand(tokens.slice(1), resolved);
            return;
          }

          if (TMUX_BRIDGE_TOKEN_ACTIONS.has(action)) {
            await handleTmuxBridgeTokenCommand(tokens.slice(1), resolved);
            return;
          }

          if (TMUX_STATUS_ACTIONS.has(action)) {
            if (tokens.length > 1) {
              resolved.showToast("Usage: /experimental tmux-status");
              return;
            }

            await handleTmuxStatusCommand(resolved);
            return;
          }

          const isToggleAction =
            ENABLE_ACTIONS.has(action) ||
            DISABLE_ACTIONS.has(action) ||
            TOGGLE_ACTIONS.has(action);

          if (!isToggleAction) {
            resolved.showToast(usageText());
            return;
          }

          const featureArg = tokens.slice(1).join(" ");
          if (!featureArg) {
            resolved.showToast(`${usageText()} • Features: ${featureListText(resolved.getFeatureSlugs)}`);
            return;
          }

          const feature = resolved.resolveFeature(featureArg);
          if (!feature) {
            resolved.showToast(
              `Unknown feature: ${featureArg}. Available: ${featureListText(resolved.getFeatureSlugs)}`,
            );
            return;
          }

          let enabled = false;

          if (ENABLE_ACTIONS.has(action)) {
            resolved.setFeatureEnabled(feature.id, true);
            enabled = true;
          } else if (DISABLE_ACTIONS.has(action)) {
            resolved.setFeatureEnabled(feature.id, false);
            enabled = false;
          } else {
            enabled = resolved.toggleFeature(feature.id);
          }

          const suffix = feature.wiring === "flag-only"
            ? " (flag saved; feature not wired yet)"
            : "";
          resolved.showToast(`${feature.title}: ${enabled ? "enabled" : "disabled"}${suffix}`);
        } catch (error: unknown) {
          resolved.showToast(asErrorMessage(error, "Failed to run /experimental command."));
        }
      },
    },
  ];
}
