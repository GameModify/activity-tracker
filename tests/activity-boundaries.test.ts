import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, expire } from '../src/application/ingest.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { sample, start, withStore, rule } from './fixtures.ts';
import type { TrackingStore } from '../src/application/ports.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { eventWallTime } from '../src/adapters/windows/event-time.ts';
const gameSample = {
  app: 'game.exe',
  resource_kind: 'game',
  resource_id: 'steam-folder:test',
} as const;
function site(offset: number, patch: Partial<Observation> = {}): Observation {
  return sample(offset, {
    source: 'chrome',
    channel: 'chrome:fixture:focus',
    app: 'chrome.exe',
    url: 'https://vk.ru/im/convo/123',
    web_enabled: true,
    web_active: true,
    active: false,
    ...patch,
  });
}
void test('VK browsing works without a scientific rule and never classifies other chats as science', () => {
  withStore((store) => {
    ingest(store, site(0));
    ingest(store, site(1000, { active: false, web_active: false }));
    const rows = store.intervals(0, 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.activity, 'web');
    assert.equal(rows[0].website, 'vk.ru');
    assert.equal(rows[0].end_at - rows[0].start_at, 1000);
  });
});
void test('the exact scientific chat counts in science and website browsing concurrently', () => {
  withStore((store) => {
    store.replaceRules([
      rule({ field: 'url', operator: 'contains', value: '/im/convo/123', activity: 'science' }),
    ]);
    const active = { active: true, interaction_at: start };
    ingest(store, site(0, active));
    ingest(store, site(1000, { ...active, active: false, web_active: false }));
    const rows = store.intervals(0, 10);
    assert.deepEqual(rows.map((row) => row.activity).sort(), ['science', 'web']);
    assert.ok(rows.every((row) => row.end_at - row.start_at === 1000 && row.closed));
  });
});
void test('a late active observation cannot restart a site after its stop event', () => {
  withStore((store) => {
    ingest(store, site(0));
    ingest(store, site(1000, { web_active: false }));
    ingest(store, site(500));
    const rows = store.intervals(0, 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.closed, true);
    assert.equal(rows[0].end_at, start + 1000);
  });
});
void test('one-second browsing plus a one-hour visit totals exactly one hour and one second', () => {
  withStore((store) => {
    ingest(store, site(0));
    ingest(store, site(1000, { web_active: false }));
    ingest(store, site(10000));
    for (let at = 15000; at < 3610000; at += 5000) ingest(store, site(at));
    ingest(store, site(3610000, { web_active: false }));
    const rows = store.intervals(0, 10);
    assert.equal(rows.length, 2);
    assert.equal(
      rows.reduce((sum, row) => sum + row.end_at - row.start_at, 0),
      3601000,
    );
  });
});
void test('background Codex dictation is recorded even while another app has focus', () => {
  withStore((store) => {
    const runtime = backgroundDictation(store);
    assert.equal(runtime.dictation?.active, true);
    runtime.observeDesktop(sample(6000, { app: 'Explorer.exe' }));
    const rows = store.intervals(0, 10).filter((row) => row.channel === 'windows:dictation');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.activity, 'projects');
    assert.equal(rows[0].end_at - rows[0].start_at, 6000);
    assert.equal(rows[0].closed, true);
  });
});
void test('game focus loss closes the interval at the event time without billing its grace period', () => {
  withStore((store) => {
    const runtime = new TrackingRuntime(store);
    runtime.observeDesktop(sample(0, gameSample));
    runtime.observeDesktop(sample(1000));
    runtime.observeDesktop(sample(10000, gameSample));
    runtime.observeDesktop(sample(11000));
    const rows = store.intervals(0, 10).filter((row) => row.resource_kind === 'game');
    assert.equal(rows.length, 2);
    assert.equal(
      rows.reduce((sum, row) => sum + row.end_at - row.start_at, 0),
      2000,
    );
    assert.equal(runtime.status().game?.active, false);
  });
});
void test('losing the collector signal closes at the last evidence rather than the timeout', () => {
  withStore((store) => {
    ingest(store, site(0));
    ingest(store, site(5000));
    expire(store, start + 25000);
    assert.equal(store.intervals(0, 10)[0]?.end_at, start + 5000);
  });
});
void test('Win32 event timestamps preserve delivery latency and tick-counter wrap', () => {
  assert.equal(eventWallTime(1000, 1250, 10000), 9750);
  assert.equal(eventWallTime(0xfffffffe, 3, 10000), 9995);
});
void test(
  'the Windows foreground hook can be installed and released without changing user focus',
  { skip: process.platform !== 'win32' },
  async () => {
    const { watchForeground } = await import('../src/adapters/windows/foreground-events.ts');
    const stop = watchForeground(() => undefined);
    stop();
  },
);

function backgroundDictation(store: TrackingStore): TrackingRuntime {
  const runtime = new TrackingRuntime(store);
  runtime.observeDesktop(sample(0, { recording_app: 'ChatGPT.exe', app: 'chrome.exe' }));
  runtime.observeDesktop(sample(5000, { recording_app: 'ChatGPT.exe', app: 'Explorer.exe' }));
  return runtime;
}
