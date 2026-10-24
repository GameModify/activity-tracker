import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackMonitor } from '../src/application/playback.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { mediaTitle } from '../extension/media-title.ts';
import { mediaObservation } from '../extension/media-observation.ts';
import { recordFrame } from '../extension/diagnostics.ts';
import { withMediaBrowser } from './media-browser-fixture.ts';
import { exampleTab } from './storage-fixture.ts';
import { sample, start, withStore } from './fixtures.ts';
void test('paused media remains visible while fresh and stale signals disappear', () => {
  const monitor = new PlaybackMonitor();
  const media = {
    source: 'chrome',
    kind: 'media',
    playing: true,
    media_count: 1,
    position_seconds: 20,
  } as const;
  monitor.accept(sample(0, media));
  monitor.accept(sample(5000, { ...media, playing: false, position_seconds: 25 }));
  assert.equal(monitor.current(start + 6000)[0]?.playing, false);
  assert.equal(monitor.current(start + 6000)[0]?.position_seconds, 25);
  monitor.accept(sample(0, media));
  assert.equal(monitor.current(start + 6000)[0]?.playing, false);
  assert.deepEqual(monitor.current(start + 20000), []);
});
void test('media seeking and paused heartbeats do not add watched time or bridge a pause', () => {
  withStore((store) => {
    const runtime = new TrackingRuntime(store);
    const media = { source: 'chrome', kind: 'media', playing: true, media_count: 1 } as const;
    runtime.accept(sample(0, { ...media, position_seconds: 0 }));
    runtime.accept(sample(5000, { ...media, position_seconds: 3000 }));
    runtime.accept(sample(6000, { ...media, playing: false }));
    runtime.accept(sample(11000, { ...media, playing: false }));
    runtime.accept(sample(12000, media));
    runtime.accept(sample(15000, media));
    assert.equal(
      store.intervals(0, 20).reduce((sum, item) => sum + item.end_at - item.start_at, 0),
      9000,
    );
    runtime.setPaused(true);
    assert.deepEqual(runtime.status().playback, []);
  });
});
void test('media names preserve series titles and identify YouTube videos', () => {
  assert.equal(
    mediaTitle('Пример - YouTube', 'https://www.youtube.com/watch?v=test'),
    'YouTube: Пример',
  );
  assert.equal(
    mediaTitle('Название сериала (2004)', 'https://catalog.example/series/1'),
    'Название сериала (2004)',
  );
});
void test('embedded player position survives a parent page heartbeat with no media', async () => {
  await withMediaBrowser(async () => {
    await recordFrame(
      { type: 'media', playing: true, media_count: 1, frames: [], position_seconds: 65 },
      { frameId: 1 },
      exampleTab,
    );
    await recordFrame(
      { type: 'media', playing: false, media_count: 0, frames: [] },
      { frameId: 0 },
      exampleTab,
    );
    const result = await mediaObservation(exampleTab, true);
    assert.equal(result.position_seconds, 65);
    assert.equal(result.media_count, 1);
  });
});
