export interface DocumentProbe {
  origin: string;
  playing: boolean;
  media_count: number;
  frames: string[];
  position_seconds?: number;
  duration_seconds?: number;
}
export function inspectDocument(allowedOrigins: string[]): DocumentProbe | null {
  if (!allowedOrigins.includes(location.origin)) return null;
  const media = [...document.querySelectorAll<HTMLMediaElement>('video,audio')];
  const playing = media.some(
    (item) =>
      item instanceof HTMLMediaElement && !item.paused && !item.ended && item.readyState >= 3,
  );
  const player = media.find((item) => item instanceof HTMLMediaElement && !item.paused) ?? media[0];
  return {
    position_seconds:
      player && Number.isFinite(player.currentTime) ? Math.max(0, player.currentTime) : undefined,
    duration_seconds:
      player && Number.isFinite(player.duration) ? Math.max(0, player.duration) : undefined,
    origin: location.origin,
    playing,
    media_count: Math.min(media.length, 1000),
    frames: [...document.querySelectorAll('iframe')].slice(0, 50).map((frame) => frame.src),
  };
}
