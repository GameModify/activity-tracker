import type { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseVideo, videoLabels } from '../src/application/content-labels.ts';
import { ingest } from '../src/application/ingest.ts';
import { matchingRule } from '../src/domain/classify.ts';
import { withStore, rule } from './fixtures.ts';
import { identity, labels, video } from './content-label-fixture.ts';
void test('channel labels apply only to media from the exact channel and preserve provenance', () => {
  withStore((store) => {
    store.seedRules();
    store.replaceLabels(labels);
    chooseVideo(store, { ...identity, target: 'channel', label_id: 'work' }, randomUUID);
    ingest(store, video());
    ingest(store, video(5000));
    const item = store.intervals(0, 10)[0];
    assert.equal(item?.activity, 'tng:work');
    assert.notEqual(
      matchingRule({ ...video(), kind: 'focus' }, store.rules())?.activity,
      'tng:work',
    );
    assert.equal(
      matchingRule({ ...video(), media_creator: '/@other' }, store.rules())?.activity,
      'video',
    );
  });
});
void test('an exact video overrides the channel, edits are idempotent and reset restores inheritance', () => {
  withStore((store) => {
    store.replaceLabels(labels);
    chooseVideo(store, { ...identity, target: 'channel', label_id: 'work' }, randomUUID);
    const choice = { ...identity, target: 'video', label_id: 'watch' } as const;
    chooseVideo(store, choice, randomUUID);
    const id = matchingRule(video(), store.rules())?.id;
    chooseVideo(store, choice, randomUUID);
    assert.equal(matchingRule(video(), store.rules())?.id, id);
    assert.equal(matchingRule(video(), store.rules())?.activity, 'tng:watch');
    chooseVideo(store, { ...choice, label_id: null }, randomUUID);
    assert.equal(matchingRule(video(), store.rules())?.activity, 'tng:work');
  });
});
void test('YouTube video IDs remain case sensitive while creator aliases are case insensitive', () => {
  withStore((store) => {
    store.replaceLabels(labels);
    chooseVideo(store, { ...identity, target: 'video', label_id: 'work' }, randomUUID);
    assert.equal(matchingRule({ ...video(), media_id: 'Abcdefghijk' }, store.rules()), undefined);
    chooseVideo(store, { ...identity, target: 'channel', label_id: 'watch' }, randomUUID);
    assert.equal(videoLabels(store, { ...identity, creator: '/@LESSONS' }).channel_label, 'watch');
  });
});
void test('invalid category or unknown channel cannot remove existing rules', () => {
  withStore((store) => {
    store.replaceLabels(labels);
    store.replaceRules([rule()]);
    const before = store.rules();
    assert.throws(() =>
      chooseVideo(store, { ...identity, target: 'video', label_id: 'deleted' }, randomUUID),
    );
    assert.throws(() =>
      chooseVideo(
        store,
        { video_id: identity.video_id, target: 'channel', label_id: 'work' },
        randomUUID,
      ),
    );
    assert.deepEqual(store.rules(), before);
  });
});
void test('existing activity mappings resolve the same category and unlabelled YouTube has its own default', () => {
  withStore((store) => {
    store.seedRules();
    store.replaceLabels(labels);
    ingest(store, video());
    ingest(store, video(5000));
    assert.equal(store.intervals(0, 10)[0]?.activity, 'youtube');
    store.replaceRules([rule({ field: 'media_creator', value: '/@lessons', scope: 'media' })]);
    assert.equal(videoLabels(store, identity).channel_label, 'work');
  });
});

void test('video and creator metadata survive interval persistence', () => {
  withStore((store) => {
    ingest(store, video());
    ingest(store, video(5000));
    const item = store.intervals(0, 10)[0];
    assert.equal(item?.media_creator, identity.creator);
    assert.equal(item?.media_id, identity.video_id);
  });
});

void test('changing a rule category while playing starts a new segment without rewriting elapsed time', () => {
  withStore((store) => {
    store.replaceLabels(labels);
    const choice = { ...identity, target: 'channel', label_id: 'work' } as const;
    chooseVideo(store, choice, randomUUID);
    ingest(store, video());
    ingest(store, video(5000));
    chooseVideo(store, { ...choice, label_id: 'watch' }, randomUUID);
    ingest(store, video(10000));
    ingest(store, video(15000));
    const items = store.intervals(0, 10).sort((a, b) => a.start_at - b.start_at);
    assert.equal(items.length, 2);
    assert.equal(items[0]?.activity, 'tng:work');
    assert.equal(items[1]?.activity, 'tng:watch');
    assert.equal(items[0].end_at, items[1].start_at);
  });
});

const priorityChannel = rule({
  field: 'media_creator',
  value: '/@lessons',
  scope: 'media',
  activity: 'watch',
  priority: 999,
});
const priorityVideo = rule({
  field: 'media_id',
  value: identity.video_id,
  scope: 'media',
  activity: 'coding',
  priority: 10,
});
void test('specific video rules win over a channel even when an older channel priority is higher', () => {
  withStore((store) => {
    store.replaceRules([priorityChannel, priorityVideo]);
    assert.equal(matchingRule(video(), store.rules())?.activity, 'coding');
  });
});

void test('resetting a channel removes its rule without changing video overrides or history', () => {
  withStore((store) => {
    const history = channelPlayback(store);
    chooseVideo(store, { ...identity, target: 'video', label_id: 'watch' }, randomUUID);
    const state = chooseVideo(
      store,
      { ...identity, target: 'channel', label_id: null },
      randomUUID,
    );
    assert.equal(state.channel_label, null);
    assert.equal(state.video_label, 'watch');
    assert.equal(matchingRule(video(), store.rules())?.activity, 'tng:watch');
    assert.equal(
      matchingRule({ ...video(), media_id: 'ZYXwvutsrqp' }, store.rules())?.activity,
      'video',
    );
    assert.deepEqual(store.intervals(0, 10), history);
  });
});
void test('channel reset is idempotent and future playback returns to YouTube viewing', () => {
  withStore((store) => {
    store.seedRules();
    store.replaceLabels(labels);
    chooseVideo(store, { ...identity, target: 'channel', label_id: 'work' }, randomUUID);
    const reset = { ...identity, target: 'channel', label_id: null } as const;
    chooseVideo(store, reset, randomUUID);
    const rules = store.rules();
    assert.equal(chooseVideo(store, reset, randomUUID).channel_label, null);
    assert.deepEqual(store.rules(), rules);
    ingest(store, video());
    ingest(store, video(5000));
    assert.equal(store.intervals(0, 10)[0]?.activity, 'youtube');
  });
});

function channelPlayback(store: SqliteStore) {
  store.seedRules();
  store.replaceLabels(labels);
  chooseVideo(store, { ...identity, target: 'channel', label_id: 'work' }, randomUUID);
  ingest(store, video());
  ingest(store, video(5000));
  return store.intervals(0, 10);
}
