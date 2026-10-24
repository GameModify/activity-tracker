import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { expire } from '../src/application/ingest.ts';
import type { Observation } from '../src/domain/contracts.ts';
import type { TrackingStore } from '../src/application/ports.ts';
import { sample, start, withStore } from './fixtures.ts';
function game(offset: number, name = 'Example Game'): Observation {
  return sample(offset, {
    app: 'game.exe',
    title: name,
    resource_kind: 'game',
    resource_id: 'steam-folder:' + name.toLowerCase(),
  });
}
function sequence(store: TrackingStore, observations: Observation[]): TrackingRuntime {
  return new TrackingRuntime(store, { sample: () => observations.shift() });
}
function away(until: number): Observation[] {
  return Array.from({ length: until / 5000 }, (_, index) => sample((index + 1) * 5000));
}
void test('short Alt+Tab keeps one game interval while other foreground activity is tracked', () => {
  withStore((store) => {
    const observations = [game(0), ...away(115000), game(120000)];
    const runtime = sequence(store, observations);
    while (observations.length) runtime.pollDesktop();
    const games = store.intervals(0, 100).filter((item) => item.resource_kind === 'game');
    assert.equal(games.length, 1);
    assert.equal(games[0]?.end_at, start + 120000);
    assert.equal(games[0].closed, false);
    assert.ok(store.intervals(0, 100).some((item) => item.app === 'Code.exe'));
    assert.equal(runtime.status().game?.active, true);
  });
});
void test('two minutes away pauses at the deadline and returning starts a separate actual segment', () => {
  withStore((store) => {
    const observations = [game(0), ...away(135000)];
    const runtime = sequence(store, observations);
    while (observations.length) runtime.pollDesktop();
    const finished = store.intervals(0, 100).find((item) => item.resource_kind === 'game');
    assert.equal(finished?.end_at, start + 120000);
    assert.equal(finished.closed, true);
    assert.equal(runtime.status().game?.active, false);
    observations.push(game(140000), game(145000));
    while (observations.length) runtime.pollDesktop();
    const games = store.intervals(0, 100).filter((item) => item.resource_kind === 'game');
    assert.equal(games.length, 2);
    assert.equal(
      games.reduce((sum, item) => sum + item.end_at - item.start_at, 0),
      125000,
    );
  });
});
void test('a different game replaces the held game immediately without duplicate foreground gaming', () => {
  withStore((store) => {
    const observations = [game(0), game(5000, 'Other Game'), game(10000, 'Other Game')];
    const runtime = sequence(store, observations);
    while (observations.length) runtime.pollDesktop();
    const rows = store.intervals(0, 100);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((item) => item.title === 'Example Game')?.end_at, start + 5000);
    assert.ok(rows.every((item) => item.channel === 'windows:game'));
    assert.equal(runtime.status().game?.title, 'Other Game');
  });
});
void test('missing desktop heartbeats cannot resume a background game after sleep', () => {
  withStore((store) => {
    const runtime = sequence(store, [game(0), sample(5000), sample(25000), sample(30000)]);
    runtime.pollDesktop();
    runtime.pollDesktop();
    expire(store, start + 25000);
    runtime.pollDesktop();
    runtime.pollDesktop();
    const gameRow = store.intervals(0, 100).find((item) => item.resource_kind === 'game');
    assert.equal(gameRow?.end_at, start + 5000);
    assert.equal(gameRow.closed, true);
    assert.equal(runtime.status().game, null);
  });
});
void test('pausing collection clears the held game and cannot resume it from another application', () => {
  withStore((store) => {
    const runtime = sequence(store, [game(0), sample(5000)]);
    runtime.pollDesktop();
    runtime.setPaused(true);
    assert.equal(runtime.status().game, null);
    runtime.setPaused(false);
    runtime.pollDesktop();
    assert.equal(runtime.status().game, null);
    assert.equal(store.intervals(0, 100).filter((item) => item.resource_kind === 'game').length, 1);
  });
});
