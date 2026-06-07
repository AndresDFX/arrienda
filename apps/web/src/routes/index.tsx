import { createFileRoute, Link } from '@tanstack/react-router'
import {
  Building2,
  CheckCircle2,
  Droplets,
  Flame,
  Receipt,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

const FEATURES = [
  {
    icon: Sparkles,
    titulo: 'Experiencia cero toques',
    desc: 'Capturamos energía, agua y gas automáticamente. El arrendatario no reenvía facturas ni conecta correos.',
  },
  {
    icon: Receipt,
    titulo: 'Comisión justa y transparente',
    desc: 'Solo 5% sobre el canon. Los servicios son pass-through: se trasladan sin sobreprecio.',
  },
  {
    icon: Wallet,
    titulo: 'Un solo pago',
    desc: 'Canon + servicios en una liquidación. Pago con PSE o tarjeta y dispersión automática.',
  },
]

const ROLES = [
  {
    icon: Wallet,
    titulo: 'Administrador',
    desc: 'Gestiona comercializadoras, recaudadores y comisiones; supervisa el motor de extracción.',
    to: '/admin' as const,
  },
  {
    icon: Building2,
    titulo: 'Arrendador',
    desc: 'Registra propiedades, elige modalidad de cobro y recibe la dispersión del canon.',
    to: '/arrendador' as const,
  },
  {
    icon: Users,
    titulo: 'Arrendatario',
    desc: 'Recibe la liquidación consolidada y paga en un solo flujo, sin recargos ocultos.',
    to: '/arrendatario' as const,
  },
]

const SERVICIOS = [
  { icon: Zap, label: 'Energía' },
  { icon: Droplets, label: 'Agua' },
  { icon: Flame, label: 'Gas' },
]

function Home() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="brand-gradient absolute -top-40 left-1/2 size-[42rem] -translate-x-1/2 rounded-full opacity-15 blur-3xl"
        />
        <div className="relative mx-auto max-w-5xl px-6 pt-20 pb-16 text-center">
          <LogoMark className="mx-auto size-16 drop-shadow-sm" />
          <span className="bg-accent text-accent-foreground mt-6 inline-block rounded-full px-3 py-1 text-xs font-semibold">
            En toda Colombia
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            Tu arriendo y tus servicios,{' '}
            <span className="text-brand-gradient">en un solo pago</span>
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-pretty">
            ARRIENDA+ cobra el canon y captura automáticamente energía, agua y gas. Sin reenviar
            facturas, sin sobreprecios.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Crear cuenta</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Ingresar</Link>
            </Button>
          </div>
          <div className="text-muted-foreground mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            {SERVICIOS.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <s.icon className="text-primary size-4" /> {s.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="text-primary size-4" /> Comisión 5% solo sobre el canon
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid gap-5 md:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.titulo} className="border-border/60">
              <CardHeader>
                <span className="bg-accent text-primary flex size-10 items-center justify-center rounded-lg">
                  <f.icon className="size-5" />
                </span>
                <CardTitle className="mt-3 text-base">{f.titulo}</CardTitle>
                <CardDescription>{f.desc}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section className="mx-auto max-w-5xl px-6 py-12">
        <h2 className="text-center text-2xl font-bold tracking-tight">Una plataforma, tres roles</h2>
        <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-center">
          Responsabilidades separadas, con la carga de configuración en el arrendador para liberar
          al arrendatario.
        </p>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {ROLES.map((r) => (
            <Card key={r.titulo} className="group transition-shadow hover:shadow-md">
              <CardHeader>
                <span className="brand-gradient flex size-11 items-center justify-center rounded-xl text-white shadow-sm">
                  <r.icon className="size-5" />
                </span>
                <CardTitle className="mt-3">{r.titulo}</CardTitle>
                <CardDescription>{r.desc}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="ghost" size="sm" className="px-0 hover:bg-transparent">
                  <Link to={r.to} className="text-primary">
                    Ver panel →
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <footer className="text-muted-foreground border-t py-8 text-center text-sm">
        ARRIENDA+ · Facilitador tecnológico de pagos. No retiene fondos.
      </footer>
    </main>
  )
}
