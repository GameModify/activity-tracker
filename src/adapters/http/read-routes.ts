import type { Express } from 'express';
import { z } from 'zod';
import { ruleSchema } from '../../domain/contracts.ts';
import type { TrackingRuntime } from '../../application/runtime.ts';
const pageQuery = z.object({ cursor: z.coerce.number().int().nonnegative().default(0) });
export function readRoutes(app: Express, runtime: TrackingRuntime): void {
  app.get('/v1/status', (_req, res) => {
    res.json(runtime.status());
  });
  app.get('/v1/intervals', (req, res) => {
    const { cursor } = pageQuery.parse(req.query);
    const rows = runtime.store.intervals(cursor, 501),
      intervals = rows.slice(0, 500);
    res.json({
      api_version: 1,
      device_id: runtime.store.deviceId(),
      intervals,
      cursor: intervals.at(-1)?.sequence ?? cursor,
      has_more: rows.length > 500,
    });
  });
  app.get('/v1/rules', (_req, res) => {
    res.json(runtime.store.rules());
  });
}
export function controlRoutes(app: Express, runtime: TrackingRuntime): void {
  app.put('/v1/rules', (req, res) => {
    runtime.store.replaceRules(ruleSchema.array().max(200).parse(req.body));
    res.json({ ok: true });
  });
  app.post('/v1/pause', (req, res) => {
    runtime.setPaused(z.object({ paused: z.boolean() }).parse(req.body).paused);
    res.json(runtime.status());
  });
}
