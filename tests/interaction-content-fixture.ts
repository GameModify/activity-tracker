import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type { InteractionMessage } from '../extension/interaction-model.ts';
interface UserEvent {
  type: string;
  isTrusted: boolean;
}
export class InteractionPage {
  time = 1000000;
  focused = true;
  url = { href: 'https://vk.com/im?sel=123' };
  messages: InteractionMessage[] = [];
  callbacks = new Map<string, (event: UserEvent) => void>();
  heartbeat: (() => void) | undefined;
  event(name: string, trusted = true): void {
    this.callbacks.get(name)?.({ type: name, isTrusted: trusted });
  }
  context() {
    return {
      location: this.url,
      URL,
      window: { addEventListener: this.listen },
      Date: clockDate(() => this.time),
      document: {
        visibilityState: 'visible',
        hasFocus: () => this.focused,
        addEventListener: this.listen,
      },
      chrome: this.transport(),
      setInterval: (callback: () => void) => {
        this.heartbeat = callback;
      },
    };
  }
  transport() {
    return {
      runtime: {
        getManifest: () => ({ version: 'test' }),
        sendMessage: (message: InteractionMessage) => {
          this.messages.push(message);
          return Promise.resolve();
        },
      },
    };
  }
  listen = (name: string, callback: (event: UserEvent) => void) => {
    this.callbacks.set(name, callback);
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
