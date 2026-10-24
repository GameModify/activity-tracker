import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTracked, matchingRule, signature } from '../src/domain/classify.ts';
import { ingest } from '../src/application/ingest.ts';
import { withinFolder } from '../src/domain/paths.ts';
import { windowResource } from '../src/adapters/windows/resource.ts';
import { DesktopProbe } from '../src/adapters/windows/desktop-probe.ts';
import { discordCollector } from '../src/adapters/windows/discord.ts';
import { sample, rule, start, withStore } from './fixtures.ts';
const chat = {
  source: 'chrome',
  kind: 'focus',
  url: 'https://vk.com/im?sel=123',
  interaction_at: start,
  idle_timeout_ms: 300000,
} as const;
void test('an open chat requires local interaction and stops exactly at its five-minute deadline', () => {
  assert.equal(isTracked(sample(0, { source: 'chrome', url: chat.url })), false);
  withStore((store) => {
    store.replaceRules([rule({ field: 'url', operator: 'equals', value: chat.url })]);
    for (let offset = 0; offset <= 300000; offset += 5000) ingest(store, sample(offset, chat));
    ingest(store, sample(360000, { ...chat, interaction_at: start + 360000 }));
    ingest(store, sample(365000, { ...chat, interaction_at: start + 360000 }));
    const rows = store.intervals(0, 20);
    assert.equal(rows.length, 2);
    assert.equal(rows.find((row) => row.closed)?.end_at, start + 300000);
    assert.equal(
      rows.reduce((sum, row) => sum + row.end_at - row.start_at, 0),
      305000,
    );
  });
});
void test('focus loss stops immediately and global idle cannot override a fresh page interaction', () => {
  assert.equal(isTracked(sample(5000, { ...chat, active: false })), false);
  assert.equal(isTracked(sample(5000, { ...chat, idle_ms: 500000 })), true);
  assert.equal(isTracked(sample(5000, { ...chat, interaction_at: start + 6000 })), false);
  assert.equal(isTracked(sample(300000, { idle_timeout_ms: 300000, idle_ms: 300000 })), false);
});
void test('folder rules handle case, subfolders, boundaries and traversal without matching unsaved documents', () => {
  assert.equal(withinFolder('C:/Science/sub/plan.docx', 'c:\\science\\'), true);
  assert.equal(withinFolder('C:/Science-old/plan.docx', 'C:/Science'), false);
  assert.equal(withinFolder('C:/Science/../Personal/plan.docx', 'C:/Science'), false);
  assert.equal(withinFolder('word-title:plan.docx', 'C:/Science'), false);
  const folder = rule({
    field: 'resource_id',
    operator: 'within',
    value: 'C:/Science',
    activity: 'science',
  });
  assert.equal(
    matchingRule(sample(0, { resource_id: 'C:/Science/sub/plan.docx' }), [folder])?.activity,
    'science',
  );
});
void test('Word uses the path only for the matching native window; Steam resources retain game identity', () => {
  const document = { name: 'Plan.docx', path: 'C:/Science/Plan.docx', window_handle: 1 };
  assert.equal(
    windowResource({ app: 'WINWORD.EXE', title: 'Plan.docx - Word', handle: 1 }, document)
      .resource_id,
    'C:\\Science\\Plan.docx',
  );
  assert.equal(
    windowResource({ app: 'WINWORD.EXE', title: 'Other - Word', handle: 2 }, document).resource_id,
    'word-title:other',
  );
  assertSteamResource();
  assert.notEqual(
    signature(sample(0, { resource_id: 'C:/a/Plan.docx' })),
    signature(sample(0, { resource_id: 'C:/b/Plan.docx' })),
  );
});
void test('Discord needs explicit connection evidence, survives background focus and expires missing evidence', () => {
  const probe = new DesktopProbe();
  probe.launchedAt = Date.now();
  const collector = discordCollector(probe);
  probe.value = { observed_at: Date.now(), word: null, discord: { state: 'unknown' } };
  assert.equal(collector.sample(), undefined);
  probe.value = { ...probe.value, discord: { state: 'connected' } };
  const connected = collector.sample();
  assert.ok(connected);
  assert.equal(isTracked(connected), true);
  probe.value = { ...probe.value, discord: { state: 'disconnected' } };
  assert.equal(isTracked(collector.sample() ?? connected), false);
  probe.value = { ...probe.value, observed_at: Date.now() - 16000 };
  assert.equal(collector.sample(), undefined);
});

function assertSteamResource(): void {
  const window = {
    app: 'game.exe',
    title: 'Game',
    app_path: 'D:/Steam/steamapps/common/Example Game/bin/game.exe',
  };
  assert.equal(windowResource(window).resource_id, 'steam-folder:example game');
}

void test('folder rules reject relative paths and incompatible fields', async () => {
  const { ruleSchema } = await import('../src/domain/contracts.ts');
  assert.equal(
    ruleSchema.safeParse(rule({ field: 'resource_id', operator: 'within', value: 'C:Science' }))
      .success,
    false,
  );
  assert.equal(
    ruleSchema.safeParse(rule({ field: 'title', operator: 'within', value: 'C:/Science' })).success,
    false,
  );
});
