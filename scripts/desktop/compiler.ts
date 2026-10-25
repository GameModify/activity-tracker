import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execute } from './commands.ts';
if (process.platform !== 'win32') throw new Error('The installer compiler requires Windows');
const directory = path.resolve('.qa/tools'),
  file = path.join(directory, 'innosetup-6.7.3.exe');
await mkdir(directory, { recursive: true });
const response = await fetch(
  'https://github.com/jrsoftware/issrc/releases/download/is-6_7_3/innosetup-6.7.3.exe',
  { signal: AbortSignal.timeout(60000) },
);
if (!response.ok) throw new Error('Cannot download the official installer compiler');
const data = Buffer.from(await response.arrayBuffer());
if (
  createHash('sha256').update(data).digest('hex') !==
  '9c73c3bae7ed48d44112a0f48e66742c00090bdb5bef71d9d3c056c66e97b732'
)
  throw new Error('Inno Setup checksum mismatch');
await writeFile(file, data);
await execute(file, [
  '/VERYSILENT',
  '/SUPPRESSMSGBOXES',
  '/NORESTART',
  '/CURRENTUSER',
  '/DIR=' + path.join(directory, 'inno'),
  '/NOICONS',
]);
console.log('Installer compiler: ' + path.join(directory, 'inno/ISCC.exe'));
