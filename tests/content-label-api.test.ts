import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApi, keys } from './http-fixture.ts';
import type { ApiFixture } from './http-fixture.ts';
import { identity, labels } from './content-label-fixture.ts';
async function publish(api: ApiFixture, key: string): Promise<Response> {
  return fetch(api.base + '/v1/content-labels', {
    method: 'PUT',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify(labels),
  });
}
async function choose(api: ApiFixture, label_id: string): Promise<Response> {
  return fetch(api.base + '/v1/video-labels', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + keys.ingest, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, target: 'channel', label_id }),
  });
}
void test('only the control key can publish categories; ingest can choose only a known category', () =>
  withApi(async (api) => {
    assert.equal((await publish(api, keys.ingest)).status, 401);
    assert.equal((await publish(api, keys.read)).status, 200);
    assert.equal((await choose(api, 'deleted')).status, 400);
    assert.equal(api.store.rules().length, 0);
    assert.equal((await choose(api, 'work')).status, 200);
    assert.equal(api.store.rules()[0]?.activity, 'tng:work');
  }));
void test('browser category queries require an ingest key and a valid YouTube identity', () =>
  withApi(async (api) => {
    await publish(api, keys.read);
    const route = api.base + '/v1/video-labels?video_id=' + identity.video_id;
    assert.equal((await fetch(route)).status, 401);
    const response = await fetch(route, { headers: { Authorization: 'Bearer ' + keys.ingest } });
    assert.equal(response.status, 200);
    const invalid = await fetch(api.base + '/v1/video-labels?video_id=bad', {
      headers: { Authorization: 'Bearer ' + keys.ingest },
    });
    assert.equal(invalid.status, 400);
  }));

void test('a stale conditional rules update cannot overwrite a newer channel selection', () =>
  withApi(async (api) => {
    await publish(api, keys.read);
    await choose(api, 'work');
    const headers = { Authorization: 'Bearer ' + keys.read };
    const snapshot = await fetch(api.base + '/v1/rules', { headers });
    const tag = snapshot.headers.get('etag');
    assert.ok(tag);
    const body = await snapshot.text();
    await choose(api, 'watch');
    const response = await fetch(api.base + '/v1/rules', {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json', 'If-Match': tag },
      body,
    });
    assert.equal(response.status, 409);
    assert.equal(api.store.rules()[0]?.activity, 'tng:watch');
  }));
