import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getExternalToolsEnabled,
  getSessionIntegrationIds,
  getWorkbookIntegrationIds,
  resolveConfiguredIntegrationIds,
  setExternalToolsEnabled,
  setSessionIntegrationIds,
  setIntegrationEnabledInScope,
  setWorkbookIntegrationIds,
} from "../src/integrations/store.ts";

const KNOWN_INTEGRATIONS = ["web_search", "mcp_tools"] as const;

class MemorySettingsStore {
  private readonly values = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.has(key) ? this.values.get(key) ?? null : null);
  }

  set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
    return Promise.resolve();
  }
}

void test("resolves session + workbook integrations in catalog order", async () => {
  const settings = new MemorySettingsStore();

  await setSessionIntegrationIds(settings, "session-1", ["mcp_tools"], KNOWN_INTEGRATIONS);
  await setWorkbookIntegrationIds(settings, "workbook-1", ["web_search"], KNOWN_INTEGRATIONS);

  const resolved = await resolveConfiguredIntegrationIds({
    settings,
    sessionId: "session-1",
    workbookId: "workbook-1",
    knownIntegrationIds: KNOWN_INTEGRATIONS,
  });

  assert.deepEqual(resolved, ["web_search", "mcp_tools"]);
});

void test("setIntegrationEnabledInScope toggles session/workbook flags", async () => {
  const settings = new MemorySettingsStore();

  await setIntegrationEnabledInScope({
    settings,
    scope: "session",
    identifier: "session-2",
    integrationId: "web_search",
    enabled: true,
    knownIntegrationIds: KNOWN_INTEGRATIONS,
  });

  await setIntegrationEnabledInScope({
    settings,
    scope: "workbook",
    identifier: "workbook-2",
    integrationId: "mcp_tools",
    enabled: true,
    knownIntegrationIds: KNOWN_INTEGRATIONS,
  });

  assert.deepEqual(
    await getSessionIntegrationIds(settings, "session-2", KNOWN_INTEGRATIONS),
    ["web_search"],
  );
  assert.deepEqual(
    await getWorkbookIntegrationIds(settings, "workbook-2", KNOWN_INTEGRATIONS),
    ["mcp_tools"],
  );

  await setIntegrationEnabledInScope({
    settings,
    scope: "session",
    identifier: "session-2",
    integrationId: "web_search",
    enabled: false,
    knownIntegrationIds: KNOWN_INTEGRATIONS,
  });

  assert.deepEqual(
    await getSessionIntegrationIds(settings, "session-2", KNOWN_INTEGRATIONS),
    [],
  );
});

void test("external tools gate defaults off and can be enabled", async () => {
  const settings = new MemorySettingsStore();

  assert.equal(await getExternalToolsEnabled(settings), false);

  await setExternalToolsEnabled(settings, true);
  assert.equal(await getExternalToolsEnabled(settings), true);

  await setExternalToolsEnabled(settings, false);
  assert.equal(await getExternalToolsEnabled(settings), false);
});
