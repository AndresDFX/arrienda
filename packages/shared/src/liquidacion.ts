/**
 * Calculo de liquidacion mensual y dispersion de fondos.
 *
 * Es la regla de negocio central de ARRIENDA+ (doc. seccion 4.3).
 *
 * Reglas:
 *  - El arrendatario paga: canon + servicios (la comision NO se le suma encima).
 *  - La comision (5% del canon) se DESCUENTA del canon antes de dispersar al arrendador.
 *  - Los servicios son pass-through: van integros a cada recaudador, sin margen.
 *  - Invariante: suma(dispersion) === total que paga el arrendatario.
 *
 * Ejemplo del documento:
 *   canon 1.500.000, comision 5% = 75.000, servicios = 323.000
 *   total arrendatario = 1.823.000
 *   dispersion: arrendador 1.425.000 + plataforma 75.000 + recaudadores 323.000
 */
import type { DestinoTipo, ModalidadCobro } from './domain.ts'
import { DEFAULT_COMMISSION_RATE } from './domain.ts'
import { calcularComision, redondearPesos, sumarPesos, type Pesos } from './money.ts'

/** Un cargo de servicio publico ya extraido (o capturado manualmente). */
export interface ItemServicio {
  /** Etiqueta legible: "Energia (Celsia)", "Gas (Gases de Occidente)"... */
  concepto: string
  monto: Pesos
  /** Identificador del recaudador destino (FK recaudadores.id en BD). */
  recaudadorId: string
}

export interface CalcularLiquidacionInput {
  canon: Pesos
  modalidad: ModalidadCobro
  /** Vacio o ignorado cuando modalidad === 'sin_servicios'. */
  servicios?: ItemServicio[]
  /** Tasa de comision (0..1). Por defecto 5%. */
  comisionRate?: number
}

/** Un movimiento de dispersion: a quien y cuanto. */
export interface MovimientoDispersion {
  destinoTipo: DestinoTipo
  /** FK al destino: arrendador_id, recaudador_id, o null para la plataforma. */
  destinoRef: string | null
  concepto: string
  monto: Pesos
}

export interface ResultadoLiquidacion {
  canon: Pesos
  comision: Pesos
  /** Canon neto que recibe el arrendador (canon - comision). */
  netoArrendador: Pesos
  totalServicios: Pesos
  /** Total que paga el arrendatario = canon + totalServicios. */
  total: Pesos
  dispersion: MovimientoDispersion[]
}

/**
 * Calcula la liquidacion completa y el plan de dispersion.
 *
 * @param arrendadorRef  FK del arrendador (para el movimiento de dispersion).
 */
export function calcularLiquidacion(
  input: CalcularLiquidacionInput,
  arrendadorRef: string,
): ResultadoLiquidacion {
  const comisionRate = input.comisionRate ?? DEFAULT_COMMISSION_RATE
  const canon = redondearPesos(input.canon)
  if (canon < 0) throw new RangeError('El canon no puede ser negativo')

  const servicios =
    input.modalidad === 'completo' ? (input.servicios ?? []) : []

  const comision = calcularComision(canon, comisionRate)
  const netoArrendador = canon - comision
  const totalServicios = sumarPesos(servicios.map((s) => s.monto))
  const total = canon + totalServicios

  const dispersion: MovimientoDispersion[] = [
    {
      destinoTipo: 'arrendador',
      destinoRef: arrendadorRef,
      concepto: 'Canon de arriendo (neto de comision)',
      monto: netoArrendador,
    },
    {
      destinoTipo: 'plataforma',
      destinoRef: null,
      concepto: `Comision plataforma (${(comisionRate * 100).toFixed(0)}% del canon)`,
      monto: comision,
    },
    ...servicios.map(
      (s): MovimientoDispersion => ({
        destinoTipo: 'recaudador',
        destinoRef: s.recaudadorId,
        concepto: s.concepto,
        monto: redondearPesos(s.monto),
      }),
    ),
  ]

  // Invariante de conservacion: lo que entra (total) == lo que se dispersa.
  const sumaDispersion = sumarPesos(dispersion.map((d) => d.monto))
  if (sumaDispersion !== total) {
    throw new Error(
      `Inconsistencia en dispersion: total=${total} pero suma dispersion=${sumaDispersion}`,
    )
  }

  return { canon, comision, netoArrendador, totalServicios, total, dispersion }
}
