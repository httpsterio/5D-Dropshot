import type { AppData, Player, ShotType, FinishedMatch, ActiveMatch, MatchConfig, Point, Slot } from '../lib/types';
import { load, save } from '../lib/storage';
import { uid } from '../lib/id';

const initial = load();

export const app = $state<AppData>(initial);

function persist() {
  save(app);
}

$effect.root(() => {
  $effect(() => {
    void app.players;
    void app.shotTypes;
    void app.matches;
    void app.config;
    void app.activeMatch;
    void app.historyVersion;
    persist();
  });
});

export function activePlayers(): Player[] {
  return app.players.filter((p) => p.deletedAt === null);
}

export function findPlayerByName(name: string): Player | undefined {
  const norm = name.trim().toLowerCase();
  return app.players.find((p) => p.name.trim().toLowerCase() === norm);
}

export function getPlayer(id: string | null): Player | undefined {
  if (!id) return undefined;
  return app.players.find((p) => p.id === id);
}

export function getShotType(id: string): ShotType | undefined {
  return app.shotTypes.find((s) => s.id === id);
}

export function addPlayer(name: string): Player {
  const player: Player = {
    id: uid(),
    name: name.trim(),
    createdAt: Date.now(),
    deletedAt: null
  };
  app.players.push(player);
  return player;
}

export function restorePlayer(id: string, newName?: string): void {
  const p = app.players.find((p) => p.id === id);
  if (!p) return;
  p.deletedAt = null;
  if (newName) p.name = newName.trim();
}

export function softDeletePlayer(id: string): void {
  const p = app.players.find((p) => p.id === id);
  if (!p) return;
  p.deletedAt = Date.now();
  if (app.activeMatch) {
    if (app.activeMatch.leftPlayerId === id) app.activeMatch.leftPlayerId = null;
    if (app.activeMatch.rightPlayerId === id) app.activeMatch.rightPlayerId = null;
  }
}

export function renamePlayer(id: string, newName: string): void {
  const p = app.players.find((p) => p.id === id);
  if (!p) return;
  p.name = newName.trim();
}

export function addShotType(label: string, attribution: 'winner' | 'error'): ShotType {
  const t: ShotType = { id: uid(), label: label.trim(), attribution };
  app.shotTypes.push(t);
  return t;
}

export function updateShotType(id: string, patch: Partial<Pick<ShotType, 'label' | 'attribution'>>): void {
  const t = app.shotTypes.find((s) => s.id === id);
  if (!t) return;
  const attributionChanged = patch.attribution !== undefined && patch.attribution !== t.attribution;
  if (patch.label !== undefined) t.label = patch.label.trim();
  if (patch.attribution !== undefined) t.attribution = patch.attribution;
  if (attributionChanged) app.historyVersion++;
}

export function removeShotType(id: string): void {
  app.shotTypes = app.shotTypes.filter((s) => s.id !== id);
  app.historyVersion++;
}

export function setConfig(patch: Partial<MatchConfig>): void {
  Object.assign(app.config, patch);
}

export function startMatch(): ActiveMatch {
  const m: ActiveMatch = {
    id: uid(),
    startedAt: Date.now(),
    leftPlayerId: null,
    rightPlayerId: null,
    points: [],
    winPromptShown: false
  };
  app.activeMatch = m;
  return m;
}

export function setSlotPlayer(slot: Slot, playerId: string | null): void {
  if (!app.activeMatch) return;
  if (slot === 'left') app.activeMatch.leftPlayerId = playerId;
  else app.activeMatch.rightPlayerId = playerId;
}

export function logPoint(scorerSlot: Slot, shotTypeId: string): void {
  if (!app.activeMatch) return;
  const p: Point = { scorerSlot, shotTypeId, timestamp: Date.now() };
  app.activeMatch.points.push(p);
}

export function undoPoint(): Point | undefined {
  if (!app.activeMatch || app.activeMatch.points.length === 0) return undefined;
  return app.activeMatch.points.pop();
}

export function scoreOf(match: ActiveMatch | FinishedMatch): { left: number; right: number } {
  let left = 0, right = 0;
  for (const p of match.points) {
    if (p.scorerSlot === 'left') left++;
    else right++;
  }
  return { left, right };
}

export function endMatch(): FinishedMatch | null {
  if (!app.activeMatch) return null;
  const m = app.activeMatch;
  if (!m.leftPlayerId || !m.rightPlayerId) return null;
  const { left, right } = scoreOf(m);
  const finished: FinishedMatch = {
    id: m.id,
    startedAt: m.startedAt,
    endedAt: Date.now(),
    leftPlayerId: m.leftPlayerId,
    rightPlayerId: m.rightPlayerId,
    points: [...m.points],
    leftScore: left,
    rightScore: right,
    winnerId: left === right ? null : (left > right ? m.leftPlayerId : m.rightPlayerId),
    loserId: left === right ? null : (left > right ? m.rightPlayerId : m.leftPlayerId),
    isTie: left === right
  };
  app.matches.push(finished);
  app.matches.sort((a, b) => b.endedAt - a.endedAt);
  app.activeMatch = null;
  app.historyVersion++;
  return finished;
}

export function abortMatch(): void {
  app.activeMatch = null;
}

export function deleteMatch(id: string): void {
  app.matches = app.matches.filter((m) => m.id !== id);
  app.historyVersion++;
}

export function replaceAll(data: Pick<AppData, 'players' | 'shotTypes' | 'matches' | 'config'>): void {
  app.players = data.players;
  app.shotTypes = data.shotTypes;
  app.matches = data.matches;
  app.config = data.config;
  app.activeMatch = null;
  app.historyVersion++;
}

export function exportSnapshot() {
  return {
    app: 'dropshot' as const,
    schemaVersion: app.schemaVersion,
    exportedAt: Date.now(),
    data: {
      schemaVersion: app.schemaVersion,
      players: app.players,
      shotTypes: app.shotTypes,
      matches: app.matches,
      config: app.config
    }
  };
}
