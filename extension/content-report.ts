import { contentBuild } from './content-build.ts';
import type { CollectorDiagnostic } from '../src/domain/contracts.ts';
export function contentDiagnostic(error: unknown, script: string, line = 0, column = 0): void {
  try {
    const diagnostic: CollectorDiagnostic = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      severity: 'error',
      version: contentBuild,
      message: errorMessage(error),
      script: script.slice(0, 100),
      origin: location.origin.slice(0, 300),
      line,
      column,
    };
    void chrome.runtime
      .sendMessage({ type: 'collector-diagnostic', diagnostic })
      .catch(() => undefined);
  } catch {
    return;
  }
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+\S+/gi, 'Bearer [скрыто]').slice(0, 1000);
}
