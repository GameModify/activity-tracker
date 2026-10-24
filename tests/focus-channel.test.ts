import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withFocusBrowser } from './focus-channel-fixture.ts';
void test('background interaction heartbeats cannot close the active browser focus channel', () =>
  withFocusBrowser(async (fixture) => {
    fixture.tab.active = false;
    await fixture.post();
    assert.equal(fixture.samples.length, 0);
    fixture.tab.active = true;
    await fixture.post();
    assert.equal(fixture.samples.length, 1);
    assert.equal(fixture.samples[0]?.active, true);
    fixture.tab.active = false;
    await fixture.post();
    assert.equal(fixture.samples.length, 1);
  }));
void test('an inactive Chrome window cannot overwrite another windows active interaction', () =>
  withFocusBrowser(async (fixture) => {
    fixture.focused = false;
    await fixture.post();
    assert.equal(fixture.samples.length, 0);
    assert.ok(fixture.state);
  }));
