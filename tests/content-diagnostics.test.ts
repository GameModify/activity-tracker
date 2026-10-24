import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';
import type { CollectorDiagnostic } from '../src/domain/contracts.ts';
type DiagnosticEvent = Pick<ErrorEvent, 'filename' | 'message' | 'lineno' | 'colno'>;
class DiagnosticPage {
  callbacks = new Map<string, (event: DiagnosticEvent) => void>();
  messages: { type: 'collector-diagnostic'; diagnostic: CollectorDiagnostic }[] = [];
  runtime() {
    return {
      getManifest: () => ({ version: 'test' }),
      getURL: (path: string) => 'chrome-extension://tracker/' + path,
      sendMessage: (message: { type: 'collector-diagnostic'; diagnostic: CollectorDiagnostic }) => {
        this.messages.push(message);
        return Promise.resolve();
      },
    };
  }
  context() {
    return {
      crypto,
      location: { origin: 'https://example.org' },
      window: {
        addEventListener: (type: string, callback: (event: DiagnosticEvent) => void) =>
          this.callbacks.set(type, callback),
        removeEventListener: (type: string) => this.callbacks.delete(type),
      },
      chrome: { runtime: this.runtime() },
    };
  }
}
async function diagnosticPage(): Promise<DiagnosticPage> {
  const result = await build({
    entryPoints: ['extension/content-diagnostics.ts'],
    bundle: true,
    write: false,
    format: 'iife',
  });
  const code = result.outputFiles[0]?.text;
  if (!code) throw new Error('Missing diagnostic bundle');
  const page = new DiagnosticPage();
  runInNewContext(code, page.context());
  return page;
}
const collectorError: DiagnosticEvent = {
  filename: 'chrome-extension://tracker/collectors/0.5.2/content.js',
  message: 'Collector failure',
  lineno: 42,
  colno: 3,
};
void test('the error journal ignores website scripts even when their filename matches the collector', async () => {
  const page = await diagnosticPage(),
    report = page.callbacks.get('error');
  report?.({
    filename: 'https://example.org/content.js',
    message: 'Website details',
    lineno: 1,
    colno: 1,
  });
  assert.equal(page.messages.length, 0);
  report?.(collectorError);
  assert.equal(page.messages.length, 1);
  assert.equal(page.messages[0]?.diagnostic.line, 42);
  assert.equal(page.messages[0].diagnostic.message, 'Collector failure');
  assert.equal(page.messages[0].diagnostic.script, 'collectors/0.5.2/content.js');
});
