import { createFileRoute, Link } from '@tanstack/react-router'
import { Building2, Users, Wallet } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Home,
})

const ROLES = [
  {
    icon: Wallet,
    titulo: 'Administrador',
    desc: 'Gestiona comercializadoras, recaudadores, comisiones y monitorea el motor de extraccion.',
    to: '/admin',
  },
  {
    icon: Building2,
    titulo: 'Arrendador',
    desc: 'Registra propiedades, elige modalidad de cobro y recibe la dispersion del canon.',
    to: '/arrendador',
  },
  {
    icon: Users,
    titulo: 'Arrendatario',
    desc: 'Recibe la liquidacion consolidada y paga en un solo flujo (PSE / tarjeta).',
    to: '/arrendatario',
  },
] as const

function Home() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">ARRIENDA+</h1>
        <p className="text-muted-foreground mt-3 text-lg">
          Plataforma de gestion y recaudo de arriendos con servicios publicos
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link to="/login">Ingresar</Link>
          </Button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r.titulo}>
            <CardHeader>
              <r.icon className="text-primary mb-2 size-6" />
              <CardTitle>{r.titulo}</CardTitle>
              <CardDescription>{r.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link to={r.to}>Ver panel</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}
