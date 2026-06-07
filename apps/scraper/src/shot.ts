/**
 * Captura un screenshot de una URL + reporta errores de consola.
 *   node --experimental-strip-types apps/scraper/src/shot.ts <url> <out.png>
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:3000'
const out = process.argv[3] ?? '.inspect/shot.png'

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage()
const errors: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 }).catch((e) => console.log('goto:', e.message))
await page.waitForTimeout(1800)
await page.screenshot({ path: out, fullPage: true })
console.log('shot guardado:', out)
console.log('titulo:', await page.title())
console.log('errores consola:', errors.length ? JSON.stringify(errors.slice(0, 8), null, 2) : 'ninguno')
await browser.close()
