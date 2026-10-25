import path from 'node:path';
import { registerSignals } from './bootstrap.ts';
import type { RunningTracker } from './bootstrap.ts';
import type { DesktopShell, ShellActions } from './application/desktop-shell.ts';
interface ShellConfiguration {
  assets: string;
  directory: string;
  website: string;
  release(): void;
  open(target: string): void;
}
type ShellFactory = (
  directory: string,
  paused: boolean,
  actions: ShellActions,
  port: number,
) => DesktopShell | Promise<DesktopShell>;
export class DesktopController {
  shell: DesktopShell | undefined;
  stopSignals: (() => void) | undefined;
  timer: ReturnType<typeof setInterval> | undefined;
  stopping: Promise<void> | undefined;
  previous: boolean;
  app: RunningTracker;
  config: ShellConfiguration;
  constructor(app: RunningTracker, config: ShellConfiguration) {
    this.app = app;
    this.config = config;
    this.previous = app.runtime.paused;
  }
  async start(factory: ShellFactory): Promise<void> {
    this.shell = await factory(this.config.assets, this.previous, this.actions(), this.app.port);
    this.timer = setInterval(this.refresh, 5000);
    this.stopSignals = registerSignals({ ...this.app, stop: this.stop });
  }
  refresh = (): void => {
    const paused = this.app.runtime.paused;
    if (this.previous === paused) return;
    this.previous = paused;
    this.shell?.update(paused);
  };
  actions(): ShellActions {
    return {
      toggle: () => {
        this.app.runtime.setPaused(!this.app.runtime.paused);
        this.refresh();
      },
      settings: this.settings,
      website: () => {
        this.config.open(this.config.website);
      },
      directory: () => {
        this.config.open(this.config.directory);
      },
      extension: () => {
        this.config.open(path.resolve(this.config.assets, '../chrome'));
      },
      exit: this.exit,
    };
  }
  exit = (): void => {
    void this.stop().then(
      () => process.exit(0),
      (error: unknown) => {
        console.error(error);
        process.exit(1);
      },
    );
  };
  settings = (): void => {
    if (process.env.TRACKER_NO_BROWSER === '1') return;
    this.config.open(
      'http://127.0.0.1:' + String(this.app.port) + '/control/#key=' + this.app.keys.read,
    );
  };
  stop = (): Promise<void> => {
    this.stopping ??= this.shutdown();
    return this.stopping;
  };
  async shutdown(): Promise<void> {
    clearInterval(this.timer);
    this.stopSignals?.();
    try {
      await this.shell?.stop();
    } finally {
      await this.stopApplication();
    }
  }
  async stopApplication(): Promise<void> {
    try {
      await this.app.stop();
    } finally {
      this.config.release();
    }
  }
}
