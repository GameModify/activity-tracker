import { parentPort, workerData } from 'node:worker_threads';
import { createTray } from './adapters/windows/tray.ts';
import { shellConfigurationSchema, shellUpdateSchema } from './adapters/windows/shell-messages.ts';
import type { ShellEvent } from './adapters/windows/shell-messages.ts';
import type { ShellActions, ShellCommand } from './application/desktop-shell.ts';
if (!parentPort) throw new Error('Tray worker requires a parent');
function send(event: ShellEvent): void {
  parentPort?.postMessage(event);
}
function command(command: ShellCommand): () => void {
  return () => {
    send({ type: 'command', command });
  };
}
const actions: ShellActions = {
  toggle: command('toggle'),
  website: command('website'),
  settings: command('settings'),
  directory: command('directory'),
  extension: command('extension'),
  exit: command('exit'),
};
const configuration = shellConfigurationSchema.parse(workerData);
const tray = createTray(configuration.assets, configuration.paused, actions, configuration.port);
parentPort.on('message', (value: unknown) => {
  const message = shellUpdateSchema.parse(value);
  if (message.type === 'state') tray.update(message.paused);
  else {
    void Promise.resolve(tray.stop()).then(() => {
      parentPort?.close();
    });
  }
});
send({ type: 'ready' });
