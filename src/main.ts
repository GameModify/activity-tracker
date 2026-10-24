import path from 'node:path';
import { DesktopProbe } from './adapters/windows/desktop-probe.ts';
import { discordCollector } from './adapters/windows/discord.ts';
import { mkdirSync } from 'node:fs';
import { z } from 'zod';
import { SqliteStore } from './adapters/sqlite/store.ts';
import { credentials } from './adapters/http/security.ts';
import { createHttpApp } from './adapters/http/routes.ts';
import { windowsCollector } from './adapters/windows/collector.ts';
import { TrackingRuntime } from './application/runtime.ts';
const directory = path.resolve(
  process.env.TRACKER_DATA_DIR ?? path.join(import.meta.dirname, '../data'),
);
mkdirSync(directory, { recursive: true });
const store = new SqliteStore(path.join(directory, 'activity.sqlite'));
store.seedRules();
const keys = credentials(path.join(directory, 'credentials.json'));
const probe = new DesktopProbe();
if (process.env.TRACKER_DESKTOP !== 'off') probe.start();
const collector = process.env.TRACKER_DESKTOP === 'off' ? undefined : await windowsCollector(probe);
const runtime = new TrackingRuntime(
  store,
  collector,
  process.env.TRACKER_DESKTOP === 'off' ? undefined : discordCollector(probe),
);
const port = z.coerce
  .number()
  .int()
  .min(0)
  .max(65535)
  .parse(process.env.TRACKER_PORT ?? 3536);
const server = createHttpApp(runtime, keys).listen(port, '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address === 'object')
    console.log('Activity Tracker: http://127.0.0.1:' + String(address.port));
});
const timer = setInterval(() => {
  runtime.tick();
}, 5000);
runtime.tick();
function shutdown(): void {
  clearInterval(timer);
  probe.stop();
  server.close(() => {
    store.db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
