import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { sample, rule, withStore } from './fixtures.ts';
import { ingest } from '../src/application/ingest.ts';
import { matchingRule } from '../src/domain/classify.ts';
import { browserPreferences, configureBrowser } from '../src/application/browser-preferences.ts';
import type { SqliteStore } from '../src/adapters/sqlite/store.ts';
const science = rule({
  field: 'host',
  value: 'research.example',
  activity: 'science',
  scope: 'focus',
  project: 'Research',
});
const appRule = rule({ project: 'Tracker', scope: 'focus' });
const channelRule = rule({
  field: 'media_creator',
  value: '/@training',
  scope: 'media',
  activity: 'coding',
});
const documentRule = rule({
  activity: 'science',
  field: 'resource_id',
  value: 'C:\\Research',
  operator: 'within',
});
const training = sample(0, { kind: 'media', media_creator: '/@training' });
const music = sample(0, { kind: 'media', media_creator: '/@music' });
const oldChat = sample(0, { url: 'https://vk.ru/im/convo/12345', app: 'chrome.exe' });
const newChat = sample(0, { url: 'https://vk.ru/im/convo/67890', app: 'chrome.exe' });
function verifyWebsite(store: SqliteStore): void {
  store.replaceRules([science]);
  ingest(
    store,
    sample(0, { source: 'chrome', url: 'https://research.example/paper', web_enabled: true }),
  );
  const work = store.intervals(0, 10)[0];
  assert.equal(work?.website, 'research.example');
  assert.equal(work.project, 'Research');
  assert.equal(work.activity, 'science');
  ingest(
    store,
    sample(5000, { source: 'chrome', url: 'https://other.example/', web_enabled: true }),
  );
  assert.equal(store.intervals(0, 10).at(-1)?.activity, 'web');
}
function verifyScope(store: SqliteStore): void {
  store.replaceRules([appRule, channelRule]);
  assert.equal(store.rules().find((entry) => entry.id === appRule.id)?.project, 'Tracker');
  assert.equal(matchingRule(training, store.rules())?.activity, 'coding');
  assert.equal(matchingRule(music, store.rules()), undefined);
  assert.equal(matchingRule(sample(), store.rules())?.project, 'Tracker');
}
function verifySupervisor(store: SqliteStore): void {
  store.replaceRules([documentRule]);
  configureBrowser(store, { science_chat_id: '12345' }, randomUUID);
  configureBrowser(store, { science_chat_id: '67890' }, randomUUID);
  assert.equal(browserPreferences(store).science_chat_id, '67890');
  assert.equal(store.rules().length, 5);
  assert.equal(matchingRule(oldChat, store.rules()), undefined);
  assert.equal(matchingRule(newChat, store.rules())?.activity, 'science');
  configureBrowser(store, { science_chat_id: '' }, randomUUID);
  assert.equal(store.rules().length, 1);
  assert.equal(store.rules()[0]?.id, documentRule.id);
}
void test('ordinary websites retain host context and explicit work rules preserve their project', () => {
  withStore(verifyWebsite);
});
void test('application and video-channel rules cannot classify unrelated event types', () => {
  withStore(verifyScope);
});
void test('changing a supervisor replaces exact chat rules and preserves document rules', () => {
  withStore(verifySupervisor);
});
