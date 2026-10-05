/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build loads from file:// in Electron too.
  base: './',
  worker: { format: 'es' },
  build: {
    target: 'es2022',
    // Workers are inlined as blobs: the packaged app then needs no
    // file:// worker loading at all.
    assetsInlineLimit: 0,
    sourcemap: true,
  },
  test: {
    // tests/perf/ only on request: npm run perf
    include: process.env.PERF ? ['tests/perf/*.test.ts'] : ['tests/*.test.ts'],
    testTimeout: 120000,
  },
  server: { port: Number(process.env.PORT) || 5173 },
});
