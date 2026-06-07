/**
 * Prueba un proveedor contra su portal real.
 *   node --env-file=.env --experimental-strip-types apps/scraper/src/test-provider.ts <key> <identificador> [--headless]
 *
 * Ej:  test-provider gases-de-occidente 2910516
 *      test-provider celsia 4016940000        (usa CELSIA_EMAIL/PASSWORD del .env)
 *      test-provider acuavalle 556925
 *      test-provider aquaservicios 2815001
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { getProvider, credencialesDeProveedor, listProviders } from './providers/index.ts'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const headless = process.argv.includes('--headless')
const [key, identificador] = args

if (!key || !identificador) {
  console.error('Uso: test-provider <key> <identificador> [--headless]')
  console.error(
    'Proveedores:',
    listProviders()
      .map((p) => `${p.key} (${p.tipo})`)
      .join(', '),
  )
  process.exit(1)
}

const provider = getProvider(key)
if (!provider) {
  console.error(`Proveedor no encontrado: ${key}`)
  process.exit(1)
}

const browser = await chromium.launch({
  headless,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()
try {
  const data = await provider.extract({
    page,
    identificador,
    credenciales: provider.auth === 'autenticada' ? credencialesDeProveedor(provider.key) : undefined,
  })
  console.log(`\n✅ ${provider.nombre} (${provider.tipo} · ${provider.auth}):\n`, JSON.stringify(data, null, 2))
} catch (e) {
  console.error('\n❌ FALLO:', e instanceof Error ? e.message : e)
  process.exitCode = 1
} finally {
  await browser.close()
}
