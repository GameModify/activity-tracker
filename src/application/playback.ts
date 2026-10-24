import type { Observation } from '../domain/contracts.ts';
export type PlaybackState = Pick<
  Observation,
  'channel' | 'title' | 'playing' | 'position_seconds' | 'duration_seconds'
> & { observed_at: number };
export class PlaybackMonitor {
  items = new Map<string, PlaybackState>();
  accept(sample: Observation): void {
    if (sample.source !== 'chrome' || sample.kind !== 'media') return;
    if ((this.items.get(sample.channel)?.observed_at ?? 0) >= sample.timestamp) return;
    this.items.delete(sample.channel);
    if (!sample.media_count && !sample.playing) return;
    this.items.set(sample.channel, {
      channel: sample.channel,
      title: sample.title,
      playing: sample.playing,
      observed_at: sample.timestamp,
      position_seconds: sample.position_seconds,
      duration_seconds: sample.duration_seconds,
    });
    if (this.items.size > 100) this.items.delete(this.items.keys().next().value ?? '');
  }
  current(now = Date.now()): PlaybackState[] {
    return [...this.items.values()].filter(
      (item) => now >= item.observed_at && now - item.observed_at < 15000,
    );
  }
}
