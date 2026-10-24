import { test } from 'node:test';
import assert from 'node:assert/strict';
import { connectContent } from '../extension/content-channel.ts';
import type { ContentPort } from '../extension/content-channel.ts';
import { withFocusBrowser } from './focus-channel-fixture.ts';
class Port implements ContentPort {
  name = 'activity-tracker-content';
  sender: ContentPort['sender'];
  listener: ((message: unknown) => void) | undefined;
  onMessage = {
    addListener: (callback: (message: unknown) => void) => {
      this.listener = callback;
    },
  };
}
void test('the content channel rejects unrelated connections and incognito senders', () =>
  withFocusBrowser(async (fixture) => {
    const port = new Port();
    connectContent(port);
    assert.equal(port.listener, undefined);
    port.sender = { id: 'other-extension', tab: fixture.tab };
    connectContent(port);
    assert.equal(port.listener, undefined);
    port.sender = { id: 'test-extension', tab: { ...fixture.tab, incognito: true } };
    connectContent(port);
    assert.equal(port.listener, undefined);
    await Promise.resolve();
  }));
void test('a validated port message reaches the existing interaction pipeline', () =>
  withFocusBrowser(async (fixture) => {
    const port = new Port();
    port.sender = { id: 'test-extension', tab: fixture.tab, frameId: 0 };
    connectContent(port);
    assert.ok(port.listener);
    port.listener({
      type: 'interaction',
      url: fixture.tab.url,
      interaction_at: Date.now(),
      focused: true,
      content_version: '0.5.2',
    });
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    assert.equal(fixture.state?.content_version, '0.5.2');
    assert.equal(fixture.samples[0]?.active, true);
  }));
void test('content connections cannot invoke privileged collector control commands', () =>
  withFocusBrowser(async (fixture) => {
    const port = new Port();
    port.sender = { id: 'test-extension', tab: fixture.tab, frameId: 0 };
    connectContent(port);
    assert.doesNotThrow(() => port.listener?.({ type: 'restore-media' }));
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    assert.equal(fixture.state, undefined);
    assert.equal(fixture.samples.length, 0);
  }));
