import path from 'node:path';
import express from 'express';
import type { Express } from 'express';
import type { Credentials } from './security.ts';
import { authorize } from './security.ts';
export interface ControlConfiguration {
  assets: string;
  directory: string;
}
export function controlPanelRoutes(
  app: Express,
  keys: Credentials,
  config?: ControlConfiguration,
): void {
  if (!config) return;
  controlFiles(app, config.assets);
  app.get('/v1/connection', authorize(keys.read), (req, res) => {
    res.json({
      endpoint: 'http://' + (req.get('host') ?? '127.0.0.1:3536'),
      read: keys.read,
      ingest: keys.ingest,
      directory: config.directory,
    });
  });
}

function controlFiles(app: Express, assets: string): void {
  app.use(
    '/control',
    express.static(path.join(assets, 'control'), {
      setHeaders: (res) => {
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
        );
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Content-Type-Options', 'nosniff');
      },
    }),
  );
}
