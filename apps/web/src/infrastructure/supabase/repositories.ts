/**
 * Adaptadores Supabase de los puertos de repositorio (capa de infraestructura).
 *
 * Implementan las interfaces de application/ports/repositories usando el cliente
 * service-role (BYPASEA RLS). `makeSupabaseRepositories(db)` arma el conjunto que
 * los casos de uso reciben por inyección.
 */
import type { ItemServicio } from '@arrienda/shared'
import { LiquidacionDuplicadaError } from '@/application/errors'
import type {
  ContratosRepository,
  LiquidacionesRepository,
  NotificacionesRepository,
  PropiedadesRepository,
  ServiciosRepository,
  TransaccionesRepository,
  UsuariosRepository,
} from '@/application/ports/repositories'
import type { AdminClient } from './admin'

export interface SupabaseRepositories {
  contratos: ContratosRepository
  propiedades: PropiedadesRepository
  servicios: ServiciosRepository
  liquidaciones: LiquidacionesRepository
  transacciones: TransaccionesRepository
  notificaciones: NotificacionesRepository
  usuarios: UsuariosRepository
}

export function makeSupabaseRepositories(db: AdminClient): SupabaseRepositories {
  const contratos: ContratosRepository = {
    async obtener(id) {
      const { data } = await db
        .from('contratos')
        .select('id, canon, propiedad_id, arrendatario_id')
        .eq('id', id)
        .single()
      if (!data) return null
      return {
        id: data.id,
        canon: data.canon,
        propiedadId: data.propiedad_id,
        arrendatarioId: data.arrendatario_id,
      }
    },
  }

  const propiedades: PropiedadesRepository = {
    async obtener(id) {
      const { data } = await db
        .from('propiedades')
        .select('id, arrendador_id, modalidad_cobro')
        .eq('id', id)
        .single()
      if (!data) return null
      return { id: data.id, arrendadorId: data.arrendador_id, modalidadCobro: data.modalidad_cobro }
    },
  }

  const servicios: ServiciosRepository = {
    async facturablesDe(propiedadId, periodo) {
      const { data: servs } = await db
        .from('servicios_publicos')
        .select('id, tipo, comercializadoras(nombre, recaudador_id)')
        .eq('propiedad_id', propiedadId)

      type Com = { nombre: string; recaudador_id: string | null }
      type ServRow = { id: string; tipo: string; comercializadoras: Com | Com[] | null }
      const items: ItemServicio[] = []
      for (const s of (servs ?? []) as unknown as ServRow[]) {
        const com = Array.isArray(s.comercializadoras) ? s.comercializadoras[0] : s.comercializadoras
        const recaudadorId = com?.recaudador_id
        if (!recaudadorId) continue
        const { data: ext } = await db
          .from('extracciones')
          .select('valor_extraido')
          .eq('servicio_id', s.id)
          .eq('periodo', periodo)
          .eq('estado', 'completado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (ext?.valor_extraido) {
          items.push({
            concepto: `${s.tipo} (${com?.nombre ?? 'servicio'})`,
            monto: ext.valor_extraido,
            recaudadorId,
          })
        }
      }
      return items
    },
  }

  const liquidaciones: LiquidacionesRepository = {
    async crearEmitida(input) {
      const { data, error } = await db
        .from('liquidaciones')
        .insert({
          contrato_id: input.contratoId,
          periodo: input.periodo,
          canon: input.canon,
          comision: input.comision,
          total_servicios: input.totalServicios,
          total: input.total,
          estado: 'emitida',
        })
        .select('id')
        .single()
      if (error || !data) {
        if (error?.message?.includes('duplicate')) throw new LiquidacionDuplicadaError()
        throw new Error(`No se pudo crear la liquidación: ${error?.message}`)
      }
      return { id: data.id }
    },

    async agregarDispersion(liquidacionId, items) {
      const { error } = await db.from('liquidacion_items').insert(
        items.map((i) => ({
          liquidacion_id: liquidacionId,
          concepto: i.concepto,
          monto: i.monto,
          destino_tipo: i.destinoTipo,
          destino_ref: i.destinoRef,
        })),
      )
      if (error) throw new Error(`No se pudieron crear los items: ${error.message}`)
    },

    async marcarPagada(id) {
      const { error } = await db.from('liquidaciones').update({ estado: 'pagada' }).eq('id', id)
      if (error) throw new Error(error.message)
    },

    async paraPago(liquidacionId) {
      const { data } = await db
        .from('liquidaciones')
        .select('id, contrato_id, periodo, contratos(arrendatario_id)')
        .eq('id', liquidacionId)
        .single()
      if (!data) return null
      type C = { arrendatario_id?: string }
      const cs = (data as unknown as { contratos?: C | C[] }).contratos
      const c = Array.isArray(cs) ? cs[0] : cs
      if (!c?.arrendatario_id) return null
      return {
        id: data.id,
        contratoId: data.contrato_id,
        periodo: data.periodo,
        arrendatarioId: c.arrendatario_id,
      }
    },
  }

  const transacciones: TransaccionesRepository = {
    async registrar(input) {
      const { error } = await db.from('transacciones').insert({
        liquidacion_id: input.liquidacionId,
        monto: input.monto,
        estado: input.estado,
        pasarela: input.pasarela,
        pasarela_ref: input.pasarelaRef,
      })
      if (error) throw new Error(error.message)
    },

    async obtenerPorReferencia(pasarelaRef) {
      const { data } = await db
        .from('transacciones')
        .select('id, liquidacion_id, estado')
        .eq('pasarela_ref', pasarelaRef)
        .single()
      if (!data) return null
      return { id: data.id, liquidacionId: data.liquidacion_id, estado: data.estado }
    },

    async marcarAprobada(id) {
      const { error } = await db.from('transacciones').update({ estado: 'aprobada' }).eq('id', id)
      if (error) throw new Error(error.message)
    },
  }

  const notificaciones: NotificacionesRepository = {
    async encolarEmail(input) {
      const { error } = await db.from('notificaciones').insert({
        contrato_id: input.contratoId,
        tipo: input.tipo,
        canal: 'email',
        destinatario: input.destinatario,
        periodo: input.periodo,
        dias_antes: 0,
        mensaje: input.mensaje,
        estado: 'pendiente',
      })
      if (error) throw new Error(error.message)
    },
  }

  const usuarios: UsuariosRepository = {
    async emailDe(userId) {
      const { data } = await db.auth.admin.getUserById(userId)
      return data?.user?.email ?? null
    },
  }

  return { contratos, propiedades, servicios, liquidaciones, transacciones, notificaciones, usuarios }
}
