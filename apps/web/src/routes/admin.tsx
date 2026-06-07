import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { useAuth } from '@/lib/auth'
import { NotifConfigForm } from '@/components/notif-config-form'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/admin')({ component: AdminDashboard })

const PROXIMAMENTE = [
  'Comercializadoras y recaudadores',
  'Verificación de arrendadores',
  'Comisiones y calendarios',
  'Alertas del motor de scraping',
]

function AdminDashboard() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !profile) navigate({ to: '/login' })
  }, [loading, profile, navigate])

  if (loading) return <Centered>Cargando...</Centered>
  if (!profile) return null
  if (profile.rol !== 'admin') return <Centered>Esta sección es solo para administradores.</Centered>

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Panel del Administrador</h1>
        <p className="text-muted-foreground mt-1">Parámetros del sistema y supervisión.</p>
      </header>

      <NotifConfigForm scope="global" />

      <section>
        <h2 className="text-muted-foreground mb-3 text-sm font-semibold uppercase tracking-wide">
          Próximamente
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {PROXIMAMENTE.map((t) => (
            <Card key={t} className="opacity-70">
              <CardHeader>
                <CardTitle className="text-base">{t}</CardTitle>
                <CardDescription>Pendiente de implementar.</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </main>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground px-6 py-16 text-center">{children}</div>
}
