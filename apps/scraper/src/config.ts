/** Configuracion del scraper, leida de variables de entorno. */
function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Falta la variable de entorno ${name}`)
  return v
}

export const config = {
  // El scraper (proceso de confianza) habla directo con Supabase via service_role.
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  pollIntervalMs: Number(process.env.SCRAPER_POLL_INTERVAL_MS ?? '15000'),
  // Para portales con anti-bot (Akamai/Turnstile) DEBE ser false (headful + IP residencial).
  headless: (process.env.SCRAPER_HEADLESS ?? 'false') !== 'false',
  // Proxy residencial (opcional, Fase 3): http://user:pass@host:port
  proxyUrl: process.env.SCRAPER_PROXY_URL || undefined,
}
