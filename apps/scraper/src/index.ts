import { chromium, type Browser } from 'playwright'
import { config } from './config.ts'
import { createStealthContext } from './browser.ts'
import { claimJob, reportResult, type ScrapingJob } from './queue.ts'
import { getProvider, credencialesDeProveedor } from './providers/index.ts'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
let running = true

/** Modo de ejecucion: `--once` drena los jobs pendientes y termina (para cron / GitHub Actions). */
const ONCE = process.argv.includes('--once') || process.env.SCRAPER_MODE === 'once'
/** Tope de seguridad de jobs por ejecucion en modo --once. */
const MAX_ONCE_JOBS = 100

async function processJob(browser: Browser, job: ScrapingJob): Promise<void> {
  const provider = getProvider(job.comercializadora)
  if (!provider) {
    await reportResult({
      jobId: job.id,
      estado: 'fallido',
      error: `Sin proveedor registrado para "${job.comercializadora}"`,
    })
    return
  }

  const context = await createStealthContext(browser, config.proxyUrl)
  const page = await context.newPage()
  try {
    const data = await provider.extract({
      page,
      identificador: job.nicNis,
      credenciales: provider.auth === 'autenticada' ? credencialesDeProveedor(provider.key) : undefined,
      periodo: job.periodo,
    })
    await reportResult({
      jobId: job.id,
      estado: 'completado',
      valorExtraido: data.valorExtraido,
      refPago: data.refPago,
      fechaLimite: data.fechaLimite,
    })
    console.log(
      `[scraper] job ${job.id} OK — $${data.valorExtraido} (${provider.nombre}/${provider.tipo})`,
    )
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    await reportResult({ jobId: job.id, estado: 'fallido', error })
    console.error(`[scraper] job ${job.id} FALLO — ${error}`)
  } finally {
    await context.close()
  }
}

/**
 * Modo --once: reclama y procesa jobs hasta que no quede ninguno pendiente, luego sale.
 * Si la API/endpoint aun no esta disponible (p.ej. Fase 1 sin desplegar), sale en
 * limpio sin fallar, para no ensuciar las corridas programadas.
 */
async function drainOnce(browser: Browser): Promise<void> {
  let procesados = 0
  for (let i = 0; i < MAX_ONCE_JOBS; i++) {
    let job: ScrapingJob | null
    try {
      job = await claimJob()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`[scraper] no se pudo reclamar jobs (¿API/endpoint no disponible aun?): ${msg}`)
      break
    }
    if (!job) break
    await processJob(browser, job)
    procesados++
  }
  console.log(`[scraper] modo --once: ${procesados} job(s) procesados`)
}

/** Modo loop: polling continuo (para VM persistente tipo Oracle Cloud). */
async function runLoop(browser: Browser): Promise<void> {
  process.on('SIGINT', () => (running = false))
  process.on('SIGTERM', () => (running = false))
  console.log(`[scraper] loop · DB=${config.supabaseUrl} · intervalo=${config.pollIntervalMs}ms`)

  while (running) {
    try {
      const job = await claimJob()
      if (job) {
        await processJob(browser, job)
      } else {
        await sleep(config.pollIntervalMs)
      }
    } catch (err) {
      console.error('[scraper] error en el loop de polling:', err)
      await sleep(config.pollIntervalMs)
    }
  }
}

async function main(): Promise<void> {
  const browser = await chromium.launch({ headless: config.headless })
  console.log(`[scraper] iniciado · headless=${config.headless} · modo=${ONCE ? 'once' : 'loop'}`)
  try {
    if (ONCE) await drainOnce(browser)
    else await runLoop(browser)
  } finally {
    await browser.close()
  }
  console.log('[scraper] finalizado')
}

main().catch((err) => {
  console.error('[scraper] error fatal:', err)
  process.exit(1)
})
