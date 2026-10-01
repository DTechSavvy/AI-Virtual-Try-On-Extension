import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import * as esbuild from 'esbuild';

function buildContentScriptPlugin(): Plugin {
  return {
    name: 'build-content-script',
    async closeBundle() {
      await esbuild.build({
        entryPoints: [resolve(__dirname, 'src/content/content-script.ts')],
        bundle: true,
        outfile: resolve(__dirname, 'dist/content-script.js'),
        format: 'iife',
        sourcemap: false,
      });
      console.log('✓ content-script.js bundled as self-contained IIFE');
    },
  };
}

export default defineConfig({
  plugins: [react(), buildContentScriptPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'service-worker') {
            return '[name].js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
