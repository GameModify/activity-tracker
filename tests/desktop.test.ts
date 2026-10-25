import { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { startTracking } from '../src/bootstrap.ts';
import type { RunningTracker } from '../src/bootstrap.ts';
import { DesktopController } from '../src/desktop-controller.ts';
import { shellMenu } from '../src/application/desktop-shell.ts';
import { sample } from './fixtures.ts';
async function withTracker(
  action: (app: RunningTracker, directory: string) => Promise<void>,
): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'tracker-desktop-'));
  const app = await startTracking({
    directory,
    assets: path.resolve('dist/assets'),
    port: 0,
    desktop: false,
  });
  try {
    await action(app, directory);
  } finally {
    await app.stop();
    rmSync(directory, { recursive: true, force: true });
  }
}
void test('tray menu exposes pause, settings, extension and exit with current state', () => {
  for (const paused of [true, false]) {
    const items = shellMenu(paused);
    assert.equal(items[0]?.label, paused ? 'Учёт приостановлен' : 'Учёт включён');
    assert.equal(items[1]?.command, 'toggle');
    assert.equal(items[1].label, paused ? 'Продолжить учёт' : 'Приостановить учёт');
    assert.deepEqual(
      items.slice(2).map((item) => item.command),
      ['website', 'settings', 'directory', 'extension', 'exit'],
    );
  }
});
async function controllerFixture(app: RunningTracker, directory: string) {
  const states: boolean[] = [],
    opened: string[] = [];
  const calls = { closed: 0, released: 0 };
  const controller = new DesktopController(app, {
    assets: directory,
    directory,
    website: 'http://127.0.0.1:3535/',
    release: () => {
      calls.released++;
    },
    open: (target) => {
      opened.push(target);
    },
  });
  await controller.start(() => shellFixture(states, calls));
  return { controller, states, opened, calls };
}
function shellFixture(states: boolean[], calls: { closed: number }) {
  return {
    update: (state: boolean) => {
      states.push(state);
    },
    stop: () => {
      calls.closed++;
    },
  };
}
async function verifyController(app: RunningTracker, directory: string): Promise<void> {
  const fixture = await controllerFixture(app, directory);
  const actions = fixture.controller.actions();
  actions.toggle();
  assert.equal(app.runtime.paused, true);
  fixture.controller.refresh();
  actions.toggle();
  actions.directory();
  assert.deepEqual(fixture.states, [true, false]);
  assert.deepEqual(fixture.opened, [directory]);
  await Promise.all([fixture.controller.stop(), fixture.controller.stop()]);
  assert.deepEqual(fixture.calls, { closed: 1, released: 1 });
}
void test('tray actions persist pause and release resources once', () =>
  withTracker(verifyController));
async function verifyRestart(app: RunningTracker, directory: string): Promise<void> {
  const input = sample(0, { timestamp: Date.now() });
  app.runtime.accept(input);
  assert.ok(app.runtime.store.intervals(0, 10).length > 0);
  app.runtime.setPaused(true);
  await app.stop();
  const restarted = await startTracking({
    directory,
    assets: path.resolve('dist/assets'),
    port: 0,
    desktop: false,
  });
  try {
    assert.deepEqual(restarted.keys, app.keys);
    assert.equal(restarted.runtime.paused, true);
    assert.ok(restarted.runtime.store.intervals(0, 10).every((entry) => entry.closed));
  } finally {
    await restarted.stop();
  }
}
void test('clean stop and restart preserve credentials, pause and finalized intervals', () =>
  withTracker(verifyRestart));

async function verifyStop(app: RunningTracker, directory: string): Promise<void> {
  const timestamp = Date.now() - 2000;
  app.runtime.accept(sample(0, { timestamp }));
  app.runtime.accept(sample(0, { timestamp: timestamp + 1000 }));
  await app.stop();
  const store = new SqliteStore(path.join(directory, 'activity.sqlite'));
  try {
    const rows = store.intervals(0, 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.closed, true);
    assert.equal(rows[0].end_at, timestamp + 1000);
  } finally {
    store.db.close();
  }
}
void test('shutdown closes active intervals at their last observation without adding downtime', () =>
  withTracker(verifyStop));

async function verifyWebsite(app: RunningTracker, directory: string): Promise<void> {
  const fixture = await controllerFixture(app, directory);
  fixture.controller.actions().website();
  assert.deepEqual(fixture.opened, ['http://127.0.0.1:3535/']);
  await fixture.controller.stop();
}
void test('tray website action opens the configured client separately from tracker settings', () =>
  withTracker(verifyWebsite));
