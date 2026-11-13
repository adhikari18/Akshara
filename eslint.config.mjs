import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import nextPlugin from '@next/eslint-plugin-next';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/coverage/**',
      'packages/web/next-env.d.ts',
      'playwright-report/**',
      'test-results/**',
      'claude-hfi/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,mjs}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // Node-side packages (CLI, data validation scripts, config files)
    files: ['packages/{cli,data,core}/**/*.ts', '**/*.mjs', '*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Test suites regularly cast JSON fixtures into intentionally broken shapes
    files: ['packages/*/test/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Next.js web studio (browser + React 19)
    files: ['packages/web/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      '@next/next': nextPlugin,
    },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // Compiler-era diagnostics: TracingCanvas keeps its evaluator in a ref that is
      // read during render — a known design debt scheduled for the component split
      // (see docs/CODEBASE_REVIEW.md M1/M2). Keep visible as warnings until then.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  prettier
);
