import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, mkdir, writeFile, readFile, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { SqliteStore } from '../../src/adapters/sqlite/store.ts';
const executable = path.resolve('dist/windows/ActivityTracker/ActivityTracker.exe');
const base = 'http://127.0.0.1:3548',
  originalKeys = { read: 'a'.repeat(64), ingest: 'b'.repeat(64) };
async function seed(root: string, keys = originalKeys): Promise<string> {
  const directory = path.join(root, 'ActivityTracker');
  await mkdir(directory, { recursive: true });
  const store = new SqliteStore(path.join(directory, 'activity.sqlite'));
  try {
    store.seedRules();
    return store.deviceId();
  } finally {
    store.db.close();
    await writeFile(path.join(directory, 'credentials.json'), JSON.stringify(keys));
  }
}
async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + '/health', { signal: AbortSignal.timeout(500) })).ok) return;
    } catch {
      /* The isolated packaged process has not bound its port yet. */
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error('Default-path tracker did not start');
}
async function run(profile: string, localData: string, device: string): Promise<void> {
  const env = environment(profile, localData);
  const child = spawn(executable, ['--headless'], { env, windowsHide: true, stdio: 'ignore' });
  const exited = once(child, 'exit');
  try {
    await ready();
    const response = await fetch(base + '/v1/status', {
      headers: { Authorization: 'Bearer ' + originalKeys.read },
    });
    assert.equal(response.status, 200, 'Restart must accept the original management key');
    assert.equal(
      z.object({ device_id: z.string() }).parse(await response.json()).device_id,
      device,
    );
  } finally {
    child.kill();
    await exited;
  }
}
function environment(profile: string, localData: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    USERPROFILE: profile,
    HOME: profile,
    LOCALAPPDATA: localData,
    TRACKER_DATA_DIR: undefined,
    TRACKER_PORT: '3548',
    TRACKER_DESKTOP: 'off',
    TRACKER_NO_BROWSER: '1',
  };
}
async function verify(root: string): Promise<void> {
  const profile = path.join(root, 'profile'),
    first = path.join(root, 'host-a'),
    second = path.join(root, 'host-b');
  await mkdir(profile, { recursive: true });
  const device = await seed(first);
  await seed(second, { read: 'c'.repeat(64), ingest: 'd'.repeat(64) });
  await run(profile, first, device);
  await run(profile, second, device);
  const data = path.join(profile, '.activity-tracker');
  assert.equal(
    await readFile(path.join(data, 'credentials.json'), 'utf8'),
    JSON.stringify(originalKeys),
  );
  assert.equal(
    (await readdir(path.join(data, 'legacy-backups'))).filter((name) => name.endsWith('.sqlite'))
      .length,
    2,
  );
}
if (process.platform !== 'win32') throw new Error('Default-path executable test requires Windows');
const root = await mkdtemp(path.join(tmpdir(), 'tracker-default-data-'));
try {
  await verify(root);
  console.log('Packaged default data: host change preserves keys and device identity');
} finally {
  await rm(root, { recursive: true, force: true });
}
