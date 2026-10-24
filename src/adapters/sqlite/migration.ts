import type { DatabaseSync } from 'node:sqlite';
export function migrateIntervals(db: DatabaseSync): void {
  const columns = db
    .prepare('PRAGMA table_info(intervals)')
    .all()
    .map((row) => String(row.name));
  for (const column of ['app', 'resource_id', 'resource_kind'])
    if (!columns.includes(column))
      db.exec(
        'ALTER TABLE intervals ADD COLUMN ' +
          column +
          (column === 'app' ? " TEXT NOT NULL DEFAULT ''" : ' TEXT'),
      );
}

export function migrateRecording(db: DatabaseSync): void {
  const exists = db
    .prepare('PRAGMA table_info(open_channels)')
    .all()
    .some((row) => row.name === 'recording_at');
  if (!exists) db.exec('ALTER TABLE open_channels ADD COLUMN recording_at INTEGER');
}
