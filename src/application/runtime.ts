import { matchingRule } from '../domain/classify.ts';
import { assistantObservation, assistantTitle } from '../domain/assistant.ts';
import { desktopActivity } from './desktop-activity.ts';
import { GameActivity } from './game-activity.ts';
import { PlaybackMonitor } from './playback.ts';
import { closeAll, expire, ingest } from './ingest.ts';
import type { DesktopCollector, TrackingStore } from './ports.ts';
import type { Observation } from '../domain/contracts.ts';
export class TrackingRuntime {
  playback = new PlaybackMonitor();
  games = new GameActivity();
  paused: boolean;
  desktopAt: number | null = null;
  browserAt: number | null = null;
  browserVersion: string | null = null;
  browserFocus: Observation | undefined;
  desktopError = false;
  store: TrackingStore;
  collector: DesktopCollector | undefined;
  voiceCollector: DesktopCollector | undefined;
  foreground: Observation | undefined;
  constructor(
    store: TrackingStore,
    collector?: DesktopCollector,
    voiceCollector?: DesktopCollector,
  ) {
    this.store = store;
    this.collector = collector;
    this.voiceCollector = voiceCollector;
    this.paused = store.paused();
  }
  setPaused(paused: boolean): void {
    closeAll(this.store);
    this.playback.items.clear();
    this.games.reset();
    this.paused = paused;
    this.store.setPaused(paused);
  }
  accept(sample: Observation): void {
    if (this.paused) return;
    ingest(this.store, sample);
    this.playback.accept(sample);
    if (sample.source === 'chrome') {
      this.browserAt = sample.timestamp;
      if (sample.collector_version) this.browserVersion = sample.collector_version;
      if (sample.kind === 'focus') this.browserFocus = this.assistantContext(sample);
    }
  }
  tick(): void {
    expire(this.store, Date.now());
    if (this.paused) return;
    this.pollVoice();
    this.pollDesktop();
  }
  pollDesktop(): void {
    if (!this.collector) return;
    try {
      const observed = this.collector.sample();
      const sample = observed
        ? this.assistantContext(desktopActivity(observed, this.store.rules()))
        : undefined;
      if (sample) {
        this.foreground = sample;
        for (const observation of this.gameObservations(sample)) this.accept(observation);
        this.desktopAt = sample.timestamp;
      }
      this.desktopError = false;
    } catch {
      this.desktopError = true;
    }
  }
  gameObservations(sample: Observation): Observation[] {
    const pid = this.games.lastGame?.process_id;
    const running = pid === undefined ? true : (this.collector?.processRunning?.(pid) ?? true);
    return this.games.observe(sample, running);
  }
  pollVoice(): void {
    try {
      const sample = this.voiceCollector?.sample();
      if (sample) this.accept(sample);
    } catch {
      return;
    }
  }
  assistantContext(sample: Observation): Observation {
    const current = assistantObservation(sample);
    return {
      ...current,
      title: assistantTitle(current, matchingRule(current, this.store.rules())),
    };
  }
  assistant(): Observation | null {
    if (this.paused) return null;
    return (
      [this.foreground, this.browserFocus]
        .filter(
          (sample) =>
            sample &&
            sample.active &&
            Date.now() - sample.timestamp < 15000 &&
            /^(codex:desktop|chatgpt:)/.test(sample.resource_id ?? ''),
        )
        .sort((a, b) => (b?.timestamp ?? 0) - (a?.timestamp ?? 0))[0] ?? null
    );
  }
  foregroundRule() {
    if (!this.foreground || Date.now() - this.foreground.timestamp >= 15000) return null;
    return matchingRule(this.foreground, this.store.rules()) ?? null;
  }
  status() {
    return {
      api_version: 1,
      assistant: this.assistant(),
      game: this.paused ? null : (this.games.current ?? null),
      playback: this.playback.current(),
      foreground_rule: this.paused ? null : this.foregroundRule(),
      foreground: this.paused ? null : (this.foreground ?? null),
      voice: this.voiceCollector?.status?.() ?? { state: 'unknown', observed_at: 0 },
      device_id: this.store.deviceId(),
      paused: this.paused,
      desktop_available: Boolean(this.collector),
      desktop_error: this.desktopError,
      desktop_at: this.desktopAt,
      browser_at: this.browserAt,
      browser_version: this.browserVersion,
    };
  }
}
