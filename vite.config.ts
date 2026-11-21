import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Production is served from tools.anantamracing.com/aerovision/, so that is the
  // default and a normal build is unchanged. A bare clone served at the root
  // needs VITE_BASE=/ at build time, or every asset 404s.
  base: process.env.VITE_BASE ?? '/aerovision/',
  server: {
    port: 5174,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'three'
        }
      }
    }
  }
})
