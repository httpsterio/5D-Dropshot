import { app } from '../stores/app.svelte';

/**
 * Fire a short vibration tick. Silent no-op when the user turned haptics off,
 * when the Vibrate API is missing (e.g. iOS Safari), or if the browser throws.
 */
export function vibrate(ms = 30): void {
  if (!app.config.haptics) return;
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(ms);
  } catch {
    // best effort only — never let haptics break an interaction
  }
}
