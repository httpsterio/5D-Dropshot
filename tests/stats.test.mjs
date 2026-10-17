import assert from 'node:assert/strict';
import test from 'node:test';
import { statsFor } from '../src/lib/stats.ts';

const shotTypes = [
  { id: 'winner-smash', label: 'Smash', attribution: 'winner' },
  { id: 'winner-drop', label: 'Drop', attribution: 'winner' },
  { id: 'error-other', label: 'Other error', attribution: 'error' }
];

// Scores: 4 left points, 1 right point. Two left reasons are null (never recorded).
const match = {
  id: 'm1',
  startedAt: 1,
  endedAt: 2,
  leftPlayerId: 'p1',
  rightPlayerId: 'p2',
  points: [
    { scorerSlot: 'left', shotTypeId: 'winner-smash', timestamp: 1 },
    { scorerSlot: 'left', shotTypeId: 'winner-drop', timestamp: 2 },
    { scorerSlot: 'left', shotTypeId: null, timestamp: 3 },
    { scorerSlot: 'left', shotTypeId: null, timestamp: 4 },
    { scorerSlot: 'right', shotTypeId: null, timestamp: 5 }
  ],
  leftScore: 4,
  rightScore: 1,
  winnerId: 'p1',
  loserId: 'p2',
  isTie: false
};

test('null reasons are excluded from the shot breakdown', () => {
  const stats = statsFor('p1', [match], shotTypes, 1);
  assert.deepEqual([...stats.shotBreakdown.keys()], ['winner-smash', 'winner-drop']);
  assert.equal(stats.shotBreakdown.has('error-other'), false);
});

test('percentages are computed over attributed points only', () => {
  const stats = statsFor('p1', [match], shotTypes, 2);
  const smash = stats.shotBreakdown.get('winner-smash');
  const drop = stats.shotBreakdown.get('winner-drop');
  assert.equal(smash.count, 1);
  assert.equal(drop.count, 1);
  assert.equal(smash.pct, 50);
  assert.equal(drop.pct, 50);
  assert.equal([...stats.shotBreakdown.values()].reduce((sum, e) => sum + e.pct, 0), 100);
});

test('totalPoints and pointsConceded come from the match scores, not the reasons', () => {
  const p1 = statsFor('p1', [match], shotTypes, 3);
  assert.equal(p1.matches, 1);
  assert.equal(p1.wins, 1);
  assert.equal(p1.totalPoints, 4);
  assert.equal(p1.pointsConceded, 1);

  const p2 = statsFor('p2', [match], shotTypes, 4);
  assert.equal(p2.matches, 1);
  assert.equal(p2.losses, 1);
  assert.equal(p2.totalPoints, 1);
  assert.equal(p2.pointsConceded, 4);
});

test('a player whose points are all reason-less still gets score-based stats', () => {
  const reasonless = {
    ...match,
    id: 'm2',
    points: [
      { scorerSlot: 'right', shotTypeId: null, timestamp: 1 },
      { scorerSlot: 'right', shotTypeId: null, timestamp: 2 }
    ],
    leftScore: 0,
    rightScore: 2,
    winnerId: 'p2',
    loserId: 'p1'
  };
  const stats = statsFor('p2', [reasonless], shotTypes, 5);
  assert.equal(stats.matches, 1);
  assert.equal(stats.wins, 1);
  assert.equal(stats.totalPoints, 2);
  assert.equal(stats.pointsConceded, 0);
  assert.equal(stats.shotBreakdown.size, 0);
});
