import { trackingPreferencesSchema } from '../../domain/preferences.ts';
import type { TrackingPreferences } from '../../domain/preferences.ts';
import { initializeLabels, readLabels, writeLabels } from './content-labels.ts';
import type { ContentLabel } from '../../domain/contracts.ts';
import { initializeDiagnostics, saveDiagnostic, readDiagnostics } from './diagnostics.ts';
import type { CollectorDiagnostic } from '../../domain/contracts.ts';
import { migrateIntervals, migrateRecording, migrateRules } from './migration.ts';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { intervalSchema, ruleSchema } from '../../domain/contracts.ts';
import type { ActivityInterval, Rule } from '../../domain/contracts.ts';
import type { OpenChannel, TrackingStore } from '../../application/ports.ts';
import { schemaSql } from './tables.ts';
import { defaultRules } from '../../domain/default-rules.ts';
const openSchema = z.object({
  channel: z.string(),
  interval_id: z.uuid(),
  last_at: z.number(),
  recording_at: z
    .number()
    .nullish()
    .transform((value) => value ?? undefined),
  signature: z.string(),
});
const storedInterval = intervalSchema.extend({
  media_creator: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  media_id: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  website: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  project: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined),
  closed: z.union([z.literal(0), z.literal(1)]),
  resource_id: z
    .string()
    .nullable()
    .transform((value) => value ?? undefined),
  resource_kind: intervalSchema.shape.resource_kind
    .nullable()
    .transform((value) => value ?? undefined),
});
function decode(row: object): ActivityInterval {
  const item = storedInterval.parse(row);
  return { ...item, closed: Boolean(item.closed) };
}
export class SqliteStore implements TrackingStore {
  db: DatabaseSync;
  constructor(file: string) {
    this.db = new DatabaseSync(file);
    this.db.exec(schemaSql);
    migrateIntervals(this.db);
    migrateRecording(this.db);
    migrateRules(this.db);
    initializeDiagnostics(this.db);
    initializeLabels(this.db);
    this.db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run('device_id', randomUUID());
  }
  lastObserved(channel: string): number {
    const row = this.db
      .prepare('SELECT timestamp FROM observation_clocks WHERE channel=?')
      .get(channel);
    return row ? z.number().parse(row.timestamp) : (this.channel(channel)?.last_at ?? 0);
  }
  observeAt(channel: string, timestamp: number): void {
    this.db
      .prepare(
        'INSERT INTO observation_clocks VALUES (?,?) ON CONFLICT(channel) DO UPDATE SET timestamp=excluded.timestamp',
      )
      .run(channel, timestamp);
  }
  labels(): ContentLabel[] {
    return readLabels(this.db);
  }
  replaceLabels(labels: ContentLabel[]): void {
    this.atomic(() => {
      writeLabels(this.db, labels);
    });
  }
  recordDiagnostic(item: CollectorDiagnostic): void {
    saveDiagnostic(this.db, item);
  }
  diagnostics(): CollectorDiagnostic[] {
    return readDiagnostics(this.db);
  }
  seedRules(): void {
    if (this.db.prepare('SELECT 1 FROM settings WHERE key=?').get('seeded')) return;
    this.replaceRules(defaultRules(randomUUID));
    this.db.prepare('INSERT INTO settings VALUES (?,?)').run('seeded', 'true');
  }
  preferences(): TrackingPreferences {
    const row = this.db.prepare('SELECT value FROM settings WHERE key=?').get('idle_timeout_ms');
    return trackingPreferencesSchema.parse(row ? { idle_timeout_ms: Number(row.value) } : {});
  }
  setPreferences(value: TrackingPreferences): void {
    this.db
      .prepare('INSERT OR REPLACE INTO settings VALUES (?,?)')
      .run('idle_timeout_ms', String(value.idle_timeout_ms));
  }
  paused(): boolean {
    return (
      this.db.prepare('SELECT value FROM settings WHERE key=?').get('paused')?.value === 'true'
    );
  }
  setPaused(value: boolean): void {
    this.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run('paused', String(value));
  }
  channels(): OpenChannel[] {
    return openSchema.array().parse(this.db.prepare('SELECT * FROM open_channels').all());
  }
  deviceId(): string {
    return z
      .object({ value: z.uuid() })
      .parse(this.db.prepare('SELECT value FROM settings WHERE key=?').get('device_id')).value;
  }
  rules(): Rule[] {
    return ruleSchema.array().parse(
      this.db
        .prepare('SELECT * FROM rules ORDER BY priority DESC,id')
        .all()
        .map((row) => ({
          ...row,
          enabled: Boolean(row.enabled),
          scope: row.scope ?? undefined,
          project: row.project ?? undefined,
        })),
    );
  }
  replaceRules(rules: Rule[]): void {
    this.atomic(() => {
      this.db.exec('DELETE FROM rules');
      const insert = this.db.prepare(
        'INSERT INTO rules (id,name,enabled,field,operator,value,activity,priority,scope,project) VALUES (@id,@name,@enabled,@field,@operator,@value,@activity,@priority,@scope,@project)',
      );
      for (const rule of rules)
        insert.run({
          ...rule,
          enabled: Number(rule.enabled),
          scope: rule.scope ?? null,
          project: rule.project ?? null,
        });
    });
  }
  hasEvent(id: string): boolean {
    return Boolean(this.db.prepare('SELECT 1 FROM events WHERE id=?').get(id));
  }
  rememberEvent(id: string, timestamp: number): void {
    this.db.prepare('INSERT INTO events VALUES (?,?)').run(id, timestamp);
  }
  channel(id: string): OpenChannel | undefined {
    const row = this.db.prepare('SELECT * FROM open_channels WHERE channel=?').get(id);
    return row ? openSchema.parse(row) : undefined;
  }
  open(channel: OpenChannel): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO open_channels (channel,interval_id,last_at,signature,recording_at) VALUES (@channel,@interval_id,@last_at,@signature,@recording_at)',
      )
      .run({ ...channel, recording_at: channel.recording_at ?? null });
  }
  close(channel: string): void {
    this.db.prepare('DELETE FROM open_channels WHERE channel=?').run(channel);
  }
  save(interval: ActivityInterval): void {
    this.db
      .prepare(
        'INSERT OR REPLACE INTO intervals (id,sequence,channel,source,activity,title,start_at,end_at,rule_id,closed,app,resource_id,resource_kind,website,project,media_creator,media_id) VALUES (@id,@sequence,@channel,@source,@activity,@title,@start_at,@end_at,@rule_id,@closed,@app,@resource_id,@resource_kind,@website,@project,@media_creator,@media_id)',
      )
      .run({
        ...interval,
        closed: Number(interval.closed),
        media_creator: interval.media_creator ?? null,
        media_id: interval.media_id ?? null,
        website: interval.website ?? null,
        project: interval.project ?? null,
        app: interval.app ?? '',
        resource_id: interval.resource_id ?? null,
        resource_kind: interval.resource_kind ?? null,
      });
  }
  get(id: string): ActivityInterval | undefined {
    const row = this.db.prepare('SELECT * FROM intervals WHERE id=?').get(id);
    return row ? decode(row) : undefined;
  }
  nextSequence(): number {
    this.db.exec('UPDATE counter SET value=value+1');
    return z.object({ value: z.number() }).parse(this.db.prepare('SELECT value FROM counter').get())
      .value;
  }
  intervals(cursor: number, limit: number): ActivityInterval[] {
    return this.db
      .prepare('SELECT * FROM intervals WHERE sequence>? ORDER BY sequence LIMIT ?')
      .all(cursor, limit)
      .map(decode);
  }
  atomic<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
