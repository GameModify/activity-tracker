import { contentLabelSchema } from '../src/domain/contracts.ts';
import type { VideoIdentity } from '../src/domain/contracts.ts';
import { sample } from './fixtures.ts';
export const labels = contentLabelSchema.array().parse([
  { id: 'work', name: 'Кодинг', activity: 'tng:work', color: '#123456', aliases: ['coding'] },
  { id: 'watch', name: 'Просмотр YouTube', activity: 'tng:watch', color: '#654321' },
]);
export const identity: VideoIdentity = { video_id: 'abcdefghijk', creator: '/@lessons' };
export function video(offset = 0) {
  return sample(offset, {
    source: 'chrome',
    app: 'chrome.exe',
    channel: 'chrome:media:1',
    kind: 'media',
    url: 'https://www.youtube.com/watch?v=' + identity.video_id,
    playing: true,
    media_creator: identity.creator,
    media_id: identity.video_id,
  });
}
