import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { calcularLiquidacion, type ItemServicio } from '@arrienda/shared'
import { createAdminClient, getCallerUser } from '@/lib/supabase/server'
import { getPaymentGateway } from './payments'

const inputSchema = z.object({
  contratoId: z.string().uuid(),
  periodo: z.string().date(),
  accessToken: z.string().min(10),
})

/**
 * Genera la liquidacion mensual de un contrato y crea el recaudo en la pasarela.
 *
 * Consume las EXTRACCIONES del scraper: en modalidad 'completo' suma los valores
 * de los servicios extraidos para el periodo (canon + gas/energia/agua), calcula
 * comision 5% + dispersion (logica de @arrienda/shared) y deja la liquidacion lista.
 */
export const generarLiquidacion = createServerFn({ method: 'POST' })
  .validator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await getCallerUser(data.accessToken)
    const db = createAdminClient()

    // Contrato + propiedad
    const { data: contrato, error: errC } = await db
      .from('contratos')
      .select('id, canon, propiedad_id')
      .eq('id', data.contratoId)
      .single()
    if (errC || !contrato) throw new Error('Contrato no encontrado')

    const { data: propiedad, error: errP } = await db
      .from('propiedades')
      .select('id, arrendador_id, modalidad_cobro')
      .eq('id', contrato.propiedad_id)
      .single()
    if (errP || !propiedad) throw new Error('Propiedad no encontrada')
    if (propiedad.arrendador_id !== caller.id) {
      throw new Error('No autorizado: la propiedad no te pertenece')
    }

    // Servicios extraidos (modalidad completo)
    const servicios: ItemServicio[] = []
    if (propiedad.modalidad_cobro === 'completo') {
      const { data: servs } = await db
        .from('servicios_publicos')
        .select('id, tipo, comercializadoras(nombre, recaudador_id)')
        .eq('propiedad_id', propiedad.id)

      type Com = { nombre: string; recaudador_id: string | null }
      type ServRow = { id: string; tipo: string; comercializadoras: Com | Com[] | null }
      for (const s of (servs ?? []) as unknown as ServRow[]) {
        const com = Array.isArray(s.comercializadoras) ? s.comercializadoras[0] : s.comercializadoras
        const recaudadorId = com?.recaudador_id
        if (!recaudadorId) continue
        const { data: ext } = await db
          .from('extracciones')
          .select('valor_extraido')
          .eq('servicio_id', s.id)
          .eq('periodo', data.periodo)
          .eq('estado', 'completado')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (ext?.valor_extraido) {
          servicios.push({
            concepto: `${s.tipo} (${com?.nombre ?? 'servicio'})`,
            monto: ext.valor_extraido,
            recaudadorId,
          })
        }
      }
    }

    const resultado = calcularLiquidacion(
      {
        canon: contrato.canon,
        modalidad: propiedad.modalidad_cobro,
        servicios,
        comisionRate: process.env.COMMISSION_RATE ? Number(process.env.COMMISSION_RATE) : undefined,
      },
      propiedad.arrendador_id,
    )

    // Persistir liquidacion + items
    const { data: liq, error: errL } = await db
      .from('liquidaciones')
      .insert({
        contrato_id: contrato.id,
        periodo: data.periodo,
        canon: resultado.canon,
        comision: resultado.comision,
        total_servicios: resultado.totalServicios,
        total: resultado.total,
        estado: 'emitida',
      })
      .select('id')
      .single()
    if (errL || !liq) {
      throw new Error(
        errL?.message?.includes('duplicate')
          ? 'Ya existe una liquidacion para ese periodo'
          : `No se pudo crear la liquidacion: ${errL?.message}`,
      )
    }

    await db.from('liquidacion_items').insert(
      resultado.dispersion.map((d) => ({
        liquidacion_id: liq.id,
        concepto: d.concepto,
        monto: d.monto,
        destino_tipo: d.destinoTipo,
        destino_ref: d.destinoRef,
      })),
    )

    // Recaudo en la pasarela (mock en Fase 0) + transaccion
    const gateway = getPaymentGateway()
    const recaudo = await gateway.crearRecaudo({
      liquidacionId: liq.id,
      monto: resultado.total,
      referencia: `${contrato.id}-${data.periodo}`,
      descripcion: `Arriendo ${data.periodo}`,
      dispersion: resultado.dispersion,
    })
    await db.from('transacciones').insert({
      liquidacion_id: liq.id,
      monto: resultado.total,
      estado: recaudo.estado,
      pasarela: gateway.provider,
      pasarela_ref: recaudo.pasarelaRef,
    })

    return { liquidacionId: liq.id, desglose: resultado, checkoutUrl: recaudo.checkoutUrl }
  })
