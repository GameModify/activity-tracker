import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VideoLabelClient } from '../extension/video-label-client.ts';
import type { VideoLabelPort } from '../extension/video-label-client.ts';
import type { VideoLabelMessage } from '../extension/video-label-model.ts';
import { identity, labels } from './content-label-fixture.ts';
class Port implements VideoLabelPort {
  messages: VideoLabelMessage[] = [];
  listener: ((value: unknown) => void) | undefined;
  onMessage = {
    addListener: (listener: (value: unknown) => void) => {
      this.listener = listener;
    },
    removeListener: () => {
      this.listener = undefined;
    },
  };
  postMessage(message: VideoLabelMessage): void {
    this.messages.push(message);
  }
  reply(request_id: string): void {
    this.listener?.({
      type: 'video-labels-result',
      request_id,
      state: { labels, video_label: 'work', channel_label: null },
    });
  }
}
void test('category requests correlate replies and reject pending work on disconnect', async () => {
  const port = new Port(),
    client = new VideoLabelClient(port);
  const first = client.request(identity),
    second = client.request(identity);
  assert.equal(port.messages.length, 2);
  port.reply(port.messages[0]?.request_id ?? '');
  assert.equal((await first).video_label, 'work');
  const rejected = assert.rejects(second, /отключён/);
  client.stop();
  await rejected;
  assert.equal(client.pending.size, 0);
  assert.equal(port.listener, undefined);
});
void test('malformed replies cannot resolve or overwrite a current category selection', async () => {
  const port = new Port(),
    client = new VideoLabelClient(port);
  const promise = client.request(identity);
  port.listener?.({
    type: 'video-labels-result',
    request_id: port.messages[0]?.request_id,
    state: { labels: 'invalid' },
  });
  assert.equal(client.pending.size, 1);
  port.reply(port.messages[0]?.request_id ?? '');
  assert.equal((await promise).labels.length, 2);
  client.stop();
});
