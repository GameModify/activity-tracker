declare const __COLLECTOR_BUILD__: string;
export const contentBuild =
  typeof __COLLECTOR_BUILD__ === 'string' ? __COLLECTOR_BUILD__ : 'development';
export function contentFiles(
  script: 'content' | 'interaction-content' | 'youtube-content',
): string[] {
  const root = 'collectors/' + chrome.runtime.getManifest().version + '/';
  return [root + 'content-diagnostics.js', root + script + '.js'];
}
