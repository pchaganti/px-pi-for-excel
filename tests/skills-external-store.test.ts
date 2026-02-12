import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EXTERNAL_AGENT_SKILLS_STORAGE_KEY,
  loadExternalAgentSkillsFromSettings,
} from "../src/skills/external-store.ts";

class MemorySettingsStore {
  private readonly values = new Map<string, unknown>();

  get(key: string): Promise<unknown> {
    return Promise.resolve(this.values.has(key) ? this.values.get(key) ?? null : null);
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }
}

void test("loadExternalAgentSkillsFromSettings loads valid external skills", async () => {
  const settings = new MemorySettingsStore();

  settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
    version: 1,
    items: [
      {
        location: "/tmp/skills/custom-skill/SKILL.md",
        markdown: `---
name: custom-skill
description: External custom skill.
---

# Custom Skill
`,
      },
    ],
  });

  const skills = await loadExternalAgentSkillsFromSettings(settings);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, "custom-skill");
  assert.equal(skills[0].sourceKind, "external");
  assert.equal(skills[0].location, "/tmp/skills/custom-skill/SKILL.md");
});

void test("loadExternalAgentSkillsFromSettings ignores invalid payloads", async () => {
  const settings = new MemorySettingsStore();

  settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
    version: 1,
    items: [
      {
        location: "/tmp/skills/invalid/SKILL.md",
        markdown: "# Missing frontmatter",
      },
      {
        location: 12,
        markdown: "---\nname: invalid\ndescription: invalid\n---",
      },
    ],
  });

  const skills = await loadExternalAgentSkillsFromSettings(settings);
  assert.deepEqual(skills, []);
});

void test("loadExternalAgentSkillsFromSettings returns empty for unknown version", async () => {
  const settings = new MemorySettingsStore();

  settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
    version: 2,
    items: [],
  });

  const skills = await loadExternalAgentSkillsFromSettings(settings);
  assert.deepEqual(skills, []);
});
