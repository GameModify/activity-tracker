import { pageMedia } from './page-media.ts';
import { installContent } from './content-runtime.ts';
import type { ContentRuntime } from './content-runtime.ts';
function start(runtime: ContentRuntime): void {
  const report = () => {
    runtime.send(pageMedia);
  };
  for (const event of ['playing', 'pause', 'ended', 'waiting', 'emptied'])
    runtime.listen(document, event, report);
  runtime.listen(window, 'pagehide', () => {
    runtime.send(() => ({ ...pageMedia(), playing: false }));
  });
  runtime.heartbeat(report);
  report();
}
installContent('activityTrackerMedia', start);
