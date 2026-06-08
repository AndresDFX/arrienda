/**
 * Prueba "Opción C": perfil de Chrome PERSISTENTE para ver si el reCAPTCHA v2 de
 * AquaServicios pasa con solo el clic (sin reto de imágenes).
 *
 *   node --experimental-strip-types apps/scraper/src/recon-aqua-persistent.ts [cuenta]
 *   node --experimental-strip-types apps/scraper/src/recon-aqua-persistent.ts --warm
 *     --warm  abre el navegador 3 min para que inicies sesión en Google y/o
 *             resuelvas el captcha UNA vez; el perfil queda "caliente" para futuras corridas.
 */
import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'

const PORTAL = 'https://factura.aquaservicios.com/'
const CUENTA = process.argv.find((a) => /^\d{3,}$/.test(a)) ?? '2815001'
const WARM = process.argv.includes('--warm')
const OUT = '.inspect'

const context = await chromium.launchPersistentContext('.aqua-profile', {
  headless: false,
  viewport: { width: 1366, height: 900 },
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  args: ['--disable-blink-features=AutomationControlled'],
})
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] })
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
  // @ts-expect-error chrome runtime stub
  window.chrome = { runtime: {} }
})

const page = context.pages()[0] ?? (await context.newPage())
await mkdir(OUT, { recursive: true })

if (WARM) {
  console.log('[warm] Abriendo AquaServicios. Inicia sesión en Google y/o resuelve el captcha.')
  console.log('[warm] La ventana se cerrará en 3 minutos; el perfil queda guardado en .aqua-profile')
  await page.goto(PORTAL, { waitUntil: 'domcontentloaded' }).catch(() => {})
  await page.waitForTimeout(180_000)
  await context.close()
  process.exit(0)
}

console.log(`[aqua-persist] cuenta=${CUENTA}`)
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(2500)
await page.fill('#Cuenta', CUENTA).catch((e) => console.log('fill:', e.message))

await page
  .frameLocator('iframe[src*="recaptcha/api2/anchor"]')
  .locator('#recaptcha-anchor')
  .click({ timeout: 15_000 })
  .catch((e) => console.log('click anchor:', e.message))
await page.waitForTimeout(9000)

const tokenLen = await page.evaluate(
  () => (document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement | null)?.value?.length ?? 0,
)
const checked = await page
  .frameLocator('iframe[src*="recaptcha/api2/anchor"]')
  .locator('#recaptcha-anchor')
  .getAttribute('aria-checked')
  .catch(() => 'n/a')
const reto = await page
  .locator('iframe[src*="recaptcha/api2/bframe"]')
  .isVisible()
  .catch(() => false)

console.log(`token len: ${tokenLen}  | aria-checked: ${checked}  | reto visible: ${reto}`)
console.log(tokenLen > 20 ? '✅ PASÓ con solo el clic (opción C viable)' : '❌ no pasó (pidió reto)')
await page.screenshot({ path: `${OUT}/aqua-persistent.png`, fullPage: true })
await context.close()
