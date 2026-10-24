import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentHarness } from './content-fixture.ts';
void test('content script reports player discovery, playing, pause and heartbeat without leaking frame tokens', async () => {
  const harness = await contentHarness();
  const initial = harness.messages[0];
  assert.ok(initial);
  assert.equal(initial.playing, false);
  assert.equal(initial.frames[0], 'https://player.example/*');
  harness.media.paused = false;
  harness.callbacks.get('playing')?.();
  assert.equal(harness.messages.at(-1)?.playing, true);
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.at(-1)?.playing, true);
  harness.media.paused = true;
  harness.callbacks.get('pause')?.();
  assert.equal(harness.messages.at(-1)?.playing, false);
  assert.equal(harness.messages.at(-1)?.media_count, 1);
});
void test('reattaching the content script does not duplicate its initial report or heartbeat', async () => {
  const harness = await contentHarness();
  assert.equal(harness.messages.length, 1);
  harness.rerun();
  assert.equal(harness.messages.length, 1);
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.length, 2);
});

void test('content reports video position separately and omits unknown stream duration', async () => {
  const harness = await contentHarness();
  assert.equal(harness.messages[0]?.position_seconds, 65);
  assert.equal(harness.messages[0].duration_seconds, 120);
  harness.media.currentTime = 3000;
  harness.media.duration = Infinity;
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.at(-1)?.position_seconds, 3000);
  assert.equal(harness.messages.at(-1)?.duration_seconds, undefined);
});

void test('pages without media send one discovery state instead of continuous empty observations', async () => {
  const harness = await contentHarness(false);
  for (let index = 0; index < 10; index++) harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.length, 1);
  harness.media.present = true;
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.length, 2);
  assert.equal(harness.messages[1]?.media_count, 1);
});
void test('removing a player sends one terminal state and finding it again resumes discovery', async () => {
  const harness = await contentHarness();
  harness.media.present = false;
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.at(-1)?.media_count, 0);
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.length, 2);
  harness.media.present = true;
  harness.callbacks.get('heartbeat')?.();
  assert.equal(harness.messages.length, 3);
});
