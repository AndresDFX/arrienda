/**
 * CLI de prueba/recon del flujo de extraccion de Gases de Occidente.
 * NO es produccion: sirve para pulir selectores contra el portal real.
 *
 * Uso (Node, no Bun):
 *   node --experimental-strip-types apps/scraper/src/extract.ts <numero_contrato> [--headless]
 *
 * Etapas:
 *   1. Pagar con contrato -> Continuar (#btnIngresar)
 *   2. Paso "Datos": tab "Soy otra persona" -> llenar pesta_1_* -> Continuar (#btnIngresarDatos)
 *   3. Paso montos: leer "Pagar Valor Total" (monto + referencia + vencimiento)
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'

const PORTAL = 'https://portalrecaudos.gdo.com.co/pagorecaudo.aspx'
const contrato = process.argv.find((a) => /^\d{4,}$/.test(a))
const HEADLESS = process.argv.includes('--headless')
const OUT = '.inspect'

// Datos de ejemplo para el tab "Soy otra persona" (un tercero que paga).
const PAGADOR = {
  identificacion: '123456789',
  nombre: 'Pedro',
  apellido: 'Perez',
  movil: '3000000000',
  correo: 'correo@correo.com',
}

if (!contrato) {
  console.error('Uso: extract <numero_contrato> [--headless]')
  process.exit(1)
}

const browser = await chromium.launch({
  headless: HEADLESS,
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
await context.addInitScript(() => {
  Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] })
  // @ts-expect-error chrome runtime stub
  window.chrome = { runtime: {} }
})

const page = await context.newPage()
await mkdir(OUT, { recursive: true })

console.log(`[extract] contrato=${contrato} headless=${HEADLESS}`)
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })

// --- Paso 1: contrato ---
await page.fill('#pesta_0_Digitar_número_de_contrato', contrato)
await page.waitForTimeout(4000) // dar tiempo al Turnstile invisible
await page.click('#btnIngresar')
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(4000)

// --- Paso 2: Datos -> Soy otra persona ---
const tab = page.getByText('Soy otra persona', { exact: false }).first()
if (await tab.count()) await tab.click().catch(() => {})
await page.waitForTimeout(1000)

await page.fill('[name="pesta_1_Identificacion"]', PAGADOR.identificacion).catch(() => {})
await page.fill('[name="pesta_1_Nombre"]', PAGADOR.nombre).catch(() => {})
await page.fill('[name="pesta_1_Apellido"]', PAGADOR.apellido).catch(() => {})
await page.fill('[name="pesta_1_Móvil"]', PAGADOR.movil).catch(() => {})
await page.fill('[name="pesta_1_Correo_Electrónico"]', PAGADOR.correo).catch(() => {})
await page.waitForTimeout(500)
await page.click('#btnIngresarDatos').catch(() => {})
await page.waitForLoadState('networkidle').catch(() => {})
await page.waitForTimeout(5000)

// --- Paso 3: montos ---
await page.screenshot({ path: `${OUT}/paso3-montos.png`, fullPage: true })
const texto = await page.locator('body').innerText()
console.log('\n===== PASO 3 (montos) :: TEXTO =====\n', texto.slice(0, 2500))

const importes = [...texto.matchAll(/\$\s?[\d.]{3,}/g)].map((m) => m[0])
const referencias = [...texto.matchAll(/\b\d{9}\b/g)].map((m) => m[0])
const fechas = [...texto.matchAll(/\b\d{2}\/\d{2}\/\d{4}\b/g)].map((m) => m[0])
console.log('\n[extract] importes :', JSON.stringify(importes))
console.log('[extract] referencias:', JSON.stringify(referencias))
console.log('[extract] fechas    :', JSON.stringify(fechas))

await writeFile(`${OUT}/paso3.html`, await page.content(), 'utf8')
console.log(`\n[extract] screenshot/HTML en ${OUT}/paso3.*`)

await browser.close()
