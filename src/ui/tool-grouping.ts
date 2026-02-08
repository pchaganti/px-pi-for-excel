/**
 * Tool card grouping — collapses consecutive same-tool calls into a single
 * card with a "+N more" badge. Click to expand/collapse.
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
    // Click on the badge (::after on .pi-tool-card__header) or
    // anywhere on a group-leader's header row.
    const toolMsg = target.closest("tool-message");
    if (!toolMsg) return;
    const state = groups.get(toolMsg);
    if (!state) return;

    // Only respond to clicks on the header area (not expanded body).
    const header = toolMsg.querySelector(".pi-tool-card__header");
    if (!header?.contains(target)) return;

    e.stopPropagation();
    toggleGroup(toolMsg, state);
  }

  function toggleGroup(leader: Element, state: GroupState) {
    state.expanded = !state.expanded;
    if (state.expanded) {
      leader.removeAttribute("data-group-size");
      leader.classList.add("pi-group-expanded");
      for (const m of state.members) m.classList.remove("pi-grouped");
    } else {
      leader.setAttribute("data-group-size", String(state.members.length));
      leader.classList.remove("pi-group-expanded");
      for (const m of state.members) m.classList.add("pi-grouped");
    }
  }

  /* ── Grouping pass ────────────────────────────────────── */

  function applyGrouping() {
    // 1. Collect all direct children of root that are tool-message elements.
    //    We walk children in DOM order.
    const children = Array.from(root.querySelectorAll(":scope tool-message, :scope message-list tool-message"));

    // Build a flat ordered list of tool-messages in DOM order
    // (querySelectorAll returns document order).
    // We need to detect runs that are truly consecutive *siblings* —
    // non-tool-message elements between them break the run.
    const toolMessages: Element[] = [];
    const allElements = root.querySelectorAll("tool-message");
    for (const el of allElements) toolMessages.push(el);

    // 2. Clear previous grouping state
    const prevLeaders = new Set(groups.keys());
    groups.clear();

    for (const el of toolMessages) {
      el.classList.remove("pi-grouped", "pi-group-expanded");
      el.removeAttribute("data-group-size");
    }

    // 3. Identify runs of consecutive same-name completed tools.
    //    "Consecutive" = adjacent tool-message siblings with no intervening
    //    non-tool-message elements (thinking-block, markdown-block, etc.).
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

      // Check if this tool-message is a direct sibling of the previous one
      // (no non-tool-message elements in between).
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

    // 4. Apply grouping to each run.
    for (const run of runs) {
      const leader = run[0];
      const members = run.slice(1);
      const expanded = prevLeaders.has(leader); // preserve expansion state

      leader.setAttribute("data-group-size", String(members.length));
      if (!expanded) {
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
    // They might not be direct siblings if nested inside message-list etc.
    // Walk from a's next sibling to see if we reach b before hitting
    // a non-tool-message element.
    let node: Node | null = a.nextSibling;
    while (node) {
      if (node === b) return true;
      // Skip text nodes (whitespace)
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.nextSibling;
        continue;
      }
      // Any other element that isn't our target breaks the run
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        if (el.tagName.toLowerCase() === "tool-message") {
          // It's a different tool-message (not b) — break
          return false;
        }
        // Non-tool-message element breaks the group
        return false;
      }
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

    // Remove all grouping artefacts
    for (const el of root.querySelectorAll("tool-message")) {
      el.classList.remove("pi-grouped", "pi-group-expanded");
      el.removeAttribute("data-group-size");
    }
    groups.clear();
  };
}
