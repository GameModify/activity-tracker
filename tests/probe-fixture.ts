import { TestMedia } from './content-fixture.ts';
export class ProbeDocumentFixture {
  origin = 'https://player.example';
  media = new TestMedia();
  reads = 0;
  query(selector: string) {
    this.reads++;
    return selector === 'video,audio'
      ? [this.media]
      : [{ src: 'https://nested.example/embed?token=private' }];
  }
}
function restoreGlobals(previous: (readonly [string, PropertyDescriptor | undefined])[]): void {
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
}
export function withProbeDocument(operation: (fixture: ProbeDocumentFixture) => void): void {
  const fixture = new ProbeDocumentFixture();
  const values = [
    ['location', { origin: fixture.origin }],
    ['HTMLMediaElement', TestMedia],
    ['document', { querySelectorAll: (selector: string) => fixture.query(selector) }],
  ] as const;
  const previous = values.map(
    ([key]) => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const,
  );
  for (const [key, value] of values)
    Object.defineProperty(globalThis, key, { value, configurable: true });
  try {
    operation(fixture);
  } finally {
    restoreGlobals(previous);
  }
}
