import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { desktopDirectories } from '../src/data-directories.ts';
import { prepareDesktopData } from '../src/adapters/sqlite/desktop-migration.ts';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
const originalKeys = { read: 'a'.repeat(64), ingest: 'b'.repeat(64) };
const otherKeys = { read: 'c'.repeat(64), ingest: 'd'.repeat(64) };
function legacy(directory: string, keys = originalKeys): string {
  mkdirSync(directory, { recursive: true });
  const store = new SqliteStore(path.join(directory, 'activity.sqlite'));
  try {
    store.seedRules();
    store.setPaused(true);
  } finally {
    store.db.close();
  }
  writeFileSync(path.join(directory, 'credentials.json'), JSON.stringify(keys));
  return directory;
}
async function fixture(action: (root: string) => Promise<void>): Promise<void> {
  const root = mkdtempSync(path.join(tmpdir(), 'tracker-directory-'));
  try {
    await action(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
void test('desktop data stays in the user profile when the launching host redirects AppData', () => {
  const profile = path.resolve('example-profile');
  const packaged = desktopDirectories(profile, path.resolve('host-private/AppData/Local'));
  const ordinary = desktopDirectories(profile, path.resolve('normal/AppData/Local'));
  assert.equal(packaged.directory, ordinary.directory);
  assert.equal(packaged.directory, path.join(profile, '.activity-tracker'));
  assert.notEqual(packaged.legacyDirectory, ordinary.legacyDirectory);
});
async function verifyMigration(root: string): Promise<void> {
  const source = legacy(path.join(root, 'physical-shadow'));
  const logical = legacy(path.join(root, 'logical-merged-view'), otherKeys);
  const destination = path.join(root, 'shared');
  await prepareDesktopData(destination, logical, () => source);
  assert.equal(
    readFileSync(path.join(destination, 'credentials.json'), 'utf8'),
    JSON.stringify(originalKeys),
  );
  const original = new SqliteStore(path.join(source, 'activity.sqlite'));
  const migrated = new SqliteStore(path.join(destination, 'activity.sqlite'));
  try {
    assert.equal(migrated.deviceId(), original.deviceId());
    assert.equal(migrated.paused(), true);
  } finally {
    original.db.close();
    migrated.db.close();
  }
}
void test('migration snapshots one physical directory, preserving identity, credentials and preferences', () =>
  fixture(verifyMigration));
async function verifySecondHost(root: string): Promise<void> {
  const first = legacy(path.join(root, 'host-a'));
  const second = legacy(path.join(root, 'host-b'), otherKeys);
  const destination = path.join(root, 'shared');
  await prepareDesktopData(destination, first, (directory) => directory);
  const before = readFileSync(path.join(destination, 'activity.sqlite'));
  await prepareDesktopData(destination, second, (directory) => directory);
  assert.equal(
    readFileSync(path.join(destination, 'credentials.json'), 'utf8'),
    JSON.stringify(originalKeys),
  );
  assert.deepEqual(readFileSync(path.join(destination, 'activity.sqlite')), before);
  assert.equal(
    readFileSync(path.join(second, 'credentials.json'), 'utf8'),
    JSON.stringify(otherKeys),
  );
}
void test('starting from another host cannot replace the shared database or its keys', () =>
  fixture(verifySecondHost));
