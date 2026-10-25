import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { nodeCommand } from './commands.ts';
const bootstrap = `const path = require('node:path');
const { createRequire } = require('node:module');
const load = createRequire(path.join(path.dirname(process.execPath),'service.cjs'));
load('./service.cjs');
`;
async function configuration(directory: string): Promise<string> {
  const main = path.join(directory, 'bootstrap.cjs'),
    config = path.join(directory, 'sea.json');
  await writeFile(main, bootstrap);
  await writeFile(
    config,
    JSON.stringify({
      main,
      output: path.join(directory, 'runtime.blob'),
      disableExperimentalSEAWarning: true,
      useSnapshot: false,
      useCodeCache: false,
      execArgvExtension: 'none',
    }),
  );
  return config;
}
export async function injectRuntime(directory: string, executable: string): Promise<void> {
  await nodeCommand(['--experimental-sea-config', await configuration(directory)]);
  const args = [
    'node_modules/postject/dist/cli.js',
    executable,
    'NODE_SEA_BLOB',
    path.join(directory, 'runtime.blob'),
    '--sentinel-fuse',
    'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2',
  ];
  await nodeCommand(args);
}
