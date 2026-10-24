import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interactionHarness } from './interaction-content-fixture.ts';
void test('interaction collector records only timestamps of trusted actions in its focused page', async () => {
  const { page } = await interactionHarness();
  assert.equal(page.messages[0]?.interaction_at, 0);
  page.event('wheel', false);
  assert.equal(page.messages.length, 1);
  page.event('wheel');
  assert.equal(page.messages.at(-1)?.interaction_at, page.time);
  page.time += 5000;
  page.focused = false;
  page.event('keydown');
  page.heartbeat?.();
  assert.equal(page.messages.at(-1)?.interaction_at, page.time - 5000);
  assert.equal(page.messages.at(-1)?.focused, false);
});
void test('changing chat resets interaction; reinjection cannot duplicate listeners or reports', async () => {
  const { page, attach } = await interactionHarness();
  page.event('wheel');
  page.url.href = 'https://vk.com/im?sel=456';
  page.heartbeat?.();
  assert.equal(page.messages.at(-1)?.interaction_at, 0);
  const before = page.messages.length;
  attach();
  assert.equal(page.messages.length, before);
  assert.deepEqual(Object.keys(page.messages[0] ?? {}).sort(), [
    'focused',
    'interaction_at',
    'type',
    'url',
  ]);
});
