import {
  OverlayRegistry,
  backIn,
  currentOf,
  goIn,
  resetIn,
  switchTabIn,
  tabOf as tabOfRoute,
  type Route,
  type RouterState,
  type Tab
} from './routerCore';

export type { Route, Tab };

export const router = $state<RouterState>({
  stack: [{ name: 'home' }]
});

export function current(): Route {
  return currentOf(router);
}

export function tabOf(route: Route): Tab {
  return tabOfRoute(route);
}

export function go(route: Route): void {
  goIn(router, route);
  syncHistory();
}

/**
 * Request one back step. The actual pop happens in the popstate handler so
 * in-app back and the Android hardware back button share one code path.
 * Returns false at Home with no overlay open (let the browser exit the PWA).
 */
export function back(): boolean {
  if (typeof history === 'undefined') return false;
  if (router.stack.length <= 1 && overlays.count() === 0) return false;
  history.back();
  return true;
}

export function switchTab(tab: Tab): void {
  switchTabIn(router, tab);
  syncHistory();
}

export function reset(route: Route = { name: 'home' }): void {
  resetIn(router, route);
  syncHistory();
}

// ---------- Overlay registry ----------

const overlays = new OverlayRegistry();

/** Register an open overlay; call the returned function to unregister. */
export function registerOverlay(close: () => void): () => void {
  const unregister = overlays.register(close);
  syncHistory();
  return () => {
    unregister();
    syncHistory();
  };
}

/** Close the most recently registered overlay. Returns false when none is open. */
export function closeTopOverlay(): boolean {
  const closed = overlays.closeTop();
  if (closed) syncHistory();
  return closed;
}

export function overlayCount(): number {
  return overlays.count();
}

// ---------- History alignment ----------
//
// Invariant while mounted: history depth == (stack.length - 1) + open overlays,
// where the base entry (depth 0) is tagged { d: 1 }. Every stack mutation or
// overlay open/close calls syncHistory() to restore the invariant. Backs we
// issue ourselves are counted in selfBacks so their popstate events are not
// mistaken for user back presses.

let installed = false;
let depth = 0;      // entries above the base sentinel
let selfBacks = 0;  // history.back() calls we issued that have not popped yet

function syncHistory(): void {
  if (!installed) return;
  const target = (router.stack.length - 1) + overlays.count();
  while (depth < target) {
    history.pushState({ d: depth + 2 }, '');
    depth++;
  }
  while (depth > target) {
    selfBacks++;
    depth--;
    history.back();
  }
}

function handlePopState(e: PopStateEvent): void {
  const state = e.state as { d?: unknown } | null;
  if (typeof state?.d === 'number') {
    depth = state.d - 1;
  } else {
    // Untagged entry (should not happen): re-tag it so the invariant keeps working.
    history.replaceState({ d: depth + 1 }, '');
  }
  if (selfBacks > 0) {
    // This pop was our own sync trimming an entry; router state is already correct.
    selfBacks--;
    return;
  }
  // User back press: overlays first, then one route step, then hold on Home.
  if (closeTopOverlay()) return;
  if (backIn(router)) {
    syncHistory();
    return;
  }
  // At Home with nothing open: re-push the sentinel instead of exiting.
  history.pushState({ d: 1 }, '');
}

/**
 * Tag the current entry and start translating popstate into overlay/route pops.
 * Call once from App onMount; returns a cleanup that removes the listener.
 */
export function setupHistory(): () => void {
  if (typeof history === 'undefined' || typeof window === 'undefined') return () => {};
  if (installed) return () => {};
  installed = true;
  depth = 0;
  selfBacks = 0;
  history.replaceState({ d: 1 }, '');
  window.addEventListener('popstate', handlePopState);
  return () => {
    window.removeEventListener('popstate', handlePopState);
    installed = false;
    depth = 0;
    selfBacks = 0;
  };
}
