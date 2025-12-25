import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  plugins: [tailwindcss(), react()],
  mode: "development",
  build: {
    minify: false,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        'mini-widget': path.resolve(__dirname, 'mini-widget.html'),
      },
    },
  },
  // Configure for Electron
  base: './',
  server: {
    // Allow Electron to connect
    cors: true,
  },
})
