import { notices } from './licenses.ts';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { build } from 'esbuild';
import { z } from 'zod';
const versionSchema = z.object({ version: z.string().regex(/^\d+\.\d+\.\d+$/) });
export async function packageVersion(): Promise<string> {
  return versionSchema.parse(JSON.parse(await readFile('package.json', 'utf8'))).version;
}
export async function applicationFiles(directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  await serviceBundles(directory);
  await cp('dist/assets', path.join(directory, 'assets'), { recursive: true });
  await cp('dist/chrome', path.join(directory, 'chrome'), { recursive: true });
  await nativeDependencies(directory);
  await cp('README.md', path.join(directory, 'README.md'));
  await writeFile(path.join(directory, 'THIRD-PARTY-NOTICES.txt'), await notices());
}
async function nativeDependencies(directory: string): Promise<void> {
  for (const dependency of ['koffi', '@koromix/koffi-win32-x64'])
    await cp(
      path.join('node_modules', dependency),
      path.join(directory, 'node_modules', dependency),
      { recursive: true },
    );
}

async function serviceBundles(directory: string): Promise<void> {
  await build({
    entryPoints: { service: 'src/desktop.ts', 'tray-worker': 'src/tray-worker.ts' },
    outdir: directory,
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
    external: ['koffi'],
    define: { 'import.meta.dirname': '__dirname' },
    minify: false,
    sourcemap: false,
  });
}
