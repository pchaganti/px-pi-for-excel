/**
 * Tool card grouping — collapses consecutive same-tool calls into a single
 * card with a "+N more" badge. Click the badge to expand; normal card
 * header clicks still toggle the card body as usual.
 */

/** State tracked per group-leader element. */
interface GroupState {
  members: Element[];
  expanded: boolean;
}

/**
 * Initialise tool-card grouping on the given root element.
 * Returns a cleanup function that disconnects the observer and removes
 * all grouping artefacts.
 */
export function initToolGrouping(root: HTMLElement): () => void {
  const groups = new Map<Element, GroupState>();
  let rafId = 0;

  /* ── Click handler ────────────────────────────────────── */

  function onClick(e: Event) {
    const target = e.target as HTMLElement;
    // Only respond to clicks directly on the badge element.
    if (!target.classList.contains("pi-group-badge")) return;

    const toolMsg = target.closest("tool-message");
    if (!toolMsg) return;
    const state = groups.get(toolMsg);
    if (!state) return;

    e.stopPropagation();
    e.preventDefault();
    toggleGroup(toolMsg, state);
  }

  function toggleGroup(leader: Element, state: GroupState) {
    state.expanded = !state.expanded;
    if (state.expanded) {
      leader.classList.add("pi-group-expanded");
      removeBadge(leader);
      for (const m of state.members) m.classList.remove("pi-grouped");
    } else {
      leader.classList.remove("pi-group-expanded");
      insertBadge(leader, state.members.length);
      for (const m of state.members) m.classList.add("pi-grouped");
    }
  }

  /* ── Badge management ─────────────────────────────────── */

  function insertBadge(leader: Element, count: number) {
    removeBadge(leader);
    const button = leader.querySelector(".pi-tool-card__header > button");
    if (!button) return;
    const badge = document.createElement("span");
    badge.className = "pi-group-badge";
    badge.textContent = `+${count} more`;
    button.appendChild(badge);
  }

  function removeBadge(leader: Element) {
    leader.querySelector(".pi-group-badge")?.remove();
  }

  /* ── Grouping pass ────────────────────────────────────── */

  function applyGrouping() {
    // Build a flat ordered list of tool-messages in DOM order.
    const toolMessages: Element[] = [];
    for (const el of root.querySelectorAll("tool-message")) toolMessages.push(el);

    // Clear previous grouping state
    const prevLeaders = new Set(groups.keys());
    groups.clear();

    for (const el of toolMessages) {
      el.classList.remove("pi-grouped", "pi-group-expanded", "pi-group-member", "pi-group-last");
      el.removeAttribute("data-group-size");
      removeBadge(el);
    }

    // Identify runs of 2+ consecutive same-name completed tools.
    const runs: Element[][] = [];
    let currentRun: Element[] = [];

    for (let i = 0; i < toolMessages.length; i++) {
      const el = toolMessages[i];
      const card = el.querySelector(".pi-tool-card");
      if (!card) continue;

      const toolName = card.getAttribute("data-tool-name");
      const state = card.getAttribute("data-state");

      // Only group completed tools
      if (state !== "complete" || !toolName) {
        if (currentRun.length >= 2) runs.push(currentRun);
        currentRun = [];
        continue;
      }

      if (currentRun.length > 0) {
        const prev = currentRun[currentRun.length - 1];
        const prevCard = prev.querySelector(".pi-tool-card");
        const prevName = prevCard?.getAttribute("data-tool-name");

        if (prevName === toolName && areConsecutiveSiblings(prev, el)) {
          currentRun.push(el);
        } else {
          if (currentRun.length >= 2) runs.push(currentRun);
          currentRun = [el];
        }
      } else {
        currentRun.push(el);
      }
    }
    if (currentRun.length >= 2) runs.push(currentRun);

    // Apply grouping to each run.
    for (const run of runs) {
      const leader = run[0];
      const members = run.slice(1);
      const expanded = prevLeaders.has(leader); // preserve expansion state

      leader.setAttribute("data-group-size", String(members.length));
      for (const m of members) m.classList.add("pi-group-member");
      members[members.length - 1].classList.add("pi-group-last");

      if (!expanded) {
        insertBadge(leader, members.length);
        for (const m of members) m.classList.add("pi-grouped");
      } else {
        leader.classList.add("pi-group-expanded");
      }

      groups.set(leader, { members, expanded });
    }
  }

  /**
   * Check whether two elements are consecutive siblings (no intervening
   * element siblings that aren't whitespace text nodes).
   */
  function areConsecutiveSiblings(a: Element, b: Element): boolean {
    let node: Node | null = a.nextSibling;
    while (node) {
      if (node === b) return true;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.nextSibling;
        continue;
      }
      if (node.nodeType === Node.ELEMENT_NODE) return false;
      node = node.nextSibling;
    }
    return false;
  }

  /* ── Observer ──────────────────────────────────────────── */

  function scheduleGrouping() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      applyGrouping();
    });
  }

  const observer = new MutationObserver(scheduleGrouping);
  observer.observe(root, { childList: true, subtree: true });

  root.addEventListener("click", onClick, true);

  // Initial pass
  applyGrouping();

  /* ── Cleanup ──────────────────────────────────────────── */

  return () => {
    observer.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    root.removeEventListener("click", onClick, true);

    for (const el of root.querySelectorAll("tool-message")) {
      el.classList.remove("pi-grouped", "pi-group-expanded", "pi-group-member", "pi-group-last");
      el.removeAttribute("data-group-size");
      removeBadge(el);
    }
    groups.clear();
  };
}
