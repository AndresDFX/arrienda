/**
 * Caso de uso: generar la liquidación mensual de un contrato.
 *
 * Orquesta el dominio (@arrienda/shared) y los puertos (repos + pasarela). NO
 * conoce TanStack, Supabase ni HTTP: recibe sus dependencias por inyección, así
 * que es testeable con dobles en memoria.
 *
 * Reglas: en modalidad 'completo' suma los servicios extraídos por el scraper
 * para el periodo (canon + gas/energía/agua), calcula comisión 5% + dispersión
 * (lógica de @arrienda/shared), persiste la liquidación 'emitida' y crea el
 * recaudo en la pasarela.
 */
import { calcularLiquidacion, type ResultadoLiquidacion } from '@arrienda/shared'
import type { PaymentGateway } from '../ports/payment-gateway'
import type {
  Caller,
  ContratosRepository,
  LiquidacionesRepository,
  NotificacionesRepository,
  PropiedadesRepository,
  ServiciosRepository,
  TransaccionesRepository,
  UsuariosRepository,
} from '../ports/repositories'
import { NoAutorizadoError, NoEncontradoError } from '../errors'

export interface GenerarLiquidacionDeps {
  contratos: ContratosRepository
  propiedades: PropiedadesRepository
  servicios: ServiciosRepository
  liquidaciones: LiquidacionesRepository
  transacciones: TransaccionesRepository
  notificaciones: NotificacionesRepository
  usuarios: UsuariosRepository
  gateway: PaymentGateway
  /** Tasa de comisión (default en @arrienda/shared si se omite). */
  comisionRate?: number
}

export interface GenerarLiquidacionInput {
  contratoId: string
  periodo: string
  caller: Caller
}

export interface GenerarLiquidacionResult {
  liquidacionId: string
  desglose: ResultadoLiquidacion
  checkoutUrl: string
}

export async function generarLiquidacion(
  deps: GenerarLiquidacionDeps,
  input: GenerarLiquidacionInput,
): Promise<GenerarLiquidacionResult> {
  const contrato = await deps.contratos.obtener(input.contratoId)
  if (!contrato) throw new NoEncontradoError('Contrato no encontrado')

  const propiedad = await deps.propiedades.obtener(contrato.propiedadId)
  if (!propiedad) throw new NoEncontradoError('Propiedad no encontrada')
  if (propiedad.arrendadorId !== input.caller.id) {
    throw new NoAutorizadoError('La propiedad no te pertenece')
  }

  const servicios =
    propiedad.modalidadCobro === 'completo'
      ? await deps.servicios.facturablesDe(propiedad.id, input.periodo)
      : []

  const resultado = calcularLiquidacion(
    {
      canon: contrato.canon,
      modalidad: propiedad.modalidadCobro,
      servicios,
      comisionRate: deps.comisionRate,
    },
    propiedad.arrendadorId,
  )

  const { id: liquidacionId } = await deps.liquidaciones.crearEmitida({
    contratoId: contrato.id,
    periodo: input.periodo,
    canon: resultado.canon,
    comision: resultado.comision,
    totalServicios: resultado.totalServicios,
    total: resultado.total,
  })

  await deps.liquidaciones.agregarDispersion(
    liquidacionId,
    resultado.dispersion.map((d) => ({
      concepto: d.concepto,
      monto: d.monto,
      destinoTipo: d.destinoTipo,
      destinoRef: d.destinoRef,
    })),
  )

  const recaudo = await deps.gateway.crearRecaudo({
    liquidacionId,
    monto: resultado.total,
    referencia: `${contrato.id}-${input.periodo}`,
    descripcion: `Arriendo ${input.periodo}`,
    dispersion: resultado.dispersion,
  })

  await deps.transacciones.registrar({
    liquidacionId,
    monto: resultado.total,
    estado: recaudo.estado,
    pasarela: deps.gateway.provider,
    pasarelaRef: recaudo.pasarelaRef,
  })

  // Notificación (best-effort: no debe tumbar la liquidación si falla).
  const email = await deps.usuarios.emailDe(contrato.arrendatarioId)
  if (email) {
    try {
      await deps.notificaciones.encolarEmail({
        contratoId: contrato.id,
        tipo: 'liquidacion_emitida',
        destinatario: email,
        periodo: input.periodo,
        mensaje: `Tu liquidación de ${input.periodo} por ${resultado.total} COP está lista para pago.`,
      })
    } catch {
      /* best-effort */
    }
  }

  return { liquidacionId, desglose: resultado, checkoutUrl: recaudo.checkoutUrl }
}
