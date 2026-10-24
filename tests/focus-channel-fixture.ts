import assert from 'node:assert/strict';
import { settingsSchema } from '../extension/model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import type { InteractionState } from '../extension/interaction-model.ts';
import { interactionCommand } from '../extension/interaction-command.ts';
class FocusBrowser {
  tab = { id: 1, active: true, windowId: 1, url: 'https://example.org/', incognito: false };
  focused = true;
  state: InteractionState | undefined;
  samples: Observation[] = [];
  config = settingsSchema.parse({
    enabled: true,
    instance: 'test',
    token: 'a'.repeat(64),
    interaction_sites: ['https://*/*'],
  });
  setLocal = (patch: { queue?: Observation[] }) => {
    if (patch.queue?.length) this.samples.push(...patch.queue);
    return Promise.resolve();
  };
  setSession = (patch: Record<string, InteractionState>) => {
    this.state = Object.values(patch)[0];
    return Promise.resolve();
  };
  api() {
    return {
      runtime: { id: 'test-extension', getManifest: () => ({ version: 'test' }) },
      permissions: { contains: () => Promise.resolve(true) },
      idle: { queryState: () => Promise.resolve('active') },
      tabs: { get: () => Promise.resolve(this.tab) },
      windows: { get: () => Promise.resolve({ focused: this.focused }) },
      storage: {
        local: { get: () => Promise.resolve({ ...this.config, queue: [] }), set: this.setLocal },
        session: {
          get: (key: string) => Promise.resolve({ [key]: this.state }),
          set: this.setSession,
        },
      },
    };
  }
  async post(): Promise<void> {
    await new Promise<{ ok: boolean }>((reply) => {
      const message = {
        type: 'interaction',
        url: this.tab.url,
        interaction_at: Date.now(),
        focused: this.tab.active && this.focused,
      };
      assert.equal(
        interactionCommand(message, { id: 'test-extension', tab: this.tab, frameId: 0 }, reply),
        true,
      );
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}
export async function withFocusBrowser(
  operation: (fixture: FocusBrowser) => Promise<void>,
): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome'),
    fetch = globalThis.fetch;
  const fixture = new FocusBrowser();
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: fixture.api() });
  globalThis.fetch = () => Promise.resolve(new Response('{"ok":true,"paused":false}'));
  try {
    await operation(fixture);
  } finally {
    globalThis.fetch = fetch;
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else Reflect.deleteProperty(globalThis, 'chrome');
  }
}
