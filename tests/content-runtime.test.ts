import { test } from 'node:test';
import assert from 'node:assert/strict';
import { interactionHarness } from './interaction-content-fixture.ts';
import { contentHarness } from './content-fixture.ts';
void test('invalidated interaction context stops its heartbeat and removes action listeners', async () => {
  const { page } = await interactionHarness(),
    heartbeat = page.heartbeat;
  page.transport.invalidated = true;
  assert.doesNotThrow(() => heartbeat?.());
  assert.equal(page.heartbeat, undefined);
  assert.equal(
    [...page.callbacks.values()].reduce((sum, items) => sum + items.size, 0),
    0,
  );
  assert.equal(page.messages.length, 1);
});
void test('synchronous send failure is contained and cannot leave an orphan interaction timer', async () => {
  const { page } = await interactionHarness();
  page.transport.synchronousFailure = true;
  assert.doesNotThrow(() => page.heartbeat?.());
  assert.equal(page.heartbeat, undefined);
  assert.equal(page.transport.attempts, 2);
});
void test('a temporary service-worker rejection can recover without reinjecting the page', async () => {
  const { page } = await interactionHarness();
  page.transport.rejected = true;
  page.heartbeat?.();
  await Promise.resolve();
  assert.notEqual(page.heartbeat, undefined);
  page.transport.rejected = false;
  page.heartbeat?.();
  assert.equal(page.messages.length, 2);
});
void test('a new interaction version replaces previous listeners instead of duplicating them', async () => {
  const { page, attach } = await interactionHarness();
  page.transport.version = 'next';
  attach();
  assert.equal(page.messages.length, 2);
  page.event('wheel');
  assert.equal(page.messages.length, 3);
  assert.equal(
    [...page.callbacks.values()].every((items) => items.size === 1),
    true,
  );
});
void test('invalidated media collectors remove timers and events without throwing into the page', async () => {
  const { callbacks, transport } = await contentHarness();
  const heartbeat = callbacks.get('heartbeat');
  transport.invalidated = true;
  assert.doesNotThrow(() => heartbeat?.());
  assert.equal(callbacks.size, 0);
  assert.equal(transport.messages.length, 1);
});
void test('media send failures and same-version reinjection do not leave an obsolete collector', async () => {
  const { callbacks, transport, rerun } = await contentHarness();
  transport.synchronousFailure = true;
  callbacks.get('heartbeat')?.();
  assert.equal(callbacks.size, 0);
  transport.synchronousFailure = false;
  rerun();
  assert.equal(transport.messages.length, 2);
  assert.notEqual(callbacks.get('heartbeat'), undefined);
});
