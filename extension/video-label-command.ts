import { videoLabelMessageSchema } from './video-label-model.ts';
import type { VideoLabelMessage, VideoLabelReply } from './video-label-model.ts';
import type { ContentPort } from './content-channel.ts';
import { settings } from './model.ts';
import { selectedSite } from './site-selection.ts';
import { sitePattern } from './sites.ts';
import { videoLabelRequest } from './http.ts';
function reply(port: ContentPort, result: VideoLabelReply): void {
  try {
    port.postMessage?.(result);
  } catch {
    /* The tab can close during a request. */
  }
}
async function authorizeVideo(port: ContentPort, message: VideoLabelMessage): Promise<void> {
  const sender = port.sender;
  if (sender?.frameId !== 0 || sender.tab?.id === undefined) throw new Error('Недоступная вкладка');
  const tab = await chrome.tabs.get(sender.tab.id),
    url = URL.parse(tab.url ?? '');
  const config = await settings(),
    pattern = sitePattern(tab.url ?? '');
  if (
    !config.enabled ||
    tab.incognito ||
    url?.protocol !== 'https:' ||
    !['www.youtube.com', 'youtube.com'].includes(url.hostname) ||
    url.searchParams.get('v') !== message.input.video_id ||
    !pattern ||
    !selectedSite(config, 'sites', tab.url ?? '') ||
    !(await chrome.permissions.contains({ origins: [pattern] }))
  )
    throw new Error('Включи сбор видео на YouTube');
}
async function accept(port: ContentPort, message: VideoLabelMessage): Promise<void> {
  await authorizeVideo(port, message);
  const state = await videoLabelRequest(message);
  reply(port, { type: 'video-labels-result', request_id: message.request_id, state });
}
export function videoLabelCommand(port: ContentPort, value: unknown): boolean {
  const message = videoLabelMessageSchema.safeParse(value);
  if (!message.success) return false;
  void accept(port, message.data).catch((error: unknown) => {
    reply(port, {
      type: 'video-labels-result',
      request_id: message.data.request_id,
      error: error instanceof Error ? error.message.slice(0, 300) : 'Нет связи с трекером',
    });
  });
  return true;
}
