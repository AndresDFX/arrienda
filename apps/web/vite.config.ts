import { defineConfig } from 'vite'
import tsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

// TanStack Start desplegado en Cloudflare Workers (mismo patron que examlab):
// el worker entry lo provee @tanstack/react-start (ver wrangler.jsonc -> main).
export default defineConfig({
  server: {
    port: 3000,
    // En Docker (bind mount en Windows) el file-watching nativo no llega; usar polling.
    watch: process.env.VITE_USE_POLLING === '1' ? { usePolling: true, interval: 300 } : undefined,
  },
  plugins: [
    tsConfigPaths({ projects: ['./tsconfig.json'] }),
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})
