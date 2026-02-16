import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

function isRecord(value) {
  return typeof value === "object" && value !== null;
}

async function readIgnoreCommand() {
  const raw = await readFile(new URL("../vercel.json", import.meta.url), "utf8");
  const parsed = JSON.parse(raw);

  if (!isRecord(parsed) || typeof parsed.ignoreCommand !== "string") {
    throw new Error("vercel.json is missing a string ignoreCommand");
  }

  return parsed.ignoreCommand;
}

function runIgnoreCommand(ignoreCommand, envOverrides) {
  const env = { ...process.env };

  for (const [key, value] of Object.entries(envOverrides)) {
    if (typeof value === "undefined") {
      delete env[key];
      continue;
    }

    env[key] = value;
  }

  const result = spawnSync("bash", ["-lc", ignoreCommand], {
    env,
    encoding: "utf8",
  });

  if (typeof result.status !== "number") {
    throw new Error(`ignoreCommand process exited abnormally: ${result.error?.message ?? "unknown error"}`);
  }

  return result.status;
}

test("ignoreCommand allows manual deploys", async () => {
  const ignoreCommand = await readIgnoreCommand();
  const status = runIgnoreCommand(ignoreCommand, {
    VERCEL_GIT_COMMIT_REF: undefined,
    VERCEL_GIT_PULL_REQUEST_ID: undefined,
  });

  assert.equal(status, 1, "manual deploys should build");
});

test("ignoreCommand allows main deploys", async () => {
  const ignoreCommand = await readIgnoreCommand();
  const status = runIgnoreCommand(ignoreCommand, {
    VERCEL_GIT_COMMIT_REF: "main",
    VERCEL_GIT_PULL_REQUEST_ID: undefined,
  });

  assert.equal(status, 1, "main branch deploys should build");
});

test("ignoreCommand allows pull request deploys", async () => {
  const ignoreCommand = await readIgnoreCommand();
  const status = runIgnoreCommand(ignoreCommand, {
    VERCEL_GIT_COMMIT_REF: "feature/re-enable-auto-deploy",
    VERCEL_GIT_PULL_REQUEST_ID: "290",
  });

  assert.equal(status, 1, "pull request deploys should build");
});

test("ignoreCommand skips non-PR feature branches", async () => {
  const ignoreCommand = await readIgnoreCommand();
  const status = runIgnoreCommand(ignoreCommand, {
    VERCEL_GIT_COMMIT_REF: "feature/re-enable-auto-deploy",
    VERCEL_GIT_PULL_REQUEST_ID: undefined,
  });

  assert.equal(status, 0, "non-PR feature branch deploys should be skipped");
});
