import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import {
  contentLabelSchema,
  videoIdentitySchema,
  videoChoiceSchema,
} from '../../domain/contracts.ts';
import type { TrackingRuntime } from '../../application/runtime.ts';
import { videoLabels, chooseVideo } from '../../application/content-labels.ts';
import { authorize } from './security.ts';
export function labelReadRoutes(app: Express, runtime: TrackingRuntime, ingest: string): void {
  app.get('/v1/video-labels', authorize(ingest), (req, res) => {
    res.json(videoLabels(runtime.store, videoIdentitySchema.parse(req.query)));
  });
  app.post('/v1/video-labels', authorize(ingest), (req, res) => {
    res.json(chooseVideo(runtime.store, videoChoiceSchema.parse(req.body), randomUUID));
  });
}
export function labelWriteRoutes(app: Express, runtime: TrackingRuntime): void {
  app.put('/v1/content-labels', (req, res) => {
    const labels = contentLabelSchema.array().max(200).parse(req.body);
    if (new Set(labels.map((label) => label.id)).size !== labels.length)
      throw new Error('Повторяющиеся категории');
    runtime.store.replaceLabels(labels);
    res.json({ ok: true });
  });
}
