/**
 * Pure router logic, free of runes and DOM so it can be unit-tested under node.
 * The reactive store wrapper lives in router.svelte.ts.
 */

export type Tab = 'home' | 'match' | 'history' | 'settings';

export type Route =
  | { name: 'home' }
  | { name: 'match' }
  | { name: 'history' }
  | { name: 'historyDetail'; matchId: string }
  | { name: 'settings' }
  | { name: 'settingsPlayers' }
  | { name: 'settingsShotTypes' }
  | { name: 'settingsMatchConfig' }
  | { name: 'settingsVoice' }
  | { name: 'settingsTheme' }
  | { name: 'settingsData' }
  | { name: 'player'; playerId: string };

export interface RouterState {
  stack: Route[];
}

export function currentOf(s: RouterState): Route {
  return s.stack[s.stack.length - 1];
}

export function tabOf(route: Route): Tab {
  if (route.name === 'home') return 'home';
  if (route.name === 'match') return 'match';
  if (route.name === 'history' || route.name === 'historyDetail') return 'history';
  return 'settings';
}

function tabRoot(tab: Tab): Route {
  if (tab === 'match') return { name: 'match' };
  if (tab === 'history') return { name: 'history' };
  if (tab === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function goIn(s: RouterState, route: Route): void {
  s.stack.push(route);
}

export function backIn(s: RouterState): boolean {
  if (s.stack.length <= 1) return false;
  s.stack.pop();
  return true;
}

/** Full reset: tab roots sit directly on Home, so hop trails can never accumulate. */
export function switchTabIn(s: RouterState, tab: Tab): void {
  const root = tabRoot(tab);
  s.stack = tab === 'home' ? [root] : [tabRoot('home'), root];
}

export function resetIn(s: RouterState, route: Route = { name: 'home' }): void {
  s.stack = [route];
}

/**
 * LIFO registry of open overlays. closeTop() removes the most recently
 * registered overlay before invoking it, so the count is accurate the moment
 * the close callback runs (the component's unregister call becomes a no-op).
 */
export class OverlayRegistry {
  #entries: { close: () => void }[] = [];

  register(close: () => void): () => void {
    const entry = { close };
    this.#entries.push(entry);
    return () => {
      const i = this.#entries.indexOf(entry);
      if (i !== -1) this.#entries.splice(i, 1);
    };
  }

  closeTop(): boolean {
    const entry = this.#entries.pop();
    if (!entry) return false;
    entry.close();
    return true;
  }

  count(): number {
    return this.#entries.length;
  }
}
