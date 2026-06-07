import { createFileRoute } from '@tanstack/react-router'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/admin')({
  component: AdminDashboard,
})

const TAREAS = [
  'Crear y administrar comercializadoras y recaudadores',
  'Dar de alta y verificar cuentas de arrendadores',
  'Configurar comisiones y calendarios de cobro',
  'Monitorear alertas del motor de scraping (Fase 1)',
]

function AdminDashboard() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-bold">Panel del Administrador</h1>
      <p className="text-muted-foreground mt-1">Entidades maestras y supervision del sistema.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {TAREAS.map((t) => (
          <Card key={t}>
            <CardHeader>
              <CardTitle className="text-base">{t}</CardTitle>
              <CardDescription>Pendiente de implementar (scaffold).</CardDescription>
            </CardHeader>
            <CardContent />
          </Card>
        ))}
      </div>
    </main>
  )
}
