import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { engaged } from '../src/domain/engagement.ts';
import { trackingPreferencesSchema } from '../src/domain/contracts.ts';
import { idleMinutes } from '../extension/idle-timeout.ts';
import { sample, rule, start, withStore } from './fixtures.ts';
import { withApi, keys } from './http-fixture.ts';
import type { ApiFixture } from './http-fixture.ts';
function verifyTimeout(minutes: number): void {
  withStore((store) => {
    store.setPreferences({ idle_timeout_ms: minutes * 60000 });
    store.replaceRules([rule()]);
    const runtime = new TrackingRuntime(store);
    for (let offset = 0; offset <= minutes * 60000 + 5000; offset += 5000)
      runtime.accept(sample(offset, { interaction_at: start, idle_ms: offset }));
    const [interval] = store.intervals(0, 10);
    assert.equal(interval?.end_at, start + minutes * 60000);
    assert.equal(interval.closed, true);
    assert.equal(runtime.status().idle_timeout_ms, minutes * 60000);
  });
}
void test('configured inactivity closes at the exact threshold for chats and applications', () => {
  for (const minutes of [1, 2, 3, 5, 30]) verifyTimeout(minutes);
});
void test('tracking preferences persist after reopening SQLite without altering history', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tracker-idle-'));
  const file = path.join(directory, 'test.sqlite');
  try {
    const first = new SqliteStore(file);
    assert.equal(first.preferences().idle_timeout_ms, 300000);
    first.setPreferences({ idle_timeout_ms: 120000 });
    first.db.close();
    const second = new SqliteStore(file);
    assert.equal(second.preferences().idle_timeout_ms, 120000);
    assert.equal(second.intervals(0, 10).length, 0);
    second.db.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
async function request(api: ApiFixture, timeout: number, key: string): Promise<Response> {
  return fetch(api.base + '/v1/preferences', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ idle_timeout_ms: timeout }),
  });
}
async function verifyApi(api: ApiFixture): Promise<void> {
  assert.equal((await request(api, 60000, keys.ingest)).status, 401);
  for (const timeout of [0, 90000, 1860000])
    assert.equal((await request(api, timeout, keys.read)).status, 400);
  const saved = await request(api, 60000, keys.read);
  assert.equal(saved.status, 200);
  assert.equal(trackingPreferencesSchema.parse(await saved.json()).idle_timeout_ms, 60000);
  assert.equal(api.runtime.status().idle_timeout_ms, 60000);
}
void test('only control credentials can save a validated whole-minute inactivity threshold', () =>
  withApi(verifyApi));
void test('inactivity labels use Russian forms and recording bypasses inactivity', () => {
  assert.deepEqual(
    [1, 2, 5, 21].map((n) => idleMinutes(n * 60000)),
    ['1 минута', '2 минуты', '5 минут', '21 минута'],
  );
  assert.equal(engaged(sample(90000, { interaction_at: start, idle_timeout_ms: 60000 })), false);
  assert.equal(
    engaged(sample(90000, { recording: true, interaction_at: start, idle_timeout_ms: 60000 })),
    true,
  );
});
void test('playing media continues beyond the focus inactivity threshold', () => {
  withStore((store) => {
    store.setPreferences({ idle_timeout_ms: 60000 });
    const runtime = new TrackingRuntime(store);
    for (let offset = 0; offset <= 90000; offset += 5000)
      runtime.accept(sample(offset, { kind: 'media', playing: true, idle_ms: offset }));
    assert.equal(store.intervals(0, 10)[0]?.end_at, start + 90000);
    assert.equal(store.intervals(0, 10)[0]?.closed, false);
  });
});
