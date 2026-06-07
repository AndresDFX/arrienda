import {
  parsearPesos,
  registerProvider,
  type ExtractionContext,
  type ExtractionData,
  type Provider,
} from './types.ts'

/**
 * Celsia (energia) — portal AUTENTICADO clientes.celsia.com.
 * Login email+password (iframe SSO azurewebsites) + selector de cuenta.
 *
 * La ruta de "Pagos" (GetInvoice2 / PortfolioStatement) esta protegida por
 * reCAPTCHA v3 server-side ("CAPTCHA not valid"), pero la pagina "Estado de
 * cuenta e historicos" SI renderiza el saldo/total -> leemos de ahi.
 * Requiere navegador headful + IP residencial.
 */
const PORTAL = 'https://clientes.celsia.com/clientes/login/'

const provider: Provider = {
  key: 'celsia',
  nombre: 'Celsia',
  tipo: 'energia',
  auth: 'autenticada',
  portalUrl: PORTAL,

  async extract({ page, credenciales }: ExtractionContext): Promise<ExtractionData> {
    // TODO multi-cuenta: usar `identificador` para seleccionar la cuenta cuando difiera de la activa.
    if (!credenciales?.email || !credenciales?.password) {
      throw new Error('Celsia requiere credenciales (email + password del titular)')
    }

    // 1. Login dentro del iframe SSO.
    await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
    await page.waitForTimeout(3500)
    const frame = page.frames().find((f) => /loginunico|azurewebsites/i.test(f.url()))
    if (!frame) throw new Error('Celsia: no se encontro el iframe de login')
    await frame.waitForSelector('input[name="user"]', { timeout: 15_000 })
    await frame.fill('input[name="user"]', credenciales.email)
    await frame.fill('input[name="password"]', credenciales.password)
    await frame.getByRole('button', { name: 'Ingresar' }).click()
    await page
      .waitForFunction(
        () => /bienvenida|poblado|jamundi|cuenta/i.test(document.body?.innerText ?? ''),
        { timeout: 40_000 },
      )
      .catch(() => {})
    await page.waitForTimeout(2500)

    // 2. (TODO multi-cuenta) seleccionar identificador si no es la cuenta activa.

    // 3. Estado de cuenta e historicos -> renderiza saldo y total a pagar.
    await page.getByText('Estado de cuenta', { exact: false }).first().click().catch(() => {})
    await page.waitForFunction(
      () => /saldo de tu cuenta a la fecha/i.test(document.body?.innerText ?? ''),
      { timeout: 45_000 },
    )
    await page.waitForTimeout(1500)

    const t = await page.locator('body').innerText()
    const totalM = t.match(/Total a pagar\s*\$?\s?([\d.,]+)/i)
    const saldoM = t.match(/Saldo de tu cuenta a la fecha es:\s*\$?\s?([\d.,]+)/i)
    const valorExtraido = totalM ? parsearPesos(totalM[1] ?? '') : saldoM ? parsearPesos(saldoM[1] ?? '') : 0

    return {
      valorExtraido,
      titular: t.match(/Titular:\s*(.+)/i)?.[1]?.trim(),
      direccion: t.match(/Direcci[oó]n del predio:\s*(.+)/i)?.[1]?.trim(),
      alDia: valorExtraido === 0,
    }
  },
}

registerProvider(provider)
export default provider
