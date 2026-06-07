import * as React from 'react'
import { useState } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts, Link } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ARRIENDA+' },
      { name: 'description', content: 'Gestion y recaudo de arriendos con servicios publicos' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  const [queryClient] = useState(() => new QueryClient())
  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <NavBar />
          <Outlet />
        </AuthProvider>
      </QueryClientProvider>
    </RootDocument>
  )
}

function NavBar() {
  const { profile, loading, signOut } = useAuth()
  return (
    <nav className="border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="font-bold">
          ARRIENDA+
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {!loading && profile ? (
            <>
              <span className="text-muted-foreground">
                {profile.nombre} · {profile.rol}
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                Salir
              </Button>
            </>
          ) : (
            <Link to="/login" className="text-primary">
              Ingresar
            </Link>
          )}
        </div>
      </div>
    </nav>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" />
        <Scripts />
      </body>
    </html>
  )
}
