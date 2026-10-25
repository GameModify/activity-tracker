import { z } from 'zod';
import { desktopLogging } from './adapters/desktop-logging.ts';
import path from 'node:path';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { registerSignals, startTracking } from './bootstrap.ts';
import type { RunningTracker } from './bootstrap.ts';
import type { ApplicationConfiguration } from './configuration.ts';
import { applicationConfiguration } from './configuration.ts';
import { DesktopController } from './desktop-controller.ts';
import { credentials } from './adapters/http/security.ts';
async function existing(port: number): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:' + String(port) + '/health', {
      signal: AbortSignal.timeout(750),
    });
    return (
      response.ok &&
      z.object({ ok: z.literal(true), api_version: z.literal(1) }).safeParse(await response.json())
        .success
    );
  } catch {
    return false;
  }
}
async function desktop(): Promise<void> {
  if (process.platform !== 'win32') throw new Error('Приложение в трее поддерживает Windows');
  const config = applicationConfiguration();
  desktopLogging(config.directory);
  const native = await import('./adapters/windows/tray-native.ts');
  if (process.argv.includes('--quit')) {
    await quitExisting(config.port, native.requestTrayExit);
    return;
  }
  if (await existing(config.port)) {
    openExisting(config.directory, config.port, native.openShellTarget);
    return;
  }
  await launch(config, native.openShellTarget);
}
async function launch(
  config: ApplicationConfiguration,
  open: (target: string) => void,
): Promise<void> {
  const { desktopInstance } = await import('./adapters/windows/instance.ts');
  const release = desktopInstance(config.port);
  if (!release) return;
  try {
    const app = await startTracking(config);
    await attachTray(app, config, release, open);
  } catch (error) {
    release();
    throw error;
  }
}
function openExisting(directory: string, port: number, open: (target: string) => void): void {
  const file = path.join(directory, 'credentials.json');
  const key = existsSync(file) ? credentials(file).read : '';
  if (process.env.TRACKER_NO_BROWSER !== '1') open(controlUrl(port, key));
}
function controlUrl(port: number, key: string): string {
  return 'http://127.0.0.1:' + String(port) + '/control/#key=' + key;
}
async function attachTray(
  app: RunningTracker,
  config: ApplicationConfiguration,
  release: () => void,
  open: (target: string) => void,
): Promise<void> {
  const { createWorkerShell } = await import('./adapters/windows/worker-shell.ts');
  const controller = controllerFor(app, config, release, open);
  try {
    if (process.argv.includes('--headless')) registerSignals(app);
    else await controller.start(createWorkerShell);
  } catch (error) {
    await controller.stop();
    throw error;
  }
}
function controllerFor(
  app: RunningTracker,
  config: ApplicationConfiguration,
  release: () => void,
  open: (target: string) => void,
): DesktopController {
  return new DesktopController(app, {
    assets: config.assets,
    directory: config.directory,
    website: config.website ?? 'http://127.0.0.1:3535/',
    release,
    open,
  });
}
function failure(error: unknown): void {
  const directory = applicationConfiguration().directory;
  mkdirSync(directory, { recursive: true });
  appendFileSync(
    path.join(directory, 'service.log'),
    new Date().toISOString() +
      ' ' +
      (error instanceof Error ? error.message : 'Ошибка запуска') +
      '\n',
  );
  console.error(error);
  process.exitCode = 1;
}
void desktop().catch(failure);

async function quitExisting(port: number, request: (port: number) => boolean): Promise<void> {
  if (!request(port)) {
    if (await existing(port)) throw new Error('Запущен трекер без трея. Останови его в терминале.');
    return;
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    if (!(await existing(port))) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });
  }
  throw new Error('Трекер не завершился за 5 секунд');
}
