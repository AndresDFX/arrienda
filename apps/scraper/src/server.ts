/**
 * Servidor disparador del scraper (desarrollo / runner residencial).
 * Lanza extracciones bajo demanda desde la UI. Corre en el HOST (headful + IP
 * residencial) porque los portales tienen anti-bot.
 *
 * Uso:  node --env-file=.env --experimental-strip-types apps/scraper/src/server.ts
 *
 * Endpoints:
 *   GET  /health
 *   GET  /providers                                  -> [{ key, nombre, tipo, auth }]
 *   POST /run        { provider, identificador }      -> ExtractionData
 *   POST /run/gdo    { contrato }                     -> ExtractionData (alias)
 */
import { createServer, type IncomingMessage } from 'node:http'
import { chromium } from 'playwright'
import { createStealthContext } from './browser.ts'
import { getProvider, credencialesDeProveedor, listProviders } from './providers/index.ts'

const PORT = Number(process.env.SCRAPER_TRIGGER_PORT ?? '8787')
const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, GET, OPTIONS',
  'access-control-allow-headers': 'content-type',
}
const json = (extra: Record<string, string> = {}) => ({ ...CORS, 'content-type': 'application/json', ...extra })

async function readBody(req: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of req) body += chunk
  return body
}

async function runProvider(
  key: string,
  identificador: string,
  creds?: { usuario?: string; password?: string },
) {
  const provider = getProvider(key)
  if (!provider) throw new Error(`Proveedor desconocido: ${key}`)
  // Credenciales del request (UI) si vienen; si no, del env (cuenta de prueba).
  let credenciales = undefined
  if (provider.auth === 'autenticada') {
    credenciales =
      creds?.usuario && creds?.password
        ? { email: creds.usuario, password: creds.password }
        : credencialesDeProveedor(provider.key)
    if (!credenciales) throw new Error(`"${provider.nombre}" requiere usuario y contraseña`)
  }
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  })
  try {
    const context = await createStealthContext(browser)
    const page = await context.newPage()
    const data = await provider.extract({ page, identificador, credenciales })
    return { provider: provider.key, nombre: provider.nombre, tipo: provider.tipo, ...data }
  } finally {
    await browser.close()
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS)
    return res.end()
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, json())
    return res.end(JSON.stringify({ ok: true }))
  }
  if (req.method === 'GET' && req.url === '/providers') {
    res.writeHead(200, json())
    return res.end(
      JSON.stringify(
        listProviders().map((p) => ({ key: p.key, nombre: p.nombre, tipo: p.tipo, auth: p.auth })),
      ),
    )
  }
  if (req.method === 'POST' && (req.url === '/run' || req.url === '/run/gdo')) {
    let payload: {
      provider?: string
      contrato?: string
      identificador?: string
      usuario?: string
      password?: string
    } = {}
    try {
      payload = JSON.parse((await readBody(req)) || '{}')
    } catch {
      /* */
    }
    const key = req.url === '/run/gdo' ? 'gases-de-occidente' : (payload.provider ?? '')
    const identificador = payload.identificador ?? payload.contrato ?? ''
    if (!key || !/^\d{3,}$/.test(identificador)) {
      res.writeHead(400, json())
      return res.end(JSON.stringify({ ok: false, error: 'Falta provider o identificador valido' }))
    }
    console.log(`[scraper-trigger] /run ${key} ${identificador}`)
    try {
      const data = await runProvider(key, identificador, {
        usuario: payload.usuario,
        password: payload.password,
      })
      res.writeHead(200, json())
      res.end(JSON.stringify({ ok: true, ...data }))
    } catch (err) {
      res.writeHead(500, json())
      res.end(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }))
    }
    return
  }
  res.writeHead(404, CORS)
  res.end()
})

server.listen(PORT, () => {
  console.log(`[scraper-trigger] escuchando en http://localhost:${PORT}`)
  console.log('  proveedores:', listProviders().map((p) => `${p.key}(${p.tipo})`).join(', '))
})
