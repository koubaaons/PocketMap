import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Node environment is enough for now — reducer/selector/type
    // tests are pure logic, no DOM needed. Add 'jsdom' + React
    // Testing Library later if/when component-level tests start.
    environment: 'node',
    globals: true, // describe/it/expect available without importing them in every file
  },
  server: {
    proxy: {
      // === ISSUE #130: Pokemon TCG API CORS is genuinely
      // intermittent (confirmed via repeated real browser CORS
      // failures, not a code mistake on our end — this API's own
      // CORS headers just aren't reliably present). Routing through
      // Vite's own dev server means the browser only ever talks to
      // http://localhost:5173/api/pokemontcg/... (same-origin, no
      // CORS check at all); Vite then forwards the request server-
      // to-server, which is never subject to browser CORS
      // enforcement in the first place. See src/services/
      // pokemonApi.js for the matching API_BASE change. ===
      '/api/pokemontcg': {
        target: 'https://api.pokemontcg.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pokemontcg/, '/v2'),
      },
    },
  },
})