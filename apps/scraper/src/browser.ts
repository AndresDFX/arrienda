import type { Browser, BrowserContext } from 'playwright'

/**
 * Crea un contexto de navegador con anti-deteccion basica.
 *
 * Necesario para pasar el WAF de las comercializadoras (p.ej. Akamai en Gases
 * de Occidente). Para que funcione DEBE correr en navegador headful + IP
 * residencial (o proxy residencial); en headless/datacenter sera bloqueado
 * (doc. seccion 5.3).
 */
export async function createStealthContext(
  browser: Browser,
  proxyUrl?: string,
): Promise<BrowserContext> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'es-CO',
    timezoneId: 'America/Bogota',
    extraHTTPHeaders: { 'Accept-Language': 'es-CO,es;q=0.9,en;q=0.8' },
    ...(proxyUrl ? { proxy: { server: proxyUrl } } : {}),
  })
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
    Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en'] })
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] })
    // @ts-expect-error chrome runtime stub
    window.chrome = { runtime: {} }
  })
  return context
}
