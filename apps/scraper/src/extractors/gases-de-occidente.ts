import type { Page } from 'playwright'
import type { ScrapingJob } from '../queue.ts'
import {
  parsearPesos,
  registerExtractor,
  type ExtractionData,
  type Extractor,
} from './base.ts'

/**
 * Extractor de Gases de Occidente (portal de recaudos).
 *
 * Flujo real (verificado contra el portal con contrato real):
 *   Portal: https://portalrecaudos.gdo.com.co/pagorecaudo.aspx (ASP.NET WebForms).
 *   1. "Pagar con contrato": #pesta_0_Digitar_número_de_contrato -> #btnIngresar
 *   2. "Datos": tab "Soy otra persona" -> pesta_1_* (identificacion/nombre/...) -> #btnIngresarDatos
 *   3. Montos: "Pagar Valor Total" -> monto + referencia de pago + vencimiento
 *
 * Anti-bot: Akamai (borde) + Cloudflare Turnstile invisible. Requiere navegador
 * headful + IP residencial (ver createStealthContext y doc. seccion 5.3). Un
 * contrato inexistente responde "ERROR CLIENTE NO EXISTE".
 */
const PORTAL = 'https://portalrecaudos.gdo.com.co/pagorecaudo.aspx'

const SEL = {
  contrato: '#pesta_0_Digitar_número_de_contrato',
  continuarContrato: '#btnIngresar',
  identificacion: '[name="pesta_1_Identificacion"]',
  nombre: '[name="pesta_1_Nombre"]',
  apellido: '[name="pesta_1_Apellido"]',
  movil: '[name="pesta_1_Móvil"]',
  correo: '[name="pesta_1_Correo_Electrónico"]',
  continuarDatos: '#btnIngresarDatos',
}

/**
 * Datos del "tercero que paga" (tab "Soy otra persona"). Solo se usan para
 * avanzar a la pantalla de montos (no se ejecuta el pago aqui). En produccion
 * podrian venir de configuracion / del arrendatario.
 */
const PAGADOR = {
  identificacion: process.env.GDO_PAGADOR_ID ?? '123456789',
  nombre: process.env.GDO_PAGADOR_NOMBRE ?? 'ARRIENDA',
  apellido: process.env.GDO_PAGADOR_APELLIDO ?? 'PLUS',
  movil: process.env.GDO_PAGADOR_MOVIL ?? '3000000000',
  correo: process.env.GDO_PAGADOR_CORREO ?? 'pagos@arriendamas.co',
}

/** Parsea el bloque "Pagar Valor Total" del texto de la pantalla de montos. */
export function parseMontos(texto: string): ExtractionData {
  const idxTotal = texto.search(/Pagar\s+Valor\s+Total/i)
  const idxVencido = texto.search(/Pagar\s+Valor\s+Vencido/i)
  const bloque =
    idxTotal >= 0 ? texto.slice(idxTotal, idxVencido > idxTotal ? idxVencido : undefined) : texto

  const montoM = bloque.match(/\$\s?([\d.]{3,})/)
  if (!montoM) throw new Error('No se encontro el valor total a pagar')
  const valorExtraido = parsearPesos(montoM[1] ?? '')

  const refPago = bloque.match(/\b\d{9}\b/)?.[0]
  const fechaM = bloque.match(/\b(\d{2})\/(\d{2})\/(\d{4})\b/)
  const fechaLimite = fechaM ? `${fechaM[3]}-${fechaM[2]}-${fechaM[1]}` : undefined

  return { valorExtraido, refPago, fechaLimite }
}

class GasesDeOccidenteExtractor implements Extractor {
  readonly comercializadora = 'Gases de Occidente'

  async extract(page: Page, job: ScrapingJob): Promise<ExtractionData> {
    await page.goto(job.portalUrl ?? PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })

    // Paso 1: numero de contrato (+ Turnstile invisible).
    await page.fill(SEL.contrato, job.nicNis)
    await page.waitForTimeout(4500)
    await page.click(SEL.continuarContrato)
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(3500)

    let texto = await page.locator('body').innerText()
    if (/cliente no existe|no existe/i.test(texto)) {
      throw new Error(`Contrato ${job.nicNis} no existe en Gases de Occidente`)
    }

    // Paso 2: "Datos" -> tab "Soy otra persona" -> formulario.
    const tab = page.getByText('Soy otra persona', { exact: false }).first()
    if (await tab.count()) await tab.click().catch(() => {})
    await page.waitForTimeout(800)
    await page.fill(SEL.identificacion, PAGADOR.identificacion).catch(() => {})
    await page.fill(SEL.nombre, PAGADOR.nombre).catch(() => {})
    await page.fill(SEL.apellido, PAGADOR.apellido).catch(() => {})
    await page.fill(SEL.movil, PAGADOR.movil).catch(() => {})
    await page.fill(SEL.correo, PAGADOR.correo).catch(() => {})
    await page.click(SEL.continuarDatos).catch(() => {})
    await page.waitForLoadState('networkidle').catch(() => {})
    await page.waitForTimeout(4000)

    // Paso 3: montos.
    texto = await page.locator('body').innerText()
    return parseMontos(texto)
  }
}

registerExtractor(new GasesDeOccidenteExtractor())
