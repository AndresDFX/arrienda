import type { Page } from 'playwright'
import type { ScrapingJob } from '../queue.ts'

/** Datos que un extractor debe obtener del portal de la comercializadora. */
export interface ExtractionData {
  /** Valor adeudado en pesos enteros. */
  valorExtraido: number
  /** Codigo de barras / referencia de recaudo para el pago (Fase 2). */
  refPago?: string
  /** Fecha limite de pago (YYYY-MM-DD). */
  fechaLimite?: string
}

/** Contrato de un extractor por comercializadora. */
export interface Extractor {
  readonly comercializadora: string
  extract(page: Page, job: ScrapingJob): Promise<ExtractionData>
}

const registry = new Map<string, Extractor>()

export function registerExtractor(extractor: Extractor): void {
  registry.set(extractor.comercializadora.toLowerCase(), extractor)
}

export function getExtractor(comercializadora: string): Extractor | undefined {
  return registry.get(comercializadora.toLowerCase())
}

/** Convierte un texto monetario colombiano ("$ 1.823.000") a pesos enteros. */
export function parsearPesos(texto: string): number {
  const limpio = texto.replace(/[^\d]/g, '')
  if (!limpio) throw new Error(`No se pudo parsear monto: "${texto}"`)
  return parseInt(limpio, 10)
}
