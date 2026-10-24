import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectDocument } from '../extension/document-probe.ts';
import { withProbeDocument } from './probe-fixture.ts';
void test('direct inspection detects existing playback and pause in a configured frame', () => {
  withProbeDocument((fixture) => {
    fixture.media.paused = false;
    const active = inspectDocument([fixture.origin]);
    assert.equal(active?.playing, true);
    assert.equal(active.media_count, 1);
    assert.equal(active.position_seconds, 65);
    assert.equal(active.duration_seconds, 120);
    fixture.media.paused = true;
    assert.equal(inspectDocument([fixture.origin])?.playing, false);
  });
});
void test('direct inspection does not read media or child frames on an unselected origin', () => {
  withProbeDocument((fixture) => {
    assert.equal(inspectDocument(['https://catalog.example']), null);
    assert.equal(fixture.reads, 0);
  });
});
