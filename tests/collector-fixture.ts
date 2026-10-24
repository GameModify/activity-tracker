import type { InteractionState } from '../extension/interaction-model.ts';
import type { ExtensionSettings } from '../extension/model.ts';
import type { CollectorState } from '../extension/collector-client.ts';
export class CollectorEvent {
  listeners: (() => void)[] = [];
  addListener(listener: () => void): void {
    this.listeners.push(listener);
  }
  fire(): void {
    for (const listener of this.listeners) listener();
  }
}
export class ScriptRegistry {
  scripts: chrome.scripting.RegisteredContentScript[] = [];
  injections: { tabId: number; files: string[]; frameIds: number[] }[] = [];
  executeScript(input: { target: { tabId: number; frameIds?: number[] }; files?: string[] }) {
    this.injections.push({
      tabId: input.target.tabId,
      files: input.files ?? [],
      frameIds: input.target.frameIds ?? [],
    });
    return Promise.resolve([]);
  }
  failure = '';
  getRegisteredContentScripts(filter?: { ids?: string[] }) {
    return Promise.resolve(
      this.scripts.filter((script) => !filter?.ids || filter.ids.includes(script.id)),
    );
  }
  registerContentScripts(scripts: chrome.scripting.RegisteredContentScript[]) {
    if (this.failure) return Promise.reject(new Error(this.failure));
    if (scripts.some((script) => this.scripts.some((old) => old.id === script.id)))
      return Promise.reject(new Error('Duplicate script ID'));
    this.scripts.push(...scripts);
    return Promise.resolve();
  }
  updateContentScripts(scripts: chrome.scripting.RegisteredContentScript[]) {
    if (this.failure) return Promise.reject(new Error(this.failure));
    this.scripts = this.scripts.map((old) => scripts.find((script) => script.id === old.id) ?? old);
    return Promise.resolve();
  }
  unregisterContentScripts(filter?: { ids?: string[] }) {
    this.scripts = filter?.ids
      ? this.scripts.filter((script) => !filter.ids?.includes(script.id))
      : [];
    return Promise.resolve();
  }
}
export class CollectorFixture {
  idleState: 'active' | 'idle' | 'locked' = 'active';
  tab = { id: 1, url: 'https://vk.ru/im/convo/123', incognito: false };
  interactionState: InteractionState | undefined;
  config: ExtensionSettings = {
    enabled: true,
    token: 'a'.repeat(64),
    instance: 'test',
    interaction_sites: [],
    media_exclusions: [],
    interaction_exclusions: [],
    sites: ['https://catalog.example/*', 'https://player.example/*'],
  };
  state: CollectorState = { collector_ready: false, collector_error: '', registered_sites: [] };
  allowed = new Set(this.config.sites);
  scripting = new ScriptRegistry();
  installed = new CollectorEvent();
  startup = new CollectorEvent();
  added = new CollectorEvent();
  removed = new CollectorEvent();
  changes: ((changes: { enabled?: boolean }, area: string) => void)[] = [];
  api() {
    return {
      scripting: this.scripting,
      idle: { queryState: () => Promise.resolve(this.idleState) },
      tabs: { get: () => Promise.resolve(this.tab) },
      runtime: this.runtime(),
      permissions: {
        onAdded: this.added,
        onRemoved: this.removed,
        contains: ({ origins }: { origins: string[] }) =>
          Promise.resolve(origins.every((site) => this.allowed.has(site))),
      },
      storage: this.storage(),
    };
  }
  runtime() {
    return {
      id: 'test-extension',
      getManifest: () => ({ version: 'test' }),
      getURL: (path: string) => 'chrome-extension://test-extension/' + path,
      onInstalled: this.installed,
      onStartup: this.startup,
    };
  }
  storage() {
    return {
      local: { get: () => Promise.resolve(this.config) },
      session: {
        get: (key: string) => Promise.resolve({ [key]: this.interactionState }),
        set: (patch: Partial<CollectorState>) => {
          Object.assign(this.state, patch);
          return Promise.resolve();
        },
      },
      onChanged: {
        addListener: (listener: (changes: { enabled?: boolean }, area: string) => void) =>
          this.changes.push(listener),
      },
    };
  }
}
export async function withCollector(
  operation: (fixture: CollectorFixture) => Promise<void>,
): Promise<void> {
  const fixture = new CollectorFixture(),
    previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: fixture.api() });
  try {
    await operation(fixture);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else Reflect.deleteProperty(globalThis, 'chrome');
  }
}
