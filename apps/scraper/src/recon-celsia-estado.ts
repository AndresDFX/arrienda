/**
 * Recon Celsia (2): tras login, intenta obtener el saldo SIN el reCAPTCHA de
 * GetInvoice2, via el backend de cuentas (GetAccountByUserId?balance=true) y la
 * seccion "Estado de cuenta". NO es produccion.
 *   node --env-file=.env --experimental-strip-types apps/scraper/src/recon-celsia-estado.ts
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { mkdir, writeFile } from 'node:fs/promises'

const PORTAL = process.env.CELSIA_PORTAL ?? 'https://clientes.celsia.com/clientes/login/'
const EMAIL = process.env.CELSIA_EMAIL ?? ''
const PASSWORD = process.env.CELSIA_PASSWORD ?? ''
const OUT = '.inspect'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

// Captura amplia de respuestas JSON de APIs (para hallar el saldo).
const api: string[] = []
page.on('response', async (r) => {
  const u = r.url()
  if (
    /azurewebsites|clientes\/api|invoice|account|factura|estado|balance|saldo|historic|deuda/i.test(u) &&
    !/\.(js|css|png|jpe?g|svg|woff2?|ico|gif)(\?|$)/i.test(u)
  ) {
    let b = ''
    try {
      if ((r.headers()['content-type'] ?? '').includes('json')) b = (await r.text()).slice(0, 700)
    } catch {
      /* */
    }
    api.push(`[${r.status()}] ${u.split('?')[0]}\n  ${b}`)
  }
})

console.log('[celsia] login...')
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(4000)
const loginFrame = page.frames().find((f) => /loginunico|azurewebsites/i.test(f.url()))
if (!loginFrame) throw new Error('No se encontro el iframe de login')
await loginFrame.waitForSelector('input[name="user"]', { timeout: 15_000 })
await loginFrame.fill('input[name="user"]', EMAIL)
await loginFrame.fill('input[name="password"]', PASSWORD)
await loginFrame.getByRole('button', { name: 'Ingresar' }).click()
await page
  .waitForFunction(() => /poblado|jamundi|bienvenida|cuenta/i.test(document.body?.innerText ?? ''), {
    timeout: 40_000,
  })
  .catch(() => {})
await page.waitForTimeout(4000)
console.log('[celsia] logueado, url:', page.url())

// 1) Token + UUID desde el storage del navegador autenticado.
const creds = await page.evaluate(() => {
  const dump: Record<string, string> = {}
  for (const s of [localStorage, sessionStorage]) {
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i)!
      dump[k] = (s.getItem(k) ?? '').slice(0, 1200)
    }
  }
  return dump
})
const blob = JSON.stringify(creds)
const token = blob.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/)?.[0] ?? ''
const uuid =
  blob.match(/[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}/)?.[0] ?? ''
console.log('[celsia] storage keys:', Object.keys(creds))
console.log('[celsia] token hallado:', token ? token.slice(0, 25) + '...' : 'NO')
console.log('[celsia] uuid:', uuid || 'NO')

// 2) Probar GetAccountByUserId con balance=true (sin captcha).
if (uuid) {
  const resBal = await page.evaluate(
    async ({ uuid, token }) => {
      const url = `https://loginunico-prd-back-app.azurewebsites.net/api/AcctId/GetAccountByUserId?uuid=${uuid}&balance=true`
      try {
        const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        return { status: r.status, body: (await r.text()).slice(0, 1500) }
      } catch (e) {
        return { status: 0, body: String(e) }
      }
    },
    { uuid, token },
  )
  console.log('\n===== GetAccountByUserId?balance=true =====\n', JSON.stringify(resBal, null, 2))
}

// 3) Navegar a "Estado de cuenta e históricos" (puede no tener captcha).
const estado = page.getByText('Estado de cuenta', { exact: false }).first()
if (await estado.count()) {
  console.log('\n[celsia] entrando a Estado de cuenta e históricos...')
  await estado.click().catch(() => {})
  await page.waitForTimeout(9000)
  await page.screenshot({ path: `${OUT}/celsia-estado.png`, fullPage: true })
  await writeFile(`${OUT}/celsia-estado.html`, await page.content(), 'utf8')
  const t = await page.locator('body').innerText()
  console.log('\n===== ESTADO DE CUENTA (3000) =====\n', t.slice(0, 3000))
  console.log('importes:', JSON.stringify([...t.matchAll(/\$\s?[\d.,]{2,}/g)].map((m) => m[0])))
}

console.log('\n===== RESPUESTAS API =====')
for (const r of api) console.log(r)

await browser.close()
