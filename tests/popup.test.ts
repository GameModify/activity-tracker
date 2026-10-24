import { withFrameStorage, exampleTab } from './storage-fixture.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshFrames, playback } from '../extension/diagnostic-model.ts';
import { nextFrame } from '../extension/frame-state.ts';
import { deliveryText, elapsed, probeText } from '../extension/popup-model.ts';
import { sitePattern } from '../extension/sites.ts';
import { frames, recordFrame, removeTab } from '../extension/diagnostics.ts';
import { frame, popup, timestamp } from './popup-fixture.ts';
void test('changing media paths use one origin while iframe domains need separate permission', () => {
  assert.equal(
    sitePattern('https://catalog.example/series/1?token=secret'),
    'https://catalog.example/*',
  );
  assert.equal(sitePattern('https://catalog.example/series/2'), 'https://catalog.example/*');
  assert.equal(sitePattern('https://player.example/embed/3'), 'https://player.example/*');
  assert.equal(sitePattern('chrome://extensions'), null);
});
void test('popup expires missing players and deduplicates concurrently playing frames by tab', () => {
  const items = [frame(), frame({ frame_id: 2 }), frame({ tab_id: 2, playing: false })];
  assert.equal(playback(items, timestamp).length, 1);
  assert.equal(playback(items, timestamp + 15000).length, 0);
  assert.equal(freshFrames(items, timestamp - 1).length, 0);
});
void test('media timer persists through heartbeats and restarts after pause or navigation', () => {
  const previous = frame(),
    input = frame({ observed_at: timestamp + 5000 });
  assert.equal(nextFrame(input, previous, timestamp + 5000).started_at, timestamp - 5000);
  assert.equal(
    nextFrame(input, frame({ playing: false }), timestamp + 5000).started_at,
    timestamp + 5000,
  );
  assert.equal(
    nextFrame({ ...input, title: 'New episode' }, previous, timestamp + 5000).started_at,
    timestamp + 5000,
  );
  assert.equal(nextFrame(input, previous, timestamp + 15000).started_at, timestamp + 15000);
  assert.equal(elapsed(previous, timestamp + 62000), '1:07');
});
void test('popup distinguishes delivery, disabled collection, pause, errors and stale acknowledgements', () => {
  assert.match(deliveryText(popup(), timestamp), /доставляются/);
  assert.match(
    deliveryText(popup({ config: { ...popup().config, enabled: false } }), timestamp),
    /выключен/,
  );
  assert.match(
    deliveryText(popup({ delivery: { ...popup().delivery, server_paused: true } }), timestamp),
    /приостановлен/,
  );
  assert.equal(
    deliveryText(
      popup({ delivery: { ...popup().delivery, connection_error: 'HTTP 401' } }),
      timestamp,
    ),
    'HTTP 401',
  );
  assert.match(deliveryText(popup(), timestamp + 31000), /Ожидаем/);
});
async function verifyFrames(): Promise<void> {
  const stopped = {
    type: 'media' as const,
    playing: false,
    media_count: 0,
    frames: ['https://player.example/*'],
  };
  assert.equal(await recordFrame(stopped, { frameId: 0 }, exampleTab), false);
  assert.equal(
    await recordFrame({ ...stopped, playing: true, media_count: 1 }, { frameId: 2 }, exampleTab),
    true,
  );
  assert.equal(await recordFrame(stopped, { frameId: 0 }, exampleTab), true);
  assert.equal((await frames()).length, 2);
  assert.equal(await recordFrame(stopped, { frameId: 2 }, exampleTab), false);
  await removeTab(1);
  assert.equal((await frames()).length, 0);
}
void test('a non-playing parent cannot stop its embedded video and closing the tab clears diagnostics', () =>
  withFrameStorage(verifyFrames));

void test('popup distinguishes missing registration, registration errors and an unresponsive embedded player', () => {
  const collector = { collector_ready: false, collector_error: '', registered_sites: [] };
  assert.match(probeText(popup({ collector })), /не запущен/);
  assert.match(
    probeText(popup({ collector: { ...collector, collector_error: 'Script denied' } })),
    /Script denied/,
  );
  assert.match(
    probeText(popup({ current: [frame({ media_count: 0, playing: false })] })),
    /встроенный плеер/,
  );
  assert.equal(probeText(popup({ current: [frame()] })), 'Плеер обнаружен');
});
