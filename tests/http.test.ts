import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sample } from './fixtures.ts';
import { intervalPageSchema } from '../src/domain/contracts.ts';
import { keys, withApi } from './http-fixture.ts';
import type { ApiFixture } from './http-fixture.ts';
import type { Observation } from '../src/domain/contracts.ts';
const rejected = [
  { token: '', origin: '', status: 401 },
  { token: keys.ingest, origin: '', status: 401 },
  { token: keys.read, origin: 'https://example.org', status: 403 },
  { token: keys.read, origin: '', status: 200 },
];
async function verifyAuthorization({ base }: ApiFixture): Promise<void> {
  assert.equal((await fetch(base + '/health')).status, 200);
  for (const entry of rejected) {
    const headers = {
      Authorization: 'Bearer ' + entry.token,
      ...(entry.origin ? { Origin: entry.origin } : {}),
    };
    assert.equal((await fetch(base + '/v1/status', { headers })).status, entry.status);
  }
}
async function post(api: ApiFixture, samples: Observation[]): Promise<Response> {
  return fetch(api.base + '/v1/observations', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + keys.ingest, 'Content-Type': 'application/json' },
    body: JSON.stringify(samples),
  });
}
async function verifyBatch(api: ApiFixture): Promise<void> {
  const valid = sample(0, { timestamp: Date.now(), source: 'chrome', channel: 'chrome:test' });
  const invalid: Observation = { ...valid, event_id: crypto.randomUUID(), source: 'windows' };
  assert.equal((await post(api, [valid, invalid])).status, 400);
  assert.equal(api.store.intervals(0, 10).length, 0);
  assert.equal((await post(api, [valid])).status, 202);
  const response = await fetch(api.base + '/v1/intervals?cursor=0', {
    headers: { Authorization: 'Bearer ' + keys.read },
  });
  const page = intervalPageSchema.parse(await response.json());
  assert.equal(page.intervals.length, 1);
  assert.equal(page.cursor, 1);
}
void test('API requires scoped credentials and rejects foreign browser origins', () =>
  withApi(verifyAuthorization));
void test('browser batches are fully validated before acceptance and export a cursor', () =>
  withApi(verifyBatch));
async function verifyPausedReceipt(api: ApiFixture): Promise<void> {
  api.runtime.setPaused(true);
  const input = sample(0, { timestamp: Date.now(), source: 'chrome', channel: 'chrome:test' });
  const response = await post(api, [input]);
  assert.equal(response.status, 202);
  assert.deepEqual(await response.json(), { ok: true, paused: true });
  assert.equal(api.store.intervals(0, 10).length, 0);
}
void test('ingestion acknowledgements expose a paused collector without accepting intervals', () =>
  withApi(verifyPausedReceipt));
