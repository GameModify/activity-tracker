import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCollector } from './collector-fixture.ts';
import type { CollectorFixture } from './collector-fixture.ts';
import { videoLabelCommand } from '../extension/video-label-command.ts';
import type { ContentPort } from '../extension/content-channel.ts';
import type { VideoLabelReply } from '../extension/video-label-model.ts';
import { labels, identity } from './content-label-fixture.ts';
const message = { type: 'video-labels', request_id: crypto.randomUUID(), input: identity };
function context(fixture: CollectorFixture) {
  const replies: VideoLabelReply[] = [];
  const port: ContentPort = {
    name: 'activity-tracker-content',
    sender: { id: 'test-extension', frameId: 0, tab: fixture.tab },
    postMessage: (reply) => {
      replies.push(reply);
    },
    onMessage: { addListener: () => undefined },
  };
  fixture.tab.url = 'https://www.youtube.com/watch?v=' + identity.video_id;
  fixture.config.sites = ['https://www.youtube.com/*'];
  fixture.allowed.add('https://www.youtube.com/*');
  return { port, replies, calls: [] as string[] };
}
async function run(
  fixture: CollectorFixture,
  operation: (state: ReturnType<typeof context>) => Promise<void>,
): Promise<void> {
  const state = context(fixture),
    original = globalThis.fetch;
  globalThis.fetch = (url) => {
    state.calls.push(typeof url === 'string' ? url : url instanceof URL ? url.href : url.url);
    return Promise.resolve(
      new Response(JSON.stringify({ labels, video_label: null, channel_label: null })),
    );
  };
  try {
    await operation(state);
  } finally {
    globalThis.fetch = original;
  }
}
async function flush(): Promise<void> {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}
void test('a permitted top-frame YouTube request reaches only the fixed local service', () =>
  withCollector((fixture) =>
    run(fixture, async (state) => {
      assert.equal(videoLabelCommand(state.port, message), true);
      await flush();
      assert.equal(state.replies[0]?.state?.labels.length, labels.length);
      assert.ok(state.calls[0]?.startsWith('http://127.0.0.1:3536/v1/video-labels?'));
    }),
  ));
void test('navigating to another website rejects the request without forwarding category data', () =>
  withCollector((fixture) =>
    run(fixture, async (state) => {
      fixture.tab.url = 'https://example.org/';
      videoLabelCommand(state.port, message);
      await flush();
      assert.equal(state.calls.length, 0);
      assert.ok(state.replies[0]?.error);
    }),
  ));
void test('an excluded or incognito YouTube tab cannot use the category bridge', () =>
  withCollector((fixture) =>
    run(fixture, async (state) => {
      fixture.config.media_exclusions = ['https://www.youtube.com/*'];
      videoLabelCommand(state.port, message);
      await flush();
      fixture.config.media_exclusions = [];
      fixture.tab.incognito = true;
      videoLabelCommand(state.port, message);
      await flush();
      assert.equal(state.calls.length, 0);
      assert.equal(state.replies.length, 2);
    }),
  ));
