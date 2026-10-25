import { randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
const credentialsSchema = z.object({ read: z.string().length(64), ingest: z.string().length(64) });
export type Credentials = z.infer<typeof credentialsSchema>;
export function credentials(file: string): Credentials {
  if (existsSync(file)) return credentialsSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  const result = { read: randomBytes(32).toString('hex'), ingest: randomBytes(32).toString('hex') };
  writeFileSync(file, JSON.stringify(result, null, 2), { mode: 0o600, flag: 'wx' });
  return result;
}
function matches(value: string, expected: string): boolean {
  const actual = Buffer.from(value),
    secret = Buffer.from(expected);
  return actual.length === secret.length && timingSafeEqual(actual, secret);
}
export function authorize(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!matches(req.headers.authorization ?? '', 'Bearer ' + token)) {
      res.status(401).json({ error: 'Требуется ключ подключения' });
      return;
    }
    next();
  };
}
export function localOnly(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin;
  if (!allowedOrigin(req)) {
    res.status(403).json({ error: 'Только локальные клиенты' });
    return;
  }
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'authorization,content-type');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    res.status(204).end();
    return;
  }
  next();
}

function allowedOrigin(req: Request): boolean {
  const origin = req.headers.origin;
  return (
    req.hostname === '127.0.0.1' &&
    (!origin ||
      origin === 'http://' + (req.get('host') ?? '') ||
      /^chrome-extension:\/\/[a-p]{32}$/.test(origin))
  );
}
