import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectDependencies } from './dependencies.ts';
import {
  assertLintConfiguration,
  checkManifest,
  checkTypeScript,
  sourceFiles,
} from './configuration.ts';

export async function auditProject(root: string): Promise<void> {
  const deps = projectDependencies(root);
  checkManifest(root, deps);
  checkTypeScript(root, deps);
  const lint = new deps.eslint.ESLint({ cwd: root });
  const files = sourceFiles(root);
  for (const file of files) {
    try {
      const config: unknown = await lint.calculateConfigForFile(file);
      assertLintConfiguration(config, deps);
    } catch (error) {
      throw new Error(`Invalid quality configuration for ${path.relative(root, file)}`, {
        cause: error,
      });
    }
  }
  console.log(`Quality configuration: OK (${files.length} files)`);
}

function npmCli(): string {
  const bin = path.dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    path.join(bin, 'node_modules/npm/bin/npm-cli.js'),
    path.resolve(bin, '../lib/node_modules/npm/bin/npm-cli.js'),
  ];
  const cli = candidates.find((file) => file?.endsWith('npm-cli.js') && existsSync(file));
  if (!cli) throw new Error('Install Node.js 24.12+ with npm to run project checks');
  return cli;
}

function runTask(root: string, name: string): void {
  const result = spawnSync(process.execPath, [npmCli(), 'run', name], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Task ${name} failed (${String(result.status ?? result.signal)})`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const root = path.resolve(args.find((arg) => arg !== '--audit') ?? process.cwd());
  await auditProject(root);
  if (!args.includes('--audit')) {
    for (const name of ['check', 'build', 'test']) runTask(root, name);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
