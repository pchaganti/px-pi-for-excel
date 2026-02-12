/**
 * Session-scoped cache for loaded Agent Skill markdown.
 */

export interface SkillReadCacheEntry {
  markdown: string;
  cachedAt: number;
  readCount: number;
}

export interface SkillReadCache {
  get: (sessionId: string, skillName: string) => SkillReadCacheEntry | null;
  set: (sessionId: string, skillName: string, markdown: string) => SkillReadCacheEntry;
  clearSession: (sessionId: string) => void;
  clearAll: () => void;
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

export function createSkillReadCache(): SkillReadCache {
  const bySession = new Map<string, Map<string, SkillReadCacheEntry>>();

  const ensureSessionCache = (sessionId: string): Map<string, SkillReadCacheEntry> => {
    const existing = bySession.get(sessionId);
    if (existing) {
      return existing;
    }

    const created = new Map<string, SkillReadCacheEntry>();
    bySession.set(sessionId, created);
    return created;
  };

  return {
    get(sessionId: string, skillName: string): SkillReadCacheEntry | null {
      const sessionCache = bySession.get(sessionId);
      if (!sessionCache) {
        return null;
      }

      const cached = sessionCache.get(normalizeSkillName(skillName));
      return cached ?? null;
    },
    set(sessionId: string, skillName: string, markdown: string): SkillReadCacheEntry {
      const sessionCache = ensureSessionCache(sessionId);
      const normalizedName = normalizeSkillName(skillName);
      const previous = sessionCache.get(normalizedName);

      const next: SkillReadCacheEntry = {
        markdown,
        cachedAt: Date.now(),
        readCount: previous ? previous.readCount + 1 : 1,
      };

      sessionCache.set(normalizedName, next);
      return next;
    },
    clearSession(sessionId: string): void {
      bySession.delete(sessionId);
    },
    clearAll(): void {
      bySession.clear();
    },
  };
}
