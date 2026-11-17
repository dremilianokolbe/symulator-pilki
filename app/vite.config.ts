import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: __dirname,
  // Ścieżki względne: aplikacja działa z dowolnego katalogu (hosting statyczny, podgląd).
  base: './',
  server: { host: true, port: 5173, fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true, target: 'es2022' },
  worker: { format: 'es' },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Selekcjoner – symulator piłki nożnej',
        short_name: 'Selekcjoner',
        description: 'Kariera selekcjonera i symulacje Euro 2016',
        lang: 'pl',
        start_url: './',
        display: 'standalone',
        background_color: '#0f1419',
        theme_color: '#0f1419',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'], maximumFileSizeToCacheInBytes: 5_000_000 },
    }),
  ],
});
