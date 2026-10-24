import { pageMedia } from './page-media.ts';
declare global {
  interface Window {
    activityTrackerCollectorVersion?: string;
  }
}
function report(): void {
  void chrome.runtime.sendMessage(pageMedia()).catch(() => undefined);
}
function start(): void {
  for (const event of ['playing', 'pause', 'ended', 'waiting', 'emptied']) {
    document.addEventListener(event, report, true);
  }
  window.addEventListener('pagehide', () => {
    void chrome.runtime.sendMessage({ ...pageMedia(), playing: false }).catch(() => undefined);
  });
  setInterval(report, 5000);
  report();
}
const version = chrome.runtime.getManifest().version;
if (window.activityTrackerCollectorVersion !== version) {
  window.activityTrackerCollectorVersion = version;
  start();
}
