import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [
    // HTTPS dev server — required for WebXR device access.
    mkcert(),
    // Desktop XR emulation (mouse + WASD) plus the AI agent dev tooling.
    iwsdkDev({
      emulator: { device: 'metaQuest3' },
      verbose: true,
    }),
  ],
  server: { host: '0.0.0.0', port: 8081, open: true },
  build: {
    outDir: 'dist',
    target: 'esnext',
    rollupOptions: { input: './index.html' },
  },
  esbuild: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
  publicDir: 'public',
  base: './',
});
