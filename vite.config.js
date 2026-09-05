import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  server: {
    proxy: {
      '/api/v1/movie': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  oxc: {
    minify: {
      compress: {
        // This removes all console.log() and debugger statements when you build the APK,
        // making it much harder for hackers to read your app's flow in Logcat.
        drop_console: true,
        drop_debugger: true,
      }
    }
  },
})
