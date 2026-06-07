import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { toast } from 'sonner'
import { formatCOP } from '@arrienda/shared'
import { useAuth } from '@/lib/auth'
import { confirmarPagoMock } from '@/server/pagos'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Logo } from '@/components/brand/logo'

export const Route = createFileRoute('/pago/simulado')({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: String(search.ref ?? ''),
    liq: String(search.liq ?? ''),
    monto: Number(search.monto ?? 0),
  }),
  component: PagoSimulado,
})

function PagoSimulado() {
  const { ref, monto } = Route.useSearch()
  const navigate = useNavigate()
  const { accessToken } = useAuth()
  const [loading, setLoading] = useState(false)

  async function pagar() {
    if (!accessToken) return toast.error('Inicia sesion')
    setLoading(true)
    try {
      await confirmarPagoMock({ data: { pasarelaRef: ref, accessToken } })
      toast.success('Pago aprobado (simulado)')
      navigate({ to: '/arrendatario' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al pagar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-[calc(100vh-57px)] items-center justify-center px-6 py-10">
      <div
        aria-hidden
        className="brand-gradient absolute -top-28 left-1/2 size-[30rem] -translate-x-1/2 rounded-full opacity-10 blur-3xl"
      />
      <div className="relative w-full max-w-md">
        <Link to="/" className="mx-auto mb-6 flex w-fit">
          <Logo />
        </Link>
        <Card className="w-full">
        <CardHeader>
          <CardTitle>Pago simulado</CardTitle>
          <CardDescription>
            Pasarela MOCK (Fase 0). En produccion seria PSE / tarjeta vía Wompi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-accent/50 rounded-xl py-5 text-center">
            <p className="text-muted-foreground text-sm">Total a pagar</p>
            <p className="text-brand-gradient text-4xl font-extrabold">{formatCOP(monto)}</p>
            <p className="text-muted-foreground mt-1 text-xs">Ref: {ref}</p>
          </div>
          <Button className="w-full" onClick={pagar} disabled={loading || !ref}>
            {loading ? 'Procesando...' : 'Confirmar pago'}
          </Button>
        </CardContent>
        </Card>
      </div>
    </main>
  )
}
