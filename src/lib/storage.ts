import type { AppData } from './types';
import { emptyAppData, SCHEMA_VERSION } from './defaults';
import { rebuildEloFromHistory } from './elo';

const KEY = 'dropshot:v1';

export function load(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyAppData();
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.schemaVersion !== SCHEMA_VERSION) {
      return migrate(parsed);
    }
    return parsed;
  } catch {
    return emptyAppData();
  }
}

export function save(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // quota exceeded or private browsing — app continues in memory only
  }
}

function migrate(data: any): AppData {
  const empty = emptyAppData();
  const result: AppData = {
    ...empty,
    ...data,
    config: { ...empty.config, ...(data.config || {}) },
    schemaVersion: SCHEMA_VERSION
  };
  const needsElo = result.players.some((p: any) => typeof p.elo !== 'number');
  if (needsElo) rebuildEloFromHistory(result.players, result.matches);
  return result;
}
