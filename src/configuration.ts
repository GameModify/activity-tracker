import path from 'node:path';
import { homedir } from 'node:os';
import { isSea } from 'node:sea';
import { z } from 'zod';
export interface ApplicationConfiguration {
  directory: string;
  assets: string;
  port: number;
  desktop: boolean;
  website?: string;
}
export function applicationConfiguration(): ApplicationConfiguration {
  const root = isSea() ? path.dirname(process.execPath) : path.resolve(import.meta.dirname, '..');
  const data = dataDirectory(root);
  return {
    directory: path.resolve(process.env.TRACKER_DATA_DIR ?? data),
    assets: path.resolve(
      process.env.TRACKER_ASSETS_DIR ?? path.join(root, isSea() ? 'assets' : 'dist/assets'),
    ),
    port: z.coerce
      .number()
      .int()
      .min(0)
      .max(65535)
      .parse(process.env.TRACKER_PORT ?? 3536),
    desktop: process.env.TRACKER_DESKTOP !== 'off',
    website: z.url().parse(process.env.TRACKER_SITE_URL ?? 'http://127.0.0.1:3535/'),
  };
}

function dataDirectory(root: string): string {
  return isSea()
    ? path.join(
        process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local'),
        'ActivityTracker',
      )
    : path.join(root, 'data');
}
