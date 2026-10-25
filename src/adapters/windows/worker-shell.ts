import { z } from 'zod';
import { Worker } from 'node:worker_threads';
import { isSea } from 'node:sea';
import { once } from 'node:events';
import path from 'node:path';
import type { DesktopShell, ShellActions } from '../../application/desktop-shell.ts';
import { shellEventSchema } from './shell-messages.ts';
import type { ShellUpdate, WorkerConfiguration } from './shell-messages.ts';
import { requestTrayExit } from './tray-native.ts';
class WorkerShell implements DesktopShell {
  worker: Worker;
  port: number;
  initialized = false;
  stopping: Promise<void> | undefined;
  constructor(configuration: WorkerConfiguration, actions: ShellActions) {
    this.port = configuration.port;
    const file = isSea()
      ? path.join(path.dirname(process.execPath), 'tray-worker.cjs')
      : path.resolve(import.meta.dirname, '../../tray-worker.ts');
    this.worker = new Worker(file, { workerData: configuration });
    this.worker.on('message', (value: unknown) => {
      const message = shellEventSchema.parse(value);
      if (message.type === 'command') actions[message.command]();
    });
    this.observeFailure(actions);
  }
  observeFailure(actions: ShellActions): void {
    this.worker.on('error', (error) => {
      console.error('Tray:', error);
      if (this.initialized) actions.exit();
    });
    this.worker.on('exit', (code) => {
      if (this.initialized && !this.stopping) {
        console.error('Tray exited unexpectedly:', code);
        actions.exit();
      }
    });
  }
  async ready(): Promise<void> {
    const [message] = z.tuple([shellEventSchema]).parse(await once(this.worker, 'message'));
    if (message.type !== 'ready') throw new Error('Tray did not initialize');
    this.initialized = true;
  }
  update(paused: boolean): void {
    this.send({ type: 'state', paused });
  }
  send(message: ShellUpdate): void {
    this.worker.postMessage(message);
  }
  stop(): Promise<void> {
    this.stopping ??= this.shutdown();
    return this.stopping;
  }
  async shutdown(): Promise<void> {
    requestTrayExit(this.port);
    this.send({ type: 'stop' });
    if (this.worker.threadId === -1) return;
    try {
      await once(this.worker, 'exit', { signal: AbortSignal.timeout(5000) });
    } catch {
      await this.worker.terminate();
    }
  }
}
export async function createWorkerShell(
  assets: string,
  paused: boolean,
  actions: ShellActions,
  port: number,
): Promise<DesktopShell> {
  const shell = new WorkerShell({ assets, paused, port }, actions);
  try {
    await shell.ready();
    return shell;
  } catch (error) {
    await shell.stop();
    throw error;
  }
}
