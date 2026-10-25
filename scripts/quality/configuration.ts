import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { CompilerOptions } from 'typescript';
import type { ProjectDependencies } from './dependencies.ts';

const requiredFlags = [
  'strict',
  'noUncheckedIndexedAccess',
  'noUnusedLocals',
  'noUnusedParameters',
  'noImplicitReturns',
  'noFallthroughCasesInSwitch',
] as const;
const requiredRules = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-unsafe-assignment',
  '@typescript-eslint/no-unsafe-argument',
  '@typescript-eslint/no-unsafe-return',
  '@typescript-eslint/no-unsafe-call',
  '@typescript-eslint/no-unsafe-member-access',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/no-floating-promises',
  '@typescript-eslint/consistent-type-imports',
] as const;
const strictFlags = [
  'noImplicitAny',
  'noImplicitThis',
  'strictNullChecks',
  'strictFunctionTypes',
  'strictBindCallApply',
  'strictPropertyInitialization',
  'alwaysStrict',
  'useUnknownInCatchVariables',
  'strictBuiltinIteratorReturn',
] as const;
const sourceRoots = ['src', 'extension', 'desktop-ui', 'tests', 'scripts'];

export function assertCompilerOptions(options: CompilerOptions): void {
  for (const flag of requiredFlags) {
    if (options[flag] !== true) throw new Error(`TypeScript: ${flag} must be true`);
  }
  for (const flag of strictFlags) {
    if (options[flag] === false) throw new Error(`TypeScript: ${flag} cannot override strict`);
  }
}

export function checkTypeScript(root: string, { ts }: ProjectDependencies): void {
  const file = ts.readConfigFile(path.join(root, 'tsconfig.json'), (file) => ts.sys.readFile(file));
  if (file.error) throw new Error(ts.flattenDiagnosticMessageText(file.error.messageText, '\n'));
  const source: unknown = file.config;
  const parsed = ts.parseJsonConfigFileContent(source, ts.sys, root);
  if (parsed.errors.length) throw new Error('Cannot resolve tsconfig.json');
  assertCompilerOptions(parsed.options);
}

function functionRules({ z }: ProjectDependencies) {
  const severity = z.literal(2),
    limit = z.number().int().positive().max(20);
  return z.object({
    'max-lines-per-function': z.tuple([
      severity,
      z.object({
        max: limit,
        IIFEs: z.literal(true),
        skipBlankLines: z.literal(false).optional(),
        skipComments: z.literal(false).optional(),
      }),
    ]),
    'sonarjs/cognitive-complexity': z.tuple([severity, limit]),
  });
}

export function assertLintConfiguration(value: unknown, deps: ProjectDependencies): void {
  const config = deps.z
    .object({
      linterOptions: deps.z.object({ noInlineConfig: deps.z.literal(true) }),
      rules: deps.z.record(deps.z.string(), deps.z.unknown()),
    })
    .parse(value);
  functionRules(deps).parse(config.rules);
  for (const name of requiredRules) {
    const rule = config.rules[name];
    if ((Array.isArray(rule) ? rule[0] : rule) !== 2)
      throw new Error(`ESLint: ${name} must be an error`);
  }
}

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(ts|tsx|vue)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

export function sourceFiles(root: string): string[] {
  const directories = sourceRoots.map((name) => path.join(root, name)).filter(existsSync);
  const configs = readdirSync(root).filter((name) => /\.config\.ts$/.test(name));
  const files = [...directories.flatMap(walk), ...configs.map((name) => path.join(root, name))];
  if (!files.length) throw new Error('No TypeScript or Vue sources found');
  return files;
}

export function checkManifest(root: string, { z }: ProjectDependencies): void {
  const source: unknown = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  z.object({
    scripts: z.object({
      check: z.string().min(1),
      build: z.string().min(1),
      test: z.string().min(1),
    }),
  }).parse(source);
}
