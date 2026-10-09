/// <reference types="vitest/config" />
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { manifest } from './pwa.manifest.ts';

export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['baseLocale'],
    }),
    tailwindcss(),
    svelte(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      manifest,
      injectManifest: {
        // Precache every build output, including lazy chunks.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2,json}'],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: { $paraglide: fileURLToPath(new URL('./src/lib/paraglide', import.meta.url)) },
  },
  build: {
    target: 'es2023',
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
