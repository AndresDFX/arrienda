/**
 * Utilidades monetarias para ARRIENDA+.
 *
 * Convencion: TODOS los montos se manejan como enteros en pesos colombianos
 * (COP no usa centavos en la practica del recaudo). Evitamos floats para no
 * arrastrar errores de redondeo en dinero. El tipo `Pesos` es un alias
 * documental de `number` que SIEMPRE debe contener un entero.
 */
export type Pesos = number

/** Redondea a entero de pesos (banker-safe simple: redondeo al mas cercano). */
export function redondearPesos(valor: number): Pesos {
  return Math.round(valor)
}

/**
 * Comision de la plataforma sobre el canon.
 * Regla de negocio (doc. seccion 1 y 4.3): SOLO sobre el canon, nunca sobre servicios.
 */
export function calcularComision(canon: Pesos, rate: number): Pesos {
  if (canon < 0) throw new RangeError('El canon no puede ser negativo')
  if (rate < 0 || rate > 1) throw new RangeError('La tasa de comision debe estar entre 0 y 1')
  return redondearPesos(canon * rate)
}

/** Formatea un monto entero de pesos como moneda colombiana: $1.500.000 */
export function formatCOP(valor: Pesos): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(valor)
}

/** Suma una lista de montos garantizando aritmetica de enteros. */
export function sumarPesos(montos: Pesos[]): Pesos {
  return montos.reduce((acc, m) => acc + redondearPesos(m), 0)
}
