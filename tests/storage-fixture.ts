import type { TabDetails } from '../extension/diagnostic-model.ts';
import type { FrameStatus } from '../extension/diagnostic-model.ts';
export class SessionStorageFixture {
  saved = new Map<string, FrameStatus>();
  get(key: string | null) {
    return Promise.resolve(
      Object.fromEntries<FrameStatus>([...this.saved].filter(([id]) => key === null || id === key)),
    );
  }
  set(entries: Record<string, FrameStatus>) {
    for (const [id, value] of Object.entries(entries)) this.saved.set(id, value);
    return Promise.resolve();
  }
  remove(keys: string[]) {
    for (const key of keys) this.saved.delete(key);
    return Promise.resolve();
  }
}
export async function withFrameStorage(operation: () => Promise<void>): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  const value = { storage: { session: new SessionStorageFixture() } };
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value });
  try {
    await operation();
  } finally {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else Reflect.deleteProperty(globalThis, 'chrome');
  }
}
export const exampleTab: TabDetails = { id: 1, title: 'Test series', incognito: false };
