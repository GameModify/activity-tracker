import { SessionStorageFixture, exampleTab } from './storage-fixture.ts';
function mediaApi(session: SessionStorageFixture) {
  const config = {
    enabled: true,
    token: '',
    instance: 'test',
    sites: ['https://player.example/*'],
  };
  return {
    runtime: { id: 'test-extension', getManifest: () => ({ version: 'test' }) },
    permissions: { contains: () => Promise.resolve(true) },
    tabs: { get: () => Promise.resolve(exampleTab) },
    idle: { queryState: () => Promise.resolve('active') },
    storage: { session, local: { get: () => Promise.resolve(config) } },
  };
}
export async function withMediaBrowser(
  operation: (session: SessionStorageFixture) => Promise<void>,
): Promise<void> {
  const session = new SessionStorageFixture(),
    previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome');
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: mediaApi(session) });
  try {
    await operation(session);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else Reflect.deleteProperty(globalThis, 'chrome');
  }
}
