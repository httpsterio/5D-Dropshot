import type { FinishedMatch, ID } from './types';
import { computeElo, DEFAULT_ELO } from './elo.ts';

export interface EloPoint {
  elo: number;
  endedAt: number;
  matchId: ID;
  result: 'win' | 'loss' | 'tie';
}

/**
 * Replay a player's Elo history the same way `rebuildEloFromHistory` does: start at
 * DEFAULT_ELO, sort ascending by endedAt, skip ties, and apply `computeElo`.
 *
 * Returns the start rating first, then one element per match the player took part in.
 * A match that does not involve the player still updates the opponents' ratings so later
 * results stay consistent, but it does not get its own point.
 *
 * `anchorElo` (usually the stored `player.elo`) shifts the whole series so the final point
 * lands exactly on the rating shown elsewhere.
 */
export function eloSeries(playerId: ID, matches: FinishedMatch[], anchorElo?: number): EloPoint[] {
  const sorted = [...matches].sort((a, b) => a.endedAt - b.endedAt);
  const elos = new Map<ID, number>();
  const eloOf = (id: ID) => elos.get(id) ?? DEFAULT_ELO;

  const series: EloPoint[] = [{
    elo: DEFAULT_ELO,
    endedAt: sorted.length > 0 ? sorted[0].endedAt : 0,
    matchId: '',
    result: 'tie'
  }];

  for (const m of sorted) {
    let result: EloPoint['result'] = 'tie';

    if (!m.isTie && m.winnerId && m.loserId) {
      const winnerScore = m.winnerId === m.leftPlayerId ? m.leftScore : m.rightScore;
      const loserScore = m.loserId === m.leftPlayerId ? m.leftScore : m.rightScore;
      const updated = computeElo(eloOf(m.winnerId), eloOf(m.loserId), winnerScore, loserScore);
      elos.set(m.winnerId, updated.winner);
      elos.set(m.loserId, updated.loser);
      if (m.winnerId === playerId) result = 'win';
      else if (m.loserId === playerId) result = 'loss';
    }

    if (m.leftPlayerId === playerId || m.rightPlayerId === playerId) {
      series.push({ elo: eloOf(playerId), endedAt: m.endedAt, matchId: m.id, result });
    }
  }

  // Stored Elo can drift from a fresh replay (deleting a match does not roll ratings back and
  // imports keep their stored elo), so shift the whole line to end on the displayed rating.
  if (anchorElo !== undefined) {
    const delta = anchorElo - series[series.length - 1].elo;
    if (delta !== 0) {
      for (const point of series) point.elo += delta;
    }
  }

  return series;
}
