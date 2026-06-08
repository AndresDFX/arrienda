/**
 * Recon AquaServicios (agua) — ¿el reCAPTCHA v2 checkbox auto-pasa con clic?
 *   node --experimental-strip-types apps/scraper/src/recon-aquaservicios.ts [cuenta]
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { mkdir } from 'node:fs/promises'

const PORTAL = 'https://factura.aquaservicios.com/'
const CUENTA = process.argv.find((a) => /^\d{3,}$/.test(a)) ?? '2815001'
const OUT = '.inspect'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

console.log(`[aqua] cuenta=${CUENTA}`)
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(2500)
await page.fill('#Cuenta', CUENTA).catch((e) => console.log('fill:', e.message))

// Clic en el checkbox del anchor iframe.
await page
  .frameLocator('iframe[src*="recaptcha/api2/anchor"]')
  .locator('#recaptcha-anchor')
  .click({ timeout: 15_000 })
  .catch((e) => console.log('click anchor:', e.message))

await page.waitForTimeout(7000)

const tokenLen = await page.evaluate(
  () => (document.querySelector('#g-recaptcha-response') as HTMLTextAreaElement | null)?.value?.length ?? 0,
)
const checked = await page
  .frameLocator('iframe[src*="recaptcha/api2/anchor"]')
  .locator('#recaptcha-anchor')
  .getAttribute('aria-checked')
  .catch(() => 'n/a')
const bframeVisible = await page
  .locator('iframe[src*="recaptcha/api2/bframe"]')
  .isVisible()
  .catch(() => false)

console.log('token length :', tokenLen, '(>0 = resuelto)')
console.log('aria-checked :', checked)
console.log('reto visible :', bframeVisible, '(true = pide imágenes)')

await page.screenshot({ path: `${OUT}/aquaservicios.png`, fullPage: true })
console.log(`screenshot en ${OUT}/aquaservicios.png`)
await browser.close()
