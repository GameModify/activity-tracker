// Avoid a stale global npm shim: resolve npm beside the active Node installation.
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
const cli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!existsSync(cli)) {
  console.error('npm не найден рядом с Node.js. Переустанови Node.js 24 LTS с npm.');
  process.exit(1);
}
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: process.env,
});
child.on('exit', (code) => process.exit(code ?? 1));
child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
