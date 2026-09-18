/** Builds the renderer with relative asset paths for the packaged desktop app. */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const contentSecurityPolicy =
  "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://raw.githubusercontent.com; media-src https://raw.githubusercontent.com; connect-src https://pokeapi.co; object-src 'none'; base-uri 'none'; form-action 'none'";

/** Adds a strict policy to packaged HTML while allowing Vite's local development runtime. */
function addProductionPolicy() {
  return [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy },
      injectTo: 'head-prepend' as const,
    },
  ];
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'production-content-security-policy',
      apply: 'build',
      transformIndexHtml: addProductionPolicy,
    },
  ],
  root: 'src/renderer',
  base: './',
  build: { outDir: '../../dist/renderer', emptyOutDir: true, target: 'es2022' },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
});
