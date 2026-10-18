import assert from 'node:assert/strict';
import test from 'node:test';
import { eloSeries } from '../src/lib/eloHistory.ts';
import { computeElo, DEFAULT_ELO } from '../src/lib/elo.ts';

function match(id, endedAt, leftPlayerId, rightPlayerId, leftScore, rightScore) {
  const isTie = leftScore === rightScore;
  const leftWon = leftScore > rightScore;
  return {
    id,
    startedAt: endedAt - 10,
    endedAt,
    leftPlayerId,
    rightPlayerId,
    points: [],
    leftScore,
    rightScore,
    winnerId: isTie ? null : leftWon ? leftPlayerId : rightPlayerId,
    loserId: isTie ? null : leftWon ? rightPlayerId : leftPlayerId,
    isTie
  };
}

test('starts at DEFAULT_ELO before any match', () => {
  const series = eloSeries('p1', []);
  assert.equal(series.length, 1);
  assert.equal(series[0].elo, DEFAULT_ELO);
  assert.equal(series[0].result, 'tie');
  assert.equal(series[0].matchId, '');
});

test('produces one element per match in ascending endedAt order', () => {
  const early = match('early', 100, 'p1', 'p2', 21, 10);
  const late = match('late', 300, 'p2', 'p1', 21, 15);
  const series = eloSeries('p1', [late, early]);

  assert.equal(series.length, 3);
  assert.equal(series[1].matchId, 'early');
  assert.equal(series[2].matchId, 'late');
  assert.ok(series[1].endedAt < series[2].endedAt);
  assert.equal(series[1].result, 'win');
  assert.equal(series[2].result, 'loss');
});

test('a tie leaves the rating unchanged', () => {
  const win = match('win', 100, 'p1', 'p2', 21, 9);
  const tied = match('tie', 200, 'p1', 'p2', 21, 21);
  const series = eloSeries('p1', [win, tied]);

  const afterWin = series[1].elo;
  assert.notEqual(afterWin, DEFAULT_ELO);
  assert.equal(series[2].elo, afterWin);
  assert.equal(series[2].result, 'tie');
});

test('a single 21-9 match equals computeElo(1000, 1000, 21, 9).winner', () => {
  const series = eloSeries('p1', [match('only', 100, 'p1', 'p2', 21, 9)]);
  const expected = computeElo(DEFAULT_ELO, DEFAULT_ELO, 21, 9).winner;

  assert.equal(series.length, 2);
  assert.equal(series[1].elo, expected);
  assert.equal(series[1].result, 'win');
});

test('anchoring shifts the whole series so the last point equals player.elo', () => {
  const played = match('only', 100, 'p1', 'p2', 21, 9);
  const raw = eloSeries('p1', [played]);
  const anchored = eloSeries('p1', [played], 1234);
  const delta = 1234 - raw[raw.length - 1].elo;

  assert.equal(anchored[anchored.length - 1].elo, 1234);
  assert.equal(anchored[0].elo, DEFAULT_ELO + delta);
  assert.equal(anchored[1].elo, raw[1].elo + delta);

  // An anchor equal to the replay result is a no-op.
  const unchanged = eloSeries('p1', [played], raw[raw.length - 1].elo);
  assert.deepEqual(unchanged, raw);
});
