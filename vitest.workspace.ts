import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineWorkspace } from 'vitest/config';

const webSrc = fileURLToPath(new URL('./packages/web/src', import.meta.url));

export default defineWorkspace([
  {
    test: {
      name: 'node',
      environment: 'node',
      include: ['packages/{cli,core,data}/test/**/*.test.ts'],
    },
  },
  {
    plugins: [react()],
    resolve: {
      alias: { '@': webSrc },
    },
    test: {
      name: 'web',
      environment: 'jsdom',
      include: ['packages/web/test/**/*.test.{ts,tsx}'],
      setupFiles: ['packages/web/test/setup.ts'],
    },
  },
]);
