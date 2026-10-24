import { contentBuild } from './content-build.ts';
import { contentChannel } from './content-channel-name.ts';
import { contentDiagnostic } from './content-report.ts';
import type { MediaMessage } from './diagnostic-model.ts';
import type { InteractionMessage } from './interaction-model.ts';
interface Listener {
  target: EventTarget;
  event: string;
  callback: EventListener;
}
export class ContentRuntime {
  version = '';
  api: typeof chrome.runtime | undefined;
  port: chrome.runtime.Port | undefined;
  stopped = false;
  listeners: Listener[] = [];
  cleanups: (() => void)[] = [];
  timer: ReturnType<typeof setInterval> | undefined;
  constructor() {
    try {
      this.api = chrome.runtime;
      this.version = this.api.getManifest().version;
      this.port = this.api.connect({ name: contentChannel });
      this.port.onDisconnect.addListener(this.disconnected);
    } catch {
      this.stop();
    }
  }
  available(): boolean {
    if (this.stopped) return false;
    try {
      return Boolean(chrome.runtime.id) && this.api?.getManifest().version === this.version;
    } catch {
      return false;
    }
  }
  send(snapshot: () => MediaMessage | InteractionMessage): void {
    if (!this.available() || !this.port) {
      this.stop();
      return;
    }
    try {
      this.port.postMessage({ ...snapshot(), content_version: contentBuild });
    } catch (error) {
      this.failed(error);
    }
  }
  disconnected = (): void => {
    try {
      if (this.api) Reflect.get(this.api, 'lastError');
    } catch {
      // Chrome may already have invalidated this content context.
    }
    this.stop();
  };
  failed(error: unknown): void {
    const invalid = error instanceof Error && /context invalidated/i.test(error.message);
    if (this.available() && !invalid) contentDiagnostic(error, 'content-runtime.js');
    this.stop();
  }
  listen(target: EventTarget, event: string, callback: EventListener): () => void {
    const guarded = (event: Event) => {
      this.dispatch(() => {
        callback(event);
      });
    };
    target.addEventListener(event, guarded, { capture: true, passive: true });
    const listener = { target, event, callback: guarded };
    this.listeners.push(listener);
    return () => {
      target.removeEventListener(event, guarded, true);
      this.listeners = this.listeners.filter((item) => item !== listener);
    };
  }
  dispatch(callback: () => void): void {
    if (!this.available()) {
      this.stop();
      return;
    }
    try {
      callback();
    } catch (error) {
      this.failed(error);
    }
  }
  heartbeat(callback: () => void): void {
    this.timer = setInterval(() => {
      this.dispatch(callback);
    }, 5000);
  }
  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    for (const listener of this.listeners)
      listener.target.removeEventListener(listener.event, listener.callback, true);
    this.listeners = [];
    this.disconnect();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
  }
  disconnect(): void {
    try {
      this.port?.onDisconnect.removeListener(this.disconnected);
      this.port?.disconnect();
    } catch {
      // The extension can be disabled before its listeners finish retiring.
    }
    this.port = undefined;
  }
}
export function installContent(
  key: 'activityTrackerInteraction' | 'activityTrackerMedia' | 'activityTrackerYouTube',
  start: (runtime: ContentRuntime) => void,
): void {
  const previous = window[key];
  if (previous?.available()) return;
  previous?.stop();
  const runtime = new ContentRuntime();
  if (!runtime.available()) return;
  window[key] = runtime;
  start(runtime);
}
declare global {
  interface Window {
    activityTrackerYouTube?: ContentRuntime;
    activityTrackerInteraction?: ContentRuntime;
    activityTrackerMedia?: ContentRuntime;
  }
}
