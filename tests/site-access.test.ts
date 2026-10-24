import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingSites } from '../extension/site-access.ts';
import { withCollector } from './collector-fixture.ts';
void test('a browser permission alone does not enable collection for an unselected site', () =>
  withCollector(async (fixture) => {
    const site = 'https://video.example/*';
    fixture.allowed.add(site);
    assert.deepEqual(await pendingSites([site]), [site]);
    fixture.config.sites.push(site);
    assert.deepEqual(await pendingSites([site]), []);
    fixture.allowed.delete(site);
    assert.deepEqual(await pendingSites([site]), [site]);
  }));
