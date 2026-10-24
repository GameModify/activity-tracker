import { once } from 'node:events';
import type { Server } from 'node:http';
import { SqliteStore } from '../src/adapters/sqlite/store.ts';
import { TrackingRuntime } from '../src/application/runtime.ts';
import { createHttpApp } from '../src/adapters/http/routes.ts';
export const keys = { read: 'a'.repeat(64), ingest: 'b'.repeat(64) };
export interface ApiFixture {
  server: Server;
  base: string;
  runtime: TrackingRuntime;
  store: SqliteStore;
}
export async function withApi(operation: (api: ApiFixture) => Promise<void>): Promise<void> {
  const store = new SqliteStore(':memory:'),
    runtime = new TrackingRuntime(store);
  const server = createHttpApp(runtime, keys).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing address');
  try {
    await operation({ store, runtime, server, base: 'http://127.0.0.1:' + String(address.port) });
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
    store.db.close();
  }
}
