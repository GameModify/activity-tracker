import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { execute } from './commands.ts';
const credentials = z.object({ read: z.string(), ingest: z.string() });
const port = 3547,
  base = 'http://127.0.0.1:' + String(port);
const executable = path.resolve('dist/windows/ActivityTracker/ActivityTracker.exe');
const tray = process.argv.includes('--tray');
async function ready(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await fetch(base + '/health', { signal: AbortSignal.timeout(500) })).ok) return;
    } catch {
      /* Wait for the isolated executable to bind its port. */
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error('Packaged tracker did not start');
}
async function verifyApi(directory: string): Promise<void> {
  const keys = credentials.parse(
    JSON.parse(await readFile(path.join(directory, 'credentials.json'), 'utf8')),
  );
  const response = await fetch(base + '/v1/pause', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + keys.read, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paused: true }),
  });
  assert.equal(response.status, 200);
  assert.equal(z.object({ paused: z.boolean() }).parse(await response.json()).paused, true);
  const panel = await fetch(base + '/control/');
  assert.equal(panel.status, 200);
  assert.match(await panel.text(), /Activity Tracker/);
}
async function smoke(directory: string): Promise<void> {
  const env = environment(directory);
  const child = spawn(executable, tray ? [] : ['--headless'], {
    env,
    windowsHide: true,
    stdio: 'ignore',
  });
  const exited = once(child, 'exit');
  try {
    await ready();
    await verifyApi(directory);
    await execute(executable, [], { env, timeout: 5000 });
    assert.equal(child.exitCode, null, 'Repeated launch must leave the original tracker alive');
    if (tray) await execute(executable, ['--quit'], { env, timeout: 10000 });
  } finally {
    await terminate(child, env);
    await exited;
  }
  if (tray) assert.equal(child.exitCode, 0);
}
async function terminate(child: ChildProcess, env: NodeJS.ProcessEnv): Promise<void> {
  if (child.exitCode !== null) return;
  if (tray) {
    try {
      await execute(executable, ['--quit'], { env, timeout: 10000 });
    } catch {
      child.kill();
    }
  } else child.kill();
}
if (process.platform !== 'win32') throw new Error('Windows smoke test requires Windows');
const directory = await mkdtemp(path.join(tmpdir(), 'tracker-package-'));
try {
  await smoke(directory);
  console.log('Packaged executable: launch, API, duplicate prevention and exit OK');
} finally {
  await rm(directory, { recursive: true, force: true });
}

function environment(directory: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    TRACKER_DATA_DIR: directory,
    TRACKER_PORT: String(port),
    TRACKER_NO_BROWSER: '1',
    TRACKER_DESKTOP: tray ? 'on' : 'off',
  };
}
