import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readInteraction } from '../extension/interaction-diagnostics.ts';
import { interactionView } from '../extension/interaction-status.ts';
import { inspectInteractions } from '../extension/interaction-registration.ts';
import { safeUrl } from '../extension/model.ts';
import { ingest } from '../src/application/ingest.ts';
import { withCollector } from './collector-fixture.ts';
import { sample, start, rule, withStore } from './fixtures.ts';
import type { InteractionDiagnostic } from '../extension/interaction-diagnostics.ts';
import { popup, timestamp } from './popup-fixture.ts';
import { showMedia } from '../extension/popup-interaction.ts';
const site = 'https://vk.ru/*';
function diagnostic(): InteractionDiagnostic {
  return {
    site,
    selected: true,
    permitted: true,
    state: {
      type: 'interaction',
      url: 'https://vk.ru/im/convo/123',
      focused: true,
      interaction_at: timestamp,
      observed_at: timestamp,
    },
  };
}
void test('chat diagnostics distinguish unselected vk.ru from media permission and require explicit enablement', () =>
  withCollector(async (fixture) => {
    fixture.allowed.add(site);
    const status = await readInteraction(fixture.tab, fixture.config);
    assert.equal(status?.permitted, true);
    assert.equal(status.selected, false);
    assert.match(interactionView(status, true, false).heading, /не включён/);
    await inspectInteractions(1);
    assert.deepEqual(fixture.scripting.injections, []);
  }));
void test('enabled interaction restoration attaches only the top-frame collector to the selected origin', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = [site];
    fixture.allowed.add(site);
    await inspectInteractions(1);
    assert.deepEqual(fixture.scripting.injections, [
      { tabId: 1, files: ['content-diagnostics.js', 'interaction-content.js'], frameIds: [0] },
    ]);
    fixture.allowed.delete(site);
    await inspectInteractions(1);
    assert.equal(fixture.scripting.injections.length, 1);
  }));
void test('chat diagnostics reject an old dialogue state and incognito access', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = [site];
    fixture.allowed.add(site);
    fixture.interactionState = {
      ...diagnostic().state,
      type: 'interaction',
      url: fixture.tab.url,
      focused: true,
      interaction_at: Date.now(),
      observed_at: Date.now(),
    };
    assert.ok((await readInteraction(fixture.tab, fixture.config))?.state);
    fixture.tab.url = 'https://vk.ru/im/convo/456';
    assert.equal((await readInteraction(fixture.tab, fixture.config))?.state, undefined);
    fixture.tab.incognito = true;
    assert.equal(await readInteraction(fixture.tab, fixture.config), null);
    await inspectInteractions(1);
    assert.equal(fixture.scripting.injections.length, 0);
  }));
void test('chat status shows actions, focus loss, inactivity and service pause without a player error', () => {
  const input = diagnostic();
  assert.match(interactionView(input, true, false, timestamp).heading, /Действия обнаружены/);
  assert.match(interactionView(input, true, true, timestamp).heading, /приостановлен/);
  assert.match(interactionView(input, false, false, timestamp).heading, /выключен/);
  assert.match(interactionView(input, true, false, timestamp + 15000).heading, /Ждём/);
  assert.equal(showMedia(popup({ interaction: input })), false);
  assert.ok(input.state);
  input.state = { ...input.state, focused: false };
  assert.match(interactionView(input, true, false, timestamp).heading, /Сигнал от чата получен/);
  input.state = { ...input.state, observed_at: timestamp + 300000 };
  assert.match(interactionView(input, true, false, timestamp + 300000).heading, /5 минут/);
});
void test('vk.ru modern and legacy chat URLs retain only the required identity and classify interactions', () => {
  assert.equal(safeUrl('https://vk.ru/im?sel=123&token=secret'), 'https://vk.ru/im?sel=123');
  const url = safeUrl('https://vk.ru/im/convo/123?entrypoint=list_all#private');
  assert.equal(url, 'https://vk.ru/im/convo/123');
  withStore((store) => {
    store.replaceRules([
      rule({
        field: 'url',
        operator: 'contains',
        value: 'vk.ru/im/convo/123',
        activity: 'science',
      }),
    ]);
    const chat = { source: 'chrome', url, interaction_at: start, idle_timeout_ms: 300000 } as const;
    ingest(store, sample(0, chat));
    ingest(store, sample(5000, chat));
    assert.equal(store.intervals(0, 10)[0]?.activity, 'science');
    assert.equal(store.intervals(0, 10)[0]?.end_at, start + 5000);
  });
});
