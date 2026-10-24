import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { ingest } from '../src/application/ingest.ts';
import { sample } from './fixtures.ts';
function cleanup(directory: string): void {
  for (const suffix of ['', '-shm', '-wal']) {
    const file = path.join(directory, 'activity.sqlite' + suffix);
    if (existsSync(file)) unlinkSync(file);
  }
  rmdirSync(directory);
}
void test('device, intervals, sequence and pause survive database restart', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'activity-tracker-test-'));
  const file = path.join(directory, 'activity.sqlite');
  const first = new SqliteStore(file),
    device = first.deviceId();
  ingest(first, sample());
  ingest(first, sample(5000));
  first.setPaused(true);
  first.db.close();
  const second = new SqliteStore(file);
  try {
    assert.equal(second.deviceId(), device);
    assert.equal(second.paused(), true);
    assert.equal(second.intervals(0, 10)[0]?.sequence, 2);
    assert.equal(second.intervals(2, 10).length, 0);
  } finally {
    second.db.close();
    cleanup(directory);
  }
});

void test('confirmed dictation time survives database restart before an idle transition', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'activity-dictation-'));
  const file = path.join(directory, 'activity.sqlite'),
    first = new SqliteStore(file);
  ingest(first, sample(0, { app: 'ChatGPT.exe', recording: true, idle_ms: 400000 }));
  ingest(first, sample(5000, { app: 'ChatGPT.exe', recording: true, idle_ms: 405000 }));
  first.db.close();
  const second = new SqliteStore(file);
  try {
    ingest(second, sample(10000, { app: 'ChatGPT.exe', recording: false, idle_ms: 410000 }));
    assert.equal(second.intervals(0, 10)[0]?.end_at, 1005000);
  } finally {
    second.db.close();
    cleanup(directory);
  }
});
