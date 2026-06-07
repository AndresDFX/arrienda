import * as React from 'react'
import { useState } from 'react'
import { Outlet, createRootRoute, HeadContent, Scripts, Link } from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { LogOut } from 'lucide-react'
import { AuthProvider, useAuth } from '@/lib/auth'
import { Logo } from '@/components/brand/logo'
import { Button } from '@/components/ui/button'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'ARRIENDA+ · Arriendos y servicios en un solo pago' },
      {
        name: 'description',
        content:
          'ARRIENDA+ automatiza el cobro del arriendo y los servicios públicos en un solo flujo, sin sobreprecios.',
      },
      { name: 'theme-color', content: '#0E7490' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'stylesheet', href: appCss },
    ],
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

const ROL_LABEL: Record<string, string> = {
  admin: 'Administrador',
  arrendador: 'Arrendador',
  arrendatario: 'Arrendatario',
}

function NavBar() {
  const { profile, loading, signOut } = useAuth()
  return (
    <nav className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link to="/" className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {!loading && profile ? (
            <>
              <span className="hidden sm:inline">
                <span className="font-medium">{profile.nombre}</span>
                <span className="bg-accent text-accent-foreground ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                  {ROL_LABEL[profile.rol] ?? profile.rol}
                </span>
              </span>
              <Button size="sm" variant="outline" onClick={() => signOut()}>
                <LogOut className="size-4" />
                Salir
              </Button>
            </>
          ) : (
            <Button size="sm" asChild>
              <Link to="/login">Ingresar</Link>
            </Button>
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
      <body className="min-h-screen">
        {children}
        <Toaster richColors position="top-right" />
        <Scripts />
      </body>
    </html>
  )
}
