/**
 * Caso de uso: confirmar el pago de una liquidación (Fase 0 / mock).
 *
 * Valida que el caller sea el arrendatario de la liquidación, marca la
 * transacción 'aprobada' y la liquidación 'pagada'. En producción esto lo
 * dispara el webhook real de la pasarela (Wompi), no el cliente — pero la
 * orquestación es la misma y vive aquí, independiente del transporte.
 */
import type { Caller, LiquidacionesRepository, NotificacionesRepository, TransaccionesRepository } from '../ports/repositories'
import { NoAutorizadoError, NoEncontradoError } from '../errors'

export interface ConfirmarPagoDeps {
  transacciones: TransaccionesRepository
  liquidaciones: LiquidacionesRepository
  notificaciones: NotificacionesRepository
}

export interface ConfirmarPagoInput {
  pasarelaRef: string
  caller: Caller
}

export async function confirmarPago(
  deps: ConfirmarPagoDeps,
  input: ConfirmarPagoInput,
): Promise<{ ok: true; liquidacionId: string }> {
  const tx = await deps.transacciones.obtenerPorReferencia(input.pasarelaRef)
  if (!tx) throw new NoEncontradoError('Transacción no encontrada')

  const liq = await deps.liquidaciones.paraPago(tx.liquidacionId)
  if (!liq) throw new NoEncontradoError('Liquidación no encontrada')
  if (liq.arrendatarioId !== input.caller.id) {
    throw new NoAutorizadoError('No eres el arrendatario de esta liquidación')
  }

  await deps.transacciones.marcarAprobada(tx.id)
  await deps.liquidaciones.marcarPagada(tx.liquidacionId)

  // Notificación (best-effort).
  if (input.caller.email) {
    try {
      await deps.notificaciones.encolarEmail({
        contratoId: liq.contratoId,
        tipo: 'pago_confirmado',
        destinatario: input.caller.email,
        periodo: liq.periodo,
        mensaje: 'Tu pago fue confirmado. ¡Gracias!',
      })
    } catch {
      /* best-effort */
    }
  }

  return { ok: true, liquidacionId: tx.liquidacionId }
}
