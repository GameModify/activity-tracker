import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ingest } from '../src/application/ingest.ts';
import { vkChat } from '../src/domain/chat.ts';
import { coversMonitor, potentialGame } from '../src/domain/screen.ts';
import { desktopActivity } from '../src/application/desktop-activity.ts';
import { GameActivity } from '../src/application/game-activity.ts';
import { sample, rule, start, withStore } from './fixtures.ts';
const target = 'https://vk.ru/im/convo/123';
const scientific = rule({
  field: 'url',
  operator: 'equals',
  value: target,
  name: 'Scientific chat',
  activity: 'science',
});
function chat(offset: number, url = target) {
  return sample(offset, { source: 'chrome', url, interaction_at: start + offset });
}
void test('only the exact configured conversation is tracked, not another chat, prefix or messenger home', () => {
  withStore((store) => {
    store.replaceRules([scientific]);
    ingest(store, chat(0));
    ingest(store, chat(5000));
    ingest(store, chat(10000, target + '4'));
    ingest(store, chat(15000, 'https://vk.ru/im/convo/456'));
    ingest(store, chat(20000, 'https://vk.ru/im'));
    const rows = store.intervals(0, 10);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.end_at, start + 10000);
    assert.equal(rows[0].title, 'Scientific chat');
    assert.equal(rows[0].resource_id, 'vk-chat:123');
  });
});
void test('chat identity accepts known VK addresses and rejects unrelated hosts and malformed paths', () => {
  assert.equal(vkChat(target), '123');
  assert.equal(vkChat('https://vk.com/im?sel=123'), '123');
  assert.equal(vkChat('https://example.com/im/convo/123'), undefined);
  assert.equal(vkChat('https://vk.ru/im/convo/123/details'), undefined);
  assert.equal(vkChat('https://vk.ru/im?sel=123text'), undefined);
});
void test('fullscreen geometry uses the whole monitor, including a secondary monitor with negative coordinates', () => {
  const primary = { left: 0, top: 0, right: 2560, bottom: 1440 };
  const secondary = { left: -1920, top: 100, right: 0, bottom: 1180 };
  assert.equal(coversMonitor(primary, primary), true);
  assert.equal(coversMonitor(secondary, secondary), true);
  assert.equal(coversMonitor({ ...primary, bottom: 1400 }, primary), false);
  assert.equal(coversMonitor({ ...primary, left: -8, right: 2568 }, primary), false);
  assert.equal(coversMonitor({ ...primary, right: 0 }, primary), false);
  assert.equal(potentialGame('chrome.exe'), false);
  assert.equal(potentialGame('WINWORD.EXE'), false);
  assert.equal(potentialGame('example-game.exe'), true);
});
void test('confirmed non-Steam games retain their identity and two-minute grace without assuming fullscreen means gaming', () => {
  const observed = sample(0, {
    app: 'example.exe',
    resource_id: 'app:example.exe',
    fullscreen: true,
  });
  assert.equal(desktopActivity(observed, []).resource_kind, undefined);
  const confirmed = desktopActivity(observed, [
    rule({ value: 'example.exe', name: 'Example', activity: 'games' }),
  ]);
  assert.equal(confirmed.resource_kind, 'game');
  assert.equal(confirmed.title, 'Example');
  const monitor = new GameActivity();
  monitor.observe(confirmed);
  for (let offset = 5000; offset <= 120000; offset += 5000) monitor.observe(sample(offset));
  assert.equal(monitor.current?.active, false);
});
