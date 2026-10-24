import { contentDiagnostic } from './content-report.ts';
let extensionRoot = '';
function scriptError(event: ErrorEvent): void {
  if (!extensionRoot || !event.filename.startsWith(extensionRoot)) return;
  const script = event.filename.split('/').at(-1)?.split('?')[0] ?? '';
  if (!['interaction-content.js', 'content.js', 'content-diagnostics.js'].includes(script)) return;
  contentDiagnostic(event.message, script, event.lineno, event.colno);
}
function attachDiagnostics(): void {
  try {
    const current = chrome.runtime.getManifest().version;
    extensionRoot = chrome.runtime.getURL('');
    if (window.activityTrackerDiagnostics?.version === current) return;
    if (window.activityTrackerDiagnostics)
      window.removeEventListener('error', window.activityTrackerDiagnostics.listener);
    window.activityTrackerDiagnostics = { version: current, listener: scriptError };
    window.addEventListener('error', scriptError);
  } catch {
    return;
  }
}
attachDiagnostics();
declare global {
  interface Window {
    activityTrackerDiagnostics?: { version: string; listener: (event: ErrorEvent) => void };
  }
}
