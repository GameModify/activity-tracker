import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, existsSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'),
  directory = path.join(root, 'data');
mkdirSync(directory, { recursive: true });
async function running(): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:3536/health', {
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
if (await running()) console.log('Activity Tracker уже запущен');
else {
  const log = openSync(path.join(directory, 'service.log'), 'a');
  const installed = path.join(
    process.env.LOCALAPPDATA ?? directory,
    'Programs/ActivityTracker/ActivityTracker.exe',
  );
  const command =
    process.platform === 'win32' && existsSync(installed) ? installed : process.execPath;
  const child = spawn(command, command === installed ? [] : ['src/main.ts'], {
    cwd: root,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log],
  });
  child.once('error', () => {
    console.error('Не удалось запустить Activity Tracker');
    process.exitCode = 1;
  });
  child.unref();
  closeSync(log);
  console.log('Activity Tracker запускается. Подключение: http://127.0.0.1:3536');
}
