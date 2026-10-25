import { desktopDirectories } from './data-directories.ts';
import path from 'node:path';
import { homedir } from 'node:os';
import { isSea } from 'node:sea';
import { z } from 'zod';
const trackerPort = z.coerce.number().int().min(0).max(65535);
export interface ApplicationConfiguration {
  directory: string;
  legacyDirectory?: string;
  assets: string;
  port: number;
  desktop: boolean;
  website?: string;
}
export function applicationConfiguration(): ApplicationConfiguration {
  const root = isSea() ? path.dirname(process.execPath) : path.resolve(import.meta.dirname, '..');
  const data = desktopDirectories(
    homedir(),
    process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData/Local'),
  );
  const directory = isSea() ? data.directory : path.join(root, 'data');
  return {
    directory: path.resolve(process.env.TRACKER_DATA_DIR ?? directory),
    legacyDirectory: isSea() && !process.env.TRACKER_DATA_DIR ? data.legacyDirectory : undefined,
    assets: path.resolve(
      process.env.TRACKER_ASSETS_DIR ?? path.join(root, isSea() ? 'assets' : 'dist/assets'),
    ),
    port: trackerPort.parse(process.env.TRACKER_PORT ?? 3536),
    desktop: process.env.TRACKER_DESKTOP !== 'off',
    website: z.url().parse(process.env.TRACKER_SITE_URL ?? 'http://127.0.0.1:3535/'),
  };
}
