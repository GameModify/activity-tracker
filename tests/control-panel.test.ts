import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectionSchema } from '../src/domain/contracts.ts';
import { startTracking } from '../src/bootstrap.ts';
import type { RunningTracker } from '../src/bootstrap.ts';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
async function fixture(action: (app: RunningTracker) => Promise<void>): Promise<void> {
  const directory = mkdtempSync(path.join(tmpdir(), 'tracker-control-'));
  mkdirSync(path.join(directory, 'control'));
  copyFileSync('desktop-ui/index.html', path.join(directory, 'control/index.html'));
  const app = await startTracking({
    directory,
    assets: directory,
    port: 0,
    desktop: false,
  });
  try {
    await action(app);
  } finally {
    await app.stop();
    rmSync(directory, { recursive: true, force: true });
  }
}
async function connectionScope(app: RunningTracker): Promise<void> {
  const base = 'http://127.0.0.1:' + String(app.port);
  for (const [token, code] of [
    ['', 401],
    [app.keys.ingest, 401],
    [app.keys.read, 200],
  ] as const) {
    const response = await fetch(base + '/v1/connection', {
      headers: { Authorization: 'Bearer ' + token },
    });
    assert.equal(response.status, code);
    if (code === 200) {
      const info = connectionSchema.parse(await response.json());
      assert.equal(info.endpoint, base);
      assert.equal(info.read, app.keys.read);
      assert.equal(info.ingest, app.keys.ingest);
      assert.ok(path.isAbsolute(info.directory));
    }
  }
}
async function originScope(app: RunningTracker): Promise<void> {
  const base = 'http://127.0.0.1:' + String(app.port);
  const headers = { Authorization: 'Bearer ' + app.keys.read, 'Content-Type': 'application/json' };
  for (const [Origin, code] of [
    [base, 200],
    ['https://example.org', 403],
  ] as const) {
    const response = await fetch(base + '/v1/pause', {
      method: 'POST',
      headers: { ...headers, Origin },
      body: JSON.stringify({ paused: true }),
    });
    assert.equal(response.status, code);
  }
}
async function staticScope(app: RunningTracker): Promise<void> {
  const response = await fetch('http://127.0.0.1:' + String(app.port) + '/control/');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  const body = await response.text();
  assert.ok(body.includes('Activity Tracker'));
  assert.ok(!body.includes(app.keys.read));
  assert.ok(!body.includes(app.keys.ingest));
}
void test('control panel connection keys require the management scope', () =>
  fixture(connectionScope));
void test('control panel accepts authenticated same-origin updates and rejects other sites', () =>
  fixture(originScope));
void test('static control panel has a restrictive policy and contains no credentials', () =>
  fixture(staticScope));
