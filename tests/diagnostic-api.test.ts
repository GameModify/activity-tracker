import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withApi, keys } from './http-fixture.ts';
import type { ApiFixture } from './http-fixture.ts';
const diagnostic = {
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  severity: 'error',
  version: 'test',
  message: 'Example collector error',
  script: 'interaction-content.js',
  origin: 'https://example.org',
  line: 10,
  column: 2,
};
async function record(api: ApiFixture): Promise<void> {
  const response = await fetch(api.base + '/v1/diagnostics', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + keys.ingest, 'Content-Type': 'application/json' },
    body: JSON.stringify(diagnostic),
  });
  assert.equal(response.status, 200);
}
void test('diagnostics are stored but require the read key for retrieval', () =>
  withApi(async (api) => {
    await record(api);
    for (const token of ['', keys.ingest, keys.read]) {
      const response = await fetch(api.base + '/v1/diagnostics', {
        headers: { Authorization: 'Bearer ' + token },
      });
      assert.equal(response.status, token === keys.read ? 200 : 401);
      if (response.ok) assert.deepEqual(await response.json(), [diagnostic]);
    }
  }));
void test('the extension key can update only validated browser preferences, not arbitrary rules', () =>
  withApi(async (api) => {
    const headers = { Authorization: 'Bearer ' + keys.ingest, 'Content-Type': 'application/json' };
    const response = await fetch(api.base + '/v1/browser-preferences', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ science_chat_id: '12345' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { science_chat_id: '12345' });
    assert.equal((await fetch(api.base + '/v1/rules', { headers })).status, 401);
    const invalid = await fetch(api.base + '/v1/browser-preferences', {
      method: 'PUT',
      headers,
      body: JSON.stringify({ science_chat_id: 'not-an-id' }),
    });
    assert.equal(invalid.status, 400);
    assert.equal(api.store.rules().length, 4);
  }));
