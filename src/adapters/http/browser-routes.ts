import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import { browserPreferencesSchema } from '../../domain/contracts.ts';
import { browserPreferences, configureBrowser } from '../../application/browser-preferences.ts';
import type { TrackingRuntime } from '../../application/runtime.ts';
import { authorize } from './security.ts';
export function browserRoutes(app: Express, runtime: TrackingRuntime, ingestKey: string): void {
  app.get('/v1/browser-preferences', authorize(ingestKey), (_req, res) => {
    res.json(browserPreferences(runtime.store));
  });
  app.put('/v1/browser-preferences', authorize(ingestKey), (req, res) => {
    configureBrowser(runtime.store, browserPreferencesSchema.parse(req.body), randomUUID);
    res.json(browserPreferences(runtime.store));
  });
}
