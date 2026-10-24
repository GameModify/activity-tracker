import { z } from 'zod';
import type { DatabaseSync } from 'node:sqlite';
import { contentLabelSchema } from '../../domain/contracts.ts';
import type { ContentLabel } from '../../domain/contracts.ts';
export function initializeLabels(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS content_label_aliases (label_id TEXT NOT NULL, activity TEXT NOT NULL)',
  );
  db.exec(
    'CREATE TABLE IF NOT EXISTS content_labels (id TEXT PRIMARY KEY,name TEXT NOT NULL,activity TEXT NOT NULL,color TEXT NOT NULL)',
  );
}
export function readLabels(db: DatabaseSync): ContentLabel[] {
  const aliases = z
    .object({ label_id: z.string(), activity: z.string() })
    .array()
    .parse(db.prepare('SELECT * FROM content_label_aliases').all());
  return contentLabelSchema
    .array()
    .parse(db.prepare('SELECT * FROM content_labels ORDER BY rowid').all())
    .map((label) => ({
      ...label,
      aliases: aliases.filter((item) => item.label_id === label.id).map((item) => item.activity),
    }));
}
export function writeLabels(db: DatabaseSync, labels: ContentLabel[]): void {
  db.exec('DELETE FROM content_labels; DELETE FROM content_label_aliases');
  const insert = db.prepare('INSERT INTO content_labels VALUES (@id,@name,@activity,@color)');
  const alias = db.prepare('INSERT INTO content_label_aliases VALUES (?,?)');
  for (const label of labels) {
    const { aliases, ...row } = label;
    insert.run(row);
    for (const activity of aliases) alias.run(label.id, activity);
  }
}
