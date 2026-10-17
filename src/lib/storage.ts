import type { AppData } from './types';
import { DEFAULT_CONFIG, emptyAppData, SCHEMA_VERSION } from './defaults';
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
    // Saves from before the wake word setting exist: backfill only this field.
    if (typeof parsed.config?.wakeWord !== 'string' || parsed.config.wakeWord.trim() === '') {
      parsed.config = { ...parsed.config, wakeWord: DEFAULT_CONFIG.wakeWord };
    }
    // Same for the speech engine setting.
    if (parsed.config?.voiceEngine !== 'chrome' && parsed.config?.voiceEngine !== 'offline') {
      parsed.config = { ...parsed.config, voiceEngine: DEFAULT_CONFIG.voiceEngine };
    }
    // Saves from before the haptics setting exist: backfill only this field.
    if (typeof parsed.config?.haptics !== 'boolean') {
      parsed.config = { ...parsed.config, haptics: DEFAULT_CONFIG.haptics };
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

/** True when the saved snapshot already contains this active match (so a reload restores it). */
export function activeMatchPersisted(id: string, pointCount: number): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { activeMatch?: { id?: string; points?: unknown[] } | null };
    const saved = parsed.activeMatch;
    return !!saved && saved.id === id && Array.isArray(saved.points) && saved.points.length === pointCount;
  } catch {
    return false;
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
