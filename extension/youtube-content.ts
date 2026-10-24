import { youtubeCategories } from './youtube-category.ts';
import { installContent } from './content-runtime.ts';
installContent('activityTrackerYouTube', (runtime) => {
  const refresh = youtubeCategories(runtime);
  runtime.heartbeat(refresh);
  refresh();
});
