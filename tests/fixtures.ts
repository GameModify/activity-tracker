import { randomUUID } from 'node:crypto';
import type { Observation, Rule } from '../src/domain/contracts.ts';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
export const start = 1000000;
export function sample(offset = 0, patch: Partial<Observation> = {}): Observation {
  return {
    event_id: randomUUID(),
    channel: 'windows:focus',
    timestamp: start + offset,
    source: 'windows',
    kind: 'focus',
    app: 'Code.exe',
    title: 'Example project',
    url: '',
    active: true,
    playing: false,
    idle_ms: 0,
    ...patch,
  };
}
export function rule(patch: Partial<Rule> = {}): Rule {
  return {
    id: randomUUID(),
    name: 'Code',
    enabled: true,
    field: 'app',
    operator: 'equals',
    value: 'Code.exe',
    activity: 'coding',
    priority: 10,
    ...patch,
  };
}
export function withStore(operation: (store: SqliteStore) => void): void {
  const store = new SqliteStore(':memory:');
  try {
    operation(store);
  } finally {
    store.db.close();
  }
}
