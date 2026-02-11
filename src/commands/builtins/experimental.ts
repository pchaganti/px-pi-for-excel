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
import {
  PYTHON_BRIDGE_URL_SETTING_KEY,
  TMUX_BRIDGE_URL_SETTING_KEY,
} from "../../tools/experimental-tool-gates.js";
import { PYTHON_BRIDGE_TOKEN_SETTING_KEY } from "../../tools/python-run.js";
import { TMUX_BRIDGE_TOKEN_SETTING_KEY } from "../../tools/tmux.js";
import { showToast } from "../../ui/toast.js";
import { showExperimentalDialog } from "./experimental-overlay.js";

const ENABLE_ACTIONS = new Set(["enable", "on"]);
const DISABLE_ACTIONS = new Set(["disable", "off"]);
const TOGGLE_ACTIONS = new Set(["toggle"]);
const OPEN_ACTIONS = new Set(["open", "ui", "list", "status"]);

const TMUX_BRIDGE_URL_ACTIONS = new Set(["tmux-bridge-url", "tmux-url", "bridge-url"]);
const PYTHON_BRIDGE_URL_ACTIONS = new Set(["python-bridge-url", "python-url", "libreoffice-bridge-url"]);

const URL_CLEAR_ACTIONS = new Set(["clear", "unset", "none"]);
const URL_SHOW_ACTIONS = new Set(["show", "status", "get"]);

const TMUX_BRIDGE_TOKEN_ACTIONS = new Set(["tmux-bridge-token", "tmux-token", "bridge-token"]);
const PYTHON_BRIDGE_TOKEN_ACTIONS = new Set(["python-bridge-token", "python-token", "libreoffice-bridge-token"]);

const TOKEN_CLEAR_ACTIONS = new Set(["clear", "unset", "none"]);
const TOKEN_SHOW_ACTIONS = new Set(["show", "status", "get"]);

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

  getPythonBridgeUrl?: () => Promise<string | undefined>;
  setPythonBridgeUrl?: (url: string) => Promise<void>;
  clearPythonBridgeUrl?: () => Promise<void>;
  validatePythonBridgeUrl?: (url: string) => string;

  getPythonBridgeToken?: () => Promise<string | undefined>;
  setPythonBridgeToken?: (token: string) => Promise<void>;
  clearPythonBridgeToken?: () => Promise<void>;
  validatePythonBridgeToken?: (token: string) => string;

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

  getPythonBridgeUrl: () => Promise<string | undefined>;
  setPythonBridgeUrl: (url: string) => Promise<void>;
  clearPythonBridgeUrl: () => Promise<void>;
  validatePythonBridgeUrl: (url: string) => string;

  getPythonBridgeToken: () => Promise<string | undefined>;
  setPythonBridgeToken: (token: string) => Promise<void>;
  clearPythonBridgeToken: () => Promise<void>;
  validatePythonBridgeToken: (token: string) => string;

  notifyToolConfigChanged: (configKey: string) => void;
}

interface BridgeUrlCommandConfig {
  bridgeLabel: string;
  commandLabel: string;
  exampleUrl: string;
  configKey: string;
  getValue: () => Promise<string | undefined>;
  setValue: (url: string) => Promise<void>;
  clearValue: () => Promise<void>;
  validate: (url: string) => string;
  showToast: (message: string) => void;
  notifyConfigChanged: (configKey: string) => void;
}

interface BridgeTokenCommandConfig {
  bridgeLabel: string;
  commandLabel: string;
  configKey: string;
  getValue: () => Promise<string | undefined>;
  setValue: (token: string) => Promise<void>;
  clearValue: () => Promise<void>;
  validate: (token: string) => string;
  showToast: (message: string) => void;
  notifyConfigChanged: (configKey: string) => void;
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
    "| /experimental python-bridge-url [<url>|show|clear] " +
    "| /experimental python-bridge-token [<token>|show|clear]"
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

async function defaultGetBridgeUrl(settingKey: string): Promise<string | undefined> {
  try {
    const settings = await getSettingsStore();
    const value = await settings.get<string>(settingKey);
    if (typeof value !== "string") return undefined;

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  } catch {
    return undefined;
  }
}

async function defaultSetSettingValue(settingKey: string, value: string): Promise<void> {
  const settings = await getSettingsStore();
  await settings.set(settingKey, value);
}

async function defaultClearSettingValue(settingKey: string): Promise<void> {
  const settings = await getSettingsStore();
  await settings.delete(settingKey);
}

function defaultValidateBridgeToken(label: string, token: string): string {
  const normalized = token.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} cannot be empty.`);
  }

  if (/\s/u.test(normalized)) {
    throw new Error(`${label} must not contain whitespace.`);
  }

  if (normalized.length > 512) {
    throw new Error(`${label} is too long (max 512 characters).`);
  }

  return normalized;
}

function defaultValidateTmuxBridgeToken(token: string): string {
  return defaultValidateBridgeToken("Tmux bridge token", token);
}

function defaultValidatePythonBridgeToken(token: string): string {
  return defaultValidateBridgeToken("Python bridge token", token);
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

    getTmuxBridgeUrl:
      dependencies.getTmuxBridgeUrl
      ?? (() => defaultGetBridgeUrl(TMUX_BRIDGE_URL_SETTING_KEY)),
    setTmuxBridgeUrl:
      dependencies.setTmuxBridgeUrl
      ?? ((url: string) => defaultSetSettingValue(TMUX_BRIDGE_URL_SETTING_KEY, url)),
    clearTmuxBridgeUrl:
      dependencies.clearTmuxBridgeUrl
      ?? (() => defaultClearSettingValue(TMUX_BRIDGE_URL_SETTING_KEY)),
    validateTmuxBridgeUrl: dependencies.validateTmuxBridgeUrl ?? validateOfficeProxyUrl,

    getTmuxBridgeToken:
      dependencies.getTmuxBridgeToken
      ?? (() => defaultGetBridgeUrl(TMUX_BRIDGE_TOKEN_SETTING_KEY)),
    setTmuxBridgeToken:
      dependencies.setTmuxBridgeToken
      ?? ((token: string) => defaultSetSettingValue(TMUX_BRIDGE_TOKEN_SETTING_KEY, token)),
    clearTmuxBridgeToken:
      dependencies.clearTmuxBridgeToken
      ?? (() => defaultClearSettingValue(TMUX_BRIDGE_TOKEN_SETTING_KEY)),
    validateTmuxBridgeToken: dependencies.validateTmuxBridgeToken ?? defaultValidateTmuxBridgeToken,

    getPythonBridgeUrl:
      dependencies.getPythonBridgeUrl
      ?? (() => defaultGetBridgeUrl(PYTHON_BRIDGE_URL_SETTING_KEY)),
    setPythonBridgeUrl:
      dependencies.setPythonBridgeUrl
      ?? ((url: string) => defaultSetSettingValue(PYTHON_BRIDGE_URL_SETTING_KEY, url)),
    clearPythonBridgeUrl:
      dependencies.clearPythonBridgeUrl
      ?? (() => defaultClearSettingValue(PYTHON_BRIDGE_URL_SETTING_KEY)),
    validatePythonBridgeUrl: dependencies.validatePythonBridgeUrl ?? validateOfficeProxyUrl,

    getPythonBridgeToken:
      dependencies.getPythonBridgeToken
      ?? (() => defaultGetBridgeUrl(PYTHON_BRIDGE_TOKEN_SETTING_KEY)),
    setPythonBridgeToken:
      dependencies.setPythonBridgeToken
      ?? ((token: string) => defaultSetSettingValue(PYTHON_BRIDGE_TOKEN_SETTING_KEY, token)),
    clearPythonBridgeToken:
      dependencies.clearPythonBridgeToken
      ?? (() => defaultClearSettingValue(PYTHON_BRIDGE_TOKEN_SETTING_KEY)),
    validatePythonBridgeToken: dependencies.validatePythonBridgeToken ?? defaultValidatePythonBridgeToken,

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

async function handleBridgeUrlCommand(
  valueTokens: string[],
  config: BridgeUrlCommandConfig,
): Promise<void> {
  const {
    bridgeLabel,
    commandLabel,
    exampleUrl,
    configKey,
    getValue,
    setValue,
    clearValue,
    validate,
    showToast,
    notifyConfigChanged,
  } = config;

  if (valueTokens.length === 0) {
    const existing = await getValue();
    if (!existing) {
      showToast(`${bridgeLabel} URL is not set. Example: /experimental ${commandLabel} ${exampleUrl}`);
      return;
    }

    showToast(`${bridgeLabel} URL: ${existing}`);
    return;
  }

  const firstToken = valueTokens[0].toLowerCase();
  if (URL_SHOW_ACTIONS.has(firstToken)) {
    const existing = await getValue();
    if (!existing) {
      showToast(`${bridgeLabel} URL is not set. Example: /experimental ${commandLabel} ${exampleUrl}`);
      return;
    }

    showToast(`${bridgeLabel} URL: ${existing}`);
    return;
  }

  if (valueTokens.length === 1 && URL_CLEAR_ACTIONS.has(firstToken)) {
    await clearValue();
    notifyConfigChanged(configKey);
    showToast(`${bridgeLabel} URL cleared.`);
    return;
  }

  const candidateUrl = valueTokens.join(" ");
  const normalized = validate(candidateUrl);
  await setValue(normalized);
  notifyConfigChanged(configKey);
  showToast(`${bridgeLabel} URL set to ${normalized}`);
}

async function handleBridgeTokenCommand(
  valueTokens: string[],
  config: BridgeTokenCommandConfig,
): Promise<void> {
  const {
    bridgeLabel,
    commandLabel,
    configKey,
    getValue,
    setValue,
    clearValue,
    validate,
    showToast,
    notifyConfigChanged,
  } = config;

  if (valueTokens.length === 0) {
    const existing = await getValue();
    if (!existing) {
      showToast(`${bridgeLabel} token is not set. Example: /experimental ${commandLabel} <token>`);
      return;
    }

    showToast(`${bridgeLabel} token: ${maskToken(existing)} (length ${existing.length})`);
    return;
  }

  const firstToken = valueTokens[0].toLowerCase();
  if (TOKEN_SHOW_ACTIONS.has(firstToken)) {
    const existing = await getValue();
    if (!existing) {
      showToast(`${bridgeLabel} token is not set. Example: /experimental ${commandLabel} <token>`);
      return;
    }

    showToast(`${bridgeLabel} token: ${maskToken(existing)} (length ${existing.length})`);
    return;
  }

  if (valueTokens.length === 1 && TOKEN_CLEAR_ACTIONS.has(firstToken)) {
    await clearValue();
    notifyConfigChanged(configKey);
    showToast(`${bridgeLabel} token cleared.`);
    return;
  }

  const candidateToken = valueTokens.join(" ");
  const normalized = validate(candidateToken);
  await setValue(normalized);
  notifyConfigChanged(configKey);
  showToast(`${bridgeLabel} token set (${maskToken(normalized)}).`);
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
            await handleBridgeUrlCommand(tokens.slice(1), {
              bridgeLabel: "Tmux bridge",
              commandLabel: "tmux-bridge-url",
              exampleUrl: "https://localhost:3337",
              configKey: TMUX_BRIDGE_URL_SETTING_KEY,
              getValue: resolved.getTmuxBridgeUrl,
              setValue: resolved.setTmuxBridgeUrl,
              clearValue: resolved.clearTmuxBridgeUrl,
              validate: resolved.validateTmuxBridgeUrl,
              showToast: resolved.showToast,
              notifyConfigChanged: resolved.notifyToolConfigChanged,
            });
            return;
          }

          if (TMUX_BRIDGE_TOKEN_ACTIONS.has(action)) {
            await handleBridgeTokenCommand(tokens.slice(1), {
              bridgeLabel: "Tmux bridge",
              commandLabel: "tmux-bridge-token",
              configKey: TMUX_BRIDGE_TOKEN_SETTING_KEY,
              getValue: resolved.getTmuxBridgeToken,
              setValue: resolved.setTmuxBridgeToken,
              clearValue: resolved.clearTmuxBridgeToken,
              validate: resolved.validateTmuxBridgeToken,
              showToast: resolved.showToast,
              notifyConfigChanged: resolved.notifyToolConfigChanged,
            });
            return;
          }

          if (PYTHON_BRIDGE_URL_ACTIONS.has(action)) {
            await handleBridgeUrlCommand(tokens.slice(1), {
              bridgeLabel: "Python bridge",
              commandLabel: "python-bridge-url",
              exampleUrl: "https://localhost:3340",
              configKey: PYTHON_BRIDGE_URL_SETTING_KEY,
              getValue: resolved.getPythonBridgeUrl,
              setValue: resolved.setPythonBridgeUrl,
              clearValue: resolved.clearPythonBridgeUrl,
              validate: resolved.validatePythonBridgeUrl,
              showToast: resolved.showToast,
              notifyConfigChanged: resolved.notifyToolConfigChanged,
            });
            return;
          }

          if (PYTHON_BRIDGE_TOKEN_ACTIONS.has(action)) {
            await handleBridgeTokenCommand(tokens.slice(1), {
              bridgeLabel: "Python bridge",
              commandLabel: "python-bridge-token",
              configKey: PYTHON_BRIDGE_TOKEN_SETTING_KEY,
              getValue: resolved.getPythonBridgeToken,
              setValue: resolved.setPythonBridgeToken,
              clearValue: resolved.clearPythonBridgeToken,
              validate: resolved.validatePythonBridgeToken,
              showToast: resolved.showToast,
              notifyConfigChanged: resolved.notifyToolConfigChanged,
            });
            return;
          }

          const isToggleAction =
            ENABLE_ACTIONS.has(action)
            || DISABLE_ACTIONS.has(action)
            || TOGGLE_ACTIONS.has(action);

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
