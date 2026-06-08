/**
 * Puertos de persistencia (capa de aplicación).
 *
 * Los casos de uso dependen SOLO de estas interfaces, nunca de Supabase. Las
 * implementaciones concretas viven en infrastructure/supabase. Esto invierte la
 * dependencia (Clean Architecture): el negocio no conoce el detalle de la BD y
 * los casos de uso se pueden probar con dobles en memoria.
 */
import type { ItemServicio, ModalidadCobro } from '@arrienda/shared'

export interface Contrato {
  id: string
  canon: number
  propiedadId: string
  arrendatarioId: string
}

export interface Propiedad {
  id: string
  arrendadorId: string
  modalidadCobro: ModalidadCobro
}

export interface LiquidacionParaPago {
  id: string
  contratoId: string
  periodo: string
  arrendatarioId: string
}

export interface TransaccionRef {
  id: string
  liquidacionId: string
  estado: string
}

export interface ItemDispersion {
  concepto: string
  monto: number
  destinoTipo: string
  destinoRef: string | null
}

export interface ContratosRepository {
  obtener(id: string): Promise<Contrato | null>
}

export interface PropiedadesRepository {
  obtener(id: string): Promise<Propiedad | null>
}

export interface ServiciosRepository {
  /** Items facturables: servicios con extracción 'completado' para el periodo. */
  facturablesDe(propiedadId: string, periodo: string): Promise<ItemServicio[]>
}

export interface LiquidacionesRepository {
  /** Crea la liquidación 'emitida'. Lanza LiquidacionDuplicadaError si ya existe. */
  crearEmitida(input: {
    contratoId: string
    periodo: string
    canon: number
    comision: number
    totalServicios: number
    total: number
  }): Promise<{ id: string }>
  agregarDispersion(liquidacionId: string, items: ItemDispersion[]): Promise<void>
  marcarPagada(id: string): Promise<void>
  /** Datos mínimos para autorizar y notificar el pago de una liquidación. */
  paraPago(liquidacionId: string): Promise<LiquidacionParaPago | null>
}

export interface TransaccionesRepository {
  registrar(input: {
    liquidacionId: string
    monto: number
    estado: string
    pasarela: string
    pasarelaRef: string
  }): Promise<void>
  obtenerPorReferencia(pasarelaRef: string): Promise<TransaccionRef | null>
  marcarAprobada(id: string): Promise<void>
}

export interface NotificacionesRepository {
  encolarEmail(input: {
    contratoId: string | null
    tipo: string
    destinatario: string
    periodo: string | null
    mensaje: string
  }): Promise<void>
}

export interface UsuariosRepository {
  emailDe(userId: string): Promise<string | null>
}

/** Usuario autenticado que invoca el caso de uso (resuelto en presentación). */
export interface Caller {
  id: string
  email?: string
}
