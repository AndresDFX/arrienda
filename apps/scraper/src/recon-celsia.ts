/**
 * Recon de Celsia: login (iframe SSO) + dashboard. NO es produccion.
 *   node --env-file=.env --experimental-strip-types apps/scraper/src/recon-celsia.ts
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { mkdir, writeFile } from 'node:fs/promises'

const PORTAL = process.env.CELSIA_PORTAL ?? 'https://clientes.celsia.com/clientes/login/'
const EMAIL = process.env.CELSIA_EMAIL ?? ''
const PASSWORD = process.env.CELSIA_PASSWORD ?? ''
const CUENTA = process.env.CELSIA_CUENTA ?? '4016940000'
const OUT = '.inspect'

const browser = await chromium.launch({
  headless: false,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()
await mkdir(OUT, { recursive: true })

// Captura respuestas de API (la consulta de factura va por XHR/fetch a un JSON).
const apiResponses: Array<{ url: string; status: number; body: string }> = []
page.on('response', async (resp) => {
  const url = resp.url()
  if (
    /factura|cuenta|saldo|pago|recaudo|invoice|deuda|consulta|account|bill/i.test(url) &&
    !/\.(js|css|png|jpe?g|svg|woff2?|ico|gif)(\?|$)/i.test(url)
  ) {
    let body = ''
    try {
      if ((resp.headers()['content-type'] ?? '').includes('json')) body = (await resp.text()).slice(0, 1000)
    } catch {
      /* cuerpo no legible */
    }
    apiResponses.push({ url, status: resp.status(), body })
  }
})

console.log(`[celsia] login en ${PORTAL}`)
await page.goto(PORTAL, { waitUntil: 'domcontentloaded', timeout: 45_000 })
await page.waitForTimeout(4000)

// Login dentro del iframe SSO (azurewebsites).
const loginFrame = page.frames().find((f) => /loginunico|azurewebsites/i.test(f.url()))
if (!loginFrame) throw new Error('No se encontro el iframe de login')
await loginFrame.waitForSelector('input[name="user"]', { timeout: 15_000 })
await loginFrame.fill('input[name="user"]', EMAIL)
await loginFrame.fill('input[name="password"]', PASSWORD)
await loginFrame.getByRole('button', { name: 'Ingresar' }).click()
console.log('[celsia] credenciales enviadas, esperando dashboard...')

// Esperar a que el dashboard cargue (sale del login).
await page
  .waitForFunction(
    () => /poblado|jamundi|factura|saldo|valor a pagar|al d[ií]a|cuenta/i.test(document.body?.innerText ?? ''),
    { timeout: 40_000 },
  )
  .catch(() => console.log('[celsia] no detecte dashboard por texto, continuo'))
await page.waitForTimeout(4000)

console.log('titulo:', await page.title())
console.log('url   :', page.url())
await page.screenshot({ path: `${OUT}/celsia-dashboard.png`, fullPage: true })
await writeFile(`${OUT}/celsia-dashboard.html`, await page.content(), 'utf8')

const texto = await page.locator('body').innerText()
console.log('\n===== TEXTO DASHBOARD (primeros 2500) =====\n', texto.slice(0, 2500))

const importes = [...texto.matchAll(/\$\s?[\d.,]{2,}/g)].map((m) => m[0])
console.log('\n[celsia] importes detectados:', JSON.stringify(importes))

console.log(`\n[celsia] screenshot/HTML en ${OUT}/celsia-dashboard.*`)

// Navegar a "Pagos" (Consulta y paga tus facturas)
const pagos = page.getByText('Consulta y paga tus facturas', { exact: false }).first()
if (await pagos.count()) {
  console.log('\n[celsia] entrando a Pagos...')
  await pagos.click().catch(() => {})
  await page.waitForTimeout(6000)

  // Volcar el formulario de la pagina paga-tus-facturas
  const campos = await page.$$eval('input, select, button', (els) =>
    els.map((e) => ({
      tag: e.tagName.toLowerCase(),
      type: (e as HTMLInputElement).type ?? '',
      name: (e as HTMLInputElement).name ?? '',
      id: e.id,
      placeholder: (e as HTMLInputElement).placeholder ?? '',
      text: (e.textContent || '').trim().slice(0, 30),
    })),
  )
  console.log('\nFORM PAGOS:\n', JSON.stringify(campos, null, 2))

  // Seleccionar la cuenta en el combobox codigoCuenta (esta vacio, solo placeholder)
  const cuentaInput = page.locator('[name="codigoCuenta"]').first()
  await cuentaInput.click().catch(() => {})
  await page.waitForTimeout(1200)
  // Opciones del dropdown: dump para depurar
  const opciones = await page
    .locator('[role="option"], li, .MuiAutocomplete-option')
    .allInnerTexts()
    .catch(() => [] as string[])
  console.log('[celsia] opciones combobox:', JSON.stringify(opciones.slice(0, 10)))
  await cuentaInput.fill(CUENTA).catch(() => {})
  await page.waitForTimeout(1200)
  const opt = page.getByRole('option', { name: new RegExp(CUENTA) }).first()
  if (await opt.count()) await opt.click().catch(() => {})
  await page.keyboard.press('Escape').catch(() => {}) // cierra el dropdown que tapa Consultar
  await page.waitForTimeout(800)
  const valCuenta = await cuentaInput.inputValue().catch(() => '')
  console.log('[celsia] valor codigoCuenta:', JSON.stringify(valCuenta))

  const consultar = page.getByRole('button', { name: /consultar/i }).first()
  if (await consultar.count()) {
    await consultar.click({ force: true }).catch(() => {})
    console.log('[celsia] clic en Consultar (reCAPTCHA v3 invisible), esperando resultado...')
  }
  // Esperar a que termine la consulta y aparezca el resultado.
  await page
    .waitForFunction(
      () => {
        const t = document.body?.innerText ?? ''
        if (/estamos consultando/i.test(t)) return false
        return (
          /\$\s?\d{2,}/.test(t) ||
          /no tienes|est[aá]s al d[ií]a|sin facturas|no presentas|pendiente|total a pagar|pagad/i.test(t)
        )
      },
      { timeout: 90_000 },
    )
    .catch(() => console.log('[celsia] no detecte resultado claro tras 90s'))
  await page.waitForTimeout(4000)

  await page.screenshot({ path: `${OUT}/celsia-pagos.png`, fullPage: true })
  await writeFile(`${OUT}/celsia-pagos.html`, await page.content(), 'utf8')
  const t2 = await page.locator('body').innerText()
  console.log('\n===== PAGOS RESULTADO (primeros 3000) =====\n', t2.slice(0, 3000))
  console.log(
    '\n[celsia] importes:',
    JSON.stringify([...t2.matchAll(/\$\s?[\d.,]{2,}/g)].map((m) => m[0])),
  )
  console.log('[celsia] url:', page.url())
}

console.log('\n===== RESPUESTAS API (relacionadas a la consulta) =====')
for (const r of apiResponses) {
  console.log(`\n[${r.status}] ${r.url}`)
  if (r.body) console.log(`  ${r.body}`)
}

await browser.close()
