/**
 * Builtin command for managing experimental feature flags.
 */

import type { SlashCommand } from "../types.js";
import {
  getExperimentalFeatureSlugs,
  resolveExperimentalFeature,
  setExperimentalFeatureEnabled,
  toggleExperimentalFeature,
  type ExperimentalFeatureDefinition,
  type ExperimentalFeatureId,
} from "../../experiments/flags.js";
import { validateOfficeProxyUrl } from "../../auth/proxy-validation.js";
import { dispatchExperimentalToolConfigChanged } from "../../experiments/events.js";
import { TMUX_BRIDGE_URL_SETTING_KEY } from "../../tools/experimental-tool-gates.js";
import { TMUX_BRIDGE_TOKEN_SETTING_KEY } from "../../tools/tmux.js";
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

type FeatureResolver = (input: string) => ExperimentalFeatureDefinition | null;

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
    "| /experimental tmux-bridge-token [<token>|show|clear]"
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
