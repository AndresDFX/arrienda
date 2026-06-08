import { createClient } from '@supabase/supabase-js'
import type { ResultadoExtraccion, TipoServicio } from '@arrienda/shared'
import { config } from './config.ts'

/** Job de extraccion devuelto por la cola (RPC claim_scraping_job). */
export interface ScrapingJob {
  id: string
  servicioId: string
  tipo: TipoServicio
  comercializadora: string
  /** Clave del proveedor del scraper (preferida sobre el nombre). */
  providerKey: string | null
  portalUrl: string | null
  nicNis: string
  /** Credenciales del titular (solo proveedores autenticados). */
  portalUsuario: string | null
  portalPassword: string | null
  periodo: string
}

const db = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/**
 * Reclama atomicamente el siguiente job pendiente (lo marca 'en_proceso').
 * Devuelve null si no hay trabajo.
 */
export async function claimJob(): Promise<ScrapingJob | null> {
  const { data, error } = await db.rpc('claim_scraping_job')
  if (error) throw new Error(`claim_scraping_job: ${error.message}`)
  if (!data) return null
  return data as ScrapingJob
}

/** Publica el resultado de una extraccion (marca el job y registra la extraccion). */
export async function reportResult(result: ResultadoExtraccion): Promise<void> {
  const { error } = await db.rpc('complete_scraping_job', {
    p_job_id: result.jobId,
    p_estado: result.estado,
    p_valor: result.valorExtraido ?? null,
    p_ref: result.refPago ?? null,
    p_fecha: result.fechaLimite ?? null,
    p_error: result.error ?? null,
  })
  if (error) throw new Error(`complete_scraping_job: ${error.message}`)
}
