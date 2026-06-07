/**
 * Capa de datos del cliente: consultas a Supabase con la sesion del usuario
 * (RLS aplica). Las escrituras de sistema (liquidaciones/pagos) van por server fns.
 */
import type { ModalidadCobro, TipoServicio, EstadoLiquidacion } from '@arrienda/shared'
import { supabase } from './supabase/client'

export interface Propiedad {
  id: string
  arrendador_id: string
  direccion: string
  ciudad: string
  modalidad_cobro: ModalidadCobro
}

export interface Comercializadora {
  id: string
  nombre: string
  tipo: TipoServicio
  recaudador_id: string | null
}

export interface Servicio {
  id: string
  propiedad_id: string
  tipo: TipoServicio
  comercializadora_id: string
  nic_nis: string
}

export interface Extraccion {
  id: string
  servicio_id: string
  periodo: string
  valor_extraido: number | null
  ref_pago: string | null
  fecha_limite: string | null
  estado: string
}

export interface Contrato {
  id: string
  propiedad_id: string
  arrendatario_id: string
  canon: number
  fecha_inicio: string
  fecha_fin: string | null
  dia_corte: number
  activo: boolean
}

export interface Liquidacion {
  id: string
  contrato_id: string
  periodo: string
  canon: number
  comision: number
  total_servicios: number
  total: number
  estado: EstadoLiquidacion
  fecha_limite: string | null
}

export interface LiquidacionItem {
  id: string
  concepto: string
  monto: number
  destino_tipo: string
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

// --- Propiedades ---
export async function listPropiedades(): Promise<Propiedad[]> {
  return unwrap(await supabase.from('propiedades').select('*').order('created_at'))
}

export async function createPropiedad(input: {
  arrendadorId: string
  direccion: string
  ciudad: string
  modalidadCobro: ModalidadCobro
}): Promise<Propiedad> {
  return unwrap(
    await supabase
      .from('propiedades')
      .insert({
        arrendador_id: input.arrendadorId,
        direccion: input.direccion,
        ciudad: input.ciudad,
        modalidad_cobro: input.modalidadCobro,
      })
      .select('*')
      .single(),
  )
}

// --- Catalogos / servicios ---
export async function listComercializadoras(): Promise<Comercializadora[]> {
  return unwrap(await supabase.from('comercializadoras').select('*').order('nombre'))
}

export async function listServicios(propiedadId: string): Promise<Servicio[]> {
  return unwrap(
    await supabase.from('servicios_publicos').select('*').eq('propiedad_id', propiedadId),
  )
}

export async function createServicio(input: {
  propiedadId: string
  tipo: TipoServicio
  comercializadoraId: string
  nicNis: string
}): Promise<Servicio> {
  return unwrap(
    await supabase
      .from('servicios_publicos')
      .insert({
        propiedad_id: input.propiedadId,
        tipo: input.tipo,
        comercializadora_id: input.comercializadoraId,
        nic_nis: input.nicNis,
      })
      .select('*')
      .single(),
  )
}

export async function listExtracciones(servicioId: string): Promise<Extraccion[]> {
  return unwrap(
    await supabase
      .from('extracciones')
      .select('*')
      .eq('servicio_id', servicioId)
      .order('created_at', { ascending: false }),
  )
}

// --- Contratos ---
export async function listContratos(): Promise<Contrato[]> {
  return unwrap(await supabase.from('contratos').select('*').order('created_at'))
}

export async function buscarArrendatarioPorEmail(
  email: string,
): Promise<{ id: string; rol: string; nombre: string } | null> {
  const { data, error } = await supabase.rpc('buscar_usuario_por_email', { p_email: email })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  return row ?? null
}

export async function createContrato(input: {
  propiedadId: string
  arrendatarioEmail: string
  canon: number
  fechaInicio: string
  fechaFin?: string
  diaCorte: number
}): Promise<Contrato> {
  const arrendatario = await buscarArrendatarioPorEmail(input.arrendatarioEmail)
  if (!arrendatario) throw new Error('No existe un usuario con ese correo')
  if (arrendatario.rol !== 'arrendatario') {
    throw new Error('El correo no corresponde a un arrendatario')
  }
  return unwrap(
    await supabase
      .from('contratos')
      .insert({
        propiedad_id: input.propiedadId,
        arrendatario_id: arrendatario.id,
        canon: input.canon,
        fecha_inicio: input.fechaInicio,
        fecha_fin: input.fechaFin ?? null,
        dia_corte: input.diaCorte,
      })
      .select('*')
      .single(),
  )
}

// --- Liquidaciones (RLS filtra por rol) ---
export async function listLiquidaciones(): Promise<Liquidacion[]> {
  return unwrap(
    await supabase.from('liquidaciones').select('*').order('created_at', { ascending: false }),
  )
}

export async function listLiquidacionItems(liquidacionId: string): Promise<LiquidacionItem[]> {
  return unwrap(
    await supabase
      .from('liquidacion_items')
      .select('id, concepto, monto, destino_tipo')
      .eq('liquidacion_id', liquidacionId),
  )
}

// --- Configuración de notificaciones ---
export interface NotifConfig {
  dias_antes_corte: number[]
  canal_email: boolean
  canal_whatsapp: boolean
  activo: boolean
}

export async function getNotifConfigGlobal(): Promise<NotifConfig | null> {
  const { data, error } = await supabase
    .from('notificacion_config')
    .select('dias_antes_corte, canal_email, canal_whatsapp, activo')
    .eq('scope', 'global')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as NotifConfig) ?? null
}

export async function saveNotifConfigGlobal(c: NotifConfig): Promise<void> {
  const { error } = await supabase
    .from('notificacion_config')
    .update(c)
    .eq('scope', 'global')
  if (error) throw new Error(error.message)
}

export async function getMiNotifOverride(arrendadorId: string): Promise<NotifConfig | null> {
  const { data, error } = await supabase
    .from('notificacion_config')
    .select('dias_antes_corte, canal_email, canal_whatsapp, activo')
    .eq('scope', 'arrendador')
    .eq('arrendador_id', arrendadorId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as NotifConfig) ?? null
}

export async function saveMiNotifOverride(arrendadorId: string, c: NotifConfig): Promise<void> {
  const { error } = await supabase
    .from('notificacion_config')
    .upsert({ scope: 'arrendador', arrendador_id: arrendadorId, ...c }, { onConflict: 'arrendador_id' })
  if (error) throw new Error(error.message)
}

export async function getTransaccion(
  liquidacionId: string,
): Promise<{ pasarela_ref: string | null; estado: string; monto: number } | null> {
  const { data, error } = await supabase
    .from('transacciones')
    .select('pasarela_ref, estado, monto')
    .eq('liquidacion_id', liquidacionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ?? null
}
