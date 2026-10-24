import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCollector } from './collector-fixture.ts';
import { focusObservation } from '../extension/focus-observation.ts';
import { isTracked } from '../src/domain/classify.ts';
const url = 'https://chatgpt.com/c/ordinary';
void test('reading an active ChatGPT tab starts without demanding the first page click', () =>
  withCollector(async (fixture) => {
    fixture.tab.url = url;
    fixture.config.interaction_sites = ['https://chatgpt.com/*'];
    fixture.allowed.add('https://chatgpt.com/*');
    fixture.interactionState = {
      type: 'interaction',
      url,
      interaction_at: 0,
      focused: true,
      observed_at: Date.now(),
    };
    assert.equal(isTracked(await focusObservation(fixture.tab, true)), true);
    fixture.idleState = 'idle';
    assert.equal(isTracked(await focusObservation(fixture.tab, true)), false);
    fixture.idleState = 'active';
    assert.equal(isTracked(await focusObservation(fixture.tab, false)), false);
  }));
void test('ChatGPT uses actual page interaction after it is available and ignores stale project metadata', () =>
  withCollector(async (fixture) => {
    fixture.tab.url = url;
    fixture.config.interaction_sites = ['https://chatgpt.com/*'];
    fixture.allowed.add('https://chatgpt.com/*');
    fixture.interactionState = {
      type: 'interaction',
      url,
      interaction_at: Date.now() - 300001,
      focused: true,
      observed_at: Date.now(),
    };
    assert.equal(isTracked(await focusObservation(fixture.tab, true)), false);
    fixture.interactionState.url = 'https://chatgpt.com/c/previous';
    const changed = await focusObservation(fixture.tab, true);
    assert.equal(changed.chatgpt_project, undefined);
    assert.equal(isTracked(changed), true);
  }));
