import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OverlayRegistry,
  backIn,
  currentOf,
  goIn,
  switchTabIn,
  tabOf
} from '../src/stores/routerCore.ts';

function fresh() {
  return { stack: [{ name: 'home' }] };
}

test('switchTab resets a hop trail so back cannot walk old tabs', () => {
  const s = fresh();
  switchTabIn(s, 'settings');
  switchTabIn(s, 'match');
  switchTabIn(s, 'history');
  switchTabIn(s, 'settings');
  assert.deepEqual(s.stack, [{ name: 'home' }, { name: 'settings' }]);
  assert.equal(backIn(s), true);
  assert.equal(currentOf(s).name, 'home');
  assert.equal(backIn(s), false);
});

test('non-home tab roots are parented to home', () => {
  for (const tab of ['match', 'history', 'settings']) {
    const s = fresh();
    switchTabIn(s, tab);
    assert.deepEqual(s.stack, [{ name: 'home' }, { name: tab }]);
    assert.equal(tabOf(currentOf(s)), tab);
  }
  const home = fresh();
  switchTabIn(home, 'home');
  assert.deepEqual(home.stack, [{ name: 'home' }]);
});

test('back() returns false at the root and pops one level otherwise', () => {
  const s = fresh();
  assert.equal(backIn(s), false);
  assert.equal(s.stack.length, 1);
  goIn(s, { name: 'settings' });
  goIn(s, { name: 'settingsPlayers' });
  assert.equal(backIn(s), true);
  assert.equal(currentOf(s).name, 'settings');
  assert.equal(backIn(s), true);
  assert.equal(currentOf(s).name, 'home');
  assert.equal(backIn(s), false);
});

test('overlay registry closes the most recently registered overlay first', () => {
  const reg = new OverlayRegistry();
  assert.equal(reg.closeTop(), false);

  const closed = [];
  reg.register(() => closed.push('first'));
  reg.register(() => closed.push('second'));
  assert.equal(reg.count(), 2);

  assert.equal(reg.closeTop(), true);
  assert.deepEqual(closed, ['second']);
  assert.equal(reg.count(), 1);

  assert.equal(reg.closeTop(), true);
  assert.deepEqual(closed, ['second', 'first']);
  assert.equal(reg.count(), 0);
  assert.equal(reg.closeTop(), false);
});

test('unregistering removes only its own overlay and is safe to call twice', () => {
  const reg = new OverlayRegistry();
  const closed = [];
  const un1 = reg.register(() => closed.push('one'));
  reg.register(() => closed.push('two'));
  un1();
  assert.equal(reg.count(), 1);
  assert.equal(reg.closeTop(), true);
  assert.deepEqual(closed, ['two']); // "one" was unregistered, so it never closes
  un1(); // already gone — no-op
  assert.equal(reg.count(), 0);
});

test('closing an overlay before its unregister runs leaves the registry consistent', () => {
  const reg = new OverlayRegistry();
  let closed = false;
  const unregister = reg.register(() => { closed = true; });
  assert.equal(reg.closeTop(), true); // e.g. hardware back removed it first
  assert.equal(closed, true);
  unregister(); // the component's effect cleanup fires later — must not double-close
  assert.equal(reg.count(), 0);
  assert.equal(reg.closeTop(), false);
});
