import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { TrackingRuntime } from '../src/application/runtime.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { sample, start, withStore } from './fixtures.ts';
function game(offset: number, pid = 123): Observation {
  return sample(offset, {
    app: 'game.exe',
    title: 'Game',
    process_id: pid,
    resource_kind: 'game',
    resource_id: 'steam-folder:game',
  });
}
void test('closing the process immediately ends the held game and later polls add no time', () => {
  withStore((store) => {
    const samples = [game(0), sample(5000), sample(10000), sample(15000)];
    const runtime = new TrackingRuntime(store, {
      sample: () => samples.shift(),
      processRunning: () => false,
    });
    while (samples.length) runtime.pollDesktop();
    const rows = store.intervals(0, 100).filter((item) => item.resource_kind === 'game');
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.end_at, start + 5000);
    assert.equal(rows[0].closed, true);
    assert.equal(runtime.status().game, null);
  });
});
void test('relaunching a closed game starts a fresh segment with the new process', () => {
  withStore((store) => {
    const samples = [game(0), sample(5000), game(20000, 456), game(25000, 456)];
    const runtime = new TrackingRuntime(store, {
      sample: () => samples.shift(),
      processRunning: (pid) => pid === 456,
    });
    while (samples.length) runtime.pollDesktop();
    const rows = store.intervals(0, 100).filter((item) => item.resource_kind === 'game');
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.end_at, start + 5000);
    assert.equal(rows[1]?.start_at, start + 20000);
    assert.equal(runtime.status().game?.process_id, 456);
    assert.equal(runtime.status().game?.active, true);
  });
});
void test('the same running process survives Alt+Tab but expires after two minutes', () => {
  withStore((store) => {
    const samples = [game(0), ...Array.from({ length: 25 }, (_, i) => sample((i + 1) * 5000))];
    const runtime = new TrackingRuntime(store, {
      sample: () => samples.shift(),
      processRunning: (pid) => pid === 123,
    });
    while (samples.length) runtime.pollDesktop();
    const row = store.intervals(0, 100).find((item) => item.resource_kind === 'game');
    assert.equal(row?.end_at, start + 120000);
    assert.equal(row.closed, true);
    assert.equal(runtime.status().game?.active, false);
  });
});
async function nativeLifecycle(): Promise<void> {
  const { isProcessRunning } = await import('../src/adapters/windows/native.ts');
  const child = spawn(process.execPath, ['-e', 'setTimeout(()=>{},10000)'], {
    windowsHide: true,
    stdio: 'ignore',
  });
  try {
    await once(child, 'spawn');
    const pid = child.pid;
    assert.ok(pid);
    assert.equal(isProcessRunning(pid), true);
    const exited = once(child, 'exit');
    child.kill();
    await exited;
    assert.equal(isProcessRunning(pid), false);
  } finally {
    child.kill();
  }
}
void test(
  'Win32 detects a real child process exiting',
  { skip: process.platform !== 'win32' },
  nativeLifecycle,
);
