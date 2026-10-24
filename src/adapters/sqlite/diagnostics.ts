import type { DatabaseSync } from 'node:sqlite';
import { collectorDiagnosticSchema } from '../../domain/contracts.ts';
import type { CollectorDiagnostic } from '../../domain/contracts.ts';
export function initializeDiagnostics(db: DatabaseSync): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS collector_diagnostics (id TEXT PRIMARY KEY,timestamp INTEGER,severity TEXT,version TEXT,message TEXT,script TEXT,origin TEXT,line INTEGER,column INTEGER)',
  );
}
export function saveDiagnostic(db: DatabaseSync, item: CollectorDiagnostic): void {
  db.prepare(
    'INSERT OR REPLACE INTO collector_diagnostics VALUES (@id,@timestamp,@severity,@version,@message,@script,@origin,@line,@column)',
  ).run({ ...item });
  db.exec(
    'DELETE FROM collector_diagnostics WHERE id NOT IN (SELECT id FROM collector_diagnostics ORDER BY timestamp DESC LIMIT 100)',
  );
}
export function readDiagnostics(db: DatabaseSync): CollectorDiagnostic[] {
  return collectorDiagnosticSchema
    .array()
    .parse(
      db.prepare('SELECT * FROM collector_diagnostics ORDER BY timestamp DESC LIMIT 100').all(),
    );
}
