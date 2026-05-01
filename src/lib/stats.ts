import type { FinishedMatch, ShotType, ID } from './types';

export interface PlayerStats {
  wins: number;
  losses: number;
  ties: number;
  matches: number;
  totalPoints: number;
  pointsConceded: number;
  shotBreakdown: Map<ID, { count: number; pct: number; label: string; attribution: 'winner' | 'error' }>;
}

let cachedVersion = -1;
const cache = new Map<ID, PlayerStats>();

export function statsFor(playerId: ID, matches: FinishedMatch[], shotTypes: ShotType[], version: number): PlayerStats {
  if (version !== cachedVersion) {
    cache.clear();
    cachedVersion = version;
  }
  const cached = cache.get(playerId);
  if (cached) return cached;

  const stats: PlayerStats = {
    wins: 0,
    losses: 0,
    ties: 0,
    matches: 0,
    totalPoints: 0,
    pointsConceded: 0,
    shotBreakdown: new Map()
  };

  const shotMap = new Map(shotTypes.map((s) => [s.id, s]));

  for (const m of matches) {
    const isLeft = m.leftPlayerId === playerId;
    const isRight = m.rightPlayerId === playerId;
    if (!isLeft && !isRight) continue;

    stats.matches++;
    if (m.isTie) stats.ties++;
    else if (m.winnerId === playerId) stats.wins++;
    else stats.losses++;

    const myScore = isLeft ? m.leftScore : m.rightScore;
    const oppScore = isLeft ? m.rightScore : m.leftScore;
    stats.totalPoints += myScore;
    stats.pointsConceded += oppScore;

    for (const point of m.points) {
      const shot = shotMap.get(point.shotTypeId);
      if (!shot) continue;
      const pointWentToLeft = point.scorerSlot === 'left';
      const pointForMe = (isLeft && pointWentToLeft) || (isRight && !pointWentToLeft);

      const responsibleIsMe = shot.attribution === 'winner' ? pointForMe : !pointForMe;
      if (!responsibleIsMe) continue;

      const entry = stats.shotBreakdown.get(shot.id) ?? {
        count: 0,
        pct: 0,
        label: shot.label,
        attribution: shot.attribution
      };
      entry.count++;
      stats.shotBreakdown.set(shot.id, entry);
    }
  }

  let totalActions = 0;
  for (const e of stats.shotBreakdown.values()) totalActions += e.count;
  for (const e of stats.shotBreakdown.values()) {
    e.pct = totalActions > 0 ? (e.count / totalActions) * 100 : 0;
  }

  cache.set(playerId, stats);
  return stats;
}

export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}
