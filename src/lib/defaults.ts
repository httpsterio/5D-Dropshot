import type { AppData, ShotType, MatchConfig } from './types';

export const SCHEMA_VERSION = 3;

export const DEFAULT_SHOT_TYPES: ShotType[] = [
  { id: 'winner-smash', label: 'Smash', attribution: 'winner' },
  { id: 'winner-drop', label: 'Drop shot', attribution: 'winner' },
  { id: 'winner-net', label: 'Net kill', attribution: 'winner' },
  { id: 'winner-clear', label: 'Clear winner', attribution: 'winner' },
  { id: 'winner-drive', label: 'Drive winner', attribution: 'winner' },
  { id: 'error-serve', label: 'Service fault', attribution: 'error' },
  { id: 'error-net', label: 'Hit the net', attribution: 'error' },
  { id: 'error-out', label: 'Out of bounds', attribution: 'error' },
  { id: 'error-mishit', label: 'Mishit', attribution: 'error' },
  { id: 'error-other', label: 'Other error', attribution: 'error' }
];

export const DEFAULT_CONFIG: MatchConfig = {
  winThreshold: 21,
  winByMargin: 2,
  theme: 'sunset'
};

export function emptyAppData(): AppData {
  return {
    schemaVersion: SCHEMA_VERSION,
    players: [],
    shotTypes: [...DEFAULT_SHOT_TYPES],
    matches: [],
    config: { ...DEFAULT_CONFIG },
    activeMatch: null,
    historyVersion: 0
  };
}
