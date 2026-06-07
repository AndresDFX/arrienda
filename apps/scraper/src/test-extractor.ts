/**
 * Valida el extractor de PRODUCCION contra el portal real, sin la API ni la cola.
 *
 * Uso (Node, no Bun):
 *   node --experimental-strip-types apps/scraper/src/test-extractor.ts <contrato> [--headless]
 */
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { getExtractor } from './extractors/base.ts'
import './extractors/gases-de-occidente.ts' // registra el extractor

const contrato = process.argv.find((a) => /^\d{4,}$/.test(a))
const HEADLESS = process.argv.includes('--headless')
if (!contrato) {
  console.error('Uso: test-extractor <contrato> [--headless]')
  process.exit(1)
}

const browser = await chromium.launch({
  headless: HEADLESS,
  args: ['--disable-blink-features=AutomationControlled'],
})
const context = await createStealthContext(browser)
const page = await context.newPage()

const extractor = getExtractor('Gases de Occidente')
if (!extractor) throw new Error('Extractor no registrado')

try {
  const data = await extractor.extract(page, {
    id: 'test',
    servicioId: 'test',
    tipo: 'gas',
    comercializadora: 'Gases de Occidente',
    portalUrl: null,
    nicNis: contrato,
    periodo: '2026-06-01',
  })
  console.log('\n✅ RESULTADO DEL EXTRACTOR:\n', JSON.stringify(data, null, 2))
} catch (err) {
  console.error('\n❌ FALLO:', err instanceof Error ? err.message : err)
  process.exitCode = 1
} finally {
  await browser.close()
}
