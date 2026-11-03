// Builds the gallery's scripts and stylesheet into web/dist/ with content-hashed names and a manifest;
// tools/build_site.py reads web/dist/.vite/manifest.json and writes the tags into every page it renders.
// `npm run dev` serves the same entries with hot reload: see README (build_site.py --vite-dev).
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  // Relative URLs: the site is served from a sub-path on some hosts (GitHub Pages /shisei/).
  base: './',
  publicDir: false,
  plugins: [tailwindcss()],
  server: { port: 5173, strictPort: true, cors: true, origin: 'http://localhost:5173' },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: true,
    target: 'es2020',
    // Fonts stay files (they are preloaded), never data: URIs.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        gallery: 'web/src/entries/gallery.ts',
        library: 'web/src/entries/library.ts',
        page: 'web/src/entries/page.ts',
        style: 'web/src/styles/app.css'
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // What every page runs (strings, share sheet, menu, assistant drawer) in one shared file.
        manualChunks(id) {
          if (/web\/src\/(i18n|common|util|types|sw-register|agent\/panel)\.ts$/.test(id)) return 'shared';
          return undefined;
        }
      }
    }
  }
});
