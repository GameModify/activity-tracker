import { DatabaseSync, backup } from 'node:sqlite';
import { copyFile, mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync, constants } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
const credentialsSchema = z.object({
  read: z.string().regex(/^[a-f0-9]{64}$/),
  ingest: z.string().regex(/^[a-f0-9]{64}$/),
});
interface LegacySnapshot {
  database: string;
  credentials: string;
}
export async function prepareDesktopData(
  directory: string,
  legacy: string | undefined,
  locate: (directory: string) => string,
): Promise<void> {
  if (!legacy || !existsSync(legacy)) return;
  const source = locate(legacy);
  if (!existsSync(path.join(source, 'activity.sqlite'))) return;
  await mkdir(directory, { recursive: true });
  const snapshot = await snapshotLegacy(directory, source);
  if (existsSync(path.join(directory, 'activity.sqlite'))) return;
  await installSnapshot(directory, snapshot);
}
async function snapshotLegacy(directory: string, source: string): Promise<LegacySnapshot> {
  const folder = path.join(directory, 'legacy-backups');
  await mkdir(folder, { recursive: true });
  const id = createHash('sha256').update(source.toLowerCase()).digest('hex').slice(0, 16);
  const target = path.join(folder, id + '.sqlite');
  const db = new DatabaseSync(path.join(source, 'activity.sqlite'), { readOnly: true });
  try {
    await backup(db, target);
  } finally {
    db.close();
  }
  checkedDatabase(target);
  const credentials = path.join(folder, id + '.credentials.json');
  const keys = credentialsSchema.parse(
    JSON.parse(await readFile(path.join(source, 'credentials.json'), 'utf8')),
  );
  await writeFile(credentials, JSON.stringify(keys), { mode: 0o600 });
  return { database: target, credentials };
}
function checkedDatabase(file: string): void {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const rows = z
      .object({ quick_check: z.literal('ok') })
      .array()
      .length(1);
    rows.parse(db.prepare('PRAGMA quick_check').all());
  } finally {
    db.close();
  }
}
async function installSnapshot(directory: string, snapshot: LegacySnapshot): Promise<void> {
  const credentials = path.join(directory, 'credentials.json');
  if (existsSync(credentials)) await verifyKeys(credentials, snapshot.credentials);
  else await copyFile(snapshot.credentials, credentials, constants.COPYFILE_EXCL);
  const temporary = path.join(directory, '.migration.sqlite');
  await copyFile(snapshot.database, temporary);
  await rename(temporary, path.join(directory, 'activity.sqlite'));
}
async function verifyKeys(actual: string, expected: string): Promise<void> {
  const current = credentialsSchema.parse(JSON.parse(await readFile(actual, 'utf8')));
  const original = credentialsSchema.parse(JSON.parse(await readFile(expected, 'utf8')));
  if (current.read !== original.read || current.ingest !== original.ingest)
    throw new Error('Папка миграции содержит другие ключи без базы');
}
