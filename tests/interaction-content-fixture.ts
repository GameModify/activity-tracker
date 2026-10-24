import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type { InteractionMessage } from '../extension/interaction-model.ts';
import { TestTransport } from './content-transport-fixture.ts';
interface UserEvent {
  type: string;
  isTrusted: boolean;
}
type Callback = (event: UserEvent) => void;
export class InteractionPage {
  time = 1000000;
  focused = true;
  url = { href: 'https://vk.com/im?sel=123' };
  transport = new TestTransport<InteractionMessage>();
  callbacks = new Map<string, Set<Callback>>();
  heartbeat: (() => void) | undefined;
  get messages(): InteractionMessage[] {
    return this.transport.messages;
  }
  event(name: string, trusted = true): void {
    for (const callback of this.callbacks.get(name) ?? [])
      callback({ type: name, isTrusted: trusted });
  }
  context() {
    return {
      location: this.url,
      URL,
      window: { addEventListener: this.listen, removeEventListener: this.remove },
      Date: clockDate(() => this.time),
      document: {
        visibilityState: 'visible',
        hasFocus: () => this.focused,
        addEventListener: this.listen,
        removeEventListener: this.remove,
      },
      chrome: this.transport.chrome(),
      ...this.timers(),
    };
  }
  timers() {
    return {
      setInterval: (callback: () => void) => {
        this.heartbeat = callback;
        return 1;
      },
      clearInterval: () => {
        this.heartbeat = undefined;
      },
    };
  }
  listen = (name: string, callback: Callback) => {
    const callbacks = this.callbacks.get(name) ?? new Set<Callback>();
    callbacks.add(callback);
    this.callbacks.set(name, callbacks);
  };
  remove = (name: string, callback: Callback) => {
    this.callbacks.get(name)?.delete(callback);
  };
}
export async function interactionHarness() {
  const bundle = await build({
    entryPoints: ['extension/interaction-content.ts'],
    bundle: true,
    write: false,
    format: 'iife',
  });
  const code = bundle.outputFiles[0]?.text;
  if (!code) throw new Error('Missing interaction collector');
  const page = new InteractionPage(),
    context = page.context();
  const attach = () => {
    runInNewContext(code, context);
  };
  attach();
  return { page, attach };
}
function clockDate(clock: () => number) {
  return class extends Date {
    static override now() {
      return clock();
    }
  };
}
