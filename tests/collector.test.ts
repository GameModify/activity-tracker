import type { CollectorState } from '../extension/collector-client.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  restoreMedia,
  installCollector,
  collectorCommand,
} from '../extension/collector-runtime.ts';
import { withCollector } from './collector-fixture.ts';
void test('reload restores cleared dynamic scripts from already granted sites without another permission prompt', () =>
  withCollector(async (fixture) => {
    assert.equal((await restoreMedia()).collector_ready, true);
    fixture.scripting.scripts = [];
    const restored = await restoreMedia();
    assert.deepEqual(restored.registered_sites, fixture.config.sites);
    assert.deepEqual(fixture.scripting.scripts[0]?.matches, fixture.config.sites);
    assert.equal(fixture.scripting.scripts[0].allFrames, true);
    assert.equal(fixture.scripting.scripts[0].matchOriginAsFallback, true);
  }));
void test('startup, install and permission changes all reconcile the collector', () =>
  withCollector(async (fixture) => {
    installCollector();
    await restoreMedia();
    assert.equal(fixture.installed.listeners.length, 1);
    assert.equal(fixture.startup.listeners.length, 1);
    assert.equal(fixture.added.listeners.length, 1);
    assert.equal(fixture.removed.listeners.length, 1);
    fixture.scripting.scripts = [];
    fixture.installed.fire();
    await restoreMedia();
    assert.equal(fixture.scripting.scripts.length, 1);
  }));
void test('revoked permissions and disabled collection remove script access without broadening it', () =>
  withCollector(async (fixture) => {
    await restoreMedia();
    fixture.allowed.delete('https://player.example/*');
    assert.deepEqual((await restoreMedia()).registered_sites, ['https://catalog.example/*']);
    fixture.config.enabled = false;
    assert.deepEqual((await restoreMedia()).registered_sites, []);
    assert.deepEqual(fixture.scripting.scripts, []);
  }));
void test('failed script registration is exposed instead of an endless waiting message', () =>
  withCollector(async (fixture) => {
    fixture.scripting.failure = 'Cannot register content script';
    const result = await restoreMedia();
    assert.equal(result.collector_ready, false);
    assert.equal(result.collector_error, 'Cannot register content script');
    assert.equal(fixture.state.collector_error, result.collector_error);
  }));
void test('concurrent reconciliation requests preserve newly saved sites and cannot register duplicate IDs', () =>
  withCollector(async (fixture) => {
    fixture.config.sites = ['https://catalog.example/*'];
    const initial = restoreMedia();
    await initial;
    fixture.config.sites.push('https://player.example/*');
    const results = await Promise.all([restoreMedia(), restoreMedia()]);
    assert.ok(results.every((result) => result.collector_ready));
    assert.deepEqual(fixture.scripting.scripts[0]?.matches, fixture.config.sites);
  }));
void test('collector commands reject messages from unrelated extensions', () =>
  withCollector(async () => {
    let replied = false;
    const accepted = collectorCommand({ type: 'restore-media' }, { id: 'other' }, () => {
      replied = true;
    });
    assert.equal(accepted, false);
    assert.equal(replied, false);
    await restoreMedia();
  }));

void test('collector command keeps the reply channel open until registration finishes', () =>
  withCollector(async (fixture) => {
    const result = await new Promise<CollectorState>((reply) => {
      assert.equal(
        collectorCommand(
          { type: 'restore-media' },
          { id: 'test-extension', url: 'chrome-extension://test-extension/options.html' },
          reply,
        ),
        true,
      );
    });
    assert.equal(result.collector_ready, true);
    assert.deepEqual(result.registered_sites, fixture.config.sites);
  }));

void test('a content page cannot issue control commands using the extensions own sender ID', () =>
  withCollector(async () => {
    const sender = { id: 'test-extension', url: 'https://catalog.example/series/1' };
    const accepted = collectorCommand({ type: 'restore-media' }, sender, () => {
      assert.fail('Content page must not receive a collector control reply');
    });
    assert.equal(accepted, false);
    await restoreMedia();
  }));

void test('interaction permissions register independently and revocation keeps media collection', () =>
  withCollector(async (fixture) => {
    fixture.config.interaction_sites = ['https://vk.com/*'];
    fixture.allowed.add('https://vk.com/*');
    await restoreMedia();
    assert.deepEqual(
      fixture.scripting.scripts.map((script) => script.id),
      ['media', 'interaction'],
    );
    fixture.allowed.delete('https://vk.com/*');
    await restoreMedia();
    assert.deepEqual(
      fixture.scripting.scripts.map((script) => script.id),
      ['media'],
    );
  }));
