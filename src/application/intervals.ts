import { webActivity } from '../domain/browser.ts';
import { assistantActivity, assistantTitle } from '../domain/assistant.ts';
import { chatContext } from '../domain/chat.ts';
import { randomUUID } from 'node:crypto';
import type { ActivityInterval, Observation, Rule } from '../domain/contracts.ts';
import type { OpenChannel, TrackingStore } from './ports.ts';
import { idleEnd } from '../domain/engagement.ts';
import { signature } from '../domain/classify.ts';
function interval(sample: Observation, rule?: Rule): ActivityInterval {
  return {
    id: randomUUID(),
    app: sample.app,
    website: sample.website,
    project: rule?.project,
    ...chatContext({ ...sample, title: assistantTitle(sample, rule) }, rule),
    resource_kind: sample.resource_kind,
    sequence: 1,
    channel: sample.channel,
    source: sample.source,
    activity: intervalActivity(sample, rule),
    start_at: sample.timestamp,
    end_at: sample.timestamp,
    rule_id: rule?.id ?? null,
    closed: false,
  };
}
export function begin(store: TrackingStore, sample: Observation, rule?: Rule): void {
  const item = interval(sample, rule);
  store.save({ ...item, sequence: store.nextSequence() });
  store.open({
    channel: sample.channel,
    interval_id: item.id,
    last_at: sample.timestamp,
    recording_at: sample.recording ? sample.timestamp : undefined,
    signature: signature(sample, rule),
  });
}
export function finish(store: TrackingStore, open: OpenChannel, sample?: Observation): void {
  const item = store.get(open.interval_id);
  if (!item) throw new Error('Open interval is missing');
  const contiguous = sample && sample.timestamp - open.last_at <= 15000;
  let end = contiguous ? sample.timestamp : item.end_at;
  if (sample)
    end = Math.max(open.recording_at ?? item.start_at, Math.min(end, idleEnd(sample) ?? end));
  store.save({
    ...item,
    end_at: Math.max(item.start_at, end),
    closed: true,
    sequence: store.nextSequence(),
  });
  store.close(open.channel);
}
export function extend(store: TrackingStore, open: OpenChannel, sample: Observation): void {
  const item = store.get(open.interval_id);
  if (!item) throw new Error('Open interval is missing');
  store.save({ ...item, end_at: sample.timestamp, sequence: store.nextSequence() });
  store.open({
    ...open,
    last_at: sample.timestamp,
    recording_at: sample.recording ? sample.timestamp : open.recording_at,
  });
}

function intervalActivity(sample: Observation, rule?: Rule): string | null {
  if (rule) return rule.activity;
  const assistant = assistantActivity(sample);
  if (assistant) return assistant;
  if (sample.kind === 'voice') return 'voice';
  if (sample.resource_kind === 'document') return 'documents';
  return sample.resource_kind === 'game' ? 'games' : (webActivity(sample) ?? null);
}
