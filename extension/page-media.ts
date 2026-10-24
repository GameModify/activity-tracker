import type { MediaMessage } from './diagnostic-model.ts';
import { sitePattern } from './sites.ts';
export function pageMedia(): MediaMessage {
  const media = [...document.querySelectorAll('video,audio')];
  const playing = media.some(
    (item) =>
      item instanceof HTMLMediaElement && !item.paused && !item.ended && item.readyState >= 3,
  );
  const frames = [...document.querySelectorAll('iframe')].flatMap((frame) => {
    const pattern = sitePattern(frame.src);
    return pattern ? [pattern] : [];
  });
  const current =
    media.find((item) => item instanceof HTMLMediaElement && !item.paused) ?? media[0];
  return {
    ...mediaPosition(current),
    type: 'media',
    playing,
    media_count: Math.min(media.length, 1000),
    frames: [...new Set(frames)].slice(0, 50),
  };
}

function mediaPosition(
  item: Element | undefined,
): Pick<MediaMessage, 'position_seconds' | 'duration_seconds'> {
  if (!(item instanceof HTMLMediaElement)) return {};
  return {
    position_seconds: Number.isFinite(item.currentTime) ? Math.max(0, item.currentTime) : undefined,
    duration_seconds: Number.isFinite(item.duration) ? Math.max(0, item.duration) : undefined,
  };
}
