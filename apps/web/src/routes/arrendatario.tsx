import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatCOP } from '@arrienda/shared'
import { useAuth } from '@/lib/auth'
import { getTransaccion, listLiquidacionItems, listLiquidaciones } from '@/lib/data'
import { PageContainer, PageHeader } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/arrendatario')({ component: ArrendatarioDashboard })

function estadoBadge(estado: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (estado === 'pagada') return 'success'
  if (estado === 'vencida') return 'destructive'
  if (estado === 'emitida') return 'warning'
  return 'secondary'
}

function ArrendatarioDashboard() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !profile) navigate({ to: '/login' })
  }, [loading, profile, navigate])

  const liquidaciones = useQuery({
    queryKey: ['liquidaciones'],
    queryFn: listLiquidaciones,
    enabled: !!profile,
  })

  if (loading) return <Centered>Cargando...</Centered>
  if (!profile) return null

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <PageHeader title="Mis liquidaciones" subtitle="Consulta y paga tus liquidaciones." />
      {liquidaciones.data?.length === 0 && (
        <p className="text-muted-foreground text-sm">Aun no tienes liquidaciones.</p>
      )}
      <div className="space-y-4">
        {liquidaciones.data?.map((l) => (
          <LiquidacionCard
            key={l.id}
            id={l.id}
            periodo={l.periodo}
            total={l.total}
            estado={l.estado}
          />
        ))}
      </div>
    </PageContainer>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground px-6 py-16 text-center">{children}</div>
}

function LiquidacionCard({
  id,
  periodo,
  total,
  estado,
}: {
  id: string
  periodo: string
  total: number
  estado: string
}) {
  const navigate = useNavigate()
  const items = useQuery({ queryKey: ['items', id], queryFn: () => listLiquidacionItems(id) })

  async function pagar() {
    const tx = await getTransaccion(id)
    if (!tx?.pasarela_ref) {
      toast.error('No hay transaccion para esta liquidacion')
      return
    }
    if (tx.pasarela === 'wompi') {
      // Checkout real de Wompi (PSE / tarjeta).
      window.open(`https://checkout.wompi.co/l/${tx.pasarela_ref}`, '_blank')
      return
    }
    navigate({ to: '/pago/simulado', search: { ref: tx.pasarela_ref, liq: id, monto: total } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">
          Periodo {periodo} · {formatCOP(total)}
        </CardTitle>
        <Badge variant={estadoBadge(estado)}>{estado}</Badge>
      </CardHeader>
      <CardContent className="space-y-2">
        <ul className="text-sm">
          {items.data?.map((it) => (
            <li key={it.id} className="flex justify-between">
              <span className="text-muted-foreground">{it.concepto}</span>
              <span>{formatCOP(it.monto)}</span>
            </li>
          ))}
        </ul>
        {estado !== 'pagada' && (
          <Button onClick={pagar} className="mt-2">
            Pagar {formatCOP(total)}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
