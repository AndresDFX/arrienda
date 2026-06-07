/**
 * Recon Acuavalle (agua, portal Wompi). NO produccion.
 *   node --experimental-strip-types apps/scraper/src/recon-acuavalle.ts [contrato]
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { mkdir, writeFile } from 'node:fs/promises'

const PORTAL = 'https://wompi.acuavalle.gov.co/'
const CONTRATO = process.argv.find((a) => /^\d{3,}$/.test(a)) ?? '556925'
const OUT = '.inspect'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

const api: string[] = []
page.on('response', async (r) => {
  const u = r.url()
  if (
    /consult|factura|contrato|saldo|api|invoice|pago|recaudo/i.test(u) &&
    !/\.(js|css|png|jpe?g|svg|woff2?|gif|ico)(\?|$)/i.test(u)
  ) {
    let b = ''
    try {
      const ct = r.headers()['content-type'] ?? ''
      if (ct.includes('json') || ct.includes('text')) b = (await r.text()).slice(0, 900)
    } catch {
      /* */
    }
    api.push(`[${r.status()}] ${u.split('?')[0]}\n  ${b}`)
  }
})

console.log(`[acuavalle] contrato=${CONTRATO}`)
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(3000)
await page.fill('[name="num_contrato"]', CONTRATO).catch(() => {})
await page.fill('[name="nombre"]', 'ARRIENDA PLUS').catch(() => {})
await page.waitForTimeout(2000) // reCAPTCHA invisible
await page.getByRole('button', { name: /consultar/i }).click().catch(() => {})
await page.waitForTimeout(9000)

await page.screenshot({ path: `${OUT}/acuavalle.png`, fullPage: true })
await writeFile(`${OUT}/acuavalle.html`, await page.content(), 'utf8')
const t = await page.locator('body').innerText()
console.log('\n===== TEXTO (2500) =====\n', t.slice(0, 2500))
console.log('\nimportes:', JSON.stringify([...t.matchAll(/\$\s?[\d.,]+/g)].map((m) => m[0])))
console.log('\n===== API =====')
for (const r of api) console.log(r)

await browser.close()
