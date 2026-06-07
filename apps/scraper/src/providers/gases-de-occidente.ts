import type { Page } from 'playwright'
import {
  parsearPesos,
  registerProvider,
  type ExtractionContext,
  type ExtractionData,
  type Provider,
} from './types.ts'

/**
 * Gases de Occidente (gas) — consulta PUBLICA por numero de contrato.
 * Portal ASP.NET: portalrecaudos.gdo.com.co. Anti-bot: Akamai + Cloudflare
 * Turnstile invisible -> requiere navegador headful + IP residencial.
 * Wizard: Contrato -> Datos ("Soy otra persona") -> Montos.
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

const PAGADOR = {
  identificacion: process.env.GDO_PAGADOR_ID ?? '123456789',
  nombre: process.env.GDO_PAGADOR_NOMBRE ?? 'ARRIENDA',
  apellido: process.env.GDO_PAGADOR_APELLIDO ?? 'PLUS',
  movil: process.env.GDO_PAGADOR_MOVIL ?? '3000000000',
  correo: process.env.GDO_PAGADOR_CORREO ?? 'pagos@arriendamas.co',
}

async function waitForBody(page: Page, re: RegExp, timeout: number): Promise<void> {
  await page
    .waitForFunction(
      (src: string) => new RegExp(src, 'i').test(document.body?.innerText ?? ''),
      re.source,
      { timeout },
    )
    .catch(() => {})
}

/** Parsea el bloque "Pagar Valor Total" de la pantalla de montos. */
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

  return { valorExtraido, refPago, fechaLimite, alDia: valorExtraido === 0 }
}

const provider: Provider = {
  key: 'gases-de-occidente',
  nombre: 'Gases de Occidente',
  tipo: 'gas',
  auth: 'publica',
  portalUrl: PORTAL,

  async extract({ page, identificador }: ExtractionContext): Promise<ExtractionData> {
    await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })

    // Paso 1: numero de contrato (+ Turnstile invisible).
    await page.fill(SEL.contrato, identificador)
    await page.waitForTimeout(4500)
    await page.click(SEL.continuarContrato)
    await waitForBody(page, /soy otra persona|cliente no existe|no existe/i, 35_000)

    let texto = await page.locator('body').innerText()
    if (/cliente no existe|no existe/i.test(texto)) {
      throw new Error(`Contrato ${identificador} no existe en Gases de Occidente`)
    }

    // Paso 2: "Datos" -> tab "Soy otra persona".
    const tab = page.getByText('Soy otra persona', { exact: false }).first()
    if (await tab.count()) await tab.click().catch(() => {})
    await page.waitForTimeout(600)
    await page.fill(SEL.identificacion, PAGADOR.identificacion).catch(() => {})
    await page.fill(SEL.nombre, PAGADOR.nombre).catch(() => {})
    await page.fill(SEL.apellido, PAGADOR.apellido).catch(() => {})
    await page.fill(SEL.movil, PAGADOR.movil).catch(() => {})
    await page.fill(SEL.correo, PAGADOR.correo).catch(() => {})
    await page.click(SEL.continuarDatos).catch(() => {})
    await waitForBody(page, /pagar\s+valor\s+total|monto a pagar/i, 35_000)

    // Paso 3: montos.
    texto = await page.locator('body').innerText()
    return parseMontos(texto)
  },
}

registerProvider(provider)
export default provider
