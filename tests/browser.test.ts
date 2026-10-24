import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeUrl } from '../extension/model.ts';
import { MediaFrames } from '../extension/media.ts';
import { windowsCollector } from '../src/adapters/windows/collector.ts';
void test('URL observation strips credentials, fragments and unrelated query parameters', () => {
  assert.equal(
    safeUrl('https://user:pass@example.org/watch?token=secret#private'),
    'https://example.org/watch',
  );
  assert.equal(safeUrl('https://vk.com/im?sel=123&token=secret'), 'https://vk.com/im?sel=123');
  assert.equal(safeUrl('chrome://settings'), '');
});
void test('pausing one frame does not stop another playing frame', () => {
  const media = new MediaFrames();
  assert.equal(media.update(1, 0, true), true);
  assert.equal(media.update(1, 2, true), true);
  assert.equal(media.update(1, 0, false), true);
  assert.equal(media.update(1, 2, false), false);
});
void test(
  'native desktop collector works in the current Windows session',
  { skip: process.platform !== 'win32' },
  async () => {
    const collector = await windowsCollector(),
      observation = collector?.sample();
    assert.ok(collector);
    assert.ok(observation);
    assert.ok(Number.isInteger(observation.idle_ms));
    assert.equal(observation.source, 'windows');
  },
);

void test('a removed frame without a pause event cannot keep video running forever', () => {
  const media = new MediaFrames();
  assert.equal(media.update(1, 2, true, 0), true);
  assert.equal(media.update(1, 0, false, 16000), false);
});
