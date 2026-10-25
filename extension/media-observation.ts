import type { TabDetails } from './diagnostic-model.ts';
import type { Observation } from '../src/domain/contracts.ts';
import { frames } from './diagnostics.ts';
import { freshFrames } from './diagnostic-model.ts';
import { observation } from './observations.ts';
export async function mediaObservation(
  tab: TabDetails,
  playing: boolean,
  timestamp = Date.now(),
): Promise<Observation> {
  const candidates = freshFrames(await frames()).filter(
    (frame) => frame.tab_id === tab.id && frame.media_count > 0,
  );
  const frame = candidates.sort(
    (a, b) => Number(b.playing) - Number(a.playing) || b.observed_at - a.observed_at,
  )[0];
  return {
    ...(await observation(tab, 'media', playing, timestamp)),
    media_creator: frame?.media_creator,
    media_id: frame?.media_id,
    media_count: frame?.media_count ?? 0,
    position_seconds: frame?.position_seconds,
    duration_seconds: frame?.duration_seconds,
  };
}
