import assert from 'node:assert/strict';
import test from 'node:test';
import { parseVoiceCommand, parseVoiceCompletion } from '../src/lib/voice.ts';

test('recognizes common offline transcripts as the intended shot', () => {
  const examples = [
    ['point left smashed', 'winner-smash'],
    ['point left drop shop', 'winner-drop'],
    ['point left netkill', 'winner-net'],
    ['point left clear shot', 'winner-clear'],
    ['point left drive shot', 'winner-drive'],
    ['point left service error', 'error-serve'],
    ['point left into the net', 'error-net'],
    ['point left outside', 'error-out'],
    ['point left miss it', 'error-mishit']
  ];
  for (const [spoken, shotTypeId] of examples) {
    const command = parseVoiceCommand(spoken, 'Alice', 'Bob', 'point');
    assert.equal(command?.kind, 'point', spoken);
    assert.equal(command.shotTypeId, shotTypeId, spoken);
  }
});

test('aliases work as completions without guessing a player or wake word', () => {
  assert.equal(parseVoiceCommand('left outside', 'Alice', 'Bob', 'point'), null);
  assert.equal(parseVoiceCommand('point outside', 'Alice', 'Bob', 'point'), null);
  assert.equal(parseVoiceCompletion('missed hit', 'Alice', 'Bob', 'left', 'point')?.kind, 'point');
  assert.equal(parseVoiceCompletion('missed hit', 'Alice', 'Bob', null, 'point'), null);
});

test('recognizer homophones identify right and net kill in complete commands', () => {
  for (const player of ['right', 'write', 'wright', 'rite']) {
    const command = parseVoiceCommand(`point ${player} ned kill`, 'Alice', 'Bob', 'point');
    assert.equal(command?.kind, 'point', player);
    assert.equal(command.slot, 'right', player);
    assert.equal(command.shotTypeId, 'winner-net', player);
  }
  assert.equal(parseVoiceCommand('point left ned kill', 'Alice', 'Bob', 'point')?.slot, 'left');
  assert.equal(parseVoiceCommand('point wright ned', 'Alice', 'Bob', 'point')?.kind, 'arm');
});
