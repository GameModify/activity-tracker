import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCollector } from './collector-fixture.ts';
import { registerYouTube, inspectYouTube } from '../extension/youtube-registration.ts';
import { allSites } from '../extension/sites.ts';
void test('the category UI has an independent top-frame registration limited to permitted YouTube hosts', () =>
  withCollector(async (fixture) => {
    fixture.config.sites = [...allSites];
    for (const site of allSites) fixture.allowed.add(site);
    await registerYouTube();
    const script = fixture.scripting.scripts[0];
    assert.ok(script);
    assert.deepEqual(script.matches, ['https://www.youtube.com/*', 'https://youtube.com/*']);
    assert.equal(script.allFrames, false);
    assert.deepEqual(script.js, [
      'collectors/test/content-diagnostics.js',
      'collectors/test/youtube-content.js',
    ]);
    fixture.config.media_exclusions = ['https://www.youtube.com/*'];
    await registerYouTube();
    assert.deepEqual(fixture.scripting.scripts[0]?.matches, ['https://youtube.com/*']);
  }));
void test('disabled collection removes the UI registration and cannot inject it into another site', () =>
  withCollector(async (fixture) => {
    fixture.config.sites = ['https://www.youtube.com/*'];
    fixture.allowed.add('https://www.youtube.com/*');
    await inspectYouTube(fixture.tab.id);
    assert.equal(fixture.scripting.injections.length, 0);
    await registerYouTube();
    fixture.config.enabled = false;
    await registerYouTube();
    assert.deepEqual(fixture.scripting.scripts, []);
  }));
