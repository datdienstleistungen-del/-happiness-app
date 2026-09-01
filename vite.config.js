import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'router': ['react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'markdown': ['react-markdown'],
          'icons': ['lucide-react'],
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api/mistral': {
        target: 'https://api.mistral.ai/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/mistral/, ''),
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/.netlify/functions': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      }
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
})
