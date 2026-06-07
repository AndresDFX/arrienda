import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getMiNotifOverride,
  getNotifConfigGlobal,
  saveMiNotifOverride,
  saveNotifConfigGlobal,
  type NotifConfig,
} from '@/lib/data'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEFAULT: NotifConfig = {
  dias_antes_corte: [5, 3, 1],
  canal_email: true,
  canal_whatsapp: false,
  activo: true,
}

/** Editor de configuración de notificaciones (global para admin, override para arrendador). */
export function NotifConfigForm({
  scope,
  arrendadorId,
}: {
  scope: 'global' | 'arrendador'
  arrendadorId?: string
}) {
  const qc = useQueryClient()
  const key = ['notif-config', scope, arrendadorId ?? '']
  const q = useQuery({
    queryKey: key,
    queryFn: () => (scope === 'global' ? getNotifConfigGlobal() : getMiNotifOverride(arrendadorId!)),
  })

  const [dias, setDias] = useState('')
  const [email, setEmail] = useState(true)
  const [wa, setWa] = useState(false)
  const [activo, setActivo] = useState(true)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    if (hydrated || !q.isFetched) return
    const c = q.data ?? DEFAULT
    setDias(c.dias_antes_corte.join(', '))
    setEmail(c.canal_email)
    setWa(c.canal_whatsapp)
    setActivo(c.activo)
    setHydrated(true)
  }, [q.data, q.isFetched, hydrated])

  const save = useMutation({
    mutationFn: () => {
      const cfg: NotifConfig = {
        dias_antes_corte: dias
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n >= 0),
        canal_email: email,
        canal_whatsapp: wa,
        activo,
      }
      return scope === 'global'
        ? saveNotifConfigGlobal(cfg)
        : saveMiNotifOverride(arrendadorId!, cfg)
    },
    onSuccess: () => {
      toast.success('Configuración guardada')
      qc.invalidateQueries({ queryKey: key })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {scope === 'global' ? 'Notificaciones — configuración global' : 'Mis notificaciones'}
        </CardTitle>
        <span className="text-muted-foreground text-sm">
          Cuándo avisar (días antes del corte) y por qué canal.
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label>Días antes del corte (separados por coma)</Label>
          <Input
            value={dias}
            onChange={(e) => setDias(e.target.value)}
            placeholder="5, 3, 1"
            className="w-48"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email
        </label>
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          <input type="checkbox" checked={wa} onChange={(e) => setWa(e.target.checked)} /> WhatsApp
          (próximamente)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />{' '}
          Activo
        </label>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !hydrated}>
          {save.isPending ? 'Guardando...' : 'Guardar'}
        </Button>
        {scope === 'arrendador' && (
          <p className="text-muted-foreground text-xs">
            Tu configuración reemplaza la global para tus propiedades.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
