import type { FrameStatus } from './diagnostic-model.ts';
export function nextFrame(
  input: Omit<FrameStatus, 'observed_at' | 'started_at'>,
  previous?: FrameStatus,
  now = Date.now(),
): FrameStatus {
  const continuous =
    previous?.playing &&
    now - previous.observed_at < 15000 &&
    previous.url === input.url &&
    previous.title === input.title;
  return {
    ...input,
    observed_at: now,
    started_at: input.playing && continuous ? previous.started_at : now,
  };
}
