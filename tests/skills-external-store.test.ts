import assert from "node:assert/strict";
import { test } from "node:test";

import type { AgentSkillDefinition } from "../src/skills/types.ts";
import {
  SKILL_ACTIVATION_STORAGE_KEY,
  filterAgentSkillsByEnabledState,
  loadDisabledSkillNamesFromSettings,
  setSkillEnabledInSettings,
} from "../src/skills/activation-store.ts";
import {
  EXTERNAL_AGENT_SKILLS_STORAGE_KEY,
  loadExternalAgentSkillsFromSettings,
  removeExternalAgentSkillFromSettings,
  upsertExternalAgentSkillInSettings,
} from "../src/skills/external-store.ts";

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

void test("loadExternalAgentSkillsFromSettings loads valid external skills", async () => {
  const settings = new MemorySettingsStore();

  await settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
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

  await settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
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

  void settings.set(EXTERNAL_AGENT_SKILLS_STORAGE_KEY, {
    version: 2,
    items: [],
  });

  const skills = await loadExternalAgentSkillsFromSettings(settings);
  assert.deepEqual(skills, []);
});

void test("upsertExternalAgentSkillInSettings installs and overwrites by skill name", async () => {
  const settings = new MemorySettingsStore();

  await upsertExternalAgentSkillInSettings({
    settings,
    markdown: `---
name: custom-skill
description: First description.
---

# First
`,
  });

  await upsertExternalAgentSkillInSettings({
    settings,
    markdown: `---
name: custom-skill
description: Updated description.
---

# Updated
`,
  });

  const skills = await loadExternalAgentSkillsFromSettings(settings);
  assert.equal(skills.length, 1);
  assert.equal(skills[0].name, "custom-skill");
  assert.equal(skills[0].description, "Updated description.");
  assert.equal(skills[0].location, "skills/external/custom-skill/SKILL.md");
});

void test("upsertExternalAgentSkillInSettings enforces expectedName when provided", async () => {
  const settings = new MemorySettingsStore();

  await assert.rejects(
    () => upsertExternalAgentSkillInSettings({
      settings,
      expectedName: "different-name",
      markdown: `---
name: custom-skill
description: External custom skill.
---

# Custom
`,
    }),
    /Skill name mismatch: expected "different-name" but markdown declares "custom-skill"/,
  );
});

void test("removeExternalAgentSkillFromSettings removes by name and reports whether removed", async () => {
  const settings = new MemorySettingsStore();

  await upsertExternalAgentSkillInSettings({
    settings,
    markdown: `---
name: custom-skill
description: External custom skill.
---

# Custom
`,
  });

  const removed = await removeExternalAgentSkillFromSettings({
    settings,
    name: "custom-skill",
  });
  assert.equal(removed, true);

  const skillsAfterRemove = await loadExternalAgentSkillsFromSettings(settings);
  assert.deepEqual(skillsAfterRemove, []);

  const removedMissing = await removeExternalAgentSkillFromSettings({
    settings,
    name: "missing-skill",
  });
  assert.equal(removedMissing, false);
});

void test("loadDisabledSkillNamesFromSettings normalizes and deduplicates names", async () => {
  const settings = new MemorySettingsStore();

  await settings.set(SKILL_ACTIVATION_STORAGE_KEY, {
    version: 1,
    disabledNames: [" Web-Search ", "custom-skill", "web-search", ""],
  });

  const disabled = await loadDisabledSkillNamesFromSettings(settings);
  assert.deepEqual(Array.from(disabled).sort(), ["custom-skill", "web-search"]);
});

void test("setSkillEnabledInSettings disables and re-enables by name", async () => {
  const settings = new MemorySettingsStore();

  const disabled = await setSkillEnabledInSettings({
    settings,
    name: "Web-Search",
    enabled: false,
  });

  assert.equal(disabled.changed, true);
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.name, "web-search");

  const disabledNames = await loadDisabledSkillNamesFromSettings(settings);
  assert.deepEqual(Array.from(disabledNames), ["web-search"]);

  const duplicateDisable = await setSkillEnabledInSettings({
    settings,
    name: "web-search",
    enabled: false,
  });
  assert.equal(duplicateDisable.changed, false);

  const enabled = await setSkillEnabledInSettings({
    settings,
    name: "web-search",
    enabled: true,
  });

  assert.equal(enabled.changed, true);
  assert.equal(enabled.enabled, true);

  const afterEnable = await loadDisabledSkillNamesFromSettings(settings);
  assert.deepEqual(Array.from(afterEnable), []);
});

void test("filterAgentSkillsByEnabledState excludes disabled skill names", () => {
  const bundledSkill: AgentSkillDefinition = {
    name: "web-search",
    description: "Bundled web search.",
    location: "skills/web-search/SKILL.md",
    sourceKind: "bundled",
    markdown: "# Web Search",
    body: "# Web Search",
  };

  const externalSkill: AgentSkillDefinition = {
    name: "custom-skill",
    description: "External skill.",
    location: "skills/external/custom-skill/SKILL.md",
    sourceKind: "external",
    markdown: "# Custom Skill",
    body: "# Custom Skill",
  };

  const filtered = filterAgentSkillsByEnabledState({
    skills: [bundledSkill, externalSkill],
    disabledSkillNames: new Set(["custom-skill"]),
  });

  assert.deepEqual(filtered.map((skill) => skill.name), ["web-search"]);
});
