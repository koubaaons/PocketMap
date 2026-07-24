import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // node is the default and is enough for pure-logic tests
    // (reducer/selector/type tests) — no DOM needed there. A hook or
    // component test that actually needs a DOM should add
    // `// @vitest-environment jsdom` as the very first line of that
    // test file instead of changing this default — see
    // src/hooks/__tests__/useBinderView.test.js for an example.
    // (environmentMatchGlobs was tried first, to avoid needing a
    // per-file directive at all, but wasn't actually being honored in
    // this Vitest version/config combination — confirmed by testing
    // directly, a --environment=jsdom CLI override worked
    // immediately while the equivalent matchGlobs entry silently
    // didn't apply. The per-file directive is Vitest's own documented
    // mechanism and reliably works.)
    environment: 'node',
    globals: true, // describe/it/expect available without importing them in every file
    setupFiles: ['./vitest.setup.js'],
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