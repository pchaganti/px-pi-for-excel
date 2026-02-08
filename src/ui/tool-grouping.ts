/**
 * Tool card grouping — collapses consecutive same-tool calls into a single
 * container with a "+N more" badge. Click the badge to expand into a
 * continuous list; normal card header clicks still toggle body as usual.
 */

/** State tracked per wrapper element. */
interface GroupState {
  leader: Element;
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
    if (!target.classList.contains("pi-group-badge")) return;

    const wrapper = target.closest(".pi-tool-group");
    if (!wrapper) return;
    const state = groups.get(wrapper);
    if (!state) return;

    e.stopPropagation();
    e.preventDefault();
    toggleGroup(wrapper, state);
  }

  function toggleGroup(wrapper: Element, state: GroupState) {
    state.expanded = !state.expanded;
    if (state.expanded) {
      wrapper.classList.add("expanded");
      removeBadge(state.leader);
      for (const m of state.members) m.classList.remove("pi-grouped");
    } else {
      wrapper.classList.remove("expanded");
      insertBadge(state.leader, state.members.length);
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

  function removeBadge(el: Element) {
    el.querySelector(".pi-group-badge")?.remove();
  }

  /* ── Unwrap existing groups ────────────────────────────── */

  function unwrapAll() {
    for (const wrapper of root.querySelectorAll(".pi-tool-group")) {
      const parent = wrapper.parentNode;
      if (!parent) continue;
      while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
      parent.removeChild(wrapper);
    }
    groups.clear();
  }

  /* ── Grouping pass ────────────────────────────────────── */

  function applyGrouping() {
    // Disconnect observer during DOM manipulation to avoid re-entrancy.
    observer.disconnect();

    // Remember which leaders were expanded before re-grouping.
    const expandedLeaders = new Set<Element>();
    for (const [, s] of groups) {
      if (s.expanded) expandedLeaders.add(s.leader);
    }

    // Flatten — move all tool-messages back to root.
    unwrapAll();

    // Clean up classes on all tool-messages.
    const toolMessages: Element[] = [];
    for (const el of root.querySelectorAll("tool-message")) {
      el.classList.remove("pi-grouped", "pi-group-member");
      el.removeAttribute("data-group-size");
      removeBadge(el);
      toolMessages.push(el);
    }

    // Identify runs of 2+ consecutive same-name completed tools.
    const runs: Element[][] = [];
    let currentRun: Element[] = [];

    for (const el of toolMessages) {
      const card = el.querySelector(".pi-tool-card");
      if (!card) {
        if (currentRun.length >= 2) runs.push(currentRun);
        currentRun = [];
        continue;
      }

      const toolName = card.getAttribute("data-tool-name");
      const cardState = card.getAttribute("data-state");

      if (cardState !== "complete" || !toolName) {
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

    // Wrap each run in a container element.
    for (const run of runs) {
      const leader = run[0];
      const members = run.slice(1);
      const wasExpanded = expandedLeaders.has(leader);

      const wrapper = document.createElement("div");
      wrapper.className = "pi-tool-group";

      // Insert wrapper where the first element is, then move all run elements in.
      leader.parentNode!.insertBefore(wrapper, leader);
      for (const el of run) wrapper.appendChild(el);

      // Mark members.
      for (const m of members) m.classList.add("pi-group-member");

      if (wasExpanded) {
        wrapper.classList.add("expanded");
      } else {
        insertBadge(leader, members.length);
        for (const m of members) m.classList.add("pi-grouped");
      }

      groups.set(wrapper, { leader, members, expanded: wasExpanded });
    }

    // Reconnect observer after all DOM work is done.
    observer.observe(root, { childList: true, subtree: true });
  }

  /**
   * Check whether two elements are consecutive siblings (no intervening
   * element siblings — only whitespace text nodes allowed).
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

  // Initial pass.
  applyGrouping();

  /* ── Cleanup ──────────────────────────────────────────── */

  return () => {
    observer.disconnect();
    if (rafId) cancelAnimationFrame(rafId);
    root.removeEventListener("click", onClick, true);

    unwrapAll();
    for (const el of root.querySelectorAll("tool-message")) {
      el.classList.remove("pi-grouped", "pi-group-member");
      el.removeAttribute("data-group-size");
      removeBadge(el);
    }
  };
}
