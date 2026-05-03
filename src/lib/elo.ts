import type { FinishedMatch, Player } from './types';

export const DEFAULT_ELO = 1000;
const BASE_K = 32;
const SCALE_DIVISOR = 21;

export function computeElo(
  winnerElo: number,
  loserElo: number,
  winnerScore: number,
  loserScore: number
): { winner: number; loser: number } {
  const margin = winnerScore - loserScore;
  const K = BASE_K * margin / SCALE_DIVISOR;
  const expected = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
  return {
    winner: Math.round(winnerElo + K * (1 - expected)),
    loser: Math.round(loserElo - K * expected)
  };
}

export function rebuildEloFromHistory(players: Player[], matches: FinishedMatch[]): void {
  const elos = new Map<string, number>(players.map(p => [p.id, DEFAULT_ELO]));
  const sorted = [...matches].sort((a, b) => a.endedAt - b.endedAt);

  for (const m of sorted) {
    if (m.isTie || !m.winnerId || !m.loserId) continue;
    const wElo = elos.get(m.winnerId) ?? DEFAULT_ELO;
    const lElo = elos.get(m.loserId) ?? DEFAULT_ELO;
    const winnerScore = m.winnerId === m.leftPlayerId ? m.leftScore : m.rightScore;
    const loserScore = m.loserId === m.leftPlayerId ? m.leftScore : m.rightScore;
    const updated = computeElo(wElo, lElo, winnerScore, loserScore);
    elos.set(m.winnerId, updated.winner);
    elos.set(m.loserId, updated.loser);
  }

  for (const p of players) {
    p.elo = elos.get(p.id) ?? DEFAULT_ELO;
  }
}
