import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/verify-login': 'http://localhost:5000',
      '/join-group': 'http://localhost:5000',
      '/leave-group': 'http://localhost:5000',
      '/groups': 'http://localhost:5000',
      '/migrate-data': 'http://localhost:5000',
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
