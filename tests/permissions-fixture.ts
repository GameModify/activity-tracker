import { settingsSchema } from '../extension/model.ts';
import type { ExtensionSettings } from '../extension/model.ts';
import { includesSite } from '../extension/sites.ts';
class PermissionFixture {
  config = settingsSchema.parse({ enabled: true, instance: 'test' });
  allowed: string[] = [];
  get = () => Promise.resolve(this.config);
  set = (patch: Partial<ExtensionSettings>) => {
    Object.assign(this.config, patch);
    return Promise.resolve();
  };
  request = ({ origins }: { origins: string[] }) => {
    this.allowed.push(...origins);
    return Promise.resolve(true);
  };
  remove = ({ origins }: { origins: string[] }) => {
    this.allowed = this.allowed.filter((site) => !origins.includes(site));
    return Promise.resolve(true);
  };
  contains = ({ origins }: { origins: string[] }) =>
    Promise.resolve(origins.every((site) => includesSite(this.allowed, site)));
  api() {
    return {
      runtime: {
        sendMessage: () =>
          Promise.resolve({
            collector_ready: true,
            collector_error: '',
            registered_sites: this.config.sites,
          }),
      },
      permissions: { request: this.request, remove: this.remove, contains: this.contains },
      storage: { local: { get: this.get, set: this.set } },
    };
  }
}
export async function withPermissions(
  operation: (fixture: PermissionFixture) => Promise<void>,
): Promise<void> {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'chrome'),
    fixture = new PermissionFixture();
  Object.defineProperty(globalThis, 'chrome', { configurable: true, value: fixture.api() });
  try {
    await operation(fixture);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'chrome', previous);
    else Reflect.deleteProperty(globalThis, 'chrome');
  }
}
