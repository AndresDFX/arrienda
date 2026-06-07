/**
 * Dominio de ARRIENDA+ — enums y tipos base.
 *
 * Los valores de estos enums DEBEN coincidir con los tipos definidos en las
 * migraciones de Supabase (supabase/migrations). Si cambias uno, cambia el otro.
 */

// --- Roles del sistema (doc. seccion 3) ---
export const ROLES = ['admin', 'arrendador', 'arrendatario'] as const
export type Rol = (typeof ROLES)[number]

// --- Modalidad de cobro por propiedad (doc. seccion 4) ---
export const MODALIDADES_COBRO = ['completo', 'sin_servicios'] as const
export type ModalidadCobro = (typeof MODALIDADES_COBRO)[number]

// --- Tipos de servicio publico (doc. seccion 2.2) ---
export const TIPOS_SERVICIO = ['energia', 'agua', 'gas'] as const
export type TipoServicio = (typeof TIPOS_SERVICIO)[number]

// --- Estados de liquidacion ---
export const ESTADOS_LIQUIDACION = [
  'borrador',
  'emitida',
  'pagada',
  'vencida',
  'anulada',
] as const
export type EstadoLiquidacion = (typeof ESTADOS_LIQUIDACION)[number]

// --- Estados de transaccion (recaudo) ---
export const ESTADOS_TRANSACCION = ['pendiente', 'aprobada', 'rechazada', 'reversada'] as const
export type EstadoTransaccion = (typeof ESTADOS_TRANSACCION)[number]

// --- Destino de un movimiento de dispersion ---
export const DESTINOS = ['arrendador', 'plataforma', 'recaudador'] as const
export type DestinoTipo = (typeof DESTINOS)[number]

// --- Estado de un job de scraping / extraccion (Fase 1) ---
export const ESTADOS_JOB = [
  'pendiente',
  'en_proceso',
  'completado',
  'fallido',
  'manual',
] as const
export type EstadoJob = (typeof ESTADOS_JOB)[number]

// --- Proveedores de pasarela ---
export const PAYMENT_PROVIDERS = ['mock', 'wompi'] as const
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number]

/** Comision por defecto de la plataforma: 5% sobre el canon (doc. seccion 1). */
export const DEFAULT_COMMISSION_RATE = 0.05
