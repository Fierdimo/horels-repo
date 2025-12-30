import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      },
      '/api/admin/credit-config': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/api/credits/estimate': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/api': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      },
      '/timeshare': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      },
      '/hotel': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      },
      '/payments': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      },
      '/conversion': {
        target: 'http://localhost:3000/hotels',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'ui-vendor': ['lucide-react'],
          'i18n-vendor': ['react-i18next', 'i18next', 'i18next-browser-languagedetector'],
          'data-vendor': ['axios', '@tanstack/react-query', 'zustand'],
          'stripe-vendor': ['@stripe/react-stripe-js', '@stripe/stripe-js']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})
