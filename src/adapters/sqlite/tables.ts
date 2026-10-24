export const schemaSql = [
  'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;',
  'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);',
  'CREATE TABLE IF NOT EXISTS rules (id TEXT PRIMARY KEY,name TEXT,enabled INTEGER,field TEXT,operator TEXT,value TEXT,activity TEXT,priority INTEGER);',
  'CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,timestamp INTEGER NOT NULL);',
  'CREATE TABLE IF NOT EXISTS counter (value INTEGER NOT NULL);',
  'INSERT INTO counter SELECT 0 WHERE NOT EXISTS (SELECT 1 FROM counter);',
  'CREATE TABLE IF NOT EXISTS intervals (id TEXT PRIMARY KEY,sequence INTEGER UNIQUE,channel TEXT,source TEXT,activity TEXT,title TEXT,start_at INTEGER,end_at INTEGER,rule_id TEXT,closed INTEGER NOT NULL);',
  'CREATE INDEX IF NOT EXISTS interval_sequence ON intervals(sequence);',
  'CREATE TABLE IF NOT EXISTS open_channels (channel TEXT PRIMARY KEY,interval_id TEXT,last_at INTEGER,signature TEXT);',
].join('\n');
