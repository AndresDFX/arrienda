import {
  parsearPesos,
  registerProvider,
  type ExtractionContext,
  type ExtractionData,
  type Provider,
} from './types.ts'

/**
 * Acuavalle (agua) — consulta PUBLICA por numero de contrato (portal Wompi).
 * Anti-bot: reCAPTCHA invisible (enterprise) que ejecuta al Consultar; pasa con
 * navegador headful + IP residencial (como el Turnstile de GdO).
 * Resultado: tabla (Cuenta/Factura/Vencimiento/Valor) + "Total a pagar: $X".
 */
const PORTAL = 'https://wompi.acuavalle.gov.co/'
const NOMBRE = process.env.ACUAVALLE_NOMBRE ?? 'ARRIENDA PLUS'

const provider: Provider = {
  key: 'acuavalle',
  nombre: 'Acuavalle',
  tipo: 'agua',
  auth: 'publica',
  portalUrl: PORTAL,

  async extract({ page, identificador }: ExtractionContext): Promise<ExtractionData> {
    await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(2500)
    await page.fill('[name="num_contrato"]', identificador)
    await page.fill('[name="nombre"]', NOMBRE).catch(() => {})
    await page.waitForTimeout(2000) // reCAPTCHA invisible
    await page.getByRole('button', { name: /consultar/i }).click().catch(() => {})

    // Espera a que aparezca la fila del contrato o se actualice el total.
    await page
      .waitForFunction(
        (c: string) => {
          const t = document.body?.innerText ?? ''
          return new RegExp(`${c}\\s+\\d{4,}\\s+\\d{4}-\\d{2}-\\d{2}`).test(t) || /total a pagar/i.test(t)
        },
        identificador,
        { timeout: 40_000 },
      )
      .catch(() => {})
    await page.waitForTimeout(2500)

    const t = await page.locator('body').innerText()
    const totalM = t.match(/Total a pagar:\s*\$?\s?([\d.,]+)/i)
    const rowM = t.match(new RegExp(`${identificador}\\s+(\\d{4,})\\s+(\\d{4}-\\d{2}-\\d{2})`))
    if (!totalM && !rowM) throw new Error(`Acuavalle: no se obtuvo factura para el contrato ${identificador}`)
    const valorExtraido = totalM ? parsearPesos(totalM[1] ?? '') : 0

    return {
      valorExtraido,
      refPago: rowM?.[1],
      fechaLimite: rowM?.[2],
      alDia: valorExtraido === 0,
    }
  },
}

registerProvider(provider)
export default provider
