import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Preserve function/component names through minification so React's component
  // stack in production fault screens shows real names (e.g. CommandCenter)
  // instead of mangled ones (e.g. "ot"). Small bundle cost, big debuggability.
  esbuild: {
    keepNames: true,
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
  }
}) 
