import { registerSW } from 'virtual:pwa-register';
import { app } from '../stores/app.svelte';
import { activeMatchPersisted } from './storage';

/** How often the open app asks the browser to re-check sw.js for a new version. */
const UPDATE_CHECK_INTERVAL_MS = 60_000;

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

let updateServiceWorker: UpdateServiceWorker | null = null;
let pendingUpdate = false;

/**
 * The store persists the active match (points, players, score) to localStorage on
 * every change, so a mid-match reload restores it. If the active match is not in
 * the saved snapshot yet, a reload would lose it and the update must be held.
 */
function canRefreshWithoutLosingData(): boolean {
  const match = app.activeMatch;
  if (!match) return true; // not mid-match
  return activeMatchPersisted(match.id, match.points.length);
}

function applyPendingUpdate(): void {
  if (!pendingUpdate || !updateServiceWorker) return;
  if (!canRefreshWithoutLosingData()) return; // mid-match, not persisted yet: hold
  pendingUpdate = false;
  void updateServiceWorker(true); // activate the waiting service worker and reload
}

export function setupAutoUpdate(): void {
  // Retry a held update whenever the active match changes (point logged / match ended).
  $effect.root(() => {
    $effect(() => {
      void app.activeMatch?.points.length;
      applyPendingUpdate();
    });
  });

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      pendingUpdate = true;
      applyPendingUpdate();
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      // A worker that was already waiting before this page load is an update too.
      if (registration.waiting) {
        pendingUpdate = true;
        applyPendingUpdate();
      }
      const checkForUpdate = () => {
        registration.update().catch(() => {});
      };
      checkForUpdate();
      window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
    },
    onRegisterError(error) {
      console.error('[pwa] service worker registration failed', error);
    }
  });
}
