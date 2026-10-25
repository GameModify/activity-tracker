import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { once } from 'node:events';
import { DesktopProbe } from './adapters/windows/desktop-probe.ts';
import { discordCollector } from './adapters/windows/discord.ts';
import type { DesktopCollector } from './application/ports.ts';
import { windowsCollector } from './adapters/windows/collector.ts';
import { SqliteStore } from './adapters/sqlite/store.ts';
import { credentials } from './adapters/http/security.ts';
import type { Credentials } from './adapters/http/security.ts';
import { createHttpApp } from './adapters/http/routes.ts';
import { TrackingRuntime } from './application/runtime.ts';
import { closeAll } from './application/ingest.ts';
import type { ApplicationConfiguration } from './configuration.ts';
import type { Server } from 'node:http';
export interface RunningTracker {
  runtime: TrackingRuntime;
  keys: Credentials;
  port: number;
  stop(): Promise<void>;
}
interface Resources {
  store: SqliteStore;
  probe: DesktopProbe;
  runtime: TrackingRuntime;
  server: Server;
  stopDesktop?: () => void;
}
export async function startTracking(config: ApplicationConfiguration): Promise<RunningTracker> {
  mkdirSync(config.directory, { recursive: true });
  const store = new SqliteStore(path.join(config.directory, 'activity.sqlite'));
  const probe = new DesktopProbe();
  try {
    store.seedRules();
    const keys = credentials(path.join(config.directory, 'credentials.json'));
    return await startSources(config, store, keys, probe);
  } catch (error) {
    probe.stop();
    store.db.close();
    throw error;
  }
}
async function startSources(
  config: ApplicationConfiguration,
  store: SqliteStore,
  keys: Credentials,
  probe: DesktopProbe,
): Promise<RunningTracker> {
  if (config.desktop) probe.start();
  const collector = config.desktop ? await windowsCollector(probe) : undefined;
  const runtime = new TrackingRuntime(
    store,
    collector,
    config.desktop ? discordCollector(probe) : undefined,
  );
  const server = listen(config, runtime, keys);
  await once(server, 'listening');
  return bindResources({ store, probe, runtime, server }, collector, keys);
}
function listen(
  config: ApplicationConfiguration,
  runtime: TrackingRuntime,
  keys: Credentials,
): Server {
  return createHttpApp(runtime, keys, {
    assets: config.assets,
    directory: config.directory,
  }).listen(config.port, '127.0.0.1');
}
function bindResources(
  resources: Resources,
  collector: DesktopCollector | undefined,
  keys: Credentials,
): RunningTracker {
  try {
    const address = resources.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Не удалось определить порт сервиса');
    resources.stopDesktop = collector?.subscribe?.((sample) => {
      resources.runtime.observeDesktop(sample);
    });
    const stop = lifecycle(resources);
    return { runtime: resources.runtime, keys, port: address.port, stop };
  } catch (error) {
    resources.stopDesktop?.();
    resources.server.close();
    throw error;
  }
}

function lifecycle(resources: Resources): () => Promise<void> {
  resources.runtime.tick();
  const timer = setInterval(() => {
    resources.runtime.tick();
  }, 5000);
  let stopping: Promise<void> | undefined;
  return () => {
    stopping ??= stopResources(resources, timer);
    return stopping;
  };
}
async function stopResources(
  resources: Resources,
  timer: ReturnType<typeof setInterval>,
): Promise<void> {
  clearInterval(timer);
  resources.stopDesktop?.();
  resources.probe.stop();
  closeAll(resources.store);
  await new Promise<void>((resolve) => {
    resources.server.close(() => {
      resolve();
    });
  });
  resources.store.db.close();
}
export function registerSignals(app: RunningTracker): () => void {
  const stop = () => {
    void app.stop().then(() => process.exit(0));
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  return () => {
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  };
}
