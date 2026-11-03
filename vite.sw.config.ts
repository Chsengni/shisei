// The service worker is its own build: a classic script with a fixed name (sw.js), because a worker's URL is its
// identity and must not change between deploys. Workbox is bundled in.
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'web/dist',
    emptyOutDir: false,
    target: 'es2020',
    lib: { entry: 'web/sw/sw.ts', formats: ['iife'], name: 'shiseiSW', fileName: () => 'sw.js' }
  }
});
