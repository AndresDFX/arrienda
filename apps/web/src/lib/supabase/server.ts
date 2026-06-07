import { createClient } from '@supabase/supabase-js'

/**
 * Cliente Supabase de SERVIDOR (service role). BYPASEA RLS — usar solo dentro
 * de server functions para operaciones de sistema (generar liquidaciones,
 * confirmar pagos, escribir resultados del scraper).
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el servidor')
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Cliente con la identidad del usuario (anon key + su JWT). Sirve para validar tokens. */
function userClient(accessToken: string) {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Faltan SUPABASE_URL / SUPABASE_ANON_KEY en el servidor')
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Valida el access token y devuelve el usuario (id, email). Lanza si es invalido.
 * Las server functions reciben el token desde el cliente (useAuth) para autorizar.
 */
export async function getCallerUser(accessToken: string): Promise<{ id: string; email?: string }> {
  const { data, error } = await userClient(accessToken).auth.getUser(accessToken)
  if (error || !data.user) throw new Error('No autenticado')
  return { id: data.user.id, email: data.user.email }
}
