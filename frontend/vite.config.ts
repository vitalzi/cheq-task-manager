import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Locally VITE_API_URL stays empty, so the app calls its own origin and these
// proxies forward to the API. No CORS needed in dev.
const api = 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/health': api, '/tasks': api },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    // Node's fetch needs an absolute URL; MSW answers it, nothing leaves the process.
    env: { VITE_API_URL: 'http://api.test' },
  },
});
