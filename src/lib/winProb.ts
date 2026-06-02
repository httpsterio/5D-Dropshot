import type { FinishedMatch } from './types';

/**
 * Compute win probability for the left player given the current score state.
 * Uses memoized DP. Applies the deuce closed-form (p²/(p²+q²)) for any
 * symmetric state where both scores ≥ (threshold - margin + 1).
 */
export function computeWinProb(
  leftScore: number,
  rightScore: number,
  p: number,
  threshold: number,
  margin: number
): number {
  const q = 1 - p;
  // Scores >= this value when tied trigger the closed-form deuce formula
  const deuceStart = threshold - margin + 1;
  const memo = new Map<string, number>();

  function dp(a: number, b: number): number {
    if (a >= threshold && a - b >= margin) return 1;
    if (b >= threshold && b - a >= margin) return 0;
    // Tied at deuce territory: closed-form infinite-series solution
    if (a === b && a >= deuceStart) return (p * p) / (p * p + q * q);
    const key = `${a},${b}`;
    let v = memo.get(key);
    if (v !== undefined) return v;
    v = p * dp(a + 1, b) + q * dp(a, b + 1);
    memo.set(key, v);
    return v;
  }

  return dp(leftScore, rightScore);
}

/**
 * Returns the smoothed H2H match win rate for `playerId` against `opponentId`.
 * Uses Beta(1,1) prior: (wins + 1) / (matches + 2). Falls back to 0.5.
 */
export function h2hMatchWinRate(
  playerId: string,
  opponentId: string,
  matches: FinishedMatch[]
): number {
  let wins = 0, total = 0;

  for (const m of matches) {
    const isLeft = m.leftPlayerId === playerId;
    const isRight = m.rightPlayerId === playerId;
    if (!isLeft && !isRight) continue;

    const isH2H = (isLeft && m.rightPlayerId === opponentId) ||
                  (isRight && m.leftPlayerId === opponentId);
    if (!isH2H) continue;
    total++;
    if (m.winnerId === playerId) wins++;
  }

  return total > 0 ? (wins + 1) / (total + 2) : 0.5;
}

/**
 * Binary-search for the per-rally probability `p` that produces `target`
 * match win rate at 0-0. Used to make the starting probability consistent
 * with the historical H2H match record.
 */
export function inferP(
  target: number,
  threshold: number,
  margin: number
): number {
  if (target === 0.5) return 0.5;
  let lo = target > 0.5 ? 0.5 : 0;
  let hi = target > 0.5 ? 1.0 : 0.5;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const prob = computeWinProb(0, 0, mid, threshold, margin);
    if (prob > target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
