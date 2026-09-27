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
  build: {
    rollupOptions: {
      output: {
        // Long-lived vendor chunks: they change only when dependencies do, so a
        // deploy of app code doesn't make returning visitors re-download them.
        // Privy is deliberately NOT grouped: forcing it into one chunk also
        // pulls in the wallet/UI code it otherwise loads on demand (+60% on
        // first load when tried), so its own code-splitting is left alone.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-react';
          if (/node_modules\/(@chakra-ui|@emotion|framer-motion|motion-dom|motion-utils)\//.test(id)) return 'vendor-ui';
          if (/node_modules\/@supabase\//.test(id)) return 'vendor-supabase';
          return undefined;
        },
      },
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
  }
}) 
