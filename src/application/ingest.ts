import { browserObservation } from '../domain/browser.ts';
import type { Observation } from '../domain/contracts.ts';
import { shouldTrack, matchingRule, signature } from '../domain/classify.ts';
import type { TrackingStore } from './ports.ts';
import { begin, extend, finish } from './intervals.ts';
function apply(store: TrackingStore, sample: Observation): void {
  const open = store.channel(sample.channel),
    rule = matchingRule(sample, store.rules());
  if (open && sample.timestamp <= open.last_at) return;
  const contiguous = open && sample.timestamp - open.last_at <= 15000;
  if (contiguous && open.signature === signature(sample, rule) && shouldTrack(sample, rule)) {
    extend(store, open, sample);
    return;
  }
  if (open) finish(store, open, sample);
  if (shouldTrack(sample, rule)) begin(store, sample, rule);
}
export function ingest(store: TrackingStore, sample: Observation): void {
  store.atomic(() => {
    if (store.hasEvent(sample.event_id)) return;
    apply(store, browserObservation(sample));
    store.rememberEvent(sample.event_id, sample.timestamp);
  });
}
export function expire(store: TrackingStore, now: number): void {
  store.atomic(() => {
    for (const channel of store.channels()) {
      if (now - channel.last_at > 15000) finish(store, channel);
    }
  });
}
export function closeAll(store: TrackingStore): void {
  store.atomic(() => {
    for (const channel of store.channels()) finish(store, channel);
  });
}
