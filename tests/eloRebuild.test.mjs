import assert from 'node:assert/strict';
import test from 'node:test';
import { computeElo, rebuildEloFromHistory, DEFAULT_ELO } from '../src/lib/elo.ts';

function player(id) {
  return { id, name: id, createdAt: 1, deletedAt: null, elo: DEFAULT_ELO };
}

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

function deleteMatch(matches, id) {
  return matches.filter((m) => m.id !== id);
}

test('deleting a match recomputes ratings from the remaining history', () => {
  const players = [player('p1'), player('p2'), player('p3')];
  const first = match('m1', 100, 'p1', 'p2', 21, 10);
  const second = match('m2', 200, 'p1', 'p3', 21, 15);

  rebuildEloFromHistory(players, [first, second]);

  const afterFirst = computeElo(DEFAULT_ELO, DEFAULT_ELO, 21, 10);
  const afterSecond = computeElo(afterFirst.winner, DEFAULT_ELO, 21, 15);
  assert.equal(players[0].elo, afterSecond.winner);
  assert.equal(players[1].elo, afterFirst.loser);
  assert.equal(players[2].elo, afterSecond.loser);
  assert.notEqual(afterSecond.winner, afterFirst.winner);

  const remaining = deleteMatch([first, second], 'm2');
  rebuildEloFromHistory(players, remaining);

  // The first winner is back to its pre-second-match value, not the drifted one.
  assert.equal(players[0].elo, afterFirst.winner);
  assert.equal(players[1].elo, afterFirst.loser);
  assert.equal(players[2].elo, DEFAULT_ELO);
});

test('deleting a tie moves nobody', () => {
  const players = [player('p1'), player('p2')];
  const win = match('win', 100, 'p1', 'p2', 21, 9);
  const tie = match('tie', 200, 'p1', 'p2', 15, 15);
  const matches = [win, tie];

  rebuildEloFromHistory(players, matches);
  const before = players.map((p) => p.elo);

  rebuildEloFromHistory(players, deleteMatch(matches, 'tie'));
  const after = players.map((p) => p.elo);

  assert.deepEqual(after, before);
  assert.equal(after[0], computeElo(DEFAULT_ELO, DEFAULT_ELO, 21, 9).winner);
  assert.equal(after[1], computeElo(DEFAULT_ELO, DEFAULT_ELO, 21, 9).loser);
});
