import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mediaCommand } from '../extension/media-command.ts';
import { frames } from '../extension/diagnostics.ts';
import { withMediaBrowser } from './media-browser-fixture.ts';
import { exampleTab } from './storage-fixture.ts';
void test('media messages keep the reply channel open until the frame state is stored', () =>
  withMediaBrowser(async () => {
    const value = { type: 'media', playing: true, media_count: 1, frames: [] };
    const sender = {
      id: 'test-extension',
      frameId: 3,
      tab: exampleTab,
      url: 'https://player.example/embed?token=private',
    };
    const reply = await new Promise<{ ok: boolean }>((resolve) => {
      assert.equal(mediaCommand(value, sender, resolve), true);
    });
    assert.equal(reply.ok, true);
    const stored = await frames();
    assert.equal(stored[0]?.playing, true);
    assert.equal(stored[0].frame_origin, 'https://player.example/*');
  }));
