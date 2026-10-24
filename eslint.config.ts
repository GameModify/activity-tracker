import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import sonarjs from 'eslint-plugin-sonarjs';
export default defineConfig(
  { ignores: ['dist/**', 'node_modules/**', 'data/**', '.qa/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  { linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'error' } },
  {
    files: ['**/*.ts'],
    plugins: { sonarjs },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, chrome: 'readonly' },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      'max-lines-per-function': ['error', { max: 20, IIFEs: true }],
      'sonarjs/cognitive-complexity': ['error', 20],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },
  {
    files: ['src/domain/**/*.ts', 'src/application/**/*.ts', 'extension/**/*.ts'],
    ignores: ['extension/http.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='JSON'][property.name=/^(parse|stringify)$/]",
          message: 'JSON belongs in HTTP, SQLite or backup adapters.',
        },
      ],
    },
  },
);
