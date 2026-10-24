import { contentBuild } from './content-build.ts';
import { contentDiagnostic } from './content-report.ts';
let extensionRoot = '';
function scriptError(event: ErrorEvent): void {
  if (!extensionRoot || !event.filename.startsWith(extensionRoot)) return;
  const script = event.filename.slice(extensionRoot.length).split('?')[0] ?? '';
  const filename = script.split('/').at(-1) ?? '';
  if (!['interaction-content.js', 'content.js', 'content-diagnostics.js'].includes(filename))
    return;
  contentDiagnostic(event.message, script, event.lineno, event.colno);
}
function attachDiagnostics(): void {
  try {
    const current = contentBuild;
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
