import { test } from 'node:test';
import assert from 'node:assert/strict';
import { discordEvidenceSchema } from '../src/adapters/windows/discord-state.ts';
void test('Discord connection requires its disconnect control and rejects reconnecting or unknown UI', () => {
  const available = { available: true, disconnect: false, reconnect: false };
  assert.equal(discordEvidenceSchema.parse(available).state, 'unknown');
  assert.equal(discordEvidenceSchema.parse({ ...available, disconnect: true }).state, 'connected');
  assert.equal(
    discordEvidenceSchema.parse({ ...available, reconnect: true }).state,
    'disconnected',
  );
  assert.equal(
    discordEvidenceSchema.parse({ ...available, disconnect: true, reconnect: true }).state,
    'disconnected',
  );
  assert.equal(
    discordEvidenceSchema.parse({ ...available, available: false }).state,
    'disconnected',
  );
});
