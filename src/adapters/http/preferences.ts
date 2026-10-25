import type { Express } from 'express';
import { trackingPreferencesSchema } from '../../domain/preferences.ts';
import type { TrackingRuntime } from '../../application/runtime.ts';
export function preferenceRoutes(app: Express, runtime: TrackingRuntime): void {
  app.get('/v1/preferences', (_req, res) => {
    res.json(runtime.store.preferences());
  });
  app.post('/v1/preferences', (req, res) => {
    const input = trackingPreferencesSchema.parse(req.body);
    runtime.store.setPreferences(input);
    res.json(input);
  });
}
