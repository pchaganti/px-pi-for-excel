import assert from "node:assert/strict";
import { test } from "node:test";

import { showExtensionsDialog } from "../src/commands/builtins/extensions-overlay.ts";
import { createExtensionAPI } from "../src/commands/extension-api.ts";
import {
  describeStoredExtensionTrust,
  getDefaultPermissionsForTrust,
  listAllExtensionCapabilities,
  listGrantedExtensionCapabilities,
  type StoredExtensionTrust,
} from "../src/extensions/permissions.ts";
import { ExtensionRuntimeManager, type ExtensionRuntimeStatus } from "../src/extensions/runtime-manager.ts";
import { describeExtensionSource } from "../src/extensions/runtime-manager-helpers.ts";
import { describeExtensionRuntimeMode, type ExtensionRuntimeMode } from "../src/extensions/runtime-mode.ts";
import type { ExtensionSettingsStore, StoredExtensionSource } from "../src/extensions/store.ts";
import { closeOverlayById } from "../src/ui/overlay-dialog.ts";
import { EXTENSIONS_OVERLAY_ID, EXTENSION_OVERLAY_ID } from "../src/ui/overlay-ids.ts";
import { installFakeDom } from "./fake-dom.test.ts";

class MemorySettingsStore implements ExtensionSettingsStore {
  get(_key: string): Promise<unknown> {
    return Promise.resolve(null);
  }

  set(_key: string, _value: unknown): Promise<void> {
    return Promise.resolve();
  }
}

class StaticExtensionRuntimeManager extends ExtensionRuntimeManager {
  private readonly statuses: ExtensionRuntimeStatus[];

  constructor(statuses: readonly ExtensionRuntimeStatus[]) {
    super({
      settings: new MemorySettingsStore(),
      getActiveAgent: () => null,
      refreshRuntimeTools: async () => {},
      reservedToolNames: new Set<string>(),
    });

    this.statuses = statuses.map(cloneStatus);
  }

  override list(): ExtensionRuntimeStatus[] {
    return this.statuses.map(cloneStatus);
  }

  override subscribe(_listener: () => void): () => void {
    return () => {};
  }
}

function cloneSource(source: StoredExtensionSource): StoredExtensionSource {
  if (source.kind === "module") {
    return {
      kind: "module",
      specifier: source.specifier,
    };
  }

  return {
    kind: "inline",
    code: source.code,
  };
}

function cloneStatus(status: ExtensionRuntimeStatus): ExtensionRuntimeStatus {
  return {
    ...status,
    source: cloneSource(status.source),
    permissions: { ...status.permissions },
    grantedCapabilities: [...status.grantedCapabilities],
    effectiveCapabilities: [...status.effectiveCapabilities],
    commandNames: [...status.commandNames],
    toolNames: [...status.toolNames],
  };
}

function createRuntimeStatus(input: {
  id: string;
  name: string;
  source: StoredExtensionSource;
  trust: StoredExtensionTrust;
  runtimeMode: ExtensionRuntimeMode;
  enabled?: boolean;
  loaded?: boolean;
  permissionsEnforced?: boolean;
  commandNames?: string[];
  toolNames?: string[];
  lastError?: string | null;
}): ExtensionRuntimeStatus {
  const permissions = getDefaultPermissionsForTrust(input.trust);
  const grantedCapabilities = listGrantedExtensionCapabilities(permissions);
  const effectiveCapabilities = input.permissionsEnforced === true
    ? grantedCapabilities
    : listAllExtensionCapabilities();

  return {
    id: input.id,
    name: input.name,
    enabled: input.enabled ?? true,
    loaded: input.loaded ?? true,
    source: cloneSource(input.source),
    sourceLabel: describeExtensionSource(input.source),
    trust: input.trust,
    trustLabel: describeStoredExtensionTrust(input.trust),
    runtimeMode: input.runtimeMode,
    runtimeLabel: describeExtensionRuntimeMode(input.runtimeMode),
    permissions,
    grantedCapabilities,
    effectiveCapabilities,
    permissionsEnforced: input.permissionsEnforced ?? false,
    commandNames: input.commandNames ?? [],
    toolNames: input.toolNames ?? [],
    lastError: input.lastError ?? null,
  };
}

function hasClass(element: HTMLElement, className: string): boolean {
  return element.className.split(/\s+/u).includes(className);
}

function collectElements(root: HTMLElement, predicate: (element: HTMLElement) => boolean): HTMLElement[] {
  const matches: HTMLElement[] = [];

  const visit = (element: HTMLElement): void => {
    if (predicate(element)) {
      matches.push(element);
    }

    for (const child of Array.from(element.children)) {
      if (!(child instanceof HTMLElement)) {
        continue;
      }

      visit(child);
    }
  };

  visit(root);
  return matches;
}

function findElementByTagAndText(root: HTMLElement, tagName: string, text: string): HTMLElement | null {
  const normalizedTag = tagName.toUpperCase();
  const matches = collectElements(
    root,
    (element) => element.tagName === normalizedTag && (element.textContent ?? "") === text,
  );

  return matches[0] ?? null;
}

function findCollapsibleSection(root: HTMLElement, summaryText: string): HTMLElement | null {
  const sections = collectElements(root, (element) => element.tagName === "DETAILS" && hasClass(element, "pi-overlay-section"));

  for (const section of sections) {
    const summary = Array.from(section.children).find(
      (child) => child instanceof HTMLElement
        && child.tagName === "SUMMARY"
        && (child.textContent ?? "") === summaryText,
    );

    if (summary) {
      return section;
    }
  }

  return null;
}

function findInstalledRowByName(root: HTMLElement, extensionName: string): HTMLElement | null {
  const names = collectElements(
    root,
    (element) => hasClass(element, "pi-ext-installed-row__name") && (element.textContent ?? "") === extensionName,
  );

  const row = names[0]?.closest<HTMLElement>(".pi-ext-installed-row");
  return row instanceof HTMLElement ? row : null;
}

function collectBadgeTexts(root: HTMLElement): string[] {
  return collectElements(root, (element) => hasClass(element, "pi-overlay-badge"))
    .map((badge) => badge.textContent ?? "");
}

function collectSummaryTexts(root: HTMLElement): string[] {
  return collectElements(root, (element) => element.tagName === "SUMMARY")
    .map((summary) => summary.textContent ?? "");
}

function collectTextContent(root: HTMLElement): string[] {
  return collectElements(root, () => true)
    .map((element) => (element.textContent ?? "").trim())
    .filter((text) => text.length > 0);
}

async function settleOverlayWork(): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 0);
    });
  }
}

void test("extension overlay show/dismiss mounts and tears down shared overlay", () => {
  const { document, restore } = installFakeDom();

  try {
    const api = createExtensionAPI({
      getAgent: () => {
        throw new Error("agent should not be requested in overlay test");
      },
    });

    const first = document.createElement("div");
    first.id = "first-content";

    api.overlay.show(first);

    const mounted = document.getElementById(EXTENSION_OVERLAY_ID);
    assert.notEqual(mounted, null);
    if (!mounted) {
      return;
    }

    assert.equal(mounted.contains(first), true);

    const second = document.createElement("div");
    second.id = "second-content";

    api.overlay.show(second);

    const remounted = document.getElementById(EXTENSION_OVERLAY_ID);
    assert.notEqual(remounted, null);
    if (!remounted) {
      return;
    }

    assert.equal(remounted.contains(second), true);
    assert.equal(remounted.contains(first), false);

    api.overlay.dismiss();
    assert.equal(document.getElementById(EXTENSION_OVERLAY_ID), null);
  } finally {
    restore();
  }
});

void test("extensions manager overlay renders collapsed sections and compact row metadata", async () => {
  const { document, restore } = installFakeDom();

  try {
    const builtinStatus = createRuntimeStatus({
      id: "builtin.snake",
      name: "Snake",
      source: {
        kind: "module",
        specifier: "../extensions/snake.js",
      },
      trust: "builtin",
      runtimeMode: "host",
      commandNames: ["snake"],
      toolNames: ["snake_tool"],
    });

    const inlineErrorStatus = createRuntimeStatus({
      id: "ext.inline.error",
      name: "Broken Inline",
      source: {
        kind: "inline",
        code: "export function activate(api) { api.toast('broken'); }",
      },
      trust: "inline-code",
      runtimeMode: "sandbox-iframe",
      loaded: false,
      lastError: "Local extension module \"../extensions/snake.js\" was not bundled.",
    });

    const manager = new StaticExtensionRuntimeManager([builtinStatus, inlineErrorStatus]);

    showExtensionsDialog(manager);
    await settleOverlayWork();

    const overlay = document.getElementById(EXTENSIONS_OVERLAY_ID);
    assert.ok(overlay);
    if (!overlay) {
      return;
    }

    assert.notEqual(findElementByTagAndText(overlay, "h2", "Extensions"), null);
    assert.notEqual(
      findElementByTagAndText(overlay, "p", "Extensions can read/write workbook data. Only enable code you trust."),
      null,
    );

    const addExtensionSection = findCollapsibleSection(overlay, "Add extension");
    const advancedSection = findCollapsibleSection(overlay, "Advanced");

    assert.ok(addExtensionSection);
    assert.ok(advancedSection);
    assert.equal(addExtensionSection?.getAttribute("open"), null);
    assert.equal(advancedSection?.getAttribute("open"), null);

    const snakeRow = findInstalledRowByName(overlay, "Snake");
    assert.ok(snakeRow);
    if (!snakeRow) {
      return;
    }

    const snakeBadges = collectBadgeTexts(snakeRow);
    assert.equal(snakeBadges.includes("loaded"), true);
    assert.equal(snakeBadges.includes("all permissions"), true);
    assert.equal(snakeBadges.includes("1 tool"), true);
    assert.equal(snakeBadges.includes("1 command"), true);
    assert.equal(snakeBadges.includes("builtin"), false);
    assert.equal(snakeBadges.includes("host runtime"), false);

    const snakeSummaries = collectSummaryTexts(snakeRow);
    assert.equal(snakeSummaries.includes(`Permissions (${builtinStatus.grantedCapabilities.length})`), true);

    const inlineRow = findInstalledRowByName(overlay, "Broken Inline");
    assert.ok(inlineRow);
    if (!inlineRow) {
      return;
    }

    const inlineBadges = collectBadgeTexts(inlineRow);
    assert.equal(inlineBadges.includes("error"), true);
    assert.equal(inlineBadges.includes("inline code"), true);
    assert.equal(inlineBadges.includes("sandbox iframe"), true);

    const inlineSummaries = collectSummaryTexts(inlineRow);
    assert.equal(inlineSummaries.includes(`Permissions (${inlineErrorStatus.grantedCapabilities.length})`), true);
    assert.equal(inlineSummaries.includes("Failed to load"), true);

    const errorDetails = collectElements(inlineRow, (element) => hasClass(element, "pi-ext-installed-row__error-detail"));
    assert.equal(errorDetails.length, 1);
    assert.equal(errorDetails[0].textContent, inlineErrorStatus.lastError);

    const inlineTexts = collectTextContent(inlineRow);
    assert.equal(inlineTexts.some((text) => text.startsWith("Last error:")), false);
  } finally {
    closeOverlayById(EXTENSIONS_OVERLAY_ID);
    await settleOverlayWork();
    restore();
  }
});
