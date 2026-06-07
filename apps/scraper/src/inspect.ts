/**
 * Herramienta de reconocimiento (NO es el scraper de produccion).
 *
 * Navega un portal y vuelca su estructura para construir/pulir selectores:
 * campos de formulario, enlaces de factura/pago, iframes, deteccion de CAPTCHA,
 * mas un screenshot y el HTML renderizado.
 *
 * Uso (correr con Node, NO Bun — Bun+Playwright falla en Windows):
 *   node --experimental-strip-types apps/scraper/src/inspect.ts [url] [--headful]
 *
 * --headful  : abre un Chromium REAL (visible) en vez de headless-shell.
 *              Util contra anti-bot (Akamai/Cloudflare) que detectan headless.
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const args = process.argv.slice(2)
const url = args.find((a) => a.startsWith('http')) ?? 'https://www.gdo.com.co'
const HEADFUL = args.includes('--headful') || process.env.INSPECT_HEADFUL === '1'
const OUT = '.inspect'

const browser = await chromium.launch({
  headless: !HEADFUL,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await browser.newContext({
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  viewport: { width: 1366, height: 900 },
  locale: 'es-CO',
  timezoneId: 'America/Bogota',
  extraHTTPHeaders: { 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8' },
})

// Stealth basico: oculta señales tipicas de automatizacion.
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] })
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
  // @ts-expect-error chrome runtime stub
  window.chrome = { runtime: {} }
})

const page = await context.newPage()
console.log(`[inspect] modo=${HEADFUL ? 'headful' : 'headless'} navegando a ${url} ...`)
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
} catch (e) {
  console.warn(`[inspect] networkidle timeout, continuo: ${(e as Error).message}`)
}
await page.waitForTimeout(3000)

const title = await page.title()
console.log('titulo   :', title)
console.log('url final:', page.url())

const blocked = /access denied|forbidden|denegado|unauthorized/i.test(title)
console.log('bloqueado:', blocked)

const inputs = await page.$$eval('input, select, textarea', (els) =>
  els.map((e) => ({
    tag: e.tagName.toLowerCase(),
    type: (e as HTMLInputElement).type ?? '',
    name: (e as HTMLInputElement).name ?? '',
    id: e.id,
    placeholder: (e as HTMLInputElement).placeholder ?? '',
  })),
)
console.log('\n== CAMPOS ==\n', JSON.stringify(inputs, null, 2))

const acciones = await page.$$eval('a, button', (els) =>
  els
    .map((e) => ({
      tag: e.tagName.toLowerCase(),
      text: (e.textContent || '').trim().slice(0, 70),
      href: (e as HTMLAnchorElement).href ?? '',
    }))
    .filter((x) => /factura|pag|consult|recibo|duplicad/i.test(`${x.text} ${x.href}`)),
)
console.log('\n== ACCIONES (factura/pago/consulta) ==\n', JSON.stringify(acciones, null, 2))

const iframes = await page.$$eval('iframe', (els) => els.map((e) => (e as HTMLIFrameElement).src))
console.log('\n== IFRAMES ==\n', JSON.stringify(iframes, null, 2))

const captcha = await page.evaluate(() => ({
  recaptcha: !!document.querySelector(
    '.g-recaptcha, iframe[src*="recaptcha"], script[src*="recaptcha"]',
  ),
  hcaptcha: !!document.querySelector('.h-captcha, iframe[src*="hcaptcha"]'),
  turnstile: !!document.querySelector('.cf-turnstile, iframe[src*="turnstile"]'),
}))
console.log('\n== CAPTCHA ==\n', JSON.stringify(captcha))

await mkdir(OUT, { recursive: true })
await page.screenshot({ path: `${OUT}/page.png`, fullPage: true })
await writeFile(`${OUT}/page.html`, await page.content(), 'utf8')
console.log(`\n[inspect] screenshot y HTML guardados en ${OUT}/`)

await browser.close()
