/**
 * Captura un screenshot de una URL + reporta errores de consola.
 *   node --experimental-strip-types apps/scraper/src/shot.ts <url> <out.png> [width]
 */
import { chromium } from 'playwright'

const url = process.argv[2] ?? 'http://localhost:3000'
const out = process.argv[3] ?? '.inspect/shot.png'
const width = Number(process.argv[4] ?? '1280')

const browser = await chromium.launch({ headless: true })
const page = await (await browser.newContext({ viewport: { width, height: 1000 } })).newPage()
const errors: string[] = []
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))

await page
  .goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  .catch((e) => console.log('goto:', e.message))
await page.waitForTimeout(3500)
await page.screenshot({ path: out, fullPage: true, timeout: 60_000 }).catch((e) => console.log('shot:', e.message))
console.log(`shot ${width}px → ${out}`)
console.log('titulo:', await page.title())
console.log('errores consola:', errors.length ? JSON.stringify(errors.slice(0, 6)) : 'ninguno')
await browser.close()
