import { defineConfig } from 'vite'
// import tailwindcss from '@tailwindcss/vite' // Temporarily disabled
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  mode: "development",
  build: {
    minify: false,
  },
  // Configure for Electron
  base: './',
  server: {
    // Allow Electron to connect
    cors: true,
  },
})
