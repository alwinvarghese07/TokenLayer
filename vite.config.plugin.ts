import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist'),
    emptyOutDir: false,
    target: 'es2020',
    lib: {
      entry: path.resolve(import.meta.dirname, 'src/plugin/code.ts'),
      name: 'TokenLayerPlugin',
      formats: ['iife'],
      fileName: () => 'code.js',
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
});
