import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
const lockSchema = z.object({
  packages: z.record(z.string(), z.object({ dev: z.boolean().optional() })),
});
async function dependencyLicense(directory: string): Promise<string> {
  if (!existsSync(directory)) return '';
  if (directory.startsWith('node_modules/@koromix/')) return '';
  const files = await readdir(directory);
  const name = files.find((file) => /^(licen[sc]e|copying)([.-].*)?$/i.test(file));
  if (!name) throw new Error('License missing: ' + directory);
  return directory + '\n' + (await readFile(path.join(directory, name), 'utf8'));
}
export async function notices(): Promise<string> {
  const lock = lockSchema.parse(JSON.parse(await readFile('package-lock.json', 'utf8')));
  const directories = Object.entries(lock.packages)
    .filter(([name, entry]) => name.startsWith('node_modules/') && !entry.dev)
    .map(([name]) => name);
  const response = await fetch(
    'https://raw.githubusercontent.com/nodejs/node/v' + process.versions.node + '/LICENSE',
    { signal: AbortSignal.timeout(30000) },
  );
  if (!response.ok) throw new Error('Cannot fetch Node.js license');
  const node = await response.text();
  const licenses = await Promise.all(directories.map(dependencyLicense));
  return ['Node.js ' + process.versions.node + '\n' + node, ...licenses].join('\n\n');
}
