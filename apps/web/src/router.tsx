import { createRouter as createTanstackRouter } from '@tanstack/react-router'
// Generado automaticamente por @tanstack/router-plugin al correr `vite dev`/`vite build`.
// Si tu editor marca error aqui antes del primer build, es esperado.
import { routeTree } from './routeTree.gen'

export function getRouter() {
  return createTanstackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
