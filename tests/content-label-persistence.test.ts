import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { labels } from './content-label-fixture.ts';
void test('the published category catalog and old activity aliases survive reopening SQLite', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'tracker-labels-')),
    file = path.join(directory, 'labels.sqlite');
  const first = new SqliteStore(':memory:');
  first.replaceLabels(labels);
  first.db.prepare('VACUUM INTO ?').run(file);
  first.db.close();
  const second = new SqliteStore(file);
  try {
    assert.deepEqual(second.labels(), labels);
  } finally {
    second.db.close();
    unlinkSync(file);
    rmdirSync(directory);
  }
});
