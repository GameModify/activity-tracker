import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest, expire } from '../src/application/ingest.ts';
import { matchingRule } from '../src/domain/classify.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { sample, rule, start, withStore } from './fixtures.ts';
void test('transition closes exact five-second interval and replay is idempotent', () => {
  withStore((store) => {
    store.replaceRules([rule()]);
    const first = sample();
    ingest(store, first);
    ingest(store, first);
    ingest(store, sample(5000, { app: 'Other.exe' }));
    const rows = store.intervals(0, 20),
      coding = rows.find((item) => item.activity === 'coding');
    assert.equal(rows.length, 2);
    assert.equal(coding?.end_at, start + 5000);
    assert.equal(coding.closed, true);
  });
});
void test('sleep and missing heartbeats never become tracked time', () => {
  withStore((store) => {
    ingest(store, sample());
    ingest(store, sample(5000));
    expire(store, start + 60000);
    ingest(store, sample(65000));
    const rows = store.intervals(0, 20);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((item) => item.closed)?.end_at, start + 5000);
  });
});
void test('idle detection removes the idle grace period', () => {
  withStore((store) => {
    for (let offset = 0; offset <= 85000; offset += 5000) ingest(store, sample(offset));
    ingest(store, sample(90000, { idle_ms: 90000 }));
    const item = store.intervals(0, 1)[0];
    assert.equal(item?.end_at, start);
    assert.equal(item.closed, true);
    assert.equal(store.channels().length, 0);
  });
});
void test('background media is tracked during idle and stops at pause', () => {
  withStore((store) => {
    const media = { kind: 'media', playing: true, idle_ms: 100000 } as const;
    ingest(store, sample(0, media));
    ingest(store, sample(5000, media));
    ingest(store, sample(10000, { ...media, playing: false }));
    const item = store.intervals(0, 1)[0];
    assert.equal(item?.end_at, start + 10000);
    assert.equal(item.closed, true);
  });
});
void test('pausing closes channels and does not bridge a short pause', () => {
  withStore((store) => {
    const runtime = new TrackingRuntime(store);
    runtime.accept(sample());
    runtime.accept(sample(5000));
    runtime.setPaused(true);
    runtime.accept(sample(7000));
    assert.equal(store.paused(), true);
    runtime.setPaused(false);
    runtime.accept(sample(10000));
    assert.equal(store.intervals(0, 10).length, 2);
  });
});
void test('specific rule priority wins without reading message content', () => {
  const generic = rule(),
    specific = rule({ field: 'host', value: 'example.org', activity: 'projects', priority: 100 });
  assert.equal(
    matchingRule(sample(0, { url: 'https://example.org/discussion' }), [generic, specific])?.id,
    specific.id,
  );
});
void test('out-of-order samples cannot extend an existing channel backwards', () => {
  withStore((store) => {
    ingest(store, sample(5000));
    ingest(store, sample(0));
    assert.equal(store.intervals(0, 20).length, 1);
    assert.equal(store.channels()[0]?.last_at, start + 5000);
  });
});
