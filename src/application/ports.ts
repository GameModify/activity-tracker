import type {
  ContentLabel,
  ActivityInterval,
  Observation,
  Rule,
  CollectorDiagnostic,
} from '../domain/contracts.ts';
import type { TrackingPreferences } from '../domain/preferences.ts';
export interface OpenChannel {
  channel: string;
  interval_id: string;
  last_at: number;
  recording_at?: number;
  signature: string;
}
export interface TrackingStore {
  preferences(): TrackingPreferences;
  setPreferences(value: TrackingPreferences): void;
  labels(): ContentLabel[];
  replaceLabels(labels: ContentLabel[]): void;
  recordDiagnostic(item: CollectorDiagnostic): void;
  diagnostics(): CollectorDiagnostic[];
  deviceId(): string;
  paused(): boolean;
  setPaused(value: boolean): void;
  channels(): OpenChannel[];
  rules(): Rule[];
  replaceRules(rules: Rule[]): void;
  lastObserved(channel: string): number;
  observeAt(channel: string, timestamp: number): void;
  hasEvent(id: string): boolean;
  rememberEvent(id: string, timestamp: number): void;
  channel(id: string): OpenChannel | undefined;
  open(channel: OpenChannel): void;
  close(channel: string): void;
  save(interval: ActivityInterval): void;
  get(id: string): ActivityInterval | undefined;
  nextSequence(): number;
  intervals(cursor: number, limit: number): ActivityInterval[];
  atomic<T>(operation: () => T): T;
}
export interface DesktopCollector {
  subscribe?(listener: (sample: Observation) => void): () => void;
  processRunning?(pid: number): boolean;
  sample(): Observation | undefined;
  status?(): { state: 'connected' | 'disconnected' | 'unknown'; observed_at: number };
}
