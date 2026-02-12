import assert from "node:assert/strict";
import { test } from "node:test";

import type { AgentSkillDefinition } from "../src/skills/catalog.ts";
import { createSkillReadCache } from "../src/skills/read-cache.ts";
import { createSkillsTool } from "../src/tools/skills.ts";

const WEB_SEARCH_SKILL: AgentSkillDefinition = {
  name: "web-search",
  description: "Search the web for fresh facts.",
  compatibility: "Requires web_search integration.",
  location: "skills/web-search/SKILL.md",
  markdown: "# Web Search\n\nUse web search when workbook context is insufficient.",
  body: "# Web Search\n\nUse web search when workbook context is insufficient.",
};

void test("skills list renders bundled skills from catalog", async () => {
  const tool = createSkillsTool({
    catalog: {
      list: () => [WEB_SEARCH_SKILL],
      getByName: () => null,
    },
  });

  const result = await tool.execute("call-1", { action: "list" });
  const text = result.content[0]?.type === "text" ? result.content[0].text : "";

  assert.match(text, /Available Agent Skills \(1\)/);
  assert.match(text, /`web-search`/);
});

void test("skills read uses session cache and avoids repeated catalog lookups", async () => {
  let lookupCount = 0;
  const cache = createSkillReadCache();

  const tool = createSkillsTool({
    getSessionId: () => "session-1",
    readCache: cache,
    catalog: {
      list: () => [WEB_SEARCH_SKILL],
      getByName: (name: string) => {
        lookupCount += 1;
        return name === "web-search" ? WEB_SEARCH_SKILL : null;
      },
    },
  });

  const first = await tool.execute("call-1", { action: "read", name: "web-search" });
  const second = await tool.execute("call-2", { action: "read", name: "web-search" });

  const firstText = first.content[0]?.type === "text" ? first.content[0].text : "";
  const secondText = second.content[0]?.type === "text" ? second.content[0].text : "";

  assert.equal(lookupCount, 1);
  assert.equal(firstText, WEB_SEARCH_SKILL.markdown);
  assert.equal(secondText, WEB_SEARCH_SKILL.markdown);
});

void test("skills read cache is session-scoped", async () => {
  let currentSession = "session-a";
  let lookupCount = 0;

  const tool = createSkillsTool({
    getSessionId: () => currentSession,
    readCache: createSkillReadCache(),
    catalog: {
      list: () => [WEB_SEARCH_SKILL],
      getByName: (name: string) => {
        lookupCount += 1;
        return name === "web-search" ? WEB_SEARCH_SKILL : null;
      },
    },
  });

  await tool.execute("call-1", { action: "read", name: "web-search" });
  currentSession = "session-b";
  await tool.execute("call-2", { action: "read", name: "web-search" });

  assert.equal(lookupCount, 2);
});
