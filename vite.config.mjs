// Configures Vite to build the Electron renderer into the package dist folder.
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
  },
  preview: {
    open: false,
  },
});
