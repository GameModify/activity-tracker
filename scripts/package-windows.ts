import { installer } from './desktop/installer.ts';
import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { packageVersion, applicationFiles } from './desktop/layout.ts';
import { guiExecutable } from './desktop/executable.ts';
import { injectRuntime } from './desktop/sea.ts';
import { zip } from './desktop/commands.ts';
if (process.platform !== 'win32' || process.arch !== 'x64')
  throw new Error('Windows x64 and Node.js 24 are required');
const version = await packageVersion();
const root = path.resolve('dist/windows'),
  app = path.join(root, 'ActivityTracker');
await applicationFiles(app);
const exe = path.join(app, 'ActivityTracker.exe');
await guiExecutable(exe, path.join(app, 'assets/tracker.ico'), version);
await mkdir(path.join(root, 'build'), { recursive: true });
await injectRuntime(path.join(root, 'build'), exe);
const artifacts = ['ActivityTracker-' + version + '-windows-x64.zip', 'ActivityTracker-Chrome.zip'];
await zip(app, path.join(root, artifacts[0] ?? 'portable.zip'));
await zip(path.resolve('dist/chrome/*'), path.join(root, artifacts[1] ?? 'chrome.zip'));
artifacts.push(await installer(app, version));
const sums = await Promise.all(
  artifacts.map(
    async (name) =>
      createHash('sha256')
        .update(await readFile(path.join(root, name)))
        .digest('hex') +
      '  ' +
      name,
  ),
);
await writeFile(path.join(root, 'SHA256SUMS.txt'), sums.join('\n') + '\n');
console.log('Windows distribution: ' + root);
