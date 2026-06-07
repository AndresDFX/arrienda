import { describe, it, expect } from 'vitest'
import { calcularLiquidacion } from './liquidacion.ts'
import { calcularComision, formatCOP, sumarPesos } from './money.ts'

const ARRENDADOR = '11111111-1111-1111-1111-111111111111'
const REC_ENERGIA = '22222222-2222-2222-2222-222222222222'
const REC_AGUA = '33333333-3333-3333-3333-333333333333'
const REC_GAS = '44444444-4444-4444-4444-444444444444'

describe('calcularComision', () => {
  it('aplica 5% sobre el canon', () => {
    expect(calcularComision(1_500_000, 0.05)).toBe(75_000)
  })

  it('redondea al peso mas cercano', () => {
    expect(calcularComision(1_333_333, 0.05)).toBe(66_667)
  })

  it('rechaza tasas invalidas', () => {
    expect(() => calcularComision(1000, 1.5)).toThrow()
    expect(() => calcularComision(-1, 0.05)).toThrow()
  })
})

describe('calcularLiquidacion — ejemplo del documento (modalidad completa)', () => {
  const resultado = calcularLiquidacion(
    {
      canon: 1_500_000,
      modalidad: 'completo',
      servicios: [
        { concepto: 'Energia (Celsia)', monto: 180_000, recaudadorId: REC_ENERGIA },
        { concepto: 'Agua (Acueducto)', monto: 95_000, recaudadorId: REC_AGUA },
        { concepto: 'Gas (Gases de Occidente)', monto: 48_000, recaudadorId: REC_GAS },
      ],
    },
    ARRENDADOR,
  )

  it('comision = 75.000', () => {
    expect(resultado.comision).toBe(75_000)
  })

  it('total servicios = 323.000', () => {
    expect(resultado.totalServicios).toBe(323_000)
  })

  it('total que paga el arrendatario = 1.823.000', () => {
    expect(resultado.total).toBe(1_823_000)
  })

  it('arrendador recibe canon neto = 1.425.000', () => {
    expect(resultado.netoArrendador).toBe(1_425_000)
  })

  it('la suma de la dispersion conserva el total pagado', () => {
    expect(sumarPesos(resultado.dispersion.map((d) => d.monto))).toBe(resultado.total)
  })

  it('dispersa a arrendador, plataforma y 3 recaudadores', () => {
    expect(resultado.dispersion).toHaveLength(5)
    const plataforma = resultado.dispersion.find((d) => d.destinoTipo === 'plataforma')
    expect(plataforma?.monto).toBe(75_000)
  })
})

describe('calcularLiquidacion — modalidad sin servicios', () => {
  const resultado = calcularLiquidacion(
    {
      canon: 2_000_000,
      modalidad: 'sin_servicios',
      // los servicios se ignoran en esta modalidad aunque se pasen
      servicios: [{ concepto: 'Energia', monto: 100_000, recaudadorId: REC_ENERGIA }],
    },
    ARRENDADOR,
  )

  it('total = canon (sin servicios)', () => {
    expect(resultado.total).toBe(2_000_000)
    expect(resultado.totalServicios).toBe(0)
  })

  it('solo dispersa a arrendador y plataforma', () => {
    expect(resultado.dispersion).toHaveLength(2)
    expect(resultado.netoArrendador).toBe(1_900_000)
    expect(resultado.comision).toBe(100_000)
  })
})

describe('formatCOP', () => {
  it('formatea en pesos sin decimales', () => {
    // El separador puede variar por entorno ICU; validamos que incluya el numero.
    expect(formatCOP(1_500_000).replace(/\s/g, '')).toContain('1.500.000')
  })
})
