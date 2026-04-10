import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/postcss';
import autoprefixer from 'autoprefixer';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/nfemail': {
            target: 'http://api.nfemail.com.br/api',
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/api\/nfemail/, ''),
          },
        },
      },
      plugins: [react()],
      css: {
        postcss: {
          plugins: [
            tailwindcss(),

            autoprefixer(),
          ],
        },
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
