import { TestTransport } from './content-transport-fixture.ts';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type { MediaMessage } from '../extension/diagnostic-model.ts';
export class TestMedia {
  present = true;
  currentTime = 65;
  duration = 120;
  paused = true;
  ended = false;
  readyState = 4;
}
function documentFixture(media: TestMedia, callbacks: Map<string, () => void>) {
  return {
    querySelectorAll: (selector: string) =>
      selector === 'video,audio'
        ? media.present
          ? [media]
          : []
        : [{ src: 'https://player.example/embed?secret=hidden' }],
    addEventListener: (name: string, callback: () => void) => callbacks.set(name, callback),
    removeEventListener: (name: string) => callbacks.delete(name),
  };
}
async function bundledContent(): Promise<string> {
  const bundle = await build({
    entryPoints: ['extension/content.ts'],
    bundle: true,
    write: false,
    format: 'iife',
  });
  const code = bundle.outputFiles[0]?.text;
  if (!code) throw new Error('Missing bundled content script');
  return code;
}
function timerFixture(callbacks: Map<string, () => void>) {
  return {
    setInterval: (callback: () => void) => {
      callbacks.set('heartbeat', callback);
      return 1;
    },
    clearInterval: () => callbacks.delete('heartbeat'),
  };
}
function contentContext(
  media: TestMedia,
  transport: TestTransport<MediaMessage>,
  callbacks: Map<string, () => void>,
) {
  return {
    HTMLMediaElement: TestMedia,
    URL,
    location: { href: 'https://player.example/embed', origin: 'https://player.example' },
    document: documentFixture(media, callbacks),
    window: {
      addEventListener: (name: string, callback: () => void) => callbacks.set(name, callback),
      removeEventListener: (name: string) => callbacks.delete(name),
    },
    chrome: transport.chrome(),
    ...timerFixture(callbacks),
  };
}
export async function contentHarness(present = true) {
  const media = new TestMedia(),
    transport = new TestTransport<MediaMessage>(),
    callbacks = new Map<string, () => void>();
  media.present = present;
  const context = contentContext(media, transport, callbacks),
    code = await bundledContent();
  const rerun = () => {
    runInNewContext(code, context);
  };
  rerun();
  return { media, messages: transport.messages, transport, callbacks, rerun };
}
