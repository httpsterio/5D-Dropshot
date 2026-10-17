import assert from 'node:assert/strict';
import test from 'node:test';
import { validateExportFile } from '../src/lib/schema.ts';

function point(scorerSlot, shotTypeId) {
  return { scorerSlot, shotTypeId, timestamp: 1 };
}

function exportFile(points) {
  return {
    app: 'dropshot',
    schemaVersion: 3,
    exportedAt: 1,
    data: {
      schemaVersion: 3,
      players: [
        { id: 'p1', name: 'A', createdAt: 1, deletedAt: null, elo: 1000 },
        { id: 'p2', name: 'B', createdAt: 1, deletedAt: null, elo: 1000 }
      ],
      shotTypes: [
        { id: 'winner-smash', label: 'Smash', attribution: 'winner' },
        { id: 'error-other', label: 'Other error', attribution: 'error' }
      ],
      matches: [
        {
          id: 'm1',
          startedAt: 1,
          endedAt: 2,
          leftPlayerId: 'p1',
          rightPlayerId: 'p2',
          points,
          leftScore: 2,
          rightScore: 1,
          winnerId: 'p1',
          loserId: 'p2',
          isTie: false
        }
      ],
      config: { winThreshold: 21, winByMargin: 2, theme: 'bumblebee', wakeWord: 'point', voiceEngine: 'offline' }
    }
  };
}

test('accepts a null reason as an unrecorded reason', () => {
  const result = validateExportFile(exportFile([
    point('left', 'winner-smash'),
    point('left', null),
    point('right', null)
  ]));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.data.matches[0].points[1].shotTypeId, null);
});

test('accepts a string reason as before', () => {
  const result = validateExportFile(exportFile([point('left', 'winner-smash')]));
  assert.equal(result.ok, true);
  assert.equal(result.ok && result.value.data.matches[0].points[0].shotTypeId, 'winner-smash');
});

test('rejects a missing reason with the match id and 1-based point index', () => {
  const points = [point('left', 'winner-smash'), point('left', 'winner-smash'), { scorerSlot: 'right', timestamp: 3 }];
  const result = validateExportFile(exportFile(points));
  assert.equal(result.ok, false);
  assert.match(result.error, /Invalid reason on match m1 point 3/);
});

test('rejects non-string reasons and names the match id and point index', () => {
  for (const [bad, index] of [[5, 2], [true, 1]]) {
    const points = [point('left', 'winner-smash'), point('left', 'winner-smash')];
    points[index - 1] = { scorerSlot: 'left', shotTypeId: bad, timestamp: index };
    const result = validateExportFile(exportFile(points));
    assert.equal(result.ok, false, String(bad));
    assert.match(result.error, new RegExp(`Invalid reason on match m1 point ${index}`));
  }
});

test('keeps the existing messages for other failures', () => {
  const notExport = validateExportFile({ app: 'other' });
  assert.equal(notExport.ok, false);
  assert.equal(notExport.error, 'Not a DropShot export');

  const badConfig = exportFile([point('left', 'winner-smash')]);
  badConfig.data.config = { winThreshold: 21 };
  const configResult = validateExportFile(badConfig);
  assert.equal(configResult.ok, false);
  assert.equal(configResult.error, 'Invalid config');

  const badPointShape = exportFile([{ shotTypeId: 'winner-smash', timestamp: 1 }]);
  const shapeResult = validateExportFile(badPointShape);
  assert.equal(shapeResult.ok, false);
  assert.equal(shapeResult.error, 'Invalid matches list');
});
