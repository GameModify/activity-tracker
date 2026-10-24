import { TestTransport } from './content-transport-fixture.ts';
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
void test('a disconnected worker retires listeners and reinjection restores the collector', async () => {
  const { page, attach } = await interactionHarness();
  page.transport.disconnect();
  assert.equal(page.heartbeat, undefined);
  assert.equal(page.transport.disconnectListeners.size, 0);
  attach();
  assert.equal(page.transport.connections, 2);
  assert.notEqual(page.heartbeat, undefined);
  page.event('wheel');
  assert.equal(page.messages.length, 3);
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

void test('a removed chrome.runtime API retires interaction listeners without an uncaught sendMessage access', async () => {
  const { page } = await interactionHarness();
  page.transport.missing = true;
  assert.doesNotThrow(() => {
    page.event('wheel');
  });
  assert.equal(page.heartbeat, undefined);
  assert.equal(page.messages.length, 1);
});
void test('a removed chrome.runtime API retires video events and heartbeat safely', async () => {
  const { callbacks, transport } = await contentHarness();
  transport.missing = true;
  assert.doesNotThrow(() => callbacks.get('playing')?.());
  assert.equal(callbacks.size, 0);
  assert.equal(transport.messages.length, 1);
});

void test('a disconnected media channel removes every callback and can be restored once', async () => {
  const { callbacks, transport, rerun } = await contentHarness();
  transport.disconnect();
  assert.equal(callbacks.size, 0);
  assert.equal(transport.disconnectListeners.size, 0);
  rerun();
  rerun();
  assert.equal(transport.connections, 2);
  assert.equal(transport.messages.length, 2);
});
void test('collectors attach their build identity independently of the background manifest', async () => {
  const { page } = await interactionHarness();
  const { messages } = await contentHarness();
  assert.equal(page.messages[0]?.content_version, 'development');
  assert.equal(messages[0]?.content_version, 'development');
});

void test('old and new isolated contexts retire separately without stopping the replacement timer', async () => {
  const { page, newContext } = await interactionHarness();
  const old = page.transport;
  old.invalidated = true;
  page.transport = new TestTransport();
  newContext();
  assert.equal(page.timerCallbacks.size, 2);
  assert.doesNotThrow(() => {
    page.event('wheel');
  });
  assert.equal(page.timerCallbacks.size, 1);
  assert.equal(old.messages.length, 1);
  assert.equal(page.messages.length, 2);
  page.time += 5000;
  page.heartbeat?.();
  assert.equal(page.messages.length, 3);
});
