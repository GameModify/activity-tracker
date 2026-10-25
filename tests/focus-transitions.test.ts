import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectFocus,
  activateTab,
  updateTab,
  closeTab,
  focusWindow,
} from '../extension/focus-collector.ts';
import { withFocusBrowser } from './focus-channel-fixture.ts';
import type { FocusBrowser } from './focus-channel-fixture.ts';
async function delivered(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}
void test('queued browser transitions preserve their original timestamps and background updates cannot stop them', async (context) => {
  await withFocusBrowser(async (fixture) => {
    let now = Date.now();
    context.mock.method(Date, 'now', () => now);
    const began = collectFocus({ tab: fixture.tab, windowId: 1, active: true });
    now += 1000;
    const ended = collectFocus({ active: false });
    await Promise.all([began, ended]);
    await delivered();
    assert.deepEqual(
      fixture.samples.map((item) => item.active),
      [true, false],
    );
    assert.equal((fixture.samples[1]?.timestamp ?? 0) - (fixture.samples[0]?.timestamp ?? 0), 1000);
    await backgroundUpdates(fixture);
    await closedOldTab(fixture);
  });
});
async function backgroundUpdates(fixture: FocusBrowser): Promise<void> {
  focusWindow(1);
  await collectFocus({ tab: fixture.tab, windowId: 1, active: true });
  await delivered();
  fixture.samples.length = 0;
  activateTab({ tabId: 2, windowId: 2 });
  updateTab(2, { url: 'https://background.example/' }, { ...fixture.tab, id: 2, windowId: 2 });
  await collectFocus({ tab: fixture.tab, windowId: 1, active: true });
  await delivered();
  assert.equal(fixture.samples.length, 1);
  assert.equal(fixture.samples[0]?.active, true);
}
async function closedOldTab(fixture: FocusBrowser): Promise<void> {
  fixture.samples.length = 0;
  const next = { ...fixture.tab, id: 2, url: 'https://next.example/' };
  const activated = collectFocus({ tab: next, windowId: 1, active: true });
  closeTab(1);
  await activated;
  await collectFocus({ tab: next, windowId: 1, active: true });
  await delivered();
  assert.ok(fixture.samples.length >= 2);
  assert.ok(fixture.samples.every((item) => item.active));
  assert.ok(fixture.samples.every((item) => item.url === 'https://next.example/'));
}
