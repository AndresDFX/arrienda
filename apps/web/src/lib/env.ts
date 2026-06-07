/**
 * Variables de entorno del CLIENTE (incluidas en el bundle por Vite).
 * Solo valores publicos: URL y anon key de Supabase.
 */
export const clientEnv = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string,
}

if (!clientEnv.SUPABASE_URL || !clientEnv.SUPABASE_ANON_KEY) {
  // Aviso temprano en dev si falta configuracion (no rompe el build).
  console.warn(
    '[arrienda] Falta VITE_SUPABASE_URL o VITE_SUPABASE_ANON_KEY. Revisa tu .env',
  )
}
