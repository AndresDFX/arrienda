import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatCOP, type ModalidadCobro, type TipoServicio } from '@arrienda/shared'
import { useAuth } from '@/lib/auth'
import {
  createContrato,
  createPropiedad,
  createServicio,
  listComercializadoras,
  listContratos,
  listExtracciones,
  listPropiedades,
  listServicios,
} from '@/lib/data'
import { generarLiquidacion } from '@/server/liquidacion'
import { NotifConfigForm } from '@/components/notif-config-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/arrendador')({ component: ArrendadorDashboard })

function ArrendadorDashboard() {
  const navigate = useNavigate()
  const { profile, loading } = useAuth()

  useEffect(() => {
    if (!loading && !profile) navigate({ to: '/login' })
  }, [loading, profile, navigate])

  if (loading) return <Centered>Cargando...</Centered>
  if (!profile) return null
  if (profile.rol !== 'arrendador')
    return <Centered>Esta seccion es solo para arrendadores.</Centered>

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Panel del Arrendador</h1>
        <p className="text-muted-foreground mt-1">
          Gestiona tus propiedades, contratos y liquidaciones.
        </p>
      </header>
      <PropiedadesSection arrendadorId={profile.id} />
      <ContratosSection />
      <ScraperTestCard />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Notificaciones</h2>
        <NotifConfigForm scope="arrendador" arrendadorId={profile.id} />
      </section>
    </main>
  )
}

// --------------------------------------------------- Scraper (prueba GdO)
function ScraperTestCard() {
  const triggerUrl =
    (import.meta.env.VITE_SCRAPER_TRIGGER_URL as string | undefined) ?? 'http://localhost:8787'
  const [providers, setProviders] = useState<Array<{ key: string; nombre: string; tipo: string }>>(
    [],
  )
  const [provider, setProvider] = useState('gases-de-occidente')
  const [identificador, setIdentificador] = useState('2910516')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${triggerUrl}/providers`)
      .then((r) => r.json())
      .then((ps: Array<{ key: string; nombre: string; tipo: string }>) => {
        setProviders(ps)
        if (ps[0]) setProvider(ps[0].key)
      })
      .catch(() => {})
  }, [triggerUrl])

  async function lanzar() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`${triggerUrl}/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, identificador }),
      })
      const json = (await res.json()) as {
        ok: boolean
        nombre?: string
        valorExtraido?: number
        refPago?: string
        fechaLimite?: string
        alDia?: boolean
        error?: string
      }
      if (!json.ok) throw new Error(json.error ?? 'Error en la extraccion')
      setResult(
        `${json.nombre}: ${formatCOP(json.valorExtraido ?? 0)}` +
          (json.refPago ? ` · ref ${json.refPago}` : '') +
          (json.fechaLimite ? ` · vence ${json.fechaLimite}` : '') +
          (json.alDia ? ' · al día' : ''),
      )
      toast.success(`Extraccion ${json.nombre} OK`)
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `${e.message} (¿esta corriendo el scraper? bun run --cwd apps/scraper serve)`
          : 'Error',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Scraper · probar proveedores</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lanzar extraccion en vivo</CardTitle>
          <span className="text-muted-foreground text-sm">
            Abre un navegador real y consulta la factura del proveedor seleccionado.
          </span>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Proveedor</Label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
            >
              {providers.length === 0 && (
                <option value="gases-de-occidente">Gases de Occidente (gas)</option>
              )}
              {providers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.nombre} ({p.tipo})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Contrato / cuenta</Label>
            <Input
              value={identificador}
              onChange={(e) => setIdentificador(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={lanzar} disabled={loading}>
            {loading ? 'Extrayendo...' : 'Lanzar scraper'}
          </Button>
          {result && <span className="text-primary text-sm font-medium">{result}</span>}
        </CardContent>
      </Card>
    </section>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground mx-auto max-w-4xl px-6 py-16 text-center">{children}</div>
}

// ---------------------------------------------------------------- Propiedades
function PropiedadesSection({ arrendadorId }: { arrendadorId: string }) {
  const qc = useQueryClient()
  const propiedades = useQuery({ queryKey: ['propiedades'], queryFn: listPropiedades })
  const [direccion, setDireccion] = useState('')
  const [ciudad, setCiudad] = useState('')
  const [modalidad, setModalidad] = useState<ModalidadCobro>('completo')

  const crear = useMutation({
    mutationFn: () =>
      createPropiedad({ arrendadorId, direccion, ciudad, modalidadCobro: modalidad }),
    onSuccess: () => {
      toast.success('Propiedad creada')
      setDireccion('')
      qc.invalidateQueries({ queryKey: ['propiedades'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Propiedades</h2>

      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border p-4"
        onSubmit={(e) => {
          e.preventDefault()
          crear.mutate()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label>Direccion</Label>
          <Input value={direccion} onChange={(e) => setDireccion(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Ciudad</Label>
          <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Modalidad</Label>
          <select
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value as ModalidadCobro)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="completo">Completo (con servicios)</option>
            <option value="sin_servicios">Sin servicios</option>
          </select>
        </div>
        <Button type="submit" disabled={crear.isPending}>
          Agregar
        </Button>
      </form>

      <div className="space-y-3">
        {propiedades.data?.map((p) => (
          <Card key={p.id}>
            <CardHeader>
              <CardTitle className="text-base">
                {p.direccion} · {p.ciudad}
              </CardTitle>
              <span className="text-muted-foreground text-sm">Modalidad: {p.modalidad_cobro}</span>
            </CardHeader>
            <CardContent>
              <ServiciosSubsection propiedadId={p.id} />
            </CardContent>
          </Card>
        ))}
        {propiedades.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">Aun no tienes propiedades.</p>
        )}
      </div>
    </section>
  )
}

function ServiciosSubsection({ propiedadId }: { propiedadId: string }) {
  const qc = useQueryClient()
  const servicios = useQuery({
    queryKey: ['servicios', propiedadId],
    queryFn: () => listServicios(propiedadId),
  })
  const comers = useQuery({ queryKey: ['comercializadoras'], queryFn: listComercializadoras })
  const [tipo, setTipo] = useState<TipoServicio>('gas')
  const [comId, setComId] = useState('')
  const [nic, setNic] = useState('')

  const crear = useMutation({
    mutationFn: () =>
      createServicio({ propiedadId, tipo, comercializadoraId: comId, nicNis: nic }),
    onSuccess: () => {
      toast.success('Servicio agregado')
      setNic('')
      qc.invalidateQueries({ queryKey: ['servicios', propiedadId] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Servicios (NIC/NIS)</p>
      {servicios.data?.map((s) => <ExtraccionRow key={s.id} servicioId={s.id} tipo={s.tipo} nic={s.nic_nis} />)}
      {servicios.data?.length === 0 && (
        <p className="text-muted-foreground text-xs">Sin servicios registrados.</p>
      )}

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!comId) return toast.error('Elige comercializadora')
          crear.mutate()
        }}
      >
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoServicio)}
          className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
        >
          <option value="gas">gas</option>
          <option value="energia">energia</option>
          <option value="agua">agua</option>
        </select>
        <select
          value={comId}
          onChange={(e) => setComId(e.target.value)}
          className="border-input h-8 rounded-md border bg-transparent px-2 text-xs"
        >
          <option value="">comercializadora...</option>
          {comers.data?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
        <Input
          className="h-8 w-40 text-xs"
          placeholder="NIC / contrato"
          value={nic}
          onChange={(e) => setNic(e.target.value)}
        />
        <Button type="submit" size="sm" variant="outline" disabled={crear.isPending}>
          + servicio
        </Button>
      </form>
    </div>
  )
}

function ExtraccionRow({ servicioId, tipo, nic }: { servicioId: string; tipo: string; nic: string }) {
  const ext = useQuery({
    queryKey: ['extracciones', servicioId],
    queryFn: () => listExtracciones(servicioId),
  })
  const ultima = ext.data?.[0]
  return (
    <div className="flex items-center justify-between rounded border px-3 py-1.5 text-xs">
      <span>
        {tipo} · {nic}
      </span>
      {ultima?.valor_extraido ? (
        <span className="text-primary font-medium">
          {formatCOP(ultima.valor_extraido)} · vence {ultima.fecha_limite} ({ultima.estado})
        </span>
      ) : (
        <span className="text-muted-foreground">sin extraccion</span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Contratos
function ContratosSection() {
  const qc = useQueryClient()
  const { accessToken } = useAuth()
  const contratos = useQuery({ queryKey: ['contratos'], queryFn: listContratos })
  const propiedades = useQuery({ queryKey: ['propiedades'], queryFn: listPropiedades })

  const [propiedadId, setPropiedadId] = useState('')
  const [email, setEmail] = useState('')
  const [canon, setCanon] = useState('')
  const [fechaInicio, setFechaInicio] = useState('2026-06-01')
  const [diaCorte, setDiaCorte] = useState('5')

  const crear = useMutation({
    mutationFn: () =>
      createContrato({
        propiedadId,
        arrendatarioEmail: email,
        canon: Number(canon),
        fechaInicio,
        diaCorte: Number(diaCorte),
      }),
    onSuccess: () => {
      toast.success('Contrato creado')
      setEmail('')
      setCanon('')
      qc.invalidateQueries({ queryKey: ['contratos'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Contratos</h2>

      <form
        className="grid grid-cols-2 gap-3 rounded-lg border p-4 md:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!propiedadId) return toast.error('Elige propiedad')
          crear.mutate()
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label>Propiedad</Label>
          <select
            value={propiedadId}
            onChange={(e) => setPropiedadId(e.target.value)}
            className="border-input h-9 rounded-md border bg-transparent px-3 text-sm"
          >
            <option value="">elegir...</option>
            {propiedades.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.direccion}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Email arrendatario</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Canon (COP)</Label>
          <Input type="number" value={canon} onChange={(e) => setCanon(e.target.value)} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Inicio</Label>
          <Input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Dia de corte</Label>
          <Input type="number" min={1} max={28} value={diaCorte} onChange={(e) => setDiaCorte(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={crear.isPending}>
            Crear contrato
          </Button>
        </div>
      </form>

      <div className="space-y-3">
        {contratos.data?.map((c) => (
          <ContratoRow key={c.id} contratoId={c.id} canon={c.canon} accessToken={accessToken} />
        ))}
        {contratos.data?.length === 0 && (
          <p className="text-muted-foreground text-sm">Aun no tienes contratos.</p>
        )}
      </div>
    </section>
  )
}

function ContratoRow({
  contratoId,
  canon,
  accessToken,
}: {
  contratoId: string
  canon: number
  accessToken: string | null
}) {
  const qc = useQueryClient()
  const [periodo, setPeriodo] = useState('2026-06-01')
  const [checkout, setCheckout] = useState<string | null>(null)

  const generar = useMutation({
    mutationFn: async () => {
      if (!accessToken) throw new Error('Sesion no disponible')
      return generarLiquidacion({ data: { contratoId, periodo, accessToken } })
    },
    onSuccess: (res) => {
      setCheckout(res.checkoutUrl)
      toast.success(`Liquidacion generada: total ${formatCOP(res.desglose.total)}`)
      qc.invalidateQueries({ queryKey: ['liquidaciones'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contrato · canon {formatCOP(canon)}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Periodo</Label>
          <Input type="date" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
        </div>
        <Button onClick={() => generar.mutate()} disabled={generar.isPending}>
          {generar.isPending ? 'Generando...' : 'Generar liquidacion'}
        </Button>
        {checkout && (
          <a className="text-primary text-sm underline" href={checkout}>
            Ver liquidacion / link de pago
          </a>
        )}
      </CardContent>
    </Card>
  )
}
