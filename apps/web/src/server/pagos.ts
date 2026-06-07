import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { createAdminClient, getCallerUser } from '@/lib/supabase/server'

const inputSchema = z.object({
  pasarelaRef: z.string().min(3),
  accessToken: z.string().min(10),
})

/**
 * Confirma un pago MOCK (Fase 0): valida que el usuario sea el arrendatario de la
 * liquidacion, marca la transaccion 'aprobada' y la liquidacion 'pagada'.
 *
 * En produccion esto lo hara el webhook real de la pasarela (Wompi), no el cliente.
 */
export const confirmarPagoMock = createServerFn({ method: 'POST' })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await getCallerUser(data.accessToken)
    const db = createAdminClient()

    const { data: tx, error: errT } = await db
      .from('transacciones')
      .select('id, liquidacion_id, estado')
      .eq('pasarela_ref', data.pasarelaRef)
      .single()
    if (errT || !tx) throw new Error('Transaccion no encontrada')

    // Autorizacion: el caller debe ser el arrendatario del contrato de la liquidacion.
    const { data: liq } = await db
      .from('liquidaciones')
      .select('id, contrato_id, periodo, contratos(arrendatario_id)')
      .eq('id', tx.liquidacion_id)
      .single()
    type ContratoRel = { arrendatario_id?: string }
    const contratos = (liq as unknown as { contratos?: ContratoRel | ContratoRel[] } | null)
      ?.contratos
    const contrato = Array.isArray(contratos) ? contratos[0] : contratos
    const arrendatarioId = contrato?.arrendatario_id
    if (!arrendatarioId || arrendatarioId !== caller.id) {
      throw new Error('No autorizado: no eres el arrendatario de esta liquidacion')
    }

    await db.from('transacciones').update({ estado: 'aprobada' }).eq('id', tx.id)
    await db.from('liquidaciones').update({ estado: 'pagada' }).eq('id', tx.liquidacion_id)

    // Notificación: pago confirmado (la despacha el job notify del scraper).
    const liqRow = liq as unknown as { contrato_id?: string; periodo?: string } | null
    if (caller.email) {
      await db.from('notificaciones').insert({
        contrato_id: liqRow?.contrato_id ?? null,
        tipo: 'pago_confirmado',
        canal: 'email',
        destinatario: caller.email,
        periodo: liqRow?.periodo ?? null,
        dias_antes: 0,
        mensaje: 'Tu pago fue confirmado. ¡Gracias!',
        estado: 'pendiente',
      })
    }

    return { ok: true, liquidacionId: tx.liquidacion_id }
  })
