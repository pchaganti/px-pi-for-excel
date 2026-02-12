import assert from "node:assert/strict";
import { test } from "node:test";

import { buildSystemPrompt } from "../src/prompt/system-prompt.ts";
import { resolveConventions } from "../src/conventions/store.ts";

void test("system prompt includes default placeholders when instructions are absent", () => {
  const prompt = buildSystemPrompt();

  assert.match(prompt, /## Persistent Instructions/);
  assert.match(prompt, /\(No user instructions set\.\)/);
  assert.match(prompt, /\(No workbook instructions set\.\)/);
});

void test("system prompt embeds provided user and workbook instructions", () => {
  const prompt = buildSystemPrompt({
    userInstructions: "Always use EUR",
    workbookInstructions: "Summary sheet is read-only",
  });

  assert.match(prompt, /Always use EUR/);
  assert.match(prompt, /Summary sheet is read-only/);
  assert.match(prompt, /\*\*instructions\*\* tool/);
});

void test("system prompt omits convention overrides when all defaults", () => {
  const conventions = resolveConventions({});
  const prompt = buildSystemPrompt({ conventions });

  assert.ok(!prompt.includes("Active convention overrides"));
});

void test("system prompt includes convention overrides when customized", () => {
  const conventions = resolveConventions({
    currencySymbol: "£",
    negativeStyle: "minus",
  });
  const prompt = buildSystemPrompt({ conventions });

  assert.match(prompt, /Active convention overrides/);
  assert.match(prompt, /Currency: £/);
  assert.match(prompt, /Negatives: minus sign/);
});

void test("system prompt lists the conventions tool", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*conventions\*\*/);
});

void test("system prompt includes workbook history recovery tool", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*workbook_history\*\*/);
  assert.match(prompt, /recovery checkpoints/i);
  assert.match(prompt, /write_cells/);
  assert.match(prompt, /fill_formula/);
  assert.match(prompt, /python_transform_range/);
  assert.match(prompt, /format_cells/);
  assert.match(prompt, /conditional_format/);
  assert.match(prompt, /comments/);
  assert.match(prompt, /modify_structure/);
});

void test("system prompt documents trace_dependencies precedents/dependents modes", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*trace_dependencies\*\*/);
  assert.match(prompt, /mode:\s*`precedents`/i);
  assert.match(prompt, /`dependents`/i);
});

void test("system prompt lists explain_formula tool", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*explain_formula\*\*/);
  assert.match(prompt, /plain language/i);
});

void test("system prompt mentions optional files workspace capability", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*files\*\*/);
  assert.match(prompt, /workspace artifacts/i);
});

void test("system prompt mentions extension manager tool for chat-driven authoring", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*extensions_manager\*\*/);
  assert.match(prompt, /extension authoring from chat/i);
});

void test("system prompt lists the skills tool", () => {
  const prompt = buildSystemPrompt();
  assert.match(prompt, /\*\*skills\*\*/);
  assert.match(prompt, /SKILL\.md/);
});

void test("system prompt renders available skills XML section", () => {
  const prompt = buildSystemPrompt({
    availableSkills: [
      {
        name: "web-search",
        description: "Search the web for up-to-date facts.",
        location: "skills/web-search/SKILL.md",
      },
    ],
  });

  assert.match(prompt, /## Available Agent Skills/);
  assert.match(prompt, /<available_skills>/);
  assert.match(prompt, /<name>web-search<\/name>/);
  assert.match(prompt, /<location>skills\/web-search\/SKILL\.md<\/location>/);
});

void test("system prompt renders active integrations with Agent Skill mapping", () => {
  const prompt = buildSystemPrompt({
    activeIntegrations: [
      {
        id: "web_search",
        title: "Web Search",
        instructions: "Use web search for fresh facts.",
        agentSkillName: "web-search",
      },
    ],
  });

  assert.match(prompt, /## Active Integrations/);
  assert.match(prompt, /### Web Search/);
  assert.match(prompt, /Agent Skill mapping: `web-search`/);
});
