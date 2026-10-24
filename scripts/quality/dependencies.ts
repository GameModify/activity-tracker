import { createRequire } from 'node:module';
import path from 'node:path';
import type * as TypeScript from 'typescript';
import type * as Eslint from 'eslint';
import type * as Zod from 'zod';

export function projectDependencies(root: string) {
  const require = createRequire(path.join(root, 'package.json'));
  return {
    ts: require('typescript') as typeof TypeScript,
    eslint: require('eslint') as typeof Eslint,
    z: (require('zod') as typeof Zod).z,
  };
}

export type ProjectDependencies = ReturnType<typeof projectDependencies>;
