import type { MediaMessage } from './diagnostic-model.ts';
import type { InteractionMessage } from './interaction-model.ts';
interface Listener {
  target: EventTarget;
  event: string;
  callback: EventListener;
}
export class ContentRuntime {
  version = '';
  stopped = false;
  listeners: Listener[] = [];
  timer: ReturnType<typeof setInterval> | undefined;
  constructor() {
    try {
      this.version = chrome.runtime.getManifest().version;
    } catch {
      this.stopped = true;
    }
  }
  available(): boolean {
    if (this.stopped) return false;
    try {
      return Boolean(chrome.runtime.id) && chrome.runtime.getManifest().version === this.version;
    } catch {
      return false;
    }
  }
  send(snapshot: () => MediaMessage | InteractionMessage): void {
    if (!this.available()) {
      this.stop();
      return;
    }
    try {
      void chrome.runtime.sendMessage(snapshot()).catch(() => {
        if (!this.available()) this.stop();
      });
    } catch {
      this.stop();
    }
  }
  listen(target: EventTarget, event: string, callback: EventListener): void {
    target.addEventListener(event, callback, { capture: true, passive: true });
    this.listeners.push({ target, event, callback });
  }
  heartbeat(callback: () => void): void {
    this.timer = setInterval(callback, 5000);
  }
  stop(): void {
    this.stopped = true;
    if (this.timer !== undefined) clearInterval(this.timer);
    for (const listener of this.listeners)
      listener.target.removeEventListener(listener.event, listener.callback, true);
    this.listeners = [];
  }
}
export function installContent(
  key: 'activityTrackerInteraction' | 'activityTrackerMedia',
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
    activityTrackerInteraction?: ContentRuntime;
    activityTrackerMedia?: ContentRuntime;
  }
}
