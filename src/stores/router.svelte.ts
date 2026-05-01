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
  | { name: 'settingsData' }
  | { name: 'player'; playerId: string };

interface RouterState {
  stack: Route[];
}

export const router = $state<RouterState>({
  stack: [{ name: 'home' }]
});

export function current(): Route {
  return router.stack[router.stack.length - 1];
}

export function tabOf(route: Route): Tab {
  if (route.name === 'home') return 'home';
  if (route.name === 'match') return 'match';
  if (route.name === 'history' || route.name === 'historyDetail') return 'history';
  return 'settings';
}

export function go(route: Route): void {
  router.stack.push(route);
}

export function back(): boolean {
  if (router.stack.length <= 1) return false;
  router.stack.pop();
  return true;
}

export function switchTab(tab: Tab): void {
  const root: Route =
    tab === 'home' ? { name: 'home' } :
    tab === 'match' ? { name: 'match' } :
    tab === 'history' ? { name: 'history' } :
    { name: 'settings' };
  router.stack = [root];
}

export function reset(route: Route = { name: 'home' }): void {
  router.stack = [route];
}
