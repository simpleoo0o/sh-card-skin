import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/sh-card-skin/',
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.mjs'],
  },
});
