import { videoContext } from './video-context.ts';
import { pageMedia } from './page-media.ts';
import { installContent } from './content-runtime.ts';
import type { ContentRuntime } from './content-runtime.ts';
function start(runtime: ContentRuntime): void {
  const report = mediaReporter(runtime);
  for (const event of ['playing', 'pause', 'ended', 'waiting', 'emptied'])
    runtime.listen(document, event, report);
  runtime.listen(window, 'pagehide', () => {
    runtime.send(() => ({ ...pageMedia(), playing: false }));
  });
  runtime.heartbeat(report);
  report();
}
installContent('activityTrackerMedia', start);

function mediaReporter(runtime: ContentRuntime): () => void {
  let initial = true,
    hadMedia = false;
  return () => {
    const snapshot = pageMedia();
    if (!initial && !snapshot.media_count && !hadMedia) return;
    initial = false;
    hadMedia = snapshot.media_count > 0;
    runtime.send(() => ({ ...snapshot, ...videoContext(document, location.href) }));
  };
}
