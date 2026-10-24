import { build } from 'esbuild';
import { mkdir, copyFile } from 'node:fs/promises';
const out = 'dist/chrome';
await mkdir(out, { recursive: true });
await build({
  entryPoints: ['extension/background.ts', 'extension/options.ts', 'extension/popup.ts'],
  outdir: out,
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  sourcemap: true,
});
await build({
  entryPoints: [
    'extension/content.ts',
    'extension/interaction-content.ts',
    'extension/content-diagnostics.ts',
  ],
  outdir: out,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  minify: false,
  sourcemap: true,
});
for (const file of ['manifest.json', 'options.html', 'options.css', 'popup.html', 'popup.css'])
  await copyFile('extension/' + file, out + '/' + file);
console.log('Chrome extension: dist/chrome');
