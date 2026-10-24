import { withPermissions } from './permissions-fixture.ts';
import { grantAllSites, setCollection, revokeSite } from '../extension/site-controls.ts';
import { focusObservation } from '../extension/focus-observation.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withCollector } from './collector-fixture.ts';
import { restoreMedia } from '../extension/collector-runtime.ts';
import { selectedSite } from '../extension/site-selection.ts';
import { allSites } from '../extension/sites.ts';
void test('all-sites collection registers global origins and independent exceptions', () =>
  withCollector(async (fixture) => {
    fixture.config.sites = [...allSites];
    fixture.config.interaction_sites = [...allSites];
    fixture.config.media_exclusions = ['https://private.example/*'];
    for (const site of allSites) fixture.allowed.add(site);
    await restoreMedia();
    assert.equal(selectedSite(fixture.config, 'sites', 'https://private.example/movie'), false);
    assert.equal(
      selectedSite(fixture.config, 'interaction_sites', 'https://private.example/'),
      true,
    );
    assert.equal(selectedSite(fixture.config, 'sites', 'https://new-player.example/'), true);
    assert.equal(selectedSite(fixture.config, 'sites', 'chrome://extensions'), false);
    assert.deepEqual(
      fixture.scripting.scripts.find((script) => script.id === 'media')?.excludeMatches,
      fixture.config.media_exclusions,
    );
  }));

void test('granting all sites again preserves specific exclusions and clears only a global revocation', () =>
  withPermissions(async (fixture) => {
    await grantAllSites();
    await setCollection('https://private.example/*', 'sites', false);
    await revokeSite('https://*/*');
    await grantAllSites();
    assert.equal(selectedSite(fixture.config, 'sites', 'https://private.example/'), false);
    assert.equal(selectedSite(fixture.config, 'sites', 'https://new.example/'), true);
    assert.equal(
      selectedSite(fixture.config, 'interaction_sites', 'https://private.example/'),
      true,
    );
  }));
void test('concurrent permission edits preserve both independent exclusions', () =>
  withPermissions(async (fixture) => {
    await grantAllSites();
    await Promise.all([
      setCollection('https://one.example/*', 'sites', false),
      setCollection('https://two.example/*', 'sites', false),
    ]);
    assert.equal(selectedSite(fixture.config, 'sites', 'https://one.example/'), false);
    assert.equal(selectedSite(fixture.config, 'sites', 'https://two.example/'), false);
  }));
void test('an excluded action site cannot keep focus tracking or transmit its page details', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_exclusions = ['https://vk.ru/*'];
    const observation = await focusObservation(fixture.tab, true);
    assert.equal(observation.active, false);
    assert.equal(observation.url, '');
    assert.equal(observation.title, '');
  }));
