import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // MathJax reads PACKAGE_VERSION if the bundler defines it, instead of eval('require').
  define: { PACKAGE_VERSION: JSON.stringify('3.2.1') },
  server: { port: 5173, host: true },
});
