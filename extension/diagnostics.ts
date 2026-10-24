import { mediaTitle } from './media-title.ts';
import { sitePattern } from './sites.ts';
import { frameStatusSchema, freshFrames } from './diagnostic-model.ts';
import type { FrameStatus, MediaMessage, TabDetails } from './diagnostic-model.ts';
import { nextFrame } from './frame-state.ts';
import { safeUrl } from './model.ts';
export async function frames(): Promise<FrameStatus[]> {
  const stored = await chrome.storage.session.get(null);
  return Object.values(stored).flatMap((value: unknown) => {
    const parsed = frameStatusSchema.safeParse(value);
    return parsed.success ? [parsed.data] : [];
  });
}
function frameInput(message: MediaMessage, tab: TabDetails, frame: number) {
  return {
    ...message,
    tab_id: tab.id ?? -1,
    frame_id: frame,
    title: mediaTitle(tab.title ?? '', tab.url ?? ''),
    url: safeUrl(tab.url ?? ''),
  };
}
export async function recordFrame(
  message: MediaMessage,
  sender: chrome.runtime.MessageSender,
  tab: TabDetails,
): Promise<boolean> {
  const key = 'frame:' + String(tab.id) + ':' + String(sender.frameId ?? 0);
  const old = frameStatusSchema.safeParse((await chrome.storage.session.get(key))[key]).data;
  const input = frameInput(message, tab, sender.frameId ?? 0);
  const current = nextFrame({ ...input, frame_origin: sitePattern(sender.url ?? '') ?? '' }, old);
  await chrome.storage.session.set({ [key]: current });
  return freshFrames(await frames()).some((frame) => frame.tab_id === tab.id && frame.playing);
}
export async function removeTab(tab: number): Promise<void> {
  const stored = await frames();
  await chrome.storage.session.remove(
    stored
      .filter((frame) => frame.tab_id === tab)
      .map((frame) => 'frame:' + String(tab) + ':' + String(frame.frame_id)),
  );
}
