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
 * Estimate the per-rally win probability for `playerId` against `opponentId`.
 * Uses H2H points ratio from completed matches, falling back to overall ratio,
 * then 0.5.
 */
export function headToHeadP(
  playerId: string,
  opponentId: string,
  matches: FinishedMatch[]
): number {
  let h2hWon = 0, h2hTotal = 0;
  let allWon = 0, allTotal = 0;

  for (const m of matches) {
    const isLeft = m.leftPlayerId === playerId;
    const isRight = m.rightPlayerId === playerId;
    if (!isLeft && !isRight) continue;

    const myScore = isLeft ? m.leftScore : m.rightScore;
    const total = m.leftScore + m.rightScore;
    allWon += myScore;
    allTotal += total;

    const isH2H = (isLeft && m.rightPlayerId === opponentId) ||
                  (isRight && m.leftPlayerId === opponentId);
    if (isH2H) {
      h2hWon += myScore;
      h2hTotal += total;
    }
  }

  if (h2hTotal > 0) return h2hWon / h2hTotal;
  if (allTotal > 0) return allWon / allTotal;
  return 0.5;
}
