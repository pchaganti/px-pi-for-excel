import assert from "node:assert/strict";
import { test } from "node:test";

import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

import {
  applyExperimentalToolGates,
  buildTmuxBridgeGateErrorMessage,
  evaluateTmuxBridgeGate,
} from "../src/tools/experimental-tool-gates.ts";

const emptySchema = Type.Object({});

function createTestTool(
  name: string,
  onExecute?: () => void,
): AgentTool<typeof emptySchema, undefined> {
  return {
    label: `${name} tool`,
    name,
    description: `${name} description`,
    parameters: emptySchema,
    execute: () => {
      onExecute?.();
      return Promise.resolve({
        content: [{ type: "text", text: `${name}:ok` }],
        details: undefined,
      });
    },
  };
}

void test("keeps tmux tool registered when experiment is disabled", async () => {
  let probeCalled = false;

  const tools = [createTestTool("tmux"), createTestTool("read_range")];
  const gated = await applyExperimentalToolGates(tools, {
    isTmuxExperimentEnabled: () => false,
    getTmuxBridgeUrl: () => Promise.resolve("https://localhost:3337"),
    validateBridgeUrl: () => "https://localhost:3337",
    probeTmuxBridge: () => {
      probeCalled = true;
      return Promise.resolve(true);
    },
  });

  assert.deepEqual(gated.map((tool) => tool.name), ["tmux", "read_range"]);
  assert.equal(probeCalled, false);

  const tmuxTool = gated.find((tool) => tool.name === "tmux");
  assert.ok(tmuxTool);

  await assert.rejects(
    () => tmuxTool.execute("call-1", {}),
    /\/experimental on tmux-bridge/,
  );

  assert.equal(probeCalled, false);
});

void test("tmux hard gate re-checks execution on every call", async () => {
  let enabled = true;
  let bridgeHealthy = true;
  let executeCount = 0;

  const [gatedTmux] = await applyExperimentalToolGates([createTestTool("tmux", () => {
    executeCount += 1;
  })], {
    isTmuxExperimentEnabled: () => enabled,
    getTmuxBridgeUrl: () => Promise.resolve("https://localhost:3337"),
    validateBridgeUrl: () => "https://localhost:3337",
    probeTmuxBridge: () => Promise.resolve(bridgeHealthy),
  });

  assert.ok(gatedTmux);

  await gatedTmux.execute("call-1", {});
  assert.equal(executeCount, 1);

  enabled = false;

  await assert.rejects(
    () => gatedTmux.execute("call-2", {}),
    /\/experimental on tmux-bridge/,
  );
  assert.equal(executeCount, 1);

  enabled = true;
  bridgeHealthy = false;

  await assert.rejects(
    () => gatedTmux.execute("call-3", {}),
    /not reachable/i,
  );
  assert.equal(executeCount, 1);
});

void test("evaluateTmuxBridgeGate reports explicit reason codes", async () => {
  const missingUrl = await evaluateTmuxBridgeGate({
    isTmuxExperimentEnabled: () => true,
    getTmuxBridgeUrl: () => Promise.resolve(undefined),
  });

  assert.equal(missingUrl.allowed, false);
  assert.equal(missingUrl.reason, "missing_bridge_url");

  const unreachable = await evaluateTmuxBridgeGate({
    isTmuxExperimentEnabled: () => true,
    getTmuxBridgeUrl: () => Promise.resolve("https://localhost:3337"),
    validateBridgeUrl: () => "https://localhost:3337",
    probeTmuxBridge: () => Promise.resolve(false),
  });

  assert.equal(unreachable.allowed, false);
  assert.equal(unreachable.reason, "bridge_unreachable");
  assert.match(buildTmuxBridgeGateErrorMessage(unreachable.reason), /not reachable/i);
});
