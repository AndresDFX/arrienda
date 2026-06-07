import { createClient } from '@supabase/supabase-js'
import { clientEnv } from '@/lib/env'

/**
 * Cliente Supabase para el navegador. Usa la ANON key + sesion del usuario,
 * por lo que TODAS las consultas pasan por RLS (ver migracion 20260607000002_rls).
 */
export const supabase = createClient(clientEnv.SUPABASE_URL, clientEnv.SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
