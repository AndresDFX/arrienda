import {
  parsearPesos,
  registerProvider,
  type ExtractionContext,
  type ExtractionData,
  type Provider,
} from './types.ts'

/**
 * AquaServicios (agua) — consulta PUBLICA por numero de cuenta.
 * Anti-bot: reCAPTCHA v2 CHECKBOX (visible). Si la reputacion del navegador es
 * buena, el clic pasa sin reto; si Google presenta reto de imagenes, la
 * automatizacion no puede resolverlo (se necesitaria un solver tipo 2captcha).
 */
const PORTAL = 'https://factura.aquaservicios.com/'

const provider: Provider = {
  key: 'aquaservicios',
  nombre: 'AquaServicios',
  tipo: 'agua',
  auth: 'publica',
  portalUrl: PORTAL,

  async extract({ page, identificador }: ExtractionContext): Promise<ExtractionData> {
    await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(2500)
    await page.fill('#Cuenta', identificador)

    // reCAPTCHA v2 checkbox (en el iframe anchor).
    await page
      .frameLocator('iframe[src*="recaptcha/api2/anchor"]')
      .locator('#recaptcha-anchor')
      .click({ timeout: 15_000 })
      .catch(() => {})

    const passed = await page
      .waitForFunction(
        () => {
          const el = document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement | null
          return !!el && el.value.length > 20
        },
        { timeout: 25_000 },
      )
      .then(() => true)
      .catch(() => false)
    if (!passed) {
      throw new Error(
        'AquaServicios: reCAPTCHA v2 no superado (reto de imagenes) — requiere solver (2captcha) o captura manual',
      )
    }

    await page.getByRole('button', { name: /consultar/i }).click().catch(() => {})
    await page.waitForTimeout(6000)

    const t = await page.locator('body').innerText()
    const importes = [...t.matchAll(/\$\s?[\d.]{2,}/g)].map((m) => parsearPesos(m[0]))
    if (importes.length === 0) {
      throw new Error('AquaServicios: no se encontro el valor a pagar')
    }
    const valorExtraido = Math.max(...importes)
    return { valorExtraido, alDia: valorExtraido === 0 }
  },
}

registerProvider(provider)
export default provider
