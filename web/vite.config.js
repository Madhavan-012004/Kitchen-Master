import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://144.217.89.193:8080', // Switched from localhost:8080 to your remote server
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://144.217.89.193:8080', // Switched from localhost:8080 to your remote server
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:9092',
        ws: true,
        changeOrigin: true,
      },
      '/nominatim': {
        target: 'https://nominatim.openstreetmap.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nominatim/, ''),
        headers: {
          'User-Agent': 'ProBloomApp/1.0 (contact@ProBloom.app)',
        },
      }
    }
  }
})
