import { labelReadRoutes, labelWriteRoutes } from './content-labels.ts';
import express from 'express';
import { browserRoutes } from './browser-routes.ts';
import type { Request, Response, NextFunction } from 'express';
import { observationSchema, collectorDiagnosticSchema } from '../../domain/contracts.ts';
import type { TrackingRuntime } from '../../application/runtime.ts';
import type { Credentials } from './security.ts';
import { authorize, localOnly } from './security.ts';
import { controlRoutes, readRoutes } from './read-routes.ts';
function acceptBrowser(req: Request, runtime: TrackingRuntime): void {
  const samples = observationSchema.array().min(1).max(40).parse(req.body);
  for (const sample of samples) {
    if (sample.source !== 'chrome' || !sample.channel.startsWith('chrome:'))
      throw new Error('Invalid source');
    if (sample.timestamp > Date.now() + 2000 || sample.timestamp < Date.now() - 3600000)
      throw new Error('Expired observation');
  }
  for (const sample of samples) runtime.accept(sample);
}
function ingestionRoutes(app: express.Express, runtime: TrackingRuntime, keys: Credentials): void {
  app.get('/health', (_req, res) => {
    res.json({ ok: true, api_version: 1 });
  });
  app.post('/v1/diagnostics', authorize(keys.ingest), (req, res) => {
    const diagnostic = collectorDiagnosticSchema.parse(req.body);
    runtime.store.recordDiagnostic(diagnostic);
    res.json({ ok: true });
  });
  app.post('/v1/observations', authorize(keys.ingest), (req, res) => {
    acceptBrowser(req, runtime);
    res.status(202).json({ ok: true, paused: runtime.paused });
  });
}
function errors(app: express.Express): void {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Unknown endpoint' });
  });
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    res.status(400).json({ error: 'Некорректный запрос' });
  });
}
export function createHttpApp(runtime: TrackingRuntime, keys: Credentials): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(localOnly);
  app.use(express.json({ limit: '256kb', strict: true }));
  app.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  ingestionRoutes(app, runtime, keys);
  browserRoutes(app, runtime, keys.ingest);
  labelReadRoutes(app, runtime, keys.ingest);
  app.use('/v1', authorize(keys.read));
  readRoutes(app, runtime);
  controlRoutes(app, runtime);
  labelWriteRoutes(app, runtime);
  errors(app);
  return app;
}
