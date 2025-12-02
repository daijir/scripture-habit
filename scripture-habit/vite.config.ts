import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/verify-login': 'http://localhost:5001',
      '/join-group': 'http://localhost:5001',
      '/leave-group': 'http://localhost:5001',
      '/groups': 'http://localhost:5001',
      '/migrate-data': 'http://localhost:5001',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'firebase/app', 'firebase/auth', 'firebase/firestore'],
        },
      },
    },
  },
})
