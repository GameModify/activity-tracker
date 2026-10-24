import { test } from 'node:test';
import assert from 'node:assert/strict';
import { restoreExisting } from '../extension/collector-runtime.ts';
import { withCollector } from './collector-fixture.ts';
type RestoreTab = Pick<chrome.tabs.Tab, 'id' | 'url' | 'incognito' | 'discarded'>;
function tab(id: number, url: string, extra: Partial<RestoreTab> = {}): RestoreTab {
  return { id, url, incognito: false, discarded: false, ...extra };
}
void test('extension restoration reinjects the current version into permitted existing tabs', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = ['https://vk.ru/*'];
    fixture.allowed.add('https://vk.ru/*');
    fixture.tabs = [tab(1, fixture.tab.url)];
    await restoreExisting();
    const injection = fixture.scripting.injections.find((item) => item.files.length);
    assert.deepEqual(injection?.files, [
      'collectors/test/content-diagnostics.js',
      'collectors/test/interaction-content.js',
    ]);
    assert.equal(injection.tabId, 1);
  }));
void test('restoration skips private, discarded, excluded and unpermitted pages', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = ['https://vk.ru/*'];
    fixture.tabs = [
      tab(1, fixture.tab.url),
      tab(2, fixture.tab.url, { incognito: true }),
      tab(3, fixture.tab.url, { discarded: true }),
      tab(4, 'chrome://extensions'),
    ];
    await restoreExisting();
    assert.equal(fixture.scripting.injections.length, 0);
    fixture.allowed.add('https://vk.ru/*');
    fixture.config.interaction_exclusions = ['https://vk.ru/*'];
    await restoreExisting();
    assert.equal(fixture.scripting.injections.length, 0);
  }));
void test('a tab closing during restoration cannot prevent another tab from recovering', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = ['https://vk.ru/*'];
    fixture.allowed.add('https://vk.ru/*');
    fixture.tabs = [tab(1, fixture.tab.url), tab(2, fixture.tab.url)];
    fixture.missingTabs.add(1);
    await restoreExisting();
    assert.equal(fixture.scripting.injections.find((item) => item.files.length)?.tabId, 2);
  }));
